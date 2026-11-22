"""Builds the "Moratorium official sources" n8n workflow.

It searches official US sources (Legistar council agendas for the places on the sheet's
"Legistar watch-list" tab, Open States for state bills, GovInfo + Congress.gov for federal
bills), confirms each record with Gemini using the same instructions as the news workflow,
then either verifies the matching existing row or adds a new, officially verified row.

Usage: python3 build_official_sources.py data-centre-moratorium-official-sources.n8n.json
"""
import json, sys

from build_workflow import SHEET_URL, SYSTEM_PROMPT, nid

SETUP_NOTE = """## Moratorium official sources - setup

1. **Config** node: replace `CHANGE-ME@example.com` with the digest address.
2. **GovInfo search** and **Congress.gov bills**: create one *Query Auth* credential. Name: `api_key`, Value: your api.data.gov key (free at api.data.gov/signup). Use it in both nodes.
3. **Open States search**: create a *Header Auth* credential. Name: `X-API-KEY`, Value: your Open States key (free at openstates.org/accounts/signup).
4. **Classify with Gemini**: reuse the news workflow's Header Auth credential (`x-goog-api-key`).
5. **Read existing rows**, **Read watch-list**, **Re-read rows**, **Log new rows**, **Verify rows** and **Save watch-list errors**: connect your Google account. In **Verify rows** and **Save watch-list errors**, check that *Column to match on* is `row_number` (n8n clears it if the Document is changed). **Email report**: connect Gmail.
6. Test with **Execute workflow**, then switch it to **Active**.

Runs every 2 days at 09:00 Madrid time (2 hours after the news workflow). Places are searched only when `active` is `yes` on the Legistar watch-list tab. For a catch-up run, set `fromDate` / `toDate` in Config."""

CONFIG_CODE = """const cfg = {
  // ---- EDIT THESE ----
  notifyEmail: 'CHANGE-ME@example.com', // address that gets the run report
  lookbackHours: 72,          // normal runs: how far back to search (runs are 48h apart)
  fromDate: '',               // catch-up only: first day to search, 'YYYY-MM-DD'. Leave '' for normal runs
  toDate: '',                 // catch-up only: last day to search, 'YYYY-MM-DD'. Leave '' for normal runs
  maxItemsPerRun: 40,         // cap on records sent to Gemini per run
  confidenceThreshold: 0.6,   // minimum classifier confidence to add or verify a row
  matchDays: 120,             // a record matches a row whose dates are within this many days
  model: 'gemini-flash-latest',
  // A record is sent to Gemini only if its title/details match BOTH patterns (whole words, any case).
  subjectPattern: String.raw`\\b(data ?cent(er|re)s?|data storage|hyperscale)\\b`,
  pausePattern: String.raw`\\b(moratori\\w*|paus(e|es|ed|ing)|bans?|banned|banning|prohibit\\w*|temporary|freez\\w*|suspen\\w*)\\b`,
  // --------------------
  systemPrompt: %s
};

const DAY = 24 * 3600 * 1000;
const ymd = d => d.toISOString().slice(0, 10);
let start, end;
if (cfg.fromDate) {
  start = new Date(cfg.fromDate + 'T00:00:00Z');
  end = cfg.toDate ? new Date(new Date(cfg.toDate + 'T00:00:00Z').getTime() + DAY) : new Date();
  if (isNaN(start) || isNaN(end) || start >= end) throw new Error('fromDate/toDate must be YYYY-MM-DD, with fromDate on or before toDate');
} else {
  end = new Date();
  start = new Date(end.getTime() - cfg.lookbackHours * 3600 * 1000);
}
cfg.windowStart = start.toISOString();
cfg.windowEnd = end.toISOString();
cfg.windowLabel = cfg.fromDate ? `${ymd(start)} to ${ymd(new Date(end.getTime() - 1))}` : `the last ${cfg.lookbackHours} hours`;
cfg.legistarFrom = start.toISOString().slice(0, 19);
cfg.legistarTo = end.toISOString().slice(0, 19);
cfg.dayFrom = ymd(start);
cfg.dayTo = ymd(end);
return [{ json: cfg }];""" % json.dumps(SYSTEM_PROMPT)

