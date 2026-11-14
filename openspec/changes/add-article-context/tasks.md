# Tasks

## 1. Confirm the Strapi admin address

- [x] 1.1 Open any post in the FOSTBeat Strapi admin and confirm its edit address has the form `…/admin/content-manager/collection-types/api::post.post/<documentId>`. Update `STRAPI_ADMIN_POST` in design.md if it differs, and verify by opening the confirmed address with a real document id.

## 2. Article context in the generator

- [x] 2.1 In `blog-blocks/index.html`, read `doc` and `title` once at load. Accept `doc` only if it matches `^[A-Za-z0-9]{1,64}$`, and cut `title` to 200 characters. Verify in a browser that `?doc=../../admin` and `?doc=a%2Fb` show no article.
- [x] 2.2 Add the article bar under the header, filled with `textContent`: "Adding blocks for: <title>" (or "Untitled article") and an **Open this article in Strapi ↗** link built from `STRAPI_ADMIN_POST` and `encodeURIComponent(doc)`, with `target="_blank" rel="noopener noreferrer"`. Set the tab title to `Blocks: <title>`. Verify that `?title=<img src=x onerror=alert(1)>&doc=abc` shows the characters as text, and that `&strapi=https://example.com/` changes nothing.
- [x] 2.3 Key drafts by article (`draft:<doc>:<type>` with an article, `draft:<type>` without one), leaving `last` and `scripts:<type>` shared. Verify by filling a Quote for article A, opening article B (defaults shown), going back to A (its values shown), and then opening with no `doc` (the old article-less draft shown).
- [x] 2.4 Check that the copied HTML is byte-identical with and without an article for the same field values, by comparing the View HTML output in both cases.
- [x] 2.5 Document the `doc` and `title` parameters, the Strapi link and per-article drafts in `blog-blocks/README.md`. Verify that the example address in the README opens the generator with the article bar.

## 3. Integration check

- [x] 3.1 Run a headless Chromium script against a local static server that opens `?doc=abc123&title=Test` and checks the article bar text, the Strapi link's `href`, and that a Quote draft does not appear for a second `doc`. Then check the page at 390px width for horizontal scrolling.

## Workflow follow-up

- Merge to `main` so GitHub Pages serves it before the `fostbeat-me` icon change ships.
- Propose the companion change in `platformable/FOSTBeat-me` (blocks icon on planning rows and In edit cards; updates to `article-planning`, `content-pipeline` and `design-system-usage`).
- Archive this change once it is live.
