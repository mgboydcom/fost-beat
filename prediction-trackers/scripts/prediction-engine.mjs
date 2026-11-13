// Prediction tracker engine.
//
// Usage:
//   node scripts/prediction-engine.mjs research [--slug <slug>]
//   node scripts/prediction-engine.mjs score    [--slug <slug>]
//   node scripts/prediction-engine.mjs all      [--slug <slug>]   (research, then score)
//
// research: for each active tracker, finds new developments with the AI model
//           and adds them to the tracker's sheet as proposed evidence.
// score:    reads approved evidence and actors from the sheet, calculates the
//           probability and writes trackers/<slug>/data.json.
//
// Needs PREDICTION_SPREADSHEET_ID and GOOGLE_SERVICE_ACCOUNT_JSON; research
// also needs ANTHROPIC_API_KEY and PREDICTION_MODEL.
// Runs from .github/workflows/prediction-engine.yml.

import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { loadAllTrackers, TRACKERS_DIR, todayISO } from './lib/tracker.mjs';
import { buildData } from './lib/score.mjs';
import {
  clientFromEnv, ensureTrackerTabs, evidenceTab, actorsTab, parseEvidence, parseActors, rowsToObjects,
  objectsToRows, EVIDENCE_COLUMNS, ACTOR_COLUMNS,
} from './lib/sheets.mjs';
import { researchPlan, buildPrompt, runResearch, prepareEvidence, prepareActors, lastResearchDate, modelFromEnv } from './lib/research.mjs';

async function readJson(url) {
  try { return JSON.parse(await readFile(url, 'utf8')); } catch (err) { if (err.code === 'ENOENT') return null; throw err; }
}

async function loadTrackers(dir, only, log) {
  const { trackers, invalid } = await loadAllTrackers(dir);
  for (const bad of invalid) log(`! ${bad.error}`);
  if (only && !trackers.some(t => t.slug === only)) throw new Error(`tracker "${only}" not found or invalid`);
  return { trackers: only ? trackers.filter(t => t.slug === only) : trackers, invalid };
}

export async function runScore({ sheets, dir = TRACKERS_DIR, only, today = todayISO(), log = console.log }) {
  const { trackers } = await loadTrackers(dir, only, log);
  const summary = [];
  for (const spec of trackers) {
    if (spec.status === 'draft') { log(`- ${spec.slug}: draft, not scored`); continue; }
    await ensureTrackerTabs(sheets, spec);
    const ev = parseEvidence(await sheets.read(evidenceTab(spec.slug)), spec);
    const ac = parseActors(await sheets.read(actorsTab(spec.slug)));
    for (const p of [...ev.problems, ...ac.problems]) log(`  ! ${spec.slug} ${p}`);

    const dataUrl = new URL(`${spec.slug}/data.json`, dir);
    const previous = await readJson(dataUrl);
    const data = buildData({ spec, evidence: ev.rows, actors: ac.actors, previous, today });
    const text = JSON.stringify(data, null, 2) + '\n';
    const written = !previous || JSON.stringify(previous, null, 2) + '\n' !== text;
    if (written) await writeFile(dataUrl, text);

    const awaiting = ev.rows.filter(r => r.status === 'proposed').length + ac.actors.filter(a => a.status === 'proposed').length;
    summary.push({ slug: spec.slug, probability: data.probability, written, awaiting_review: awaiting, problems: ev.problems.length + ac.problems.length });
    log(`- ${spec.slug}: ${(data.probability * 100).toFixed(1)}%${written ? ' (data.json updated)' : ''}; ${awaiting} proposed row(s) awaiting review`);
  }
  return summary;
}

export async function runResearchStep({ sheets, ai, model, dir = TRACKERS_DIR, only, today = todayISO(), log = console.log }) {
  const { trackers } = await loadTrackers(dir, only, log);
  const { run, skipped } = researchPlan(trackers, { today, only });
  for (const s of skipped) log(`- ${s.slug}: skipped (${s.reason})`);
  const summary = [];
  let failures = 0;
  for (const spec of run) {
    try {
      await ensureTrackerTabs(sheets, spec);
      const existingRows = rowsToObjects(await sheets.read(evidenceTab(spec.slug)));
      const existingActors = rowsToObjects(await sheets.read(actorsTab(spec.slug)));
      const prompt = buildPrompt(spec, {
        since: lastResearchDate(existingRows), today,
        knownUrls: existingRows.map(r => r.source_url).filter(Boolean),
      });
      const result = await runResearch(ai, { model, spec, prompt });
      const idPrefix = `r${today.replace(/-/g, '')}`;
      const usedIds = new Set(existingRows.map(r => r.id));
      const { rows, dropped } = prepareEvidence(result.evidence, { spec, existingRows, today, idPrefix });
      for (const r of rows) { let k = 0; const base = r.id; while (usedIds.has(r.id)) r.id = `${base}-${++k}`; usedIds.add(r.id); }
      const actorRows = prepareActors(result.new_actors, { existingActors });
      await sheets.append(evidenceTab(spec.slug), objectsToRows(rows, EVIDENCE_COLUMNS));
      await sheets.append(actorsTab(spec.slug), objectsToRows(actorRows, ACTOR_COLUMNS));
      for (const d of dropped) log(`  · ${spec.slug}: dropped ${d.item?.source_url || '(no source)'}: ${d.reason}`);
      const awaiting = existingRows.filter(r => String(r.status).toLowerCase() === 'proposed').length + rows.length;
      summary.push({ slug: spec.slug, added: rows.length, new_actors: actorRows.length, dropped: dropped.length, awaiting_review: awaiting });
      log(`- ${spec.slug}: ${rows.length} new proposed row(s), ${actorRows.length} new actor(s); ${awaiting} evidence row(s) awaiting review`);
    } catch (err) {
      failures += 1;
      log(`! ${spec.slug}: research failed: ${err.message}`);
    }
  }
  return { summary, skipped, failures };
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  let only;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--slug') only = rest[++i];
    else throw new Error(`unknown argument ${rest[i]}`);
  }
  if (!['research', 'score', 'all'].includes(command)) throw new Error('usage: prediction-engine.mjs research|score|all [--slug <slug>]');
  return { command, only: only || undefined };
}

async function main() {
  const { command, only } = parseArgs(process.argv.slice(2));
  const sheets = clientFromEnv();
  let failed = false;
  if (command === 'research' || command === 'all') {
    const model = modelFromEnv();
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const ai = new Anthropic();
    console.log('Research');
    const { failures } = await runResearchStep({ sheets, ai, model, only });
    failed = failures > 0;
  }
  if (command === 'score' || command === 'all') {
    console.log('Score');
    await runScore({ sheets, only });
  }
  if (failed) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => { console.error(`Error: ${err.message}`); process.exit(1); });
}
