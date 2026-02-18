import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {z} from 'zod';
import type {Config} from './types.js';
import {jsonResult} from '../utils/response.js';
import {strictSchemaWithAliases} from '../utils/schema.js';
import {offGet} from '../utils/off-api.js';

const DEFAULT_FIELDS = [
	'code',
	'product_name',
	'brands',
	'categories',
	'nutriscore_grade',
	'nova_group',
	'image_url',
	'quantity',
];

const inputSchema = strictSchemaWithAliases(
	{
		query: z.string().optional().describe('Full-text search query'),
		categories_tags: z.string().optional().describe('Filter by category tag (e.g. "en:breakfast-cereals")'),
		brands_tags: z.string().optional().describe('Filter by brand tag (e.g. "nestle")'),
		nutrition_grades_tags: z.string().optional().describe('Filter by Nutri-Score grade (a, b, c, d, e)'),
		sort_by: z.enum([
			'popularity',
			'product_name',
			'created_t',
			'last_modified_t',
			'nutriscore_score',
			'nova_score',
		]).optional().describe('Sort order'),
		page: z.number().int().min(1).default(1).describe('Page number (default: 1)'),
		page_size: z.number().int().min(1).max(100).default(24).describe('Results per page (default: 24, max: 100)'),
		fields: z.array(z.string()).optional().describe(`Fields to return per product. Defaults to: ${DEFAULT_FIELDS.join(', ')}`),
	},
	{
		q: 'query',
		search: 'query',
	},
);

export function registerSearchProducts(server: McpServer, config: Config): void {
	server.registerTool(
		'search_products',
		{
			title: 'Search products',
			description: 'Search the Open Food Facts database by name or keywords. Supports full-text search and filtering by category, brand, and Nutri-Score. Use get_product to see full details for a specific product.',
			inputSchema,
			annotations: {
				readOnlyHint: true,
			},
		},
		async (args) => {
			const params: Record<string, string> = {
				page: String(args.page),
				page_size: String(args.page_size),
				json: '1',
				search_simple: '1',
				action: 'process',
			};

			if (args.query) {
				params.search_terms = args.query;
			}

			if (args.categories_tags) {
				params.categories_tags = args.categories_tags;
			}

			if (args.brands_tags) {
				params.brands_tags = args.brands_tags;
			}

			if (args.nutrition_grades_tags) {
				params.nutrition_grades_tags = args.nutrition_grades_tags;
			}

			if (args.sort_by) {
				params.sort_by = args.sort_by;
			}

			const fields = args.fields ?? DEFAULT_FIELDS;
			params.fields = fields.join(',');

			const data = await offGet(config, '/cgi/search.pl', params);

			return jsonResult(data as Record<string, unknown>);
		},
	);
}
