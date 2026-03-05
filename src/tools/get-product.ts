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
	'image_url',
	'quantity',
	'code',
];

const inputSchema = strictSchemaWithAliases(
	{
		barcode: z.string().describe('Product barcode (EAN-13, UPC-A, etc.)'),
		fields: z.array(z.string()).optional().describe(`Fields to return. Defaults to: ${DEFAULT_FIELDS.join(', ')}`),
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
			const params: Record<string, string> = {
				fields: fields.join(','),
			};

			const data = await offGet(config, `/api/v2/product/${args.barcode}.json`, params);

			return jsonResult(data as Record<string, unknown>);
		},
	);
}
