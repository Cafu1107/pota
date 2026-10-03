import { describe, expect, it } from 'vitest';
// @ts-expect-error plain ESM module without types
import { handleComments, hashIp, memoryStore, sameSecret, HIDE_AFTER_REPORTS, MIN_INTERVAL_S } from '../server/comments.mjs';
import { censor, filterEmoji, hasLink, moderate, ALLOWED_EMOJI, MAX_BODY } from '../server/moderation.mjs';
import { buildHistory, seasonLabel, summarizeHistory } from '../src/lib/history';
import { matchVideo, nameWords, type Video } from '../src/data/videos';
import type { Game } from '../src/data/types';

describe('comment moderation', () => {
  it('masks Turkish and English swearing, including spaced and look-alike spellings', () => {
    const rude = ['amk', 'a.m.k', 'a m k', 'siktir git', 'S1KT1R', 'siiiiktir', 'orospu', 'orospucocugu', 'yarrak', 'piç', 'götün', 'salak', 'aptallık', 'gerizekalı', 'şerefsiz', 'aq', 'amına', 'pezevenk', 'fuck', 'motherfucker', 'shit', 'asshole', 'bok', 'boktan', 'kahpe', 'yavşak', 'o.ç'];
    for (const w of rude) expect(censor(`hakem ${w} oldu`).count, w).toBe(1);
    expect(censor('Bu ne salak hakem amk').text).toBe('Bu ne s**** hakem a**');
  });

  it('leaves basketball talk alone', () => {
    const clean = ['sıkı savunma', 'sık sık faul', 'sıkıştı', 'aşıktır bu takıma', 'aşıkım', 'kayarak geçti', 'Allah namına', 'fukara takım', 'SG pozisyonu', 'maçı götürdü', 'got it', 'normal', 'malzeme', 'boks', 'picture', 'amatör', 'sıktı', 'as oyuncu', 'Kipaş K.B.B.', 'Nigeria', 'basketbol salonu'];
    for (const w of clean) expect(censor(w).count, w).toBe(0);
  });

  it('keeps only the allowed emoji and drops photo and video ones', () => {
    expect(ALLOWED_EMOJI).toHaveLength(6);
    const r = filterEmoji('Harika 🔥🏀👏🏽 📸🎥😡🤬 ❤️');
    expect(r.text.replace(/\s+/g, ' ').trim()).toBe('Harika 🔥🏀👏');
    expect(r.removed).toBe(5);
  });

  it('refuses links in any common form', () => {
    for (const l of ['youtube.com/abc', 'https://x.co', 'www.site.org', 't.me/kanal', 'imgur.com', 'instagram . com', 'youtu.be/xyz']) expect(hasLink(l), l).toBe(true);
    for (const ok of ['K.B.B. yine kazandı', 'maç 78-71 bitti.Tebrikler', '3.çeyrek']) expect(hasLink(ok), ok).toBe(false);
  });

  it('applies every rule in one pass', () => {
    expect(moderate({ name: '  Ali 🔥 ', body: 'Çok iyi\n\n\n\nmaç 🏀😡 salak' })).toEqual({ ok: true, name: 'Ali', body: 'Çok iyi\n\nmaç 🏀 s****', censored: 1, emojiRemoved: 1 });
    expect(moderate({ name: 'x', body: '🤬' })).toEqual({ ok: false, error: 'short' });
    expect(moderate({ name: 'x', body: 'a'.repeat(MAX_BODY + 1) })).toEqual({ ok: false, error: 'long' });
    expect(moderate({ name: 'x', body: 'izle www.foo.com' })).toEqual({ ok: false, error: 'link' });
  });
});

