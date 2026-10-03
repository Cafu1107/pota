# pota-proxy

The Cloudflare Worker that serves Pota's data proxy for the GitHub Pages build. It forwards
`/proxy/<upstream>/<path>` to the allowlisted sources in `server/upstreams.mjs`, adds CORS for the
origins in `wrangler.toml`, and keeps recent responses in memory (stale-while-revalidate).
`/proxy/fls-lite/<id>` returns the condensed live score that score lists poll.

```bash
npm install
npx wrangler login   # once, opens the browser
npm run dev          # local test on http://127.0.0.1:8787
npm run deploy       # prints the workers.dev address
```

Point the site at it by setting `VITE_PROXY_BASE` (or the repo's `POTA_PROXY_BASE` Actions
variable) to `https://<worker>.<account>.workers.dev/proxy`.
