# openfoodfacts-mcp

MCP server for the [Open Food Facts](https://world.openfoodfacts.org/) API - search, read, and contribute to the world's largest open food database.

## Use Cases

**Look up a product by name**: "How many calories in a Sainsbury's buffalo chicken wrap?" -> searches by name, finds the product, and returns nutrition data.

**Look up a product by barcode**: "What's in this product with barcode 3017620422003?" -> fetches Nutella's ingredients, Nutri-Score, and nutrition data.

**Find healthy options**: "Search for breakfast cereals with Nutri-Score A" -> searches with category and nutrition grade filters.

**Contribute data**: "Add the product name and brand for barcode 12345678" -> creates or updates a product entry on Open Food Facts.

**Explore the database**: "What brands of organic chocolate are in the database?" -> uses autocomplete and search to explore.

## Setup

Follow the instructions on [install-mcp](https://adamjones.me/install-mcp/?config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIm9wZW5mb29kZmFjdHMtbWNwIl0sIm5hbWUiOiJvcGVuZm9vZGZhY3RzIiwiZW52Ijp7Ik9GRl9VU0VSX0FHRU5UIjoib3BlbmZvb2RmYWN0cy1tY3AvMS4yLjAgKHlvdUBleGFtcGxlLmNvbSkifX0=), which generates the right config for your MCP client (Claude Code, Claude Desktop, Cursor, Cline, VS Code, and more).

Set `OFF_USER_AGENT` to identify your app (e.g. `openfoodfacts-mcp/1.2.0 (you@example.com)`). For write operations (adding/editing products, uploading images), also set `OFF_USER_ID` and `OFF_PASSWORD`.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OFF_USER_AGENT` | Yes | User-Agent string, e.g. `"AppName/1.0 (email@example.com)"` |
| `OFF_USER_ID` | No | Open Food Facts username (for write operations) |
| `OFF_PASSWORD` | No | Open Food Facts password (for write operations) |
| `OFF_COUNTRY` | No | Country subdomain (default: `world`) |

## Tools

| Tool | Description | Auth |
|------|-------------|------|
| `get_product` | Get product info by barcode | No |
| `search_products_standard` | Search with structured filters (brand, category, Nutri-Score) | No |
| `search_products_lucene` | Search with Lucene syntax, negation, and boolean logic | No |
| `autocomplete` | Autocomplete brands, categories, labels, etc. | No |
| `add_or_edit_product` | Add or update a product | Yes |
| `upload_image` | Upload a product image | Yes |
| `select_image` | Select, crop, and rotate an image | Yes |
| `call_api` | Call any OFF API endpoint directly | Depends |
| `get_api_docs` | Get OFF API documentation | No |

## Contributing

Pull requests are welcomed on GitHub! To get started:

1. Install Git and Node.js
2. Clone the repository
3. Install dependencies with `npm install`
4. Run `npm run test` to run tests
5. Build with `npm run build`

## Releases

Versions follow the [semantic versioning spec](https://semver.org/).

To release:

1. Use `npm version <major | minor | patch>` to bump the version
2. Run `git push --follow-tags` to push with tags
3. Wait for GitHub Actions to publish to the NPM registry.
