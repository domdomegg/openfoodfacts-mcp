# Learnings from using openfoodfacts-mcp with an LLM agent

Notes from a session where Claude Code uploaded ~2 products to Open Food Facts from packaging photos, including product data, nutrition, packaging, and images.

## What went well

- **`add_or_edit_product`** tool description is excellent for basic products. The pitfalls section, the "fields that drive derived data" guidance, and the packaging taxonomy warnings all prevented mistakes.
- **`upload_image`** worked smoothly once infra body-size limits were fixed.
- **`call_api`** escape hatch was essential for anything the typed tools didn't cover.
- **Tool description quality** is generally very high — the descriptions read like they were written by someone who'd hit every sharp edge, which they were.

## What went wrong (and proposed fixes)

### 1. Prepared nutrition is not supported by `add_or_edit_product`

**Problem:** The `nutrition` schema only supports `per: "100g" | "serving"` for as-sold values. There's no way to specify prepared nutrition (e.g. jelly crystals where the only nutrition on the packet is "as prepared"). This is common for:
- Jelly/gelatin mixes
- Powdered drinks, soups, sauces
- Cake mixes, instant noodles
- Any product in the OFF category `en:dried-products-to-be-rehydrated`

We had to fall back to `call_api` with raw parameter names, which led to discovering an OFF server bug (see below).

**Proposed fix:** Extend the `nutrition` schema:

```typescript
nutrition: z.object({
  // ... existing as-sold fields ...
}).optional(),

nutrition_prepared: z.object({
  per: z.enum(['100g', '100ml', 'serving']).default('100g'),
  energy_kj: z.number().optional(),
  energy_kcal: z.number().optional(),
  fat: z.number().optional(),
  saturated_fat: z.number().optional(),
  carbohydrates: z.number().optional(),
  sugars: z.number().optional(),
  fiber: z.number().optional(),
  proteins: z.number().optional(),
  salt: z.number().optional(),
}).optional().describe('Prepared nutrition facts. Use for products like jelly mixes, powdered drinks, instant noodles — where the packet shows nutrition "as prepared" rather than (or in addition to) "as sold". Values should be per 100g of the prepared product unless per is set otherwise.'),
```

The implementation MUST use the **new-style API parameter names** to avoid the OFF server `_prepared` bug:
```
nutrition_input_sets_prepared_100g_nutrients_fat_value_string=0.5
```
NOT the old-style names:
```
nutriment_fat_prepared=0.5
```

See "OFF server bug" section below for why.

### 2. `<` modifier for "less than" values is not supported

**Problem:** Many nutrients are printed as `< 0.5g` or `< 0.1g` on UK packaging. The current `nutrition` schema only accepts `z.number()`, so there's no way to express the `<` modifier. We had to use `call_api` with `value_string` params like `"< 0.5"`.

**Proposed fix:** Accept either a number or a string with `<`/`>` prefix:

```typescript
// Instead of:
fat: z.number().optional(),
// Use:
fat: z.union([z.number(), z.string().regex(/^[<>~]?\s*\d/)]).optional()
  .describe('Fat in g. Use "< 0.5" for values printed as less-than on the packet.'),
```

Or add a separate modifiers object. The implementation should use `value_string` params (new-style) which accept the `<` prefix, e.g.:
```
nutrition_input_sets_as_sold_100g_nutrients_fat_value_string=< 0.5
```

### 3. `packaging_text_en` field is not exposed

**Problem:** OFF has a `packaging_text_en` field for the human-readable recycling instructions text (e.g. "Tray - Plastic - Recycle, Film - Plastic - Do Not Recycle"). This is separate from the structured `packagings` array. We had to use `call_api` to set it.

**Proposed fix:** Add `packaging_text` to `add_or_edit_product`:

```typescript
packaging_text: z.string().optional().describe(
  'Recycling instructions and/or packaging information as printed on the pack, e.g. '
  + '"Tray - Plastic - Recycle\\nFilm - Plastic - Do Not Recycle". '
  + 'This is the human-readable text, separate from the structured packagings array.'
),
```

Implementation: send as `packaging_text_en` (or `packaging_text_{lc}` if a language param is added).

### 4. `packagings_complete` flag is not exposed

**Problem:** After setting packaging data, you need to mark `packagings_complete: 1` via the v3 API to signal that all packaging components have been listed. We had to use `call_api` with a v3 PATCH.

**Proposed fix:** Add to `add_or_edit_product`:

```typescript
packagings_complete: z.boolean().optional().describe(
  'Set to true to mark that all packaging components have been listed. '
  + 'Only set this when you are confident the packagings array is complete.'
),
```

Implementation: include in the v3 PATCH call that already handles packagings.

### 5. `comment` field is not exposed

**Problem:** Every edit to OFF can include a `comment` field (like a git commit message) explaining what was changed. This shows in the product edit history. We had to use `extra_fields` or `call_api` to include it.

**Proposed fix:** Add to `add_or_edit_product`:

```typescript
comment: z.string().optional().describe(
  'Edit comment explaining what was changed, shown in product edit history. '
  + 'E.g. "Add nutrition data from packaging photo", "Fix ingredient list typo".'
),
```

### 6. Tool description should warn about the old-style prepared nutrition bug

