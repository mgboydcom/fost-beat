// Intake: turns Strapi prediction ideas into tracker specifications.

import { validateTracker } from './tracker.mjs';

export const BRANCH_PREFIX = 'prediction/';

export const safeId = id => String(id).toLowerCase().replace(/[^a-z0-9]/g, '');

export function slugify(text, max = 60) {
  const s = String(text || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s.slice(0, max).replace(/-+$/, '') || 'tracker';
}

export const branchName = (entryId, slug) => `${BRANCH_PREFIX}${safeId(entryId)}-${slug}`;

export function entryIdFromBranch(branch) {
  if (!branch.startsWith(BRANCH_PREFIX)) return null;
  const m = /^([a-z0-9]+)-/.exec(branch.slice(BRANCH_PREFIX.length));
  return m ? m[1] : null;
}

// Splits intake pull requests (from `gh pr list --state all`) into entry ids
// with an open pull request and entry ids whose pull request was closed
// without merging.
export function classifyPullRequests(prs) {
  const open = new Set();
  const closedUnmerged = new Set();
  const merged = new Set();
  for (const pr of prs) {
    const id = entryIdFromBranch(pr.headRefName || '');
    if (!id) continue;
    if (pr.state === 'OPEN') open.add(id);
    else if (pr.state === 'MERGED' || pr.mergedAt) merged.add(id);
    else closedUnmerged.add(id);
  }
  // An idea retried after a rejection may have a newer open or merged PR.
  for (const id of [...open, ...merged]) closedUnmerged.delete(id);
  return { open, closedUnmerged, merged };
}

// New rejected list: the old one plus newly closed-unmerged entry ids.
export function updateRejected(rejected, closedUnmerged, trackerIds) {
  const set = new Set(rejected.map(safeId));
  const added = [];
  for (const id of closedUnmerged) {
    if (set.has(id) || trackerIds.has(id)) continue;
    set.add(id);
    added.push(id);
  }
  return { rejected: [...rejected, ...added], added };
}

// Ideas that need a new draft: no tracker, not rejected, no open pull request.
export function selectNewIdeas(ideas, { trackerIds, rejectedIds, openIds }) {
  const out = [];
  const skipped = [];
  for (const idea of ideas) {
    const id = safeId(idea.id);
    const reason = trackerIds.has(id) ? 'already has a tracker'
      : rejectedIds.has(id) ? 'rejected earlier'
      : openIds.has(id) ? 'intake pull request already open'
      : null;
    if (reason) skipped.push({ id: idea.id, title: idea.title, reason });
    else out.push(idea);
  }
  return { ideas: out, skipped };
}

export function uniqueSlug(base, existing) {
  let slug = base;
  for (let n = 2; existing.has(slug); n++) slug = `${base}-${n}`;
  return slug;
}

// ---- Drafting with the AI model ----

export const DRAFT_TOOL = 'submit_tracker';

export function draftToolDefinition() {
  const str = description => ({ type: 'string', description });
  return {
    name: DRAFT_TOOL,
    description: 'Submit the drafted tracker specification, once.',
    strict: true,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['resolvable', 'needs_input', 'slug', 'title', 'question', 'deadline', 'resolution', 'base_rate', 'signals', 'actors', 'sources', 'queries'],
      properties: {
        resolvable: { type: 'boolean', description: 'False if the idea cannot honestly be expressed as one yes/no question with a deadline.' },
        needs_input: { type: 'array', items: { type: 'string' }, description: 'What an editor must decide or supply. Required when resolvable is false.' },
        slug: str('Short lowercase-hyphenated name, e.g. "section-1033-law-2027".'),
        title: str('Short title.'),
        question: str('One yes/no question including the date.'),
        deadline: { type: 'string', format: 'date' },
        resolution: {
          type: 'object', additionalProperties: false, required: ['yes', 'no', 'source'],
          properties: { yes: str('What counts as YES.'), no: str('What counts as NO.'), source: str('Which source decides.') },
        },
        base_rate: {
          type: 'object', additionalProperties: false, required: ['p', 'reasoning'],
          properties: { p: { type: 'number', description: 'Starting probability, 0.01 to 0.99.' }, reasoning: str('Why, citing comparable cases.') },
        },
        signals: {
          type: 'array',
          items: {
            type: 'object', additionalProperties: false, required: ['type', 'label', 'weight'],
            properties: {
              type: str('lowercase_with_underscores'), label: str('Short label.'),
              weight: { type: 'number', description: 'Log-odds weight 0-3. Guide: 0.1 minor statement, 0.4 notable step, 1.0 decisive procedural step.' },
            },
          },
        },
        actors: {
          type: 'array',
          items: {
            type: 'object', additionalProperties: false, required: ['name', 'role', 'stance', 'influence'],
            properties: {
              name: { type: 'string' }, role: { type: 'string' },
              stance: { type: 'integer', description: '-2 strongly against the YES outcome ... +2 strongly for it.' },
              influence: { type: 'integer', description: '1 (minor) to 5 (decisive).' },
            },
          },
        },
        sources: {
          type: 'array',
          items: { type: 'object', additionalProperties: false, required: ['name', 'url'], properties: { name: { type: 'string' }, url: { type: 'string', format: 'uri' } } },
        },
        queries: { type: 'array', items: { type: 'string' } },
      },
    },
  };
}

