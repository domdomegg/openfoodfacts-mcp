import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {z} from 'zod';
import type {Config} from './types.js';
import {jsonResult} from '../utils/response.js';
import {strictSchemaWithAliases} from '../utils/schema.js';
import {offGet} from '../utils/off-api.js';

const inputSchema = strictSchemaWithAliases(
	{
		tagtype: z.enum([
			'brands',
			'categories',
			'labels',
			'countries',
			'stores',
			'packaging',
			'ingredients',
			'traces',
			'allergens',
			'additives',
			'states',
		]).describe('Type of taxonomy to search'),
		query: z.string().describe('Search prefix'),
		lc: z.string().default('en').describe('Language code (default: en)'),
		limit: z.number().int().min(1).max(100).default(10).describe('Max results (default: 10, max: 100)'),
	},
	{
		type: 'tagtype',
		term: 'query',
		q: 'query',
	},
);

export function registerAutocomplete(server: McpServer, config: Config): void {
	server.registerTool(
		'autocomplete',
		{
			title: 'Autocomplete',
			description: 'Get autocomplete suggestions for Open Food Facts taxonomy entries (brands, categories, labels, etc.).',
			inputSchema,
			annotations: {
				readOnlyHint: true,
			},
		},
		async (args) => {
			const params: Record<string, string> = {
				tagtype: args.tagtype,
				string: args.query,
				lc: args.lc,
				limit: String(args.limit),
			};

			const data = await offGet(config, '/api/v3/taxonomy_suggestions', params);

			return jsonResult(data as Record<string, unknown>);
		},
	);
}
