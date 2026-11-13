import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { probability, updateHistory, buildData, actorFactor, P_MIN, P_MAX } from '../lib/score.mjs';

const spec = async () => JSON.parse(await readFile(new URL('./fixtures/trackers/example-act-2027/tracker.json', import.meta.url), 'utf8'));
const row = (id, o = {}) => ({ id, date: '2026-11-01', status: 'approved', signal_type: 'committee_vote', direction: 'yes', actor: 'Somebody', summary: 's', source_url: `https://example.org/${id}`, ...o });
const actors = [
  { name: 'Example Committee', role: 'Committee', stance: 1, influence: 5, status: 'approved' },
  { name: 'Example Lobby', role: 'Trade group', stance: -2, influence: 3, status: 'proposed' },
];

test('no evidence equals base rate', async () => {
  const s = await spec();
  assert.equal(probability(s, [], actors), s.base_rate.p);
});

test('repeat runs give identical results', async () => {
  const s = await spec();
  const ev = [row('a'), row('b', { direction: 'no', signal_type: 'public_statement' })];
  assert.equal(probability(s, ev, actors), probability(s, ev, actors));
  const d1 = buildData({ spec: s, evidence: ev, actors, previous: null, today: '2026-11-13' });
  const d2 = buildData({ spec: s, evidence: ev, actors, previous: null, today: '2026-11-13' });
  assert.deepEqual(d1, d2);
});

test('only approved evidence counts, unknown signal types count zero', async () => {
  const s = await spec();
  const base = s.base_rate.p;
  assert.equal(probability(s, [row('a', { status: 'proposed' }), row('b', { status: 'rejected' })], actors), base);
  assert.equal(probability(s, [row('a', { signal_type: 'nonsense' })], actors), base);
  assert.ok(probability(s, [row('a')], actors) > base);
  assert.ok(probability(s, [row('a', { direction: 'no' })], actors) < base);
});

test('actor factor uses approved influence only', () => {
  assert.equal(actorFactor(actors, 'example committee'), 5 / 3);
  assert.equal(actorFactor(actors, 'Example Lobby'), 1); // proposed, not approved
  assert.equal(actorFactor(actors, 'Unknown'), 1);
});

test('bounds hold for strong one-sided evidence', async () => {
  const s = await spec();
  const many = n => Array.from({ length: n }, (_, i) => row(`r${i}`));
  assert.equal(probability(s, many(40), actors), P_MAX);
  assert.equal(probability(s, many(40).map(r => ({ ...r, direction: 'no' })), actors), P_MIN);
});

test('resolution overrides evidence', async () => {
  const s = await spec();
  assert.equal(probability({ ...s, status: 'resolved-yes' }, [row('a', { direction: 'no' })], actors), 1);
  assert.equal(probability({ ...s, status: 'resolved-no' }, [row('a')], actors), 0);
});

test('history: new entry only when probability changes, lists causing evidence', async () => {
  const s = await spec();
  const d1 = buildData({ spec: s, evidence: [], actors, previous: null, today: '2026-11-01' });
  assert.equal(d1.history.length, 1);
  assert.deepEqual(d1.history[0], { date: '2026-11-01', p: s.base_rate.p, evidence_ids: [] });

  const same = buildData({ spec: s, evidence: [row('x', { status: 'proposed' })], actors, previous: d1, today: '2026-11-05' });
  assert.equal(same.history.length, 1);
  assert.equal(same.updated, '2026-11-01');

  const d2 = buildData({ spec: s, evidence: [row('a'), row('b', { status: 'proposed' })], actors, previous: d1, today: '2026-11-08' });
  assert.equal(d2.history.length, 2);
  assert.deepEqual(d2.history[1].evidence_ids, ['a']);
  assert.equal(d2.updated, '2026-11-08');

  const d3 = buildData({ spec: s, evidence: [row('a'), row('b')], actors, previous: d2, today: '2026-11-15' });
  assert.deepEqual(d3.history[2].evidence_ids, ['b']);
});

test('resolved tracker gets one final entry and never changes after', async () => {
  const s = await spec();
  const d1 = buildData({ spec: s, evidence: [row('a')], actors, previous: null, today: '2026-11-01' });
  const resolved = { ...s, status: 'resolved-yes', outcome: { date: '2027-03-01', source: 'https://example.org/law' } };
  const d2 = buildData({ spec: resolved, evidence: [row('a')], actors, previous: d1, today: '2027-03-02' });
  assert.equal(d2.probability, 1);
  assert.deepEqual(d2.history.at(-1), { date: '2027-03-01', p: 1, evidence_ids: [], outcome: 'yes', source: 'https://example.org/law' });
  const d3 = buildData({ spec: resolved, evidence: [row('a'), row('z')], actors, previous: d2, today: '2027-04-01' });
  assert.deepEqual(d3.history, d2.history);
});

test('awaiting resolution after the deadline', async () => {
  const s = await spec();
  assert.equal(buildData({ spec: s, evidence: [], actors, previous: null, today: '2027-12-31' }).awaiting_resolution, false);
  assert.equal(buildData({ spec: s, evidence: [], actors, previous: null, today: '2028-01-01' }).awaiting_resolution, true);
});

test('data.json contains only approved evidence and actors', async () => {
  const s = await spec();
  const ev = [row('a'), row('b', { status: 'proposed' }), row('c', { status: 'rejected' }), { ...row('d'), added_by: 'research', added_on: '2026-11-02' }];
  const d = buildData({ spec: s, evidence: ev, actors, previous: null, today: '2026-11-13' });
  assert.deepEqual(d.evidence.map(e => e.id).sort(), ['a', 'd']);
  assert.ok(d.evidence.every(e => !('status' in e) && !('added_by' in e)));
  assert.equal(d.evidence[0].signal_label, 'Committee vote');
  assert.deepEqual(d.actors.map(a => a.name), ['Example Committee']);
  assert.ok(!JSON.stringify(d).includes('Example Lobby'));
});