LEGISTAR_REQUESTS_CODE = r"""// One request per active place on the watch-list. Keyword matching happens later,
// because Legistar's search is case-sensitive.
const cfg = $('Config').first().json;
const filter = `MatterLastModifiedUtc ge datetime'${cfg.legistarFrom}' and MatterLastModifiedUtc lt datetime'${cfg.legistarTo}'`;
const out = $('Read watch-list').all()
  .map(i => i.json || {})
  .filter(w => String(w.active || '').trim().toLowerCase() === 'yes' && String(w.legistar_client || '').trim())
  .map(w => {
    const client = String(w.legistar_client).trim();
    return { json: {
      client, place: String(w.jurisdiction || '').trim(), country: String(w.country || 'United States').trim(),
      watchRow: w.row_number,
      url: `https://webapi.legistar.com/v1/${encodeURIComponent(client)}/matters?$top=1000&$filter=${encodeURIComponent(filter)}`,
    } };
  });
// Always pass something on, so the run continues (and reports) when the list is empty.
return out.length ? out : [{ json: { _none: true, url: 'https://webapi.legistar.com/v1/_none_/matters?$top=1' } }];"""

GOVINFO_BODY = (
    "={{ JSON.stringify({ query: 'collection:BILLS AND (\"data center\" OR \"data centre\" OR datacenter) AND "
    "(moratorium OR pause OR ban OR prohibit) AND publishdate:range(' + $('Config').first().json.dayFrom + ',' + "
    "$('Config').first().json.dayTo + ')', pageSize: 50, offsetMark: '*', "
    "sorts: [{ field: 'publishdate', sortOrder: 'DESC' }] }) }}"
)

FEDERAL_CODE = r"""// Turns GovInfo bill versions into one Congress.gov lookup per bill.
const raw = $('GovInfo search').first();
let results = [];
try {
  const j = raw && raw.json;
  const body = typeof j.data === 'string' ? JSON.parse(j.data) : j;
  results = body.results || [];
} catch (e) { results = []; }
const seen = new Set();
const out = [];
for (const r of results) {
  // e.g. BILLS-119hr9442ih -> congress 119, type hr, number 9442
  const m = /^BILLS-(\d+)([a-z]+?)(\d+)[a-z]+$/.exec(r.packageId || '');
  if (!m) continue;
  const key = m[1] + m[2] + m[3];
  if (seen.has(key)) continue;
  seen.add(key);
  out.push({ json: { congress: m[1], type: m[2], number: m[3], title: r.title || '', dateIssued: r.dateIssued || '',
    url: `https://api.congress.gov/v3/bill/${m[1]}/${m[2]}/${m[3]}?format=json` } });
}
return out.length ? out : [{ json: { _none: true, url: 'https://api.congress.gov/v3/bill/0/hr/0?format=json' } }];"""

