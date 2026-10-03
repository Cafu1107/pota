// EuroLeague / EuroCup: api-live.euroleague.net (v2/v3) + live.euroleague.net (live feeds).
import { getJson, getJsonOrNull } from '../http';
import type {
  CareerRow, Game, GameDetail, GameLeader, GameLogRow, LeaderCategory, LeaderKey, LeagueDef, LeagueSchedule, Play,
  PlayKind, PlayerAverages, PlayerDetail, PlayerHit, PlayerLine, Provider, RosterPlayer, Shot, Side, StandingGroup,
  StandingRow, StatLine, TeamBox, TeamCompareRow, TeamDetail, TeamRef,
} from '../types';
import { compareFromTotals, num, numOrNull, parseMinutes, personName, pushCompare, sortGames, teamName } from '../normalize';
import { ageFrom, clockToSeconds, localDayOf, localDayRange } from '../../lib/time';

// Turkish club names arrive without Turkish letters ("Fenerbahce").
const TR_FIXES: Array<[RegExp, string]> = [
  [/Fenerbahce/g, 'Fenerbahçe'], [/Besiktas/g, 'Beşiktaş'], [/Karsiyaka/g, 'Karşıyaka'], [/Bahcesehir/g, 'Bahçeşehir'],
  [/Turk Telekom/g, 'Türk Telekom'], [/Tofas/g, 'Tofaş'], [/Pinar/g, 'Pınar'], [/Darussafaka/g, 'Darüşşafaka'],
  [/Buyukcekmece/g, 'Büyükçekmece'], [/Aliaga/g, 'Aliağa'], [/Turkiye/g, 'Türkiye'],
];
const fixTr = (s: string) => TR_FIXES.reduce((acc, [re, to]) => acc.replace(re, to), s);

export function seasonCode(league: LeagueDef, at = new Date()): string {
  const y = at.getMonth() >= 6 ? at.getFullYear() : at.getFullYear() - 1;
  return `${league.elCode}${y}`;
}

/** Game ids are "E2026_25" (season + game code), like the API's own identifier. */
function splitId(league: LeagueDef, id: string): [string, string] {
  const m = /^([A-Z]\d{4})_(\d+)$/.exec(id);
  return m ? [m[1], m[2]] : [seasonCode(league), id];
}

const v2 = <T = any>(league: LeagueDef, season: string, path: string, params?: Record<string, string | number | undefined>) =>
  getJson<T>('el', `/v2/competitions/${league.elCode}/seasons/${season}${path}`, params);

function clubRef(c: any): TeamRef {
  return {
    id: String(c?.code ?? '').trim(),
    name: fixTr(c?.name ?? ''),
    short: fixTr(c?.abbreviatedName ?? c?.editorialName ?? c?.name ?? ''),
    abbr: c?.tvCode ?? c?.code,
    logo: c?.images?.crest,
  };
}

function partials(p: any): number[] {
  if (!p) return [];
  const out = [p.partials1, p.partials2, p.partials3, p.partials4].map((x) => numOrNull(x));
  const extra = p.extraPeriods ? Object.values<any>(p.extraPeriods).map((x) => numOrNull(x)) : [];
  const all = [...out, ...extra];
  while (all.length && all[all.length - 1] === null) all.pop();
  return all.map((x) => x ?? 0);
}

function gameFrom(league: LeagueDef, g: any): Game {
  const played = g.played === true;
  const hs = numOrNull(g.local?.score);
  const as = numOrNull(g.road?.score);
  const status: Game['status'] = played ? 'final' : /postpon/i.test(g.gameStatus ?? '') ? 'postponed' : /cancel/i.test(g.gameStatus ?? '') ? 'cancelled' : 'scheduled';
  const hp = partials(g.local?.partials);
  return {
    id: `${g.season?.code ?? seasonCode(league)}_${g.gameCode}`,
    leagueId: league.id,
    start: g.utcDate ? new Date(g.utcDate).toISOString() : new Date(g.date).toISOString(),
    timeTbd: g.confirmedHour === false,
    status,
    period: played ? Math.max(4, hp.length) : undefined,
    home: { team: clubRef(g.local?.club), score: played ? hs : null, periods: played ? hp : [], winner: played && hs !== null && as !== null ? hs > as : undefined },
    away: { team: clubRef(g.road?.club), score: played ? as : null, periods: played ? partials(g.road?.partials) : [], winner: played && hs !== null && as !== null ? as > hs : undefined },
    venue: g.venue?.name ? teamName(g.venue.name, 'en') : undefined,
    round: g.phaseType?.code === 'RS' ? `R${g.round}` : g.roundName ?? g.phaseType?.name,
    ref: { season: g.season?.code, code: g.gameCode, phase: g.phaseType?.code, round: g.round },
  };
}

