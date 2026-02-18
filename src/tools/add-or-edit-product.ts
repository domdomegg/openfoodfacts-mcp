import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {z} from 'zod';
import type {Config} from './types.js';
import {jsonResult} from '../utils/response.js';
import {strictSchemaWithAliases} from '../utils/schema.js';
import {offPost} from '../utils/off-api.js';

const inputSchema = strictSchemaWithAliases(
	{
		barcode: z.string().describe('Product barcode'),
		product_name: z.string().optional().describe('Product name'),
		brands: z.string().optional().describe('Brand name(s), comma-separated'),
		categories: z.string().optional().describe('Categories, comma-separated'),
		labels: z.string().optional().describe('Labels (e.g. "organic, fair-trade"), comma-separated'),
		quantity: z.string().optional().describe('Product quantity (e.g. "500g", "1L")'),
		ingredients_text: z.string().optional().describe('Ingredients list as text'),
		packaging: z.string().optional().describe('Packaging type(s), comma-separated'),
		stores: z.string().optional().describe('Store(s) where sold, comma-separated'),
		countries: z.string().optional().describe('Countries where sold, comma-separated'),
		extra_fields: z.record(z.string()).optional().describe('Additional fields as key-value pairs (e.g. nutriment_energy_100g)'),
	},
	{
		code: 'barcode',
	},
);

export function registerAddOrEditProduct(server: McpServer, config: Config): void {
	server.registerTool(
		'add_or_edit_product',
		{
			title: 'Add or edit product',
			description: 'Add a new product or edit an existing one on Open Food Facts. Requires OFF_USER_ID and OFF_PASSWORD.',
			inputSchema,
			annotations: {
				readOnlyHint: false,
			},
		},
		async (args) => {
			const body: Record<string, string> = {
				code: args.barcode,
			};

			if (args.product_name) {
				body.product_name = args.product_name;
			}

			if (args.brands) {
				body.brands = args.brands;
			}

			if (args.categories) {
				body.categories = args.categories;
			}

			if (args.labels) {
				body.labels = args.labels;
			}

			if (args.quantity) {
				body.quantity = args.quantity;
			}

			if (args.ingredients_text) {
				body.ingredients_text = args.ingredients_text;
			}

			if (args.packaging) {
				body.packaging = args.packaging;
			}

			if (args.stores) {
				body.stores = args.stores;
			}

			if (args.countries) {
				body.countries = args.countries;
			}

			if (args.extra_fields) {
				for (const [key, value] of Object.entries(args.extra_fields as Record<string, string>)) {
					body[key] = value;
				}
			}

			const data = await offPost(config, '/cgi/product_jqm2.pl', body);

			return jsonResult(data as Record<string, unknown>);
		},
	);
}
