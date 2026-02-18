import {
	describe, it, expect, vi, beforeEach,
} from 'vitest';
import {callWithValidation, getRegisteredTool} from './_test-utils.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('search_products', () => {
	beforeEach(() => {
		mockFetch.mockReset();
	});

	it('searches by query', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				count: 1,
				products: [{product_name: 'Nutella'}],
			}),
		});

		const {meta, handler} = getRegisteredTool('search_products');
		const result = await callWithValidation(meta.inputSchema, handler, {
			query: 'nutella',
		}) as {structuredContent: {count: number}};

		expect(result.structuredContent.count).toBe(1);

		const url = new URL(mockFetch.mock.calls[0]![0] as string);
		expect(url.pathname).toBe('/cgi/search.pl');
		expect(url.searchParams.get('search_terms')).toBe('nutella');
		expect(url.searchParams.get('json')).toBe('1');
		expect(url.searchParams.get('search_simple')).toBe('1');
		expect(url.searchParams.get('action')).toBe('process');
	});

	it('accepts alias "q" for query', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({count: 0, products: []}),
		});

		const {meta, handler} = getRegisteredTool('search_products');
		await callWithValidation(meta.inputSchema, handler, {
			q: 'chocolate',
		});

		const url = new URL(mockFetch.mock.calls[0]![0] as string);
		expect(url.searchParams.get('search_terms')).toBe('chocolate');
	});

	it('sends default fields when none specified', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({count: 0, products: []}),
		});

		const {meta, handler} = getRegisteredTool('search_products');
		await callWithValidation(meta.inputSchema, handler, {
			query: 'nutella',
		});

		const url = new URL(mockFetch.mock.calls[0]![0] as string);
		const fields = url.searchParams.get('fields');
		expect(fields).toBeTruthy();
		expect(fields).toContain('product_name');
		expect(fields).toContain('code');
		expect(fields).not.toContain('nutriments');
	});

	it('uses custom fields when specified', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({count: 0, products: []}),
		});

		const {meta, handler} = getRegisteredTool('search_products');
		await callWithValidation(meta.inputSchema, handler, {
			query: 'nutella',
			fields: ['product_name', 'nutriments'],
		});

		const url = new URL(mockFetch.mock.calls[0]![0] as string);
		expect(url.searchParams.get('fields')).toBe('product_name,nutriments');
	});

	it('passes filter params', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({count: 0, products: []}),
		});

		const {meta, handler} = getRegisteredTool('search_products');
		await callWithValidation(meta.inputSchema, handler, {
			categories_tags: 'en:breakfast-cereals',
			nutrition_grades_tags: 'a',
			sort_by: 'popularity',
			page: 2,
			page_size: 10,
		});

		const url = new URL(mockFetch.mock.calls[0]![0] as string);
		expect(url.searchParams.get('categories_tags')).toBe('en:breakfast-cereals');
		expect(url.searchParams.get('nutrition_grades_tags')).toBe('a');
		expect(url.searchParams.get('sort_by')).toBe('popularity');
		expect(url.searchParams.get('page')).toBe('2');
		expect(url.searchParams.get('page_size')).toBe('10');
	});
});
