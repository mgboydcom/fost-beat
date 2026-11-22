// Tests for the "Moratorium official sources" workflow.
//
// Runs the workflow's Code nodes in order, the way n8n does, with recorded API responses
// (fixtures/) standing in for the HTTP nodes and a hand-written Gemini that answers the way
// a correct classifier would. Checks finding, matching, verification and the run report.
//
// Usage (from moratorium-tracker/n8n):
//   python3 build_official_sources.py data-centre-moratorium-official-sources.n8n.json
//   node tests/test_official_sources.js
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const here = __dirname;
const fx = f => JSON.parse(fs.readFileSync(path.join(here, 'fixtures', f), 'utf8'));
const wf = JSON.parse(fs.readFileSync(path.join(here, '..', 'data-centre-moratorium-official-sources.n8n.json'), 'utf8'));
const code = n => { const node = wf.nodes.find(x => x.name === n); assert(node, `node ${n} missing`); return node.parameters.jsCode; };

function simulate(scenario) {
  const out = {};
  const items = arr => arr.map(j => ({ json: j }));
  const text = s => ({ json: { data: JSON.stringify(s) } });
  const run = (name, input = []) => {
    const $ = k => { if (!(k in out)) throw new Error(`node ${k} not executed`); return { all: () => out[k], first: () => out[k][0] }; };
    out[name] = new Function('$', '$input', '$getWorkflowStaticData', code(name))($, { all: () => input }, () => ({}));
    return out[name];
  };

  let rows = fx('sheet_rows.json');
  if (scenario === 'person') rows = rows.map(r => r.jurisdiction === 'Charlotte, NC' ? { ...r, verified: 'yes', verified_by: 'person' } : r);
  if (scenario === 'ambiguous') { const c = rows.find(r => r.jurisdiction === 'Charlotte, NC' && r.action_type === 'extended'); rows = rows.concat({ ...c, row_number: 999, headline: 'duplicate story' }); }

  // Catch-up window covering the fixtures.
  out['Config'] = new Function('$', '$input', code('Config')
    .replace("fromDate: '',", "fromDate: '2026-05-01',").replace("toDate: '',", "toDate: '2026-11-14',"))();
  out['Read existing rows'] = items(rows);
  out['Read watch-list'] = scenario === 'empty' ? [] : items([
    { row_number: 4, jurisdiction: 'Charlotte, NC', country: 'United States', legistar_client: 'charlottenc', active: 'yes' },
    { row_number: 98, jurisdiction: 'Memphis, TN', country: 'United States', legistar_client: 'memphis', active: 'yes' },
    { row_number: 25, jurisdiction: 'Fulton County, IN', country: 'United States', legistar_client: 'fulton', active: 'check' },
  ]);
  run('Build Legistar requests');

  // Charlotte: recorded response plus an unrelated "data center" contract; Memphis: recorded error.
  const charlotte = fx('legistar_charlotte.json').concat({ MatterId: 2136, MatterGuid: 'E7F1ABEA-0DB1-420B-AE63-181D48772B0F',
    MatterTitle: 'Airport Main Data Center Utilities Upgrade Design Contract', MatterTypeName: 'Consent Item',
    MatterStatusName: 'Agenda Ready', MatterIntroDate: '2026-06-01T00:00:00', MatterLastModifiedUtc: '2026-06-01T00:00:00' });
  out['Legistar matters'] = out['Build Legistar requests'].map(r => r.json._none ? { json: { error: { message: 'placeholder' } } }
    : r.json.client === 'charlottenc' ? text(charlotte)
    : text({ Message: 'An error has occurred.', ExceptionMessage: 'LegistarConnectionString setting is not set up in InSite for client: memphis' }));

  out['GovInfo search'] = [text(fx('govinfo.json'))];
  run('Federal bills');
  const fed = { 9442: 'congress_hr9442.json', 9419: 'congress_hr_9419.json', 4784: 'congress_s_4784.json', 8646: 'congress_hr_8646.json' };
  out['Congress.gov bills'] = out['Federal bills'].map(r => r.json._none ? { json: {} } : text(fx(fed[r.json.number])));

  // Open States: written in the documented v3 /bills shape (no key was available to record a real response).
  out['Open States search'] = [text({ results: [
    { identifier: 'HB 1234', title: 'An Act establishing a moratorium on new data centers pending a study of grid capacity',
      jurisdiction: { name: 'Virginia' }, latest_action_description: 'Referred to Committee on Commerce and Labor',
      latest_action_date: '2026-10-20', openstates_url: 'https://openstates.org/va/bills/2026/HB1234/' },
    { identifier: 'SB 9', title: 'Relating to data center sales tax exemptions', jurisdiction: { name: 'Texas' },
      latest_action_description: 'Filed', latest_action_date: '2026-10-01', openstates_url: 'https://openstates.org/tx/bills/2026/SB9/' },
  ] })];

  run('Normalise & gate');
  const cands = out['Normalise & gate'].map(i => i.json);

  const reply = o => ({ json: { candidates: [{ content: { parts: [{ text: JSON.stringify(o) }] } }] } });
  const answers = cands.map(c => {
    if (c._none) return { json: { error: { code: 404, message: 'placeholder' } } };
    if (scenario === 'quota') return { json: { error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded' } } };
    const t = c.title.toLowerCase();
    if (c.source === 'legistar' && t.includes('extension')) return reply({ is_moratorium_action: true, action_type: 'extended', level: 'city', effective_date: '2026-10-27', confidence: 0.95 });
    if (c.source === 'legistar') return reply({ is_moratorium_action: true, action_type: 'adopted', level: 'city', effective_date: c.date, confidence: 0.9 });
    if (t.includes('moratorium act')) return reply({ is_moratorium_action: true, action_type: 'proposed', level: 'national', confidence: 0.9 });
    if (c.source === 'openstates' && t.includes('moratorium')) return reply({ is_moratorium_action: true, action_type: 'proposed', level: 'state', confidence: 0.85 });
    return reply({ is_moratorium_action: false, confidence: 0.9 });
  });
  const first = answers.slice();
  if (scenario === '503') first[cands.findIndex(c => c.title && c.title.startsWith('Extension'))] = { json: { error: { code: 503, message: 'The model is overloaded.' } } };
  out['Classify with Gemini'] = first;
  const retries = run('Gemini retries');
  out['Classify again'] = retries.map(r => r.json._none ? { json: { error: { code: 404, message: 'placeholder' } } } : answers[r.json.idx]);
  const decided = run('Match & decide', out['Classify again']);

  const newRows = run('New rows only', decided).map(i => i.json);
  const updates = run('Updates only', decided);
  let safe = [];
  if (updates.length) {
    out['Re-read rows'] = scenario === 'moved' ? items(rows.map(r => ({ ...r, headline: 'someone else' }))) : items(rows);
    safe = run('Safe updates', updates).map(i => i.json);
  }
  const watch = run('Watch-list errors only', decided).map(i => i.json);
  const report = run('Build report', decided)[0].json;
  return { cands, newRows, safe, watch, report, retries };
}

const tests = {
  'keyword filter keeps moratorium items and drops unrelated data centre items'() {
    const { cands } = simulate('main');
    const titles = cands.map(c => c.title);
    assert(titles.some(t => t.startsWith('Extension of the Temporary Moratorium')));
    assert(!titles.some(t => /Airport Main Data Center/.test(t)), 'airport contract must not reach Gemini');
    assert(!titles.includes('Data Centers'), 'committee items without a pause word must not reach Gemini');
    assert(!titles.some(t => /sales tax/.test(t)));
    assert.deepStrictEqual(cands.map(c => c.source).sort(), ['congress', 'legistar', 'legistar', 'legistar', 'legistar', 'legistar', 'openstates']);
  },
  'places not marked active=yes are not searched; client errors are reported and saved'() {
    const { watch, report } = simulate('main');
    assert.deepStrictEqual(watch, [{ row_number: 4, last_error: '' },
      { row_number: 98, last_error: 'LegistarConnectionString setting is not set up in InSite for client: memphis' }]);
    assert(/Memphis, TN: LegistarConnectionString/.test(report.html));
  },
  'matching rows are verified by the most advanced official record'() {
    const { safe } = simulate('main');
    const byRow = Object.fromEntries(safe.map(u => [u.row_number, u]));
    const charlotte = fx('sheet_rows.json').filter(r => r.jurisdiction === 'Charlotte, NC');
    const ext = charlotte.find(r => r.action_type === 'extended'), adopt = charlotte.find(r => r.action_type === 'adopted');
    assert.strictEqual(byRow[ext.row_number].official_source_url, 'https://charlottenc.legistar.com/LegislationDetail.aspx?ID=30195&GUID=ED9BF41A-9FA1-461F-B469-E20838CBD84D');
    assert.strictEqual(byRow[adopt.row_number].official_source_url, 'https://charlottenc.legistar.com/LegislationDetail.aspx?ID=29662&GUID=23667E84-71E1-45CB-BE8C-5F501AA39205');
    for (const u of safe) {
      assert.strictEqual(u.verified, 'yes'); assert.strictEqual(u.verified_by, 'official');
      assert.deepStrictEqual(Object.keys(u).sort(), ['official_source_url', 'row_number', 'stage', 'verified', 'verified_by'], 'updates write only the verification columns');
    }
  },
  'federal bills match by bill number, not just by being national'() {
    const { safe } = simulate('main');
    const rows = fx('sheet_rows.json');
    const hr = rows.find(r => /9442/.test(r.headline)), senate = rows.find(r => /S\. 4214/.test(r.headline));
    assert(safe.some(u => u.row_number === hr.row_number), 'H.R. 9442 row verified');
    assert(!safe.some(u => u.row_number === senate.row_number), 'Senate companion bill not verified by the House bill');
  },
  'a state bill with no matching row becomes a new officially verified row'() {
    const { newRows } = simulate('main');
    assert.strictEqual(newRows.length, 1);
    const r = newRows[0];
    assert.strictEqual(r.jurisdiction, 'Virginia'); assert.strictEqual(r.found_via, 'openstates');
    assert.strictEqual(r.verified, 'yes'); assert.strictEqual(r.verified_by, 'official');
    assert.strictEqual(r.official_source_url, 'https://openstates.org/va/bills/2026/HB1234/');
    assert(!Object.keys(r).some(k => k.startsWith('_')), 'no helper fields in the sheet row');
  },
  'rows verified by a person are never changed'() {
    const { safe } = simulate('person');
    const charlotteRows = fx('sheet_rows.json').filter(r => r.jurisdiction === 'Charlotte, NC').map(r => r.row_number);
    assert(!safe.some(u => charlotteRows.includes(u.row_number)));
  },
  'ambiguous matches change nothing and are reported'() {
    const { safe, report } = simulate('ambiguous');
    const ext = fx('sheet_rows.json').find(r => r.jurisdiction === 'Charlotte, NC' && r.action_type === 'extended');
    assert(!safe.some(u => u.row_number === ext.row_number || u.row_number === 999));
    assert(/Ambiguous matches/.test(report.html));
  },
  'rows that changed during the run are not written, and the subject counts only written rows'() {
    const { safe, report } = simulate('moved');
    assert.strictEqual(safe.length, 0);
    assert(/^Moratorium official sources: 1 added, 0 verified/.test(report.subject));
  },
  'a 503 from Gemini is retried once; a 429 is not'() {
    const r503 = simulate('503');
    assert.strictEqual(r503.retries.filter(r => !r.json._none).length, 1);
    assert(r503.safe.some(u => /ID=30195/.test(u.official_source_url)), 'retried answer used');
    const q = simulate('quota');
    assert(q.retries.every(r => r.json._none));
    assert.strictEqual(q.safe.length + q.newRows.length, 0);
    assert(/429 RESOURCE_EXHAUSTED Quota exceeded/.test(q.report.html));
  },
  'an empty watch-list still runs the other sources and sends a report'() {
    const { report, safe } = simulate('empty');
    assert(safe.length >= 1);
    assert(/Council agendas: 0 place\(s\) searched/.test(report.html));
  },
};

let failed = 0;
for (const [name, fn] of Object.entries(tests)) {
  try { fn(); console.log('ok   -', name); } catch (e) { failed++; console.log('FAIL -', name, '\n      ', e.message); }
}
console.log(failed ? `${failed} failed` : `all ${Object.keys(tests).length} passed`);
process.exit(failed ? 1 : 0);
