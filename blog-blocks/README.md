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

## Links in the text

Body-text fields take inline links: Into Action intro and step descriptions, Key Takeaways
points, Office Hours description, Quote text and Pull Quote text. Write a link as:

```
Go check out the [API guide](https://example.org/guide) before you start.
```

- Select the words and press **+ Link** under the field: it writes `[words](https://)` and selects
  `https://` to type over.
- Only `https://`, `http://` and `mailto:` addresses become links. Anything else (such as a
  relative address) stays as typed, and the generator says which link was not made.
- An address typed on its own, without the `[text](address)` form, stays as text.
- Links to `beat.joinfost.io` open in the same tab; links to other sites open in a new tab.
- Titles, labels, names and captions stay plain text.
- Links keep the block's text colour with an orange underline, so they stay readable on every
  block background in light and dark mode.
- Copy Strapi JSON and the embedded field values keep the `[text](address)` form, so
  **Edit a pasted block** brings links back as typed.

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

## Newsletter images

The **Newsletter images** group in the picker makes the two beehiiv images for each issue, for all five
newsletters (The Drum, Ctrl+Alt+Own, Open Tech FTW!, The AI Generation, Soirée):

| Image | Size and file | Fields |
|---|---|---|
| **Post thumbnail** | 1200 × 630 PNG, e.g. `the-drum-issue-42-thumbnail.png` | Issue number, date (shown as `20 NOV 2026`), headline |
| **In-email banner** | 1200 × 600 JPEG (quality 90), e.g. `ctrl-alt-own-banner-who-owns-your-stack.jpg` | Category, headline, standfirst, button text, photo |

- Choosing a newsletter sets its colours, motif, FOSTBeat logo version, cadence and font, exactly as in the
  [FOSTBeat Newsletter Branding](https://claude.ai/artifact/Jr7ULLg5qTqiF1uWDQUNvW) canvas. Soirée is set in Inter.
- **Photo:** choose a file, then drag the frame (or use the arrow keys; Shift and the arrow keys resize it) to pick
  the part shown in the banner's 520 × 488 photo space. "This will look soft" means the framed part is smaller
  than the space.
- **Text that does not fit:** headlines shrink to fit (thumbnail 68px down to 48px, banner 54px down to 40px, up to
  three lines). If they still don't fit, the image cuts them with "…" and the page asks you to shorten them.
- **Download image** saves the file; **Also download at 2×** adds a sharper `@2x` copy for high-resolution screens.
  Download waits until the newsletter's fonts have loaded, so an image is never drawn in a fallback font.
- **Alt text** is filled in from the fields (thumbnail: "The Drum, issue 42: <headline>"; banner: the headline)
  until you edit it. **Copy alt text** copies it for beehiiv's image alt field.
- Fields are kept in the browser per image type and newsletter; the photo is not kept. Nothing leaves the browser.

The themes and layouts live in `newsletter-images.js`. If the branding canvas changes, update `THEMES` there.

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
| `newsletter-images.js` | Newsletter image themes, layouts and drawing (Canvas 2D), with no DOM beyond the canvas it is given |
| `newsletter-ui.js` | The Newsletter images panel: newsletter choice, fields, photo frame, preview, alt text, download |
| `assets/fostbeat-logo-*.svg` | FOSTBeat logo (light, dark, white), with colours written into each file |
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
