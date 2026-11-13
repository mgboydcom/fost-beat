// Looks up coordinates for every place in the moratorium tracker sheet and
// stores them in geocache.json, so the map doesn't have to geocode in each
// visitor's browser. Only places missing from the cache are looked up.
//
// Usage: node scripts/geocode.mjs
// Runs hourly from .github/workflows/geocode.yml.

import { readFile, writeFile } from 'node:fs/promises';

const SHEET_ID = '1Rcciv20Lippo6uRTu_Sk33c1Vul8lq2kcvz4NfkEdsk';
const SHEET_NAME = 'Moratoriums';
const CACHE_FILE = new URL('../geocache.json', import.meta.url);
const USER_AGENT = 'fost-beat-moratorium-map (https://github.com/mgboydcom/fost-beat)';

// Must match placeKey() in moratorium-map.html.
function placeKey(row) {
  const country = String(row.country || '').trim();
  const place = String(row.jurisdiction || '').trim();
  const level = String(row.level || '').trim().toLowerCase();
  const national = !place || level === 'national' || level === 'country' ||
    place.toLowerCase() === country.toLowerCase();
  return { key: (national ? '' : place + '|') + country, national, place, country };
}

async function loadRows() {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&headers=1&sheet=${encodeURIComponent(SHEET_NAME)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`sheet: HTTP ${res.status}`);
  const text = await res.text();
  const json = JSON.parse(text.slice(text.indexOf('(') + 1, text.lastIndexOf(')')));
  if (json.status === 'error') throw new Error('sheet not readable');
  const cols = json.table.cols.map(c => (c.label || c.id).trim().toLowerCase().replace(/\s+/g, '_'));
  return json.table.rows.map(r => Object.fromEntries(
    (r.c || []).map((cell, i) => [cols[i], cell ? (cell.f ?? cell.v) : ''])));
}

// Names in the sheet are often descriptive ("Amsterdam municipality",
// "EirGrid (greater Dublin area)"), which Nominatim can't match. Try the
// name as written, then simplified versions of it.
function nameVariants(place) {
  const out = [place];
  const add = v => { v = v.replace(/\s+/g, ' ').trim(); if (v && !out.includes(v)) out.push(v); };
  const generic = /\b(municipality|municipalities|province|region|prefecture|metropolitan area|area)\b/gi;
  const outer = place.replace(/\(.*?\)/g, '');
  add(outer.replace(generic, ''));
  add(outer.split(/\s+and\s+|\/|,/)[0].replace(generic, ''));
  for (const [, inner] of place.matchAll(/\((.*?)\)/g)) {
    add(inner.replace(/\b(greater|north|south|east|west|of|near)\b/gi, '').replace(generic, ''));
  }
  return out;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function nominatim(params) {
  // Nominatim's usage policy allows at most one request per second.
  await sleep(1100);
  const qs = new URLSearchParams({ format: 'jsonv2', limit: '1', ...params });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${qs}`, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' }
  });
  if (!res.ok) throw new Error(`nominatim: HTTP ${res.status}`);
  const [hit] = await res.json();
  return hit ? [+(+hit.lat).toFixed(5), +(+hit.lon).toFixed(5)] : null;
}

async function main() {
  let cache = {};
  try { cache = JSON.parse(await readFile(CACHE_FILE, 'utf8')); } catch {}

  const rows = await loadRows();
  const todo = new Map();
  for (const row of rows) {
    if (!row.country && !row.jurisdiction) continue;
    const p = placeKey(row);
    if (!(p.key in cache)) todo.set(p.key, p);
  }
  console.log(`${rows.length} rows, ${todo.size} places to look up`);

  let added = 0;
  for (const p of todo.values()) {
    const country = { country: p.country, featureType: 'country' };
    let ll = null;
    if (!p.national) {
      for (const name of nameVariants(p.place)) {
        ll = await nominatim({ q: `${name}, ${p.country}` });
        if (ll) break;
      }
    }
    ll ??= await nominatim(country);
    if (ll) { cache[p.key] = ll; added++; } else { console.warn(`not found: ${p.key}`); }
  }

  const sorted = Object.fromEntries(Object.keys(cache).sort().map(k => [k, cache[k]]));
  // One place per line, so the file is easy to read and fix by hand.
  const lines = Object.entries(sorted).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  await writeFile(CACHE_FILE, `{\n${lines.join(',\n')}\n}\n`);
  console.log(`added ${added}, cache has ${Object.keys(sorted).length} places`);
}

main().catch(err => { console.error(err); process.exit(1); });
