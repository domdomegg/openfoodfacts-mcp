import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {z} from 'zod';
import type {Config} from './types.js';
import {jsonResult} from '../utils/response.js';
import {strictSchemaWithAliases} from '../utils/schema.js';
import {offPost} from '../utils/off-api.js';

const inputSchema = strictSchemaWithAliases(
	{
		barcode: z.string().describe('Product barcode'),
		imgid: z.number().int().describe('Image ID (from upload_image response or product data)'),
		imagefield: z.enum([
			'front',
			'ingredients',
			'nutrition',
			'packaging',
			'other',
		]).describe('Image type to assign this image to'),
		lc: z.string().default('en').describe('Language code (default: en)'),
		angle: z.enum([
			'0',
			'90',
			'180',
			'270',
		]).optional().describe('Rotation angle in degrees'),
		x1: z.number().optional().describe('Crop: left coordinate'),
		y1: z.number().optional().describe('Crop: top coordinate'),
		x2: z.number().optional().describe('Crop: right coordinate'),
		y2: z.number().optional().describe('Crop: bottom coordinate'),
	},
	{
		code: 'barcode',
		id: 'imagefield',
	},
);

export function registerSelectImage(server: McpServer, config: Config): void {
	server.registerTool(
		'select_image',
		{
			title: 'Select/crop product image',
			description: 'Select, crop, and rotate a previously uploaded product image on Open Food Facts. Requires OFF_USER_ID and OFF_PASSWORD.',
			inputSchema,
			annotations: {
				readOnlyHint: false,
			},
		},
		async (args) => {
			const body: Record<string, string> = {
				code: args.barcode,
				imgid: String(args.imgid),
				id: `${args.imagefield}_${args.lc}`,
			};

			if (args.angle) {
				body.angle = args.angle;
			}

			if (args.x1 !== undefined) {
				body.x1 = String(args.x1);
			}

			if (args.y1 !== undefined) {
				body.y1 = String(args.y1);
			}

			if (args.x2 !== undefined) {
				body.x2 = String(args.x2);
			}

			if (args.y2 !== undefined) {
				body.y2 = String(args.y2);
			}

			const data = await offPost(config, '/cgi/product_image_crop.pl', body);

			return jsonResult(data as Record<string, unknown>);
		},
	);
}