// ---------- live overlay ----------

interface LiveHeader {
  Live?: boolean;
  Quarter?: string;
  RemainingPartialTime?: string;
  ScoreA?: string;
  ScoreB?: string;
  GameTime?: string;
  [k: `ScoreQuarter${number}${'A' | 'B'}`]: number | undefined;
  ScoreExtraTimeA?: number;
  ScoreExtraTimeB?: number;
}

/** Header quarter scores are running totals; turn them into points per period. */
function headerPeriods(h: LiveHeader, side: 'A' | 'B'): number[] {
  const cum: number[] = [];
  for (let q = 1; q <= 4; q++) {
    const v = numOrNull(h[`ScoreQuarter${q}${side}`]);
    if (v === null) break;
    cum.push(v);
  }
  while (cum.length > 1 && cum[cum.length - 1] === 0) cum.pop();
  const per = cum.map((v, i) => v - (i ? cum[i - 1] : 0));
  const extra = numOrNull(side === 'A' ? h.ScoreExtraTimeA : h.ScoreExtraTimeB) ?? 0;
  const total = numOrNull(side === 'A' ? h.ScoreA : h.ScoreB) ?? 0;
  const last = cum[cum.length - 1] ?? 0;
  if (extra > 0 && cum.length === 4 && total > last) per.push(total - last);
  return per;
}

async function liveHeader(season: string, code: string | number): Promise<LiveHeader | null> {
  try {
    return await getJson<LiveHeader>('el-live', '/api/Header', { gamecode: code, seasoncode: season });
  } catch {
    return null;
  }
}

/** Apply live Header data to a game that has started but is not marked played. */
function applyHeader(g: Game, h: LiveHeader | null): Game {
  if (!h || g.status === 'final') return g;
  const a = numOrNull(h.ScoreA);
  const b = numOrNull(h.ScoreB);
  if (a === null || b === null) return g;
  const q = String(h.Quarter ?? '').trim();
  const clock = h.RemainingPartialTime?.trim();
  const gameSec = clockToSeconds(h.GameTime);
  const hp = headerPeriods(h, 'A');
  const ap = headerPeriods(h, 'B');
  // The feed keeps Live=true after the buzzer; an empty quarter with the clock run out
  // at 40:00 (or later in overtime) and a decided score means the game is over.
  const over = q === '' && clock === '00:00' && gameSec >= 40 * 60 && a !== b && a + b > 0;
  if (over || (!h.Live && a + b > 0 && gameSec >= 40 * 60)) {
    return {
      ...g,
      status: 'final',
      period: Math.max(4, hp.length),
      clock: undefined,
      home: { ...g.home, score: a, winner: a > b, periods: hp.length ? hp : g.home.periods },
      away: { ...g.away, score: b, winner: b > a, periods: ap.length ? ap : g.away.periods },
    };
  }
  if (!h.Live) return g;
  const period = /^\d+$/.test(q) ? Number(q) : /E|OT/i.test(q) ? Math.max(5, hp.length) : hp.length || undefined;
  return {
    ...g,
    status: 'live',
    period,
    clock,
    isBreak: clock === '00:00',
    isHalftime: clock === '00:00' && period === 2,
    home: { ...g.home, score: a, periods: hp.length ? hp : g.home.periods },
    away: { ...g.away, score: b, periods: ap.length ? ap : g.away.periods },
  };
}

async function withLive(games: Game[]): Promise<Game[]> {
  const now = Date.now();
  return Promise.all(
    games.map(async (g) => {
      const started = new Date(g.start).getTime() <= now + 5 * 60_000;
      const recent = now - new Date(g.start).getTime() < 4 * 3600_000;
      if (g.status !== 'scheduled' || !started || !recent) return g;
      return applyHeader(g, await liveHeader(String(g.ref?.season), String(g.ref?.code)));
    }),
  );
}

// ---------- rounds & games ----------

interface Round { round: number; phaseTypeCode: string; name: string; minGameStartDate: string; maxGameStartDate: string }

async function rounds(league: LeagueDef, season: string): Promise<Round[]> {
  const j = await v2<{ data: Round[] }>(league, season, '/rounds');
  return (j?.data ?? []).sort((a, b) => new Date(a.minGameStartDate).getTime() - new Date(b.minGameStartDate).getTime());
}

async function roundGames(league: LeagueDef, season: string, r: Pick<Round, 'round' | 'phaseTypeCode'>): Promise<Game[]> {
  const j = await v2(league, season, '/games', { phaseTypeCode: r.phaseTypeCode, roundNumber: r.round });
  return (j?.data ?? []).map((g: any) => gameFrom(league, g));
}

