import {
	describe, it, expect, vi,
} from 'vitest';
import {type McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {registerAll} from './index.js';

describe('tool registration', () => {
	const registeredTools = new Map<string, unknown>();

	const server = {
		registerTool: vi.fn((name: string, meta: unknown) => {
			registeredTools.set(name, meta);
		}),
	} as unknown as McpServer;

	registerAll(server, {
		userAgent: 'test/1.0.0 (test@example.com)',
		country: 'world',
	});

	const expectedTools = [
		'get_product',
		'search_products',
		'autocomplete',
		'add_or_edit_product',
		'upload_image',
		'select_image',
		'call_api',
		'get_api_docs',
	];

	it('registers all expected tools', () => {
		expect(server.registerTool).toHaveBeenCalledTimes(expectedTools.length);
		for (const name of expectedTools) {
			expect(registeredTools.has(name)).toBe(true);
		}
	});

	for (const name of expectedTools) {
		it(`${name} has title and description`, () => {
			const meta = registeredTools.get(name) as {title: string; description: string};
			expect(meta.title).toBeTruthy();
			expect(meta.description).toBeTruthy();
		});
	}

	it('read tools have readOnlyHint: true', () => {
		const readTools = ['get_product', 'search_products', 'autocomplete', 'get_api_docs'];
		for (const name of readTools) {
			const meta = registeredTools.get(name) as {annotations: {readOnlyHint: boolean}};
			expect(meta.annotations.readOnlyHint).toBe(true);
		}
	});

	it('write tools have readOnlyHint: false', () => {
		const writeTools = ['add_or_edit_product', 'upload_image', 'select_image'];
		for (const name of writeTools) {
			const meta = registeredTools.get(name) as {annotations: {readOnlyHint: boolean}};
			expect(meta.annotations.readOnlyHint).toBe(false);
		}
	});
});
