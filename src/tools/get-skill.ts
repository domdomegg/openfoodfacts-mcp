import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {CallToolResult} from '@modelcontextprotocol/sdk/types.js';

const skillPath = join(__dirname, '../../.agents/skills/off-upload/SKILL.md');
const SKILL_CONTENT = readFileSync(skillPath, 'utf-8');

export function registerGetSkill(server: McpServer): void {
	server.registerTool(
		'get_skill',
		{
			title: 'Get skill',
			description: 'Get the OFF upload skill document. This describes the recommended process for bulk uploading food packaging photos to Open Food Facts.',
			annotations: {
				readOnlyHint: true,
			},
		},
		async (): Promise<CallToolResult> => ({
			content: [{type: 'text' as const, text: SKILL_CONTENT}],
		}),
	);
}
