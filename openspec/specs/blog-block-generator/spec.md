# blog-block-generator Specification

## Purpose
A form-based generator that turns field values into self-contained FOSTBeat blog block HTML, which the ME pastes into an article in Strapi, optionally working in the context of one Strapi article.

## Requirements

### Requirement: Block catalogue
The generator SHALL offer these blocks: Into Action, Key Takeaways, Office Hours, Quote, Pull Quote, Gallery and Event Context. Each block SHALL have a form whose field keys match its Strapi component.

#### Scenario: Choosing a block
- **WHEN** the ME picks Quote from the block picker
- **THEN** the form shows the Quote fields and names the Strapi component `blog.block-quote`

### Requirement: Live preview
The generator SHALL show a preview of the block that updates as fields change. The preview SHALL switch between the article column width and phone width, and between the site's light and dark modes.

#### Scenario: Dark mode preview
- **WHEN** the ME fills a block and chooses Dark
- **THEN** the preview shows the block as it appears in the site's dark mode

### Requirement: Self-contained HTML
Copied HTML SHALL carry its own scoped styles. It SHALL work on the live blog without running any script, and SHALL follow the site's dark mode.

#### Scenario: Pasted into an article
- **WHEN** the ME copies a Gallery block and pastes it into an article body in Strapi
- **THEN** the published article shows the gallery styled, with every photo opening full size, and no script is needed

### Requirement: Required fields before copying
The generator SHALL list required fields that are still empty. It SHALL ask before copying a block that has any of them empty.

#### Scenario: Copy with a missing field
- **WHEN** the ME copies a Quote with no author name
- **THEN** the generator asks whether to copy anyway, and copies only if the ME agrees

### Requirement: Copy as Strapi JSON
The generator SHALL also copy the field values in the Strapi component shape, with the component name under `__component`.

#### Scenario: Strapi JSON
- **WHEN** the ME presses Copy Strapi JSON on an Into Action block
- **THEN** the clipboard holds JSON with `"__component": "blog.into-action"` and the block's field values

### Requirement: Edit a pasted block
Every copied snippet SHALL hold its field values. Pasting a snippet back into the generator SHALL restore its block type and fields.

#### Scenario: Loading a block back
- **WHEN** the ME pastes HTML copied earlier from the generator into Edit a pasted block
- **THEN** the form opens on that block type with the values it was made with

#### Scenario: HTML not from the generator
- **WHEN** the ME pastes HTML that the generator did not make
- **THEN** the generator says it found no generator data and leaves the form unchanged

### Requirement: Drafts kept in the browser
The generator SHALL keep the ME's field values for each block type in the browser. With no article open, these drafts SHALL be the ones saved before article context existed.

#### Scenario: Coming back without an article
- **WHEN** the ME opens the generator with no article in its address, after filling a Quote earlier with no article
- **THEN** the Quote form shows those earlier values

### Requirement: Article from the address
The generator SHALL take an article from its address: `doc` is the Strapi document id, and `title` is the article title. A `doc` made of 1 to 64 letters or digits SHALL be accepted. Any other `doc` SHALL be ignored, as if no article were given.

#### Scenario: Opened from the ME dashboard
- **WHEN** the generator opens at `?doc=abc123def456&title=Beyond%20the%20pilot`
- **THEN** it shows "Adding blocks for: Beyond the pilot"

#### Scenario: Invalid document id
- **WHEN** the generator opens at `?doc=../../admin&title=X`
- **THEN** it shows no article and behaves as when opened with no article

#### Scenario: Document id without a title
- **WHEN** the generator opens with a valid `doc` and no `title`
- **THEN** it shows the article as "Untitled article" and offers the Strapi link

### Requirement: Link to the article in Strapi
With an article, the generator SHALL show a link that opens that article's edit screen in the FOSTBeat Strapi admin in a new tab. It SHALL build the link from the Strapi admin address it holds and the document id. A link or host given in the page's address SHALL never be used.

#### Scenario: Going to paste
- **WHEN** the ME presses Open this article in Strapi for the article with document id `abc123def456`
- **THEN** a new tab opens the Strapi admin edit screen for the post with that document id

#### Scenario: Address carries a link
- **WHEN** the generator opens at `?doc=abc123&strapi=https://example.com/`
- **THEN** the Strapi link still points to the FOSTBeat Strapi admin, and `example.com` appears nowhere on the page

### Requirement: Drafts kept per article
With an article, the generator SHALL keep drafts for that article apart from other articles' drafts and from drafts with no article. An article opened for the first time SHALL start each block from its default values.

#### Scenario: Switching articles
- **WHEN** the ME fills a Quote for article A, then opens the generator for article B
- **THEN** the Quote form for article B shows the default values, not article A's quote

#### Scenario: Returning to an article
- **WHEN** the ME opens the generator for article A again after filling its Quote
- **THEN** the Quote form shows article A's values

### Requirement: Article title shown as text
The generator SHALL show the article title only as plain text, and SHALL shorten titles longer than 200 characters.

#### Scenario: Title with markup
- **WHEN** the generator opens with `title=<img src=x onerror=alert(1)>`
- **THEN** the page shows those characters as text, and nothing in the title runs
