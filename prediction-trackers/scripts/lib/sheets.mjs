// Google Sheets access for tracker evidence, using a service account and the
// Sheets REST API directly (no npm dependencies).
//
// Spreadsheet layout: one spreadsheet, two tabs per tracker:
//   "<slug> evidence"  columns EVIDENCE_COLUMNS
//   "<slug> actors"    columns ACTOR_COLUMNS
// The first row of each tab is the header row.

import { createSign } from 'node:crypto';

export const EVIDENCE_COLUMNS = ['id', 'date', 'status', 'signal_type', 'direction', 'actor', 'summary', 'source_url', 'added_by', 'added_on'];
export const ACTOR_COLUMNS = ['name', 'role', 'stance', 'influence', 'status', 'notes'];
export const STATUSES = ['proposed', 'approved', 'rejected'];

export const evidenceTab = slug => `${slug} evidence`;
export const actorsTab = slug => `${slug} actors`;

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const API = 'https://sheets.googleapis.com/v4/spreadsheets';
const b64url = buf => Buffer.from(buf).toString('base64url');

// ---- Row mapping (pure; tested without network) ----

function cell(v) {
  return v == null ? '' : String(v).trim();
}

// Turns sheet values (first row = headers) into objects keyed by header name.
// Unknown headers are kept; missing cells become ''.
export function rowsToObjects(values) {
  if (!values || values.length === 0) return [];
  const headers = values[0].map(h => cell(h).toLowerCase().replace(/\s+/g, '_'));
  return values.slice(1)
    .filter(r => r.some(c => cell(c) !== ''))
    .map((r, i) => {
      const obj = Object.fromEntries(headers.map((h, j) => [h, cell(r[j])]));
      obj._row = i + 2; // 1-based sheet row, for messages
      return obj;
    });
}

export function objectsToRows(objects, columns) {
  return objects.map(o => columns.map(c => (o[c] == null ? '' : o[c])));
}

const normStatus = s => cell(s).toLowerCase();

// Evidence rows ready for scoring. Status is case-insensitive; rows with an
// unknown status are ignored; approved rows missing a required field are
// reported as problems and left out, so a half-filled row never moves the
// probability.
export function parseEvidence(values, spec) {
  const types = new Set(spec.signals.map(s => s.type));
  const rows = [];
  const problems = [];
  for (const r of rowsToObjects(values)) {
    const status = normStatus(r.status);
    if (!STATUSES.includes(status)) {
      if (r.status) problems.push(`evidence row ${r._row}: unknown status "${r.status}"`);
      continue;
    }
    const row = { ...r, status, direction: cell(r.direction).toLowerCase(), signal_type: cell(r.signal_type).toLowerCase() };
    if (!row.id) row.id = `row-${r._row}`;
    if (status === 'approved') {
      const missing = ['date', 'signal_type', 'direction', 'summary', 'source_url'].filter(k => !row[k]);
      if (missing.length) { problems.push(`evidence row ${r._row}: approved but missing ${missing.join(', ')}`); continue; }
      if (!['yes', 'no'].includes(row.direction)) { problems.push(`evidence row ${r._row}: direction must be yes or no`); continue; }
      if (!types.has(row.signal_type)) { problems.push(`evidence row ${r._row}: unknown signal type "${row.signal_type}"`); continue; }
    }
    rows.push(row);
  }
  return { rows, problems };
}

export function parseActors(values) {
  const actors = [];
  const problems = [];
  for (const r of rowsToObjects(values)) {
    const status = normStatus(r.status);
    if (!STATUSES.includes(status)) {
      if (r.status) problems.push(`actors row ${r._row}: unknown status "${r.status}"`);
      continue;
    }
    const num = v => (v === '' ? null : Number(v));
    const influence = num(r.influence);
    const stance = num(r.stance);
    if (!r.name) { problems.push(`actors row ${r._row}: missing name`); continue; }
    if (status === 'approved' && !(Number.isInteger(influence) && influence >= 1 && influence <= 5)) {
      problems.push(`actors row ${r._row}: influence must be 1-5`);
      continue;
    }
    actors.push({ ...r, status, influence, stance: Number.isFinite(stance) ? stance : null });
  }
  return { actors, problems };
}

