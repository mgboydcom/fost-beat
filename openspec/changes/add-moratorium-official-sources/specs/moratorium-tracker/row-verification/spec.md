# Spec Delta

## Purpose

Defines when a moratorium tracker row counts as verified, verifies US rows automatically against official government sources, and records and shows who or what verified each row.

## ADDED Requirements

### Requirement: Verification fields
Each row SHALL have `verified` (yes or no), `verified_by` (`official`, `person` or blank), `official_source_url` and `stage`. A row from news only SHALL start with `verified = no` and `verified_by` blank. The news workflow SHALL keep working unchanged when these columns exist.

#### Scenario: News row added after the columns exist
- **WHEN** the news workflow adds a row
- **THEN** the row has `verified = no` and blank `verified_by`, `official_source_url` and `stage`

### Requirement: Automatic verification from official sources
On each run, the system SHALL check US rows with `verified = no` against the official source for their level: council agendas for watch-listed places, state bills for states, and federal bills for national rows. Where the AI step confirms an official record describes the same action, the row SHALL be set to `verified = yes` and `verified_by = official`, and `official_source_url` and `stage` SHALL be filled.

#### Scenario: Unverified row matched to an official record
- **GIVEN** an unverified row for Charlotte, NC, action `extended`, effective 2026-10-25
- **WHEN** the run finds a Charlotte agenda record for the moratorium extension dated within 60 days of that date
- **AND** the AI step confirms they describe the same action
- **THEN** the row becomes `verified = yes`, `verified_by = official`, with `official_source_url` set to the record's public page

#### Scenario: Official record found but for a different action
- **WHEN** the only official record for the place describes a different action (for example a hearing about a different ordinance)
- **THEN** the row stays `verified = no`

#### Scenario: Place without an official source
- **WHEN** an unverified row's place is outside the US, or is a US city not on the watch-list
- **THEN** the row is left unchanged

### Requirement: Rows verified by a person are never overwritten
The system SHALL NOT change `verified`, `verified_by` or any other field of a row whose `verified_by` is `person`. It SHALL NOT set any row back to `verified = no`.

#### Scenario: Person-verified row
- **GIVEN** a row with `verified = yes` and `verified_by = person`
- **WHEN** an official record for the same place is found
- **THEN** the row is not modified

### Requirement: Verification shown on the map
A dot's popup SHALL show, for each row, either "(unverified)", "verified: official source" with a link to `official_source_url`, or "verified". It SHALL show the `stage` when filled. Rows with `verified = yes` and blank `verified_by` (verified before this change) SHALL show "verified".

#### Scenario: Officially verified row on the map
- **WHEN** a reader opens the popup of a row with `verified_by = official`
- **THEN** it shows "verified: official source", a link to the official record and the stage
