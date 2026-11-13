"""Builds the Gemini version of the data centre moratorium tracker n8n workflow.

Usage: python3 build_workflow.py data-centre-moratorium-tracker-gemini.n8n.json
"""
import json, sys, uuid

SHEET_URL = "https://docs.google.com/spreadsheets/d/1Rcciv20Lippo6uRTu_Sk33c1Vul8lq2kcvz4NfkEdsk/edit"

def nid():
    return str(uuid.uuid4())

SETUP_NOTE = """## Data centre moratorium tracker (Gemini) — setup

1. **Config** node: replace `CHANGE-ME@example.com` with the address that should get the daily digest. `model` is the Gemini model; if the test run says the model isn't found, copy a current model name from Google AI Studio.
2. **Classify with Gemini**: create a *Header Auth* credential. Name: `x-goog-api-key`, Value: your Gemini API key (aistudio.google.com → Get API key).
3. **Read existing rows** and **Log to Google Sheet**: connect your Google account (same credential for both). The sheet is already set.
4. **Email digest**: connect Gmail.
5. Click **Execute workflow** once to test, then toggle the workflow **Active**.

Runs daily at 07:00 Madrid time. Headlines go to Gemini one at a time (about 10 a minute) to stay inside the free tier's rate limit, so a full run takes up to ~7 minutes.
Rows already in the sheet are never added again, even after moving to a new n8n account.

An email is sent after every run with a run report (headlines found, sent to Gemini, Gemini errors). To catch up after a gap, set `lookbackHours` in Config to e.g. 504 (21 days) and raise `maxItemsPerRun`, run once, then set them back."""

SYSTEM_PROMPT = (
    "You classify news items for a tracker of government actions that restrict new data centre construction anywhere in the world.\n\n"
    "Return ONLY a JSON object, with no prose and no code fences.\n\n"
    "COUNT as a moratorium action: a government body, regulator, planning authority or grid operator adopting, proposing, extending, lifting or rejecting a moratorium, ban, pause, freeze, or blanket refusal of new data centre permits or grid connections. Votes by residents on a ban also count.\n\n"
    "DO NOT count: opinion pieces or analysis with no specific new action; the rejection of a single project; bans that only cover crypto mining; general energy or efficiency rules that do not pause development; articles that only recap older actions with no new development.\n\n"
    "Schema:\n{\n"
    '  "is_moratorium_action": boolean,\n'
    '  "action_type": "adopted" | "proposed" | "extended" | "lifted" | "rejected" | "ban" | "other",\n'
    "  \"jurisdiction\": string (US places as 'City, ST' or 'County Name, ST' with the two-letter state code, e.g. 'Manatee County, FL'; US states by full name; elsewhere the official name of the place or body),\n"
    '  "level": "city" | "county" | "region" | "state" | "national" | "grid_operator",\n'
    '  "country": string (English name),\n'
    "  \"scope\": string (what is paused, e.g. 'new data centres over 50 MW', or '' if unknown),\n"
    '  "effective_date": string or null (YYYY-MM-DD),\n'
    '  "expiry": string or null,\n'
    "  \"summary\": string (start with 'Status: active.', 'Status: proposed.', 'Status: rejected.', 'Status: lifted.' or 'Status: expired.', then one sentence in English),\n"
    '  "confidence": number between 0 and 1\n}\n\n'
    "If the item is not in English, write every field in English. If is_moratorium_action is false, the other fields can be empty strings or null."
)

CONFIG_CODE = """return [{ json: {
  // ---- EDIT THESE ----
  notifyEmail: 'CHANGE-ME@example.com', // replace with the address that should get the daily digest
  lookbackHours: 48,          // how far back to search. For a one-off catch-up run set e.g. 504 (21 days), then set back to 48
  maxItemsPerRun: 60,         // cap on items sent to Gemini per run (stays well inside free-tier daily limits)
  confidenceThreshold: 0.6,   // minimum classifier confidence to log an action
  model: 'gemini-flash-latest', // any Gemini model name from Google AI Studio
  // --------------------
  systemPrompt: %s
} }];""" % json.dumps(SYSTEM_PROMPT)