async function gamesByDate(league: LeagueDef, day: string): Promise<Game[]> {
  const season = seasonCode(league);
  const [from, to] = localDayRange(day);
  const pad = 36 * 3600_000;
  const list = (await rounds(league, season)).filter(
    (r) => new Date(r.minGameStartDate).getTime() - pad < to && new Date(r.maxGameStartDate).getTime() + pad > from,
  );
  const all = (await Promise.all(list.map((r) => roundGames(league, season, r)))).flat();
  const today = all.filter((g) => localDayOf(g.start) === day);
  return sortGames(await withLive(today));
}

// ---------- game detail ----------

const trimCode = (s: unknown) => String(s ?? '').trim();
const personCode = (s: unknown) => trimCode(s).replace(/^P/, '');

function lineFromLive(p: any): StatLine {
  const fgm2 = num(p.FieldGoalsMade2), fga2 = num(p.FieldGoalsAttempted2), fgm3 = num(p.FieldGoalsMade3), fga3 = num(p.FieldGoalsAttempted3);
  const sec = parseMinutes(p.Minutes ?? undefined);
  return {
    sec, min: p.Minutes ?? undefined,
    pts: num(p.Points), reb: num(p.TotalRebounds), oreb: num(p.OffensiveRebounds), dreb: num(p.DefensiveRebounds),
    ast: num(p.Assistances), stl: num(p.Steals), blk: num(p.BlocksFavour), tov: num(p.Turnovers), pf: num(p.FoulsCommited),
    fgm: fgm2 + fgm3, fga: fga2 + fga3, tpm: fgm3, tpa: fga3, ftm: num(p.FreeThrowsMade), fta: num(p.FreeThrowsAttempted),
    pm: numOrNull(p.Plusminus) ?? undefined, eff: num(p.Valuation),
  };
}

function lineFromV2(s: any): StatLine {
  return {
    sec: num(s?.timePlayed), min: undefined,
    pts: num(s?.points), reb: num(s?.totalRebounds), oreb: num(s?.offensiveRebounds), dreb: num(s?.defensiveRebounds),
    ast: num(s?.assistances), stl: num(s?.steals), blk: num(s?.blocksFavour), tov: num(s?.turnovers), pf: num(s?.foulsCommited),
    fgm: num(s?.fieldGoalsMadeTotal), fga: num(s?.fieldGoalsAttemptedTotal), tpm: num(s?.fieldGoalsMade3), tpa: num(s?.fieldGoalsAttempted3),
    ftm: num(s?.freeThrowsMade), fta: num(s?.freeThrowsAttempted), pm: numOrNull(s?.plusMinus) ?? undefined, eff: num(s?.valuation),
  };
}

function liveBox(box: any, photos: Map<string, { photo?: string; position?: string }>): Record<Side, TeamBox> | undefined {
  const stats: any[] = box?.Stats ?? [];
  if (stats.length < 2) return undefined;
  const sideOf = (i: number): Side => (i === 0 ? 'home' : 'away');
  const out = {} as Record<Side, TeamBox>;
  stats.slice(0, 2).forEach((t, i) => {
    const players: PlayerLine[] = (t.PlayersStats ?? []).map((p: any) => {
      const id = personCode(p.Player_ID);
      const extra = photos.get(id);
      const line = lineFromLive(p);
      const dnp = !p.Minutes || p.Minutes === 'DNP' || (line.sec ?? 0) === 0;
      return {
        ...line,
        id,
        name: personName(p.Player),
        number: trimCode(p.Dorsal),
        position: extra?.position,
        photo: extra?.photo,
        starter: p.IsStarter === 1,
        onCourt: p.IsPlaying === 1,
        dnp,
      } satisfies PlayerLine;
    });
    const totals = lineFromLive(t.totr ?? {});
    delete totals.sec; delete totals.min; delete totals.pm;
    out[sideOf(i)] = { players, totals, coach: t.Coach ? personName(t.Coach) : undefined };
  });
  return out;
}

const PLAY_KIND: Record<string, PlayKind> = {
  '2FGM': 'two', '2FGA': 'two', '3FGM': 'three', '3FGA': 'three', FTM: 'ft', FTA: 'ft', D: 'rebound', O: 'rebound',
  AS: 'assist', ST: 'steal', TO: 'turnover', FV: 'block', AG: 'other', CM: 'foul', CMU: 'foul', CMT: 'foul', CMD: 'foul',
  OF: 'foul', CCH: 'foul', B: 'foul', C: 'foul', RV: 'other', IN: 'sub', OUT: 'sub', TOUT: 'timeout', TOUT_TV: 'timeout',
  BP: 'period', EP: 'period', EG: 'period', JB: 'jump',
};

