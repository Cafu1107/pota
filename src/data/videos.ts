// Game videos from official YouTube channels and playlists, read through their
// public RSS feeds (no API key). Highlights for most leagues; for TBF leagues the
// federation streams games live, so their videos are the full broadcasts.
import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { getText } from './http';
import type { Game, TeamRef } from './types';
import type { NewsTopic } from './news';

export type VideoType = 'highlights' | 'stream';

export interface Video {
  id: string;
  title: string;
  /** ISO time the video (or the scheduled stream) was published. */
  published: string;
  channel: string;
  type: VideoType;
  /** League the source belongs to, when known. */
  league?: string;
}

type Feed = { channel_id: string } | { playlist_id: string };

interface Source {
  feed: Feed;
  type: VideoType;
  channel: string;
  /** Only titles matching this count (e.g. "highlights", or the league name on a mixed channel). */
  match?: RegExp;
  league?: string;
}

const CHANNEL = {
  euroleague: 'UCGr3nR_XH9r6E5b09ZJAT9w',
  nba: 'UCWJ2lWNubArHWmf3FIHbfcQ',
  wnba: 'UCO9a_ryN_l7DIDS-VIt-zmw',
  gleague: 'UCpGimyrbwRtrcJ-CIiRDXbA',
  nbl: 'UCQOt5-Mc5m03JCO_W9SWySA',
  fiba: 'UCtInrnU3QbWqFGsdKT1GZtg',
  tbf: 'UC0BH4JA92bO7AOtqOWBNqdg',
  bein: 'UCPe9vNjHF1kEExT5kHwc7aw',
};

const BEIN = 'beIN SPORTS Türkiye';
// beIN also posts football "ÖZET" videos; only basketball ones count.
const BEIN_BASKETBALL = /(?:özet|ozet).*basketbol|basketbol.*(?:özet|ozet)/i;
const tbf = (match: RegExp, playlist?: string): Source[] => [
  ...(playlist ? [{ feed: { playlist_id: playlist }, type: 'stream' as const, channel: 'TBF' }] : []),
  { feed: { channel_id: CHANNEL.tbf }, type: 'stream', channel: 'TBF', match },
];
const highlights = (channel_id: string, channel: string, match = /highlights/i): Source[] => [{ feed: { channel_id }, type: 'highlights', channel, match }];

/** Per league, best source first. */
export const VIDEO_SOURCES: Record<string, Source[]> = {
  bsl: [
    { feed: { playlist_id: 'PLbR6Oi5YfJ4g' }, type: 'highlights', channel: BEIN, match: BEIN_BASKETBALL },
    { feed: { channel_id: CHANNEL.bein }, type: 'highlights', channel: BEIN, match: BEIN_BASKETBALL },
  ],
  kbsl: tbf(/kad[ıi]nlar basketbol s[üu]per ligi|\bkbsl\b/i, 'PLVPXafn3AuNs'),
  tbl: tbf(/t[üu]rkiye basketbol ligi|\btbl\b/i, 'PLbaL8KYl2eVs'),
  tkbl: tbf(/t[üu]rkiye kad[ıi]nlar basketbol ligi|\btkbl\b/i, 'PLVCyM8Xiq64Q'),
  tb2l: tbf(/basketbol 2\. ?lig|\btb2l\b/i),
  bgl: tbf(/gen[çc]ler ligi(?! k[ıi]zlar)|\bbgl\b/i),
  bglk: tbf(/gen[çc]ler ligi k[ıi]zlar|\bbglk\b/i),
  ebbl: tbf(/erkekler b[öo]lgesel|\bebbl\b/i),
  kbbl: tbf(/kad[ıi]nlar b[öo]lgesel|\bkbbl\b/i),
  euroleague: highlights(CHANNEL.euroleague, 'EuroLeague'),
  eurocup: highlights(CHANNEL.euroleague, 'EuroLeague', /eurocup.*highlights|highlights.*eurocup/i),
  nba: highlights(CHANNEL.nba, 'NBA'),
  wnba: highlights(CHANNEL.wnba, 'WNBA'),
  gleague: highlights(CHANNEL.gleague, 'NBA G League'),
  // NBL also streams every game on YouTube; the replay stands in when highlights have scrolled off the feed.
  nbl: [...highlights(CHANNEL.nbl, 'NBL'), { feed: { playlist_id: 'PLcDiuuedr8Ps' }, type: 'stream', channel: 'NBL' }],
  fiba: highlights(CHANNEL.fiba, 'FIBA'),
};

