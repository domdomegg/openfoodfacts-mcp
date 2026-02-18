import {describe, it, expect} from 'vitest';
import {getRegisteredTool} from './_test-utils.js';

describe('get_api_docs', () => {
	it('returns API documentation', async () => {
		const {handler} = getRegisteredTool('get_api_docs');
		const result = await handler({} as never) as {content: {type: string; text: string}[]};

		expect(result.content).toHaveLength(1);
		expect(result.content[0]!.type).toBe('text');
		expect(result.content[0]!.text).toContain('Open Food Facts API');
		expect(result.content[0]!.text).toContain('/api/v2/product/');
		expect(result.content[0]!.text).toContain('/api/v2/search');
	});
});