const EL_DETAIL: Record<string, string> = {
  BP: 'start', EP: 'end', EG: 'game-end', D: 'defensive', O: 'offensive', TOUT_TV: 'tv', CMU: 'unsportsmanlike',
  CMT: 'technical', CMD: 'disqualifying', OF: 'offensive', IN: 'in', OUT: 'out', B: 'bench', C: 'coach', CCH: 'coach',
};

function playsFrom(pbp: any, homeCode: string): Play[] {
  const quarters: Array<[string, number]> = [['FirstQuarter', 1], ['SecondQuarter', 2], ['ThirdQuarter', 3], ['ForthQuarter', 4]];
  const out: Play[] = [];
  let lastA = 0;
  let lastB = 0;
  const pushQuarter = (rows: any[], period: number) => {
    for (const r of rows ?? []) {
      const type: string = String(r.PLAYTYPE ?? '').trim();
      if (type === 'RV' || type === 'AG') continue; // mirrored by the foul / block entries
      const kind = PLAY_KIND[type] ?? 'other';
      const team = trimCode(r.CODETEAM);
      const a = numOrNull(r.POINTS_A);
      const b = numOrNull(r.POINTS_B);
      const scored = (a !== null && a !== lastA) || (b !== null && b !== lastB);
      const points = scored ? Math.abs((a ?? lastA) - lastA) + Math.abs((b ?? lastB) - lastB) : undefined;
      if (a !== null) lastA = a;
      if (b !== null) lastB = b;
      out.push({
        id: `${period}-${r.NUMBEROFPLAY}`,
        period,
        clock: r.MARKERTIME || '',
        side: team ? (team === homeCode ? 'home' : 'away') : undefined,
        playerId: r.PLAYER_ID ? personCode(r.PLAYER_ID) || undefined : undefined,
        player: r.PLAYER ? personName(r.PLAYER) : undefined,
        kind,
        detail: EL_DETAIL[type],
        text: String(r.PLAYINFO ?? '').replace(/\s+/g, ' ').trim(),
        made: ['2FGM', '3FGM', 'FTM'].includes(type) ? true : ['2FGA', '3FGA', 'FTA'].includes(type) ? false : undefined,
        points,
        homeScore: lastA,
        awayScore: lastB,
      });
    }
  };
  for (const [key, n] of quarters) pushQuarter(pbp?.[key], n);
  const extra: any[] = pbp?.ExtraTime ?? [];
  if (extra.length) {
    // Overtimes share one list; a new BP starts the next period.
    let n = 4;
    let chunk: any[] = [];
    for (const r of extra) {
      if (String(r.PLAYTYPE).trim() === 'BP' && chunk.length) {
        pushQuarter(chunk, ++n);
        chunk = [];
      }
      chunk.push(r);
    }
    if (chunk.length) pushQuarter(chunk, ++n);
  }
  return out;
}

function shotsFrom(points: any, homeCode: string): Shot[] {
  const out: Shot[] = [];
  for (const r of points?.Rows ?? []) {
    const act = String(r.ID_ACTION ?? '');
    if (!/^(2|3)FG[MA]$/.test(act)) continue;
    const x = num(r.COORD_X) / 100;
    const y = num(r.COORD_Y) / 100 + 1.575;
    out.push({
      x: Math.max(-7.5, Math.min(7.5, x)),
      y: Math.max(0, Math.min(14, y)),
      made: act.endsWith('M'),
      value: act.startsWith('3') ? 3 : 2,
      side: trimCode(r.TEAM) === homeCode ? 'home' : 'away',
      period: Math.min(5, Math.ceil(num(r.MINUTE) / 10)) || undefined,
      playerId: personCode(r.ID_PLAYER),
      player: personName(r.PLAYER),
    });
  }
  return out;
}

