import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {z} from 'zod';
import type {Config} from './types.js';
import {jsonResult} from '../utils/response.js';
import {strictSchemaWithAliases} from '../utils/schema.js';
import {offPostMultipart} from '../utils/off-api.js';

const inputSchema = strictSchemaWithAliases(
	{
		barcode: z.string().describe('Product barcode'),
		imagefield: z.enum([
			'front',
			'ingredients',
			'nutrition',
			'packaging',
			'other',
		]).describe('Image type'),
		image_data: z.string().describe('Base64-encoded image data (JPEG or PNG)'),
		lc: z.string().default('en').describe('Language code for the image (default: en)'),
	},
	{
		code: 'barcode',
		type: 'imagefield',
	},
);

export function registerUploadImage(server: McpServer, config: Config): void {
	server.registerTool(
		'upload_image',
		{
			title: 'Upload product image',
			description: 'Upload a product image to Open Food Facts. Requires OFF_USER_ID and OFF_PASSWORD.',
			inputSchema,
			annotations: {
				readOnlyHint: false,
			},
		},
		async (args) => {
			const imageBuffer = Buffer.from(args.image_data, 'base64');

			const formData = new FormData();
			formData.set('code', args.barcode);
			formData.set('imagefield', `${args.imagefield}_${args.lc}`);
			formData.set(`imgupload_${args.imagefield}_${args.lc}`, new Blob([imageBuffer]), 'image.jpg');

			const data = await offPostMultipart(config, '/cgi/product_image_upload.pl', formData);

			return jsonResult(data as Record<string, unknown>);
		},
	);
}
