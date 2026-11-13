# Spec Delta

## Purpose

Calculates each tracker's probability from its base rate and approved evidence in a deterministic, explainable way, and keeps a dated history of it.

## ADDED Requirements

### Requirement: Deterministic probability
A tracker's probability SHALL be calculated only from its specification's base rate, signal weights and actor influence, and its approved evidence, so that the same inputs always give the same probability.

#### Scenario: Repeat calculation
- **WHEN** scoring runs twice with no change to the specification or approved evidence
- **THEN** both runs give the same probability

#### Scenario: No approved evidence
- **WHEN** a tracker has no approved evidence
- **THEN** its probability equals its base rate

### Requirement: Probability bounds
The calculated probability SHALL stay between 1% and 99% until the tracker is resolved.

#### Scenario: Strong one-sided evidence
- **WHEN** approved evidence would push the probability beyond 99% or below 1%
- **THEN** the published probability is 99% or 1% respectively

### Requirement: Traceable changes
Each scoring run that changes the probability SHALL record the date, the new probability and the evidence rows that caused the change.

#### Scenario: Evidence approved
- **WHEN** a newly approved row changes the probability
- **THEN** the history gains an entry with the date, the new probability and that row's reference

#### Scenario: No change
- **WHEN** a scoring run gives the same probability as the last history entry
- **THEN** no new history entry is added

### Requirement: Resolution
When an editor marks a tracker resolved as YES or NO, its probability SHALL become 100% or 0% respectively and SHALL no longer change.

#### Scenario: Tracker resolved
- **WHEN** an editor marks the tracker resolved with an outcome and a source
- **THEN** the final history entry shows the outcome and the source, and later runs leave it unchanged

#### Scenario: Deadline passes unresolved
- **WHEN** the deadline passes and no editor has marked the tracker resolved
- **THEN** the tracker is flagged as awaiting resolution and research stops
