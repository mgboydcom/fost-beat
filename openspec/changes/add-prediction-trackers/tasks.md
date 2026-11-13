# Tasks

## 1. Tracker specification format

- [x] 1.1 Add `trackers/tracker.schema.json` defining the tracker specification (question, deadline, resolution criteria, base rate and reasoning, signal types with weights, actors, sources, Strapi entry id, status) and verify a hand-written sample validates and a sample missing resolution criteria fails
- [x] 1.2 Add `scripts/lib/tracker.mjs` with load-and-validate helpers (no npm dependencies, Node 22) and `node --test` tests covering valid, invalid and missing-file cases; verify `node --test scripts` passes
- [x] 1.3 Add `trackers/rejected.json` (empty list) and document the specification fields in `trackers/README.md`; verify the README example validates against the schema

## 2. Scoring and published data

- [x] 2.1 Implement scoring in `scripts/lib/score.mjs` (log-odds sum, 1%–99% bounds, resolved = 0%/100%) with tests for: no evidence equals base rate, repeat runs identical, bounds hold, resolution overrides; verify `node --test scripts` passes
- [x] 2.2 Implement history handling (new entry only when probability changes, entry lists causing evidence ids, awaiting-resolution after deadline) with tests; verify `node --test scripts` passes
- [x] 2.3 Implement writing `trackers/<slug>/data.json` containing only approved evidence and actors, with a test that proposed and rejected rows are excluded; verify `node --test scripts` passes

## 3. Google Sheets evidence store

- [ ] 3.1 Implement a minimal Sheets API client in `scripts/lib/sheets.mjs` (service-account JWT auth via `node:crypto`, read range, append rows, add tab) and verify against a test spreadsheet with a manual run that reads and appends a row
- [x] 3.2 Implement tab creation for a newly active tracker (`<slug> evidence`, `<slug> actors` with headers, actors filled from the specification) and verify running it twice creates the tabs only once
- [x] 3.3 Implement reading approved evidence and actors into the scoring input, with tests on fixture rows covering unknown status values and missing fields; verify `node --test scripts` passes

## 4. Research step

- [ ] 4.1 Implement `scripts/prediction-engine.mjs research` calling the Anthropic Messages API with web search and a JSON output schema, model taken from a repository variable; verify a manual run against the Section 1033 sample specification returns rows
- [x] 4.2 Implement validation and de-duplication of returned rows (source URL required, signal type from the specification, URL not already in the sheet in any status, unknown actors added as `proposed`) with fixture-based tests; verify `node --test scripts` passes
- [x] 4.3 Skip trackers that are resolved or past their deadline and print a run summary of proposed rows awaiting review per tracker; verify with a fixture tracker past its deadline

## 5. Engine workflow

- [ ] 5.1 Add `.github/workflows/prediction-engine.yml`: weekly research then scoring, daily scoring only, manual dispatch with optional slug, concurrency guard, commits changed `trackers/*/data.json` as the Actions bot; verify a manual dispatch completes and commits data for a test tracker
- [x] 5.2 Document required secrets (`ANTHROPIC_API_KEY`, `GOOGLE_SERVICE_ACCOUNT_JSON`) and variables (spreadsheet id, model name) in the README; verify the workflow fails with a clear message when a secret is missing

## 6. Strapi intake

- [x] 6.1 Implement the Strapi query in `scripts/prediction-intake.mjs` for v4 and v5 (drafts included, filtered by the configured tag or category field) with tests on recorded v4 and v5 response fixtures; verify `node --test scripts` passes
- [x] 6.2 Implement duplicate checks (existing specification, `trackers/rejected.json`, open `prediction/<entry-id>-*` branch) and recording closed-unmerged intake pull requests as rejected; verify with tests on fixture data
- [ ] 6.3 Implement drafting the specification with the AI model from the post title and body, schema validation, and the "needs editorial input" path for ideas without a binary question and deadline; verify with one clear and one vague fixture idea
- [ ] 6.4 Add `.github/workflows/prediction-intake.yml` (daily + manual) that creates the branch, commits the specification and opens the pull request; document the Strapi secrets (`STRAPI_URL`, `STRAPI_TOKEN`), `STRAPI_VERSION`, the tag setting and the "Allow GitHub Actions to create pull requests" requirement in the README; verify a manual dispatch with a test draft opens one pull request and a second dispatch opens none

## 7. Embed page

- [x] 7.1 Add `prediction.html` reading `trackers/<slug>/data.json` from `?t=<slug>` and showing question, deadline, resolution criteria, probability with last-updated date, actors and approved evidence with links, plus "not found" and resolved states; verify in a browser with fixture data for each state
- [x] 7.2 Add the inline SVG history chart and a short methodology note explaining the scoring; verify the chart renders for one-point and many-point histories
- [x] 7.3 Check phone width (360px, no horizontal scroll) and light/dark schemes, and document the iframe embed snippet in the README; verify with screenshots at 360px in both schemes

## 8. First tracker end to end

- [ ] 8.1 With secrets configured, tag a Strapi draft for the Section 1033 idea, run intake manually, review and merge the pull request; verify the specification is on `main` and the spreadsheet tabs exist after the next engine run
- [ ] 8.2 Run the engine manually, approve at least one proposed row, run scoring; verify `trackers/<slug>/data.json` updates and the embedded page shows the new probability and evidence

## Workflow follow-up

- Archive the change after the first tracker has run for one full weekly cycle.
