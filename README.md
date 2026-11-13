# fost-beat

Embeds for the [FOSTBeat](https://beat.joinfost.io) blog, served with GitHub Pages.

## Data centre moratorium map

`moratorium-map.html` is a Leaflet map of the
[FOSTBeat data centre moratorium tracker](https://docs.google.com/spreadsheets/d/1Rcciv20Lippo6uRTu_Sk33c1Vul8lq2kcvz4NfkEdsk/edit?usp=sharing).
It reads the Google Sheet live on every page load (and every 10 minutes while open),
so new rows show up without redeploying.

Live at: https://mgboydcom.github.io/fost-beat/moratorium-map.html

The blog inserts post HTML with `innerHTML`, which never runs `<script>` tags, so embed the
map in a post with an iframe:

```html
<iframe src="https://mgboydcom.github.io/fost-beat/moratorium-map.html"
        title="Data centre moratorium map"
        style="width:100%;height:1100px;border:0" loading="lazy"></iframe>
```

## Locations

The sheet has no coordinates, so places (`jurisdiction` + `country`) are looked up with
OpenStreetMap Nominatim by `scripts/geocode.mjs` and saved in `geocache.json`. The
**Update map locations** GitHub Action runs it every hour and commits any new places, so
visitors' browsers don't have to look anything up. A row added since the last run is
looked up in the browser until the Action catches up.

To fix a wrong location, either edit its entry in `geocache.json` (keys are
`Jurisdiction|Country`, or just `Country` for national rows), or add `lat` / `lng`
columns to the sheet; those take priority.

To refresh locations right away: **Actions → Update map locations → Run workflow**.

## Prediction trackers

`prediction.html?t=<slug>` shows one prediction tracker: a yes/no question with
a deadline, its current probability and history, the key actors, and the
evidence an editor has approved. Embed it in a post with an iframe:

```html
<iframe src="https://mgboydcom.github.io/fost-beat/prediction.html?t=<slug>"
        title="Prediction tracker"
        style="width:100%;height:1200px;border:0" loading="lazy"></iframe>
```

How a tracker is born and kept up to date:

1. **Idea.** An editor writes a draft post in Strapi and tags it `prediction-idea`.
2. **Intake** (`.github/workflows/prediction-intake.yml`, daily). Drafts
   `trackers/<slug>/tracker.json` with the AI model and opens a pull request. Review
   the question and resolution criteria there; merging activates the tracker. Ideas
   too vague to resolve get a `[Needs input]` pull request listing what is missing.
   Closing a pull request without merging adds the idea to `trackers/rejected.json`.
3. **Research** (`.github/workflows/prediction-engine.yml`, Mondays). Finds new
   developments for each active tracker and adds them to the trackers spreadsheet as
   `proposed` rows, each with a source link.
4. **Review.** Editors set each row's `status` to `approved` or `rejected` in the
   spreadsheet (tabs `<slug> evidence` and `<slug> actors`). Only approved rows count.
5. **Score** (same workflow, daily). Recalculates the probability from the base rate
   and approved evidence and commits `trackers/<slug>/data.json`, which the page reads.
6. **Resolve.** When the outcome is known, edit `tracker.json`: set `status` to
   `resolved-yes` or `resolved-no` and add `outcome` (`date`, `source`).

The specification format and scoring are described in [`trackers/README.md`](trackers/README.md).
Run either workflow by hand from **Actions** (the engine takes `score`, `research`
or `all`, and an optional tracker slug; intake has a dry-run option).

### Setup

Repository **secrets** (Settings → Secrets and variables → Actions → Secrets):

| Secret | Used by | What |
|---|---|---|
| `ANTHROPIC_API_KEY` | intake, research | Anthropic API key |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | engine | JSON key of a Google service account |
| `STRAPI_TOKEN` | intake | Strapi API token with read access to posts (read-only is enough) |

Repository **variables** (same page → Variables):

| Variable | Required | What |
|---|---|---|
| `PREDICTION_MODEL` | yes | Claude model id used for drafting and research |
| `PREDICTION_SPREADSHEET_ID` | yes | Id of the trackers spreadsheet (from its URL) |
| `STRAPI_URL` | yes | Strapi base URL, e.g. `https://cms.example.org` |
| `STRAPI_VERSION` | no | `4` or `5` (default `5`) |
| `STRAPI_COLLECTION` | no | REST collection name (default `posts`) |
| `STRAPI_TAG_FIELD` / `STRAPI_TAG_ATTRIBUTE` | no | Relation holding the tag and its name field (default `tags` / `name`; use e.g. `category` / `slug` for a category) |
| `STRAPI_TAG_VALUE` | no | Tag that marks an idea (default `prediction-idea`, case-insensitive) |
| `STRAPI_TITLE_FIELD` / `STRAPI_BODY_FIELD` | no | Post fields read as the idea (default `title` / `content`) |
| `STRAPI_ADMIN_URL` / `STRAPI_CONTENT_TYPE` | no | For links to the idea in pull requests (default `STRAPI_URL` / `api::post.post`) |

Also:

- Create a Google spreadsheet for the trackers and share it with the service
  account's email as **Editor**. The engine adds each tracker's tabs itself.
- Settings → Actions → General → Workflow permissions: allow **Read and write
  permissions** and tick **Allow GitHub Actions to create and approve pull requests**
  (intake opens pull requests).

A run with a missing secret or variable stops with a message naming it.

### Development

```bash
npm ci
npm test
```