FEEDS_CODE = r"""// One Google News RSS search per language/market. Add or remove rows freely.
const feeds = [
  { lang: 'en-US', hl: 'en-US', gl: 'US', ceid: 'US:en', q: '("data center" OR "data centre" OR datacenter) (moratorium OR ban OR pause OR freeze)' },
  { lang: 'en-IE', hl: 'en-IE', gl: 'IE', ceid: 'IE:en', q: '("data centre" OR "data center") (moratorium OR ban OR pause OR freeze)' },
  { lang: 'en-GB', hl: 'en-GB', gl: 'GB', ceid: 'GB:en', q: '("data centre" OR "data center") (moratorium OR ban OR pause OR freeze)' },
  { lang: 'en-AU', hl: 'en-AU', gl: 'AU', ceid: 'AU:en', q: '("data centre" OR "data center") (moratorium OR ban OR pause OR freeze)' },
  { lang: 'en-SG', hl: 'en-SG', gl: 'SG', ceid: 'SG:en', q: '("data centre" OR "data center") (moratorium OR ban OR pause OR freeze)' },
  { lang: 'nl',    hl: 'nl',    gl: 'NL', ceid: 'NL:nl', q: '(datacenter OR datacentrum OR datacenters) (moratorium OR bouwstop OR verbod)' },
  { lang: 'de',    hl: 'de',    gl: 'DE', ceid: 'DE:de', q: '(Rechenzentrum OR Rechenzentren) (Moratorium OR Baustopp OR Verbot)' },
  { lang: 'fr',    hl: 'fr',    gl: 'FR', ceid: 'FR:fr', q: '("centre de données" OR "centres de données" OR datacenter) (moratoire OR interdiction OR suspension)' },
  { lang: 'es',    hl: 'es',    gl: 'ES', ceid: 'ES:es', q: '("centro de datos" OR "centros de datos") (moratoria OR prohibición OR suspensión)' },
  { lang: 'pt-BR', hl: 'pt-BR', gl: 'BR', ceid: 'BR:pt-419', q: '("data center" OR "centro de dados" OR "centros de dados") (moratória OR proibição OR suspensão)' },
  { lang: 'it',    hl: 'it',    gl: 'IT', ceid: 'IT:it', q: '("data center" OR "centri dati") (moratoria OR divieto OR sospensione)' },
  { lang: 'sv',    hl: 'sv',    gl: 'SE', ceid: 'SE:sv', q: '(datacenter OR datahall) (moratorium OR stopp OR förbud)' },
  { lang: 'ja',    hl: 'ja',    gl: 'JP', ceid: 'JP:ja', q: 'データセンター (モラトリアム OR 凍結 OR 禁止 OR 停止)' },
];

const days = Math.max(1, Math.ceil($('Config').first().json.lookbackHours / 24));
return feeds.map(f => ({
  json: {
    lang: f.lang,
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(f.q + ' when:' + days + 'd')}&hl=${f.hl}&gl=${f.gl}&ceid=${f.ceid}`
  }
}));"""