# Shared by "Normalise & gate" (to build the candidates) - kept as one block so the logic is in one place.
NORMALISE_CODE = r"""// Collects records from every source, keeps those that mention data centres AND a pause word,
// and builds the Gemini prompt for each. Every item carries the run's source statistics.
const cfg = $('Config').first().json;
const lc = s => String(s || '').toLowerCase();
const subjectRe = new RegExp(cfg.subjectPattern, 'i'), pauseRe = new RegExp(cfg.pausePattern, 'i');
const stats = {};
const src = name => (stats[name] = stats[name] || { found: 0, gated: 0, errors: 0, firstError: '' });
const fail = (name, msg) => { const s = src(name); s.errors++; if (!s.firstError) s.firstError = String(msg).slice(0, 300); };
const parse = item => {
  const j = (item && item.json) || {};
  if (j.error) return { error: j.error.message || j.error.description || JSON.stringify(j.error) };
  try { return { body: typeof j.data === 'string' ? JSON.parse(j.data) : j }; } catch (e) { return { error: 'unreadable response' }; }
};
const records = [];

// Legistar: requests and responses pair up by position.
const reqs = $('Build Legistar requests').all();
const resps = $('Legistar matters').all();
const watch = [];
reqs.forEach((req, i) => {
  if (req.json._none) return;
  const r = parse(resps[i]);
  src('legistar');
  if (r.error || !Array.isArray(r.body)) {
    const msg = r.error || (r.body && (r.body.ExceptionMessage || r.body.Message)) || 'no data';
    fail('legistar', `${req.json.place}: ${msg}`);
    watch.push({ watchRow: req.json.watchRow, place: req.json.place, error: String(msg).slice(0, 200) });
    return;
  }
  watch.push({ watchRow: req.json.watchRow, place: req.json.place, error: '' });
  for (const m of r.body) {
    stats.legistar.found++;
    records.push({
      source: 'legistar', place: req.json.place, country: req.json.country || 'United States', level: '',
      title: m.MatterTitle || m.MatterName || '', body: [m.MatterName, m.MatterTitle].filter(Boolean).join(' - '),
      date: String(m.MatterAgendaDate || m.MatterIntroDate || m.MatterLastModifiedUtc || '').slice(0, 10),
      stage: [m.MatterTypeName && m.MatterTypeName.trim(), m.MatterStatusName].filter(Boolean).join(': '),
      url: `https://${req.json.client}.legistar.com/LegislationDetail.aspx?ID=${m.MatterId}&GUID=${m.MatterGuid}`,
    });
  }
});

// Federal bills: GovInfo found them, Congress.gov gives the latest action.
const fedReqs = $('Federal bills').all();
const fedResps = $('Congress.gov bills').all();
const gi = parse($('GovInfo search').first());
src('federal');
if (gi.error) fail('federal', 'GovInfo: ' + gi.error);
else if (gi.body && gi.body.error) fail('federal', 'GovInfo: ' + (gi.body.error.message || JSON.stringify(gi.body.error)));
fedReqs.forEach((req, i) => {
  if (req.json._none) return;
  stats.federal.found++;
  const r = parse(fedResps[i]);
  const bill = (r.body && r.body.bill) || {};
  if (r.error) fail('federal', 'Congress.gov: ' + r.error);
  const la = bill.latestAction || {};
  records.push({
    source: 'congress', place: 'United States', country: 'United States', level: 'national', number: req.json.number,
    title: bill.title || req.json.title, body: bill.title || req.json.title,
    date: la.actionDate || req.json.dateIssued || '',
    stage: la.text ? `${la.text} (${la.actionDate})` : 'introduced',
    url: bill.legislationUrl || `https://www.congress.gov/bill/${req.json.congress}th-congress/${req.json.type === 's' ? 'senate' : 'house'}-bill/${req.json.number}`,
  });
});

// State bills from Open States.
const os = parse($('Open States search').first());
src('openstates');
if (os.error) fail('openstates', os.error);
else if (os.body && os.body.detail) fail('openstates', os.body.detail);
else for (const b of (os.body && os.body.results) || []) {
  stats.openstates.found++;
  const j = b.jurisdiction || {};
  records.push({
    source: 'openstates', place: j.name || '', country: 'United States', level: 'state',
    number: (String(b.identifier || '').match(/\d+/) || [''])[0],
    title: b.title || '', body: [b.identifier, b.title].filter(Boolean).join(' - '),
    date: String(b.latest_action_date || b.first_action_date || '').slice(0, 10),
    stage: b.latest_action_description ? `${b.latest_action_description} (${String(b.latest_action_date || '').slice(0, 10)})` : '',
    url: b.openstates_url || '',
  });
}

// Keyword gate, then cap.
const gated = records.filter(r => subjectRe.test(r.title + ' ' + r.body) && pauseRe.test(r.title + ' ' + r.body));
for (const r of gated) src(r.source === 'congress' ? 'federal' : r.source).gated++;
const statsKey = s => (s === 'congress' ? 'federal' : s);
const limited = gated.slice(0, cfg.maxItemsPerRun);
const notChecked = gated.length - limited.length;
const meta = { _stats: stats, _watch: watch, _notChecked: notChecked };
const out = limited.map(r => ({ json: { ...r, statsKey: statsKey(r.source), ...meta,
  prompt: `Official ${r.source === 'legistar' ? 'council agenda record' : r.level === 'state' ? 'state bill' : 'federal bill'} for ${r.place}, ${r.country}.\nTitle: ${r.title}\nDetails: ${r.body}\nLatest step: ${r.stage}\nDate: ${r.date}\nURL: ${r.url}` } }));
return out.length ? out : [{ json: { _none: true, ...meta } }];"""

