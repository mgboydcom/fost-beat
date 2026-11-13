// Loading and validating tracker specifications (trackers/<slug>/tracker.json).

import { readFile, readdir } from 'node:fs/promises';
import { validate } from './validate.mjs';

export const TRACKERS_DIR = new URL('../../trackers/', import.meta.url);
const SCHEMA_URL = new URL('tracker.schema.json', TRACKERS_DIR);

let schemaCache;
export async function loadSchema() {
  schemaCache ??= JSON.parse(await readFile(SCHEMA_URL, 'utf8'));
  return schemaCache;
}

// A draft tracker (an idea that needs editorial input) only has to carry the
// fields that identify it; everything else is checked once it is active.
const DRAFT_REQUIRED = ['slug', 'title', 'status', 'strapi'];

export function validateTracker(schema, spec) {
  if (spec && spec.status === 'draft') {
    const draftSchema = { ...schema, required: DRAFT_REQUIRED };
    const errors = validate(draftSchema, spec);
    if (!Array.isArray(spec.needs_input) || spec.needs_input.length === 0) {
      errors.push('$: a draft tracker must list what it needs in "needs_input"');
    }
    return errors;
  }
  const errors = validate(schema, spec);
  if (spec && Array.isArray(spec.signals)) {
    const seen = new Set();
    for (const s of spec.signals) {
      if (seen.has(s.type)) errors.push(`$.signals: duplicate type "${s.type}"`);
      seen.add(s.type);
    }
  }
  if (spec && /^resolved-/.test(spec.status) && !spec.outcome) {
    errors.push('$: a resolved tracker must have an "outcome" with date and source');
  }
  return errors;
}

export class TrackerError extends Error {}

export async function loadTracker(slug, dir = TRACKERS_DIR) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) throw new TrackerError(`invalid tracker slug "${slug}"`);
  const url = new URL(`${slug}/tracker.json`, dir);
  let text;
  try {
    text = await readFile(url, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') throw new TrackerError(`tracker "${slug}" not found`);
    throw err;
  }
  let spec;
  try { spec = JSON.parse(text); } catch (err) { throw new TrackerError(`tracker "${slug}": invalid JSON (${err.message})`); }
  const errors = validateTracker(await loadSchema(), spec);
  if (errors.length) throw new TrackerError(`tracker "${slug}" is invalid:\n  ${errors.join('\n  ')}`);
  if (spec.slug !== slug) throw new TrackerError(`tracker "${slug}": slug field is "${spec.slug}"`);
  return spec;
}

// All tracker specifications in the trackers directory. Invalid ones are
// returned in `invalid` rather than thrown, so one bad file does not stop
// every other tracker from running.
export async function loadAllTrackers(dir = TRACKERS_DIR) {
  const entries = await readdir(dir, { withFileTypes: true });
  const trackers = [];
  const invalid = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    try {
      trackers.push(await loadTracker(e.name, dir));
    } catch (err) {
      if (err instanceof TrackerError) invalid.push({ slug: e.name, error: err.message });
      else throw err;
    }
  }
  return { trackers, invalid };
}

export function isPastDeadline(spec, today) {
  return Boolean(spec.deadline) && today > spec.deadline;
}

export function todayISO(now = new Date()) {
  return now.toISOString().slice(0, 10);
}
