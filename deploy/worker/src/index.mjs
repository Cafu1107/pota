// Hosted data proxy for the GitHub Pages build of Pota (Cloudflare Worker).
//
// Same contract as server/proxy.mjs: GET /proxy/<upstream>/<path> forwards to an
// allowlisted upstream and adds CORS. Each isolate keeps an in-memory copy of
// recent responses and serves it while a fresh one loads in the background
// (stale-while-revalidate); concurrent misses for one key share one upstream call.
// Behind that, upstream GETs use the data center's edge cache (fetch `cf` options),
// so a cold isolate still answers in milliseconds. The Cache API itself is a no-op
// on *.workers.dev, which is why it is not used.

import { flsLite } from '../../../server/fls-lite.mjs';
import { handleComments, hashIp } from '../../../server/comments.mjs';
import {
  ERROR_TTL_S,
  MAX_STALE_LIVE_S,
  MAX_STALE_S,
  TIMEOUT_MS,
  UPSTREAMS,
  SAFE_HEADERS,
  UPSTREAM_HEADERS,
  isPostAllowed,
  resolveTarget,
  rule,
} from '../../../server/upstreams.mjs';

const MAX_ENTRIES = 600;
const MAX_BODY = 16 * 1024;

/** @typedef {{ status: number, type: string, body: ArrayBuffer, fetchedAt: number, ttl: number, hot: boolean, lite?: string }} Entry */
/** @type {Map<string, Entry>} */
const mem = new Map();
/** @type {Map<string, Promise<Entry>>} */
const inflight = new Map();

function remember(key, entry) {
  mem.delete(key);
  mem.set(key, entry);
  while (mem.size > MAX_ENTRIES) mem.delete(mem.keys().next().value);
}

function load(key, url, method, reqBody, meta) {
  let p = inflight.get(key);
  if (p) return p;
  p = (async () => {
    // GETs also go through Cloudflare's edge cache, which every isolate in the data center
    // shares (memory is per isolate). Live data keeps a shorter edge life so the two caches
    // together never add more than a few seconds.
    const edgeTtl = meta.hot ? Math.max(1, Math.floor(meta.ttl / 2)) : meta.ttl;
    const res = await fetch(url, {
      method,
      body: method === 'POST' ? reqBody || '{}' : undefined,
      headers: { ...UPSTREAM_HEADERS, ...(method === 'POST' ? { 'content-type': 'application/json' } : {}) },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      ...(method === 'GET' ? { cf: { cacheEverything: true, cacheTtlByStatus: { '200-299': edgeTtl, '404': ERROR_TTL_S, '500-599': 0 } } } : {}),
    });
    const body = await res.arrayBuffer();
    const ok = res.ok;
    const prev = mem.get(key);
    // Keep serving the last good copy when the upstream errors.
    if (!ok && prev && prev.status >= 200 && prev.status < 300) return prev;
    // A copy from a cache is already this old (never counted beyond its own fresh time).
    const servedAge = Math.min(Number(res.headers.get('age')) || 0, meta.ttl);
    /** @type {Entry} */
    const entry = {
      status: res.status,
      type: res.headers.get('content-type') || 'application/json',
      body,
      fetchedAt: Date.now() - servedAge * 1000,
      ttl: ok ? meta.ttl : res.status >= 500 ? 0 : ERROR_TTL_S,
      hot: meta.hot,
    };
    if (entry.ttl > 0) remember(key, entry);
    return entry;
  })();
  inflight.set(key, p);
  p.finally(() => inflight.delete(key)).catch(() => {});
  return p;
}

/** Fresh: serve. Stale but usable: serve and refresh in the background. Else: wait. */
async function cached(ctx, key, url, method, reqBody, meta) {
  const hit = mem.get(key);
  const now = Date.now();
  if (hit) {
    const age = (now - hit.fetchedAt) / 1000;
    if (age < hit.ttl) return { e: hit, state: 'HIT', age };
    if (age < (hit.hot ? MAX_STALE_LIVE_S : MAX_STALE_S)) {
      ctx.waitUntil(load(key, url, method, reqBody, meta).catch(() => {}));
      return { e: hit, state: 'STALE', age };
    }
  }
  try {
    return { e: await load(key, url, method, reqBody, meta), state: 'MISS', age: 0 };
  } catch (err) {
    if (hit) return { e: hit, state: 'STALE', age: (now - hit.fetchedAt) / 1000 };
    throw err;
  }
}

