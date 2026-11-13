# Spec Delta

## Purpose

Gathers new developments for each active tracker as proposed evidence and lets editors approve or reject it before it can affect a probability.

## ADDED Requirements

### Requirement: Scheduled research for active trackers
The system SHALL, on a weekly schedule and on manual request, search for developments since the tracker's last run for every active tracker that has not passed its deadline.

#### Scenario: Weekly run
- **WHEN** the weekly engine run starts
- **THEN** each active, unresolved tracker is researched once

#### Scenario: Resolved tracker skipped
- **WHEN** a tracker has been marked resolved
- **THEN** the system does not research it

### Requirement: Proposed evidence rows
Each development found SHALL be added to the tracker's evidence tab in the trackers spreadsheet with status `proposed`, a date, a source URL, the actor involved, a signal type from the tracker specification, a direction (towards YES or towards NO) and a one-sentence summary.

#### Scenario: Development with a source
- **WHEN** research finds a development with a source URL
- **THEN** a row with status `proposed` and all listed fields is added to the evidence tab

#### Scenario: No source
- **WHEN** research returns a development without a source URL
- **THEN** the system does not add it

#### Scenario: Duplicate source
- **WHEN** a development's source URL already appears in the tracker's evidence tab
- **THEN** the system does not add it again

### Requirement: Editorial approval
Only evidence rows whose status an editor has set to `approved` SHALL be used for scoring. Rows with any other status SHALL be ignored by scoring and SHALL NOT be shown on the public page.

#### Scenario: Editor approves a row
- **WHEN** an editor sets a row's status to `approved`
- **THEN** the row is included in the next scoring run

#### Scenario: Editor rejects a row
- **WHEN** an editor sets a row's status to `rejected`
- **THEN** the row is never scored or published, and research does not propose the same source again

#### Scenario: Editor adds evidence by hand
- **WHEN** an editor adds a row directly with status `approved` and all required fields
- **THEN** it is treated the same as approved research evidence

### Requirement: Actor register
Each tracker SHALL have an actors tab listing each key actor's name, role, stance towards the outcome, and influence, which editors can edit.

#### Scenario: Tracker activated
- **WHEN** a tracker becomes active
- **THEN** its actors tab is filled from the actors in its specification

#### Scenario: New actor proposed
- **WHEN** research finds an influential actor not in the register
- **THEN** the actor is added with status `proposed` and does not affect scoring until approved
