import {
	describe, it, expect, vi, beforeEach,
} from 'vitest';
import {callWithValidation, getRegisteredTool} from './_test-utils.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('call_api', () => {
	beforeEach(() => {
		mockFetch.mockReset();
	});

	it('makes a GET request', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({status: 1}),
		});

		const {meta, handler} = getRegisteredTool('call_api');
		const result = await callWithValidation(meta.inputSchema, handler, {
			endpoint: '/api/v2/product/3017620422003.json',
		}) as {structuredContent: {status: number}};

		expect(result.structuredContent.status).toBe(1);

		const url = new URL(mockFetch.mock.calls[0]![0] as string);
		expect(url.pathname).toBe('/api/v2/product/3017620422003.json');
	});

	it('makes a POST request with params', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			text: async () => JSON.stringify({status: 1}),
		});

		const {meta, handler} = getRegisteredTool('call_api');
		await callWithValidation(meta.inputSchema, handler, {
			method: 'POST',
			endpoint: '/cgi/product_jqm2.pl',
			params: {code: '12345678', product_name: 'Test'},
		});

		expect(mockFetch.mock.calls[0]![1]).toMatchObject({method: 'POST'});
	});

	it('accepts alias "path" for endpoint', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({}),
		});

		const {meta, handler} = getRegisteredTool('call_api');
		await callWithValidation(meta.inputSchema, handler, {
			path: '/api/v2/product/12345678.json',
		});

		const url = new URL(mockFetch.mock.calls[0]![0] as string);
		expect(url.pathname).toBe('/api/v2/product/12345678.json');
	});
});
