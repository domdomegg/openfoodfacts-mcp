import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {z} from 'zod';
import type {Config} from './types.js';
import {jsonResult} from '../utils/response.js';
import {strictSchemaWithAliases} from '../utils/schema.js';
import {offPost, offJsonBody} from '../utils/off-api.js';

const packagingComponentSchema = z.object({
	number_of_units: z.number().int().min(1).default(1).describe('How many of this component are in the product (e.g. 6 for a six-pack of cans)'),
	shape: z.string().describe('Taxonomy ID like "en:box", "en:bag", "en:can", "en:bottle", "en:pot", "en:lid", "en:film", "en:individual-bag", "en:tray", "en:sleeve". Prefer IDs over free text — free text gets fuzzy-matched and can resolve to the wrong thing (e.g. "Pouch" becomes "en:pouch-flask" which is a stand-up spouted pouch). Check the taxonomy at /api/v3/taxonomy_suggestions?tagtype=packaging_shapes&string=... if unsure.'),
	material: z.string().optional().describe('Taxonomy ID like "en:plastic", "en:cardboard", "en:aluminium", "en:glass", "en:paper", "en:pet-1-polyethylene-terephthalate"'),
	recycling: z.string().optional().describe('Taxonomy ID like "en:recycle", "en:discard", "en:recycle-with-bags-at-large-supermarket", "en:recycle-in-paper-bin"'),
	quantity_per_unit: z.string().optional().describe('Contents of one unit, e.g. "330ml" for a can'),
	weight_measured: z.number().optional().describe('Empty weight of one unit in grams (if you weighed it)'),
});

/** Nutrient value: a number, or a string with a modifier like "< 0.5", "> 1", "~ 3". */
const nutrientValue = z.union([z.number(), z.string()]).optional();

const nutrientFields = {
	energy_kj: nutrientValue.describe('Energy in kJ. Provide this if it is on the packaging.'),
	energy_kcal: nutrientValue,
	fat: nutrientValue,
	saturated_fat: nutrientValue,
	carbohydrates: nutrientValue,
	sugars: nutrientValue,
	fiber: nutrientValue,
	proteins: nutrientValue,
	salt: nutrientValue,
};

const nutritionSchema = z.object({
	per: z.enum(['100g', '100ml']).default('100g').describe('Whether the values below are per 100g or per 100ml. Almost always "100g" for UK/EU products. Use "100ml" for beverages where the label says per 100ml.'),
	...nutrientFields,
});

const nutritionPerServingSchema = z.object({
	...nutrientFields,
});