NORMALISE_CODE = r"""// Combines Google News + GDELT results, drops old items, anything already seen in
// earlier runs, and anything whose link or headline is already in the sheet.
const cfg = $('Config').first().json;

const rss = $('Read news feeds').all()
  .map(i => i.json)
  .filter(j => j && j.title && j.link && !j.error);

const gdeltFirst = $('GDELT search').first();
const gdeltArticles = (gdeltFirst && gdeltFirst.json && gdeltFirst.json.articles) || [];

const parseGdeltDate = s => {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(s || '');
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z` : null;
};

let items = [
  ...rss.map(j => ({
    title: j.title,
    link: j.link,
    published: j.isoDate || j.pubDate || null,
    snippet: (j.contentSnippet || '').slice(0, 500),
    origin: 'google_news',
  })),
  ...gdeltArticles.map(a => ({
    title: a.title,
    link: a.url,
    published: parseGdeltDate(a.seendate),
    snippet: '',
    origin: 'gdelt',
    source_language: a.language || '',
    source_country: a.sourcecountry || '',
  })),
];

// Recency filter
const cutoff = Date.now() - cfg.lookbackHours * 3600 * 1000;
items = items.filter(i => !i.published || new Date(i.published).getTime() >= cutoff);

// Google News titles end in " - Source name"; strip it so the same story from two feeds matches
const normTitle = t => (t || '')
  .toLowerCase()
  .replace(/\s+-\s+[^-]+$/, '')
  .replace(/[^\p{L}\p{N} ]/gu, '')
  .replace(/\s+/g, ' ')
  .trim();

// Everything already in the sheet (works even on a brand-new n8n account)
const sheetRows = $('Read existing rows').all().map(i => i.json || {});
const sheetLinks = new Set(sheetRows.map(r => String(r.source_url || '').trim()).filter(Boolean));
const sheetTitles = new Set(sheetRows.map(r => normTitle(r.headline)).filter(Boolean));

// Cross-run memory (persists only when the workflow is ACTIVE and runs on schedule)
const sd = $getWorkflowStaticData('global');
sd.seenTitles = sd.seenTitles || {};
const pruneBefore = Date.now() - 45 * 24 * 3600 * 1000;
for (const [k, v] of Object.entries(sd.seenTitles)) if (v < pruneBefore) delete sd.seenTitles[k];

const seenThisRun = new Set();
const fresh = [];
for (const i of items) {
  const k = normTitle(i.title);
  if (!k || seenThisRun.has(k) || sd.seenTitles[k]) continue;
  if (sheetLinks.has(i.link) || sheetTitles.has(k)) continue;
  seenThisRun.add(k);
  fresh.push(i);
}

const limited = fresh.slice(0, cfg.maxItemsPerRun);
for (const i of limited) sd.seenTitles[normTitle(i.title)] = Date.now();

return limited.map(j => ({ json: j }));"""

GEMINI_BODY = (
    "={{ JSON.stringify({"
    " systemInstruction: { parts: [{ text: $('Config').first().json.systemPrompt }] },"
    " contents: [{ role: 'user', parts: [{ text: 'Headline: ' + $json.title + '\\nSnippet: ' + ($json.snippet || '') + '\\nPublished: ' + ($json.published || 'unknown') + '\\nURL: ' + $json.link }] }],"
    " generationConfig: { responseMimeType: 'application/json', temperature: 0, maxOutputTokens: 4096 }"
    " }) }}"
)

