# Prediction trackers

`prediction.html?t=<slug>` shows one prediction tracker: a yes/no question with
a deadline, its current probability and history, the key actors, and the
evidence an editor has approved. Embed it in a post with an iframe:

```html
<iframe src="https://mgboydcom.github.io/fost-beat/prediction-trackers/prediction.html?t=<slug>"
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

Everything for the trackers is in this folder; the two workflows are in `.github/workflows/` at the top of the repository. The specification format and scoring are described in [`trackers/README.md`](trackers/README.md).
Run either workflow by hand from **Actions** (the engine takes `score`, `research`
or `all`, and an optional tracker slug; intake has a dry-run option).

## Setup

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

For the FOSTBeat Strapi (v5) set `STRAPI_TAG_FIELD` = `categories`, `STRAPI_TAG_ATTRIBUTE` = `Title`,
`STRAPI_TITLE_FIELD` = `Title`, `STRAPI_BODY_FIELD` = `Content`, and `STRAPI_TAG_VALUE` to the
name of the category that marks ideas (matched without regard to case).

Also:

- Create a Google spreadsheet for the trackers and share it with the service
  account's email as **Editor**. The engine adds each tracker's tabs itself.
- Settings → Actions → General → Workflow permissions: allow **Read and write
  permissions** and tick **Allow GitHub Actions to create and approve pull requests**
  (intake opens pull requests).

A run with a missing secret or variable stops with a message naming it.

## Development

```bash
cd prediction-trackers
npm ci
npm test
```
