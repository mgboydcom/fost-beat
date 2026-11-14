# FOSTBeat block generator

A form-based generator for the FOSTBeat blog blocks. Pick a block, fill in the fields,
check the live preview (article column or phone, light or dark), then **Copy HTML** and
paste it into the article body in Strapi. It follows the same pattern as
[Platformable's code generator](https://github.com/platformable/platformablecodegenerator):
fields → preview → copy.

Live (once merged to the Pages branch): https://mgboydcom.github.io/fost-beat/blog-blocks/

Blocks: Into Action, Key Takeaways, Office Hours, Quote, Pull Quote, Gallery, Event Context.

## How the output works on the live blog

The blog inserts post HTML with `innerHTML`, which never runs `<script>` tags, so every
snippet is built to work with no script:

- **Office Hours**: the Google Calendar link and the `.ics` file are computed when the
  HTML is generated (weekly repeat, in the chosen IANA time zone), not in the browser.
- **Gallery**: the `+N` tile is written into the HTML, and each photo is a link to the
  full-size image. The full-screen viewer is optional.
- **Include enhancement script** (Office Hours, Gallery) adds the small script from the
  block library. It only does anything on pages that run scripts.

Each snippet carries its own scoped `fbb-` styles and follows the site's dark mode
(`<html data-theme="dark">` or a `.dark` parent).

## Working on one article

The ME dashboard opens the generator for one article with two parameters:

```
https://mgboydcom.github.io/fost-beat/blog-blocks/?doc=idblixhmvqjmxduwijctx5ee&title=Beyond%20Bolt-On%20AI
```

- `doc` is the post's Strapi document id (1 to 64 letters or digits; anything else is ignored).
- `title` is only shown on the page: "Adding blocks for: <title>". It is never stored.

With an article, **Open this article in Strapi** goes to that post's edit screen in the Strapi
admin, ready for pasting. The link is built from the Strapi admin address fixed in `index.html`
(`STRAPI_ADMIN_POST`) and the document id; an address in the query string is never used.

Drafts are kept per article: an article opened for the first time starts empty, and opening it
again brings back its fields. Without `doc`, the generator uses the drafts it always has.

## Editing a block later

The first line of every snippet is a comment holding the field values
(`<!-- fbb:<type> <base64 JSON> -->`). Copy the block's HTML back out of Strapi, use
**Edit a pasted block**, change the fields and copy again. Drafts are also kept in the
browser per block type.

## Files

| File | What it is |
|---|---|
| `index.html` | The generator page (no build step, no dependencies) |
| `blocks.js` | Field definitions and HTML renderers. No DOM or framework code, so a Strapi plugin or a server can import it |
| `styles.js` | Scoped CSS for each block, copied from the FOSTBeat Blog Blocks library |
| `strapi/components/blog/*.json` | Strapi component schemas from the developer kit. Field keys match `blocks.js` |
| `strapi/article-blocks-attribute.json` | The `blocks` dynamic zone attribute for the Article type |

**Copy Strapi JSON** gives the same values in the Strapi component shape
(`{"__component": "blog.into-action", ...}`), for when articles move to the dynamic zone.

## Towards Strapi plugins

Two routes, which can be combined:

1. **Native components (no plugin code).** Copy `strapi/components/blog/` into the Strapi
   project and add the `blocks` dynamic zone to Article. Editors fill the same fields
   inside Strapi, and the frontend renders them (the developer kit's React renderer, or
   `blocks.js` on the server).
2. **Admin plugin that keeps the HTML workflow.** A Strapi 5 plugin with a custom field
   (or an admin page) that reuses `blocks.js` for the form schema and the renderer and
   writes the HTML into the article body. This suits the current body field without a
   frontend change.

Paste the HTML into a Markdown/HTML body field. Strapi's rich-text "Blocks" editor
doesn't accept raw HTML.
