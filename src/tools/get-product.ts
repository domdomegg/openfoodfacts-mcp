import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {z} from 'zod';
import type {Config} from './types.js';
import {jsonResult} from '../utils/response.js';
import {strictSchemaWithAliases} from '../utils/schema.js';
import {offGet} from '../utils/off-api.js';

const DEFAULT_FIELDS = [
	'product_name',
	'brands',
	'categories',
	'nutriscore_grade',
	'nova_group',
	'ingredients_text',
	'nutriments',
	'serving_size',
	'image_url',
	'quantity',
	'code',
];

/**
 * Language-dependent fields where the unsuffixed version (e.g. "product_name")
 * maps to the product's primary language, not necessarily English.
 * We request both the unsuffixed and _en versions so we always get English data.
 */
const LANGUAGE_DEPENDENT_FIELDS = ['product_name', 'generic_name', 'ingredients_text'];

/**
 * The core nutrients we extract when restructuring the nutriments blob.
 * Maps from a display name to the OFF API prefix.
 */
const CORE_NUTRIENTS: Record<string, string> = {
	energy_kj: 'energy-kj',
	energy_kcal: 'energy-kcal',
	fat: 'fat',
	saturated_fat: 'saturated-fat',
	carbohydrates: 'carbohydrates',
	sugars: 'sugars',
	fiber: 'fiber',
	proteins: 'proteins',
	salt: 'salt',
	sodium: 'sodium',
};

/**
 * Restructure the flat OFF nutriments object into a nested format that mirrors
 * the four label columns: per_100g, per_serving, prepared_per_100g, prepared_per_serving.
 *
 * Input (flat):  { "fat_100g": 30.9, "fat_serving": 4.63, "fat_prepared_100g": 0.5, ... }
 * Output (nested): { per_100g: { fat: 30.9 }, per_serving: { fat: 4.63 }, prepared_per_100g: { fat: 0.5 }, ... }
 */
function restructureNutriments(nutriments: Record<string, unknown>): Record<string, unknown> {
	const per100g: Record<string, unknown> = {};
	const perServing: Record<string, unknown> = {};
	const preparedPer100g: Record<string, unknown> = {};
	const preparedPerServing: Record<string, unknown> = {};

	for (const [displayName, apiPrefix] of Object.entries(CORE_NUTRIENTS)) {
		// as-sold per 100g: "fat_100g"
		const val100g = nutriments[`${apiPrefix}_100g`] as number | undefined;
		if (val100g !== undefined && val100g !== null) {
			const modifier = nutriments[`${apiPrefix}_modifier`] as string | undefined;
			per100g[displayName] = modifier ? `${modifier} ${val100g}` : val100g;
		}

		// as-sold per serving: "fat_serving"
		const valServing = nutriments[`${apiPrefix}_serving`];
		if (valServing !== undefined && valServing !== null) {
			perServing[displayName] = valServing;
		}

		// prepared per 100g: "fat_prepared_100g"
		const valPrep100g = nutriments[`${apiPrefix}_prepared_100g`] as number | undefined;
		if (valPrep100g !== undefined && valPrep100g !== null) {
			const modifier = nutriments[`${apiPrefix}_prepared_modifier`] as string | undefined;
			preparedPer100g[displayName] = modifier ? `${modifier} ${valPrep100g}` : valPrep100g;
		}

		// prepared per serving: "fat_prepared_serving"
		const valPrepServing = nutriments[`${apiPrefix}_prepared_serving`];
		if (valPrepServing !== undefined && valPrepServing !== null) {
			preparedPerServing[displayName] = valPrepServing;
		}
	}

	// Only include non-empty sections
	const result: Record<string, unknown> = {};
	if (Object.keys(per100g).length > 0) {
		result.per_100g = per100g;
	}

	if (Object.keys(perServing).length > 0) {
		result.per_serving = perServing;
	}

	if (Object.keys(preparedPer100g).length > 0) {
		result.prepared_per_100g = preparedPer100g;
	}

	if (Object.keys(preparedPerServing).length > 0) {
		result.prepared_per_serving = preparedPerServing;
	}

	return result;
}

const inputSchema = strictSchemaWithAliases(
	{
		barcode: z.string().describe('Product barcode (EAN-13, UPC-A, etc.)'),
		fields: z.array(z.string()).optional().describe(`Fields to return. Defaults to: ${DEFAULT_FIELDS.join(', ')}`),
		language: z.string().default('en').describe('Language code for language-dependent fields (product_name, generic_name, ingredients_text). Defaults to "en". When a product has a different primary language, the unsuffixed field names return that language\'s data — this param ensures you get the language you want.'),
	},
	{
		code: 'barcode',
		ean: 'barcode',
	},
);

export function registerGetProduct(server: McpServer, config: Config): void {
	server.registerTool(
		'get_product',
		{
			title: 'Get product',
			description: 'Get product information from Open Food Facts by barcode. Reads the primary database directly (no sync lag), so this is always current even when search_products returns stale results. Prefer this over search whenever you have a barcode. If this returns "product not found", the product genuinely isn\'t in the database — you can add it with add_or_edit_product.',
			inputSchema,
			annotations: {
				readOnlyHint: true,
			},
		},
		async (args) => {
			const fields = args.fields ?? DEFAULT_FIELDS;
			const lang = args.language as string;

			// For language-dependent fields, also request the lang-suffixed version
			// so we can prefer the requested language regardless of the product's
			// primary language.
			const langFields: string[] = [];
			for (const field of fields) {
				if (LANGUAGE_DEPENDENT_FIELDS.includes(field)) {
					langFields.push(`${field}_${lang}`);
				}
			}

			const allFields = [...fields, ...langFields];
			const params: Record<string, string> = {
				fields: allFields.join(','),
			};

			const data = await offGet(config, `/api/v2/product/${args.barcode}.json`, params) as Record<string, unknown>;

			// Prefer lang-suffixed values over unsuffixed (which map to the product's
			// primary language and may not be what was requested).
			const product = data.product as Record<string, unknown> | undefined;
			if (product) {
				for (const field of LANGUAGE_DEPENDENT_FIELDS) {
					const langKey = `${field}_${lang}`;
					if (product[langKey] !== undefined && product[langKey] !== null && product[langKey] !== '') {
						product[field] = product[langKey];
					}

					// Remove the lang-suffixed field from output to keep response clean,
					// unless the caller explicitly requested it.
					if (!fields.includes(langKey)) {
						// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
						delete product[langKey];
					}
				}
			}

			// Restructure the flat nutriments blob into a readable nested format
			if (product?.nutriments) {
				product.nutriments = restructureNutriments(product.nutriments as Record<string, unknown>);
			}

			return jsonResult(data);
		},
	);
}