async function game(league: LeagueDef, id: string): Promise<GameDetail> {
  const [season, code] = splitId(league, id);
  const live = (path: string) => getJsonOrNull('el-live', path, { gamecode: code, seasoncode: season });
  const [g2, header, box, pbp, pts, cmp, v2stats] = await Promise.all([
    v2(league, season, `/games/${code}`),
    live('/api/Header'),
    live('/api/Boxscore'),
    live('/api/PlaybyPlay'),
    live('/api/Points'),
    live('/api/Comparison'),
    getJsonOrNull('el', `/v2/competitions/${league.elCode}/seasons/${season}/games/${code}/stats`),
  ]);
  let g = applyHeader(gameFrom(league, g2), header);
  const homeCode = g.home.team.id;

  // Quarter scores from the live box when the game has not been finalized in v2 yet.
  const byQ: any[] = box?.ByQuarter ?? [];
  if (byQ.length === 2 && !g.home.periods.length) {
    const qs = (r: any) => ['Quarter1', 'Quarter2', 'Quarter3', 'Quarter4'].map((k) => numOrNull(r[k])).filter((x): x is number => x !== null);
    const extra = (r: any) => (numOrNull(r.Extratime ?? r.ExtraTime) ? [num(r.Extratime ?? r.ExtraTime)] : []);
    g = { ...g, home: { ...g.home, periods: [...qs(byQ[0]), ...extra(byQ[0])] }, away: { ...g.away, periods: [...qs(byQ[1]), ...extra(byQ[1])] } };
  }

  const photos = new Map<string, { photo?: string; position?: string }>();
  for (const side of ['local', 'road'] as const) {
    for (const p of v2stats?.[side]?.players ?? []) {
      photos.set(String(p.player?.person?.code), { photo: p.player?.images?.headshot, position: p.player?.positionName });
    }
  }
  if (!photos.size && box?.Stats?.length) {
    // Live games: the per-game stats feed fills in later, so take headshots from the club rosters.
    const rosters = await Promise.all(
      [homeCode, g.away.team.id].map((code) =>
        getJsonOrNull<any[]>('el', `/v2/competitions/${league.elCode}/seasons/${season}/clubs/${code}/people`).catch(() => null),
      ),
    );
    for (const list of rosters) {
      for (const x of Array.isArray(list) ? list : []) {
        if (x.type === 'J') photos.set(String(x.person?.code), { photo: x.images?.headshot, position: x.positionName ?? undefined });
      }
    }
  }
  let boxes = liveBox(box, photos);
  if (!boxes && v2stats?.local?.players?.length) {
    boxes = {} as Record<Side, TeamBox>;
    for (const [side, key] of [['home', 'local'], ['away', 'road']] as const) {
      const t = v2stats[key];
      boxes[side] = {
        players: (t.players ?? []).map((p: any) => {
          const line = lineFromV2(p.stats);
          return {
            ...line,
            id: String(p.player?.person?.code),
            name: personName(p.player?.person?.name),
            number: p.player?.dorsal,
            position: p.player?.positionName,
            photo: p.player?.images?.headshot,
            starter: p.stats?.startFive === true,
            dnp: (line.sec ?? 0) === 0,
          } satisfies PlayerLine;
        }),
        totals: (() => { const tl = lineFromV2(t.total); delete tl.sec; return tl; })(),
        coach: t.coach?.name ? personName(t.coach.name) : undefined,
      };
    }
  }

  let compare: TeamCompareRow[] | undefined = boxes ? compareFromTotals(boxes.home.totals, boxes.away.totals) : undefined;
  if (compare && cmp) {
    pushCompare(compare, 'bench', cmp.PointsBenchA, cmp.PointsBenchB);
    pushCompare(compare, 'biggestLead', cmp.maxLeadA, cmp.maxLeadB);
    pushCompare(compare, 'biggestRun', cmp.maxA, cmp.maxB);
  }
  if (compare && boxes && boxes.home.totals.fga + boxes.away.totals.fga === 0) compare = undefined;

  const leaders: GameLeader[] = [];
  if (boxes) {
    for (const side of ['home', 'away'] as Side[]) {
      for (const key of ['pts', 'reb', 'ast', 'eff'] as const) {
        const best = [...boxes[side].players].sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0))[0];
        if (best && (best[key] ?? 0) > 0) leaders.push({ key, side, playerId: best.id, name: best.name, photo: best.photo, value: best[key] ?? 0 });
      }
    }
  }

  const plays = pbp ? playsFrom(pbp, homeCode) : [];
  const shots = pts ? shotsFrom(pts, homeCode) : [];
  const refs = [g2?.referee1, g2?.referee2, g2?.referee3, g2?.referee4].filter(Boolean).map((r: any) => personName(r.name));
  const missing: GameDetail['missing'] = [];
  if (!boxes) missing.push('box');
  if (!plays.length) missing.push('plays');
  if (!shots.length) missing.push('shots');
  return {
    game: g,
    box: boxes,
    compare,
    plays,
    shots,
    leaders,
    officials: refs.length ? refs : undefined,
    attendance: numOrNull(g2?.audience) || numOrNull(box?.Attendance) || undefined,
    coaches: boxes ? { home: boxes.home.coach, away: boxes.away.coach } : undefined,
    missing,
    updatedAt: Date.now(),
  };
}

// ---------- standings ----------

/** The highest-scoring result among those that arrive within `graceMs` of the first success. */
export async function bestOf<T>(tasks: Promise<T>[], score: (v: T) => number, graceMs: number): Promise<T | null> {
  const got: T[] = [];
  let gotFirst!: () => void;
  const first = new Promise<void>((resolve) => (gotFirst = resolve));
  const all = Promise.allSettled(
    tasks.map((p) =>
      p.then((v) => {
        if (v) {
          got.push(v);
          gotFirst();
        }
      }),
    ),
  );
  await Promise.race([first, all]);
  await Promise.race([all, new Promise((resolve) => setTimeout(resolve, graceMs))]);
  return got.reduce<T | null>((best, v) => (best === null || score(v) > score(best) ? v : best), null);
}