describe('comments API', () => {
  const req = (over: Record<string, unknown>) => ({ method: 'GET', path: '/comments', query: new URLSearchParams(), ipHash: 'ip1', ...over });
  const post = (body: object, ipHash = 'ip1') => req({ method: 'POST', body: JSON.stringify(body), ipHash });

  it('stores a cleaned comment and lists it', async () => {
    const store = memoryStore();
    const r = await handleComments(post({ game: 'bsl:1', name: 'Can', body: 'Harika maç salak hakem 😡' }), store, { now: 1_000_000 });
    expect(r.status).toBe(201);
    expect(r.body.comment.body).toBe('Harika maç s**** hakem');
    const list = await handleComments(req({ query: new URLSearchParams('game=bsl:1') }), store);
    expect(list.body.total).toBe(1);
  });

  it('limits how often one person can post, and refuses duplicates', async () => {
    const store = memoryStore();
    const t0 = 5_000_000;
    expect((await handleComments(post({ game: 'bsl:1', body: 'ilk yorum' }), store, { now: t0 })).status).toBe(201);
    const fast = await handleComments(post({ game: 'bsl:1', body: 'ikinci' }), store, { now: t0 + 5_000 });
    expect(fast.status).toBe(429);
    expect(fast.body.retryAfter).toBe(MIN_INTERVAL_S - 5);
    const dup = await handleComments(post({ game: 'bsl:1', body: 'ilk yorum' }), store, { now: t0 + 60_000 });
    expect(dup.status).toBe(409);
    expect((await handleComments(post({ game: 'bsl:1', body: 'başka biri' }, 'ip2'), store, { now: t0 + 1_000 })).status).toBe(201);
  });

  it('rejects bad games, links and bots', async () => {
    const store = memoryStore();
    expect((await handleComments(post({ game: '<script>', body: 'selam' }), store)).status).toBe(400);
    expect((await handleComments(post({ game: 'bsl:1', body: 'bak t.me/x' }), store)).body).toEqual({ error: 'link' });
    const bot = await handleComments(post({ game: 'bsl:1', body: 'spam', website: 'http://x' }), store);
    expect(bot.status).toBe(201);
    expect(store.rows).toHaveLength(0);
  });

  it('hides a comment after enough distinct reports, and lets the admin hide one', async () => {
    const store = memoryStore();
    const c = (await handleComments(post({ game: 'bsl:1', body: 'bir yorum' }), store)).body.comment;
    for (let i = 0; i < HIDE_AFTER_REPORTS; i++) {
      await handleComments(req({ method: 'POST', path: `/comments/${c.id}/report`, ipHash: `r${i}` }), store);
      await handleComments(req({ method: 'POST', path: `/comments/${c.id}/report`, ipHash: `r${i}` }), store);
    }
    expect((await handleComments(req({ query: new URLSearchParams('game=bsl:1') }), store)).body.total).toBe(0);

    const d = (await handleComments(post({ game: 'bsl:2', body: 'ikinci yorum' }, 'ip9'), store)).body.comment;
    expect((await handleComments(req({ method: 'DELETE', path: `/comments/${d.id}`, authorization: 'Bearer nope' }), store, { adminToken: 'secret' })).status).toBe(401);
    expect((await handleComments(req({ method: 'DELETE', path: `/comments/${d.id}`, authorization: 'Bearer secret' }), store, { adminToken: 'secret' })).status).toBe(200);
  });

  it('compares the admin token without shortcuts', () => {
    expect(sameSecret('abc123', 'abc123')).toBe(true);
    expect(sameSecret('abc124', 'abc123')).toBe(false);
    expect(sameSecret('abc', 'abc123')).toBe(false);
    expect(sameSecret('abc123', undefined)).toBe(false);
    expect(sameSecret(undefined, 'abc123')).toBe(false);
  });

  it('never keeps the raw address', async () => {
    const h = await hashIp('203.0.113.7', 'salt');
    expect(h).toMatch(/^[0-9a-f]{24}$/);
    expect(h).not.toContain('203');
    expect(await hashIp('203.0.113.7', 'other')).not.toBe(h);
  });
});

const team = (id: string, name: string) => ({ id, name });
function game(id: string, start: string, home: string, away: string, hs: number | null = null, as: number | null = null): Game {
  const final = hs !== null && as !== null;
  return {
    id,
    leagueId: 'euroleague',
    start,
    status: final ? 'final' : 'scheduled',
    home: { team: team(home, home.toUpperCase()), score: hs, periods: [], winner: final ? hs! > as! : undefined },
    away: { team: team(away, away.toUpperCase()), score: as, periods: [], winner: final ? as! > hs! : undefined },
  };
}

