# Spec Delta

## Purpose

Provides a public page for each tracker that the FOSTBeat blog can embed with an iframe, showing the probability, its history and the evidence behind it.

## ADDED Requirements

### Requirement: One embeddable page per tracker
Each active or resolved tracker SHALL have a public page on GitHub Pages, addressed by the tracker's slug, that works inside an iframe and does not depend on scripts in the host page.

#### Scenario: Embedded in a post
- **WHEN** a post includes an iframe pointing at a tracker's page
- **THEN** the page renders inside the post

#### Scenario: Unknown slug
- **WHEN** the page is requested with a slug that has no tracker
- **THEN** the page shows a clear "tracker not found" message

### Requirement: Page contents
The page SHALL show the question, the deadline, the resolution criteria, the current probability with the date it was last updated, a chart of the probability history, the key actors, and the approved evidence with source links.

#### Scenario: Active tracker
- **WHEN** a reader opens an active tracker's page
- **THEN** all listed items are visible, and no proposed or rejected evidence appears

#### Scenario: Resolved tracker
- **WHEN** a reader opens a resolved tracker's page
- **THEN** the page states the outcome and its source in place of a live probability

### Requirement: Readable on phones and in both colour schemes
The page SHALL be usable at phone width without horizontal scrolling and SHALL be legible in light and dark colour schemes.

#### Scenario: Phone width
- **WHEN** the page is shown 360 pixels wide
- **THEN** all content fits without horizontal scrolling
