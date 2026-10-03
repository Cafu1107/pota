// Upstreams and cache rules shared by the local proxy (server/proxy.mjs) and the
// hosted one (deploy/worker), so both serve the same paths with the same freshness.

export const UPSTREAMS = {
  espn: 'https://site.api.espn.com',
  'espn-web': 'https://site.web.api.espn.com',
  el: 'https://api-live.euroleague.net',
  'el-live': 'https://live.euroleague.net',
  tbf: 'https://miniappapi.tbf.org.tr/webapi-service',
  fls: 'https://fibalivestats.dcd.shared.geniussports.com',
  // Basketball news feeds (RSS / Atom)
  ntvspor: 'https://www.ntvspor.net',
  trtspor: 'https://www.trtspor.com.tr',
  fotomac: 'https://www.fotomac.com.tr',
  eurohoops: 'https://www.eurohoops.net',
  // Game highlights: public RSS feeds of official channels and playlists
  yt: 'https://www.youtube.com',
};

// The only paths each upstream exposes: the APIs and feeds the app reads. Anything
// else (a news site's HTML pages, error pages, other services on the same host)
// is refused, so the proxy can never serve someone else's page from our origin.
const PATHS = {
  espn: /^\/apis\//,
  'espn-web': /^\/apis\//,
  el: /^\/v[1-3]\//,
  'el-live': /^\/api\//,
  tbf: /^\/api\//,
  fls: /^\/data\/\d{1,12}\/data\.json$/,
  ntvspor: /^\/rss\//,
  trtspor: /^\/rss\//,
  fotomac: /^\/rss\//,
  eurohoops: /^\/(?:[a-z]{2}\/)?feed\/?$/,
  yt: /^\/feeds\/videos\.xml$/,
};

/** Headers for everything the proxy and the comments API send back: data only, never a page. */
export const SAFE_HEADERS = {
  'x-content-type-options': 'nosniff',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'; sandbox",
  'referrer-policy': 'no-referrer',
};

// [upstream, regex on path + query, fresh seconds, hot]. First match wins.
// Hot entries are live data: refreshed in the background while clients poll them.
export const TTL_RULES = [
  ['fls', /./, 3, true],
  ['el-live', /./, 3, true],
  ['espn', /\/(scoreboard|summary)\b/, 5, true],
  ['espn', /\/news\b/, 300, false],
  ['espn', /./, 600, false],
  ['espn-web', /\/search/, 3600, false],
  ['espn-web', /\/leaders/, 1800, false],
  ['espn-web', /./, 900, false],
  // A club's whole schedule (head to head): changes only when one of its games ends.
  ['el', /\/games\?(?:.*&)?teamCode=/, 600, false],
  ['el', /\/games\b/, 15, true],
  ['el', /./, 900, false],
  ['tbf', /\/Match\//, 8, true],
  ['tbf', /\/News\//, 300, false],
  ['tbf', /standings/i, 60, false],
  ['tbf', /./, 900, false],
  ['ntvspor', /./, 180, false],
  ['trtspor', /./, 180, false],
  ['fotomac', /./, 180, false],
  ['eurohoops', /./, 180, false],
  ['yt', /./, 600, false],
];

// How long a stale copy may still be served instantly while it refreshes.
export const MAX_STALE_LIVE_S = 30;
export const MAX_STALE_S = 6 * 3600;
export const ERROR_TTL_S = 10;
export const TIMEOUT_MS = 12_000;

// The only non-GET call we forward: TBF's player game log is a POST.
export const POST_ALLOW = [['tbf', /^\/api\/Player\/get-player-detail-match-statistic\/\d+\/\d+$/]];

export const UPSTREAM_HEADERS = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
  accept: 'application/json, text/plain, application/rss+xml, */*',
  'accept-language': 'tr-TR,tr;q=0.9,en;q=0.8',
};

/** @returns {{ttl: number, hot: boolean}} */
export function rule(upstream, path) {
  for (const [u, re, s, hot] of TTL_RULES) if (u === upstream && re.test(path)) return { ttl: s, hot };
  return { ttl: 60, hot: false };
}

/**
 * Splits "<upstream>/<path>?<query>" into a validated upstream URL.
 * @returns {{ upstream: string, url: string, path: string, query: string } | { error: string, status: number }}
 */
export function resolveTarget(rest) {
  const slash = rest.indexOf('/');
  const upstream = slash === -1 ? rest : rest.slice(0, slash);
  const pathAndQuery = slash === -1 ? '/' : rest.slice(slash);
  const base = UPSTREAMS[upstream];
  if (!base) return { error: 'unknown upstream', status: 404 };
  if (pathAndQuery.length > 2048) return { error: 'uri too long', status: 414 };
  const target = new URL(base);
  const prefix = target.pathname.replace(/\/$/, '');
  const joined = new URL(prefix + pathAndQuery, target.origin);
  if (joined.origin !== target.origin) return { error: 'bad path', status: 400 };
  // "/webapi-service/../x" resolves outside the API prefix.
  if (prefix && !joined.pathname.startsWith(prefix + '/')) return { error: 'bad path', status: 400 };
  const path = joined.pathname.slice(prefix.length);
  if (!PATHS[upstream]?.test(path)) return { error: 'path not allowed', status: 403 };
  return { upstream, url: joined.href, path: joined.pathname.slice(prefix.length), query: joined.search };
}

export const isPostAllowed = (upstream, path) => POST_ALLOW.some(([u, re]) => u === upstream && re.test(path));