# The placeholder item for "nothing to classify" is sent to the model list, which costs nothing.
GEMINI_URL = ("={{ $json._none ? 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1' : "
              "'https://generativelanguage.googleapis.com/v1beta/models/' + $('Config').first().json.model + ':generateContent' }}")
GEMINI_BODY = (
    "={{ JSON.stringify($json._none ? {} : { systemInstruction: { parts: [{ text: $('Config').first().json.systemPrompt }] },"
    " contents: [{ role: 'user', parts: [{ text: $json.prompt }] }],"
    " generationConfig: { responseMimeType: 'application/json', temperature: 0, maxOutputTokens: 4096 } }) }}"
)

RETRY_CODE = r"""// Google's own error messages are kept (neverError), so n8n's built-in retry never fires.
// Instead, calls that failed with a server error (5xx, e.g. 503 "overloaded") are sent once more.
const cands = $('Normalise & gate').all().map(i => i.json);
const out = [];
$('Classify with Gemini').all().forEach((a, idx) => {
  const e = a.json && a.json.error;
  if (cands[idx] && !cands[idx]._none && e && Number(e.code) >= 500) out.push({ json: { idx, prompt: cands[idx].prompt } });
});
return out.length ? out : [{ json: { _none: true } }];"""

MATCH_CODE = r"""// Reads Gemini's answers, then for each confirmed action either verifies the matching row,
// adds a new officially verified row, or reports an ambiguous match.
const cfg = $('Config').first().json;
const cands = $('Normalise & gate').all().map(i => i.json);
const answers = $('Classify with Gemini').all().map(i => i.json || {});
// Replace answers that were retried after a server error.
const retried = $('Gemini retries').all();
$('Classify again').all().forEach((a, k) => { const r = retried[k] && retried[k].json; if (r && !r._none) answers[r.idx] = a.json || {}; });
const meta = cands[0] || {};
const stats = JSON.parse(JSON.stringify(meta._stats || {}));
for (const s of Object.values(stats)) { s.confirmed = 0; s.added = 0; s.verified = 0; }
const report = { windowLabel: cfg.windowLabel, stats, notChecked: meta._notChecked || 0, ambiguous: [],
  geminiErrors: 0, firstGeminiError: '', watch: meta._watch || [] };

const DAY = 24 * 3600 * 1000;
const lc = s => String(s || '').toLowerCase().trim();
const place = s => lc(s).replace(/^(city|town|village|county) of /, '').replace(/[^a-z0-9, ]/g, '').replace(/\s+/g, ' ');
const group = t => (['adopted', 'ban'].includes(lc(t)) ? 'adopted' : lc(t));
const days = (a, b) => Math.abs(new Date(a).getTime() - new Date(b).getTime()) / DAY;

const rows = $('Read existing rows').all().map(i => i.json || {}).filter(r => r.row_number);
const out = [];
const touched = new Set();      // rows already updated in this run
const addedKeys = new Set();    // actions already added in this run

// Bills are matched on their number, or failing that on distinctive title words.
const STOP = new Set('a an and the of for on in to by with from new data center centers centre centres datacenter datacenters moratorium moratoriums act bill pause ban bans temporary relating establishing establish provide provides development facilities facility'.split(' '));
const words = s => new Set(lc(s).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 3 && !STOP.has(w)));
const rowText = r => [r.headline, r.summary, r.scope].join(' ');
const sameBill = (c, r) => c.number ? new RegExp('(^|[^0-9])' + c.number + '([^0-9]|$)').test(rowText(r)) : false;
const shared = (c, r) => { const a = words(c.title), b = words(rowText(r)); let n = 0; for (const w of a) if (b.has(w)) n++; return n; };

// Newest record first: when several records describe the same action, the most advanced stage wins.
const order = cands.map((c, idx) => idx).sort((x, y) => String(cands[y].date || '').localeCompare(String(cands[x].date || '')));
order.forEach(idx => {
  const c = cands[idx];
  if (c._none) return;
  const a = answers[idx] || {};
  if (a.error) {
    report.geminiErrors++;
    if (!report.firstGeminiError) {
      // Put the limit that was hit (e.g. "Quota exceeded for metric: ... limit: 20") first, so it survives the cut.
      const msg = String(a.error.message || '');
      const quota = (msg.match(/Quota exceeded for metric:[^*]*/g) || []).join(' ').trim();
      report.firstGeminiError = [a.error.code, a.error.status, quota || msg].filter(Boolean).join(' ').slice(0, 500);
    }
    return;
  }
  const parts = (a.candidates && a.candidates[0] && a.candidates[0].content && a.candidates[0].content.parts) || [];
  let g;
  try { g = JSON.parse(parts.filter(p => p && p.text && !p.thought).map(p => p.text).join('').replace(/```json|```/g, '').trim()); } catch (e) { return; }
  if (Array.isArray(g)) g = g[0];
  if (!g || !g.is_moratorium_action || (Number(g.confidence) || 0) < cfg.confidenceThreshold) return;
  const st = stats[c.statsKey]; st.confirmed++;

  // The official source decides the place; Gemini decides what happened.
  const level = c.level || lc(g.level) || '';
  const action = lc(g.action_type) || 'other';
  const recDate = g.effective_date || c.date;
  const isNational = level === 'national';
  let matches = rows.filter(r =>
    lc(r.country) === lc(c.country) &&
    (isNational ? lc(r.level) === 'national' : place(r.jurisdiction) === place(c.place)) &&
    group(r.action_type) === group(action) &&
    [r.effective_date, r.date_logged].some(d => d && recDate && days(d, recDate) <= cfg.matchDays));

  if (c.level === 'state' || c.level === 'national') {
    const byNumber = matches.filter(r => sameBill(c, r));
    matches = byNumber.length ? byNumber : matches.filter(r => shared(c, r) >= 2);
  }

  const fields = { verified: 'yes', verified_by: 'official', official_source_url: c.url, stage: String(c.stage || '').slice(0, 200) };
  if (matches.length > 1) {
    report.ambiguous.push(`${c.place}: ${c.title} matches rows ${matches.map(r => r.row_number).join(', ')}`);
    return;
  }
  if (matches.length === 1) {
    const r = matches[0];
    if (lc(r.verified_by) === 'person' || lc(r.verified) === 'yes' || touched.has(r.row_number)) return;
    touched.add(r.row_number);
    st.verified++;
    out.push({ json: { _kind: 'update', row_number: r.row_number, ...fields, _headline: r.headline || '', _country: r.country || '' } });
    return;
  }
  const key = [lc(c.country), place(c.place), group(action)].join('|');
  if (addedKeys.has(key)) return;
  addedKeys.add(key);
  st.added++;
  out.push({ json: { _kind: 'new',
    date_logged: new Date().toISOString().slice(0, 10),
    country: c.country, jurisdiction: c.place, level, action_type: action,
    scope: g.scope || '', effective_date: g.effective_date || '', expiry: g.expiry || '',
    summary: g.summary || '', priority: (['adopted', 'ban', 'extended'].includes(action) || ['national', 'state'].includes(level)) ? 'high' : 'normal',
    confidence: g.confidence, headline: c.title, source_url: c.url, found_via: c.source,
    ...fields } });
});

// Watch-list error column: written back for every place searched (blank clears an old error).
for (const w of report.watch) if (w.watchRow) out.push({ json: { _kind: 'watch', row_number: w.watchRow, last_error: w.error } });
out.push({ json: { _kind: 'report', ...report } });
return out;"""