describe('head to head', () => {
  const now = game('g0', '2026-10-08T18:00:00Z', 'pan', 'ulk');
  const homeGames = [
    game('m1', '2026-02-13T18:00:00Z', 'pan', 'ulk', 83, 85),
    game('m2', '2025-12-10T18:00:00Z', 'ulk', 'pan', 77, 81),
    game('m3', '2025-01-10T18:00:00Z', 'pan', 'ulk', 91, 90),
    game('f1', '2026-10-02T18:00:00Z', 'pan', 'mac', 90, 67),
    game('later', '2026-12-29T18:00:00Z', 'ulk', 'pan'),
  ];
  const awayGames = [game('m1', '2026-02-13T18:00:00Z', 'pan', 'ulk', 83, 85), game('f2', '2026-10-02T18:00:00Z', 'ulk', 'dub', 76, 66)];

  it('collects meetings once, newest first, and form only before the game', () => {
    const h = buildHistory(now, homeGames, awayGames, ['2026-27', '2025-26']);
    expect(h.meetings.map((g) => g.id)).toEqual(['later', 'm1', 'm2', 'm3']);
    expect(h.form.home.map((g) => g.id)).toEqual(['f1', 'm1', 'm2', 'm3']);
    expect(h.form.away.map((g) => g.id)).toEqual(['f2', 'm1']);
  });

  it('sums wins, points and the biggest margin from each side', () => {
    const sum = summarizeHistory(now, buildHistory(now, homeGames, awayGames, []).meetings);
    expect(sum.played).toBe(3);
    expect(sum.wins).toEqual({ home: 2, away: 1 });
    expect(sum.avgPts.home).toBeCloseTo((83 + 81 + 91) / 3);
    expect(sum.biggest.home?.margin).toBe(4);
    expect(sum.biggest.away?.margin).toBe(2);
    expect(sum.last?.id).toBe('m1');
  });

  it('labels seasons consistently', () => {
    expect(seasonLabel('2026-2027')).toBe('2026-27');
    expect(seasonLabel(2025)).toBe('2025-26');
  });
});

describe('game videos', () => {
  const g = {
    ...game('E2026_29', '2026-10-02T17:45:00Z', 'ULK', 'DUB', 76, 66),
    home: { team: team('ULK', 'Fenerbahçe Tarfin Istanbul'), score: 76, periods: [], winner: true },
    away: { team: team('DUB', 'Dubai Basketball'), score: 66, periods: [], winner: false },
  };
  const v = (id: string, title: string, published: string, type: Video['type'] = 'highlights'): Video => ({ id, title, published, type, channel: 'EuroLeague' });

  it('folds Turkish letters when comparing names', () => {
    expect(nameWords('Fenerbahçe Tarfin İstanbul')).toEqual(['fenerbahce', 'tarfin', 'istanbul']);
  });

  it('finds the highlights of the right game', () => {
    const videos = [
      v('aaaaaaaaaaa', 'Besiktas - FC Barcelona | R3 Basketball Highlights 2026-27', '2026-10-02T20:52:00Z'),
      v('bbbbbbbbbbb', 'Fenerbahce Tarfin - Dubai Basketball | R3 Basketball Highlights 2026-27', '2026-10-02T20:38:00Z'),
      v('ccccccccccc', 'Fenerbahce Tarfin - FC Bayern Munich | R2 Basketball Highlights 2026-27', '2026-09-29T21:02:00Z'),
    ];
    expect(matchVideo(g, videos)?.id).toBe('bbbbbbbbbbb');
  });

  it('ignores videos outside the game window or with only one team', () => {
    expect(matchVideo(g, [v('ddddddddddd', 'Fenerbahce Tarfin - Dubai Basketball | Highlights', '2026-09-20T20:00:00Z')])).toBeUndefined();
    expect(matchVideo(g, [v('eeeeeeeeeee', 'Fenerbahce Tarfin - Real Madrid | Highlights', '2026-10-02T20:00:00Z')])).toBeUndefined();
  });

  it('accepts a federation stream published days before tip-off', () => {
    const s = v('fffffffffff', 'Fenerbahçe Tarfin - Dubai Basketball Türkiye Sigorta TBL 4.Hafta', '2026-09-29T16:00:00Z', 'stream');
    expect(matchVideo(g, [s])?.id).toBe('fffffffffff');
  });
});

describe('security hardening', () => {
  it('masks reserved and empty nicknames, caps zalgo and line floods, refuses oversized input early', () => {
    for (const n of ['Admin', 'pota', 'Yönetici', 'MODERATÖR', '★★★']) expect((moderate({ name: n, body: 'merhaba' }) as { name: string }).name, n).toBe('');
    expect((moderate({ name: 'Can', body: 'merhaba' }) as { name: string }).name).toBe('Can');
    const z = moderate({ name: 'x', body: 'a\u0301\u0302\u0303\u0304\u0305\u0306 b' }) as { body: string };
    expect([...z.body.normalize('NFD')].filter((c) => /\p{M}/u.test(c)).length).toBeLessThanOrEqual(3);
    const lines = moderate({ name: 'x', body: Array.from({ length: 30 }, (_, i) => `satır ${i}`).join('\n') }) as { body: string };
    expect(lines.body.split('\n').length).toBeLessThanOrEqual(8);
    expect(moderate({ name: 'x', body: 'x'.repeat(MAX_BODY * 4 + 1) })).toEqual({ ok: false, error: 'long' });
  });
});
