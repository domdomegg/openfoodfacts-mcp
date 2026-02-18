#!/usr/bin/env node
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express, {type Request, type Response} from 'express';
import {createServer} from './index.js';
import type {Config} from './tools/types.js';

function setupSignalHandlers(cleanup: () => Promise<void>): void {
	process.on('SIGINT', async () => {
		await cleanup();
		process.exit(0);
	});
	process.on('SIGTERM', async () => {
		await cleanup();
		process.exit(0);
	});
}

function getConfig(): Config {
	const userAgent = process.env.OFF_USER_AGENT;
	if (!userAgent) {
		console.error('openfoodfacts-mcp: OFF_USER_AGENT is required');
		console.error('Example: OFF_USER_AGENT="openfoodfacts-mcp/1.0.0 (you@example.com)"');
		process.exit(1);
	}

	const config: Config = {
		userAgent,
		country: process.env.OFF_COUNTRY || 'world',
	};

	if (process.env.OFF_USER_ID) {
		config.userId = process.env.OFF_USER_ID;
	}

	if (process.env.OFF_PASSWORD) {
		config.password = process.env.OFF_PASSWORD;
	}

	return config;
}

const transport = process.env.MCP_TRANSPORT || 'stdio';

(async () => {
	if (transport === 'stdio') {
		const config = getConfig();
		const server = createServer(config);
		setupSignalHandlers(async () => server.close());

		const stdioTransport = new StdioServerTransport();
		await server.connect(stdioTransport);
		console.error('openfoodfacts-mcp running on stdio');
	} else if (transport === 'http') {
		const app = express();
		app.use(express.json());

		const port = parseInt(process.env.PORT || '3000', 10);
		const baseUrl = process.env.MCP_BASE_URL || `http://localhost:${port}`;

		app.post('/mcp', async (req: Request, res: Response) => {
			const config = getConfig();
			const server = createServer(config);

			try {
				const httpTransport = new StreamableHTTPServerTransport({
					sessionIdGenerator: undefined,
					enableJsonResponse: true,
				});
				await server.connect(httpTransport);

				await httpTransport.handleRequest(req, res, req.body);

				res.on('close', () => {
					void httpTransport.close();
					void server.close();
				});
			} catch (error) {
				console.error('Error handling MCP request:', error);
				if (!res.headersSent) {
					res.status(500).json({
						jsonrpc: '2.0',
						error: {code: -32603, message: 'Internal server error'},
						id: null,
					});
				}
			}
		});

		const httpServer = app.listen(port, () => {
			console.error(`openfoodfacts-mcp running on ${baseUrl}/mcp`);
		});

		httpServer.on('error', (err: NodeJS.ErrnoException) => {
			console.error('FATAL: Server error', err.message);
			process.exit(1);
		});

		setupSignalHandlers(async () => {
			httpServer.close();
		});
	} else {
		console.error(`Unknown transport: ${transport}. Use MCP_TRANSPORT=stdio or MCP_TRANSPORT=http`);
		process.exit(1);
	}
})();
