// Local production server: serves the built app from dist/ and the /proxy API.
// Usage: npm run build && npm start        (PORT=4173 by default, --open to launch a browser)

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { exec } from 'node:child_process';
import { createProxyMiddleware, prewarm } from './proxy.mjs';
import { createCommentsMiddleware } from './comments-local.mjs';

const root = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const port = Number(process.env.PORT) || 4173;
const host = process.env.HOST || '0.0.0.0';
const proxy = createProxyMiddleware();
const comments = createCommentsMiddleware();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.webmanifest', '.svg', '.txt']);
const fileCache = new Map();

async function loadFile(path) {
  const info = await stat(path);
  if (!info.isFile()) return null;
  const cached = fileCache.get(path);
  if (cached && cached.mtime === info.mtimeMs) return cached;
  const body = await readFile(path);
  const ext = extname(path);
  const entry = {
    mtime: info.mtimeMs,
    body,
    gz: COMPRESSIBLE.has(ext) && body.length > 1024 ? gzipSync(body) : null,
    type: MIME[ext] || 'application/octet-stream',
  };
  fileCache.set(path, entry);
  return entry;
}

function cacheControl(urlPath) {
  if (urlPath.startsWith('/assets/')) return 'public, max-age=31536000, immutable';
  return 'no-cache';
}

async function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = normalize(join(root, urlPath));
  if (!file.startsWith(root + sep) && file !== root) {
    res.writeHead(400).end();
    return;
  }
  let entry = null;
  let served = urlPath;
  try {
    entry = await loadFile(file);
  } catch {}
  if (!entry) {
    // SPA fallback: unknown routes render the app shell; missing assets stay 404.
    if (extname(urlPath) && !urlPath.endsWith('.html')) {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
      return;
    }
    file = join(root, 'index.html');
    served = '/index.html';
    try {
      entry = await loadFile(file);
    } catch {
      res.writeHead(500, { 'content-type': 'text/plain' }).end('Build missing. Run "npm run build" first.');
      return;
    }
  }
  const headers = { 'content-type': entry.type, 'cache-control': cacheControl(served) };
  let body = entry.body;
  if (entry.gz && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    body = entry.gz;
    headers['content-encoding'] = 'gzip';
    headers.vary = 'accept-encoding';
  }
  res.writeHead(200, headers);
  res.end(req.method === 'HEAD' ? undefined : body);
}

const server = createServer((req, res) => {
  proxy(req, res, () => comments(req, res, () => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405).end();
      return;
    }
    serveStatic(req, res).catch(() => {
      if (!res.headersSent) res.writeHead(500).end();
    });
  }));
});

server.listen(port, host, () => {
  prewarm();
  const local = `http://localhost:${port}`;
  const lan = Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => `http://${i.address}:${port}`);
  console.log(`\n  Pota is running\n\n  Local:   ${local}`);
  for (const url of lan) console.log(`  Network: ${url}`);
  console.log('\n  Press Ctrl+C to stop.\n');
  if (process.argv.includes('--open')) {
    const cmd = process.platform === 'win32' ? `start "" "${local}"` : process.platform === 'darwin' ? `open ${local}` : `xdg-open ${local}`;
    exec(cmd);
  }
});
