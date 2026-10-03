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
import {
  ERROR_TTL_S,
  MAX_STALE_LIVE_S,
  MAX_STALE_S,
  TIMEOUT_MS,
  UPSTREAMS,
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
  const h = { vary: 'origin', 'access-control-expose-headers': 'x-pota-cache, age' };
  if (allowed.includes('*')) h['access-control-allow-origin'] = '*';
  else if (origin && allowed.includes(origin)) h['access-control-allow-origin'] = origin;
  return h;
}

function reply(cors, status, type, body, extra = {}) {
  return new Response(body, {
    status,
    headers: { 'content-type': type, 'cache-control': 'no-store', ...cors, ...extra },
  });
}

const json = (cors, status, obj) => reply(cors, status, 'application/json; charset=utf-8', JSON.stringify(obj));

export default {
  /** @param {Request} request */
  async fetch(request, env, ctx) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...cors,
          'access-control-allow-methods': 'GET, POST, OPTIONS',
          'access-control-allow-headers': 'content-type, accept',
          'access-control-max-age': '86400',
        },
      });
    }

    const url = new URL(request.url);
    const raw = url.pathname + url.search;
    if (raw === '/' || raw === '/proxy' || raw === '/proxy/') {
      return json(cors, 200, { name: 'pota-proxy', upstreams: [...Object.keys(UPSTREAMS), 'fls-lite'] });
    }
    if (!raw.startsWith('/proxy/')) return json(cors, 404, { error: 'not found' });
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
      const { e, state, age } = await cached(ctx, key, target.url, method, reqBody, rule(target.upstream, target.path));
      return reply(cors, e.status, e.type, request.method === 'HEAD' ? null : e.body.slice(0), {
        'x-pota-cache': state,
        age: String(Math.round(age)),
      });
    } catch (err) {
      return json(cors, 502, { error: err?.name === 'TimeoutError' ? 'upstream timeout' : 'upstream unreachable' });
    }
  },
};
