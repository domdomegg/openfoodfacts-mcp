import {
	describe, it, expect, vi, beforeEach,
} from 'vitest';
import {callWithValidation, getRegisteredTool} from './_test-utils.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('get_product', () => {
	beforeEach(() => {
		mockFetch.mockReset();
	});

	it('fetches a product by barcode', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				status: 1,
				product: {
					product_name: 'Nutella',
					brands: 'Ferrero',
					code: '3017620422003',
				},
			}),
		});

		const {meta, handler} = getRegisteredTool('get_product');
		const result = await callWithValidation(meta.inputSchema, handler, {
			barcode: '3017620422003',
		}) as {structuredContent: {status: number; product: {product_name: string}}};

		expect(result.structuredContent.status).toBe(1);
		expect(result.structuredContent.product.product_name).toBe('Nutella');

		expect(mockFetch).toHaveBeenCalledOnce();
		const url = new URL(mockFetch.mock.calls[0]![0] as string);
		expect(url.pathname).toBe('/api/v2/product/3017620422003.json');
		expect(url.searchParams.get('fields')).toBeTruthy();
	});

	it('accepts barcode alias "code"', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({status: 1, product: {}}),
		});

		const {meta, handler} = getRegisteredTool('get_product');
		await callWithValidation(meta.inputSchema, handler, {
			code: '12345678',
		});

		const url = new URL(mockFetch.mock.calls[0]![0] as string);
		expect(url.pathname).toBe('/api/v2/product/12345678.json');
	});

	it('passes custom fields', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({status: 1, product: {}}),
		});

		const {meta, handler} = getRegisteredTool('get_product');
		await callWithValidation(meta.inputSchema, handler, {
			barcode: '12345678',
			fields: ['product_name', 'brands'],
		});

		const url = new URL(mockFetch.mock.calls[0]![0] as string);
		expect(url.searchParams.get('fields')).toBe('product_name,brands');
	});

	it('throws on API error', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 404,
			statusText: 'Not Found',
			text: async () => 'Product not found',
		});

		const {meta, handler} = getRegisteredTool('get_product');
		await expect(callWithValidation(meta.inputSchema, handler, {
			barcode: '0000000000000',
		})).rejects.toThrow('Open Food Facts API error');
	});
});
