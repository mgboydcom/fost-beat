// Research step: asks the AI model (with web search) for developments since
// the last run, then validates and de-duplicates what comes back before it is
// added to the sheet as proposed evidence.

import { isPastDeadline } from './tracker.mjs';

export const SUBMIT_TOOL = 'submit_evidence';

export function submitToolDefinition(spec) {
  return {
    name: SUBMIT_TOOL,
    description: 'Submit every relevant development found, once, after searching. Call exactly once; use an empty list if nothing new was found.',
    strict: true,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['evidence', 'new_actors'],
      properties: {
        evidence: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['date', 'signal_type', 'direction', 'actor', 'summary', 'source_url'],
            properties: {
              date: { type: 'string', format: 'date', description: 'Date the development happened (YYYY-MM-DD).' },
              signal_type: { type: 'string', enum: spec.signals.map(s => s.type) },
              direction: { type: 'string', enum: ['yes', 'no'], description: 'Whether it makes YES more or less likely.' },
              actor: { type: 'string', description: 'Main person or body involved; empty string if none.' },
              summary: { type: 'string', description: 'One factual sentence.' },
              source_url: { type: 'string', format: 'uri', description: 'Primary or reputable source for this development.' },
            },
          },
        },
        new_actors: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['name', 'role', 'notes'],
            properties: {
              name: { type: 'string' },
              role: { type: 'string' },
              notes: { type: 'string', description: 'Why this actor matters to the outcome.' },
            },
          },
        },
      },
    },
  };
}

export function buildPrompt(spec, { since, today, knownUrls }) {
  const lines = [
    `You are researching evidence for a prediction tracker published by FOSTBeat. Today is ${today}.`,
    '',
    `Question: ${spec.question}`,
    `Deadline: ${spec.deadline}`,
    `Resolves YES if: ${spec.resolution.yes}`,
    `Resolves NO if: ${spec.resolution.no}`,
    '',
    'Signal types (use only these):',
    ...spec.signals.map(s => `- ${s.type}: ${s.label}`),
    '',
    'Known actors:',
    ...spec.actors.map(a => `- ${a.name} (${a.role})`),
    '',
    'Sources worth checking:',
    ...spec.sources.map(s => `- ${s.name}: ${s.url}`),
    ...(spec.queries?.length ? ['', 'Suggested searches:', ...spec.queries.map(q => `- ${q}`)] : []),
    '',
    since
      ? `Find developments that happened after ${since} and that bear on the question.`
      : 'This is the first run: find the most important developments of the last 12 months that bear on the question.',
    'Each item needs a specific source URL that you actually found. Do not include anything you cannot source. Do not speculate or forecast; report events only.',
    'Report influential people or bodies not in the known actors list as new_actors.',
  ];
  if (knownUrls.length) {
    lines.push('', 'Already recorded (do not submit these URLs again):', ...knownUrls.map(u => `- ${u}`));
  }
  lines.push('', `When done, call ${SUBMIT_TOOL} once with everything you found.`);
  return lines.join('\n');
}

