# Security

## Reporting a vulnerability

Please report security problems privately through GitHub: **Security → Report a vulnerability** on this repository. Do not open a public issue for them. You will get an answer as soon as possible, and a fix will be published before the details are made public.

## What is protected, and how

**The data proxy** (`server/proxy.mjs` locally, `deploy/worker` on the live demo)

- It only forwards to a fixed list of hosts, and on each host only to the API or feed paths the app reads (`server/upstreams.mjs`). A news site's HTML pages, error pages and other services on the same host are refused, and paths that climb out of an API prefix (`../`, `%2e%2e`) are rejected.
- Every answer is marked as data that must never render as a page: `Content-Security-Policy: default-src 'none'; sandbox`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`.
- Browsers may only call it from the demo's own address (CORS). The one non-GET request it forwards (the TBF player game log) is allowlisted and size-limited.
- Requests are rate limited per address (Cloudflare Rate Limiting bindings, with per-isolate counters as a fallback).

**Comments** (`server/comments.mjs`, rules in `server/moderation.mjs`)

- Every rule runs on the server: links are refused, only six emoji are allowed, swearing and slang are masked, invisible and direction-changing characters are removed, stacked accents and line floods are capped, and nicknames that could pass for the site or its staff are dropped.
- Posting is limited per address (one comment every 20 seconds, 20 an hour) on top of the request limits, duplicates are refused and a hidden honeypot field catches simple bots. A comment reported by three different people is hidden.
- Queries use bound parameters only. Comments are shown as plain text; the app never renders user text as HTML.
- IP addresses are never stored, only a salted SHA-256 hash used for the limits. Removing a comment needs the admin token, compared in constant time; the token and the salt are Worker secrets and are not in this repository.

**The site**

- Production builds carry a Content Security Policy: scripts only from the site itself (the one inline script is allowed by its hash), data only from the site and its proxy, frames only from `youtube-nocookie.com`, no plugins, no form posts elsewhere.
- Videos play in YouTube's privacy-enhanced player and only load after a click. External links open with `rel="noopener noreferrer"`.
- Dependabot alerts and security updates are enabled for this repository.

## Known limits

- GitHub Pages cannot send HTTP headers, so the policy is a `<meta>` tag and `frame-ancestors` (clickjacking protection) cannot be set there.
- Rate limits are counted per Cloudflare location, so they are approximate by design. They are meant to stop abuse of the free plan, not determined attacks.