**Problem:** The OFF server has a bug at `Nutrition.pm:1366` where old-style prepared params (`nutriment_fat_prepared`) store `preparation: "_prepared"` instead of `preparation: "prepared"`. This means:
- Data saves (API returns "fields saved") but reads back incorrectly via API v2
- The `_prepared` key gets lowest sort priority instead of highest
- Schema downgrade for API v2 response doesn't recognize `_prepared` as prepared data

This wasted significant debugging time. The workaround is to use new-style params (`nutrition_input_sets_prepared_100g_nutrients_fat_value_string`).

**Proposed fix:** If `call_api` tool description is kept as an escape hatch, add a warning:

```
WARNING: Do NOT use old-style prepared nutrition params (nutriment_fat_prepared).
They have a known bug in the OFF server. Use new-style params instead:
nutrition_input_sets_prepared_100g_nutrients_fat_value_string=0.5
```

Better yet, implement prepared nutrition properly in `add_or_edit_product` so users never need `call_api` for this.

### 7. No guidance on product workflow / what fields to set

**Problem:** When processing a food photo, the agent needs to know the right order of operations and which fields matter. This was learned through trial and error.

**Proposed fix:** Add a tool description or a dedicated "guide" tool that describes the recommended workflow:

```
Recommended workflow for adding a product from packaging photos:

1. Scan barcode from photo (use barcode-scanner MCP)
2. Check if product exists: get_product(barcode)
3. Upload front photo: upload_image(barcode, "front", image_data)
4. Upload back/nutrition photo: upload_image(barcode, "nutrition", image_data)  
5. Read all text from photos and call add_or_edit_product with:
   - product_name, brands, quantity (from front)
   - categories (infer from product type)
   - ingredients_text (verbatim, mark allergens with underscores)
   - nutrition or nutrition_prepared (from nutrition table)
   - serving_size
   - packagings (structured, from recycling symbols)
   - packaging_text (human-readable recycling instructions)
   - emb_codes (oval traceability stamp)
   - manufacturing_places, countries, stores
   - labels (certifications, dietary marks)
   - packagings_complete: true (if all components listed)
6. Open product page for review: https://world.openfoodfacts.org/product/{barcode}
```

### 8. Multiple nutrition tables (as-sold + prepared, per-100g + per-serving)

**Problem:** Some products have up to 4 columns of nutrition data:
- As sold per 100g
- As sold per serving
- Prepared per 100g  
- Prepared per serving

The current tool only supports one set. OFF's data model stores these as separate "input sets" that get aggregated, with per-100g being primary and per-serving being secondary (OFF derives per-serving from per-100g × serving_size, but stores both input sets).

**Proposed fix:** Support all four combinations:

```typescript
nutrition: z.object({ ... }).optional().describe('As-sold nutrition per 100g (default) or per serving'),
nutrition_prepared: z.object({ ... }).optional().describe('Prepared nutrition per 100g (default) or per serving'),
```

And optionally allow submitting per-serving as a separate input set (OFF stores it and may display the exact values rather than auto-deriving):

```typescript
nutrition_serving: z.object({ ... }).optional().describe('As-sold nutrition per serving. Usually OFF derives this from per-100g values, but submit this if the packet has a separate per-serving column with different rounding.'),
nutrition_prepared_serving: z.object({ ... }).optional().describe('Prepared nutrition per serving.'),
```

## OFF server bugs discovered

### `_prepared` vs `prepared` in old-style form params

**File:** `openfoodfacts-server/lib/ProductOpener/Nutrition.pm:1366`

```perl
# BUG: should be ("as_sold", "prepared") not ("as_sold", "_prepared")
foreach my $preparation ("as_sold", "_prepared") {
```

This causes old-style params (`nutriment_fat_prepared`) to store `preparation: "_prepared"` instead of `preparation: "prepared"`. The canonical values in `Config.pm:150` are `["as_sold", "prepared"]`. The `%preparation_priority` hash only recognizes `"prepared"` (priority 0) and `"as_sold"` (priority 1); `"_prepared"` falls through to `_default` (priority 2, lowest).

Consequences:
- Data saves but doesn't read back correctly via API v2 (schema downgrade at `ProductSchemaChanges.pm:597` checks for `"prepared"` not `"_prepared"`)
- Prepared data sorts last instead of first, affecting Nutri-Score computation
- The CSV import function at line 1815 does it correctly: `my $preparation = ($type eq "") ? "as_sold" : "prepared";`
- The new-style param function at line 1530 does it correctly (uses values from `get_preparations_for_product_type()`)

**Workaround:** Use new-style params (`nutrition_input_sets_prepared_100g_nutrients_*_value_string`).

**Fix:** Change line 1366 to `foreach my $preparation ("as_sold", "prepared")`. This could be contributed as a PR to the OFF server repo.

## Infrastructure learnings (not OFF-specific)

- **nginx ingress default body size is 1MB.** Uploading food photos (1-5MB) requires `nginx.ingress.kubernetes.io/proxy-body-size: 20m` on the ingress.
- **Express.js default body parser limit is 100KB.** MCP servers handling image uploads need `express.json({limit: '20mb'})`.
- **MCP SDK body handling:** When using `StreamableHTTPServerTransport`, if you've already parsed the body with `express.json()`, you must pass `req.body` as the third argument to `transport.handleRequest(req, res, req.body)`. Otherwise the SDK tries to re-read the stream (which is already consumed) and gets nothing.
- **npx caches aggressively.** If you update an npm package, Kubernetes pods using `npx` won't pick up the new version without a pod restart (or cache clear).