function corsHeaders(request, env) {
  const origin = request.headers.get('origin');
  const allowed = (env.ALLOWED_ORIGINS || '*').split(',').map((s) => s.trim());
  const h = { vary: 'origin', 'access-control-expose-headers': 'x-pota-cache, age, retry-after' };
  if (allowed.includes('*')) h['access-control-allow-origin'] = '*';
  else if (origin && allowed.includes(origin)) h['access-control-allow-origin'] = origin;
  return h;
}

function reply(cors, status, type, body, extra = {}) {
  return new Response(body, {
    status,
    headers: { 'content-type': type, 'cache-control': 'no-store', ...SAFE_HEADERS, ...cors, ...extra },
  });
}

// ---------- rate limits ----------
// Requests per address per minute. Counted per isolate (Cloudflare may spread one
// client over several), so these are generous ceilings that stop a script from
// burning the free plan or getting the Worker blocked by an upstream.
const LIMITS = { proxy: 300, read: 120, write: 12 };
const WINDOW_MS = 60_000;
/** @type {Map<string, { start: number, count: number }>} */
const windows = new Map();

/** Seconds to wait when over the limit, else 0. */
function overLimit(kind, ip, now = Date.now()) {
  const key = `${kind}|${ip}`;
  let w = windows.get(key);
  if (!w || now - w.start >= WINDOW_MS) {
    w = { start: now, count: 0 };
    windows.set(key, w);
  }
  w.count++;
  if (windows.size > 20_000) {
    for (const [k, v] of windows) if (now - v.start >= WINDOW_MS) windows.delete(k);
  }
  return w.count > LIMITS[kind] ? Math.max(1, Math.ceil((w.start + WINDOW_MS - now) / 1000)) : 0;
}

const BINDINGS = { proxy: 'LIMIT_PROXY', read: 'LIMIT_READ', write: 'LIMIT_WRITE' };

/** Seconds to wait, using the data-center-wide Rate Limiting binding when configured. */
async function limited(env, kind, ip) {
  const binding = env[BINDINGS[kind]];
  if (binding?.limit) {
    try {
      const { success } = await binding.limit({ key: ip || 'unknown' });
      return success ? 0 : 60;
    } catch {
      /* fall back to the per-isolate counters */
    }
  }
  return overLimit(kind, ip);
}

const tooMany = (cors, wait) =>
  reply(cors, 429, 'application/json; charset=utf-8', JSON.stringify({ error: 'rate', retryAfter: wait }), { 'retry-after': String(wait) });

const json = (cors, status, obj) => reply(cors, status, 'application/json; charset=utf-8', JSON.stringify(obj));

// ---------- comments (D1) ----------

/** @param {D1Database} db */
function d1Store(db) {
  const cols = 'id, game, name, body, created_at AS createdAt';
  return {
    async list(game, { after, before, limit }) {
      const where = after !== undefined ? ' AND id > ?2' : before !== undefined ? ' AND id < ?2' : '';
      const args = after !== undefined ? [game, after] : before !== undefined ? [game, before] : [game];
      const { results } = await db.prepare(`SELECT ${cols} FROM comments WHERE game = ?1 AND hidden = 0${where} ORDER BY id DESC LIMIT ${Number(limit)}`).bind(...args).all();
      return results;
    },
    async total(game) {
      const r = await db.prepare('SELECT COUNT(*) AS n FROM comments WHERE game = ?1 AND hidden = 0').bind(game).first();
      return r?.n ?? 0;
    },
    async recentByIp(ipHash, since) {
      const { results } = await db
        .prepare('SELECT game, body, created_at AS createdAt FROM comments WHERE ip_hash = ?1 AND created_at >= ?2 ORDER BY created_at DESC LIMIT 50')
        .bind(ipHash, since)
        .all();
      return results;
    },
    async insert(c) {
      const r = await db
        .prepare('INSERT INTO comments (game, name, body, created_at, ip_hash) VALUES (?1, ?2, ?3, ?4, ?5) RETURNING id')
        .bind(c.game, c.name, c.body, c.createdAt, c.ipHash)
        .first();
      return { id: r.id, game: c.game, name: c.name, body: c.body, createdAt: c.createdAt };
    },
    async report(id, ipHash) {
      if (!(await db.prepare('SELECT id FROM comments WHERE id = ?1').bind(id).first())) return null;
      await db.prepare('INSERT OR IGNORE INTO reports (comment_id, ip_hash) VALUES (?1, ?2)').bind(id, ipHash).run();
      const r = await db.prepare('SELECT COUNT(*) AS n FROM reports WHERE comment_id = ?1').bind(id).first();
      return r?.n ?? 0;
    },
    async hide(id) {
      const r = await db.prepare('UPDATE comments SET hidden = 1 WHERE id = ?1').bind(id).run();
      return (r.meta?.changes ?? 0) > 0;
    },
  };
}