export function draftPrompt(idea, today) {
  return [
    `An editor at FOSTBeat has proposed a prediction tracker. Today is ${today}.`,
    'Turn the idea into a tracker specification. Research the current state of the subject with web search first, so the base rate, actors and sources reflect what is actually happening now.',
    '',
    'Rules:',
    '- The question must be a single yes/no question with a specific deadline date, resolvable from a named public source.',
    '- Do not invent facts. If the idea is too vague to turn into such a question (no clear outcome or no timeframe), set resolvable to false and list in needs_input exactly what the editor must decide; fill the other fields with your best partial draft or empty values.',
    '- Base the base rate on comparable cases and the current state, and explain it.',
    '- Signal types are the kinds of event that would move the probability; give each a weight.',
    '- Actors are the people and bodies with real influence on the outcome.',
    '- Sources are primary places to check for developments.',
    '',
    `Idea title: ${idea.title || '(none)'}`,
    'Idea text:',
    idea.body || '(empty)',
    '',
    `When done, call ${DRAFT_TOOL} once.`,
  ].join('\n');
}

// Builds the tracker specification from the model's submission. Anything that
// fails validation turns the tracker into a draft that lists what is wrong,
// rather than publishing an invented or broken question.
export function specFromDraft(draft, { idea, schema, existingSlugs }) {
  const slug = uniqueSlug(slugify(draft.slug || draft.title || idea.title), existingSlugs);
  const pickTitle = [draft.title, idea.title, slug].map(t => String(t || '').trim()).find(t => t.length >= 3);
  const title = pickTitle || `Prediction ${slug}`;
  const strapi = { id: String(idea.id), ...(idea.title ? { title: idea.title } : {}) };
  const full = {
    slug, title, status: 'active', strapi,
    question: draft.question, deadline: draft.deadline, resolution: draft.resolution, base_rate: draft.base_rate,
    signals: draft.signals, actors: draft.actors, sources: draft.sources,
    ...(draft.queries?.length ? { queries: draft.queries } : {}),
  };
  const errors = validateTracker(schema, full);
  if (draft.resolvable && errors.length === 0) return { spec: full, needsInput: [] };

  const needs = [
    ...(draft.needs_input || []).filter(s => String(s).trim()),
    ...errors.map(e => `Fix in the draft: ${e}`),
  ];
  if (!needs.length) needs.push('The idea could not be turned into a yes/no question with a deadline.');
  // Keep only the well-formed parts of the partial draft, so the draft file
  // itself is valid and the editor can see what was usable.
  const draftSpec = { slug, title, status: 'draft', strapi, needs_input: needs };
  const baseErrors = validateTracker(schema, draftSpec).length;
  for (const k of ['question', 'deadline', 'resolution', 'base_rate', 'signals', 'actors', 'sources', 'queries']) {
    const v = full[k];
    if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) continue;
    if (validateTracker(schema, { ...draftSpec, [k]: v }).length === baseErrors) draftSpec[k] = v;
  }
  return { spec: draftSpec, needsInput: needs };
}

export function prBody(spec, idea, strapiLink) {
  const lines = [];
  if (spec.status === 'draft') {
    lines.push('**Needs editorial input.** This idea could not yet be turned into a resolvable question. Edit `tracker.json` on this branch, set `"status": "active"`, then merge.', '', '### What is missing', ...spec.needs_input.map(n => `- ${n}`), '');
  } else {
    lines.push('Drafted from a Strapi prediction idea. Review the question and resolution criteria carefully — they define what is being predicted. Merging this pull request activates the tracker.', '');
  }
  lines.push(`**Strapi idea:** ${strapiLink ? `[${idea.title || idea.id}](${strapiLink})` : `${idea.title || ''} (id ${idea.id})`}`, '');
  if (spec.question) lines.push(`**Question:** ${spec.question}`, '');
  if (spec.deadline) lines.push(`**Deadline:** ${spec.deadline}`, '');
  if (spec.resolution) lines.push(`**YES if:** ${spec.resolution.yes}`, `**NO if:** ${spec.resolution.no}`, `**Decided by:** ${spec.resolution.source}`, '');
  if (spec.base_rate) lines.push(`**Base rate:** ${Math.round(spec.base_rate.p * 100)}% — ${spec.base_rate.reasoning}`, '');
  if (spec.actors?.length) {
    lines.push('| Actor | Role | Stance | Influence |', '|---|---|---|---|', ...spec.actors.map(a => `| ${a.name} | ${a.role} | ${a.stance} | ${a.influence} |`), '');
  }
  if (spec.signals?.length) {
    lines.push('| Signal | Weight |', '|---|---|', ...spec.signals.map(s => `| ${s.label} (\`${s.type}\`) | ${s.weight} |`), '');
  }
  lines.push('Closing this pull request without merging adds the idea to `trackers/rejected.json`.');
  return lines.join('\n');
}

export async function runDraft(client, { model, idea, today, maxSearches = 8 }) {
  const tools = [{ type: 'web_search_20260209', name: 'web_search', max_uses: maxSearches }, draftToolDefinition()];
  const messages = [{ role: 'user', content: draftPrompt(idea, today) }];
  for (let turn = 0; turn < 8; turn++) {
    const response = await client.beta.messages.stream({
      model, max_tokens: 32000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
      output_config: { effort: 'high' }, tools, tool_choice: { type: 'auto' }, messages,
    }).finalMessage();
    if (response.stop_reason === 'refusal') throw new Error(`model declined to draft idea ${idea.id}`);
    const submit = response.content.find(b => b.type === 'tool_use' && b.name === DRAFT_TOOL);
    if (submit) return submit.input;
    messages.push({ role: 'assistant', content: response.content });
    if (response.stop_reason === 'pause_turn') continue;
    if (response.stop_reason === 'max_tokens') throw new Error(`drafting idea ${idea.id} ran out of output tokens`);
    messages.push({ role: 'user', content: `Call ${DRAFT_TOOL} now.` });
  }
  throw new Error(`drafting idea ${idea.id} did not finish`);
}
