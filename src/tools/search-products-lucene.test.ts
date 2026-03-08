import {
	describe, it, expect, vi, beforeEach,
} from 'vitest';
import {callWithValidation, getRegisteredTool} from './_test-utils.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const salResponse = (overrides: Record<string, unknown> = {}) => ({
	ok: true,
	json: async () => ({
		count: 1,
		page: 1,
		page_size: 24,
		page_count: 1,
		is_count_exact: true,
		hits: [{code: '123', product_name: 'Test', brands: ['Brand A', 'Brand B']}],
		...overrides,
	}),
});

describe('search_products_lucene', () => {
	beforeEach(() => {
		mockFetch.mockReset();
	});

	it('sends text query to Search-a-licious', async () => {
		mockFetch.mockResolvedValueOnce(salResponse());

		const {meta, handler} = getRegisteredTool('search_products_lucene');
		await callWithValidation(meta.inputSchema, handler, {
			query: 'nutella',
		});

		const url = new URL(mockFetch.mock.calls[0]![0] as string);
		expect(url.origin).toBe('https://search.openfoodfacts.org');
		expect(url.pathname).toBe('/search');
		expect(url.searchParams.get('q')).toBe('nutella');
	});

	it('builds Lucene query from structured filters', async () => {
		mockFetch.mockResolvedValueOnce(salResponse());

		const {meta, handler} = getRegisteredTool('search_products_lucene');
		await callWithValidation(meta.inputSchema, handler, {
			query: 'chocolate',
			categories_tags: 'en:biscuits',
			brands_tags: 'mcvities',
			nutrition_grades_tags: 'c',
		});

		const url = new URL(mockFetch.mock.calls[0]![0] as string);
		const q = url.searchParams.get('q')!;
		expect(q).toContain('chocolate');
		expect(q).toContain('categories_tags:"en:biscuits"');
		expect(q).toContain('brands_tags:"mcvities"');
		expect(q).toContain('nutriscore_grade:c');
	});

	it('supports negation for allergen-free queries', async () => {
		mockFetch.mockResolvedValueOnce(salResponse());

		const {meta, handler} = getRegisteredTool('search_products_lucene');
		await callWithValidation(meta.inputSchema, handler, {
			categories_tags: 'en:breakfast-cereals',
			allergens_tags_without: 'en:gluten',
		});

		const url = new URL(mockFetch.mock.calls[0]![0] as string);
		const q = url.searchParams.get('q')!;
		expect(q).toContain('categories_tags:"en:breakfast-cereals"');
		expect(q).toContain('-allergens_tags:"en:gluten"');
	});

	it('supports labels and countries filters', async () => {
		mockFetch.mockResolvedValueOnce(salResponse());

		const {meta, handler} = getRegisteredTool('search_products_lucene');
		await callWithValidation(meta.inputSchema, handler, {
			labels_tags: 'en:organic',
			countries_tags: 'en:united-kingdom',
		});

		const url = new URL(mockFetch.mock.calls[0]![0] as string);
		const q = url.searchParams.get('q')!;
		expect(q).toContain('labels_tags:"en:organic"');
		expect(q).toContain('countries_tags:"en:united-kingdom"');
	});

	it('uses raw lucene_query when provided, ignoring other filters', async () => {
		mockFetch.mockResolvedValueOnce(salResponse());

		const {meta, handler} = getRegisteredTool('search_products_lucene');
		await callWithValidation(meta.inputSchema, handler, {
			lucene_query: 'brands:"kellogg*" OR brands:"nestle"',
			categories_tags: 'en:should-be-ignored',
		});

		const url = new URL(mockFetch.mock.calls[0]![0] as string);
		expect(url.searchParams.get('q')).toBe('brands:"kellogg*" OR brands:"nestle"');
	});

	it('defaults to wildcard query when no params given', async () => {
		mockFetch.mockResolvedValueOnce(salResponse());

		const {meta, handler} = getRegisteredTool('search_products_lucene');
		await callWithValidation(meta.inputSchema, handler, {});

		const url = new URL(mockFetch.mock.calls[0]![0] as string);
		expect(url.searchParams.get('q')).toBe('*');
	});

	it('normalizes response: hits → products, brands array → string', async () => {
		mockFetch.mockResolvedValueOnce(salResponse());

		const {meta, handler} = getRegisteredTool('search_products_lucene');
		const result = await callWithValidation(meta.inputSchema, handler, {
			query: 'test',
		}) as {structuredContent: Record<string, unknown>};

		expect(result.structuredContent.count).toBe(1);
		expect(result.structuredContent).not.toHaveProperty('hits');
		expect(result.structuredContent).toHaveProperty('products');

		const products = result.structuredContent.products as Record<string, unknown>[];
		expect(products[0]!.brands).toBe('Brand A, Brand B');
	});

	it('maps sort_by to correct SAL field names', async () => {
		mockFetch.mockResolvedValueOnce(salResponse());

		const {meta, handler} = getRegisteredTool('search_products_lucene');
		await callWithValidation(meta.inputSchema, handler, {
			query: 'pasta',
			sort_by: 'popularity',
		});

		const url = new URL(mockFetch.mock.calls[0]![0] as string);
		// popularity → unique_scans_n, descending by default
		expect(url.searchParams.get('sort_by')).toBe('-unique_scans_n');
	});

	it('supports ascending sort', async () => {
		mockFetch.mockResolvedValueOnce(salResponse());

		const {meta, handler} = getRegisteredTool('search_products_lucene');
		await callWithValidation(meta.inputSchema, handler, {
			query: 'yogurt',
			sort_by: 'nutriscore_score',
			sort_descending: false,
		});

		const url = new URL(mockFetch.mock.calls[0]![0] as string);
		expect(url.searchParams.get('sort_by')).toBe('nutriscore_score');
	});

	it('sends default fields', async () => {
		mockFetch.mockResolvedValueOnce(salResponse());

		const {meta, handler} = getRegisteredTool('search_products_lucene');
		await callWithValidation(meta.inputSchema, handler, {
			query: 'test',
		});

		const url = new URL(mockFetch.mock.calls[0]![0] as string);
		const fields = url.searchParams.get('fields')!;
		expect(fields).toContain('product_name');
		expect(fields).toContain('code');
	});

	it('uses custom fields when specified', async () => {
		mockFetch.mockResolvedValueOnce(salResponse());

		const {meta, handler} = getRegisteredTool('search_products_lucene');
		await callWithValidation(meta.inputSchema, handler, {
			query: 'test',
			fields: ['code', 'nutriments'],
		});

		const url = new URL(mockFetch.mock.calls[0]![0] as string);
		expect(url.searchParams.get('fields')).toBe('code,nutriments');
	});

	it('sends pagination params', async () => {
		mockFetch.mockResolvedValueOnce(salResponse());

		const {meta, handler} = getRegisteredTool('search_products_lucene');
		await callWithValidation(meta.inputSchema, handler, {
			query: 'test',
			page: 3,
			page_size: 50,
		});

		const url = new URL(mockFetch.mock.calls[0]![0] as string);
		expect(url.searchParams.get('page')).toBe('3');
		expect(url.searchParams.get('page_size')).toBe('50');
	});

	it('accepts alias "q" for query', async () => {
		mockFetch.mockResolvedValueOnce(salResponse());

		const {meta, handler} = getRegisteredTool('search_products_lucene');
		await callWithValidation(meta.inputSchema, handler, {
			q: 'cereal',
		});

		const url = new URL(mockFetch.mock.calls[0]![0] as string);
		expect(url.searchParams.get('q')).toContain('cereal');
	});

	it('throws on API error', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 500,
			statusText: 'Internal Server Error',
			text: async () => 'Something went wrong',
		});

		const {meta, handler} = getRegisteredTool('search_products_lucene');
		await expect(callWithValidation(meta.inputSchema, handler, {
			query: 'test',
		})).rejects.toThrow('Search-a-licious API error: 500');
	});
});