export function normaliseUrl(u) {
  try {
    const url = new URL(String(u).trim());
    url.hash = '';
    for (const k of [...url.searchParams.keys()]) if (/^utm_/i.test(k)) url.searchParams.delete(k);
    let s = url.toString();
    if (s.endsWith('/')) s = s.slice(0, -1);
    return s.toLowerCase();
  } catch {
    return null;
  }
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Validates submitted rows and returns sheet-ready evidence rows plus the
// reasons anything was dropped. `existingRows` are all evidence rows already
// in the sheet, in any status (so rejected sources are never proposed again).
export function prepareEvidence(submitted, { spec, existingRows, today, idPrefix }) {
  const types = new Set(spec.signals.map(s => s.type));
  const seen = new Set(existingRows.map(r => normaliseUrl(r.source_url)).filter(Boolean));
  const rows = [];
  const dropped = [];
  let n = 0;
  for (const item of submitted || []) {
    const url = normaliseUrl(item?.source_url);
    const reason =
      !url ? 'no valid source URL'
      : !/^https?:/.test(url) ? 'source is not a web URL'
      : seen.has(url) ? 'source already recorded'
      : !types.has(item.signal_type) ? `unknown signal type "${item.signal_type}"`
      : !['yes', 'no'].includes(item.direction) ? 'direction must be yes or no'
      : !DATE.test(item.date || '') ? 'missing or invalid date'
      : item.date > today ? 'date is in the future'
      : !String(item.summary || '').trim() ? 'missing summary'
      : null;
    if (reason) { dropped.push({ item, reason }); continue; }
    seen.add(url);
    n += 1;
    rows.push({
      id: `${idPrefix}-${String(n).padStart(2, '0')}`,
      date: item.date,
      status: 'proposed',
      signal_type: item.signal_type,
      direction: item.direction,
      actor: String(item.actor || '').trim(),
      summary: String(item.summary).trim(),
      source_url: String(item.source_url).trim(),
      added_by: 'research',
      added_on: today,
    });
  }
  return { rows, dropped };
}

// New actors not already in the register (by case-insensitive name), as
// proposed rows.
export function prepareActors(submitted, { existingActors }) {
  const known = new Set(existingActors.map(a => String(a.name).trim().toLowerCase()));
  const rows = [];
  for (const a of submitted || []) {
    const name = String(a?.name || '').trim();
    if (!name || known.has(name.toLowerCase())) continue;
    known.add(name.toLowerCase());
    rows.push({ name, role: String(a.role || '').trim(), stance: '', influence: '', status: 'proposed', notes: String(a.notes || '').trim() });
  }
  return rows;
}

// Which trackers the research step should run on, and why the others are
// skipped.
export function researchPlan(trackers, { today, only }) {
  const run = [];
  const skipped = [];
  for (const t of trackers) {
    if (only && t.slug !== only) continue;
    if (t.status !== 'active') skipped.push({ slug: t.slug, reason: t.status === 'draft' ? 'draft (needs editorial input)' : 'resolved' });
    else if (isPastDeadline(t, today)) skipped.push({ slug: t.slug, reason: 'past deadline, awaiting resolution' });
    else run.push(t);
  }
  return { run, skipped };
}

// The date research should search from: the most recent date research added
// rows, or null on the first run.
export function lastResearchDate(existingRows) {
  return existingRows.filter(r => r.added_by === 'research' && DATE.test(r.added_on || ''))
    .map(r => r.added_on).sort().at(-1) || null;
}

// ---- API call ----

export class ResearchError extends Error {}

export function modelFromEnv(env = process.env) {
  const model = env.PREDICTION_MODEL;
  if (!model) throw new ResearchError('PREDICTION_MODEL is not set (repository variable)');
  if (!env.ANTHROPIC_API_KEY) throw new ResearchError('ANTHROPIC_API_KEY is not set (repository secret)');
  return model;
}

const MAX_TURNS = 8;

// Runs the model with web search until it calls submit_evidence. Returns the
// tool input ({ evidence, new_actors }).
export async function runResearch(client, { model, spec, prompt, maxSearches = 10 }) {
  const tools = [
    { type: 'web_search_20260209', name: 'web_search', max_uses: maxSearches },
    submitToolDefinition(spec),
  ];
  const messages = [{ role: 'user', content: prompt }];
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const stream = client.beta.messages.stream({
      model,
      max_tokens: 32000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'high' },
      tools,
      tool_choice: { type: 'auto' },
      messages,
    });
    const response = await stream.finalMessage();
    if (response.stop_reason === 'refusal') throw new ResearchError(`model declined the research request for "${spec.slug}"`);
    const submit = response.content.find(b => b.type === 'tool_use' && b.name === SUBMIT_TOOL);
    if (submit) return submit.input;
    messages.push({ role: 'assistant', content: response.content });
    if (response.stop_reason === 'pause_turn') continue;
    if (response.stop_reason === 'max_tokens') throw new ResearchError(`research for "${spec.slug}" ran out of output tokens`);
    messages.push({ role: 'user', content: `Call ${SUBMIT_TOOL} now with what you found (an empty list if nothing).` });
  }
  throw new ResearchError(`research for "${spec.slug}" did not submit results after ${MAX_TURNS} turns`);
}