const inputSchema = strictSchemaWithAliases(
	{
		barcode: z.string().describe('Product barcode (EAN-13, UPC-A, EAN-8, etc.). Required. If the product doesn\'t exist yet, it will be created.'),

		// Identity — these feed the search index (_keywords)
		product_name: z.string().optional().describe('Product name as printed on the front of pack, e.g. "Boneless Wild Pink Salmon Fillets". Feeds search keywords.'),
		generic_name: z.string().optional().describe('Legal name / product description, often found near the ingredients, e.g. "Carbonated no added sugar pineapple and grapefruit flavoured soft drink with sweeteners". Feeds search keywords.'),
		brands: z.string().optional().describe('Brand name(s), comma-separated. For supermarket own-brands include both the sub-brand and the retailer, e.g. "The Fishmonger, Aldi" — this makes the product findable by either brand tag. Feeds search keywords.'),
		quantity: z.string().optional().describe('Net quantity as printed, e.g. "400g", "6 x 330ml", "1L". OFF parses this into product_quantity automatically.'),

		// Classification — also feeds _keywords
		categories: z.string().optional().describe('Categories, comma-separated, most general first, e.g. "Seafood, Fishes, Salmons, Frozen fishes". Feeds search keywords and enables category browsing.'),
		labels: z.string().optional().describe('Certifications, claims, and dietary marks, comma-separated, e.g. "Sustainable Seafood MSC, Vegan, High protein, No added sugar, Made in Scotland". OFF canonicalises these against its taxonomy.'),

		// Composition
		ingredients_text: z.string().optional().describe('Full ingredients list verbatim from the pack. Mark allergens with underscores, e.g. "Wholegrain _Wheat_ (53%), _Wheat_ Protein, Sugar, _Barley_ Malt Extract". OFF parses this to detect allergens, additives, and compute NOVA group. Percentages matter for Nutri-Score fruit/veg estimation.'),
		allergens: z.string().optional().describe('Allergens, comma-separated, e.g. "en:gluten, en:milk". Usually auto-detected from ingredients_text underscores, so only set this if ingredients are unavailable.'),
		traces: z.string().optional().describe('"May contain" allergens, comma-separated, e.g. "en:nuts, en:peanuts, en:milk, en:sesame-seeds, en:soybeans".'),

		// Provenance
		origins: z.string().optional().describe('Where the ingredients come from, e.g. "Scotland" or "Northeast Pacific (FAO 67), Northwest Pacific (FAO 61)". Affects Eco-Score.'),
		emb_codes: z.string().optional().describe('Traceability/health marks — the oval stamp with a country code, e.g. "CN 2100/02398 EC" or "UK MD047 EC". Comma-separated if multiple.'),
		manufacturing_places: z.string().optional().describe('Where the product was made/packed, e.g. "Grimsby, United Kingdom".'),
		countries: z.string().optional().describe('Countries where sold, comma-separated, e.g. "United Kingdom, Ireland".'),
		stores: z.string().optional().describe('Retailers where sold, comma-separated, e.g. "Aldi, Iceland".'),

		// Packaging — uses v3 PATCH under the hood; this is what the web UI actually renders
		packagings: z.array(packagingComponentSchema).optional().describe('Structured packaging components. Each item describes one physical part of the packaging (outer box, inner bag, lid, etc.). This populates the packagings array the UI displays and feeds the Eco-Score. Use taxonomy IDs ("en:box") not free text.'),
		packagings_complete: z.boolean().optional().describe('Set to true to mark that all packaging components have been listed. Only set this when you are confident the packagings array is complete.'),
		packaging_text: z.string().optional().describe('Recycling instructions and/or packaging information as printed on the pack, e.g. "Tray - Plastic - Recycle\\nFilm - Plastic - Do Not Recycle". This is the human-readable text, separate from the structured packagings array.'),

		// Nutrition
		serving_size: z.string().optional().describe('Serving size as printed, e.g. "30g", "100g (1 fillet)", "330ml (1 can)". OFF uses this to derive per-serving values from per-100g when per-serving values are not provided explicitly.'),
		nutrition: nutritionSchema.optional().describe('Nutrition facts as sold, per 100g (or per 100ml for beverages). Transcribe per-100g values exactly as printed — don\'t back-calculate from per-serving. For values printed as "< 0.5g" on the packet, pass the string "< 0.5" — the less-than modifier will be preserved.'),
		nutrition_per_serving: nutritionPerServingSchema.optional().describe('Nutrition facts as sold, per serving. Use this when the label shows a separate per-serving column alongside per-100g. If omitted and serving_size is set, OFF auto-derives per-serving from per-100g values.'),
		nutrition_prepared: nutritionSchema.optional().describe('Nutrition facts as prepared, per 100g (or per 100ml). For products like jelly mixes, powdered drinks, instant noodles — anything where the packet shows separate "as prepared" nutrition values.'),
		nutrition_prepared_per_serving: nutritionPerServingSchema.optional().describe('Nutrition facts as prepared, per serving. Use this when the label shows a separate per-serving column for prepared values.'),

		// Edit metadata
		comment: z.string().optional().describe('Edit comment explaining what was changed, shown in product edit history. E.g. "Add nutrition data from packaging photo".'),

		// Escape hatch for anything not covered above
		extra_fields: z.record(z.string()).optional().describe('Raw form fields for anything else. Useful for less common nutriments (nutriment_sodium, nutriment_calcium, nutriment_vitamin-c) or fields not exposed above. Values are strings.'),
	},
	{
		code: 'barcode',
	},
);

