# Proposal

## Why

Blog blocks often point readers somewhere: an Into Action step such as "Go check out the API guide", a takeaway that cites a report, an Office Hours note linking to the archive. Today every text field is escaped, so a link can only appear as a plain, unclickable address. Adding links by hand in Strapi after pasting would break the "Edit a pasted block" round trip and risk breaking the block's markup.

## What Changes

- Body-text fields accept inline links written as `[link text](https://address)`. Several links can sit anywhere in the text.
- Fields that take links:
  - Into Action: intro and each step's description;
  - Key Takeaways: each point;
  - Office Hours: description;
  - Quote: quote text;
  - Pull Quote: text.
- Titles, labels, names, captions and other fields stay plain text.
- Only `https://`, `http://` and `mailto:` addresses become links. Any other address, such as `javascript:`, stays as visible text, and the generator says which link was not made.
- Bare addresses typed without the `[text](address)` form stay as text.
- Links to other sites open in a new tab. Links to `beat.joinfost.io` open in the same tab.
- A **+ Link** button under each of those fields wraps the selected words as link text and selects a placeholder address, ready to type over.
- Each block styles its links (underline, readable colour on its background in light and dark mode, visible keyboard focus).
- **Copy Strapi JSON** and the embedded field values keep the `[text](address)` form, so **Edit a pasted block** restores links as typed.
- The generator's form hint explains the syntax.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `blog-block-generator`: adds inline links in body-text fields, their safety rules, how they open, the **+ Link** helper and their styling. The existing "Self-contained HTML" and "Copy as Strapi JSON" requirements are unchanged, and links are added as new requirements.

## Impact

- `blog-blocks/blocks.js`: a link-aware text renderer used by the listed fields, a `links: true` flag on those fields, and a check that lists links not made.
- `blog-blocks/styles.js`: a link rule scoped to each block that shows body text.
- `blog-blocks/index.html`: the **+ Link** button and hint for flagged fields, and messages for links not made.
- `blog-blocks/README.md`: the link syntax.
- Snippets made before this change are unchanged when loaded and copied again, because their text holds no `[text](address)` patterns.
- Later Strapi plugin: these fields map to Strapi's Markdown `richtext` type with the same text. This change does not alter the Strapi schemas in `blog-blocks/strapi/`.
