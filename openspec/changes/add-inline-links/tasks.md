# Tasks

## 1. Link rendering

- [ ] 1.1 Add `linked(text)` and `linkProblems(block, data)` to `blog-blocks/blocks.js` (design decisions 1, 2 and 4). Verify with a Node script that imports `blocks.js` and checks:
  - a link mid-sentence, two links in one text, and a Wikipedia-style address with parentheses;
  - `javascript:`, a relative address and empty link text, each kept as text and reported;
  - markup in link text escaped;
  - a `mailto:` link;
  - `beat.joinfost.io` with no `target`, and another site with `target="_blank" rel="noopener"`;
  - a bare address left as text.
- [ ] 1.2 Flag the six fields with `links: true` and use `linked()` in their renderers: Into Action intro and step description, Key Takeaways point, Office Hours description, Quote text, Pull Quote text. Verify with the same script that each block's HTML holds the link, that an Into Action title with `[x](https://…)` stays text, and that each block's example (no links) renders byte-identical to before, with the block id normalised.

## 2. Styles

- [ ] 2.1 Add the scoped link rule (design decision 5) to each of the five block styles in `blog-blocks/styles.js`. Verify in the generator preview, in light and dark mode, that links are underlined in orange with text in the block's text colour, and that Tab shows a focus outline. Check the computed text colour against each block background for at least 4.5:1.

## 3. Form

- [ ] 3.1 In `blog-blocks/index.html`, give fields with `f.links` the hint and the **+ Link** button (design decision 6), and show `linkProblems()` messages with the existing warnings. Verify in a browser that:
  - selecting "API guide" and pressing + Link gives `[API guide](https://)` with `https://` selected;
  - with no selection, the button inserts `[link text](https://)`;
  - a `javascript:` link shows a "not made" message.
- [ ] 3.2 Check that Copy Strapi JSON and Edit a pasted block keep `[text](address)` as typed. Verify by copying an Into Action block with a link, loading it back, and comparing the description field.
- [ ] 3.3 Document the link syntax, the allowed addresses and the new-tab rule in `blog-blocks/README.md`. Verify that the README example renders as described in the generator.

## 4. Integration check

- [ ] 4.1 Run a headless Chromium script against a local static server. It fills an Into Action step with a link, checks the preview link's `href`, `target` and underline, checks there is no horizontal scrolling at 390px, and confirms the copied HTML needs no script for the link to work.

## Workflow follow-up

- Merge to `main` so GitHub Pages serves it.
- Archive the change after merging.