async function currentRound(league: LeagueDef, season: string): Promise<Round | undefined> {
  const list = (await rounds(league, season)).filter((r) => r.phaseTypeCode === 'RS');
  const now = Date.now();
  const started = list.filter((r) => new Date(r.minGameStartDate).getTime() <= now);
  return started[started.length - 1] ?? list[0];
}

async function standings(league: LeagueDef): Promise<StandingGroup[]> {
  const season = seasonCode(league);
  const r = await currentRound(league, season);
  if (!r) return [];
  // Some of EuroLeague's API replicas lag a round behind (seen 2026-10-03: about half the
  // answers missed Friday's games). Ask for a few copies and keep the one with the most games,
  // but never wait long for the extra copies: they warm the proxy cache for the next refresh.
  const path = `/v3/competitions/${league.elCode}/seasons/${season}/rounds/${r.round}/basicstandings`;
  const played = (c: any) => ((c?.teams ?? []) as any[]).reduce((sum, t) => sum + num(t.gamesPlayed), 0);
  const j = await bestOf(
    [0, 1, 2, 3].map((v) => (v ? getJson('el', path, { copy: v }) : getJson('el', path))),
    played,
    500,
  );
  if (!j) throw new Error('EuroLeague standings unavailable');
  const groups = new Map<string, StandingRow[]>();
  for (const t of j?.teams ?? []) {
    const name = t.groupName ?? '';
    const pct = numOrNull(String(t.winPercentage ?? '').replace('%', ''));
    const row: StandingRow = {
      rank: num(t.position),
      team: clubRef(t.club),
      gp: num(t.gamesPlayed),
      w: num(t.gamesWon),
      l: num(t.gamesLost),
      pct: pct !== null ? pct / 100 : undefined,
      pf: numOrNull(t.pointsFor) ?? undefined,
      pa: numOrNull(t.pointsAgainst) ?? undefined,
      diff: numOrNull(t.pointsDifference) ?? undefined,
      home: t.homeRecord,
      away: t.awayRecord,
      form: Array.isArray(t.last5Form) ? t.last5Form.map((x: string) => x === 'W') : undefined,
    };
    if (league.elCode === 'E') row.zone = row.rank <= 6 ? 'playoff' : row.rank <= 10 ? 'playin' : undefined;
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name)!.push(row);
  }
  return [...groups.entries()].map(([name, rows]) => ({
    name: groups.size > 1 ? name : undefined,
    rows: rows.sort((a, b) => a.rank - b.rank),
  }));
}

// ---------- teams ----------

async function teams(league: LeagueDef): Promise<TeamRef[]> {
  const j = await v2(league, seasonCode(league), '/clubs');
  return (j?.data ?? []).map(clubRef).sort((a: TeamRef, b: TeamRef) => a.name.localeCompare(b.name));
}

function rosterFrom(list: any[]): { roster: RosterPlayer[]; coach?: string } {
  const roster: RosterPlayer[] = [];
  let coach: string | undefined;
  for (const x of list ?? []) {
    if (x.type === 'E' && !coach) coach = personName(x.person?.name);
    if (x.type !== 'J' || x.active === false) continue;
    roster.push({
      id: String(x.person?.code),
      name: personName(x.person?.name),
      number: x.dorsal || undefined,
      position: x.positionName ?? undefined,
      photo: x.images?.headshot,
      height: num(x.person?.height) || undefined,
      weight: num(x.person?.weight) || undefined,
      birthDate: x.person?.birthDate,
      age: ageFrom(x.person?.birthDate),
      nationality: x.person?.country?.name,
    });
  }
  roster.sort((a, b) => num(a.number, 999) - num(b.number, 999));
  return { roster, coach };
}

