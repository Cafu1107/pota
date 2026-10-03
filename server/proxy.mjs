// Same-origin proxy for the upstream basketball data sources.
//
// The browser calls /proxy/<upstream>/<path>; this forwards to the upstream,
// which removes CORS problems (TBF only allows tbf.org.tr + localhost, FIBA
// LiveStats sends no CORS headers at all) and lets every client share one cache.
//
// Speed: responses are served from memory whenever possible. A stale copy is
// returned at once while a fresh one is fetched in the background
// (stale-while-revalidate), and "hot" live endpoints that clients are polling
// are refreshed on the server's own clock, so polls almost never wait on an
// upstream round trip.
//
// Zero dependencies: used by the Vite dev/preview servers (see vite.config.ts)
// and by the standalone production server (server/start.mjs).

import { gzipSync } from 'node:zlib';
import { flsLite } from './fls-lite.mjs';
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
} from './upstreams.mjs';

export { UPSTREAMS };

// Hot keys stop being refreshed once nobody has asked for them for this long.
const HOT_IDLE_S = 90;
const REFRESH_CONCURRENCY = 6;
const MAX_CACHE_BYTES = 192 * 1024 * 1024;

/**
 * @typedef {{ status:number, type:string, body:Buffer, gz?:Buffer, fetchedAt:number, ttl:number, hot:boolean,
 *   lastAccess:number, url:string, method:string, reqBody?:Buffer, size:number }} Entry
 */
/** @type {Map<string, Entry>} */
const cache = new Map();
/** @type {Map<string, Promise<Entry>>} */
const inflight = new Map();
let cacheBytes = 0;

function remember(key, entry) {
  const old = cache.get(key);
  if (old) cacheBytes -= old.size;
  cache.delete(key); // re-insert so Map order is recency order
  cache.set(key, entry);
  cacheBytes += entry.size;
  for (const [k, v] of cache) {
    if (cacheBytes <= MAX_CACHE_BYTES) break;
    cache.delete(k);
    cacheBytes -= v.size;
  }
}

async function fetchUpstream(url, method, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method,
      body,
      signal: ctrl.signal,
      headers: { ...UPSTREAM_HEADERS, ...(body ? { 'content-type': 'application/json' } : {}) },
    });
    const buf = Buffer.from(await res.arrayBuffer());
    return { status: res.status, type: res.headers.get('content-type') || 'application/json', body: buf };
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch (coalesced) and store; resolves with the new entry. */
function load(key, meta) {
  let p = inflight.get(key);
  if (p) return p;
  p = (async () => {
    const out = await fetchUpstream(meta.url, meta.method, meta.reqBody?.length ? meta.reqBody : meta.method === 'POST' ? '{}' : undefined);
    const ok = out.status >= 200 && out.status < 300;
    const prev = cache.get(key);
    // Keep serving the last good copy when the upstream errors.
    if (!ok && prev && prev.status >= 200 && prev.status < 300) return prev;
    /** @type {Entry} */
    const entry = {
      ...out,
      gz: out.body.length > 1024 ? gzipSync(out.body) : undefined,
      fetchedAt: Date.now(),
      ttl: ok ? meta.ttl : out.status >= 500 ? 0 : ERROR_TTL_S,
      hot: meta.hot,
      lastAccess: prev?.lastAccess ?? Date.now(),
      url: meta.url,
      method: meta.method,
      reqBody: meta.reqBody,
      size: out.body.length,
    };
    if (entry.ttl > 0) remember(key, entry);
    return entry;
  })();
  inflight.set(key, p);
  p.finally(() => inflight.delete(key)).catch(() => {});
  return p;
}

// Background refresher for hot keys that clients are actively polling.
let refreshing = 0;
const timer = setInterval(() => {
  const now = Date.now();
  for (const [key, e] of cache) {
    if (refreshing >= REFRESH_CONCURRENCY) break;
    if (!e.hot || inflight.has(key)) continue;
    if (now - e.lastAccess > HOT_IDLE_S * 1000) continue;
    if (now - e.fetchedAt < e.ttl * 1000) continue;
    refreshing++;
    load(key, e)
      .catch(() => {})
      .finally(() => refreshing--);
  }
}, 1000);
timer.unref?.();

