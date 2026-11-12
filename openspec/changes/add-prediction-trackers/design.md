# Design

## Context

This repo serves embeds for the FOSTBeat blog through GitHub Pages. The existing moratorium map sets the pattern: a public Google Sheet is the editorial source, a scheduled GitHub Action (`.github/workflows/geocode.yml`) runs a Node script (`scripts/geocode.mjs`, Node 22, no dependencies) that commits generated data (`geocache.json`) back to `main`, and a static HTML page reads that data. The blog inserts post HTML with `innerHTML`, so embeds must be iframes.

Strapi is the blog's CMS. Its URL, version (v4 or v5) and the tag or category field used on posts are not recorded in this repo and must be supplied as configuration.

Decisions already made with the editor: evidence lives in Google Sheets; AI research only proposes evidence and an editor approves it; Strapi is checked once a day by polling; ideas are ordinary draft posts with a `prediction-idea` tag or category.

## Goals / Non-Goals

**Goals:**
- One engine and one page template serve every tracker; adding a tracker adds data, not code.
- Every published probability can be traced to approved evidence and a fixed formula.
- Running cost and upkeep stay at the level of the moratorium map: GitHub Actions, one spreadsheet, no servers.

**Non-Goals:**
- Real-time updates. Daily intake and weekly research are enough for legislative timescales.
- Writing back into Strapi posts. Editors paste the embed iframe into the post themselves.
- Market-style forecasting with crowd input, or trading probabilities.
- Creating any tracker other than Section 1033 as part of this change. Others come only from editors' ideas in Strapi.

## Decisions

### 1. Tracker specification as a file in the repo
Each tracker is `trackers/<slug>/tracker.json`: question, deadline, resolution criteria, base rate and its reasoning, signal types with weights, actors (name, role, stance −2…+2, influence 1–5), sources and search queries, the source Strapi entry identifier, and status (`active`, `awaiting-resolution`, `resolved-yes`, `resolved-no`). A JSON Schema at `trackers/tracker.schema.json` validates it.

*Why:* the specification is the part most worth reviewing (question wording and resolution criteria), and a pull request gives that review and its history for free. *Alternative:* keeping specifications in the sheet — rejected because there is no review step and wording changes would silently change what is being predicted.

### 2. Intake: daily poll of Strapi, pull request per idea
`.github/workflows/prediction-intake.yml` runs daily and on manual dispatch. `scripts/prediction-intake.mjs` queries the Strapi REST API for posts (drafts included) carrying the configured tag, skips any entry whose identifier appears in a tracker specification, in `trackers/rejected.json`, or in an open branch named `prediction/<entry-id>-<slug>`. For each new entry it asks the AI model, with web search, to draft the specification from the post's title and body, validates it against the schema, writes it on a new branch and opens a pull request. Strapi v4 and v5 differ in how drafts are requested (`publicationState=preview` vs `status=draft`); the script supports both, selected by a `STRAPI_VERSION` setting.

*Why daily polling:* chosen by the editor; no relay service to run. *Alternative:* Strapi webhook through a Cloudflare Worker — faster but adds a service.

Closed-unmerged intake pull requests are detected on the next run and the entry is appended to `trackers/rejected.json` in a commit to `main`.

### 3. Evidence in one Google spreadsheet, two tabs per tracker
One spreadsheet, "FOSTBeat prediction trackers", with tabs `<slug> evidence` and `<slug> actors`. Evidence columns: `id`, `date`, `status` (`proposed` / `approved` / `rejected`), `signal_type`, `direction` (`yes` / `no`), `actor`, `summary`, `source_url`, `added_by` (`research` / editor name), `added_on`. Actor columns: `name`, `role`, `stance`, `influence`, `status`, `notes`.

The engine writes through the Google Sheets API using a service account (`GOOGLE_SERVICE_ACCOUNT_JSON` secret); the spreadsheet is shared with that account as editor. Tabs for a tracker are created by the engine the first time it runs after the tracker becomes active.