NEW_ONLY_CODE = r"""// New rows only, without the helper fields.
return $input.all().filter(i => i.json._kind === 'new').map(i => {
  const { _kind, ...row } = i.json; return { json: row };
});"""

UPDATES_ONLY_CODE = r"""return $input.all().filter(i => i.json._kind === 'update');"""

SAFE_UPDATES_CODE = r"""// Only write when the row still holds the same story (rows can move if someone edits the sheet mid-run).
const now = new Map($('Re-read rows').all().map(i => [i.json.row_number, i.json]));
const lc = s => String(s || '').trim().toLowerCase();
return $('Updates only').all()
  .filter(i => { const r = now.get(i.json.row_number); return r && lc(r.headline) === lc(i.json._headline) && lc(r.country) === lc(i.json._country) && lc(r.verified_by) !== 'person'; })
  .map(i => ({ json: { row_number: i.json.row_number, verified: i.json.verified, verified_by: i.json.verified_by,
    official_source_url: i.json.official_source_url, stage: i.json.stage } }));"""

WATCH_ONLY_CODE = r"""return $input.all().filter(i => i.json._kind === 'watch').map(i => ({ json: { row_number: i.json.row_number, last_error: i.json.last_error } }));"""

REPORT_CODE = r"""// One email per run: what each source returned and what changed in the sheet.
const all = $input.all().map(i => i.json);
const rep = all.find(r => r._kind === 'report') || {};
const added = all.filter(r => r._kind === 'new');
const verified = all.filter(r => r._kind === 'update');
let written = verified.length;
try { written = $('Safe updates').all().length; } catch (e) { written = 0; }
const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const names = { legistar: 'Council agendas (Legistar)', federal: 'Federal bills (GovInfo / Congress.gov)', openstates: 'State bills (Open States)' };
const srcRows = Object.entries(rep.stats || {}).map(([k, s]) => `<tr><td>${esc(names[k] || k)}</td><td>${s.found}</td><td>${s.gated}</td><td>${s.confirmed}</td><td>${s.added}</td><td>${s.verified}</td><td>${s.errors}${s.firstError ? ' (' + esc(s.firstError) + ')' : ''}</td></tr>`).join('');
const watch = rep.watch || [];
const watchErr = watch.filter(w => w.error);
const list = (title, items) => items.length ? `<p><b>${title}</b></p><ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>` : '';
const html = `
  <p>Official sources searched: ${esc(rep.windowLabel)}. ${added.length} new row(s) added, ${verified.length} existing row(s) verified${written !== verified.length ? ` (${written} written; ${verified.length - written} skipped because the row changed during the run)` : ''}.</p>
  <table style="border-collapse:collapse;font-family:sans-serif;font-size:13px" border="1" cellpadding="5">
    <tr style="background:#bba4ff"><th>Source</th><th>Records</th><th>Passed keyword filter</th><th>Confirmed by Gemini</th><th>Added</th><th>Verified</th><th>Errors</th></tr>${srcRows}</table>
  <p style="font-size:12px;color:#555">Council agendas: ${watch.length} place(s) searched, ${watchErr.length} with errors. Gemini errors: ${rep.geminiErrors || 0}${rep.firstGeminiError ? ' (first: ' + esc(rep.firstGeminiError) + ')' : ''}.${rep.notChecked ? ` <b>${rep.notChecked} record(s) not checked</b>: maxItemsPerRun reached; rerun with a shorter date range.` : ''}</p>
  ${list('Added', added.map(r => `${esc(r.jurisdiction)} - ${esc(r.action_type)}: <a href="${esc(r.official_source_url)}">${esc(r.headline)}</a>`))}
  ${list('Verified', verified.map(r => `Row ${r.row_number}: <a href="${esc(r.official_source_url)}">${esc(r._headline)}</a>`))}
  ${list('Ambiguous matches (not changed - check by hand)', (rep.ambiguous || []).map(esc))}
  ${list('Watch-list places with errors', watchErr.map(w => `${esc(w.place)}: ${esc(w.error)}`))}`;
const problems = (rep.geminiErrors || 0) + Object.values(rep.stats || {}).reduce((n, s) => n + s.errors, 0);
return [{ json: {
  subject: `Moratorium official sources: ${added.length} added, ${written} verified${problems ? `, ${problems} error(s)` : ''}`,
  html,
} }];"""

