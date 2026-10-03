// All upstream calls go through the same-origin proxy (server/proxy.mjs).
const PROXY_BASE = (import.meta.env.VITE_PROXY_BASE as string | undefined) ?? '/proxy';

export type Upstream = 'espn' | 'espn-web' | 'el' | 'el-live' | 'tbf' | 'fls' | 'fls-lite' | 'ntvspor' | 'trtspor' | 'fotomac' | 'eurohoops';

export class HttpError extends Error {
  constructor(
    public status: number,
    public url: string,
  ) {
    super(`HTTP ${status} for ${url}`);
    this.name = 'HttpError';
  }
}

export function proxyUrl(upstream: Upstream, path: string, params?: Record<string, string | number | undefined | null>) {
  const qs = new URLSearchParams();
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    }
  }
  const q = qs.toString();
  return `${PROXY_BASE}/${upstream}${path.startsWith('/') ? path : '/' + path}${q ? (path.includes('?') ? '&' : '?') + q : ''}`;
}

export async function getJson<T = any>(
  upstream: Upstream,
  path: string,
  params?: Record<string, string | number | undefined | null>,
  init?: RequestInit,
): Promise<T> {
  const url = proxyUrl(upstream, path, params);
  const res = await fetch(url, { headers: { accept: 'application/json' }, ...init });
  if (!res.ok) throw new HttpError(res.status, url);
  const text = await res.text();
  if (!text) return null as T;
  return JSON.parse(text) as T;
}

/** Like getJson but resolves to null on 404 / empty, for optional data. */
export async function getJsonOrNull<T = any>(
  upstream: Upstream,
  path: string,
  params?: Record<string, string | number | undefined | null>,
): Promise<T | null> {
  try {
    return await getJson<T>(upstream, path, params);
  } catch (err) {
    if (err instanceof HttpError && (err.status === 404 || err.status === 400 || err.status === 405)) return null;
    throw err;
  }
}

/** Raw text (RSS / Atom feeds). */
export async function getText(upstream: Upstream, path: string, params?: Record<string, string | number | undefined | null>): Promise<string> {
  const url = proxyUrl(upstream, path, params);
  const res = await fetch(url, { headers: { accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' } });
  if (!res.ok) throw new HttpError(res.status, url);
  return res.text();
}