PARSE_CODE = r"""// Parses Gemini's classification, keeps genuine moratorium actions, and de-duplicates by action.
const cfg = $('Config').first().json;
const responses = $input.all();
const originals = $('Normalise & dedupe').all();

const norm = s => String(s || '').toLowerCase().trim();
const actionKey = (country, jurisdiction, actionType) => [country, jurisdiction, actionType].map(norm).join('|');

// Same action already in the sheet within the last 30 days (e.g. covered by another outlet)
const recentCutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
const sheetActions = new Set(
  $('Read existing rows').all()
    .map(i => i.json || {})
    .filter(r => String(r.date_logged || '') >= recentCutoff)
    .map(r => actionKey(r.country, r.jurisdiction, r.action_type))
);

const sd = $getWorkflowStaticData('global');
sd.seenActions = sd.seenActions || {};
const pruneBefore = Date.now() - 120 * 24 * 3600 * 1000;
for (const [k, v] of Object.entries(sd.seenActions)) if (v.ts < pruneBefore) delete sd.seenActions[k];

const highTypes = ['adopted', 'ban', 'extended'];
const highLevels = ['national', 'state', 'region', 'grid_operator'];
const month = new Date().toISOString().slice(0, 7);
const out = [];
const stats = { sent: originals.length, geminiErrors: 0, firstError: '', unreadable: 0,
  notAction: 0, lowConfidence: 0, alreadyLogged: 0 };

responses.forEach((r, idx) => {
  if (idx >= originals.length) return; // empty placeholder when there was nothing to classify
  const orig = (originals[idx] && originals[idx].json) || {};
  if (r.json && r.json.error) {
    stats.geminiErrors++;
    const e = r.json.error;
    if (!stats.firstError) stats.firstError = String((e && (e.message || e.description)) || JSON.stringify(e)).slice(0, 300);
    return;
  }
  const parts = (r.json && r.json.candidates && r.json.candidates[0] &&
    r.json.candidates[0].content && r.json.candidates[0].content.parts) || [];
  let text = parts.filter(p => p && p.text && !p.thought).map(p => p.text).join('');
  text = text.replace(/```json|```/g, '').trim();
  let c;
  try { c = JSON.parse(text); } catch (e) { stats.unreadable++; return; }
  if (Array.isArray(c)) c = c[0];
  if (!c || !c.is_moratorium_action) { stats.notAction++; return; }
  if ((Number(c.confidence) || 0) < cfg.confidenceThreshold) { stats.lowConfidence++; return; }

  const key = actionKey(c.country, c.jurisdiction, c.action_type);
  if (sheetActions.has(key) || sd.seenActions[key + '|' + month]) { stats.alreadyLogged++; return; }
  sd.seenActions[key + '|' + month] = { ts: Date.now() };
  sheetActions.add(key);

  const priority = (highTypes.includes(c.action_type) || highLevels.includes(c.level)) ? 'high' : 'normal';

  out.push({ json: {
    date_logged: new Date().toISOString().slice(0, 10),
    country: c.country || '',
    jurisdiction: c.jurisdiction || '',
    level: c.level || '',
    action_type: c.action_type || '',
    scope: c.scope || '',
    effective_date: c.effective_date || '',
    expiry: c.expiry || '',
    summary: c.summary || '',
    priority,
    confidence: c.confidence,
    headline: orig.title || '',
    source_url: orig.link || '',
    found_via: orig.origin || '',
    verified: 'no',
  }});
});

// Run report: always sent as the last item, so the run never stops silently here
const rssCount = $('Read news feeds').all().filter(i => i.json && i.json.title).length;
const g = $('GDELT search').first();
const gdeltCount = (g && g.json && g.json.articles && g.json.articles.length) || 0;
out.push({ json: { _report: true, fetched: rssCount + gdeltCount, logged: out.length,
  lookbackHours: cfg.lookbackHours, ...stats } });
return out;"""

ROWS_ONLY_CODE = r"""// Passes on only the new sheet rows (drops the run report).
return $input.all().filter(i => !i.json._report);"""

