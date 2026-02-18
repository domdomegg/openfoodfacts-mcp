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
			description: 'Get product information from Open Food Facts by barcode.',
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
