# Design

## Context

The generator (`blog-blocks/index.html`) is a single static page on GitHub Pages. It has no build step, and its form and renderers come from `blocks.js`. Drafts sit in `localStorage` under `fbb-gen:draft:<type>`, the last block chosen under `fbb-gen:last`, and the enhancement-script choice under `fbb-gen:scripts:<type>`. `select()` loads a block's data in this order: preset, then the stored draft, then `defaults(block)`. `update()` writes the draft on every change.

The page is public and anyone can link to it with any query string. The ME dashboard will link to it from a signed-in page, but the generator cannot tell where a visit came from.

## Goals / Non-Goals

**Goals:**
- Read `doc` and `title` once at load, and treat both as untrusted.
- Show the article and its Strapi link without changing the block HTML that gets copied.
- Keep per-article drafts apart from each other and from article-less drafts.

**Non-Goals:**
- Writing blocks into Strapi. The dashboard's Strapi token can only create posts, and the generator stays copy and paste.
- Checking that the document id exists in Strapi. That would need a token in a public page.
- Clearing out old per-article drafts.
- Choosing a different article inside the generator. The article changes only through the address.

## Decisions

**1. Strapi admin address held in the page, not passed in.**
`STRAPI_ADMIN_POST = "https://fost-media-backend.platformable.com/admin/content-manager/collection-types/api::post.post/"` is a constant in `index.html`, and the link is that constant followed by the encoded `doc`. *Alternative:* the dashboard passes the full address, built from its `STRAPI_URL`. That was rejected because the generator is public, so anyone could craft a link whose "Open in Strapi" button leads to a lookalike sign-in page. If the Strapi host moves, the constant needs a one-line edit, which is acceptable for one site.

**2. `doc` must match `^[A-Za-z0-9]{1,64}$`.**
Strapi 5 document ids are short lowercase alphanumeric strings. The pattern accepts them with room to spare, and rejects slashes, dots, `%` and `:`, so a value cannot change the path of the admin address. Anything else counts as no article. *Alternative:* encode any value with `encodeURIComponent` and accept it. That was rejected because it still lets odd values through to the Strapi admin path. Encoding is still applied, as a second safeguard.

**3. `title` is display-only.**
The title is set with `textContent`, cut to 200 characters with an ellipsis, and never stored. It also sets the browser tab title to `Blocks: <title>`, which helps tell tabs apart when several articles are open. Without a title, the page shows "Untitled article".

**4. Draft key includes the document id.**
The draft key is `draft:<doc>:<type>` with an article and `draft:<type>` without one, so old drafts keep working when there is no article. `scripts:<type>` and `last` stay shared across articles, because they are preferences rather than content. *Alternative:* no drafts for articles, so every visit starts fresh. That was rejected because a closed tab would lose half-finished work. With a draft key per article, opening an article for the first time still starts empty, as the ME asked.

**5. Article bar placement.**
A single line sits between the header and the block picker: "Adding blocks for: **<title>**" followed by an **Open this article in Strapi ↗** link with `target="_blank" rel="noopener noreferrer"`. The `noreferrer` keeps the generator's address, including the title, out of Strapi's referrer logs. With no article, the line is not rendered.

## Risks / Trade-offs

- [The content-type id in the admin address is assumed to be `api::post.post`] → Tasks include one check against the Strapi admin before the change ships.
- [Per-article drafts build up in `localStorage`] → Each one is a few KB. Across hundreds of articles the total stays well under browser limits, and pruning is left out on purpose.
- [The title in the address can be anything] → It is shown as text and never stored, so the worst outcome is a misleading label on a page the person chose to open.
- [The ME dashboard opens a tab named `fbb-<doc>`, which is reused for the same article] → The page reads the address at load, so a reused tab picks up the new address when it reloads. No extra handling is needed.
