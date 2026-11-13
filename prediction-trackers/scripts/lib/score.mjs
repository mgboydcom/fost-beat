// Deterministic scoring: base rate + approved evidence -> probability, history
// and the public data.json for a tracker.

import { isPastDeadline } from './tracker.mjs';

export const P_MIN = 0.01;
export const P_MAX = 0.99;

const logit = p => Math.log(p / (1 - p));
const sigmoid = x => 1 / (1 + Math.exp(-x));
const round4 = x => Math.round(x * 10000) / 10000;

// Only approved actors count; the factor is influence / 3, or 1 when the
// evidence names an actor not in the approved register.
export function actorFactor(actors, name) {
  const key = String(name || '').trim().toLowerCase();
  const actor = actors.find(a => a.status === 'approved' && a.name.trim().toLowerCase() === key);
  return actor ? actor.influence / 3 : 1;
}

export function contribution(spec, actors, row) {
  const signal = spec.signals.find(s => s.type === row.signal_type);
  if (!signal) return 0;
  const direction = row.direction === 'yes' ? 1 : row.direction === 'no' ? -1 : 0;
  return direction * signal.weight * actorFactor(actors, row.actor);
}

// Probability from the base rate and approved evidence. Resolved trackers are
// fixed at 1 or 0; otherwise the result stays within [P_MIN, P_MAX].
export function probability(spec, evidence, actors) {
  if (spec.status === 'resolved-yes') return 1;
  if (spec.status === 'resolved-no') return 0;
  let x = logit(spec.base_rate.p);
  for (const row of evidence) {
    if (row.status === 'approved') x += contribution(spec, actors, row);
  }
  return round4(Math.min(P_MAX, Math.max(P_MIN, sigmoid(x))));
}

// Adds a history entry when the probability changed (or when there is none
// yet). The entry lists the approved evidence not yet counted in an earlier
// entry, which is what moved the probability. Resolved trackers get one final
// entry with the outcome and are never changed after that.
export function updateHistory(previous, { p, date, approvedIds, spec }) {
  const history = previous ? previous.history.map(h => ({ ...h })) : [];
  const counted = new Set(history.flatMap(h => h.evidence_ids || []));
  const fresh = approvedIds.filter(id => !counted.has(id));
  const last = history[history.length - 1];

  if (last && last.outcome) return history;

  if (/^resolved-/.test(spec.status)) {
    history.push({
      date: spec.outcome.date,
      p,
      evidence_ids: fresh,
      outcome: spec.status === 'resolved-yes' ? 'yes' : 'no',
      source: spec.outcome.source,
    });
    return history;
  }
  if (!last || last.p !== p) history.push({ date, p, evidence_ids: fresh });
  return history;
}

const PUBLIC_EVIDENCE = ['id', 'date', 'signal_type', 'direction', 'actor', 'summary', 'source_url'];
const PUBLIC_ACTOR = ['name', 'role', 'stance', 'influence', 'notes'];
const pick = (obj, keys) => Object.fromEntries(keys.filter(k => obj[k] !== undefined && obj[k] !== '').map(k => [k, obj[k]]));

// Builds the public data.json. Only approved evidence and approved actors
// are included; proposed and rejected rows never leave the sheet.
export function buildData({ spec, evidence, actors, previous, today }) {
  const approvedEvidence = evidence
    .filter(r => r.status === 'approved')
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || String(a.id).localeCompare(String(b.id)));
  const approvedActors = actors.filter(a => a.status === 'approved');
  const p = probability(spec, approvedEvidence, approvedActors);
  const history = updateHistory(previous, { p, date: today, approvedIds: approvedEvidence.map(r => String(r.id)), spec });
  const changed = !previous || JSON.stringify(previous.history) !== JSON.stringify(history);
  const signalLabels = Object.fromEntries(spec.signals.map(s => [s.type, s.label]));

  return {
    slug: spec.slug,
    title: spec.title,
    question: spec.question,
    deadline: spec.deadline,
    resolution: spec.resolution,
    base_rate: spec.base_rate,
    status: spec.status,
    awaiting_resolution: spec.status === 'active' && isPastDeadline(spec, today),
    outcome: spec.outcome,
    probability: p,
    updated: changed ? today : previous.updated,
    history,
    signals: spec.signals,
    actors: approvedActors.map(a => pick(a, PUBLIC_ACTOR)),
    evidence: approvedEvidence.map(r => ({ ...pick(r, PUBLIC_EVIDENCE), signal_label: signalLabels[r.signal_type] || r.signal_type })),
  };
}
