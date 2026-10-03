import { describe, expect, it } from 'vitest';
import { bestOf } from '../src/data/providers/euroleague';
import { newsImage, preferLang, type NewsItem } from '../src/data/news';
// @ts-expect-error plain ESM module without types
import { isPostAllowed, resolveTarget, rule } from '../server/upstreams.mjs';

const later = <T,>(v: T, ms: number) => new Promise<T>((resolve) => setTimeout(() => resolve(v), ms));
const failLater = (ms: number) => new Promise<never>((_, reject) => setTimeout(() => reject(new Error('down')), ms));

describe('bestOf (lagging API replicas)', () => {
  it('keeps the most complete copy that arrives in time', async () => {
    const r = await bestOf([later({ n: 48 }, 5), later({ n: 60 }, 15), later({ n: 48 }, 10)], (v) => v.n, 100);
    expect(r).toEqual({ n: 60 });
  });

  it('does not wait for copies slower than the grace period', async () => {
    const t0 = Date.now();
    const r = await bestOf([later({ n: 48 }, 5), later({ n: 60 }, 400)], (v) => v.n, 30);
    expect(r).toEqual({ n: 48 });
    expect(Date.now() - t0).toBeLessThan(300);
  });

  it('survives failed copies and returns null when all fail', async () => {
    expect(await bestOf([failLater(5), later({ n: 1 }, 10)], (v) => v.n, 20)).toEqual({ n: 1 });
    expect(await bestOf([failLater(5), failLater(8)], () => 0, 20)).toBeNull();
  });
});

const item = (id: string, lang: 'tr' | 'en'): NewsItem => ({
  id,
  title: id,
  url: `https://example.com/${id}`,
  source: lang === 'en' ? 'espn' : 'ntvspor',
  published: '2026-10-03T07:00:00.000Z',
  topic: 'tr',
  lang,
});

describe('news', () => {
  it('puts stories in the reader’s language first and fills up with the rest', () => {
    const list = [item('a', 'en'), item('b', 'tr'), item('c', 'en'), item('d', 'tr')];
    expect(preferLang(list, 'tr', 3).map((x) => x.id)).toEqual(['b', 'd', 'a']);
    expect(preferLang(list, 'en', 2).map((x) => x.id)).toEqual(['a', 'c']);
  });

  it('asks image CDNs for a right-sized copy', () => {
    expect(newsImage('https://cdn-i.pr.trt.com.tr/trtspor/aa-42636579-21755919.jpeg', 160)).toMatch(
      /^https:\/\/cdn-i\.pr\.trt\.com\.tr\/trtspor\/webp\/w\d+\/h\d+\/q75\/aa-42636579-21755919\.jpeg$/,
    );
    expect(newsImage('https://images.ntvspor.net/images/x.jpg?width=930&format=webp', 168)).toMatch(/width=\d+&format=webp$/);
    expect(newsImage('https://a.espncdn.com/photo/2026/1002/r1.jpg', 128)).toContain('/combiner/i?img=/photo/2026/1002/r1.jpg');
    expect(newsImage('https://example.com/x.jpg', 100)).toBe('https://example.com/x.jpg');
    expect(newsImage(undefined, 100)).toBeUndefined();
  });
});

describe('proxy upstream rules', () => {
  it('maps a path onto an allowlisted upstream', () => {
    expect(resolveTarget('tbf/api/League/get-featured-9-leagues')).toEqual({
      upstream: 'tbf',
      url: 'https://miniappapi.tbf.org.tr/webapi-service/api/League/get-featured-9-leagues',
      path: '/api/League/get-featured-9-leagues',
    });
  });

  it('refuses unknown upstreams and paths that leave the upstream', () => {
    expect(resolveTarget('evil/x')).toMatchObject({ status: 404 });
    expect(resolveTarget('espn//evil.example/x')).toMatchObject({ status: 400 });
  });

  it('keeps live endpoints short-lived and only allows the one POST', () => {
    expect(rule('fls', '/data/1/data.json')).toEqual({ ttl: 3, hot: true });
    expect(rule('espn', '/apis/site/v2/sports/basketball/nba/news')).toEqual({ ttl: 300, hot: false });
    expect(isPostAllowed('tbf', '/api/Player/get-player-detail-match-statistic/174/123')).toBe(true);
    expect(isPostAllowed('tbf', '/api/League/get-featured-9-leagues')).toBe(false);
  });
});