async function team(league: LeagueDef, id: string): Promise<TeamDetail> {
  const season = seasonCode(league);
  const [club, people, sched, table, tstats] = await Promise.all([
    getJson('el', `/v2/clubs/${id}`),
    v2<any[]>(league, season, `/clubs/${id}/people`),
    v2(league, season, '/games', { teamCode: id }),
    standings(league).catch(() => [] as StandingGroup[]),
    getJsonOrNull('el', `/v3/competitions/${league.elCode}/statistics/teams/traditional`, { seasonMode: 'Single', seasonCode: season, statisticMode: 'PerGame', phaseTypeCode: 'RS' }),
  ]);
  const { roster, coach } = rosterFrom(Array.isArray(people) ? people : []);
  const row = table.flatMap((g) => g.rows.map((r) => ({ r, group: g.name }))).find((x) => x.r.team.id === id);
  const ts = (tstats?.teams ?? []).find((t: any) => t.team?.code === id);
  const pctNum = (v: unknown) => numOrNull(String(v ?? '').replace('%', '')) ?? undefined;
  const stats: TeamDetail['stats'] = ts
    ? ([
        { key: 'pts', value: num(ts.pointsScored) },
        { key: 'reb', value: num(ts.totalRebounds) },
        { key: 'ast', value: num(ts.assists) },
        { key: 'stl', value: num(ts.steals) },
        { key: 'blk', value: num(ts.blocks) },
        { key: 'tov', value: num(ts.turnovers) },
        { key: 'fgPct', value: (() => { const m = num(ts.twoPointersMade) + num(ts.threePointersMade); const a = num(ts.twoPointersAttempted) + num(ts.threePointersAttempted); return a ? (m / a) * 100 : undefined; })() },
        { key: 'tpPct', value: pctNum(ts.threePointersPercentage) },
        { key: 'ftPct', value: pctNum(ts.freeThrowsPercentage) },
        { key: 'eff', value: num(ts.pir) },
      ].filter((s) => s.value !== undefined) as TeamDetail['stats'])
    : undefined;
  const base = clubRef(club);
  return {
    team: { ...base, short: row?.r.team.short ?? base.short, abbr: row?.r.team.abbr ?? base.abbr },
    leagueId: league.id,
    city: club?.city ? teamName(club.city, 'en') : undefined,
    venue: club?.venue?.name ? teamName(club.venue.name, 'en') : undefined,
    capacity: numOrNull(club?.venue?.capacity) ?? undefined,
    coach,
    record: row ? { w: row.r.w, l: row.r.l } : undefined,
    standing: row ? { rank: row.r.rank, group: row.group } : undefined,
    roster,
    games: sortGames(await withLive((sched?.data ?? []).map((g: any) => gameFrom(league, g)))),
    stats,
  };
}

// ---------- players ----------

function avgFromV2(a: any, gp: number, gs?: number): PlayerAverages {
  const l = lineFromV2(a);
  return {
    gp, gs,
    min: l.sec !== undefined ? l.sec / 60 : undefined,
    pts: l.pts, reb: l.reb, oreb: l.oreb, dreb: l.dreb, ast: l.ast, stl: l.stl, blk: l.blk, tov: l.tov, pf: l.pf, eff: l.eff,
    fgm: l.fgm, fga: l.fga, tpm: l.tpm, tpa: l.tpa, ftm: l.ftm, fta: l.fta,
  };
}

function withPct(avg: PlayerAverages, tot: StatLine): PlayerAverages {
  return {
    ...avg,
    fgPct: tot.fga ? (tot.fgm / tot.fga) * 100 : undefined,
    tpPct: tot.tpa ? (tot.tpm / tot.tpa) * 100 : undefined,
    ftPct: tot.fta ? (tot.ftm / tot.fta) * 100 : undefined,
  };
}

async function seasonStats(league: LeagueDef, season: string, code: string) {
  return getJsonOrNull(`el`, `/v2/competitions/${league.elCode}/seasons/${season}/people/${code}/stats`);
}

