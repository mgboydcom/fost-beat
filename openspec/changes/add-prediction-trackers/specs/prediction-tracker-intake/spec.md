# Spec Delta

## Purpose

Turns a prediction idea written as a tagged Strapi draft post into a reviewed tracker specification, so new trackers start without code changes.

## ADDED Requirements

### Requirement: Detect prediction ideas in Strapi
The system SHALL check Strapi once a day for posts, including drafts, that carry the `prediction-idea` tag or category, and SHALL treat each such post as a candidate tracker.

#### Scenario: New tagged draft found
- **WHEN** the daily check runs and a draft post tagged `prediction-idea` exists that no tracker specification or open intake pull request references
- **THEN** the system starts drafting a tracker specification for that post

#### Scenario: Untagged posts ignored
- **WHEN** the daily check runs and a draft post has no `prediction-idea` tag or category
- **THEN** the system takes no action for that post

#### Scenario: Manual run
- **WHEN** a maintainer runs the intake workflow by hand
- **THEN** the system performs the same check immediately

### Requirement: Each idea creates at most one tracker
The system SHALL record the source Strapi entry identifier in each tracker specification and SHALL NOT start a second draft for an entry that already has a tracker specification or an open intake pull request.

#### Scenario: Idea already has a pending pull request
- **WHEN** the daily check finds a tagged post whose intake pull request is still open
- **THEN** the system does not open another pull request for it

#### Scenario: Idea already active
- **WHEN** the daily check finds a tagged post whose identifier appears in an existing tracker specification
- **THEN** the system does not draft a new specification for it

### Requirement: Draft tracker specification contents
The drafted specification SHALL contain a single binary question, a deadline, resolution criteria naming what counts as YES and NO and the source that decides it, a base-rate probability with its reasoning, key actors with stance and influence, signal types with weights, and sources to watch.

#### Scenario: Specification is complete
- **WHEN** a specification is drafted from an idea
- **THEN** every listed field is present and the specification passes schema validation before a pull request is opened

#### Scenario: Idea too vague to resolve
- **WHEN** the idea cannot be expressed as a binary question with a deadline
- **THEN** the system opens the pull request marked as needing editorial input and lists what is missing, instead of inventing a question

### Requirement: Editorial review before activation
The system SHALL open each drafted specification as a pull request, and a tracker SHALL become active only when that pull request is merged.

#### Scenario: Pull request merged
- **WHEN** an editor merges an intake pull request
- **THEN** the tracker is included in the next scheduled engine run and its evidence tabs exist in the trackers spreadsheet

#### Scenario: Pull request closed without merging
- **WHEN** an editor closes an intake pull request without merging
- **THEN** the tracker never becomes active, the entry is added to the list of rejected ideas, and the system opens no new pull request for it while it stays on that list
