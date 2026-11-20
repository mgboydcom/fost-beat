# Spec Delta

## ADDED Requirements

### Requirement: Newsletter images in the picker
The block picker SHALL show a second group, Newsletter images, after the blog blocks, holding Post thumbnail and In-email banner. Choosing one SHALL show an image preview with Download image and Copy alt text in place of Copy HTML, Copy Strapi JSON and Edit a pasted block.

#### Scenario: Switching to an image
- **WHEN** the ME picks Post thumbnail from the Newsletter images group
- **THEN** the form shows the thumbnail fields, and the output shows the image preview, Download image and Copy alt text, with no Copy HTML

#### Scenario: Back to a blog block
- **WHEN** the ME then picks Quote
- **THEN** the HTML preview, Copy HTML and Copy Strapi JSON return as before
