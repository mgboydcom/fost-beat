# FOSTBeat data centre moratorium tracker

Tracks government actions that pause or ban new data centres, and shows them on a map in the
[FOSTBeat blog post](https://beat.joinfost.io/blog/data-center-moratorium-tracker).

```
news workflow (n8n, 2-day, 07:00) ──────────┐
                                            v
official sources workflow (n8n, 2-day, 09:00) ──> Google Sheet ──> map page (reads the sheet live)
  (adds rows and verifies existing ones)       │
                                               └──> GitHub Action (hourly) ──> geocache.json
```

| Path | What it is |
|---|---|
| `moratorium-map.html` | The map page (Leaflet, OpenStreetMap tiles) |
| `geocache.json` | Saved coordinates for each place |
| `scripts/geocode.mjs` | Looks up new places; run hourly by `.github/workflows/geocode.yml` at the repo root |
| `n8n/data-centre-moratorium-tracker-gemini.n8n.json` | n8n workflow that finds news and adds rows to the sheet (import this) |
| `n8n/build_workflow.py` | Generates the news workflow file; edit this, then rebuild |
| `n8n/data-centre-moratorium-official-sources.n8n.json` | n8n workflow that searches official government sources (import this) |
| `n8n/build_official_sources.py` | Generates the official sources workflow; shares the AI instructions with `build_workflow.py` |
| `n8n/tests/` | Tests for the official sources workflow, with recorded API responses |

## The sheet

[FOSTBeat data centre moratorium tracker](https://docs.google.com/spreadsheets/d/1Rcciv20Lippo6uRTu_Sk33c1Vul8lq2kcvz4NfkEdsk/edit),
tab `Moratoriums`. Optional `lat` / `lng` columns override the location lookup.

**Verification columns:**

| Column | Meaning |
|---|---|
| `verified` | `yes` or `no`. Rows from news start as `no`. |
| `verified_by` | `official`: confirmed by an official government record, set automatically by the official sources workflow. `person`: checked by a person; set this whenever you check or correct a row by hand, and the workflows will never change that row again. Blank on rows verified before 22 Nov 2026. |
| `official_source_url` | Link to the official record (council agenda item, bill page). |
| `stage` | Latest official step, for example "Policy Item: Agenda Ready" or a bill's latest action. |

The map shows each row as "(unverified)", "verified: official source" with a link to the record,
or "verified".

Tab `Legistar watch-list`: the US councils whose agendas the official sources workflow searches
(see below).

The sheet must stay readable by anyone with the link, because the map reads it from visitors'
browsers. It only needs **Viewer** access: with Editor access, anyone with the link can change
what the public map shows.

## Map

Live at: https://mgboydcom.github.io/fost-beat/moratorium-tracker/moratorium-map.html

The blog (Next.js with a Strapi backend) inserts post HTML with `innerHTML`, which never runs
`<script>` tags, so the map must be embedded with an iframe:

```html
<iframe src="https://mgboydcom.github.io/fost-beat/moratorium-tracker/moratorium-map.html"
        title="Data centre moratorium map"
        style="width:100%;height:1100px;border:0" loading="lazy"></iframe>
```

The map fills whatever height the iframe gives it. It reads the sheet on every page load and
every 10 minutes while open. Dots are coloured by `action_type` (adopted, proposed, extended,
lifted, rejected, ban; anything else is blue), with filter buttons and counts above the map.
Several actions in one place share one dot.
Only one copy of the world is shown (no repeats when panning or zooming out); the sea colour
and basemap softening are the `--fm-ocean` and `--fm-tiles` CSS variables at the top of the page.

The old address, `/fost-beat/moratorium-map.html`, redirects here.

## Locations

The sheet has no coordinates, so places (`jurisdiction` + `country`) are looked up with
OpenStreetMap Nominatim by `scripts/geocode.mjs` and saved in `geocache.json`. The
**Update map locations** GitHub Action runs it every hour and commits any new places. A row
added since the last run is looked up in the browser until the Action catches up.

To fix a wrong location, edit its entry in `geocache.json` (keys are `Jurisdiction|Country`,
or just `Country` for national rows), or fill in `lat` / `lng` in the sheet.
To refresh right away: **Actions → Update map locations → Run workflow**.

## n8n workflow

Runs every 2 days at 07:00 Europe/Madrid:

1. Searches Google News RSS in 13 languages and markets, plus GDELT, for moratorium, ban,
   pause or freeze stories from the last `lookbackHours` (72 by default; runs are 48 hours apart, and the overlap
   catches stories Google News lists late).
2. Reads the sheet and skips stories whose link or headline is already there, and actions
   already logged for the same place in the last 30 days.
3. Sends each remaining headline to Gemini (at most 60 per run, about 10 a minute to stay
   inside the free tier), which decides whether it is a real moratorium action and extracts
   place, level, dates, scope and summary.
4. Adds actions with confidence of at least 0.6 to the `Moratoriums` tab.
5. Emails a digest after every run, including a run report: headlines found, how many were
   sent to Gemini, and how many Gemini errors there were (with the first error message). An
   email saying "Gemini errors, nothing logged" usually means a wrong key or model name.

**Catching up after a gap:** a scheduled run only sees the last 72 hours. To fill a gap, keep
the workflow **inactive** and run it by hand once per week of the gap, with `fromDate` and
`toDate` in the Config node set to that week (`YYYY-MM-DD`; leave `toDate` empty for "until
now"). If the run report says some headlines were not checked because `maxItemsPerRun` was
reached, rerun that week as two shorter ranges. Rows already in the sheet are skipped, so
overlapping ranges are safe. Clear both dates before activating the workflow.

Gemini calls give up after 30 seconds and are retried once. A headline only counts as seen once
Gemini has answered for it, so headlines that hit an error are tried again on the next run.

The workflow file has no keys or passwords. The digest address is a placeholder,
`CHANGE-ME@example.com`, because this repo is public; set the real one in the **Config** node
after importing.

The original Claude (Anthropic API) version is in the FOSTBeat shared Drive as
`data-centre-moratorium-tracker.n8n.json`. It was replaced with Gemini when the Anthropic
credits ran out.

### Get a Gemini API key

A Google Workspace subscription covers Gemini inside Gmail, Docs and the Gemini app, but not
the Gemini API that n8n calls; the API is billed separately through Google Cloud. The free
tier should be enough for at most 60 headlines a day.

1. Go to https://aistudio.google.com and sign in with your Workspace account. If AI Studio is
   blocked for the account, a Workspace admin has to allow it in the Google Admin console.
2. Click **Get API key**, then **Create API key**. Choose an existing Google Cloud project or
   let AI Studio create one.
3. Copy the key and keep it out of this repo and the sheet.
4. Optional: to stop Google using the requests to improve its models (the free tier allows
   this; here the requests are only public news headlines), or if the free limits are hit,
   enable billing on that Google Cloud project. At this volume the cost should be very low.

### Set up the workflow in n8n

1. **Import:** in n8n, create a new workflow, open **⋯ → Import from File**, and pick
   `n8n/data-centre-moratorium-tracker-gemini.n8n.json`.
2. **Gemini key:** in **Classify with Gemini**, create a **Header Auth** credential with
   Name `x-goog-api-key` and Value set to the key.
3. **Google account:** connect it in **Read existing rows** and **Log to Google Sheet**
   (one credential works for both). Connect Gmail in **Email digest**.
4. **Config node:** replace `CHANGE-ME@example.com` with the digest address.
5. **Time zone:** in the workflow's **Settings**, confirm Europe/Madrid.
6. **Test:** click **Execute workflow**, then check the output of **Classify with Gemini**:
   - "model not found": copy a current Flash model name from AI Studio into `model` in
     the Config node (default `gemini-flash-latest`).
   - A run longer than the n8n plan allows: lower `maxItemsPerRun` in the Config node.
7. **Activate** the workflow, and deactivate any older copy so rows aren't added twice.

### Changing the workflow

Edit `n8n/build_workflow.py` (search terms, AI instructions, Config defaults), then rebuild:

```bash
cd moratorium-tracker/n8n && python3 build_workflow.py data-centre-moratorium-tracker-gemini.n8n.json
```

Re-import the file in n8n afterwards; credentials have to be reconnected on import.

## Official sources workflow

Runs every 2 days at 09:00 Madrid time, two hours after the news workflow so they don't compete
for Gemini quota. It searches:

| Source | Covers | Key |
|---|---|---|
| Legistar web API | Agendas of the US councils marked `active = yes` on the `Legistar watch-list` tab | none |
| GovInfo + Congress.gov | US federal bills, and each bill's latest action | free api.data.gov key (one key for both) |
| Open States | US state bills | free Open States key |

Records are sent to Gemini only if they mention data centres **and** a pause word (both patterns
are in the Config node), so contracts like "Airport Data Center Upgrade" are never classified.
Each confirmed action then either:
- **verifies the matching row**: same country, same place (for bills, the same bill number or
  at least two distinctive title words), same action type, dates within 120 days. The workflow
  sets `verified = yes`, `verified_by = official`, `official_source_url` and `stage`, and changes
  no other column;
- **adds a new row**, already verified, when nothing matches;
- or is **listed in the run report** when it matches more than one row, without changing any.

Rows with `verified_by = person` are never changed. An email after each run lists every source's
counts, the rows added and verified, ambiguous matches, and watch-list places that returned errors.

### Set it up in n8n

1. Get the keys: api.data.gov (api.data.gov/signup) and Open States (openstates.org, account
   page after signing up).
2. Import `n8n/data-centre-moratorium-official-sources.n8n.json`.
3. **GovInfo search** and **Congress.gov bills**: one *Query Auth* credential, Name `api_key`,
   Value the api.data.gov key.
4. **Open States search**: a *Header Auth* credential, Name `X-API-KEY`, Value the Open States key.
5. **Classify with Gemini** and **Classify again**: the news workflow's Gemini credential.
6. The six Google Sheets nodes: your Google account. In **Verify rows** and **Save watch-list
   errors**, check that *Column to match on* is `row_number`; n8n clears it whenever the Document
   is changed. **Email report**: Gmail.
7. **Config**: replace `CHANGE-ME@example.com` with the report address.
8. First run: set `fromDate` / `toDate` to one past week and run by hand; check each added or
   verified row against its link. Then clear the dates and switch the workflow to **Active**.

### The Legistar watch-list

Columns: `jurisdiction` (written exactly as in the `Moratoriums` tab, e.g. `Charlotte, NC`),
`country`, `legistar_client`, `active`, `last_error` (written by the workflow), `notes`.
Only rows with `active = yes` are searched. `check` means a person still has to confirm the client
name belongs to that place (several US places share names).

**To add a place:** find the council's Legistar site, usually `https://<client>.legistar.com`
(for Charlotte: `charlottenc.legistar.com`). The part before `.legistar.com` is the client name.
Check that `https://webapi.legistar.com/v1/<client>/bodies` returns a list rather than an error,
then add the row with `active = yes`. Many councils don't use Legistar, so their rows stay
`active = no`; they are still covered by the news workflow.

### Catch-up runs

As with the news workflow: keep the workflow inactive, set `fromDate` and `toDate` in Config,
run by hand, then clear both dates. If the report says records were not checked because
`maxItemsPerRun` was reached, rerun that range as two shorter ones.

### Changing it and testing

Edit `n8n/build_official_sources.py`, rebuild and run the tests:

```bash
cd moratorium-tracker/n8n && python3 build_official_sources.py data-centre-moratorium-official-sources.n8n.json && node tests/test_official_sources.js
```

The tests run the workflow's code with recorded Legistar, GovInfo and Congress.gov responses
(the Open States response is hand-written in its documented format) and check filtering,
matching, verification, retries and the report.

## History and decisions

- **11 Oct 2026:** map built. It was first a pasted HTML block, which failed because the blog
  doesn't run scripts in posts, so it became an iframe page on GitHub Pages. It moved from
  `fost-rego` to this repo. Locations were pre-computed with an hourly Action. CARTO tiles were
  replaced with OpenStreetMap tiles because CARTO now needs an API key. The map height was
  doubled.
- **6 Nov 2026:** new n8n account. Duplicate check against the sheet added. Claude was
  swapped for Gemini.
- **12 Nov 2026:** map work fully removed from `fost-rego`. The project moved into this folder.
- **14–16 Nov 2026:** catch-up from 23 Oct in date-range batches (free Gemini quota allowed
  roughly three batches a day); about 170 rows added. Runs moved to every 2 days, searching 72 hours.
- **21 Nov 2026:** map shows one world with a light-blue sea.
- **22 Nov 2026:** official sources workflow added (OpenSpec change
  `add-moratorium-official-sources`): verification columns, Legistar watch-list, automatic
  verification by official records.

## Open items

- The official sources workflow has been tested only in simulation. Its first by-hand run in n8n
  should confirm that the **Verify rows** step updates rows by `row_number` as expected.
- Four watch-list places are marked `check` (Appleton, Fulton County, Mooresville, San Marcos):
  confirm their client names belong to the right state, then set `active = yes`.
- Roundup rows such as "United States / United States" and duplicate rows (Australia, Fairfield)
  from the catch-up still need tidying by hand.
