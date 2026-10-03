// Basketball news from the federation, Turkish sports outlets, Eurohoops and ESPN.
// Headlines link out to the original article; nothing is republished.
import { useQueries } from '@tanstack/react-query';
import { getJson, getText, type Upstream } from './http';
import { istanbulToIso } from '../lib/time';

export type NewsSourceId = 'tbf' | 'ntvspor' | 'trtspor' | 'fotomac' | 'eurohoops' | 'espn';
export type NewsTopic = 'tr' | 'eu' | 'nba';

export interface NewsItem {
  id: string;
  title: string;
  summary?: string;
  url: string;
  image?: string;
  source: NewsSourceId;
  published: string;
  topic: NewsTopic;
  lang: 'tr' | 'en';
  video?: boolean;
}

export const NEWS_SOURCES: Record<NewsSourceId, { name: string; lang: 'tr' | 'en' }> = {
  tbf: { name: 'TBF', lang: 'tr' },
  ntvspor: { name: 'NTV Spor', lang: 'tr' },
  trtspor: { name: 'TRT Spor', lang: 'tr' },
  fotomac: { name: 'Fotomaç', lang: 'tr' },
  eurohoops: { name: 'Eurohoops', lang: 'tr' },
  espn: { name: 'ESPN', lang: 'en' },
};

const EU = /euroleague|eurocup|avrupa ligi|avrupa kupa|şampiyonlar ligi|champions league|fiba europe|europe cup/i;
const NBA = /\bnba\b|\bwnba\b/i;

function topicOf(text: string, fallback: NewsTopic): NewsTopic {
  if (NBA.test(text)) return 'nba';
  if (EU.test(text)) return 'eu';
  return fallback;
}

function decode(html: string): string {
  const doc = new DOMParser().parseFromString(`<!doctype html><body>${html}`, 'text/html');
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function firstImg(html: string | null | undefined): string | undefined {
  if (!html) return undefined;
  const m = /<img[^>]+src=["']([^"']+)["']/i.exec(html);
  return m && !/emoji|s\.w\.org/i.test(m[1]) ? m[1] : undefined;
}

function clip(s: string | undefined, max = 220): string | undefined {
  if (!s) return undefined;
  const t = s
    .replace(/^SON DAKİKA( HABERİ)?\s*[:|-]\s*/i, '')
    .replace(/Devamı için tıklayınız\.?/i, '')
    .replace(/The post .* appeared first on .*$/i, '')
    .trim();
  if (!t) return undefined;
  return t.length > max ? t.slice(0, t.lastIndexOf(' ', max)) + '…' : t;
}

function iso(date: Date): string | undefined {
  const ms = date.getTime();
  if (Number.isNaN(ms)) return undefined;
  // A feed clock running ahead of ours is clamped to "now".
  return new Date(Math.min(ms, Date.now())).toISOString();
}

async function rss(upstream: Upstream, path: string, source: NewsSourceId): Promise<NewsItem[]> {
  const xml = await getText(upstream, path);
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) return [];
  const out: NewsItem[] = [];
  const items = [...doc.querySelectorAll('item')];
  for (const it of items) {
    const txt = (tag: string) => it.getElementsByTagName(tag)[0]?.textContent ?? '';
    const descHtml = txt('description');
    const media = it.getElementsByTagName('media:content')[0]?.getAttribute('url') ?? it.getElementsByTagName('enclosure')[0]?.getAttribute('url');
    const title = decode(txt('title'));
    const summary = clip(decode(descHtml));
    const url = txt('link').trim();
    const cats = [...it.getElementsByTagName('category')].map((c) => c.textContent).join(' ');
    let date = new Date(txt('pubDate'));
    // TRT Spor writes Istanbul wall-clock time with a "+0000" offset.
    if (source === 'trtspor') date = new Date(date.getTime() - 3 * 3600_000);
    const published = iso(date);
    if (!title || !url || !published) continue;
    out.push({
      id: `${source}:${url}`,
      title,
      summary: summary && summary !== title ? summary : undefined,
      url,
      image: media || txt('imageUrl') || firstImg(descHtml) || firstImg(txt('content:encoded')),
      source,
      published,
      topic: topicOf(`${title} ${summary ?? ''} ${cats}`, source === 'eurohoops' ? 'eu' : 'tr'),
      lang: 'tr',
    });
  }
  if (items.length) return out;
  // Atom (NTV Spor)
  for (const it of doc.querySelectorAll('entry')) {
    const txt = (tag: string) => it.getElementsByTagName(tag)[0]?.textContent ?? '';
    const link = [...it.getElementsByTagName('link')].find((l) => (l.getAttribute('rel') ?? 'alternate') === 'alternate')?.getAttribute('href') ?? '';
    const title = decode(txt('title'));
    const summary = clip(decode(txt('summary')));
    const published = iso(new Date(txt('published') || txt('updated')));
    if (!title || !link || !published) continue;
    out.push({
      id: `${source}:${link}`,
      title,
      summary,
      url: link,
      image: firstImg(txt('content')),
      source,
      published,
      topic: topicOf(`${title} ${summary ?? ''}`, 'tr'),
      lang: 'tr',
      video: /\/video\//.test(link),
    });
  }
  return out;
}