const TOPIC: Partial<Record<string, NewsTopic>> = {
  bsl: 'tr', kbsl: 'tr', tbl: 'tr', tkbl: 'tr', tb2l: 'tr', bgl: 'tr', bglk: 'tr', ebbl: 'tr', kbbl: 'tr',
  euroleague: 'eu', eurocup: 'eu', fiba: 'eu',
  nba: 'nba', wnba: 'nba', gleague: 'nba',
};

const feedKey = (f: Feed) => ('channel_id' in f ? `c:${f.channel_id}` : `p:${f.playlist_id}`);
const SHORTS = /#shorts?\b|basın toplantısı|press conference|postgame|pre-?game|röportaj|interview|kura çekimi|fikstür/i;

/** Raw entries of one feed (title filters are applied per source later). */
async function fetchFeed(feed: Feed): Promise<Array<Omit<Video, 'type' | 'channel'>>> {
  const xml = await getText('yt', '/feeds/videos.xml', feed as Record<string, string>);
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) return [];
  return [...doc.getElementsByTagName('entry')]
    .map((e) => ({
      id: e.getElementsByTagName('yt:videoId')[0]?.textContent ?? '',
      title: e.getElementsByTagName('title')[0]?.textContent?.trim() ?? '',
      published: e.getElementsByTagName('published')[0]?.textContent ?? '',
    }))
    .filter((v) => /^[\w-]{11}$/.test(v.id) && v.title && !Number.isNaN(Date.parse(v.published)));
}

function useFeeds(sources: Source[], enabled: boolean) {
  const feeds = useMemo(() => [...new Map(sources.map((s) => [feedKey(s.feed), s.feed])).values()], [sources]);
  return useQueries({
    queries: feeds.map((feed) => ({
      queryKey: ['videos', feedKey(feed)],
      queryFn: () => fetchFeed(feed),
      staleTime: 10 * 60_000,
      retry: 1,
      enabled,
    })),
    combine: (results) => {
      const byFeed = new Map<string, Array<Omit<Video, 'type' | 'channel'>>>();
      feeds.forEach((f, i) => byFeed.set(feedKey(f), results[i]?.data ?? []));
      const seen = new Set<string>();
      const out: Video[] = [];
      for (const src of sources) {
        for (const v of byFeed.get(feedKey(src.feed)) ?? []) {
          if (seen.has(v.id) || SHORTS.test(v.title) || (src.match && !src.match.test(v.title))) continue;
          seen.add(v.id);
          out.push({ ...v, type: src.type, channel: src.channel, league: src.league });
        }
      }
      return { videos: out, loading: results.some((r) => r.isLoading) };
    },
  });
}

// ---------- matching a video to a game ----------

const STOP = new Set([
  'basketbol', 'basketball', 'basket', 'spor', 'sporu', 'kulubu', 'club', 'belediye', 'belediyesi', 'belediyespor', 'buyuksehir',
  'universitesi', 'koleji', 'kolej', 'the', 'and', 'highlights', 'ozet', 'game', 'games', 'full', 'round', 'hafta', 'ligi', 'lig',
  'super', 'turkiye', 'sigorta', 'halkbank', 'kadinlar', 'women', 'men', 'istanbul', 'ankara', 'izmir', 'city', 'united', 'team',
]);
const TR = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' } as Record<string, string>;

/** Words of a name or title: lowercase, Turkish letters folded, 3+ characters. */
export function nameWords(s: string): string[] {
  let out = '';
  for (const ch of s.toLocaleLowerCase('tr-TR').normalize('NFC')) out += TR[ch] ?? ch;
  return out.split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
}

