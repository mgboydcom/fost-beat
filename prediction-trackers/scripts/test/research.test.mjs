import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  prepareEvidence, prepareActors, researchPlan, lastResearchDate, normaliseUrl, buildPrompt,
  runResearch, modelFromEnv, submitToolDefinition, SUBMIT_TOOL,
} from '../lib/research.mjs';

const spec = async () => JSON.parse(await readFile(new URL('./fixtures/trackers/example-act-2027/tracker.json', import.meta.url), 'utf8'));
const item = (o = {}) => ({ date: '2026-11-10', signal_type: 'committee_vote', direction: 'yes', actor: 'Example Committee', summary: 'The committee voted.', source_url: 'https://news.example.org/a', ...o });

test('valid rows become proposed sheet rows', async () => {
  const s = await spec();
  const { rows, dropped } = prepareEvidence([item()], { spec: s, existingRows: [], today: '2026-11-13', idPrefix: 'r20261113' });
  assert.equal(dropped.length, 0);
  assert.deepEqual(rows[0], {
    id: 'r20261113-01', date: '2026-11-10', status: 'proposed', signal_type: 'committee_vote', direction: 'yes',
    actor: 'Example Committee', summary: 'The committee voted.', source_url: 'https://news.example.org/a', added_by: 'research', added_on: '2026-11-13',
  });
});

test('rows without a source, bad fields or future dates are dropped', async () => {
  const s = await spec();
  const { rows, dropped } = prepareEvidence([
    item({ source_url: '' }), item({ source_url: 'not a url' }), item({ source_url: 'ftp://x.org/a' }),
    item({ signal_type: 'rumour', source_url: 'https://a.org/1' }), item({ direction: 'maybe', source_url: 'https://a.org/2' }),
    item({ date: '', source_url: 'https://a.org/3' }), item({ date: '2026-12-01', source_url: 'https://a.org/4' }),
    item({ summary: '  ', source_url: 'https://a.org/5' }),
  ], { spec: s, existingRows: [], today: '2026-11-13', idPrefix: 'r' });
  assert.equal(rows.length, 0);
  assert.deepEqual(dropped.map(d => d.reason), [
    'no valid source URL', 'no valid source URL', 'source is not a web URL', 'unknown signal type "rumour"',
    'direction must be yes or no', 'missing or invalid date', 'date is in the future', 'missing summary',
  ]);
});

test('duplicates: against any existing status, and within one batch', async () => {
  const s = await spec();
  const existingRows = [
    { source_url: 'https://news.example.org/a', status: 'rejected' },
    { source_url: 'https://news.example.org/b/', status: 'approved' },
  ];
  const { rows, dropped } = prepareEvidence([
    item(), item({ source_url: 'https://NEWS.example.org/b?utm_source=x#top' }),
    item({ source_url: 'https://news.example.org/c' }), item({ source_url: 'https://news.example.org/c' }),
  ], { spec: s, existingRows, today: '2026-11-13', idPrefix: 'r' });
  assert.deepEqual(rows.map(r => r.source_url), ['https://news.example.org/c']);
  assert.equal(dropped.filter(d => d.reason === 'source already recorded').length, 3);
});

test('normaliseUrl', () => {
  assert.equal(normaliseUrl('https://Ex.org/a/?utm_medium=x&id=2#f'), 'https://ex.org/a/?id=2');
  assert.equal(normaliseUrl('nope'), null);
});

test('new actors are proposed once and known actors skipped', () => {
  const rows = prepareActors(
    [{ name: 'example committee', role: 'x', notes: '' }, { name: 'New Senator', role: 'Senator', notes: 'Sponsor' }, { name: 'new senator', role: '', notes: '' }, { name: '' }],
    { existingActors: [{ name: 'Example Committee' }] },
  );
  assert.deepEqual(rows, [{ name: 'New Senator', role: 'Senator', stance: '', influence: '', status: 'proposed', notes: 'Sponsor' }]);
});

test('research plan skips draft, resolved and past-deadline trackers', async () => {
  const s = await spec();
  const trackers = [
    s,
    { ...s, slug: 'old', deadline: '2026-01-01' },
    { ...s, slug: 'done', status: 'resolved-no' },
    { slug: 'idea', status: 'draft' },
  ];
  const { run, skipped } = researchPlan(trackers, { today: '2026-11-13' });
  assert.deepEqual(run.map(t => t.slug), ['example-act-2027']);
  assert.deepEqual(skipped, [
    { slug: 'old', reason: 'past deadline, awaiting resolution' },
    { slug: 'done', reason: 'resolved' },
    { slug: 'idea', reason: 'draft (needs editorial input)' },
  ]);
  assert.deepEqual(researchPlan(trackers, { today: '2026-11-13', only: 'old' }).run, []);
});

test('lastResearchDate ignores editor rows', () => {
  assert.equal(lastResearchDate([]), null);
  assert.equal(lastResearchDate([
    { added_by: 'research', added_on: '2026-11-01' }, { added_by: 'research', added_on: '2026-11-08' }, { added_by: 'Jo', added_on: '2026-11-12' },
  ]), '2026-11-08');
});

test('prompt carries the specification and known URLs', async () => {
  const s = await spec();
  const p = buildPrompt(s, { since: '2026-11-01', today: '2026-11-13', knownUrls: ['https://a.org/1'] });
  for (const part of [s.question, 'committee_vote', 'Example Lobby', 'after 2026-11-01', 'https://a.org/1', SUBMIT_TOOL]) assert.ok(p.includes(part), part);
  assert.deepEqual(submitToolDefinition(s).input_schema.properties.evidence.items.properties.signal_type.enum, ['bill_introduced', 'committee_vote', 'public_statement']);
});

test('missing configuration gives clear errors', () => {
  assert.throws(() => modelFromEnv({ ANTHROPIC_API_KEY: 'k' }), /PREDICTION_MODEL is not set/);
  assert.throws(() => modelFromEnv({ PREDICTION_MODEL: 'm' }), /ANTHROPIC_API_KEY is not set/);
});

function fakeClient(responses) {
  const requests = [];
  return {
    requests,
    beta: { messages: { stream: req => { requests.push(structuredClone(req)); const r = responses.shift(); return { finalMessage: async () => r }; } } },
  };
}

test('runResearch resumes paused turns and returns the submission', async () => {
  const s = await spec();
  const submission = { evidence: [item()], new_actors: [] };
  const client = fakeClient([
    { stop_reason: 'pause_turn', content: [{ type: 'server_tool_use', id: 's1', name: 'web_search', input: {} }] },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Done searching.' }] },
    { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: SUBMIT_TOOL, input: submission }] },
  ]);
  assert.deepEqual(await runResearch(client, { model: 'm', spec: s, prompt: 'p' }), submission);
  assert.equal(client.requests.length, 3);
  assert.equal(client.requests[1].messages.length, 2); // paused turn re-sent with no extra user message
  assert.equal(client.requests[2].messages.at(-1).role, 'user'); // nudge after end_turn without submission
  assert.equal(client.requests[0].tools[0].type, 'web_search_20260209');
  assert.equal(client.requests[0].fallbacks, 'default');
});

test('runResearch reports refusals', async () => {
  const s = await spec();
  const client = fakeClient([{ stop_reason: 'refusal', content: [] }]);
  await assert.rejects(runResearch(client, { model: 'm', spec: s, prompt: 'p' }), /declined/);
});
