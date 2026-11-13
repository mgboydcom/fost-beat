// Reads prediction ideas from Strapi: posts (drafts included) carrying the
// configured tag or category. Supports Strapi v4 and v5 REST responses.

export class StrapiError extends Error {}

export function strapiConfig(env = process.env) {
  const cfg = {
    url: (env.STRAPI_URL || '').replace(/\/+$/, ''),
    token: env.STRAPI_TOKEN || '',
    version: String(env.STRAPI_VERSION || '5'),
    collection: env.STRAPI_COLLECTION || 'posts',
    tagField: env.STRAPI_TAG_FIELD || 'tags',
    tagAttribute: env.STRAPI_TAG_ATTRIBUTE || 'name',
    tagValue: env.STRAPI_TAG_VALUE || 'prediction-idea',
    titleField: env.STRAPI_TITLE_FIELD || 'title',
    bodyField: env.STRAPI_BODY_FIELD || 'content',
    adminUrl: (env.STRAPI_ADMIN_URL || env.STRAPI_URL || '').replace(/\/+$/, ''),
    contentType: env.STRAPI_CONTENT_TYPE || 'api::post.post',
  };
  if (!cfg.url) throw new StrapiError('STRAPI_URL is not set (repository variable)');
  if (!cfg.token) throw new StrapiError('STRAPI_TOKEN is not set (repository secret)');
  if (!['4', '5'].includes(cfg.version)) throw new StrapiError(`STRAPI_VERSION must be 4 or 5, not "${cfg.version}"`);
  return cfg;
}

export function buildQuery(cfg, page) {
  const p = new URLSearchParams();
  p.set(`filters[${cfg.tagField}][${cfg.tagAttribute}][$eqi]`, cfg.tagValue);
  p.set('populate[0]', cfg.tagField);
  p.set('pagination[page]', String(page));
  p.set('pagination[pageSize]', '100');
  if (cfg.version === '4') p.set('publicationState', 'preview');
  else p.set('status', 'draft');
  return `${cfg.url}/api/${cfg.collection}?${p}`;
}

// Plain text from a string (HTML or Markdown) or Strapi v5 "blocks" JSON.
export function bodyText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ').trim();
  if (Array.isArray(value)) return value.map(bodyText).filter(Boolean).join('\n').trim();
  if (typeof value === 'object') {
    if (typeof value.text === 'string') return value.text;
    if (Array.isArray(value.children)) return value.children.map(bodyText).join(value.type === 'list' ? '\n' : '');
  }
  return '';
}

function tagNames(raw, attr) {
  if (!raw) return [];
  const v = raw.data !== undefined ? raw.data : raw; // v4 wraps relations in { data }
  const list = Array.isArray(v) ? v : v ? [v] : [];
  return list.map(t => String((t.attributes || t)[attr] ?? '')).filter(Boolean);
}

// Normalises one entry from either version to { id, title, body, tags, updatedAt }.
export function normaliseEntry(cfg, entry) {
  const attrs = cfg.version === '4' ? entry.attributes || {} : entry;
  const id = cfg.version === '4' ? String(entry.id) : String(entry.documentId || entry.id);
  return {
    id,
    title: String(attrs[cfg.titleField] || '').trim(),
    body: bodyText(attrs[cfg.bodyField]),
    tags: tagNames(attrs[cfg.tagField], cfg.tagAttribute),
    updatedAt: attrs.updatedAt || null,
  };
}

// Entries carrying the tag (case-insensitive), de-duplicated by id. The
// server-side filter already does this; checking again protects against a
// misconfigured field silently matching everything.
export function ideasFromResponses(cfg, responses) {
  const want = cfg.tagValue.toLowerCase();
  const byId = new Map();
  for (const res of responses) {
    for (const entry of res.data || []) {
      const e = normaliseEntry(cfg, entry);
      if (!e.tags.some(t => t.toLowerCase() === want)) continue;
      if (!byId.has(e.id)) byId.set(e.id, e);
    }
  }
  return [...byId.values()];
}

export async function fetchIdeas(cfg, fetchImpl = fetch) {
  const responses = [];
  for (let page = 1; page <= 50; page++) {
    const res = await fetchImpl(buildQuery(cfg, page), { headers: { Authorization: `Bearer ${cfg.token}` } });
    if (!res.ok) throw new StrapiError(`Strapi ${cfg.collection}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
    const json = await res.json();
    responses.push(json);
    const pageCount = json.meta?.pagination?.pageCount ?? 1;
    if (page >= pageCount) break;
  }
  return ideasFromResponses(cfg, responses);
}

// Link to the entry in the Strapi admin, for the pull request description.
export function adminLink(cfg, id) {
  return `${cfg.adminUrl}/admin/content-manager/collection-types/${cfg.contentType}/${encodeURIComponent(id)}`;
}