sheet_doc = {"__rl": True, "mode": "url", "value": SHEET_URL}
tab = lambda name: {"__rl": True, "mode": "name", "value": name}
text_response = {"response": {"response": {"neverError": True, "responseFormat": "text"}}}


def match_schema(columns):
    """Column list for an update node, so n8n offers row_number as the column to match on after import."""
    field = lambda c, match: {"id": c, "displayName": c, "required": False, "defaultMatch": False, "display": True,
                              "type": "string", "canBeUsedToMatch": match, "readOnly": c == "row_number", "removed": False}
    return [field("row_number", True)] + [field(c, False) for c in columns]


def code(name, js, pos, **extra):
    return {"parameters": {"jsCode": js}, "id": nid(), "name": name, "type": "n8n-nodes-base.code",
            "typeVersion": 2, "position": pos, **extra}


def read(name, tab_name, pos):
    return {"parameters": {"documentId": sheet_doc, "sheetName": tab(tab_name), "options": {}},
            "id": nid(), "name": name, "type": "n8n-nodes-base.googleSheets", "typeVersion": 4.5,
            "position": pos, "executeOnce": True, "alwaysOutputData": True}


def http(name, pos, params, **extra):
    return {"parameters": params, "id": nid(), "name": name, "type": "n8n-nodes-base.httpRequest",
            "typeVersion": 4.2, "position": pos, "onError": "continueRegularOutput", "alwaysOutputData": True, **extra}


