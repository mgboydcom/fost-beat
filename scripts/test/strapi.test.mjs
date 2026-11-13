import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { strapiConfig, buildQuery, fetchIdeas, bodyText } from '../lib/strapi.mjs';

const fx = async name => JSON.parse(await readFile(new URL(`./fixtures/strapi/${name}`, import.meta.url), 'utf8'));
const env = v => ({ STRAPI_URL: 'https://cms.example.org/', STRAPI_TOKEN: 'tok', STRAPI_VERSION: v });

function fakeFetch(pages) {
  const urls = [];
  const fn = async (url, init) => {
    urls.push({ url, auth: init.headers.Authorization });
    const page = Number(new URL(url).searchParams.get('pagination[page]'));
    return { ok: true, json: async () => pages[page - 1] };
  };
  fn.urls = urls;
  return fn;
}

test('config errors are clear', () => {
  assert.throws(() => strapiConfig({}), /STRAPI_URL is not set/);
  assert.throws(() => strapiConfig({ STRAPI_URL: 'x' }), /STRAPI_TOKEN is not set/);
  assert.throws(() => strapiConfig({ ...env('3') }), /must be 4 or 5/);
});

test('query asks for drafts in each version', () => {
  const q4 = new URL(buildQuery(strapiConfig(env('4')), 1));
  assert.equal(q4.pathname, '/api/posts');
  assert.equal(q4.searchParams.get('publicationState'), 'preview');
  assert.equal(q4.searchParams.get('filters[tags][name][$eqi]'), 'prediction-idea');
  const q5 = new URL(buildQuery(strapiConfig({ ...env('5'), STRAPI_TAG_FIELD: 'category', STRAPI_TAG_ATTRIBUTE: 'slug' }), 2));
  assert.equal(q5.searchParams.get('status'), 'draft');
  assert.equal(q5.searchParams.get('filters[category][slug][$eqi]'), 'prediction-idea');
  assert.equal(q5.searchParams.get('pagination[page]'), '2');
});

test('v4: pages through results, keeps tagged entries, strips HTML', async () => {
  const f = fakeFetch([await fx('v4-page1.json'), await fx('v4-page2.json')]);
  const ideas = await fetchIdeas(strapiConfig(env('4')), f);
  assert.equal(f.urls.length, 2);
  assert.equal(f.urls[0].auth, 'Bearer tok');
  assert.deepEqual(ideas.map(i => [i.id, i.title]), [['11', '1033 into law by end of 2027'], ['13', 'Second idea']]);
  assert.equal(ideas[0].body, 'Will Section 1033 become law ?');
});

test('v5: uses documentId, de-duplicates, flattens blocks', async () => {
  const ideas = await fetchIdeas(strapiConfig(env('5')), fakeFetch([await fx('v5.json')]));
  assert.deepEqual(ideas.map(i => i.id), ['abc123xyz']);
  assert.equal(ideas[0].body, 'Will Section 1033 become law?\nSecond paragraph.');
});

test('HTTP errors are reported with status', async () => {
  const f = async () => ({ ok: false, status: 401, text: async () => 'Unauthorized' });
  await assert.rejects(fetchIdeas(strapiConfig(env('5')), f), /HTTP 401 Unauthorized/);
});

test('bodyText handles odd values', () => {
  assert.equal(bodyText(null), '');
  assert.equal(bodyText(42), '');
  assert.equal(bodyText('# Heading\n\nText'), '# Heading\n\nText');
});
