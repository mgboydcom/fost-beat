// Prediction tracker intake.
//
// Usage: node scripts/prediction-intake.mjs [--dry-run]
//
// 1. Records ideas whose intake pull request was closed without merging in
//    trackers/rejected.json (committed to the base branch).
// 2. Reads Strapi for posts, drafts included, tagged as prediction ideas.
// 3. For each idea with no tracker, no open intake pull request and not
//    rejected: drafts trackers/<slug>/tracker.json with the AI model and opens
//    a pull request from branch prediction/<entry-id>-<slug>.
//
// --dry-run prints what would happen and changes nothing (no git, no PRs).
// Needs STRAPI_URL, STRAPI_TOKEN, ANTHROPIC_API_KEY, PREDICTION_MODEL, and for
// real runs GH_TOKEN with permission to push branches and open PRs.
// Runs daily from .github/workflows/prediction-intake.yml.

import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { loadAllTrackers, loadSchema, TRACKERS_DIR, todayISO } from './lib/tracker.mjs';
import { strapiConfig, fetchIdeas, adminLink } from './lib/strapi.mjs';
import { modelFromEnv } from './lib/research.mjs';
import {
  BRANCH_PREFIX, safeId, branchName, entryIdFromBranch, classifyPullRequests, updateRejected, selectNewIdeas,
  specFromDraft, prBody, runDraft,
} from './lib/intake.mjs';

const REJECTED_URL = new URL('rejected.json', TRACKERS_DIR);
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], ...opts }).trim();

// Uses the REST API (not GraphQL) through gh. Output of --paginate with
// --jq is one JSON object per line.
function listIntakePullRequests() {
  const out = run('gh', ['api', '--paginate', 'repos/{owner}/{repo}/pulls?state=all&per_page=100',
    '--jq', '.[] | {headRefName: .head.ref, state: (if .state == "open" then "OPEN" elif .merged_at then "MERGED" else "CLOSED" end), mergedAt: .merged_at}']);
  return out.split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(pr => pr.headRefName.startsWith(BRANCH_PREFIX));
}

function createPullRequest({ base, branch, title, body }) {
  const out = run('gh', ['api', '-X', 'POST', 'repos/{owner}/{repo}/pulls',
    '-f', `title=${title}`, '-f', `head=${branch}`, '-f', `base=${base}`, '-f', `body=${body}`, '--jq', '.html_url']);
  return out;
}

function listRemoteIntakeBranches() {
  const out = run('git', ['ls-remote', '--heads', 'origin', `${BRANCH_PREFIX}*`]);
  return out.split('\n').filter(Boolean).map(l => l.split('refs/heads/')[1]);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const base = process.env.BASE_BRANCH || 'main';
  const cfg = strapiConfig();
  const model = modelFromEnv();
  const today = todayISO();
  const schema = await loadSchema();

  const { trackers, invalid } = await loadAllTrackers();
  for (const bad of invalid) console.log(`! ${bad.error}`);
  const trackerIds = new Set(trackers.map(t => safeId(t.strapi.id)));
  const existingSlugs = new Set([...trackers.map(t => t.slug), ...invalid.map(t => t.slug)]);
  const rejected = JSON.parse(await readFile(REJECTED_URL, 'utf8'));

  // Pull request state. In a dry run without gh access, assume none.
  let prs = [];
  let branches = [];
  try {
    prs = listIntakePullRequests();
    branches = listRemoteIntakeBranches();
  } catch (err) {
    if (!dryRun) throw err;
    console.log('(dry run: could not read pull requests; assuming none)');
  }
  const { open, closedUnmerged } = classifyPullRequests(prs);
  for (const b of branches) {
    const id = entryIdFromBranch(b);
    if (id && !closedUnmerged.has(id) && !prs.some(pr => pr.headRefName === b && pr.state !== 'OPEN')) open.add(id);
  }

  const upd = updateRejected(rejected, closedUnmerged, trackerIds);
  if (upd.added.length) {
    console.log(`Rejected (closed without merging): ${upd.added.join(', ')}`);
    if (!dryRun) {
      await writeFile(REJECTED_URL, JSON.stringify(upd.rejected, null, 2) + '\n');
      run('git', ['add', 'trackers/rejected.json']);
      run('git', ['commit', '-m', 'Record rejected prediction ideas']);
      run('git', ['pull', '--rebase', 'origin', base]);
      run('git', ['push', 'origin', `HEAD:${base}`]);
    }
  }

  const ideas = await fetchIdeas(cfg);
  console.log(`Strapi: ${ideas.length} tagged idea(s)`);
  const { ideas: fresh, skipped } = selectNewIdeas(ideas, { trackerIds, rejectedIds: new Set(upd.rejected.map(safeId)), openIds: open });
  for (const s of skipped) console.log(`- ${s.title || s.id}: ${s.reason}`);
  if (!fresh.length) { console.log('No new ideas.'); return; }

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const ai = new Anthropic();
  let failures = 0;
  for (const idea of fresh) {
    try {
      console.log(`Drafting: ${idea.title || idea.id}`);
      const draft = await runDraft(ai, { model, idea, today });
      const { spec, needsInput } = specFromDraft(draft, { idea, schema, existingSlugs });
      existingSlugs.add(spec.slug);
      const branch = branchName(idea.id, spec.slug);
      const link = adminLink(cfg, idea.id);
      const title = `${needsInput.length ? '[Needs input] ' : ''}Prediction tracker: ${spec.title}`;
      const body = prBody(spec, idea, link);
      const json = JSON.stringify(spec, null, 2) + '\n';

      if (dryRun) {
        console.log(`  would open ${branch}: ${title}\n${json}`);
        continue;
      }
      run('git', ['fetch', 'origin', base]);
      run('git', ['switch', '-c', branch, `origin/${base}`]);
      try {
        await mkdir(new URL(`${spec.slug}/`, TRACKERS_DIR), { recursive: true });
        await writeFile(new URL(`${spec.slug}/tracker.json`, TRACKERS_DIR), json);
        run('git', ['add', `trackers/${spec.slug}/tracker.json`]);
        run('git', ['commit', '-m', `Draft prediction tracker: ${spec.title}`]);
        run('git', ['push', '-u', 'origin', branch]);
        const url = createPullRequest({ base, branch, title, body });
        console.log(`  opened ${url}`);
      } finally {
        run('git', ['switch', base]);
      }
    } catch (err) {
      failures += 1;
      console.log(`! ${idea.title || idea.id}: ${err.message}`);
    }
  }
  if (failures) process.exitCode = 1;
}

main().catch(err => { console.error(`Error: ${err.message}`); process.exit(1); });