nodes = [
    {"parameters": {"content": SETUP_NOTE, "height": 520, "width": 620, "color": 6},
     "id": nid(), "name": "Setup notes", "type": "n8n-nodes-base.stickyNote", "typeVersion": 1, "position": [-60, -640]},
    {"parameters": {"rule": {"interval": [{"field": "days", "daysInterval": 2, "triggerAtHour": 9, "triggerAtMinute": 0}]}},
     "id": nid(), "name": "Every 2 days 09:00", "type": "n8n-nodes-base.scheduleTrigger", "typeVersion": 1.2, "position": [0, 0]},
    code("Config", CONFIG_CODE, [200, 0]),
    read("Read existing rows", "Moratoriums", [400, 0]),
    read("Read watch-list", "Legistar watch-list", [600, 0]),
    code("Build Legistar requests", LEGISTAR_REQUESTS_CODE, [800, 0]),
    http("Legistar matters", [1000, 0], {"url": "={{ $json.url }}", "options": {
        **text_response, "timeout": 60000, "batching": {"batch": {"batchSize": 1, "batchInterval": 500}}}}),
    http("GovInfo search", [1200, 0], {
        "method": "POST", "url": "https://api.govinfo.gov/search",
        "authentication": "genericCredentialType", "genericAuthType": "httpQueryAuth",
        "sendBody": True, "specifyBody": "json", "jsonBody": GOVINFO_BODY,
        "options": {**text_response, "timeout": 60000}}, executeOnce=True),
    code("Federal bills", FEDERAL_CODE, [1400, 0]),
    http("Congress.gov bills", [1600, 0], {
        "url": "={{ $json.url }}", "authentication": "genericCredentialType", "genericAuthType": "httpQueryAuth",
        "options": {**text_response, "timeout": 30000, "batching": {"batch": {"batchSize": 1, "batchInterval": 1000}}}}),
    http("Open States search", [1800, 0], {
        "url": "https://v3.openstates.org/bills",
        "authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth",
        "sendQuery": True, "queryParameters": {"parameters": [
            {"name": "q", "value": "\"data center\" OR \"data centre\""},
            {"name": "updated_since", "value": "={{ $('Config').first().json.dayFrom }}"},
            {"name": "sort", "value": "updated_desc"},
            {"name": "per_page", "value": "20"}]},
        "options": {**text_response, "timeout": 60000}}, executeOnce=True),
    code("Normalise & gate", NORMALISE_CODE, [2000, 0]),
    http("Classify with Gemini", [2200, 0], {
        "method": "POST", "url": GEMINI_URL,
        "authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth",
        "sendBody": True, "specifyBody": "json", "jsonBody": GEMINI_BODY,
        "options": {"batching": {"batch": {"batchSize": 1, "batchInterval": 6000}}, "timeout": 30000,
                    "response": {"response": {"neverError": True, "responseFormat": "json"}}}},
        retryOnFail=True, maxTries=2, waitBetweenTries=5000),
    code("Gemini retries", RETRY_CODE, [2400, 0]),
    http("Classify again", [2600, 0], {
        "method": "POST", "url": GEMINI_URL,
        "authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth",
        "sendBody": True, "specifyBody": "json", "jsonBody": GEMINI_BODY,
        "options": {"batching": {"batch": {"batchSize": 1, "batchInterval": 15000}}, "timeout": 30000,
                    "response": {"response": {"neverError": True, "responseFormat": "json"}}}}),
    code("Match & decide", MATCH_CODE, [2800, 0]),
    # Branch 1: new rows
    code("New rows only", NEW_ONLY_CODE, [3020, -260]),
    {"parameters": {"operation": "append", "documentId": sheet_doc, "sheetName": tab("Moratoriums"),
        "columns": {"mappingMode": "autoMapInputData", "value": {}, "matchingColumns": [], "schema": []}, "options": {}},
     "id": nid(), "name": "Log new rows", "type": "n8n-nodes-base.googleSheets", "typeVersion": 4.5, "position": [3240, -260]},
    # Branch 2: verify existing rows (re-read first, write only the four verification columns)
    code("Updates only", UPDATES_ONLY_CODE, [3020, -80]),
    read("Re-read rows", "Moratoriums", [3240, -80]),
    code("Safe updates", SAFE_UPDATES_CODE, [3460, -80]),
    {"parameters": {"operation": "update", "documentId": sheet_doc, "sheetName": tab("Moratoriums"),
        "columns": {"mappingMode": "autoMapInputData", "value": {}, "matchingColumns": ["row_number"],
                    "schema": match_schema(["verified", "verified_by", "official_source_url", "stage"])}, "options": {}},
     "id": nid(), "name": "Verify rows", "type": "n8n-nodes-base.googleSheets", "typeVersion": 4.5, "position": [3680, -80]},
    # Branch 3: watch-list errors
    code("Watch-list errors only", WATCH_ONLY_CODE, [3020, 100]),
    {"parameters": {"operation": "update", "documentId": sheet_doc, "sheetName": tab("Legistar watch-list"),
        "columns": {"mappingMode": "autoMapInputData", "value": {}, "matchingColumns": ["row_number"],
                    "schema": match_schema(["last_error"])}, "options": {}},
     "id": nid(), "name": "Save watch-list errors", "type": "n8n-nodes-base.googleSheets", "typeVersion": 4.5, "position": [3240, 100]},
    # Branch 4 (runs last): report
    code("Build report", REPORT_CODE, [3020, 280]),
    {"parameters": {"sendTo": "={{ $('Config').first().json.notifyEmail }}", "subject": "={{ $json.subject }}",
        "emailType": "html", "message": "={{ $json.html }}", "options": {"appendAttribution": False}},
     "id": nid(), "name": "Email report", "type": "n8n-nodes-base.gmail", "typeVersion": 2.1, "position": [3240, 280]},
]

