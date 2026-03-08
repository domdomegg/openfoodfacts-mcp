import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {CallToolResult} from '@modelcontextprotocol/sdk/types.js';

const API_DOCS = `# Open Food Facts API Reference

Base URL: https://{country}.openfoodfacts.org (default: world)

## Read Endpoints (no auth required)

### Get product
GET /api/v2/product/{barcode}.json
- Query params: fields (comma-separated list of fields to return)
- Example: /api/v2/product/3017620422003.json?fields=product_name,brands,nutriscore_grade

### Search products (full-text)
GET /cgi/search.pl
- Query params: search_terms, search_simple=1, action=process, json=1, categories_tags, brands_tags, nutrition_grades_tags, sort_by, page, page_size, fields
- sort_by options: popularity, product_name, created_t, last_modified_t, nutriscore_score, nova_score
- Example: /cgi/search.pl?search_terms=nutella&search_simple=1&action=process&json=1&fields=product_name,brands

### Search products (tag-based filtering only)
GET /api/v2/search
- Query params: categories_tags, brands_tags, nutrition_grades_tags, sort_by, page, page_size, fields
- Note: Does NOT support full-text search (search_terms parameter is ignored)

### Taxonomy suggestions (autocomplete)
GET /api/v3/taxonomy_suggestions
- Query params: tagtype (brands, categories, labels, etc.), string, lc, limit

### Product images
Images are available at: https://images.openfoodfacts.org/images/products/{path}/{filename}
- The path is derived from the barcode (e.g. 301/762/042/2003 for 3017620422003)

## Common Product Fields
product_name, brands, categories, labels, quantity, ingredients_text, allergens, traces,
nutriscore_grade (a-e), nova_group (1-4), ecoscore_grade (a-e),
nutriments (object with energy_100g, fat_100g, proteins_100g, carbohydrates_100g, etc.),
image_url, image_front_url, image_ingredients_url, image_nutrition_url,
code (barcode), countries, stores, packaging

## Write Endpoints (require user_id + password)

### Add or edit product
POST /cgi/product_jqm2.pl
- Content-Type: application/x-www-form-urlencoded
- Body: code (barcode), user_id, password, and any product fields to set
- Fields: product_name, brands, categories, labels, quantity, ingredients_text, packaging, stores, countries

#### Nutrition parameters (new-style — recommended)
Use new-style nutrition params for both as-sold and prepared nutrition:
  nutrition_input_sets_{preparation}_{per}_nutrients_{nid}_value_string={value}

Where:
- {preparation}: "as_sold" or "prepared"
- {per}: "100g", "100ml", or "serving"
- {nid}: nutrient ID using hyphens: energy-kj, energy-kcal, fat, saturated-fat, carbohydrates, sugars, fiber, proteins, salt
- {value}: number or prefixed string like "< 0.5", "> 1", "~ 3"

Examples:
  nutrition_input_sets_as_sold_100g_nutrients_fat_value_string=3.2
  nutrition_input_sets_prepared_100g_nutrients_energy-kcal_value_string=85
  nutrition_input_sets_as_sold_serving_nutrients_sugars_value_string=< 0.5

WARNING: Do NOT use old-style prepared nutrition params like nutriment_fat_prepared or
nutriment_energy-kcal_prepared. These have a known server bug that stores data incorrectly
(values end up in the wrong fields). Always use the new-style params above for prepared nutrition.

### Upload product image
POST /cgi/product_image_upload.pl
- Content-Type: multipart/form-data
- Fields: code, imagefield (front_en, ingredients_en, nutrition_en, etc.), imgupload_{imagefield} (file)

### Select/crop product image
POST /cgi/product_image_crop.pl
- Content-Type: application/x-www-form-urlencoded
- Body: code, imgid, id (imagefield), angle (0/90/180/270), x1, y1, x2, y2

## Rate Limits
- Products: 100 requests/minute
- Search: 10 requests/minute

## Documentation
- Full API docs: https://openfoodfacts.github.io/openfoodfacts-server/api/
- OpenAPI spec: https://openfoodfacts.github.io/openfoodfacts-server/api/ref-v2/
- Wiki: https://wiki.openfoodfacts.org/API
`;

export function registerGetApiDocs(server: McpServer): void {
	server.registerTool(
		'get_api_docs',
		{
			title: 'Get API docs',
			description: 'Get Open Food Facts API documentation. Useful for understanding available endpoints before using call_api.',
			annotations: {
				readOnlyHint: true,
			},
		},
		async (): Promise<CallToolResult> => ({
			content: [{type: 'text' as const, text: API_DOCS}],
		}),
	);
}
