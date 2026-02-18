import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {z} from 'zod';
import type {Config} from './types.js';
import {jsonResult} from '../utils/response.js';
import {strictSchemaWithAliases} from '../utils/schema.js';
import {offGet} from '../utils/off-api.js';

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
		fields: z.array(z.string()).optional().describe('Fields to return per product'),
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
			description: 'Search the Open Food Facts database. Supports full-text search and filtering by category, brand, and Nutri-Score.',
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

			if (args.fields) {
				params.fields = args.fields.join(',');
			}

			const data = await offGet(config, '/api/v2/search', params);

			return jsonResult(data as Record<string, unknown>);
		},
	);
}