async function player(league: LeagueDef, id: string): Promise<PlayerDetail> {
  const season = seasonCode(league);
  const year = Number(season.slice(1));
  const prev = [1, 2, 3].map((d) => `${league.elCode}${year - d}`);
  const [person, reg, cur, ...older] = await Promise.all([
    getJson('el', `/v2/people/${id}`),
    getJsonOrNull('el', `/v2/competitions/${league.elCode}/seasons/${season}/people/${id}`),
    seasonStats(league, season, id),
    ...prev.map((s) => seasonStats(league, s, id).catch(() => null)),
  ]);
  const r = reg?.data?.[0];
  const bio = {
    id,
    name: personName(person?.name),
    number: r?.dorsal || undefined,
    position: r?.positionName ?? undefined,
    photo: r?.images?.headshot ?? r?.images?.action,
    team: r?.club ? clubRef(r.club) : undefined,
    height: num(person?.height) || undefined,
    weight: num(person?.weight) || undefined,
    birthDate: person?.birthDate,
    age: ageFrom(person?.birthDate),
    birthPlace: person?.birthCountry?.name,
    nationality: person?.country?.name,
  };

  const careerOf = (s: any, label: string): CareerRow | null => {
    const games: any[] = s?.games ?? [];
    const gp = games.filter((g) => num(g.stats?.timePlayed) > 0).length;
    if (!gp || !s?.averagePerGame) return null;
    const tot = lineFromV2(s.accumulated);
    const gs = num(s?.accumulated?.gamesStarted) || undefined;
    const club = games[games.length - 1]?.playerClubCode;
    const g0 = games[games.length - 1]?.game;
    const teamName = g0 ? (g0.local?.club?.code === club ? g0.local?.club : g0.road?.club) : undefined;
    return { season: label, team: teamName ? fixTr(teamName.abbreviatedName ?? teamName.name) : club, league: league.short, avg: withPct(avgFromV2(s.averagePerGame, gp, gs), tot) };
  };

  const label = (s: string) => `${s.slice(1)}-${String((Number(s.slice(1)) + 1) % 100).padStart(2, '0')}`;
  const current = careerOf(cur, label(season));
  const career = [current, ...older.map((s, i) => careerOf(s, label(prev[i])))].filter((x): x is CareerRow => !!x);

  const gameLog: GameLogRow[] = (cur?.games ?? [])
    .filter((x: any) => x.game?.played)
    .map((x: any) => {
      const g = x.game;
      const mine = x.playerClubCode;
      const home = g.local?.club?.code === mine;
      const us = home ? g.local : g.road;
      const them = home ? g.road : g.local;
      const won = num(us?.score) > num(them?.score);
      const line = lineFromV2(x.stats);
      line.min = line.sec ? `${Math.floor(line.sec / 60)}:${String(Math.round(line.sec % 60)).padStart(2, '0')}` : undefined;
      return {
        gameId: `${g.season?.code ?? season}_${g.gameCode}`,
        date: g.utcDate ?? g.date,
        opponent: fixTr(them?.club?.abbreviatedName ?? them?.club?.name ?? ''),
        opponentLogo: them?.club?.images?.crest,
        home,
        result: won ? 'W' : 'L',
        score: `${num(us?.score)}-${num(them?.score)}`,
        line,
      } satisfies GameLogRow;
    })
    .reverse();

  return { bio, season: label(season), averages: current?.avg, gameLog, career };
}

// ---------- leaders / schedule / search ----------

const LEADER_KEYS: Record<string, LeaderKey> = { points: 'pts', rebounds: 'reb', assists: 'ast', steals: 'stl', blocks: 'blk', pir: 'eff' };

async function leaders(league: LeagueDef): Promise<LeaderCategory[]> {
  const season = seasonCode(league);
  const j = await getJsonOrNull('el', `/v3/competitions/${league.elCode}/statistics/players/leaders`, {
    seasonMode: 'Single', seasonCode: season, statisticMode: 'perGame', limit: 10,
  });
  const out: LeaderCategory[] = [];
  for (const [k, key] of Object.entries(LEADER_KEYS)) {
    const list: any[] = j?.[k] ?? [];
    if (!list.length) continue;
    out.push({
      key,
      entries: list.slice(0, 10).map((x) => ({
        playerId: String(x.details?.code),
        name: personName(x.details?.name),
        photo: x.details?.imageUrl,
        team: x.details?.team ? { id: x.details.team.code, name: fixTr(x.details.team.name), logo: x.details.team.imageUrl, abbr: x.details.team.tvCodes } : undefined,
        value: num(x.average ?? x.value),
        gp: numOrNull(x.gamesPlayed) ?? undefined,
      })),
    });
  }
  return out;
}

async function schedule(league: LeagueDef, round?: string): Promise<LeagueSchedule> {
  const season = seasonCode(league);
  const list = await rounds(league, season);
  const cur = (await currentRound(league, season)) ?? list[0];
  const now = Date.now();
  const upcoming = list.find((r) => new Date(r.maxGameStartDate).getTime() >= now);
  const pick = round ? list.find((r) => `${r.phaseTypeCode}-${r.round}` === round) : upcoming ?? cur;
  const id = (r: Round) => `${r.phaseTypeCode}-${r.round}`;
  return {
    kind: 'round',
    rounds: list.map((r) => ({ id: id(r), label: r.phaseTypeCode === 'RS' ? String(r.round) : r.name, current: pick ? id(r) === id(pick) && !round : false })),
    round: pick ? id(pick) : '',
    games: pick ? sortGames(await withLive(await roundGames(league, season, pick))) : [],
  };
}

async function searchPlayers(league: LeagueDef, q: string): Promise<PlayerHit[]> {
  const j = await getJsonOrNull('el', `/v2/competitions/${league.elCode}/seasons/${seasonCode(league)}/people`, { search: q });
  return (j?.data ?? [])
    .filter((x: any) => x.type === 'J')
    .slice(0, 20)
    .map((x: any) => ({
      id: String(x.person?.code),
      name: personName(x.person?.name),
      leagueId: league.id,
      team: x.club ? fixTr(x.club.abbreviatedName ?? x.club.name) : undefined,
      photo: x.images?.headshot,
      number: x.dorsal || undefined,
    }));
}

export const euroleagueProvider: Provider = { gamesByDate, game, standings, teams, team, player, leaders, schedule, searchPlayers };
