import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { runScore, runResearchStep } from '../prediction-engine.mjs';
import { evidenceTab, actorsTab } from '../lib/sheets.mjs';
import { SUBMIT_TOOL } from '../lib/research.mjs';

const FIX = new URL('./fixtures/trackers/', import.meta.url);
const SLUG = 'example-act-2027';

async function tempTrackers() {
  const dir = await mkdtemp(join(tmpdir(), 'trackers-'));
  await cp(new URL(SLUG, FIX), join(dir, SLUG), { recursive: true });
  return { path: dir, url: pathToFileURL(dir + '/') };
}

class FakeSheets {
  constructor() { this.tabs = new Map(); }
  async listTabs() { return [...this.tabs.keys()]; }
  async addTab(t) { this.tabs.set(t, []); }
  async append(t, rows) { this.tabs.get(t).push(...rows); }
  async read(t) { return this.tabs.get(t) || []; }
}

const fakeAi = submission => ({ beta: { messages: { stream: () => ({ finalMessage: async () => ({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't', name: SUBMIT_TOOL, input: submission }] }) }) } } });
const quiet = () => {};

test('research -> approve -> score writes data.json end to end', async () => {
  const dir = await tempTrackers();
  try {
    const sheets = new FakeSheets();
    const ai = fakeAi({
      evidence: [
        { date: '2026-11-10', signal_type: 'committee_vote', direction: 'yes', actor: 'Example Committee', summary: 'Committee advanced the bill.', source_url: 'https://news.example.org/1' },
        { date: '2026-11-11', signal_type: 'public_statement', direction: 'no', actor: 'New Lobby', summary: 'Lobby opposed it.', source_url: 'https://news.example.org/2' },
        { date: '2026-11-11', signal_type: 'gossip', direction: 'no', actor: '', summary: 'x', source_url: 'https://news.example.org/3' },
      ],
      new_actors: [{ name: 'New Lobby', role: 'Trade group', notes: 'Opposes' }],
    });
    const r1 = await runResearchStep({ sheets, ai, model: 'm', dir: dir.url, today: '2026-11-13', log: quiet });
    assert.deepEqual(r1.summary, [{ slug: SLUG, added: 2, new_actors: 1, dropped: 1, awaiting_review: 2 }]);

    // Nothing approved yet: probability is the base rate.
    let s = await runScore({ sheets, dir: dir.url, today: '2026-11-13', log: quiet });
    assert.equal(s[0].probability, 0.2);
    assert.equal(s[0].awaiting_review, 3);
    let data = JSON.parse(await readFile(join(dir.path, SLUG, 'data.json'), 'utf8'));
    assert.equal(data.evidence.length, 0);

    // Second identical score run does not rewrite the file.
    s = await runScore({ sheets, dir: dir.url, today: '2026-11-14', log: quiet });
    assert.equal(s[0].written, false);

    // Editor approves the first evidence row.
    const ev = sheets.tabs.get(evidenceTab(SLUG));
    ev[1][2] = 'approved';
    s = await runScore({ sheets, dir: dir.url, today: '2026-11-15', log: quiet });
    assert.ok(s[0].probability > 0.2);
    assert.equal(s[0].written, true);
    data = JSON.parse(await readFile(join(dir.path, SLUG, 'data.json'), 'utf8'));
    assert.deepEqual(data.evidence.map(e => e.source_url), ['https://news.example.org/1']);
    assert.equal(data.history.length, 2);
    assert.equal(data.updated, '2026-11-15');
    assert.ok(!JSON.stringify(data).includes('New Lobby'));

    // Second research run: same sources are not proposed again.
    const r2 = await runResearchStep({ sheets, ai, model: 'm', dir: dir.url, today: '2026-11-20', log: quiet });
    assert.equal(r2.summary[0].added, 0);
    assert.equal(r2.summary[0].new_actors, 0);
    assert.equal(sheets.tabs.get(actorsTab(SLUG)).length, 4);
  } finally {
    await rm(dir.path, { recursive: true, force: true });
  }
});

test('research failure on one tracker is reported, not thrown', async () => {
  const dir = await tempTrackers();
  try {
    const ai = { beta: { messages: { stream: () => ({ finalMessage: async () => ({ stop_reason: 'refusal', content: [] }) }) } } };
    const lines = [];
    const r = await runResearchStep({ sheets: new FakeSheets(), ai, model: 'm', dir: dir.url, today: '2026-11-13', log: l => lines.push(l) });
    assert.equal(r.failures, 1);
    assert.ok(lines.some(l => l.includes('research failed')));
  } finally {
    await rm(dir.path, { recursive: true, force: true });
  }
});

test('CLI fails with a clear message when configuration is missing', async () => {
  const run = promisify(execFile);
  const script = new URL('../prediction-engine.mjs', import.meta.url).pathname;
  const env = { PATH: process.env.PATH };
  await assert.rejects(run('node', [script, 'score'], { env }), e => e.stderr.includes('PREDICTION_SPREADSHEET_ID is not set'));
  await assert.rejects(run('node', [script, 'score'], { env: { ...env, PREDICTION_SPREADSHEET_ID: 'x' } }), e => e.stderr.includes('GOOGLE_SERVICE_ACCOUNT_JSON is not set'));
  const sa = JSON.stringify({ client_email: 'a', private_key: 'b' });
  await assert.rejects(run('node', [script, 'research'], { env: { ...env, PREDICTION_SPREADSHEET_ID: 'x', GOOGLE_SERVICE_ACCOUNT_JSON: sa } }), e => e.stderr.includes('PREDICTION_MODEL is not set'));
  await assert.rejects(run('node', [script, 'nonsense'], { env }), e => e.stderr.includes('usage'));
});
