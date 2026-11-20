# Spec Delta

## Purpose

Produces beehiiv post thumbnails and in-email banners for the five FOSTBeat newsletters as downloadable images that match the FOSTBeat Newsletter Branding canvas.

## ADDED Requirements

### Requirement: Five newsletter looks
Both images SHALL offer The Drum, Ctrl+Alt+Own, Open Tech FTW!, The AI Generation and Soirée. Choosing one SHALL apply that newsletter's background, text and accent colours, motif, FOSTBeat logo version, cadence label and typeface as defined in the branding canvas: Soirée set in Inter, the others with Outfit headlines.

#### Scenario: The Drum thumbnail
- **WHEN** the ME chooses The Drum for a post thumbnail
- **THEN** the image has the navy background, the red-to-orange beat bars, the dark-background FOSTBeat logo and an orange WEEKLY label

#### Scenario: Soirée banner
- **WHEN** the ME chooses Soirée for an in-email banner
- **THEN** the image has the Electric Blue background, white text set in Inter and a white READ ON FOSTBEAT button

### Requirement: Post thumbnail fields
The post thumbnail SHALL be 1200×630 and show the newsletter name, "ISSUE <number> · <date>" with the date written as day, short month and year in capitals, the headline, the FOSTBeat logo and the cadence label.

#### Scenario: Issue line
- **WHEN** the ME enters issue 42 and the date 20 November 2026
- **THEN** the thumbnail reads "ISSUE 42 · 20 NOV 2026"

### Requirement: In-email banner fields
The in-email banner SHALL be 1200×600 and show "<NEWSLETTER> · <CATEGORY>", the headline, the standfirst, a button whose text the ME can edit (starting as "READ ON FOSTBEAT →"), and the photo in the 520×488 space on the right.

#### Scenario: Category label
- **WHEN** the ME enters the category "AI and APIs" for The AI Generation
- **THEN** the banner's label reads "THE AI GENERATION · AI AND APIS"

#### Scenario: No photo yet
- **WHEN** no photo has been chosen
- **THEN** the photo space shows the newsletter's dashed placeholder, and the tool notes that the banner has no photo

### Requirement: Photo framing
The ME SHALL be able to choose a photo for the banner and frame it with a box shaped like the photo space (520:488), moved and resized with a pointer or the keyboard and kept inside the photo. The framed area SHALL fill the photo space. If it covers fewer original pixels than the space at the chosen output size, the tool SHALL warn "This will look soft" and still allow the download.

#### Scenario: Wide photo
- **WHEN** the ME chooses a 3000×2000 photo
- **THEN** a frame of the photo space's shape appears over it, centred and as large as fits, and the banner shows the framed area

#### Scenario: Keyboard
- **WHEN** the frame has focus and the ME presses the arrow keys
- **THEN** the frame moves, and with Shift held it grows or shrinks, keeping its shape

### Requirement: Text that fits
Headlines SHALL shrink to fit: from 68px down to 48px on the thumbnail and from 54px down to 40px on the banner, within 3 lines. The standfirst SHALL fit within 2 lines at its size. Text that still does not fit SHALL be cut with an ellipsis in the image, and the tool SHALL name the field to shorten, without blocking the download.

#### Scenario: Long headline
- **WHEN** a thumbnail headline needs 3 lines at 68px
- **THEN** it is drawn smaller, no lower than 48px, so that it fits within 3 lines

#### Scenario: Too long
- **WHEN** a headline does not fit in 3 lines even at the smallest size
- **THEN** the image shows it cut with an ellipsis, and the tool says "Shorten the headline"

### Requirement: Download
Download image SHALL save the image at exact size: the thumbnail as PNG and the banner as JPEG at quality 90. An "Also download at 2×" option SHALL save a second file at twice the size. File names SHALL be built from the newsletter and the issue or headline, for example `the-drum-issue-42-thumbnail.png` and `ctrl-alt-own-banner-who-owns-your-stack.jpg`.

#### Scenario: Thumbnail download
- **WHEN** the ME downloads a The Drum thumbnail for issue 42
- **THEN** a 1200×630 PNG named `the-drum-issue-42-thumbnail.png` is saved

#### Scenario: 2× copy
- **WHEN** "Also download at 2×" is on and the ME downloads a banner
- **THEN** a 1200×600 JPEG and a 2400×1200 JPEG are saved, the second named with `@2x`

### Requirement: Fonts loaded before drawing
The tool SHALL wait for the newsletter's typefaces to load before drawing, and SHALL say so instead of downloading an image drawn in a fallback font.

#### Scenario: Fonts not loaded
- **WHEN** the typefaces have not loaded yet
- **THEN** the preview says it is waiting for fonts, and Download image is unavailable until they load

### Requirement: Alt text
The tool SHALL fill in alt text from the fields ("<Newsletter>, issue <number>: <headline>" for a thumbnail, the headline for a banner), let the ME edit it, keep the edit while other fields change, and copy it with Copy alt text.

#### Scenario: Thumbnail alt text
- **WHEN** the ME fills in The Drum, issue 42 and a headline
- **THEN** the alt text reads "The Drum, issue 42: <headline>"

### Requirement: Image drafts in the browser
The tool SHALL keep each image type's fields, per newsletter, in the browser, and restore them when the ME comes back. The photo SHALL NOT be stored, and no field or image SHALL leave the browser.

#### Scenario: Coming back
- **WHEN** the ME fills a Ctrl+Alt+Own banner and returns to it later
- **THEN** its category, headline, standfirst and button text are restored, and the photo must be chosen again