chain = ["Every 2 days 09:00", "Config", "Read existing rows", "Read watch-list", "Build Legistar requests",
         "Legistar matters", "GovInfo search", "Federal bills", "Congress.gov bills", "Open States search",
         "Normalise & gate", "Classify with Gemini", "Gemini retries", "Classify again", "Match & decide"]
link = lambda *targets: {"main": [[{"node": t, "type": "main", "index": 0} for t in targets]]}
connections = {a: link(b) for a, b in zip(chain, chain[1:])}
# Branches run top to bottom, so the report is built after the sheet writes.
connections["Match & decide"] = link("New rows only", "Updates only", "Watch-list errors only", "Build report")
connections["New rows only"] = link("Log new rows")
connections["Updates only"] = link("Re-read rows")
connections["Re-read rows"] = link("Safe updates")
connections["Safe updates"] = link("Verify rows")
connections["Watch-list errors only"] = link("Save watch-list errors")
connections["Build report"] = link("Email report")

wf = {"name": "Moratorium official sources", "nodes": nodes, "connections": connections,
      "active": False, "settings": {"executionOrder": "v1", "timezone": "Europe/Madrid"}, "pinData": {}, "meta": {}}

if __name__ == "__main__":
    json.dump(wf, open(sys.argv[1], "w", encoding="utf-8"), ensure_ascii=False, indent=2)