async function comments(request, env, url, cors) {
  if (!env.DB) return json(cors, 503, { error: 'comments-disabled' });
  const body = request.method === 'POST' ? await request.text() : '';
  if (body.length > 8 * 1024) return json(cors, 413, { error: 'too-large' });
  const ip = request.headers.get('cf-connecting-ip') ?? '';
  try {
    const r = await handleComments(
      {
        method: request.method,
        path: url.pathname.slice('/api'.length),
        query: url.searchParams,
        body,
        ipHash: await hashIp(ip, env.IP_SALT || 'pota'),
        authorization: request.headers.get('authorization'),
      },
      d1Store(env.DB),
      { adminToken: env.ADMIN_TOKEN },
    );
    return reply(cors, r.status, 'application/json; charset=utf-8', JSON.stringify(r.body), r.headers ?? {});
  } catch {
    return json(cors, 500, { error: 'server' });
  }
}

export default {
  /** @param {Request} request */
  async fetch(request, env, ctx) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...cors,
          'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
          'access-control-allow-headers': 'content-type, accept, authorization',
          'access-control-max-age': '86400',
        },
      });
    }

    const url = new URL(request.url);
    const raw = url.pathname + url.search;
    if (raw === '/' || raw === '/proxy' || raw === '/proxy/') {
      return json(cors, 200, { name: 'pota-proxy', upstreams: [...Object.keys(UPSTREAMS), 'fls-lite'] });
    }
    const ip = request.headers.get('cf-connecting-ip') ?? '';
    if (url.pathname.startsWith('/api/')) {
      const wait = await limited(env, request.method === 'GET' ? 'read' : 'write', ip);
      return wait ? tooMany(cors, wait) : comments(request, env, url, cors);
    }
    if (!raw.startsWith('/proxy/')) return json(cors, 404, { error: 'not found' });
    const wait = await limited(env, 'proxy', ip);
    if (wait) return tooMany(cors, wait);
    const rest = raw.slice('/proxy/'.length);

    // /proxy/fls-lite/<geniusId>: compact live state for score lists.
    if (rest.startsWith('fls-lite/')) {
      const id = /^fls-lite\/(\d{4,12})$/.exec(rest)?.[1];
      if (!id) return json(cors, 400, { error: 'bad id' });
      const flsPath = `/data/${id}/data.json`;
      const target = `${UPSTREAMS.fls}${flsPath}`;
      try {
        const { e, age } = await cached(ctx, `GET ${target} `, target, 'GET', undefined, rule('fls', flsPath));
        if (e.status !== 200) return json(cors, e.status, { error: 'unavailable' });
        e.lite ??= JSON.stringify(flsLite(JSON.parse(new TextDecoder().decode(e.body))));
        return reply(cors, 200, 'application/json; charset=utf-8', e.lite, { 'x-pota-cache': 'DERIVED', age: String(Math.round(age)) });
      } catch {
        return json(cors, 502, { error: 'upstream unreachable' });
      }
    }

    const target = resolveTarget(rest);
    if ('error' in target) return json(cors, target.status, { error: target.error });

    const method = request.method === 'HEAD' ? 'GET' : request.method;
    let reqBody = '';
    if (method === 'POST') {
      if (!isPostAllowed(target.upstream, target.path)) return json(cors, 405, { error: 'method not allowed' });
      reqBody = await request.text();
      if (reqBody.length > MAX_BODY) return json(cors, 413, { error: 'body too large' });
    } else if (method !== 'GET') {
      return json(cors, 405, { error: 'method not allowed' });
    }

    try {
      const key = `${method} ${target.url} ${reqBody}`;
      const { e, state, age } = await cached(ctx, key, target.url, method, reqBody, rule(target.upstream, target.path + target.query));
      return reply(cors, e.status, e.type, request.method === 'HEAD' ? null : e.body.slice(0), {
        'x-pota-cache': state,
        age: String(Math.round(age)),
      });
    } catch (err) {
      return json(cors, 502, { error: err?.name === 'TimeoutError' ? 'upstream timeout' : 'upstream unreachable' });
    }
  },
};
