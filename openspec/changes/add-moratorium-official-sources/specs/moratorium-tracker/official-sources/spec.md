# Spec Delta

## Purpose

Finds data centre moratorium actions in official US government sources (council agendas, state bills and federal bills) and adds them to the tracker sheet, so actions are captured even when the news does not cover them.

## ADDED Requirements

### Requirement: Scheduled search of official sources
The system SHALL search the official sources every 2 days, covering at least the period since the previous run plus a one-day overlap. It SHALL support a by-hand run over a given date range, for catch-up after a gap.

#### Scenario: Scheduled run
- **WHEN** the scheduled run starts
- **THEN** each official source is searched for records dated within the last 3 days

#### Scenario: Catch-up run for a date range
- **WHEN** a person sets a start and end date and runs the workflow by hand
- **THEN** each official source is searched for records dated within that range only

### Requirement: Council agendas for watch-listed places
The system SHALL search the Legistar agenda records of every active place on the `Legistar watch-list` tab. It SHALL match records whose title mentions data centres or data storage facilities. Places SHALL be added or switched off by editing the tab, with no code change.

#### Scenario: Watch-listed city has a matching agenda item
- **GIVEN** Charlotte, NC is active on the watch-list with client name `charlottenc`
- **WHEN** an agenda item titled "Extension of the Temporary Moratorium on New Telecommunications and Data Storage Facilities" falls within the search period
- **THEN** that item is treated as a candidate moratorium record for Charlotte, NC

#### Scenario: Place switched off
- **WHEN** a place's `active` value on the watch-list is not `yes`
- **THEN** that place's agenda records are not searched

#### Scenario: Watch-list client name no longer works
- **WHEN** the agenda source returns an error for a place's client name
- **THEN** the run continues with the other places and the run report names the place and the error

### Requirement: State and federal bills
The system SHALL search US state bills and US federal bills for data centre moratorium, ban or pause measures introduced or acted on within the search period.

#### Scenario: State bill found
- **WHEN** a state bill proposing a pause on new data centres has an action within the search period
- **THEN** it is treated as a candidate record for that state, with its latest action as the stage

#### Scenario: Federal bill found
- **WHEN** a federal bill such as an "Artificial Intelligence Data Center Moratorium Act" is introduced or acted on within the search period
- **THEN** it is treated as a candidate record for the United States at national level, with its latest action as the stage

### Requirement: AI confirmation of official records
Every candidate record SHALL be confirmed as a moratorium action by the same AI classification used for news, given the record's title, body and stage. Only records it confirms at or above the confidence threshold SHALL produce or verify rows.

#### Scenario: Unrelated record from an official source
- **WHEN** a council record titled "Airport Main Data Center Utilities Upgrade Design Contract" is a candidate
- **THEN** the AI step rejects it and no row is added or verified

### Requirement: New rows from official records
For a confirmed record that matches no existing row, the system SHALL add a row with the tracker's existing columns. It SHALL set `found_via` to the source name, `verified` to `yes`, `verified_by` to `official`, and fill `official_source_url` and `stage`.

#### Scenario: New action found only in an official source
- **WHEN** a confirmed record describes an action not yet in the sheet
- **THEN** a new row is added with `found_via` set to the source (for example `legistar`), `verified = yes` and `verified_by = official`

### Requirement: No duplicate rows for the same action
A confirmed record SHALL be treated as matching an existing row when country, jurisdiction and action type match and the row was logged within the previous 120 days. A matching record SHALL update that row rather than add a new one.

#### Scenario: Official record for an action already found in the news
- **GIVEN** the sheet has an unverified news row for Charlotte, NC with action type `extended`
- **WHEN** a confirmed Charlotte agenda record for the same extension is found
- **THEN** no new row is added and the existing row is verified as described in the row-verification capability

### Requirement: Run report for official sources
Each run SHALL email a report to the tracker's digest address. It SHALL give, for each source: records found, confirmed actions, rows added, rows verified, and errors, with the first error message.

#### Scenario: Run with no new actions
- **WHEN** a run finds no confirmed actions
- **THEN** an email is still sent, stating zero rows added and listing each source's counts and errors
