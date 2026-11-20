# Proposal

## Why

Each FOSTBeat newsletter issue on beehiiv needs a post thumbnail (1200×630) and, for features, an in-email banner (1200×600). The FOSTBeat Newsletter Branding canvas defines both for all five newsletters: The Drum, Ctrl+Alt+Own, Open Tech FTW!, The AI Generation and Soirée. Each has its own colours, motif, logo and cadence. Today every image is made by hand from that canvas, so issue numbers, headlines and photos have to be laid out each time, and small differences creep in. The block generator already holds the FOSTBeat look and runs in the browser, so it can produce these images from a few fields.

## What Changes

- **A new picker group, Newsletter images**, after the blog blocks, with two items: **Post thumbnail** and **In-email banner**.
- **Newsletter choice:** five buttons set the colours, motif, logo, cadence and font exactly as in the canvas. Soirée is set in Inter; the others use Outfit headlines.
- **Fields:**
  - Post thumbnail: issue number, date (written as "20 NOV 2026"), headline.
  - In-email banner: category, headline, standfirst, button text (starts as "READ ON FOSTBEAT →"), and a photo.
- **Photo:** the ME chooses a file and frames it with a crop box shaped like the photo space (520:488), using the pointer or the keyboard. It warns "This will look soft" when the framed area is smaller than the space.
- **Text that does not fit:**
  - Headlines shrink to fit: thumbnail 68px down to 48px, banner 54px down to 40px, up to 3 lines.
  - The standfirst gets up to 2 lines.
  - If text still does not fit, the tool asks the ME to shorten it, and the image can still be downloaded.
- **Output:** a live preview, and **Download image** at exact size: thumbnail as PNG, banner as JPEG at quality 90. An option also downloads a 2× copy (2400×1260 or 2400×1200).
- **File names** are built from the newsletter, issue or headline, and image type.
- **Alt text** is filled in from the fields, is editable, and has **Copy alt text**.
- **Drafts** are kept in the browser per image type and newsletter. Nothing leaves the browser: no server, no keys.
- **Logos:** the FOSTBeat logo's light, dark and white files are copied from the canvas into `blog-blocks/assets/`.
- The existing blog blocks and their HTML output are unchanged.

## Capabilities

### New Capabilities
- `newsletter-images`: producing beehiiv post thumbnails and in-email banners for the five FOSTBeat newsletters as downloadable images, with photo framing, text fitting and alt text.

### Modified Capabilities
- `blog-block-generator`: the picker gains a Newsletter images group, whose items show an image preview and Download instead of Copy HTML.

## Impact

- **New:**
  - `blog-blocks/newsletter-images.js`: themes, layout and drawing; no DOM beyond a canvas context it is given.
  - `blog-blocks/assets/fostbeat-logo-{light,dark,white}.*`: the three logo files.
- **Changed:**
  - `blog-blocks/index.html`: the picker group, the image preview, the photo crop, Download, alt text, and drafts.
  - `blog-blocks/README.md`: a "Newsletter images" section.
- **No new dependencies**, no build step. GitHub Pages serves it as before.
- **Fonts:** Outfit and Inter come from the Google Fonts link already on the page. Drawing waits for them so images never fall back to a system font.
