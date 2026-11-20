# Tasks

## 1. Assets and fonts

- [ ] 1.1 Copy the three FOSTBeat logo SVGs from the branding canvas into `blog-blocks/assets/` (`fostbeat-logo-light.svg`, `-dark.svg`, `-white.svg`), unchanged, and add Outfit 600 to the Google Fonts link in `blog-blocks/index.html`. Verify that each file opens at 429×97 with no scripts or external references, and that the page loads Outfit 600.

## 2. Drawing module

- [ ] 2.1 Add `blog-blocks/newsletter-images.js` with `THEMES` (copied from the canvas's `Thumb` and `Banner`), `wrap`, `fitHeadline`, `fitStandfirst`, `issueDate`, `fileName`, `altText` and the five motif painters (design decisions 1–3, 6). Verify with a Node script for the pure functions:
  - wrapping, using a stub `measureText`;
  - the headline size stepping down to its minimum, then the ellipsis and the overflow flag;
  - the date "20 NOV 2026";
  - file names with and without an issue number;
  - the alt text for both types.
- [ ] 2.2 Add `drawThumbnail` and `drawBanner` (design decision 1), each taking a context, inputs, the theme, the loaded logo and photo, and a scale. Verify in headless Chromium that both draw at 1× and 2× sizes. Sample pixel colours for each newsletter's background, The Drum's bar gradient, and the banner's photo area holding the cropped photo.

## 3. Generator page

- [ ] 3.1 In `blog-blocks/index.html`:
  - split the picker into Blog blocks and Newsletter images groups;
  - add the image panel: newsletter buttons, fields, canvas preview, messages, alt text with Copy, the 2× option and Download image;
  - hide the HTML-only controls for images;
  - wait for fonts before drawing (design decisions 4 and 7).

  Verify in a browser that switching between a blog block and an image swaps the controls, and that blog block output is unchanged.
- [ ] 3.2 Add the banner photo framing (design decision 5): file input, crop view with a 520:488 frame, pointer and keyboard control, and the soft warning. Verify in a browser that a 3000×2000 photo gets a centred frame, the arrow keys move it, Shift with arrows resizes it, and a small photo shows "This will look soft".
- [ ] 3.3 Add drafts per type and newsletter (design decision 8), and alt text that follows the fields until edited. Verify that reloading the page restores the fields but not the photo, and that edited alt text survives field changes.

## 4. Docs and checks

- [ ] 4.1 Add a "Newsletter images" section to `blog-blocks/README.md`: the two images, the fields, the photo, the download formats and the 2× option, alt text, and that the themes come from the branding canvas. Verify that the README's example matches the generator's output name.
- [ ] 4.2 Run one headless Chromium check against a local static server for each newsletter and image type. It should confirm:
  - the downloaded file's type and size (1200×630 PNG, 1200×600 JPEG, and the 2× copies);
  - its file name;
  - the overflow message for a too-long headline;
  - no horizontal scrolling at 390px;
  - visual screenshots of all ten images, compared side by side with the canvas artboards.

## Workflow follow-up

- Merge to `main` so GitHub Pages serves it, then archive the change.
