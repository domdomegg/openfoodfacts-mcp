---
name: off-upload
description: Upload food products to Open Food Facts from packaging photos. Use when working through a folder of food packaging photos to upload product data (nutrition, ingredients, packaging, images) to OFF.
---

## Process: bulk uploading food photos to OFF

This is the recommended process for an LLM agent working through a folder of food packaging photos.

### Required tools

- [openfoodfacts-mcp](https://github.com/domdomegg/openfoodfacts-mcp) — product data and image uploads
- [tool-sandbox-mcp](https://github.com/domdomegg/tool-sandbox-mcp) — orchestrates shell + openfoodfacts calls in a single execution
- [shell-exec-mcp](https://github.com/domdomegg/shell-exec-mcp) — shell commands (base64 encoding images)

For remote setups, [mcp-local-tunnel](https://github.com/domdomegg/mcp-local-tunnel) exposes local servers to remote clients. [mcp-aggregator](https://github.com/domdomegg/mcp-aggregator) and [mcp-auth-wrapper](https://github.com/domdomegg/mcp-auth-wrapper) can combine and authenticate them.

### Per-product workflow

1. **View photos** — Read the next few chronologically adjacent images to identify one product and what each photo shows. Photos are usually front first, then additional angles (back, nutrition, ingredients, sides). Stop reading once you hit a clearly different product — those photos belong to the next iteration. **Do NOT read all photos upfront.** With large photo sets, this fills the context window before any work gets done. Instead, process one product at a time: read a few photos, identify the product, upload images, transcribe data, trash photos, then move on to the next product. Only read ahead enough to find the boundary between products.

2. **Scan barcode** — Read it from the photo visually, or use barcode-scanner MCP if available. Note: some supermarket products use short internal codes (e.g. `00238366`) instead of standard EAN-13 — these are valid on OFF. If the scanner returns a short code, trust it rather than assuming it's a misread of a "missing" EAN-13.

3. **Check if product exists** — `get_product(barcode)` to see what data already exists.

4. **Upload ALL photos** — See `upload_image` tool description for imagefield guidance. Use the most appropriate imagefield (`front`, `nutrition`, `ingredients`, `packaging`), and `other` for additional photos that don't fit a specific panel or where a good display image already exists.

   **Strip EXIF metadata before uploading — especially GPS location.** Phone photos embed the GPS coordinates where they were taken (plus device make/model). Uploading these to a public database leaks where the photographer lives/shops. Always strip metadata before upload. Note that `sips -r` (below) *preserves* EXIF, so rotating is not enough on its own. If ImageMagick is available, `magick in.jpg -rotate <deg> -strip -resize 1400x -quality 82 out.jpg` rotates, strips all metadata, and downscales in one pass. To verify a file is clean, `magick identify -verbose out.jpg | grep -iE 'gps|exif:'` should return nothing. (Beware: on macOS, `mdls` may report stale cached GPS from Spotlight even after stripping — trust a raw check like `identify`/`exiftool` over `mdls`.)

   **Rotate images so text reads correctly before uploading.** If a photo is rotated (upside down, sideways, etc.), rotate it so text is upright. The `magick ... -rotate` above handles this; alternatively on macOS `sips -r <degrees> "/path/to/photo.jpg"` rotates in place clockwise (but does NOT strip EXIF — see above). Common rotations: 180° for upside-down, 90° or 270° for sideways. This makes OCR and human review much easier on the OFF website.

   **Image upload requires base64 data**, not file paths. Encode images via shell-exec-mcp. The recommended pattern using tool-sandbox-mcp:

   First, discover the exact tool names (they depend on how MCPs are wired):

   ```javascript
   const tools = await tool('list_tools', {});
   return tools.filter(t => t.name.includes('shell') || t.name.includes('openfoodfacts'));
   ```

   Then encode and upload:

   ```javascript
   const shell = await tool('tunnel__shell-exec__execute', { // use the shell tool name from list_tools
     command: 'base64 -i "/path/to/photo.jpg"',
     timeout: 10000
   });
   const b64 = shell.stdout.replace(/\n/g, '');
   const result = await tool('openfoodfacts__upload_image', {
     barcode: '1234567890123',
     imagefield: 'front',
     image_data: b64
   });
   ```

   If one photo covers multiple panels (e.g. nutrition AND ingredients on the same side), upload it once then use `select_image` to assign it to the additional imagefield.

   `upload_image` only *stores* the raw image; `select_image` is what assigns it as the displayed `front`/`nutrition`/`ingredients` panel. For a sparse product with no display images, `select_image` the front too, or it won't show one. Conversely, for an established product that already has good community-selected display images, don't reassign its panels — just upload your photos as additional raw images (`upload_image` alone) and leave the existing selections alone.

   `upload_image` and `select_image` also take an `lc` (language) parameter; pass the product's language (e.g. `lc: "de"` for German packaging) to keep it consistent with the `language` used in `add_or_edit_product`.

5. **Transcribe all data** from the photos and call `add_or_edit_product`. See tool description for field guidance. Key points:
   - Set BOTH `quantity` (net weight, e.g. "400g") and `serving_size` (e.g. "1 pack (239g)") — they are separate fields
   - `product_name` should include the product type if not in the headline (e.g. "Fajita Halloumi" on pack → "Fajita Halloumi Wrap")
   - Mark allergens in `ingredients_text` with underscores: `_Wheat_ Flour`
   - Include percentages in ingredients: `Chicken Breast (25%)`
   - For origins like "chicken from Thailand and/or the UK" → `"Thailand, United Kingdom"`
   - Set `labels` for certifications/claims: "High in Protein, FSC, Vegan"
   - For `<` values on nutrition labels, pass as string: `"< 0.5"`

6. **Verify** — Wait ~10 seconds for OFF caches to update, then check the product saved correctly with `get_product`. Open the product page for visual review: `https://world.openfoodfacts.org/product/{barcode}`

   Note: `get_product` returns nutrition under `product.nutriments.per_100g.{energy_kcal, fat, proteins, ...}` (and `.per_serving`), not the flat OFF-API `energy-kcal_100g` shape — don't read back `energy-kcal_100g` and conclude nothing saved. A `nutriscore_grade` that has become a letter is also a quick signal that nutrition was accepted.

7. **Trash photos** — Move processed photos to trash (recommended: use `trash`, not `rm`, so they're recoverable)

### Gotchas

- **Image upload returns "status ok" but image doesn't appear in product JSON** — The image IS stored on the CDN (check `https://images.openfoodfacts.org/images/products/{path}/{imgid}.400.jpg`). The product metadata may take time to update, or may not list images that didn't change the selected display image.
- **Image upload returns "status not ok" with imgid > 0** — Image uploaded successfully but wasn't selected as display image (e.g. one already exists). This is normal.
- **Timeouts on large `add_or_edit_product` calls** — The v2 POST runs first (product fields), then v3 PATCH (packagings). If it times out, v2 fields likely saved but packagings may not have. Simply retry if needed.
- **Short barcodes** — Some supermarket products use short internal codes (e.g. `00238366`) instead of standard EAN-13. These are valid on OFF.
- **Salt ≠ sodium** — UK/EU labels print "Salt" (salt = sodium × 2.5). The OFF `salt` field expects the salt value from the label, not sodium. Do not confuse the two — entering sodium as salt will understate the value by 2.5×. If a label shows sodium instead of salt, multiply by 2.5 before entering.
- **Language handling** — OFF products have a primary language. The `language` parameter (default: `en`) ensures fields are written/read in the correct language. Without it, writing `product_name` on a `lang=fr` product silently writes to `product_name_fr`.
- **Ambiguous nutrition values** — Small text on curved packaging is easy to misread (e.g. `11.9` vs `11.5`, `0.3` vs `0.4`, `0.11` vs `0.13`). Unless the nutrition table is completely clear and legible, crop and enlarge it before transcribing. On macOS: `sips -c <height> <width> <input> --cropOffset <y> <x> -s format jpeg -o <output>` to crop, then read the cropped image. This avoids incorrect edits that are hard to spot later.