DIGEST_CODE = r"""// Builds one email per run: new actions logged to the sheet, plus a run report.
const all = $input.all().map(i => i.json);
const rep = all.find(r => r._report) || {};
const rows = all.filter(r => !r._report);
const days = Math.round((rep.lookbackHours || 0) / 24 * 10) / 10;
const report = `
  <p style="font-family:sans-serif;font-size:12px;color:#555;">Run report: searched the last ${days} day(s);
  ${rep.fetched || 0} headlines found; ${rep.sent || 0} new ones sent to Gemini;
  ${rep.notAction || 0} not a moratorium action; ${rep.lowConfidence || 0} below the confidence threshold;
  ${rep.alreadyLogged || 0} already in the sheet; ${rep.unreadable || 0} unreadable replies;
  <b>${rep.geminiErrors || 0} Gemini errors</b>${rep.firstError ? ' (first: ' + String(rep.firstError).replace(/</g, '&lt;') + ')' : ''}.</p>`;

rows.sort((a, b) => (a.priority === 'high' ? -1 : 1) - (b.priority === 'high' ? -1 : 1));
const high = rows.filter(r => r.priority === 'high').length;

const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const rowHtml = r => `
  <tr>
    <td style="padding:6px;border-bottom:1px solid #ddd;">${r.priority === 'high' ? '<b>HIGH</b>' : ''}</td>
    <td style="padding:6px;border-bottom:1px solid #ddd;">${esc(r.country)}</td>
    <td style="padding:6px;border-bottom:1px solid #ddd;">${esc(r.jurisdiction)} <small>(${esc(r.level)})</small></td>
    <td style="padding:6px;border-bottom:1px solid #ddd;">${esc(r.action_type)}</td>
    <td style="padding:6px;border-bottom:1px solid #ddd;">${esc(r.summary)}</td>
    <td style="padding:6px;border-bottom:1px solid #ddd;"><a href="${esc(r.source_url)}">source</a></td>
  </tr>`;

const html = !rows.length ? `<p>No new data centre moratorium actions logged in this run.</p>${report}` : `
  <p>${rows.length} new data centre moratorium action(s) logged today, ${high} high priority.
  Entries are AI-classified and marked <i>verified = no</i> in the sheet until checked.</p>
  <table style="border-collapse:collapse;font-family:sans-serif;font-size:13px;">
    <tr style="background:#bba4ff;text-align:left;">
      <th style="padding:6px;">Priority</th><th style="padding:6px;">Country</th><th style="padding:6px;">Jurisdiction</th>
      <th style="padding:6px;">Action</th><th style="padding:6px;">Summary</th><th style="padding:6px;">Link</th>
    </tr>
    ${rows.map(rowHtml).join('')}
  </table>${report}`;

return [{ json: {
  subject: rep.geminiErrors && !rows.length
    ? `Data centre moratorium tracker: ${rep.geminiErrors} Gemini errors, nothing logged`
    : `Data centre moratorium tracker: ${rows.length} new (${high} high priority)`,
  html,
}}];"""

sheet_doc = {"__rl": True, "mode": "url", "value": SHEET_URL}
sheet_tab = {"__rl": True, "mode": "name", "value": "Moratoriums"}