function readBody(req, limit = 16 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('body too large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/**
 * @param {{cache?: string, gz?: Buffer, age?: number}} [opts]
 */
function send(req, res, status, type, body, opts = {}) {
  const headers = { 'content-type': type, 'cache-control': 'no-store' };
  if (opts.cache) headers['x-pota-cache'] = opts.cache;
  if (opts.age !== undefined) headers.age = String(Math.max(0, Math.round(opts.age)));
  let payload = body;
  const acceptsGzip = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  if (acceptsGzip && body.length > 1024) {
    payload = opts.gz ?? gzipSync(body);
    headers['content-encoding'] = 'gzip';
    headers.vary = 'accept-encoding';
  }
  res.writeHead(status, headers);
  res.end(req.method === 'HEAD' ? undefined : payload);
}

const json = (req, res, status, obj) => send(req, res, status, 'application/json; charset=utf-8', Buffer.from(JSON.stringify(obj)));

/** Cached GET through the same machinery; used by derived routes like fls-lite. */
async function cachedGet(upstream, path) {
  const base = UPSTREAMS[upstream];
  const url = new URL(base.replace(/\/$/, '') + path).href;
  const key = `GET ${url} `;
  const meta = { url, method: 'GET', ...rule(upstream, path) };
  const hit = cache.get(key);
  const now = Date.now();
  if (hit) {
    hit.lastAccess = now;
    const age = (now - hit.fetchedAt) / 1000;
    if (age < hit.ttl) return hit;
    if (age < (hit.hot ? MAX_STALE_LIVE_S : MAX_STALE_S)) {
      load(key, meta).catch(() => {});
      return hit;
    }
  }
  const e = await load(key, meta);
  e.lastAccess = now;
  return e;
}

// Derived JSON (fls-lite) is cached by the upstream entry it came from.
const derived = new WeakMap();

/**
 * Connect-style middleware. Calls next() for anything outside `prefix`.
 * @param {{prefix?: string}} [opts]
 */
export function createProxyMiddleware({ prefix = '/proxy' } = {}) {
  return async function potaProxy(req, res, next) {
    const rawUrl = req.url || '';
    if (!rawUrl.startsWith(prefix + '/')) return next?.();

    const rest = rawUrl.slice(prefix.length + 1); // "<upstream>/<path>?<query>"
    const slash = rest.indexOf('/');
    const upstream = slash === -1 ? rest : rest.slice(0, slash);
    const pathAndQuery = slash === -1 ? '/' : rest.slice(slash);

    // /proxy/fls-lite/<geniusId>: compact live state for score lists.
    if (upstream === 'fls-lite') {
      const id = /^\/(\d{4,12})$/.exec(pathAndQuery)?.[1];
      if (!id) return json(req, res, 400, { error: 'bad id' });
      try {
        const e = await cachedGet('fls', `/data/${id}/data.json`);
        if (e.status !== 200) return json(req, res, e.status, { error: 'unavailable' });
        let lite = derived.get(e);
        if (!lite) {
          lite = Buffer.from(JSON.stringify(flsLite(JSON.parse(e.body.toString('utf8')))));
          derived.set(e, lite);
        }
        return send(req, res, 200, 'application/json; charset=utf-8', lite, { cache: 'DERIVED', age: (Date.now() - e.fetchedAt) / 1000 });
      } catch {
        return json(req, res, 502, { error: 'upstream unreachable' });
      }
    }

    const target = resolveTarget(rest);
    if ('error' in target) return json(req, res, target.status, { error: target.error });
    const upstreamPath = target.path;
    const joined = new URL(target.url);

    const method = req.method === 'HEAD' ? 'GET' : req.method || 'GET';
    let reqBody;
    if (method === 'POST') {
      if (!isPostAllowed(upstream, upstreamPath)) return json(req, res, 405, { error: 'method not allowed' });
      try {
        reqBody = await readBody(req);
      } catch {
        return json(req, res, 413, { error: 'body too large' });
      }
    } else if (method !== 'GET') {
      return json(req, res, 405, { error: 'method not allowed' });
    }

    const key = `${method} ${joined.href} ${reqBody ? reqBody.toString('utf8') : ''}`;
    const meta = { url: joined.href, method, reqBody, ...rule(upstream, upstreamPath + target.query) };
    const now = Date.now();
    const hit = cache.get(key);

    if (hit) {
      hit.lastAccess = now;
      const age = (now - hit.fetchedAt) / 1000;
      if (age < hit.ttl) return send(req, res, hit.status, hit.type, hit.body, { cache: 'HIT', gz: hit.gz, age });
      if (age < (hit.hot ? MAX_STALE_LIVE_S : MAX_STALE_S)) {
        load(key, meta).catch(() => {});
        return send(req, res, hit.status, hit.type, hit.body, { cache: 'STALE', gz: hit.gz, age });
      }
    }

    try {
      const e = await load(key, meta);
      e.lastAccess = now;
      return send(req, res, e.status, e.type, e.body, { cache: 'MISS', gz: e.gz, age: 0 });
    } catch (err) {
      if (hit) return send(req, res, hit.status, hit.type, hit.body, { cache: 'STALE', gz: hit.gz });
      return json(req, res, 502, { error: err?.name === 'AbortError' ? 'upstream timeout' : 'upstream unreachable' });
    }
  };
}

/** Warm the caches every first visit needs (league ids, current rounds). */
export function prewarm() {
  const year = new Date().getMonth() >= 6 ? new Date().getFullYear() : new Date().getFullYear() - 1;
  const paths = [
    ['tbf', '/api/League/get-featured-9-leagues'],
    ['el', `/v2/competitions/E/seasons/E${year}/rounds`],
    ['el', `/v2/competitions/U/seasons/U${year}/rounds`],
  ];
  for (const [u, p] of paths) cachedGet(u, p).catch(() => {});
}