async function tbf(): Promise<NewsItem[]> {
  const j = await getJson('tbf', '/api/News/get-all-news-paginated', { Page: 1, PageSize: 24 });
  return (j?.data ?? [])
    .filter((n: any) => n.baslik && n.slug)
    .map((n: any) => ({
      id: `tbf:${n.exId ?? n.slug}`,
      title: n.baslik,
      summary: n.ozet && n.ozet !== n.baslik ? clip(n.ozet) : undefined,
      url: `https://www.tbf.org.tr/haber/${n.slug}`,
      image: n.gorsel || undefined,
      source: 'tbf' as const,
      published: iso(new Date(istanbulToIso(n.tarih))) ?? new Date().toISOString(),
      topic: topicOf(`${n.baslik} ${n.ozet ?? ''} ${n.ligAdi ?? ''}`, 'tr'),
      lang: 'tr' as const,
    }));
}

async function espn(): Promise<NewsItem[]> {
  const j = await getJson('espn', '/apis/site/v2/sports/basketball/nba/news', { limit: 30 });
  return (j?.articles ?? [])
    .filter((a: any) => a.links?.web?.href && a.headline && a.published)
    .map((a: any) => ({
      id: `espn:${a.id}`,
      title: a.headline,
      summary: clip(a.description),
      url: a.links.web.href,
      image: a.images?.[0]?.url,
      source: 'espn' as const,
      published: iso(new Date(a.published)) ?? new Date().toISOString(),
      topic: 'nba' as const,
      lang: 'en' as const,
      video: a.type === 'Media',
    }));
}

const FETCHERS: Record<NewsSourceId, () => Promise<NewsItem[]>> = {
  tbf,
  ntvspor: () => rss('ntvspor', '/rss/kategori/basketbol', 'ntvspor'),
  trtspor: () => rss('trtspor', '/rss/basketbol.rss', 'trtspor'),
  fotomac: () => rss('fotomac', '/rss/basketbol.xml', 'fotomac'),
  eurohoops: () => rss('eurohoops', '/tr/feed/', 'eurohoops'),
  espn,
};

export const NEWS_ORDER = Object.keys(FETCHERS) as NewsSourceId[];

/**
 * A right-sized copy of a news photo where the CDN can resize on the fly
 * (TRT's originals are ~2 MB). `w` is the CSS width; 16:9 is assumed.
 */
export function newsImage(url: string | undefined, w: number): string | undefined {
  if (!url) return undefined;
  const px = Math.round(w * Math.min(2, typeof devicePixelRatio === 'number' ? devicePixelRatio : 1));
  const h = Math.round((px * 9) / 16);
  const trt = /^https:\/\/cdn-i\.pr\.trt\.com\.tr\/trtspor\/(?!webp\/)([^/?]+)$/.exec(url);
  if (trt) return `https://cdn-i.pr.trt.com.tr/trtspor/webp/w${px}/h${h}/q75/${trt[1]}`;
  if (/^https:\/\/images\.ntvspor\.net\//.test(url)) {
    const u = new URL(url);
    u.searchParams.set('width', String(px));
    u.searchParams.set('format', 'webp');
    return u.toString();
  }
  const espn = /^https:\/\/a\.espncdn\.com(\/photo\/[^?]+)/.exec(url);
  if (espn) return `https://a.espncdn.com/combiner/i?img=${espn[1]}&w=${px}&h=${h}&scale=crop&cquality=80`;
  return url;
}

/** The first `n` stories, those in the reader's language first (each part stays newest first). */
export function preferLang(items: NewsItem[], lang: 'tr' | 'en', n: number): NewsItem[] {
  const out = items.filter((x) => x.lang === lang).slice(0, n);
  if (out.length < n) out.push(...items.filter((x) => x.lang !== lang).slice(0, n - out.length));
  return out;
}

/** Story identity across outlets: the same headline syndicated twice shows once. */
function storyKey(title: string) {
  return title.toLocaleLowerCase('tr-TR').replace(/[^\p{L}\p{N}]+/gu, '').slice(0, 48);
}

/** All sources in parallel; each lands on its own and the merge is newest first. */
export function useNews(enabled = true) {
  return useQueries({
    queries: NEWS_ORDER.map((id) => ({
      queryKey: ['news', id],
      queryFn: FETCHERS[id],
      staleTime: 3 * 60_000,
      refetchInterval: 5 * 60_000,
      retry: 1,
      enabled,
    })),
    combine: (results) => {
      const seen = new Set<string>();
      const items: NewsItem[] = [];
      for (const r of results) {
        for (const it of r.data ?? []) {
          const key = storyKey(it.title);
          if (seen.has(key)) continue;
          seen.add(key);
          items.push(it);
        }
      }
      items.sort((a, b) => (a.published < b.published ? 1 : a.published > b.published ? -1 : 0));
      const pending = results.filter((r) => r.isPending && r.fetchStatus !== 'idle').length;
      return {
        items,
        pending,
        failed: NEWS_ORDER.filter((_, i) => results[i].isError && !results[i].data),
        refetch: () => results.forEach((r) => r.isError && r.refetch()),
      };
    },
  });
}