nodes = [
    {"parameters": {"content": SETUP_NOTE, "height": 480, "width": 560, "color": 6},
     "id": nid(), "name": "Setup notes", "type": "n8n-nodes-base.stickyNote", "typeVersion": 1, "position": [-60, -580]},
    {"parameters": {"rule": {"interval": [{"field": "days", "daysInterval": 1, "triggerAtHour": 7, "triggerAtMinute": 0}]}},
     "id": nid(), "name": "Daily 07:00", "type": "n8n-nodes-base.scheduleTrigger", "typeVersion": 1.2, "position": [0, 0]},
    {"parameters": {"jsCode": CONFIG_CODE},
     "id": nid(), "name": "Config", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [220, 0]},
    {"parameters": {"jsCode": FEEDS_CODE},
     "id": nid(), "name": "Build feed list", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [440, 0]},
    {"parameters": {"url": "={{ $json.url }}", "options": {}},
     "id": nid(), "name": "Read news feeds", "type": "n8n-nodes-base.rssFeedRead", "typeVersion": 1.1, "position": [660, 0],
     "onError": "continueRegularOutput", "alwaysOutputData": True},
    {"parameters": {
        "url": "https://api.gdeltproject.org/api/v2/doc/doc",
        "sendQuery": True,
        "queryParameters": {"parameters": [
            {"name": "query", "value": "(\"data center\" OR \"data centre\" OR datacenter) (moratorium OR ban OR freeze)"},
            {"name": "mode", "value": "artlist"},
            {"name": "format", "value": "json"},
            {"name": "maxrecords", "value": "100"},
            {"name": "timespan", "value": "={{ Math.max(1, Math.ceil($('Config').first().json.lookbackHours / 24)) }}d"},
            {"name": "sort", "value": "datedesc"}]},
        "options": {"response": {"response": {"responseFormat": "json"}}, "timeout": 30000}},
     "id": nid(), "name": "GDELT search", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [880, 0],
     "executeOnce": True, "onError": "continueRegularOutput", "alwaysOutputData": True},
    {"parameters": {"documentId": sheet_doc, "sheetName": sheet_tab, "options": {}},
     "id": nid(), "name": "Read existing rows", "type": "n8n-nodes-base.googleSheets", "typeVersion": 4.5, "position": [1100, 0],
     "executeOnce": True, "alwaysOutputData": True},
    {"parameters": {"jsCode": NORMALISE_CODE},
     "id": nid(), "name": "Normalise & dedupe", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [1320, 0]},
    {"parameters": {
        "method": "POST",
        "url": "=https://generativelanguage.googleapis.com/v1beta/models/{{ $('Config').first().json.model }}:generateContent",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendBody": True,
        "specifyBody": "json",
        "jsonBody": GEMINI_BODY,
        "options": {"batching": {"batch": {"batchSize": 1, "batchInterval": 6000}}, "timeout": 60000}},
     "id": nid(), "name": "Classify with Gemini", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [1540, 0],
     "retryOnFail": True, "maxTries": 3, "waitBetweenTries": 5000,
     "onError": "continueRegularOutput", "alwaysOutputData": True},
    {"parameters": {"jsCode": PARSE_CODE},
     "id": nid(), "name": "Parse & classify", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [1760, 0]},
    {"parameters": {"operation": "append", "documentId": sheet_doc, "sheetName": sheet_tab,
        "columns": {"mappingMode": "autoMapInputData", "value": {}, "matchingColumns": [], "schema": []}, "options": {}},
     "id": nid(), "name": "Log to Google Sheet", "type": "n8n-nodes-base.googleSheets", "typeVersion": 4.5, "position": [2200, -140]},
    {"parameters": {"jsCode": ROWS_ONLY_CODE},
     "id": nid(), "name": "New rows only", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [1980, -140]},
    {"parameters": {"jsCode": DIGEST_CODE},
     "id": nid(), "name": "Build digest", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [1980, 140]},
    {"parameters": {"sendTo": "={{ $('Config').first().json.notifyEmail }}", "subject": "={{ $json.subject }}",
        "emailType": "html", "message": "={{ $json.html }}", "options": {"appendAttribution": False}},
     "id": nid(), "name": "Email digest", "type": "n8n-nodes-base.gmail", "typeVersion": 2.1, "position": [2200, 140]},
]

chain = ["Daily 07:00", "Config", "Build feed list", "Read news feeds", "GDELT search", "Read existing rows",
         "Normalise & dedupe", "Classify with Gemini", "Parse & classify"]
connections = {a: {"main": [[{"node": b, "type": "main", "index": 0}]]} for a, b in zip(chain, chain[1:])}
# Parse & classify feeds two branches: new rows go to the sheet; the digest always gets everything
connections["Parse & classify"] = {"main": [[{"node": "New rows only", "type": "main", "index": 0},
                                             {"node": "Build digest", "type": "main", "index": 0}]]}
connections["New rows only"] = {"main": [[{"node": "Log to Google Sheet", "type": "main", "index": 0}]]}
connections["Build digest"] = {"main": [[{"node": "Email digest", "type": "main", "index": 0}]]}

wf = {"name": "Data centre moratorium tracker (Gemini)", "nodes": nodes, "connections": connections,
      "active": False, "settings": {"executionOrder": "v1", "timezone": "Europe/Madrid"}, "pinData": {}, "meta": {}}

json.dump(wf, open(sys.argv[1], "w", encoding="utf-8"), ensure_ascii=False, indent=2)
