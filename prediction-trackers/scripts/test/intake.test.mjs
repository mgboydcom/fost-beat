import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadSchema, validateTracker } from '../lib/tracker.mjs';
import {
  slugify, branchName, entryIdFromBranch, classifyPullRequests, updateRejected, selectNewIdeas, uniqueSlug,
  specFromDraft, prBody, runDraft, DRAFT_TOOL,
} from '../lib/intake.mjs';

const fixtureSpec = async () => JSON.parse(await readFile(new URL('./fixtures/trackers/example-act-2027/tracker.json', import.meta.url), 'utf8'));
const idea = { id: 'abc123xyz', title: 'Example Act by 2027', body: 'Will it pass?' };

test('slugs and branch names', () => {
  assert.equal(slugify('  Section 1033 → law by end of 2027! '), 'section-1033-law-by-end-of-2027');
  assert.equal(slugify(''), 'tracker');
  assert.equal(branchName('AbC-12', 'x-y'), 'prediction/abc12-x-y');
  assert.equal(entryIdFromBranch('prediction/abc12-x-y'), 'abc12');
  assert.equal(entryIdFromBranch('feature/abc12-x'), null);
  assert.equal(uniqueSlug('a', new Set(['a', 'a-2'])), 'a-3');
});

test('pull requests: open, merged and closed-unmerged', () => {
  const r = classifyPullRequests([
    { headRefName: 'prediction/aa-x', state: 'OPEN' },
    { headRefName: 'prediction/bb-x', state: 'CLOSED', mergedAt: null },
    { headRefName: 'prediction/cc-x', state: 'MERGED', mergedAt: '2026-11-01' },
    { headRefName: 'prediction/dd-x', state: 'CLOSED' },
    { headRefName: 'prediction/dd-y', state: 'OPEN' },
    { headRefName: 'other/ee-x', state: 'CLOSED' },
  ]);
  assert.deepEqual([...r.open].sort(), ['aa', 'dd']);
  assert.deepEqual([...r.closedUnmerged], ['bb']);
  assert.deepEqual([...r.merged], ['cc']);
});

test('rejected list only grows with new, untracked ids', () => {
  const r = updateRejected(['bb'], new Set(['bb', 'ff', 'gg']), new Set(['gg']));
  assert.deepEqual(r, { rejected: ['bb', 'ff'], added: ['ff'] });
});

test('each idea creates at most one tracker', () => {
  const ideas = [{ id: '1', title: 'a' }, { id: '2', title: 'b' }, { id: '3', title: 'c' }, { id: '4', title: 'd' }];
  const r = selectNewIdeas(ideas, { trackerIds: new Set(['1']), rejectedIds: new Set(['2']), openIds: new Set(['3']) });
  assert.deepEqual(r.ideas.map(i => i.id), ['4']);
  assert.deepEqual(r.skipped.map(s => s.reason), ['already has a tracker', 'rejected earlier', 'intake pull request already open']);
});

test('clear idea becomes an active, valid specification', async () => {
  const schema = await loadSchema();
  const f = await fixtureSpec();
  const draft = { resolvable: true, needs_input: [], slug: 'Example Act 2027', title: f.title, question: f.question, deadline: f.deadline,
    resolution: f.resolution, base_rate: f.base_rate, signals: f.signals, actors: f.actors, sources: f.sources, queries: [] };
  const { spec, needsInput } = specFromDraft(draft, { idea, schema, existingSlugs: new Set(['example-act-2027']) });
  assert.deepEqual(needsInput, []);
  assert.equal(spec.status, 'active');
  assert.equal(spec.slug, 'example-act-2027-2');
  assert.deepEqual(spec.strapi, { id: 'abc123xyz', title: 'Example Act by 2027' });
  assert.ok(!('queries' in spec));
  assert.deepEqual(validateTracker(schema, spec), []);
  assert.ok(prBody(spec, idea, 'https://cms.example.org/x').includes('Merging this pull request activates'));
});

test('vague idea becomes a draft listing what is missing, not an invented question', async () => {
  const schema = await loadSchema();
  const draft = { resolvable: false, needs_input: ['Which outcome should be predicted?', 'By when?'], slug: '', title: 'Open banking',
    question: '', deadline: '', resolution: { yes: '', no: '', source: '' }, base_rate: { p: 0, reasoning: '' }, signals: [],
    actors: [{ name: 'Some Regulator', role: 'Regulator', stance: 0, influence: 4 }], sources: [], queries: [] };
  const { spec, needsInput } = specFromDraft(draft, { idea: { id: '77', title: 'Open banking thoughts', body: 'Interesting area.' }, schema, existingSlugs: new Set() });
  assert.equal(spec.status, 'draft');
  assert.ok(!('question' in spec) && !('deadline' in spec) && !('resolution' in spec));
  assert.deepEqual(spec.actors, draft.actors);
  assert.ok(needsInput.includes('By when?'));
  assert.deepEqual(validateTracker(schema, spec), []);
  const body = prBody(spec, { id: '77', title: 'Open banking thoughts' }, null);
  assert.ok(body.includes('Needs editorial input') && body.includes('- By when?'));
});

test('resolvable but malformed draft is downgraded to draft with the errors listed', async () => {
  const schema = await loadSchema();
  const f = await fixtureSpec();
  const draft = { resolvable: true, needs_input: [], slug: 'x', title: 'X', question: f.question, deadline: '2027-13-40',
    resolution: f.resolution, base_rate: { p: 1.4, reasoning: 'Too sure of itself.' }, signals: f.signals, actors: f.actors, sources: f.sources, queries: [] };
  const { spec, needsInput } = specFromDraft(draft, { idea, schema, existingSlugs: new Set() });
  assert.equal(spec.status, 'draft');
  assert.ok(needsInput.some(n => n.includes('deadline')) && needsInput.some(n => n.includes('base_rate.p')));
  assert.equal(spec.question, f.question);
  assert.deepEqual(validateTracker(schema, spec), []);
});

test('runDraft returns the submitted draft', async () => {
  const submission = { resolvable: true };
  const client = { beta: { messages: { stream: () => ({ finalMessage: async () => ({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't', name: DRAFT_TOOL, input: submission }] }) }) } } };
  assert.equal(await runDraft(client, { model: 'm', idea, today: '2026-11-13' }), submission);
});
