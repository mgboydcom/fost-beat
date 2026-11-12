# FOSTBeat data centre moratorium tracker

Tracks government actions that pause or ban new data centres, and shows them on a map in the
[FOSTBeat blog post](https://beat.joinfost.io/blog/data-center-moratorium-tracker).

```
n8n workflow (daily) ──> Google Sheet ──> map page (reads the sheet live)
                              │
                              └──> GitHub Action (hourly) ──> geocache.json
```

| Path | What it is |
|---|---|
| `moratorium-map.html` | The map page (Leaflet, OpenStreetMap tiles) |
| `geocache.json` | Saved coordinates for each place |
| `scripts/geocode.mjs` | Looks up new places; run hourly by `.github/workflows/geocode.yml` at the repo root |
| `n8n/data-centre-moratorium-tracker-gemini.n8n.json` | n8n workflow that finds news and adds rows to the sheet (import this) |
| `n8n/build_workflow.py` | Generates the workflow file; edit this, then rebuild |

## The sheet

[FOSTBeat data centre moratorium tracker](https://docs.google.com/spreadsheets/d/1Rcciv20Lippo6uRTu_Sk33c1Vul8lq2kcvz4NfkEdsk/edit),
tab `Moratoriums`, 15 columns filled by the workflow. New rows are marked `verified = no`;
the map labels those "(unverified)". Optional `lat` / `lng` columns override the lookup.

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

Runs daily at 07:00 Europe/Madrid:

1. Searches Google News RSS in 13 languages and markets, plus GDELT, for moratorium, ban,
   pause or freeze stories from the last 48 hours.
2. Reads the sheet and skips stories whose link or headline is already there, and actions
   already logged for the same place in the last 30 days.
3. Sends each remaining headline to Gemini (at most 60 per run, about 10 a minute to stay
   inside the free tier), which decides whether it is a real moratorium action and extracts
   place, level, dates, scope and summary.
4. Adds actions with confidence of at least 0.6 to the `Moratoriums` tab.
5. Emails a digest.

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

## History and decisions

- **11 Oct 2026:** map built. It was first a pasted HTML block, which failed because the blog
  doesn't run scripts in posts, so it became an iframe page on GitHub Pages. It moved from
  `fost-rego` to this repo. Locations were pre-computed with an hourly Action. CARTO tiles were
  replaced with OpenStreetMap tiles because CARTO now needs an API key. The map height was
  doubled.
- **6 Nov 2026:** new n8n account. Duplicate check against the sheet added. Claude was
  swapped for Gemini.
- **12 Nov 2026:** map work fully removed from `fost-rego`. The project moved into this folder.

## Open items

- The Gemini workflow has not yet run against the real Gemini API.
- The sheet was last changed on 23 Oct 2026, so no rows have been added since. Check that
  the workflow is imported and active in the new n8n account.
- Sheet link sharing should be **Viewer**, not Editor.
