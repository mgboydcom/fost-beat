# Spec Delta

## ADDED Requirements

### Requirement: Inline links in body text
These fields SHALL turn `[link text](address)` into a link in the copied HTML: Into Action intro and step descriptions, Key Takeaways points, Office Hours description, Quote text and Pull Quote text. A field MAY hold several links anywhere in its text. All other fields SHALL show `[`, `]`, `(` and `)` as typed.

#### Scenario: Link inside a step
- **WHEN** an Into Action step description is `Go check out the [API guide](https://example.org/guide) first.`
- **THEN** the step reads "Go check out the API guide first." with "API guide" linking to `https://example.org/guide`

#### Scenario: Two links in one point
- **WHEN** a Key Takeaways point holds two `[text](https://…)` links
- **THEN** both appear as links in the point

#### Scenario: Title stays plain
- **WHEN** an Into Action title is `[Start here](https://example.org)`
- **THEN** the title shows those characters as text and holds no link

#### Scenario: Bare address
- **WHEN** a description contains `https://example.org` without the `[text](address)` form
- **THEN** it appears as text and is not a link

### Requirement: Only web and email addresses become links
A link SHALL be made only for addresses starting `https://`, `http://` or `mailto:`, and only when the link text is not empty. Otherwise the whole `[text](address)` SHALL appear as typed text, and the generator SHALL name each link it did not make. Everything else in these fields SHALL stay escaped, so no typed markup reaches the HTML.

#### Scenario: Script address
- **WHEN** a description holds `[click](javascript:alert(1))`
- **THEN** the copied HTML shows `[click](javascript:alert(1))` as text with no link, and the generator says the link "click" was not made

#### Scenario: Markup in link text
- **WHEN** a description holds `[<b>bold</b>](https://example.org)`
- **THEN** the link text shows `<b>bold</b>` as characters, not bold text

#### Scenario: Email link
- **WHEN** a description holds `[email us](mailto:editor@example.org)`
- **THEN** "email us" links to that email address

### Requirement: Where links open
Links to `beat.joinfost.io` SHALL open in the same tab. All other links SHALL open in a new tab without giving the new page access to the article.

#### Scenario: Another site
- **WHEN** a reader clicks a link to `https://example.org`
- **THEN** it opens in a new tab

#### Scenario: Another FOSTBeat article
- **WHEN** a reader clicks a link to `https://beat.joinfost.io/some-article`
- **THEN** it opens in the same tab

### Requirement: Link helper
Each field that takes links SHALL show how to write one and offer a **+ Link** button. The button SHALL wrap the selected words as link text and select a placeholder address to type over. With nothing selected, it SHALL insert placeholder link text and address.

#### Scenario: Wrapping selected words
- **WHEN** the ME selects "API guide" in a step description and presses + Link
- **THEN** the text becomes `[API guide](https://)` with `https://` selected

### Requirement: Links readable in every block
Links SHALL be underlined, SHALL meet WCAG 2.2 AA contrast on their block's background in the site's light and dark modes, and SHALL show a visible keyboard focus.

#### Scenario: Takeaways in dark mode
- **WHEN** a Key Takeaways point with a link is previewed in dark mode
- **THEN** the link is underlined and its text meets 4.5:1 contrast on the box background

### Requirement: Links kept as typed for editing and Strapi
The field values stored in the snippet and copied as Strapi JSON SHALL keep links in the `[text](address)` form.

#### Scenario: Editing a pasted block with a link
- **WHEN** the ME loads a pasted Into Action block whose step has a link
- **THEN** the step description field shows `[API guide](https://example.org/guide)` as typed
