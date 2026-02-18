import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {CallToolResult} from '@modelcontextprotocol/sdk/types.js';

const API_DOCS = `# Open Food Facts API Reference

Base URL: https://{country}.openfoodfacts.org (default: world)

## Read Endpoints (no auth required)

### Get product
GET /api/v2/product/{barcode}.json
- Query params: fields (comma-separated list of fields to return)
- Example: /api/v2/product/3017620422003.json?fields=product_name,brands,nutriscore_grade

### Search products
GET /api/v2/search
- Query params: search_terms, categories_tags, brands_tags, nutrition_grades_tags, sort_by, page, page_size, fields, json=1
- sort_by options: popularity, product_name, created_t, last_modified_t, nutriscore_score, nova_score

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
- Nutriment fields: nutriment_{name}_{unit} (e.g. nutriment_energy_kcal, nutriment_fat_g)

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
