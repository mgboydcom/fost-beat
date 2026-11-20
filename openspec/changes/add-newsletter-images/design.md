# Design

## Context

- **Source designs:** the FOSTBeat Newsletter Branding canvas (`https://claude.ai/artifact/Jr7ULLg5qTqiF1uWDQUNvW`) defines `Thumb` (1200×630) and `Banner` (1200×600) once, with five variants (`drum`, `cao`, `otf`, `aig`, `soiree`). Each has its full colour set in a `themes` object. Their motifs are:
  - The Drum: nine rounded beat bars, a `#dd312a`→`#fe8540` gradient.
  - Ctrl+Alt+Own: three keycaps.
  - Open Tech FTW!: an orange→lime→green arc.
  - The AI Generation: a dot grid growing over four rows.
  - Soirée: concentric orange rings and an orange→blue bottom bar.
- **Logos:** the canvas uses three FOSTBeat logo files: standard-light, standard-dark and mono-white. Each is a 429×97 SVG drawn entirely as shapes, with no text, scripts or external references.
- **The generator** (`blog-blocks/index.html` + `blocks.js`) is a static GitHub Pages page with no build step:
  - `BLOCKS` drive a form whose `render()` returns HTML;
  - the picker is a flat row of buttons;
  - drafts sit in `localStorage` under `fbb-gen:` keys;
  - the page loads Inter 400–700 and Outfit 500 and 700 from Google Fonts.
- **Weight 600 is missing:** the canvas sets headlines in Outfit 600, which the page does not load.

## Goals / Non-Goals

**Goals:**
- Images that match the canvas, drawn the same way in every browser.
- One module (`newsletter-images.js`) holding the themes, layouts and drawing, given only a 2D canvas context and its inputs. That keeps it reusable by a future Strapi or dashboard tool and testable in a headless browser.
- No server, keys or new dependencies.

**Non-Goals:**
- Email headers and publication logos, the canvas's first two columns.
- Uploading to beehiiv. The ME uploads the downloaded file.
- Storing photos.
- Editing colours or motifs. They are fixed per newsletter, as in the canvas.

## Decisions

**1. Draw with the Canvas 2D API, not by rasterising HTML.**
Each image is a function `drawThumbnail(ctx, input, theme, scale)` / `drawBanner(...)` that paints:
- rectangles and rounded rectangles;
- linear gradients;
- arcs (the Open Tech FTW! arc, the Soirée rings);
- text with measured wrapping;
- the logo, an `Image` loaded from the SVG file;
- the cropped photo (`drawImage` with a source rectangle).

Coordinates come straight from the canvas designs: the thumbnail has 64px padding, the 820px headline width and the logo at 250px wide; the banner has 56px padding, a 520px photo column and a 56px gap. The `scale` argument multiplies every coordinate for the 2× copy, so both files come from one drawing path.

*Alternative:* render the canvas HTML into an SVG `foreignObject` and draw that. Rejected: web fonts and images inside `foreignObject` need inlining as data URLs, Safari fails on it, and overflow can't be measured.

**2. Themes are copied verbatim from the canvas** into `THEMES` in the module, keyed `drum|cao|otf|aig|soiree`.
- **Thumbnail:** name, ground, ink, eyebrow, pill background and ink, logo, fonts, cadence.
- **Banner:** label, sub, slot, slot line and slot ink colours.
- **Motif:** each theme has a `motif` function.
- **Shared values:** the bar heights `[50,100,76,160,200,120,180,86,60]` and the dot grid sizes `[6,12,20,28]` with opacities `[.35,.55,.8,1]` are copied as given.

**3. Text fitting.**
`wrap(ctx, text, maxWidth)` splits on spaces, using `measureText`. Long single words are broken by characters only if they exceed the width alone.

`fitHeadline` tries font sizes from the start size down to the minimum in 2px steps, and takes the first size where the text fits in 3 lines. Line height is 1.08 on the thumbnail and 1.1 on the banner.
- Thumbnail: from 68px down to 48px, 820px wide.
- Banner: from 54px down to 40px, column width 1200 − 2×56 − 56 − 520 = 512px.

