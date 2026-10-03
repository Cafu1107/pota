// Comments for the local servers (Vite dev/preview and server/start.mjs): the same
// API and rules as the hosted Worker, stored in .data/comments.json.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleComments, hashIp, memoryStore } from './comments.mjs';
import { SAFE_HEADERS } from './upstreams.mjs';

const FILE = resolve(fileURLToPath(new URL('..', import.meta.url)), '.data', 'comments.json');
const SALT = process.env.POTA_IP_SALT || 'pota-local';
const MAX_BODY_BYTES = 8 * 1024;

/** @type {ReturnType<typeof memoryStore> | null} */
let store = null;
function getStore() {
  if (!store) {
    let rows = [];
    try {
      rows = JSON.parse(readFileSync(FILE, 'utf8'));
    } catch {
      /* first run */
    }
    store = memoryStore(Array.isArray(rows) ? rows : []);
  }
  return store;
}

let saveTimer;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    mkdirSync(dirname(FILE), { recursive: true });
    writeFileSync(FILE, JSON.stringify(getStore().rows.map((r) => ({ ...r, reporters: [...r.reporters] }))));
  }, 250);
  saveTimer.unref?.();
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('too large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** Connect-style middleware for `${prefix}/comments…`; calls next() for anything else. */
export function createCommentsMiddleware({ prefix = '/api' } = {}) {
  return async function potaComments(req, res, next) {
    const raw = req.url || '';
    if (!raw.startsWith(`${prefix}/comments`)) return next?.();
    const url = new URL(raw, 'http://localhost');
    let body = '';
    if (req.method === 'POST') {
      try {
        body = await readBody(req);
      } catch {
        res.writeHead(413, { 'content-type': 'application/json' }).end('{"error":"too-large"}');
        return;
      }
    }
    const result = await handleComments(
      {
        method: req.method || 'GET',
        path: url.pathname.slice(prefix.length),
        query: url.searchParams,
        body,
        ipHash: await hashIp(req.socket?.remoteAddress ?? '', SALT),
        authorization: req.headers.authorization,
      },
      getStore(),
      { adminToken: process.env.POTA_ADMIN_TOKEN },
    );
    if (req.method !== 'GET' && result.status < 300) save();
    res.writeHead(result.status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...SAFE_HEADERS, ...(result.headers ?? {}) });
    res.end(JSON.stringify(result.body));
  };
}
