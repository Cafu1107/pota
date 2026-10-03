// Renders the PWA / touch icons from the logo mark with headless Chrome (no deps).
// Usage: node scripts/make-icons.mjs   (set CHROME=path if Chrome lives elsewhere)
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const CANDIDATES = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const CHROME = CANDIDATES.find((p) => existsSync(p));
if (!CHROME) throw new Error('Chrome/Edge not found; set CHROME=/path/to/chrome');

const MARK = `<path d="M6.9 10.4 10.6 23.6M25.1 10.4 21.4 23.6M6.9 10.4 14.3 23.6M11.45 12.1 17.7 23.6M16 12.5 21.4 23.6M25.1 10.4 17.7 23.6M20.55 12.1 14.3 23.6M16 12.5 10.6 23.6" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity="0.9"/>
<ellipse cx="16" cy="9.6" rx="9.6" ry="3.1" fill="none" stroke="#fff" stroke-width="2.3"/>`;
const ORANGE = '#ea580c';

// rounded: transparent corners (install icons); full: edge-to-edge (maskable / Apple)
const svg = (kind) => {
  if (kind === 'rounded') return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7.5" fill="${ORANGE}"/>${MARK}</svg>`;
  // maskable safe zone: keep the mark inside the central 80%
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="${ORANGE}"/><g transform="translate(4.8 4.8) scale(0.7)">${MARK}</g></svg>`;
};

const OUT = [
  ['pwa-64x64.png', 64, 'rounded'],
  ['pwa-192x192.png', 192, 'rounded'],
  ['pwa-512x512.png', 512, 'rounded'],
  ['maskable-icon-512x512.png', 512, 'full'],
  ['apple-touch-icon-180x180.png', 180, 'full'],
];

const PORT = 9341;
const profile = mkdtempSync(join(tmpdir(), 'pota-icons-'));
const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ws;
for (let i = 0; i < 60 && !ws; i++) {
  await sleep(150);
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const url = list.find((t) => t.type === 'page')?.webSocketDebuggerUrl;
    if (url) ws = new WebSocket(url);
  } catch {}
}
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m.result);
    pending.delete(m.id);
  }
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
for (const [name, size, kind] of OUT) {
  await send('Emulation.setDeviceMetricsOverride', { width: size, height: size, deviceScaleFactor: 1, mobile: false });
  const html = `<html><body style="margin:0;background:transparent">${svg(kind).replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`;
  await send('Page.navigate', { url: 'data:text/html;base64,' + Buffer.from(html).toString('base64') });
  await sleep(250);
  const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: size, height: size, scale: 1 } });
  writeFileSync(join(root, 'public', name), Buffer.from(shot.data, 'base64'));
  console.log('wrote public/' + name);
}
ws.close();
proc.kill();
process.exit(0);
