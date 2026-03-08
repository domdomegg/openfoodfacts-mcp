import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {z} from 'zod';
import type {Config} from './types.js';
import {jsonResult} from '../utils/response.js';
import {strictSchemaWithAliases} from '../utils/schema.js';

const SEARCH_A_LICIOUS_BASE = 'https://search.openfoodfacts.org';

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

const SORT_FIELD_MAP: Record<string, string> = {
	popularity: 'unique_scans_n',
	product_name: 'product_name',
	created_t: 'created_t',
	last_modified_t: 'last_modified_t',
	nutriscore_score: 'nutriscore_score',
	ecoscore_score: 'ecoscore_score',
};

const inputSchema = strictSchemaWithAliases(
	{
		query: z.string().optional().describe('Free-text search terms. Combined with any filter params using AND logic. Omit to browse by filters alone (unlike search_products_standard, filter-only queries work here without timeouts).'),
		categories_tags: z.string().optional().describe('Filter by category tag (e.g. "en:breakfast-cereals"). Added as categories_tags:"value" in the Lucene query.'),
		brands_tags: z.string().optional().describe('Filter by brand tag (e.g. "nutella"). Added as brands_tags:"value" in the Lucene query.'),
		nutrition_grades_tags: z.string().optional().describe('Filter by Nutri-Score grade (a, b, c, d, e). Added as nutriscore_grade:"value".'),
		labels_tags: z.string().optional().describe('Filter by label tag (e.g. "en:organic", "en:fair-trade"). Added as labels_tags:"value".'),
		countries_tags: z.string().optional().describe('Filter by country tag (e.g. "en:united-kingdom", "en:france"). Added as countries_tags:"value".'),
		allergens_tags_without: z.string().optional().describe('EXCLUDE products containing this allergen (e.g. "en:gluten", "en:milk"). This is negation — a capability unique to this tool. Added as -allergens_tags:"value". Use for allergen-free searches.'),
		lucene_query: z.string().optional().describe('Raw Lucene query string for full control. If provided, all other filter params are ignored. Supports field:value, negation (-field:value), quoted phrases, wildcards. Examples: \'categories_tags:"en:beverages" nutriscore_grade:a -allergens_tags:"en:gluten"\', \'brands:"kellogg*"\''),
		sort_by: z.enum([
			'popularity',
			'product_name',
			'created_t',
			'last_modified_t',
			'nutriscore_score',
			'ecoscore_score',
		]).optional().describe('Sort order. Note: uses different underlying fields than search_products_standard.'),
		sort_descending: z.boolean().optional().default(true).describe('Sort in descending order (default: true). Set false for ascending (e.g. lowest nutriscore_score first).'),
		page: z.number().int().min(1).default(1).describe('Page number (default: 1)'),
		page_size: z.number().int().min(1).max(100).default(24).describe('Results per page (default: 24, max: 100)'),
		fields: z.array(z.string()).optional().describe(`Fields to return per product. Defaults to: ${DEFAULT_FIELDS.join(', ')}`),
	},
	{
		q: 'query',
		search: 'query',
	},
);

function buildLuceneQuery(args: {
	query?: string;
	categories_tags?: string;
	brands_tags?: string;
	nutrition_grades_tags?: string;
	labels_tags?: string;
	countries_tags?: string;
	allergens_tags_without?: string;
}): string {
	const parts: string[] = [];

	if (args.query) {
		parts.push(args.query);
	}

	if (args.categories_tags) {
		parts.push(`categories_tags:"${args.categories_tags}"`);
	}

	if (args.brands_tags) {
		parts.push(`brands_tags:"${args.brands_tags}"`);
	}

	if (args.nutrition_grades_tags) {
		parts.push(`nutriscore_grade:${args.nutrition_grades_tags}`);
	}

	if (args.labels_tags) {
		parts.push(`labels_tags:"${args.labels_tags}"`);
	}

	if (args.countries_tags) {
		parts.push(`countries_tags:"${args.countries_tags}"`);
	}

	if (args.allergens_tags_without) {
		parts.push(`-allergens_tags:"${args.allergens_tags_without}"`);
	}

	return parts.join(' ') || '*';
}

// Normalize Search-a-licious response to match the standard API format.
// SAL returns { hits, count, page, page_size, page_count }.
// Standard returns { products, count, page, page_size, page_count }.
// SAL brands field is an array; standard is a comma-separated string.
function normalizeResponse(data: Record<string, unknown>): Record<string, unknown> {
	const hits = (data.hits ?? []) as Record<string, unknown>[];

	const products = hits.map((hit) => {
		const product = {...hit};
		// Normalize brands array → comma-separated string
		if (Array.isArray(product.brands)) {
			product.brands = (product.brands as string[]).join(', ');
		}

		return product;
	});

	return {
		count: data.count,
		page: data.page,
		page_size: data.page_size,
		page_count: data.page_count,
		is_count_exact: data.is_count_exact ?? true,
		products,
	};
}

export function registerSearchProductsLucene(server: McpServer, config: Config): void {
	server.registerTool(
		'search_products_lucene',
		{
			title: 'Search products (Lucene)',
			description: `Search Open Food Facts using the Search-a-licious Elasticsearch backend. Powered by Lucene query syntax with full boolean logic and negation support.

Use this instead of search_products_standard when you need:
- Negation queries: find gluten-free cereals with allergens_tags_without="en:gluten"
- Filter-only browsing: categories_tags without any text query (standard API times out on this)
- Combined text + filter with relevance scoring: text matches are ranked by relevance within filter results
- Boolean logic in raw Lucene: brands:"kellogg*" OR brands:"nestle"

Trade-offs vs search_products_standard:
- Counts are approximate (capped at 10,000 for large result sets)
- Brand tag matching may be narrower (less normalization than standard)
- Data has a short sync delay (hours) from the primary database
- popularity sort uses scan counts rather than the standard popularity algorithm

Response format matches search_products_standard: { count, page, page_size, page_count, products: [...] }`,
			inputSchema,
			annotations: {
				readOnlyHint: true,
			},
		},
		async (args) => {
			const luceneQuery = args.lucene_query ?? buildLuceneQuery(args);

			const url = new URL(`${SEARCH_A_LICIOUS_BASE}/search`);
			url.searchParams.set('q', luceneQuery);
			url.searchParams.set('page', String(args.page));
			url.searchParams.set('page_size', String(args.page_size));

			if (args.sort_by) {
				const mappedField = SORT_FIELD_MAP[args.sort_by] ?? args.sort_by;
				const prefix = args.sort_descending ? '-' : '';
				url.searchParams.set('sort_by', `${prefix}${mappedField}`);
			}

			const fields = args.fields ?? DEFAULT_FIELDS;
			url.searchParams.set('fields', fields.join(','));

			const response = await fetch(url.toString(), {
				headers: {
					'User-Agent': config.userAgent,
					Accept: 'application/json',
				},
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Search-a-licious API error: ${response.status} ${response.statusText} - ${errorText}`);
			}

			const data = await response.json() as Record<string, unknown>;
			const normalized = normalizeResponse(data);

			return jsonResult(normalized);
		},
	);
}
