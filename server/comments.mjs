// Game comments API, shared by the local server (server/comments-local.mjs, a JSON
// file) and the hosted one (deploy/worker, Cloudflare D1). Storage is behind a
// small interface so the rules below are the same everywhere.
//
//   GET    /comments?game=<league>:<id>[&before=<id>|&after=<id>]
//   POST   /comments                  { game, name, body, website }   (website: honeypot)
//   POST   /comments/<id>/report
//   DELETE /comments/<id>             Authorization: Bearer <admin token>

import { moderate } from './moderation.mjs';

/**
 * @typedef {{ id: number, game: string, name: string, body: string, createdAt: number }} Comment
 * @typedef {{
 *   list(game: string, opts: { after?: number, before?: number, limit: number }): Promise<Comment[]>,
 *   total(game: string): Promise<number>,
 *   recentByIp(ipHash: string, since: number): Promise<Array<{ game: string, body: string, createdAt: number }>>,
 *   insert(c: { game: string, name: string, body: string, createdAt: number, ipHash: string }): Promise<Comment>,
 *   report(id: number, ipHash: string): Promise<number | null>,
 *   hide(id: number): Promise<boolean>,
 * }} CommentStore
 */

export const PAGE_SIZE = 30;
export const MIN_INTERVAL_S = 20;
export const HOURLY_LIMIT = 20;
export const DUPLICATE_WINDOW_S = 600;
export const HIDE_AFTER_REPORTS = 3;

const GAME_KEY = /^[a-z0-9-]{2,24}:[A-Za-z0-9_.:-]{1,48}$/;

/** SHA-256 of the address with a server secret; raw addresses are never stored. */
export async function hashIp(ip, salt) {
  const data = new TextEncoder().encode(`${salt}|${ip || 'unknown'}`);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest).slice(0, 12)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const json = (status, body, headers) => ({ status, body, headers });
const intParam = (v) => (v && /^\d{1,12}$/.test(v) ? Number(v) : undefined);

/**
 * @param {{ method: string, path: string, query: URLSearchParams, body?: string, ipHash: string, authorization?: string | null }} req
 *   path is relative to the API root, e.g. "/comments" or "/comments/12/report".
 * @param {CommentStore} store
 * @param {{ adminToken?: string, now?: number }} [opts]
 * @returns {Promise<{ status: number, body: unknown, headers?: Record<string, string> }>}
 */
export async function handleComments(req, store, opts = {}) {
  const now = opts.now ?? Date.now();
  const parts = req.path.replace(/\/+$/, '').split('/').filter(Boolean);
  if (parts[0] !== 'comments') return json(404, { error: 'not-found' });

  if (req.method === 'GET' && parts.length === 1) {
    const game = req.query.get('game') ?? '';
    if (!GAME_KEY.test(game)) return json(400, { error: 'bad-game' });
    const after = intParam(req.query.get('after'));
    const before = intParam(req.query.get('before'));
    const comments = await store.list(game, { after, before, limit: PAGE_SIZE });
    return json(200, after !== undefined ? { comments } : { comments, total: await store.total(game) });
  }

  if (req.method === 'POST' && parts.length === 1) {
    let input;
    try {
      input = JSON.parse(req.body ?? '');
    } catch {
      return json(400, { error: 'bad-json' });
    }
    const game = String(input?.game ?? '');
    if (!GAME_KEY.test(game)) return json(400, { error: 'bad-game' });
    // Bots fill every field; people never see this one.
    if (input?.website) return json(201, { comment: null });
    const result = moderate({ name: input?.name, body: input?.body });
    if (!result.ok) return json(422, { error: result.error });

    const recent = await store.recentByIp(req.ipHash, now - 3600_000);
    if (recent.length) {
      const wait = Math.ceil(MIN_INTERVAL_S - (now - recent[0].createdAt) / 1000);
      if (wait > 0) return json(429, { error: 'rate', retryAfter: wait }, { 'retry-after': String(wait) });
      if (recent.length >= HOURLY_LIMIT) {
        const oldest = recent[recent.length - 1].createdAt;
        const retry = Math.max(1, Math.ceil((oldest + 3600_000 - now) / 1000));
        return json(429, { error: 'rate', retryAfter: retry }, { 'retry-after': String(retry) });
      }
      if (recent.some((r) => r.game === game && r.body === result.body && now - r.createdAt < DUPLICATE_WINDOW_S * 1000)) {
        return json(409, { error: 'duplicate' });
      }
    }
    const comment = await store.insert({ game, name: result.name, body: result.body, createdAt: now, ipHash: req.ipHash });
    return json(201, { comment, censored: result.censored, emojiRemoved: result.emojiRemoved });
  }

  if (req.method === 'POST' && parts.length === 3 && parts[2] === 'report') {
    const id = intParam(parts[1]);
    if (id === undefined) return json(400, { error: 'bad-id' });
    const reports = await store.report(id, req.ipHash);
    if (reports === null) return json(404, { error: 'not-found' });
    if (reports >= HIDE_AFTER_REPORTS) await store.hide(id);
    return json(200, { ok: true, hidden: reports >= HIDE_AFTER_REPORTS });
  }

  if (req.method === 'DELETE' && parts.length === 2) {
    const token = (req.authorization ?? '').replace(/^Bearer\s+/i, '');
    if (!opts.adminToken || token !== opts.adminToken) return json(401, { error: 'unauthorized' });
    const id = intParam(parts[1]);
    if (id === undefined) return json(400, { error: 'bad-id' });
    return (await store.hide(id)) ? json(200, { ok: true }) : json(404, { error: 'not-found' });
  }

  return json(405, { error: 'method-not-allowed' });
}

/** In-memory store: the base of the local file store, and handy in tests. */
export function memoryStore(rows = []) {
  /** @type {Array<Comment & { ipHash: string, hidden: boolean, reporters: Set<string> }>} */
  const all = rows.map((r) => ({ ...r, reporters: new Set(r.reporters ?? []), hidden: !!r.hidden }));
  let nextId = all.reduce((m, r) => Math.max(m, r.id), 0) + 1;
  const visible = (game) => all.filter((r) => r.game === game && !r.hidden);
  const pub = ({ id, game, name, body, createdAt }) => ({ id, game, name, body, createdAt });
  return {
    rows: all,
    async list(game, { after, before, limit }) {
      return visible(game)
        .filter((r) => (after === undefined || r.id > after) && (before === undefined || r.id < before))
        .sort((a, b) => b.id - a.id)
        .slice(0, limit)
        .map(pub);
    },
    async total(game) {
      return visible(game).length;
    },
    async recentByIp(ipHash, since) {
      return all
        .filter((r) => r.ipHash === ipHash && r.createdAt >= since)
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((r) => ({ game: r.game, body: r.body, createdAt: r.createdAt }));
    },
    async insert(c) {
      const row = { ...c, id: nextId++, hidden: false, reporters: new Set() };
      all.push(row);
      return pub(row);
    },
    async report(id, ipHash) {
      const row = all.find((r) => r.id === id);
      if (!row) return null;
      row.reporters.add(ipHash);
      return row.reporters.size;
    },
    async hide(id) {
      const row = all.find((r) => r.id === id);
      if (!row) return false;
      row.hidden = true;
      return true;
    },
  };
}