/**
 * Map from schema field names to OFF API nutrient IDs.
 * Note: API nutrient IDs use hyphens (e.g. "saturated-fat"), not underscores.
 */
const nutrientIdMap: Record<string, string> = {
	energy_kj: 'energy-kj',
	energy_kcal: 'energy-kcal',
	fat: 'fat',
	saturated_fat: 'saturated-fat',
	carbohydrates: 'carbohydrates',
	sugars: 'sugars',
	fiber: 'fiber',
	proteins: 'proteins',
	salt: 'salt',
};

/**
 * Add new-style nutrition params to the request body.
 *
 * New-style param format:
 *   nutrition_input_sets_{preparation}_{per}_nutrients_{nid}_value_string={value}
 *
 * Where preparation is "as_sold" or "prepared", per is "100g"/"100ml"/"serving",
 * and nid uses hyphens (e.g. "saturated-fat").
 */
function addNutritionParams(
	body: Record<string, string>,
	nutrition: Record<string, unknown>,
	preparation: 'as_sold' | 'prepared',
): void {
	const per = (nutrition.per as string) || '100g';
	for (const [field, nid] of Object.entries(nutrientIdMap)) {
		const value = nutrition[field] as string | number | undefined;
		if (value !== undefined) {
			const key = `nutrition_input_sets_${preparation}_${per}_nutrients_${nid}_value_string`;
			body[key] = typeof value === 'number' ? String(value) : value;
		}
	}
}