// Header + one approved row per actor in the specification.
export function initialActorRows(spec) {
  return [ACTOR_COLUMNS, ...objectsToRows(spec.actors.map(a => ({ ...a, status: 'approved', notes: 'From the tracker specification' })), ACTOR_COLUMNS)];
}

// Creates the two tabs for a tracker when they do not exist yet. Safe to run
// any number of times: existing tabs are left alone.
export async function ensureTrackerTabs(client, spec) {
  const existing = new Set(await client.listTabs());
  const created = [];
  if (!existing.has(evidenceTab(spec.slug))) {
    await client.addTab(evidenceTab(spec.slug));
    await client.append(evidenceTab(spec.slug), [EVIDENCE_COLUMNS]);
    created.push(evidenceTab(spec.slug));
  }
  if (!existing.has(actorsTab(spec.slug))) {
    await client.addTab(actorsTab(spec.slug));
    await client.append(actorsTab(spec.slug), initialActorRows(spec));
    created.push(actorsTab(spec.slug));
  }
  return created;
}

// ---- API client ----

export class SheetsError extends Error {}

export function parseServiceAccount(json) {
  if (!json) throw new SheetsError('GOOGLE_SERVICE_ACCOUNT_JSON is not set (repository secret)');
  let creds;
  try { creds = JSON.parse(json); } catch { throw new SheetsError('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON'); }
  if (!creds.client_email || !creds.private_key) throw new SheetsError('GOOGLE_SERVICE_ACCOUNT_JSON needs client_email and private_key');
  return creds;
}

export function signedJwt(creds, now = Math.floor(Date.now() / 1000)) {
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: creds.client_email, scope: SCOPE, aud: creds.token_uri || 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  return `${header}.${claims}.${b64url(signer.sign(creds.private_key))}`;
}

const quoteTab = name => `'${name.replace(/'/g, "''")}'`;

export class SheetsClient {
  constructor({ spreadsheetId, credentials, fetchImpl = fetch }) {
    if (!spreadsheetId) throw new SheetsError('PREDICTION_SPREADSHEET_ID is not set');
    this.id = spreadsheetId;
    this.creds = credentials;
    this.fetch = fetchImpl;
    this.token = null;
  }

  async auth() {
    if (this.token) return this.token;
    const res = await this.fetch(this.creds.token_uri || 'https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: signedJwt(this.creds) }),
    });
    if (!res.ok) throw new SheetsError(`Google auth failed: HTTP ${res.status} ${await res.text()}`);
    this.token = (await res.json()).access_token;
    return this.token;
  }

  async call(path, init = {}) {
    const res = await this.fetch(`${API}/${this.id}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${await this.auth()}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
    });
    if (!res.ok) throw new SheetsError(`Sheets API ${init.method || 'GET'} ${path}: HTTP ${res.status} ${await res.text()}`);
    return res.json();
  }

  async listTabs() {
    const meta = await this.call('?fields=sheets.properties.title');
    return (meta.sheets || []).map(s => s.properties.title);
  }

  async addTab(title) {
    await this.call(':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: [{ addSheet: { properties: { title } } }] }) });
  }

  async read(tab) {
    const range = encodeURIComponent(`${quoteTab(tab)}!A:Z`);
    const data = await this.call(`/values/${range}?valueRenderOption=FORMATTED_VALUE`);
    return data.values || [];
  }

  async append(tab, rows) {
    if (!rows.length) return;
    const range = encodeURIComponent(`${quoteTab(tab)}!A1`);
    await this.call(`/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
      method: 'POST', body: JSON.stringify({ values: rows }),
    });
  }
}

export function clientFromEnv(env = process.env) {
  if (!env.PREDICTION_SPREADSHEET_ID) throw new SheetsError('PREDICTION_SPREADSHEET_ID is not set (repository variable)');
  return new SheetsClient({
    spreadsheetId: env.PREDICTION_SPREADSHEET_ID,
    credentials: parseServiceAccount(env.GOOGLE_SERVICE_ACCOUNT_JSON),
  });
}
