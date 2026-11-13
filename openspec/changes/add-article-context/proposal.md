# Proposal

## Why

The ME builds blog blocks for one article at a time, then pastes them into that article in Strapi. Today the generator has no idea which article it is working on. Its drafts are shared by every article, so article A's Quote comes back when working on article B, and finding the article in Strapi is a separate search. The ME dashboard (`platformable/fostbeat-me`) is adding a blocks icon to each article. That icon needs a generator page that takes the article from the link.

## What Changes

- The generator reads an optional article from its address: `?doc=<Strapi document id>&title=<article title>`.
- With an article, the page shows "Adding blocks for: <title>" and an **Open this article in Strapi** link to that article's edit screen in the Strapi admin. The link is built from a fixed Strapi admin address and the document id. A full address in the query string is never accepted.
- Drafts are kept per article. An article opened for the first time starts with the blocks' default values, not another article's draft. Opening the same article again brings back its drafts.
- A `doc` value that is not a plausible document id is ignored. The page then behaves as it does with no article.
- With no article in the address, the generator works exactly as it does today, including the drafts already saved in the browser.
- Writes a first spec for the generator, covering the behaviour it already has as well as the article context.

## Capabilities

### New Capabilities
- `blog-block-generator`: the form-based generator for FOSTBeat blog blocks. It covers choosing a block, filling its fields, previewing it, copying HTML or Strapi JSON, loading a pasted block back in, browser drafts, and working in the context of one Strapi article.

### Modified Capabilities
None. The project has no specs yet.

## Impact

- `blog-blocks/index.html`: reads the query string, shows the article bar and the Strapi link, and keys drafts by article.
- `blog-blocks/README.md`: documents the `doc` and `title` parameters and the per-article drafts.
- `blocks.js`, `styles.js` and the generated HTML are unchanged. Snippets copied before and after this change are identical for the same field values.
- Browser storage gains keys `fbb-gen:draft:<doc>:<type>`. Existing `fbb-gen:draft:<type>` keys stay in use when there is no article.
- Companion change in `platformable/fostbeat-me`: a blocks icon on article planning rows and In edit cards opens `…/blog-blocks/?doc=<id>&title=<title>` in a tab named `fbb-<id>`. This change ships first, because the icon is only useful once the generator reads the parameters.
