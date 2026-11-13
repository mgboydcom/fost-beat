# Proposal

## Why

FOSTBeat wants to publish prediction trackers: a dated, resolvable question about a policy outcome, with a probability that moves as evidence comes in, and the evidence behind it shown alongside. The first is whether Section 1033 (the US personal financial data rights provision of the Dodd-Frank Act) becomes law by the end of 2027. Further subjects will come from the editorial team as ideas, so adding a tracker must not require new code each time: an idea written in Strapi should be enough to start one.

## What Changes

- A daily GitHub Action reads Strapi for draft posts tagged `prediction-idea` that have no tracker yet, and drafts a tracker specification for each (question, resolution criteria, deadline, base rate, key actors, signal types, sources to watch). The draft is opened as a pull request for editorial review; merging it activates the tracker.
- One shared engine runs every active tracker on a schedule. Its research step uses an AI model with web search to find new developments and adds them to the tracker's Google Sheet as **proposed** evidence, each with a source link.
- Editors approve or reject proposed evidence in the sheet. Only approved evidence affects the probability.
- A deterministic scoring step turns the base rate plus approved evidence into a probability, and records it in a dated history so every change can be traced to the evidence that caused it.
- Each tracker gets an embeddable page (served by GitHub Pages, like the moratorium map) showing the question, the current probability and its history, the key actors, and the approved evidence log.
- The Section 1033 tracker is created as the first tracker, through the same intake path.

## Capabilities

### New Capabilities

- `prediction-tracker-intake`: Detecting prediction ideas in Strapi and turning each into a reviewed, activated tracker specification.
- `prediction-evidence`: Gathering proposed evidence for active trackers and the editorial approval of that evidence in Google Sheets.
- `prediction-scoring`: Calculating a tracker's probability from its base rate and approved evidence, and keeping its history.
- `prediction-embed`: The public, embeddable page for each tracker.

### Modified Capabilities

None. The moratorium map is unchanged.

## Impact

- New files in this repo: tracker specifications, engine scripts, generated per-tracker JSON, an embed page, and GitHub Actions workflows.
- New repository secrets: a Strapi URL and read-only API token, an AI provider API key, and Google service-account credentials with edit access to the trackers spreadsheet.
- Repository setting: GitHub Actions must be allowed to create pull requests.
- Strapi: editors use a `prediction-idea` tag (or category) on draft posts. No content-model change.
- Google Sheets: a new spreadsheet for tracker evidence, shared with the service account.
- Running cost: one AI research call per active tracker per scheduled run, plus one per new idea.