function teamKeys(team: TeamRef, other: TeamRef): string[] {
  const theirs = new Set([...nameWords(other.name), ...nameWords(other.short ?? '')]);
  return [...new Set([...nameWords(team.name), ...nameWords(team.short ?? '')])].filter((w) => !STOP.has(w) && !theirs.has(w));
}

const HOUR = 3600_000;
const DAY = 24 * HOUR;

/** The video of this game, if one of the league's feeds has it. */
export function matchVideo(game: Game, videos: Video[]): Video | undefined {
  const start = new Date(game.start).getTime();
  const hk = teamKeys(game.home.team, game.away.team);
  const ak = teamKeys(game.away.team, game.home.team);
  if (!hk.length || !ak.length) return undefined;
  let best: { v: Video; score: number; gap: number } | undefined;
  for (const v of videos) {
    const t = new Date(v.published).getTime();
    // Highlights appear after the game; scheduled streams are published days before it.
    const inWindow = v.type === 'highlights' ? t > start - 2 * HOUR && t < start + 4 * DAY : t > start - 12 * DAY && t < start + 2 * DAY;
    if (!inWindow) continue;
    const words = new Set(nameWords(v.title));
    const h = hk.filter((w) => words.has(w)).length;
    const a = ak.filter((w) => words.has(w)).length;
    if (!h || !a) continue;
    const score = h / hk.length + a / ak.length;
    const gap = Math.abs(t - start);
    if (!best || score > best.score || (score === best.score && gap < best.gap)) best = { v, score, gap };
  }
  return best?.v;
}

/** Which video kinds make sense for a game in its current state. */
function wants(game: Game): boolean {
  if (game.status === 'final' || game.status === 'live') return true;
  return game.status === 'scheduled' && new Date(game.start).getTime() - Date.now() < 10 * DAY;
}

export function useGameVideo(game: Game | undefined): Video | undefined {
  const sources = (game && VIDEO_SOURCES[game.leagueId]) || EMPTY;
  const eligible = !!game && sources.length > 0 && wants(game);
  const { videos } = useFeeds(sources, eligible);
  return useMemo(() => {
    if (!game || !eligible) return undefined;
    // Highlights once the game is over (a replay if there are none); streams before and during it.
    const streams = videos.filter((v) => v.type === 'stream');
    if (game.status !== 'final') return matchVideo(game, streams);
    return matchVideo(game, videos.filter((v) => v.type === 'highlights')) ?? matchVideo(game, streams);
  }, [game, eligible, videos]);
}

const EMPTY: Source[] = [];

/** Ids of the finished games in a list that have a video (for a small mark in score lists). */
export function useGamesWithVideo(leagueId: string, games: Game[], enabled: boolean): Set<string> {
  const sources = VIDEO_SOURCES[leagueId] ?? EMPTY;
  const finals = useMemo(() => games.filter((g) => g.status === 'final'), [games]);
  const { videos } = useFeeds(sources, enabled && sources.length > 0 && finals.length > 0);
  return useMemo(() => new Set(finals.filter((g) => matchVideo(g, videos)).map((g) => g.id)), [finals, videos]);
}
const LATEST_LEAGUES = ['bsl', 'euroleague', 'nba', 'wnba', 'nbl', 'fiba'];
const LATEST_SOURCES = LATEST_LEAGUES.flatMap((id) => VIDEO_SOURCES[id].filter((s) => s.type === 'highlights').map((s) => ({ ...s, league: id })));

/** Recent highlights across leagues, newest first, for the news page. */
export function useLatestHighlights(topic: NewsTopic | 'all', enabled = true) {
  const { videos, loading } = useFeeds(LATEST_SOURCES, enabled);
  return useMemo(() => {
    const list = videos
      .filter((v) => topic === 'all' || TOPIC[v.league ?? ''] === topic)
      .sort((a, b) => Date.parse(b.published) - Date.parse(a.published))
      .slice(0, 12);
    return { videos: list, loading };
  }, [videos, loading, topic]);
}
