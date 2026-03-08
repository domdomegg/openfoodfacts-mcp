import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {z} from 'zod';
import type {Config} from './types.js';
import {jsonResult} from '../utils/response.js';
import {strictSchemaWithAliases} from '../utils/schema.js';
import {offRequest} from '../utils/off-api.js';

const inputSchema = strictSchemaWithAliases(
	{
		method: z.enum([
			'GET',
			'POST',
			'PUT',
			'PATCH',
			'DELETE',
		]).default('GET').describe('HTTP method (default: GET)'),
		endpoint: z.string().describe('API endpoint path (e.g. "/api/v2/product/3017620422003.json")'),
		params: z.record(z.string()).optional().describe('Query parameters (for GET) or form-encoded body fields (for POST/PUT/PATCH to v1/v2 endpoints like /cgi/product_jqm2.pl). Auth fields are added automatically.'),
		json_body: z.record(z.unknown()).optional().describe('Raw JSON body for v3 endpoints (e.g. PATCH /api/v3/product/{code}). When set, params is ignored and Content-Type is application/json. Auth fields are injected at the top level. Use this for structured writes like packagings.'),
	},
	{
		path: 'endpoint',
		url: 'endpoint',
		body: 'json_body',
	},
);

export function registerCallApi(server: McpServer, config: Config): void {
	server.registerTool(
		'call_api',
		{
			title: 'Call API',
			description: `Make a direct call to any Open Food Facts API endpoint. Use get_api_docs to see available endpoints. Auth credentials are included automatically for write operations if configured.

Two body modes for writes:
- params: form-encoded (for /cgi/*.pl and /api/v2/* legacy endpoints)
- json_body: raw JSON (for /api/v3/* endpoints — required for structured fields like packagings)

Example v3 packagings write:
  method: PATCH
  endpoint: /api/v3/product/0123456789012
  json_body: {"fields":"packagings","product":{"packagings":[{"number_of_units":1,"shape":{"id":"en:bag"},"material":{"id":"en:plastic"},"recycling":{"id":"en:recycle"}}]}}

WARNING: Do NOT use old-style prepared nutrition params like nutriment_fat_prepared — they have a known server bug that stores data incorrectly. Use new-style params instead: nutrition_input_sets_prepared_100g_nutrients_fat_value_string=0.5`,
			inputSchema,
			annotations: {
				readOnlyHint: false,
			},
		},
		async (args) => {
			const data = await offRequest(config, args.method, args.endpoint, args.params, args.json_body);

			return jsonResult(data as Record<string, unknown>);
		},
	);
}