If even the minimum needs more lines, the third line ends with "…" and the result carries `overflow: 'headline'`. The standfirst works the same way: 22px over 32px lines, 2 lines, `overflow: 'standfirst'`. The page turns overflows into "Shorten the headline" / "Shorten the standfirst" messages.

**4. Fonts.**
- The Google Fonts link gains Outfit 600.
- Before each draw, the page awaits `document.fonts.load('600 68px Outfit')`, `document.fonts.load('600 54px Inter')` and the weights it uses.
- Until they resolve, the preview shows "Waiting for fonts…" and Download image stays disabled.
- If they fail (offline), it says the fonts could not load, and Download stays off.

**5. Photo framing.**
This reuses the FOSTBeat ME dashboard's feature-image approach, copied rather than shared because the repositories are separate.
- The frame keeps the 520:488 ratio. It starts centred and as large as fits, and is kept inside the photo with a minimum width of 120 source pixels.
- It moves and resizes by pointer, or with the arrow keys and Shift + arrow keys.
- The photo is decoded once with `createImageBitmap`. Files over 25 MB are refused.
- "This will look soft" appears when the frame's width is under 520 × the output scale.

**6. Output.**
- `canvas.toBlob`: PNG for the thumbnail, `image/jpeg` at 0.9 for the banner.
- The download goes through an object URL and an `<a download>` click.
- With "Also download at 2×", a second canvas is drawn at scale 2 and saved with `@2x` before the extension.
- File names: `<newsletter-slug>-issue-<n>-thumbnail.png` (with no issue number, `<newsletter-slug>-thumbnail-<headline-slug>.png`) and `<newsletter-slug>-banner-<headline-slug>.jpg`. The headline slug is at most 40 characters at a word boundary.

**7. Page integration.**
- `index.html` keeps `BLOCKS` for the blog blocks and adds `IMAGES` from the new module.
- The picker renders two labelled groups (`<div role="group" aria-label="Blog blocks">` and `aria-label="Newsletter images"`).
- Choosing an image hides the HTML preview, Copy HTML, Copy Strapi JSON and Edit a pasted block, and shows the image panel with:
  - the canvas preview;
  - the photo crop (banner);
  - messages;
  - alt text with Copy;
  - the 2× option and Download image.
- The newsletter choice is a row of five buttons with `aria-pressed`.
- The issue date uses `<input type="date">`, formatted with `toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'})` in upper case, with any "Sept" shortened to "SEP".

**8. Drafts.**
- Fields are stored under `fbb-gen:img:<type>:<newsletter>`.
- The last newsletter is stored per type under `fbb-gen:img:<type>:last`.
- Alt text is stored only when edited, with an `altEdited` flag. Filled-in alt text follows the fields until the ME edits it.
- The photo is never stored.

**9. Logos in the repository.**
The three SVGs go to `blog-blocks/assets/fostbeat-logo-light.svg`, `-dark.svg` and `-white.svg`. Found while building: the canvas's logo uploads (and the files the FOSTBeat design system lists under Logos) are one identical file with `class="cls-…"` colours whose stylesheet was stripped on upload, so all three draw black. The design system also holds versions of the same three logos with their colours written inline (uploaded 30 October, 16:35, not listed in its Logos group); those are the ones copied, byte for byte. They are drawn with `drawImage` at 250px wide on the thumbnail, keeping their 429:97 ratio.

## Risks / Trade-offs

- [Canvas text differs slightly from the canvas's CSS rendering, for example kerning or `text-wrap: balance`] → Layout positions are taken from the design, and a test compares sizes and positions. Balanced wrapping is not reproduced; lines fill greedily.
- [Large photos on slow machines] → The photo is decoded once, and redraws are throttled to animation frames while dragging.
- [Google Fonts unavailable] → Download is blocked rather than producing an off-brand image, and the message says why.
- [Colours drift if the canvas changes] → `THEMES` names its source. Updating the module is a manual step, recorded in the README.

## Open Questions

None.