*Why one spreadsheet:* editors have one place to review all proposed rows; a service account cannot easily create spreadsheets in a shared drive without extra setup. *Alternative:* the public `gviz` read used by the moratorium map — rejected because the engine must write rows.

### 4. Research with an AI model and web search, structured output
`scripts/prediction-engine.mjs research` calls the Anthropic Messages API with the server-side web search tool and a JSON output schema. The prompt includes the tracker specification, the date of the last run, and the source URLs already in the sheet (approved, proposed and rejected) so it does not repeat them. Returned rows are validated (required fields, `signal_type` from the specification, URL present and not already used) before being appended with status `proposed`. The model name is a repository variable so it can be changed without code changes. Requires the `ANTHROPIC_API_KEY` secret.

*Why structured output and validation:* the AI's output is untrusted input to an editorial sheet; validation stops malformed or sourceless rows from reaching editors.

### 5. Scoring: log-odds sum, fixed weights
`p = clamp(sigmoid(logit(base_rate) + Σ contribution), 0.01, 0.99)`, where each approved evidence row contributes `direction × signal_weight × actor_factor`. `signal_weight` comes from the tracker specification (for example, a committee vote weighs more than a public statement); `actor_factor` is the actor's approved influence divided by 3 (1 when the actor is unknown). No time decay in the first version.

*Why:* log-odds addition is easy to explain ("this vote added about 8 points"), symmetric, and never exceeds the bounds. *Alternative:* asking the AI for a probability — rejected because it is not reproducible or traceable.

Scoring writes `trackers/<slug>/data.json`: specification fields for display, current probability, `updated` date, history entries (`date`, `p`, `evidence_ids`), approved actors and approved evidence. It runs after research, and also daily on its own so that editor approvals show within a day without a new research run.

### 6. Workflows
- `prediction-intake.yml`: daily + manual.
- `prediction-engine.yml`: weekly research then scoring; daily scoring only; manual dispatch with an optional tracker slug. Commits changed `trackers/*/data.json` to `main` with the same bot identity and concurrency guard as `geocode.yml`.

### 7. Embed page
`prediction.html?t=<slug>` is one static page that fetches `trackers/<slug>/data.json` and renders the question, probability, history chart, actors and evidence. It uses inline SVG for the chart (no chart library), CSS colour variables with a dark-mode override, and a responsive layout. Embed with:

```html
<iframe src="https://mgboydcom.github.io/fost-beat/prediction.html?t=section-1033-law-2027"
        title="Section 1033 prediction tracker" style="width:100%;height:1200px;border:0" loading="lazy"></iframe>
```

### 8. First tracker through the normal path
The Section 1033 tracker is created by an editor tagging a Strapi draft post `prediction-idea`, so the first run exercises intake end to end. Its question is drafted by the intake step and reviewed in the pull request like any other.

## Risks / Trade-offs

- [AI research misses developments or proposes weak ones] → Editors can add approved rows by hand; nothing scores without approval; rejected URLs are never proposed again.
- [Weights are subjective] → Weights live in the reviewed specification, are shown on the page's methodology note, and every change is visible in Git history.
- [Editors fall behind on approvals and the probability goes stale] → The page shows the "last updated" date; the engine run summary lists the count of proposed rows awaiting review per tracker.
- [Strapi API differences or token scope] → Version is configured explicitly; a read-only token is used; the intake run fails loudly with the HTTP status rather than skipping silently.
- [Secrets exposure] → Secrets are only used in the Actions, never in the static page; the page reads committed JSON only.
- [GitHub Actions cannot open pull requests by default] → Repository setting "Allow GitHub Actions to create and approve pull requests" must be enabled; documented in the README.
- [API cost grows with trackers] → One research call per active tracker per week, with a search-use cap per call.

## Migration Plan

Additive only. Deploy by merging the change, adding the secrets and variables, sharing the spreadsheet with the service account, and tagging the Section 1033 draft. Rollback: disable the two workflows; existing pages keep showing their last committed data.

## Open Questions

- The exact Strapi field name for the tag or category, and the Strapi version. Supplied as configuration; does not change the design.
- The display name of the spreadsheet and who besides the service account has edit access.
