# Design

## Context

- `blocks.js` escapes every value with `esc()` inside each block's `render()`, and field definitions live in the `BLOCKS` array (`type: "textarea"` and similar). Two blocks already have a `validate(d)` hook whose messages `index.html` shows under the preview.
- `index.html` builds each field in `input(f, value, onChange)` and already shows `f.help` as small text under a field.
- `styles.js` has one CSS string per block. Each block sets `--fbb-fg`, `--fbb-icon` and a background in light and dark mode. Body-text links have no style yet. The only existing link styles are the Quote source and the Event Context speakers.
- The copied HTML must work without scripts (spec: "Self-contained HTML"), so links must be plain `<a>` elements written at generation time.

## Goals / Non-Goals

**Goals:**
- One function turns a field's raw text into safe HTML with links, and every flagged field uses it.
- The form tells the ME about any link it could not make, instead of failing silently.

**Non-Goals:**
- Bold, italics, lists or any other Markdown. Only links.
- Turning bare addresses into links.
- Changing the Strapi component schemas in `blog-blocks/strapi/`. The move to `richtext` belongs to the plugin work.
- Links in titles, labels, names, captions or credits.

## Decisions

**1. Parse first, escape each piece.**
`linked(text)` in `blocks.js` scans the raw text with one pattern, `\[([^\]\n]+)\]\(([^\s()]*(?:\([^\s()]*\)[^\s()]*)*)\)`. The pattern allows one level of parentheses in the address, for Wikipedia-style URLs. Text between matches goes through `esc()`. For each match, the link text and the address go through `esc()` too, and `<a>` is built only if the address passes the scheme check. Otherwise the original `[text](address)` is escaped and kept as text. Because nothing typed is ever inserted unescaped, typed markup cannot reach the HTML. *Alternative:* escape first, then turn escaped patterns into links. That was rejected because matching on escaped text (`&amp;` and similar) makes the address handling fragile.

**2. Scheme check.**
The address must match `^(https?:\/\/[^\s]+|mailto:[^\s@]+@[^\s]+)$` (case-insensitive), and the link text must not be empty once trimmed. Any other scheme, a relative address, or an empty link text leaves the pattern as text.

**3. Fields opt in with a flag.**
The listed fields get `links: true` in `BLOCKS`. Their renderers call `linked(d.x)` instead of `esc(d.x)`. A shared `linkProblems(block, data)` walks the flagged fields, including list items, and returns messages such as `Step 2 description: link "click" was not made (only https, http and mailto addresses)`. `index.html` shows these with the existing `validate` messages. *Alternative:* parse every field. That was rejected because titles and labels shouldn't carry links, and visible `[x](y)` in them is a clearer signal to the ME.

**4. Where links open.**
If the host is `beat.joinfost.io`, the `<a>` has no `target`. Otherwise it gets `target="_blank" rel="noopener"`. `mailto:` links get no `target`. The host is read with `new URL()`, which runs both in the browser and in Node, so a Strapi plugin can reuse the same function.

**5. Link styling: text colour, orange underline.**
FOSTBeat orange as text fails contrast on the light backgrounds: `#ff5900` on `#ffe7dd` is 2.65:1, and on `#fcfcfa` it is 3.06:1. So links keep the block's text colour (`color: inherit`), which already passes, for example `#252525` on `#ffe7dd` at 12.9:1 and `#d6dae0` on `#221a24` at 12.1:1. They are marked by an underline in `var(--fbb-icon)`, `text-decoration-thickness: 2px` and `text-underline-offset: 3px`. Hover thickens the underline to 3px. `:focus-visible` gets `outline: 2px solid currentColor; outline-offset: 2px`. Each body-text block (`.fbb-action`, `.fbb-takeaways`, `.fbb-hours`, `.fbb-quote blockquote`, `.fbb-pull`) gets one scoped rule, so the blog's own link styles can't leak in. The rule doesn't touch existing `a` styles such as the Quote source or Event Context links.

**6. + Link button.**
In `input()`, a field with `f.links` gets a small `+ Link` button and the hint `Add a link: [link text](https://…)`. On click, it reads `selectionStart` and `selectionEnd` and replaces the selection `s` with `[s](https://)`, or with `[link text](https://)` if nothing is selected. It then selects `https://` and fires the field's input handler so the preview updates. *Alternative:* `prompt()` for the address. That was rejected because it blocks the page and is awkward on phones.

## Risks / Trade-offs

- [A real `[`…`](`…`)` in prose, for example in a code sample, becomes a link] → It only happens with a valid address in parentheses right after the brackets, which is rare in these blocks. The ME sees it in the preview.
- [Links pasted into Strapi's rich-text "Blocks" editor] → Unchanged: the README already says to paste into the Markdown or HTML source view.
- [The underline colour alone signals a link] → The underline itself is the signal, not the colour (WCAG 1.4.1), and the link text keeps full contrast.
- [Snippets copied before this change] → Their stored values have no link patterns, so loading and copying them again gives the same output as before.
