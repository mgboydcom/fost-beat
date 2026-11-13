import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { generateKeyPairSync, createVerify } from 'node:crypto';
import {
  parseEvidence, parseActors, ensureTrackerTabs, signedJwt, SheetsClient, parseServiceAccount,
  EVIDENCE_COLUMNS, ACTOR_COLUMNS, evidenceTab, actorsTab,
} from '../lib/sheets.mjs';

const spec = async () => JSON.parse(await readFile(new URL('./fixtures/trackers/example-act-2027/tracker.json', import.meta.url), 'utf8'));

test('parseEvidence handles status case, unknown status and missing fields', async () => {
  const s = await spec();
  const values = [
    ['ID', 'Date', 'Status', 'Signal type', 'Direction', 'Actor', 'Summary', 'Source URL'],
    ['e1', '2026-11-01', 'Approved', 'committee_vote', 'YES', 'Example Committee', 'Voted', 'https://example.org/1'],
    ['e2', '2026-11-02', 'proposed', 'bill_introduced', 'yes', '', 'Introduced', 'https://example.org/2'],
    ['e3', '2026-11-03', 'maybe', 'bill_introduced', 'yes', '', 'Odd', 'https://example.org/3'],
    ['e4', '2026-11-04', 'approved', 'committee_vote', 'yes', '', '', 'https://example.org/4'],
    ['e5', '2026-11-05', 'approved', 'not_a_type', 'no', '', 'X', 'https://example.org/5'],
    ['e6', '2026-11-06', 'approved', 'committee_vote', 'sideways', '', 'X', 'https://example.org/6'],
    ['', '', '', '', '', '', '', ''],
    ['e7', '2026-11-07', '', 'committee_vote', 'yes', '', 'No status', 'https://example.org/7'],
  ];
  const { rows, problems } = parseEvidence(values, s);
  assert.deepEqual(rows.map(r => [r.id, r.status]), [['e1', 'approved'], ['e2', 'proposed']]);
  assert.equal(rows[0].direction, 'yes');
  assert.equal(problems.length, 4, problems.join('\n'));
  assert.ok(problems.some(p => p.includes('unknown status "maybe"')));
  assert.ok(problems.some(p => p.includes('missing summary')));
  assert.ok(problems.some(p => p.includes('unknown signal type')));
  assert.ok(problems.some(p => p.includes('direction')));
});

test('parseEvidence of an empty tab', async () => {
  assert.deepEqual(parseEvidence([], await spec()), { rows: [], problems: [] });
});

test('parseActors validates influence of approved actors', () => {
  const { actors, problems } = parseActors([
    ACTOR_COLUMNS,
    ['A', 'Role', '1', '5', 'approved', ''],
    ['B', 'Role', '-2', '9', 'approved', ''],
    ['C', 'Role', '', '', 'proposed', 'found by research'],
  ]);
  assert.deepEqual(actors.map(a => [a.name, a.influence]), [['A', 5], ['C', null]]);
  assert.equal(problems.length, 1);
});

class FakeSheets {
  constructor() { this.tabs = new Map([['Sheet1', []]]); this.calls = []; }
  async listTabs() { return [...this.tabs.keys()]; }
  async addTab(t) { this.calls.push(['addTab', t]); if (this.tabs.has(t)) throw new Error('exists'); this.tabs.set(t, []); }
  async append(t, rows) { this.calls.push(['append', t]); this.tabs.get(t).push(...rows); }
  async read(t) { return this.tabs.get(t) || []; }
}

test('ensureTrackerTabs creates tabs once, filled from the specification', async () => {
  const s = await spec();
  const fake = new FakeSheets();
  assert.deepEqual(await ensureTrackerTabs(fake, s), [evidenceTab(s.slug), actorsTab(s.slug)]);
  assert.deepEqual(fake.tabs.get(evidenceTab(s.slug)), [EVIDENCE_COLUMNS]);
  const { actors } = parseActors(fake.tabs.get(actorsTab(s.slug)));
  assert.deepEqual(actors.map(a => [a.name, a.status, a.influence]), [['Example Committee', 'approved', 5], ['Example Lobby', 'approved', 3]]);
  const callsAfterFirst = fake.calls.length;
  assert.deepEqual(await ensureTrackerTabs(fake, s), []);
  assert.equal(fake.calls.length, callsAfterFirst);
});

test('service-account JWT is signed RS256 and verifiable', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const creds = { client_email: 'bot@example.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
  const jwt = signedJwt(creds, 1000);
  const [h, c, sig] = jwt.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(h, 'base64url')), { alg: 'RS256', typ: 'JWT' });
  const claims = JSON.parse(Buffer.from(c, 'base64url'));
  assert.equal(claims.iss, creds.client_email);
  assert.equal(claims.exp, 4600);
  const v = createVerify('RSA-SHA256'); v.update(`${h}.${c}`);
  assert.ok(v.verify(publicKey, Buffer.from(sig, 'base64url')));
});

test('parseServiceAccount gives clear errors', () => {
  assert.throws(() => parseServiceAccount(''), /not set/);
  assert.throws(() => parseServiceAccount('{'), /not valid JSON/);
  assert.throws(() => parseServiceAccount('{}'), /client_email/);
});

test('SheetsClient sends the expected requests', async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const creds = { client_email: 'bot@x', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
  const seen = [];
  const fetchImpl = async (url, init = {}) => {
    seen.push({ url, method: init.method || 'GET', body: init.body });
    const json = url.includes('oauth2') ? { access_token: 'tok' }
      : url.includes('fields=sheets') ? { sheets: [{ properties: { title: "it's evidence" } }] }
      : url.includes('/values/') && !init.method ? { values: [['a']] } : {};
    return { ok: true, json: async () => json, text: async () => '' };
  };
  const c = new SheetsClient({ spreadsheetId: 'SID', credentials: creds, fetchImpl });
  assert.deepEqual(await c.listTabs(), ["it's evidence"]);
  assert.deepEqual(await c.read("it's evidence"), [['a']]);
  await c.append('t', [['x']]);
  await c.addTab('new');
  assert.equal(seen.filter(s => s.url.includes('oauth2')).length, 1);
  assert.ok(seen[2].url.includes(encodeURIComponent("'it''s evidence'!A:Z")));
  assert.ok(seen[3].url.includes(':append?valueInputOption=RAW'));
  assert.deepEqual(JSON.parse(seen[3].body), { values: [['x']] });
  assert.deepEqual(JSON.parse(seen[4].body), { requests: [{ addSheet: { properties: { title: 'new' } } }] });
});
