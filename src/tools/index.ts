import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {registerGetProduct} from './get-product.js';
import {registerSearchProductsStandard} from './search-products-standard.js';
import {registerSearchProductsLucene} from './search-products-lucene.js';
import {registerAutocomplete} from './autocomplete.js';
import {registerAddOrEditProduct} from './add-or-edit-product.js';
import {registerUploadImage} from './upload-image.js';
import {registerSelectImage} from './select-image.js';
import {registerCallApi} from './call-api.js';
import {registerGetApiDocs} from './get-api-docs.js';

export type {Config} from './types.js';

export function registerAll(server: McpServer, config: Config): void {
	registerGetProduct(server, config);
	registerSearchProductsStandard(server, config);
	registerSearchProductsLucene(server, config);
	registerAutocomplete(server, config);
	registerAddOrEditProduct(server, config);
	registerUploadImage(server, config);
	registerSelectImage(server, config);
	registerCallApi(server, config);
	registerGetApiDocs(server);
}
