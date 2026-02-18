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
		params: z.record(z.string()).optional().describe('Query parameters (for GET) or form body fields (for POST/PUT/PATCH)'),
	},
	{
		path: 'endpoint',
		url: 'endpoint',
	},
);

export function registerCallApi(server: McpServer, config: Config): void {
	server.registerTool(
		'call_api',
		{
			title: 'Call API',
			description: 'Make a direct call to any Open Food Facts API endpoint. Use get_api_docs to see available endpoints. Auth credentials are included automatically for write operations if configured.',
			inputSchema,
			annotations: {
				readOnlyHint: false,
			},
		},
		async (args) => {
			const data = await offRequest(config, args.method, args.endpoint, args.params);

			return jsonResult(data as Record<string, unknown>);
		},
	);
}