export function registerAddOrEditProduct(server: McpServer, config: Config): void {
	server.registerTool(
		'add_or_edit_product',
		{
			title: 'Add or edit product',
			description: `Add a new product or edit an existing one on Open Food Facts. Requires OFF_USER_ID and OFF_PASSWORD.

The more fields you fill, the more useful the entry. At minimum provide product_name, brands, and categories — these feed the search index, and a sparse entry won't be findable. If you have a photo of the pack, transcribe everything you can read: ingredients, nutrition, origins, traceability stamps, recycling icons, certifications.

Fields that drive derived data:
- ingredients_text → allergens, additives, NOVA group, fruit/veg %
- nutrition + categories → Nutri-Score
- packagings + origins → Eco-Score
- product_name + brands + categories + labels → search _keywords

Pitfalls learned the hard way:
- Free-text packaging shapes get fuzzy-matched against the taxonomy. "Pouch" resolves to "en:pouch-flask" (a stand-up spouted pouch). Use taxonomy IDs like "en:bag" or "en:individual-bag" instead.
- OFF has no generic "pouch" shape in its taxonomy. For vacuum-sealed individual portions use "en:individual-bag"; for plastic film wrap use "en:film".

Recommended workflow for adding a product from photos:
1. Check if product exists with get_product first to avoid overwriting good data
2. Upload photos with upload_image (front, back/nutrition, ingredients panels)
3. Call this tool with all fields you can read from the photos
4. Set packagings_complete: true only when all packaging components are listed

For products with only prepared nutrition (jelly mixes, powdered drinks, etc.), use nutrition_prepared instead of nutrition.
For values printed as "< 0.5g" on the packet, pass the string "< 0.5" — the less-than modifier will be preserved.

Nutrition fields mirror the label columns: nutrition (per 100g as sold), nutrition_per_serving (per serving as sold), nutrition_prepared (per 100g prepared), nutrition_prepared_per_serving (per serving prepared). OFF auto-derives per-serving from per-100g + serving_size, so nutrition_per_serving is only needed when the label shows explicit per-serving values you want to preserve.`,
			inputSchema,
			annotations: {
				readOnlyHint: false,
			},
		},
		async (args) => {
			const body: Record<string, string> = {
				code: args.barcode,
			};

			if (args.product_name !== undefined) {
				body.product_name = args.product_name;
			}

			if (args.generic_name !== undefined) {
				body.generic_name = args.generic_name;
			}

			if (args.brands !== undefined) {
				body.brands = args.brands;
			}

			if (args.quantity !== undefined) {
				body.quantity = args.quantity;
			}

			if (args.categories !== undefined) {
				body.categories = args.categories;
			}

			if (args.labels !== undefined) {
				body.labels = args.labels;
			}

			if (args.ingredients_text !== undefined) {
				body.ingredients_text = args.ingredients_text;
			}

			if (args.allergens !== undefined) {
				body.allergens = args.allergens;
			}

			if (args.traces !== undefined) {
				body.traces = args.traces;
			}

			if (args.origins !== undefined) {
				body.origins = args.origins;
			}

			if (args.emb_codes !== undefined) {
				body.emb_codes = args.emb_codes;
			}

			if (args.manufacturing_places !== undefined) {
				body.manufacturing_places = args.manufacturing_places;
			}

			if (args.countries !== undefined) {
				body.countries = args.countries;
			}

			if (args.stores !== undefined) {
				body.stores = args.stores;
			}

			if (args.serving_size !== undefined) {
				body.serving_size = args.serving_size;
			}

			if (args.packaging_text !== undefined) {
				body.packaging_text_en = args.packaging_text;
			}

			if (args.comment !== undefined) {
				body.comment = args.comment;
			}

			if (args.nutrition) {
				addNutritionParams(body, args.nutrition as Record<string, unknown>, 'as_sold');
			}

			if (args.nutrition_per_serving) {
				addNutritionParams(body, {...args.nutrition_per_serving as Record<string, unknown>, per: 'serving'}, 'as_sold');
			}

			if (args.nutrition_prepared) {
				addNutritionParams(body, args.nutrition_prepared as Record<string, unknown>, 'prepared');
			}

			if (args.nutrition_prepared_per_serving) {
				addNutritionParams(body, {...args.nutrition_prepared_per_serving as Record<string, unknown>, per: 'serving'}, 'prepared');
			}

			if (args.extra_fields) {
				for (const [key, value] of Object.entries(args.extra_fields as Record<string, string>)) {
					body[key] = value;
				}
			}

			const results: Record<string, unknown> = {};

			// Only call the v2 form endpoint if there's something to write beyond the barcode
			if (Object.keys(body).length > 1) {
				results.fields = await offPost(config, '/cgi/product_jqm2.pl', body);
			}

			// Structured packagings go through v3 PATCH — the v2 form endpoint doesn't
			// populate the packagings array that the UI reads.
			const needsV3Patch = (args.packagings && (args.packagings as unknown[]).length > 0) || args.packagings_complete !== undefined;
			if (needsV3Patch) {
				type PackagingInput = z.infer<typeof packagingComponentSchema>;
				const v3Product: Record<string, unknown> = {};

				if (args.packagings && (args.packagings as unknown[]).length > 0) {
					const components = (args.packagings as PackagingInput[]).map((p) => {
						const c: Record<string, unknown> = {
							number_of_units: p.number_of_units,
							shape: {id: p.shape},
						};
						if (p.material !== undefined) {
							c.material = {id: p.material};
						}

						if (p.recycling !== undefined) {
							c.recycling = {id: p.recycling};
						}

						if (p.quantity_per_unit !== undefined) {
							c.quantity_per_unit = p.quantity_per_unit;
						}

						if (p.weight_measured !== undefined) {
							c.weight_measured = p.weight_measured;
						}

						return c;
					});
					v3Product.packagings = components;
				}

				if (args.packagings_complete !== undefined) {
					v3Product.packagings_complete = args.packagings_complete ? 1 : 0;
				}

				const fields = Object.keys(v3Product).join(',');
				results.packagings = await offJsonBody(config, 'PATCH', `/api/v3/product/${args.barcode}`, {
					fields,
					product: v3Product,
				});
			}

			return jsonResult(results);
		},
	);
}
