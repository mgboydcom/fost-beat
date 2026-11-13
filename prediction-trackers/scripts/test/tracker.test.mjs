import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadSchema, validateTracker, loadTracker, loadAllTrackers, TrackerError } from '../lib/tracker.mjs';

const FIX = new URL('./fixtures/trackers/', import.meta.url);
const sample = async () => JSON.parse(await readFile(new URL('example-act-2027/tracker.json', FIX), 'utf8'));

test('valid sample passes schema validation', async () => {
  assert.deepEqual(validateTracker(await loadSchema(), await sample()), []);
});

test('missing resolution criteria fails', async () => {
  const spec = await sample();
  delete spec.resolution;
  const errors = validateTracker(await loadSchema(), spec);
  assert.ok(errors.some(e => e.includes('"resolution"')), errors.join('\n'));
});

test('bad values are reported', async () => {
  const spec = await sample();
  spec.deadline = '2027-02-30';
  spec.base_rate.p = 1.5;
  spec.actors[0].stance = 3;
  spec.signals.push({ type: 'committee_vote', label: 'Again', weight: 1 });
  spec.extra = true;
  const errors = validateTracker(await loadSchema(), spec);
  for (const part of ['deadline', 'base_rate.p', 'stance', 'duplicate type', 'unexpected "extra"']) {
    assert.ok(errors.some(e => e.includes(part)), `expected error about ${part}:\n${errors.join('\n')}`);
  }
});

test('draft needs only identity fields plus needs_input', async () => {
  const schema = await loadSchema();
  const draft = { slug: 'vague-idea', title: 'Vague idea', status: 'draft', strapi: { id: '9' }, needs_input: ['A deadline'] };
  assert.deepEqual(validateTracker(schema, draft), []);
  delete draft.needs_input;
  assert.ok(validateTracker(schema, draft).length > 0);
});

test('resolved tracker needs an outcome', async () => {
  const spec = await sample();
  spec.status = 'resolved-yes';
  assert.ok(validateTracker(await loadSchema(), spec).some(e => e.includes('outcome')));
  spec.outcome = { date: '2027-06-01', source: 'https://example.org/law' };
  assert.deepEqual(validateTracker(await loadSchema(), spec), []);
});

test('loadTracker: valid, invalid, missing', async () => {
  assert.equal((await loadTracker('example-act-2027', FIX)).slug, 'example-act-2027');
  await assert.rejects(loadTracker('broken', FIX), TrackerError);
  await assert.rejects(loadTracker('nope', FIX), /not found/);
  await assert.rejects(loadTracker('../etc', FIX), /invalid tracker slug/);
});

test('loadAllTrackers separates invalid trackers', async () => {
  const { trackers, invalid } = await loadAllTrackers(FIX);
  assert.deepEqual(trackers.map(t => t.slug), ['example-act-2027']);
  assert.deepEqual(invalid.map(t => t.slug), ['broken']);
});
