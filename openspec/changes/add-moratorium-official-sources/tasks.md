# Tasks

## 1. Shared code and sheet setup

- [ ] 1.1 Guard the file-writing code in `moratorium-tracker/n8n/build_workflow.py` with `if __name__ == "__main__"`. Verify that rebuilding the news workflow gives a JSON file identical to the committed one apart from node IDs (compare nodes, parameters and connections).
- [ ] 1.2 Add `official_source_url`, `verified_by` and `stage` columns to the end of the `Moratoriums` tab. Verify by reading the header row through the Sheets connector, and confirm the live map still loads all rows.
- [ ] 1.3 Create the `Legistar watch-list` tab with columns `jurisdiction`, `country`, `legistar_client`, `active`, `last_error` and `notes`. Verify the header row through the Sheets connector.
- [ ] 1.4 Seed the watch-list. For each US city and county in the sheet, try likely Legistar client names against `webapi.legistar.com/v1/{client}/matters?$top=1`, and add the working ones with `active = yes`. Verify Charlotte (`charlottenc`) is present, and record in `notes` the places that have no working client name.

## 2. Official source search

- [ ] 2.1 Write `moratorium-tracker/n8n/build_official_sources.py` with the Config node: window (`fromDate` / `toDate`, default the last 72 hours), keyword lists and `maxItemsPerRun`. Add a schedule trigger every 2 days at 09:00 Madrid time. Verify the generated JSON parses and every Code node compiles (`node` syntax check, as for the news workflow).
- [ ] 2.2 Add the Legistar branch: read the watch-list, request matters for each active client with the date and title filters, and record client errors without stopping the run. Verify with a simulation using the saved Charlotte response: the moratorium matters pass, and the airport contract matter is dropped at the keyword gate.
- [ ] 2.3 Add the Open States branch (one search over all states, updated within the window). Verify with a simulation using a recorded or hand-made response that a state bill is normalised to `level = state` with its latest action as `stage`.
- [ ] 2.4 Add the GovInfo branch (collection BILLS, published within the window) and the Congress.gov latest-action lookup. Verify against the live API using the api.data.gov demo key that "Artificial Intelligence Data Center Moratorium Act" is returned for a window covering 24 Jun 2026.
- [ ] 2.5 Add the normalise step and the keyword gate, which outputs `{source, place, country, level, title, body, date, stage, url}` with public record links as in design.md decision 6. Verify that simulated records from all three branches come out in this shape.

## 3. Classification, matching and sheet writes

- [ ] 3.1 Add the Gemini step reusing `SYSTEM_PROMPT` and `GEMINI_BODY` from `build_workflow.py`, with Google's own error message kept, a 30 s timeout and one retry for 5xx errors. Verify with simulated replies that rejected records are dropped and errors are counted.
- [ ] 3.2 Add the matching step (design.md decision 4). Skip rows with `verified_by = person`; when several rows match, update none and list the case in the report. Verify with simulations: a single match updates one row; no match appends a row; a person-verified row is untouched; an ambiguous match updates nothing and is reported.
- [ ] 3.3 Add the append branch for new rows (`found_via` set to the source, `verified = yes`, `verified_by = official`) and the update branch keyed on `row_number`. The update writes only the four verification columns, after checking that `headline` and `country` are unchanged. Verify in a by-hand n8n run against a copy of the sheet that only those columns change.
- [ ] 3.4 Add the run report email: per source, records found, after the keyword gate, confirmed, rows added, rows verified and errors, plus the first error and any ambiguous matches. Verify with a simulated zero-result run that an email with all counts is produced.

## 4. Map and documentation

- [ ] 4.1 Update `moratorium-tracker/moratorium-map.html` popups to show "(unverified)", "verified: official source" with a link, or "verified", plus `stage` when filled. Verify with a local render using rows of each kind, including an old `verified = yes` row with blank `verified_by`.
- [ ] 4.2 Update `moratorium-tracker/README.md` with:
  - the official sources;
  - the new columns and what `verified_by` means;
  - how to add a place to the watch-list and find its Legistar client name;
  - the credentials needed (Open States key, api.data.gov key);
  - catch-up runs.

  Verify the client-name lookup instructions work for Charlotte.

## 5. Rollout

- [ ] 5.1 Import the generated workflow into n8n and run it by hand for one past week. Verify each row it added or verified against the linked official record, and confirm the run report email arrived.
- [ ] 5.2 Run catch-up batches back to 23 Oct 2026, then activate the schedule. Verify the next scheduled run's report email shows no source errors other than known watch-list failures.

## Workflow follow-up

- Merge the branch to `main` so GitHub Pages publishes the map popup change.
- Archive the change after review.
