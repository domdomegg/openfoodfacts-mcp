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
		query: z.string().optional().describe('Search terms. Strict AND: every word must exist in the product\'s indexed keywords, so prefer 2-3 distinctive words over the full product name. Use words as they appear on the pack (don\'t strip plurals or possessives — the search normalizes both sides). Put brand names in brands_tags instead of here.'),
		categories_tags: z.string().optional().describe('Filter by category tag (e.g. "en:breakfast-cereals", "en:tomatoes"). Best way to find fresh produce: text-searching "banana" matches thousands of banana-flavoured products, but categories_tags "en:bananas" finds actual bananas.'),
		brands_tags: z.string().optional().describe('Filter by brand. Input is normalized, so "sainsburys", "sainsbury\'s", "sainsbury-s" all match the same brand — no need to know the exact tag slug. More reliable than putting the brand in the query text.'),
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
			description: `Search the Open Food Facts database. If you have a barcode, use get_product instead — it's always current and skips search entirely.

How search works: strict AND against a keyword array built from product_name, generic_name, brands, categories, origins, labels. One unmatched query word means zero results. The search backend syncs with a delay, so recently-edited products may only match their older keywords.

If you get zero results:
- Drop words and retry — fewer terms, fewer chances to miss.
- Move the brand to brands_tags and search just the distinctive product words.
- Consider asking the user to photograph the barcode so you can use get_product instead.

All food types are covered, including packaged fresh produce (supermarket tomatoes, bagged salad, etc.). For fresh produce, use brands_tags plus a variety name ("baby plum", "cherry vine") or brands_tags plus categories_tags, rather than generic text search.`,
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
