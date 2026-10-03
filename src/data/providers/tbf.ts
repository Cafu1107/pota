// Turkish leagues: TBF web API (schedule, standings, teams, players, finished games)
// + FIBA LiveStats (real-time clock, box score, play-by-play and shots).
import { getJson, getJsonOrNull, proxyUrl } from '../http';
import { flsLite, type FlsLite } from '../../../server/fls-lite.mjs';
import type {
  GameHistory,
  CareerRow, Game, GameDetail, GameLeader, GameLogRow, GameStatus, LeaderCategory, LeaderKey, LeagueDef, LeagueSchedule,
  Play, PlayKind, PlayerAverages, PlayerDetail, PlayerHit, PlayerLine, Provider, RosterPlayer, Shot, Side, StandingGroup,
  StandingRow, StatLine, TeamBox, TeamCompareRow, TeamDetail, TeamRef,
} from '../types';
import { compareFromTotals, hexColor, madeAtt, num, numOrNull, parseMinutes, personName, pushCompare, sortGames, sumLines, teamName } from '../normalize';
import { addDays, ageFrom, istanbulToIso, localDayOf } from '../../lib/time';
import { buildHistory, seasonLabel } from '../../lib/history';

interface TbfLeague {
  activityId: number;
  seasonId: number;
  season: string;
}

let featuredPromise: Promise<Map<string, TbfLeague>> | null = null;

function featured(): Promise<Map<string, TbfLeague>> {
  if (!featuredPromise) {
    featuredPromise = getJson('tbf', '/api/League/get-featured-9-leagues')
      .then((j) => {
        const m = new Map<string, TbfLeague>();
        for (const l of j?.data ?? []) m.set(String(l.prefixUrl), { activityId: num(l.activityId), seasonId: num(l.seasonId), season: l.season });
        return m;
      })
      .catch((err) => {
        featuredPromise = null;
        throw err;
      });
  }
  return featuredPromise;
}

async function info(league: LeagueDef): Promise<TbfLeague> {
  const m = await featured();
  const i = m.get(league.tbfPrefix ?? '');
  if (!i) throw new Error(`TBF league ${league.tbfPrefix} not found`);
  return i;
}

// One daily fetch covers all nine TBF leagues; share it between league queries.
const dailyCache = new Map<string, { at: number; p: Promise<any[]> }>();
function daily(date: string): Promise<any[]> {
  const hit = dailyCache.get(date);
  if (hit && Date.now() - hit.at < 10_000) return hit.p;
  const p = getJson('tbf', '/api/Match/get-daily-matches', { MatchDate: date }).then((j) =>
    (j?.data ?? []).flatMap((g: any) => g.matches ?? []),
  );
  p.catch(() => dailyCache.delete(date));
  dailyCache.set(date, { at: Date.now(), p });
  return p;
}

const fixTeam = (s: string | undefined) => teamName(s ?? '').replace(/\bTechnıc\b/g, 'Technic');

function statusFromId(id: number): GameStatus {
  return id === 1 ? 'final' : id === 3 ? 'cancelled' : 'scheduled';
}

function weekCode(week: unknown): string | undefined {
  const m = /(\d+)/.exec(String(week ?? ''));
  return m ? `W${m[1]}` : week ? String(week) : undefined;
}

function gameFromMatch(league: LeagueDef, m: any): Game {
  const status = statusFromId(num(m.matchStatusId ?? m.durumId));
  const home = m.homeTeam ?? { id: m.takimAId, name: m.takimA, logoUrl: m.takimALogo, score: m.skorA };
  const away = m.awayTeam ?? { id: m.takimBId, name: m.takimB, logoUrl: m.takimBLogo, score: m.skorB };
  const hs = numOrNull(home.score);
  const as = numOrNull(away.score);
  const final = status === 'final' && hs !== null && as !== null;
  return {
    id: String(m.matchId),
    leagueId: league.id,
    start: istanbulToIso(m.matchDate ?? m.tarih),
    timeTbd: num(m.matchStatusId ?? m.durumId) === 19,
    status,
    period: final ? (m.hasUzatma ? 5 : 4) : undefined,
    home: { team: { id: String(home.id), name: fixTeam(home.name), logo: home.logoUrl || undefined }, score: final ? hs : null, periods: [], winner: final ? hs! > as! : undefined },
    away: { team: { id: String(away.id), name: fixTeam(away.name), logo: away.logoUrl || undefined }, score: final ? as : null, periods: [], winner: final ? as! > hs! : undefined },
    venue: m.venueName ?? m.salonAdi ?? m.salon,
    city: m.il || m.sehir ? teamName(m.il ?? m.sehir, 'tr') : undefined,
    round: weekCode(m.week ?? m.formattedWeek),
    broadcast: m.broadcastChannel ?? m.matchChannelBroadcast ?? undefined,
    ref: { geniusId: m.genuisId || undefined },
  };
}

// ---------- FIBA LiveStats ----------

async function fls(geniusId: string | number | undefined): Promise<any | null> {
  if (!geniusId) return null;
  try {
    const j = await getJson('fls', `/data/${geniusId}/data.json`);
    return j?.tm ? j : null;
  } catch {
    return null;
  }
}

const norm = (s: string | undefined) => (s ?? '').toLocaleUpperCase('tr-TR').replace(/[^A-ZÇĞİÖŞÜ0-9]/g, '');

/** FLS team numbers → our sides. Team "1" is normally home; confirm by name. */
function flsSides(names: { 1: string; 2: string }, homeName: string): { home: '1' | '2'; away: '1' | '2' } {
  const h = norm(homeName);
  const n1 = norm(names[1]);
  const n2 = norm(names[2]);
  if (h && n2 && (n2 === h || h.startsWith(n2) || n2.startsWith(h)) && n1 !== h) return { home: '2', away: '1' };
  return { home: '1', away: '2' };
}

/** Live state (from the compact /fls-lite feed or derived from a full data.json) applied to a game. */
function applyLite(g: Game, l: FlsLite | null): Game {
  if (!l || !l.started) return g;
  let period = l.period || 1;
  if (l.periodType === 'OVERTIME' && period <= l.periodsMax) period += l.periodsMax;
  const sides = flsSides({ 1: l.tm[1].name, 2: l.tm[2].name }, g.home.team.name);
  const h = l.tm[sides.home];
  const a = l.tm[sides.away];
  if (l.ended) {
    return {
      ...g,
      status: 'final',
      period,
      clock: undefined,
      isBreak: false,
      isHalftime: false,
      home: { ...g.home, score: h.score, periods: h.periods, winner: h.score > a.score },
      away: { ...g.away, score: a.score, periods: a.periods, winner: a.score > h.score },
    };
  }
  return {
    ...g,
    status: 'live',
    period,
    clock: l.clock.replace(/^0(d:)/, '$1'),
    isBreak: l.isBreak,
    isHalftime: l.isBreak && period === 2,
    home: { ...g.home, score: h.score, periods: h.periods, winner: undefined },
    away: { ...g.away, score: a.score, periods: a.periods, winner: undefined },
  };
}

async function liveState(geniusId: string | number | undefined): Promise<FlsLite | null> {
  if (!geniusId) return null;
  try {
    return await getJson<FlsLite>('fls-lite', `/${geniusId}`);
  } catch {
    return null;
  }
}

async function withLive(games: Game[]): Promise<Game[]> {
  const now = Date.now();
  return Promise.all(
    games.map(async (g) => {
      const t = new Date(g.start).getTime();
      if (g.status !== 'scheduled' || !g.ref?.geniusId || t > now + 5 * 60_000 || now - t > 5 * 3600_000) return g;
      return applyLite(g, await liveState(g.ref.geniusId));
    }),
  );
}

// ---------- games by date ----------

async function gamesByDate(league: LeagueDef, day: string): Promise<Game[]> {
  const { activityId } = await info(league);
  const tzMatchesTurkey = new Date().getTimezoneOffset() === -180;
  const days = tzMatchesTurkey ? [day] : [addDays(day, -1), day, addDays(day, 1)];
  const all = (await Promise.all(days.map(daily))).flat();
  const games = all
    .filter((m) => num(m.activityId) === activityId || String(m.activityCode).toLowerCase() === league.tbfPrefix)
    .map((m) => gameFromMatch(league, m))
    .filter((g) => localDayOf(g.start) === day);
  return sortGames(await withLive(games));
}

// ---------- game detail ----------

function flsLine(p: any, prefix = ''): StatLine {
  const k = (n: string) => p?.[prefix + n];
  const mins = k('sMinutes');
  return {
    sec: parseMinutes(mins),
    min: mins || undefined,
    pts: num(k('sPoints')),
    reb: num(k('sReboundsTotal')),
    oreb: num(k('sReboundsOffensive')),
    dreb: num(k('sReboundsDefensive')),
    ast: num(k('sAssists')),
    stl: num(k('sSteals')),
    blk: num(k('sBlocks')),
    tov: num(k('sTurnovers')),
    pf: num(k('sFoulsPersonal')),
    fgm: num(k('sFieldGoalsMade')),
    fga: num(k('sFieldGoalsAttempted')),
    tpm: num(k('sThreePointersMade')),
    tpa: num(k('sThreePointersAttempted')),
    ftm: num(k('sFreeThrowsMade')),
    fta: num(k('sFreeThrowsAttempted')),
    pm: numOrNull(k('sPlusMinusPoints')) ?? undefined,
    eff: numOrNull(prefix ? p?.tot_eff_1 : p?.eff_1) ?? undefined,
  };
}

type TbfPlayerRef = { id: string; photo?: string; name: string };

function flsBox(j: any, sides: { home: string; away: string }, refs: Map<string, TbfPlayerRef>): Record<Side, TeamBox> {
  const out = {} as Record<Side, TeamBox>;
  for (const side of ['home', 'away'] as Side[]) {
    const t = j.tm[sides[side]];
    const players: PlayerLine[] = Object.values<any>(t?.pl ?? {}).map((p) => {
      const line = flsLine(p);
      const number = String(p.shirtNumber ?? '');
      const ref = refs.get(`${side}:${number}`);
      const full = [p.firstName, p.familyName].filter(Boolean).join(' ').trim();
      return {
        ...line,
        id: ref?.id ?? '',
        name: ref?.name ?? (full ? personName(full, 'tr') : p.name),
        number,
        position: p.playingPosition || undefined,
        photo: ref?.photo || p.photoT || undefined,
        starter: num(p.starter) === 1,
        onCourt: num(p.active) === 1,
        dnp: !line.sec,
      } satisfies PlayerLine;
    });
    const totals = flsLine(t, 'tot_');
    delete totals.sec; delete totals.min; delete totals.pm;
    out[side] = { players, totals, coach: t?.coach ? personName(t.coach, 'tr') : undefined };
  }
  return out;
}

const FLS_KIND: Record<string, PlayKind> = {
  '2pt': 'two', '3pt': 'three', freethrow: 'ft', rebound: 'rebound', assist: 'assist', steal: 'steal', block: 'block',
  turnover: 'turnover', foul: 'foul', timeout: 'timeout', substitution: 'sub', period: 'period', game: 'period', jumpball: 'jump',
};

function flsPlays(j: any, sides: { home: string; away: string }, refs: Map<string, TbfPlayerRef>): Play[] {
  const swap = sides.home === '2';
  const rows: any[] = [...(j.pbp ?? [])].reverse();
  const out: Play[] = [];
  const max = num(j.periodsMax) || 4;
  for (const p of rows) {
    if (p.actionType === 'foulon') continue;
    const kind = FLS_KIND[p.actionType] ?? 'other';
    const side: Side | undefined = p.tno ? ((String(p.tno) === sides.home) ? 'home' : 'away') : undefined;
    let period = num(p.period) || 1;
    if (p.periodType === 'OVERTIME' && period <= max) period += max;
    const s1 = num(p.s1);
    const s2 = num(p.s2);
    const shot = kind === 'two' || kind === 'three' || kind === 'ft';
    const made = shot ? num(p.success) === 1 : undefined;
    const number = String(p.shirtNumber ?? '');
    const ref = side ? refs.get(`${side}:${number}`) : undefined;
    const full = [p.firstName, p.familyName].filter(Boolean).join(' ').trim();
    out.push({
      id: String(p.actionNumber),
      period,
      clock: String(p.clock ?? p.gt ?? '').slice(0, 5).replace(/^0(\d:)/, '$1'),
      side,
      playerId: ref?.id || undefined,
      player: ref?.name ?? (full ? personName(full, 'tr') : p.player || undefined),
      kind,
      detail: p.actionType === 'game' ? `game-${p.subType}` : p.subType || undefined,
      text: '',
      made,
      points: made ? (kind === 'three' ? 3 : kind === 'two' ? 2 : 1) : undefined,
      homeScore: swap ? s2 : s1,
      awayScore: swap ? s1 : s2,
    });
  }
  return out;
}

/** FLS / TBF shot coordinates are percentages of the full court (x along the length). */
function courtShot(xPct: number, yPct: number) {
  let x = xPct;
  let y = yPct;
  if (x > 50) {
    x = 100 - x;
    y = 100 - y;
  }
  return { y: (x / 100) * 28, x: (y / 100) * 15 - 7.5 };
}

function flsShots(j: any, sides: { home: string; away: string }, refs: Map<string, TbfPlayerRef>): Shot[] {
  const out: Shot[] = [];
  for (const side of ['home', 'away'] as Side[]) {
    for (const s of j.tm[sides[side]]?.shot ?? []) {
      const pos = courtShot(num(s.x), num(s.y));
      const ref = refs.get(`${side}:${s.shirtNumber}`);
      out.push({
        ...pos,
        made: num(s.r) === 1,
        value: s.actionType === '3pt' ? 3 : 2,
        side,
        period: num(s.per) || undefined,
        playerId: ref?.id || undefined,
        player: ref?.name ?? s.player,
      });
    }
  }
  return out;
}

function flsCompare(j: any, sides: { home: string; away: string }, box: Record<Side, TeamBox>): TeamCompareRow[] {
  const rows = compareFromTotals(box.home.totals, box.away.totals);
  const h = j.tm[sides.home];
  const a = j.tm[sides.away];
  pushCompare(rows, 'ptsOffTov', h?.tot_sPointsFromTurnovers, a?.tot_sPointsFromTurnovers);
  pushCompare(rows, 'fastBreak', h?.tot_sPointsFastBreak, a?.tot_sPointsFastBreak);
  pushCompare(rows, 'secondChance', h?.tot_sPointsSecondChance, a?.tot_sPointsSecondChance);
  pushCompare(rows, 'paint', h?.tot_sPointsInThePaint, a?.tot_sPointsInThePaint);
  pushCompare(rows, 'bench', h?.tot_sBenchPoints, a?.tot_sBenchPoints);
  pushCompare(rows, 'biggestLead', h?.tot_sBiggestLead, a?.tot_sBiggestLead);
  pushCompare(rows, 'biggestRun', h?.tot_sBiggestScoringRun, a?.tot_sBiggestScoringRun);
  pushCompare(rows, 'leadChanges', h?.tot_sLeadChanges, a?.tot_sLeadChanges);
  pushCompare(rows, 'timesTied', h?.tot_sTimesScoresLevel, a?.tot_sTimesScoresLevel);
  const tl = (v: unknown) => {
    const m = numOrNull(v);
    return m === null ? undefined : `${Math.floor(m)}:${String(Math.round((m % 1) * 60)).padStart(2, '0')}`;
  };
  pushCompare(rows, 'timeLeading', h?.tot_sTimeLeading, a?.tot_sTimeLeading, { homeText: tl(h?.tot_sTimeLeading), awayText: tl(a?.tot_sTimeLeading) });
  return rows;
}

function tbfLine(p: any): StatLine {
  const sec = parseMinutes(p.minutesPlayed);
  return {
    sec,
    min: p.minutesPlayed || undefined,
    pts: num(p.points),
    reb: num(p.totalRebounds),
    oreb: num(p.offensiveRebounds),
    dreb: num(p.defensiveRebounds),
    ast: num(p.assists),
    stl: num(p.steals),
    blk: num(p.blocks),
    tov: num(p.turnovers),
    pf: num(p.fouls),
    fgm: num(p.successfulShots),
    fga: num(p.shotAttempts),
    tpm: num(p.threePointShots),
    tpa: num(p.threePointShotAttempts),
    ftm: num(p.freeThrows),
    fta: num(p.freeThrowAttempts),
    pm: numOrNull(p.plusMinus) ?? undefined,
    eff: numOrNull(p.efficiency) ?? undefined,
  };
}

function tbfBox(stats: any): Record<Side, TeamBox> | undefined {
  if (!stats) return undefined;
  const make = (starters: any[], bench: any[]): TeamBox => {
    const players: PlayerLine[] = [...(starters ?? []), ...(bench ?? [])].map((p) => {
      const line = tbfLine(p);
      return {
        ...line,
        id: p.playerId ? String(p.playerId) : '',
        name: p.playerName ?? '',
        number: p.jerseyNumber || undefined,
        photo: p.image || undefined,
        starter: p.isStarter === true,
        dnp: !line.sec,
      } satisfies PlayerLine;
    });
    const totals = sumLines(players);
    delete totals.sec;
    return { players, totals };
  };
  const home = make(stats.homeTopFive, stats.homeBenchPlayers);
  const away = make(stats.awayTopFive, stats.awayBenchPlayers);
  if (!home.players.length && !away.players.length) return undefined;
  return { home, away };
}

function tbfPlayKind(action: string): { kind: PlayKind; made?: boolean; points?: number } {
  const a = action.toLocaleLowerCase('tr-TR');
  const made = a.includes('başarılı') ? true : a.includes('başarısız') ? false : undefined;
  if (/^3 sayı/.test(a)) return { kind: 'three', made, points: made ? 3 : undefined };
  if (/^2 sayı/.test(a)) return { kind: 'two', made, points: made ? 2 : undefined };
  if (a.includes('serbest atış')) return { kind: 'ft', made, points: made ? 1 : undefined };
  if (a.includes('ribaund')) return { kind: 'rebound' };
  if (a.includes('asist')) return { kind: 'assist' };
  if (a.includes('top çalma')) return { kind: 'steal' };
  if (a.includes('blok')) return { kind: 'block' };
  if (a.includes('top kaybı')) return { kind: 'turnover' };
  if (a.includes('faul yapılan')) return { kind: 'other' };
  if (a.includes('faul')) return { kind: 'foul' };
  if (a.includes('mola')) return { kind: 'timeout' };
  if (a.includes('değişiklik')) return { kind: 'sub' };
  if (a.includes('çeyrek') || a.includes('maç başladı') || a.includes('maç sonu') || a.includes('uzatma')) return { kind: 'period' };
  if (a.includes('hava atışı') || a.includes('jump ball')) return { kind: 'jump' };
  return { kind: 'other' };
}

function tbfPlays(flow: any): Play[] {
  return (flow?.events ?? [])
    .filter((e: any) => !/faul yapılan/i.test(e.action ?? ''))
    .map((e: any) => {
      const [h, a] = String(e.score ?? '0-0').split('-').map((x) => num(x));
      const k = tbfPlayKind(String(e.action ?? ''));
      const period = num(e.quarterNumber) + (num(e.periodType) === 2 ? 4 : 0);
      return {
        id: String(e.actionNumber),
        period: period || 1,
        clock: String(e.time ?? '').replace(/^0(\d:)/, '$1'),
        side: e.isHome === true ? 'home' : e.isHome === false ? 'away' : undefined,
        playerId: e.playerId ? String(e.playerId) : undefined,
        player: e.playerName || undefined,
        ...k,
        text: e.action ?? '',
        rawText: e.action ?? '',
        homeScore: h,
        awayScore: a,
      } satisfies Play;
    });
}

function tbfShots(chart: any): Shot[] {
  return (chart?.shotInfos ?? []).map((s: any) => {
    const pos = courtShot(num(s.x), num(s.y));
    const dist = Math.hypot(pos.x, pos.y - 1.575);
    return {
      ...pos,
      made: s.isSucceed === true,
      value: dist > 6.6 ? 3 : 2,
      side: s.isHome ? 'home' : 'away',
      period: num(s.period) || undefined,
      player: s.playerName,
    } satisfies Shot;
  });
}

const OZET_KEYS: Record<string, { key: TeamCompareRow['key']; inverse?: boolean; pct?: boolean }> = {
  Sayi: { key: 'pts' },
  Ribaund: { key: 'reb' },
  HucumRibaundu: { key: 'oreb' },
  SavunmaRibaundu: { key: 'dreb' },
  Asist: { key: 'ast' },
  TopCalma: { key: 'stl' },
  Turnovers: { key: 'tov', inverse: true },
  Blok: { key: 'blk' },
  Fouls: { key: 'pf', inverse: true },
  VerimlilikPuanı: { key: 'eff' },
  AtisGirisimiYuzdesi: { key: 'fgPct', pct: true },
  IkiSayiAtisYuzdesi: { key: 'twoPct', pct: true },
  UcSayiAtisYuzdesi: { key: 'tpPct', pct: true },
  SerbestAtisYuzdesi: { key: 'ftPct', pct: true },
  PointsFromTurnover: { key: 'ptsOffTov' },
  HizliHucumSayisi: { key: 'fastBreak' },
  PointsFromSecondChance: { key: 'secondChance' },
  PointsFromPaint: { key: 'paint' },
  PointsFromBench: { key: 'bench' },
  EnBuyukFark: { key: 'biggestLead' },
  BiggestScoringRun: { key: 'biggestRun' },
  LeadChanges: { key: 'leadChanges' },
};

function ozetCompare(ozet: any): TeamCompareRow[] | undefined {
  const list: any[] = ozet?.matchHighlightStatistics ?? [];
  if (!list.length) return undefined;
  const rows: TeamCompareRow[] = [];
  for (const s of list) {
    if (s.leaderCategory === 'TimeLeading') {
      const toMin = (v: string) => {
        const [m, sec] = String(v).split(':').map(Number);
        return (m || 0) + (sec || 0) / 60;
      };
      rows.push({ key: 'timeLeading', home: toMin(s.homeValue), away: toMin(s.awayValue), homeText: s.homeValue, awayText: s.awayValue });
      continue;
    }
    const def = OZET_KEYS[s.leaderCategory];
    if (!def || def.key === 'pts') continue;
    pushCompare(rows, def.key, s.homeValue, s.awayValue, { inverse: def.inverse, pct: def.pct });
  }
  return rows.length ? rows : undefined;
}

async function game(league: LeagueDef, id: string): Promise<GameDetail> {
  const q = { matchId: id };
  const [hdr, ozet, stats] = await Promise.all([
    getJson('tbf', '/api/Match/mac-header', q),
    getJsonOrNull('tbf', '/api/Match/mac-ozet', q),
    getJsonOrNull('tbf', '/api/Match/mac-istatistik', q),
  ]);
  const h = hdr?.data ?? {};
  const o = ozet?.data;
  const status = statusFromId(num(h.matchStatusId));
  const hs = numOrNull(h.homeTeamScore);
  const as = numOrNull(h.awayTeamScore);
  const quarters = (rows: any[]) =>
    [...(rows ?? [])].sort((x, y) => num(x.periodType) * 10 + num(x.quarter) - (num(y.periodType) * 10 + num(y.quarter))).map((r) => num(r.score));
  const final = status === 'final';
  const team = (t: any, pid: unknown): TeamRef => ({
    id: String(pid ?? t?.teamId ?? ''),
    name: fixTeam(t?.teamName),
    logo: t?.logo || undefined,
    color: hexColor(t?.hexCode1),
    color2: hexColor(t?.hexCode2),
  });
  let g: Game = {
    id,
    leagueId: league.id,
    start: istanbulToIso(h.matchDateTime),
    status,
    timeTbd: num(h.matchStatusId) === 19,
    period: final ? (h.hasUzatma ? 5 : 4) : undefined,
    home: { team: team(h.homeTeam, h.homeTeamProcessId), score: final ? hs : null, periods: final ? quarters(o?.homeTeamScore) : [], winner: final && hs !== null && as !== null ? hs > as : undefined },
    away: { team: team(h.awayTeam, h.awayTeamProcessId), score: final ? as : null, periods: final ? quarters(o?.awayTeamScore) : [], winner: final && hs !== null && as !== null ? as > hs : undefined },
    venue: h.location || undefined,
    broadcast: h.matchBroadcastChannel || undefined,
    ref: { geniusId: h.genuisId || undefined },
  };

  // TBF ids and photos for players, keyed by side + shirt number (FLS has its own ids).
  const tbfBoxes = tbfBox(stats?.data);
  const refs = new Map<string, TbfPlayerRef>();
  if (tbfBoxes) {
    for (const side of ['home', 'away'] as Side[]) {
      for (const p of tbfBoxes[side].players) if (p.number) refs.set(`${side}:${p.number}`, { id: p.id, photo: p.photo, name: p.name });
    }
  }
  for (const p of h.players ?? []) {
    const key = `${p.isHome ? 'home' : 'away'}:${p.jerseyNumber}`;
    if (!refs.has(key)) refs.set(key, { id: p.playerId ? String(p.playerId) : '', photo: p.image || undefined, name: p.playerName });
  }

  const live = await fls(g.ref?.geniusId);
  let box: Record<Side, TeamBox> | undefined;
  let plays: Play[] = [];
  let shots: Shot[] = [];
  let compare: TeamCompareRow[] | undefined;
  let playsLang: GameDetail['playsLang'];

  if (live && (live.pbp?.length ?? 0) > 0) {
    g = applyLite(g, flsLite(live));
    const sides = flsSides({ 1: live.tm?.['1']?.name ?? '', 2: live.tm?.['2']?.name ?? '' }, g.home.team.name);
    box = flsBox(live, sides, refs);
    plays = flsPlays(live, sides, refs);
    shots = flsShots(live, sides, refs);
    compare = flsCompare(live, sides, box);
  } else {
    const [flow, chart] = await Promise.all([
      getJsonOrNull('tbf', '/api/Match/game-flow', q),
      getJsonOrNull('tbf', '/api/Match/shot-chart', q),
    ]);
    box = tbfBoxes;
    plays = tbfPlays(flow?.data);
    playsLang = 'tr';
    shots = tbfShots(chart?.data);
    compare = ozetCompare(o) ?? (box ? compareFromTotals(box.home.totals, box.away.totals) : undefined);
  }
  if (box && box.home.totals.fga + box.away.totals.fga === 0) compare = undefined;

  const leaders: GameLeader[] = [];
  if (box) {
    for (const side of ['home', 'away'] as Side[]) {
      for (const key of ['pts', 'reb', 'ast', 'eff'] as const) {
        const best = [...box[side].players].sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0))[0];
        if (best && (best[key] ?? 0) > 0) leaders.push({ key, side, playerId: best.id || undefined, name: best.name, photo: best.photo, value: best[key] ?? 0 });
      }
    }
  }
  const officials = [h.mainReferee, h.firstAssistantReferee, h.secondAssistantReferee].filter(Boolean).map((x: string) => personName(x, 'tr'));
  const missing: GameDetail['missing'] = [];
  if (!box) missing.push('box');
  if (!plays.length) missing.push('plays');
  if (!shots.length) missing.push('shots');
  return {
    game: g,
    box,
    compare,
    plays,
    shots,
    leaders,
    officials: officials.length ? officials : undefined,
    attendance: numOrNull(h.matchSpectatorCount) || numOrNull(live?.attendance) || undefined,
    coaches: {
      home: box?.home.coach ?? (h.homeTeam?.coachName ? personName(h.homeTeam.coachName, 'tr') : undefined),
      away: box?.away.coach ?? (h.awayTeam?.coachName ? personName(h.awayTeam.coachName, 'tr') : undefined),
    },
    playsLang,
    missing,
    updatedAt: Date.now(),
  };
}

// ---------- standings / teams ----------

async function standings(league: LeagueDef): Promise<StandingGroup[]> {
  const i = await info(league);
  const j = await getJson('tbf', '/api/League/get-standings-table', { leagueId: i.activityId, seasonId: i.seasonId });
  return (j?.data ?? [])
    .map((grp: any) => {
      const rows: StandingRow[] = (grp.standings ?? []).map((r: any) => {
        const gp = num(r.o);
        const w = num(r.g);
        return {
          rank: num(r.sira),
          team: { id: String(r.takimIslemId), name: fixTeam(r.takimAdi), logo: r.teamLogo || undefined },
          gp, w, l: num(r.m),
          pct: gp ? w / gp : undefined,
          pf: num(r.a), pa: num(r.y), diff: num(r.a) - num(r.y),
          pts: numOrNull(r.puan) ?? undefined,
        } satisfies StandingRow;
      });
      rows.sort((a, b) => a.rank - b.rank);
      if (league.id === 'bsl' && rows.length >= 12) {
        for (const r of rows) r.zone = r.rank <= 8 ? 'playoff' : r.rank > rows.length - 2 ? 'down' : undefined;
      }
      return { name: grp.grup || undefined, rows };
    })
    .filter((g: StandingGroup) => g.rows.length);
}

async function teams(league: LeagueDef): Promise<TeamRef[]> {
  const i = await info(league);
  const j = await getJson('tbf', '/api/Team/get-teams-by-leauge', { leaugeId: i.activityId });
  return (j?.data ?? [])
    .map((t: any) => ({
      id: String(t.teamProcessId),
      name: fixTeam(t.teamName),
      abbr: t.teamCode || undefined,
      logo: t.teamLogoUrl || undefined,
      color: hexColor(t.hexRenkKodu1),
      color2: hexColor(t.hexRenkKodu2),
    }))
    .sort((a: TeamRef, b: TeamRef) => a.name.localeCompare(b.name, 'tr'));
}

/** The TBF only serves the current season's schedule per team, so meetings cover this season. */
async function history(league: LeagueDef, g: Game): Promise<GameHistory> {
  const i = await info(league);
  const list = async (id: string) => {
    const j = await getJsonOrNull('tbf', '/api/Team/get-team-detail-matches-by-season-and-league', {
      LeagueId: i.activityId,
      SeasonId: i.seasonId,
      TeamProcessId: id,
      prefix: league.tbfPrefix,
    }).catch(() => null);
    return ((j?.data?.maclar ?? []) as any[]).map((m) => gameFromMatch(league, m));
  };
  const [h, a] = await Promise.all([list(g.home.team.id), list(g.away.team.id)]);
  return buildHistory(g, h, a, [seasonLabel(i.season)]);
}

async function team(league: LeagueDef, id: string): Promise<TeamDetail> {
  const i = await info(league);
  const p = { LeagueId: i.activityId, SeasonId: i.seasonId, TeamProcessId: id, prefix: league.tbfPrefix };
  const [main, players, matches, staff, stats, table] = await Promise.all([
    getJson('tbf', '/api/Team/get-team-detail-main', p),
    getJsonOrNull('tbf', '/api/Team/get-team-active-player-list-by-season-and-league', p),
    getJsonOrNull('tbf', '/api/Team/get-team-detail-matches-by-season-and-league', p),
    getJsonOrNull('tbf', '/api/Team/get-team-detail-team-staff-by-season-and-league', p),
    getJsonOrNull('tbf', '/api/Team/get-team-detail-statistic', p),
    standings(league).catch(() => [] as StandingGroup[]),
  ]);
  const d = main?.data?.teamDetailInfo ?? {};
  const ts = main?.data?.teamStatistic;
  const avgByCode = new Map<string, any>();
  for (const a of stats?.data?.playersAverage ?? []) avgByCode.set(String(a.code), a);
  const roster: RosterPlayer[] = (players?.data ?? []).map((x: any) => {
    const avg = avgByCode.get(String(x.personId));
    return {
      id: String(x.personId),
      name: personName(`${x.firstName ?? ''} ${x.lastName ?? ''}`.trim(), 'tr'),
      number: x.jerseyNo ?? avg?.oyuncuNo ?? undefined,
      photo: x.playerPhoto || undefined,
      height: numOrNull(x.height) ?? undefined,
      birthDate: x.birthDay ?? undefined,
      age: numOrNull(x.age) ?? ageFrom(x.birthDay),
      nationality: x.country ? teamName(x.country, 'tr') : undefined,
      gp: avg ? num(avg.macSayisi) : numOrNull(x.macSayisi) ?? undefined,
      ppg: avg ? num(avg.sayiOrtalama) : undefined,
      rpg: avg ? num(avg.trOrtalama) : undefined,
      apg: avg ? num(avg.asistOrtalama) : undefined,
    } satisfies RosterPlayer;
  });
  roster.sort((a, b) => num(a.number, 999) - num(b.number, 999));
  const coach = (staff?.data ?? []).find((s: any) => /^(baş\s*)?antrenör$/i.test(String(s.job ?? '').trim()));
  const row = table.flatMap((g) => g.rows.map((r) => ({ r, group: g.name }))).find((x) => x.r.team.id === id);
  const gamesList = (matches?.data?.maclar ?? []).map((m: any) => gameFromMatch(league, m));
  const st: TeamDetail['stats'] = ts
    ? [
        { key: 'pts', value: num(ts.sayiOrtalama) },
        { key: 'reb', value: num(ts.drOrtalama) + num(ts.hrOrtalama) },
        { key: 'ast', value: num(ts.asistOrtalama) },
        { key: 'stl', value: num(ts.topCalmaOrtalama) },
        { key: 'blk', value: num(ts.blokOrtalama) },
        { key: 'tov', value: num(ts.topKaybiOrtalama) },
        { key: 'fgPct', value: num(ts.sayi2_Basarili) },
        { key: 'tpPct', value: num(ts.sayi3_Basarili) },
        { key: 'ftPct', value: num(ts.sA0_1_Basarili) },
        { key: 'eff', value: num(ts.verimlilikOrtalama) },
      ]
    : undefined;
  return {
    team: {
      id,
      name: fixTeam(d.takimAdi ?? d.tuzelKisiGorunenAd),
      logo: d.orjinalResim || undefined,
      color: hexColor(d.hexCode1),
      color2: hexColor(d.hexCode2),
    },
    leagueId: league.id,
    city: d.il ? teamName(d.il, 'tr') : undefined,
    venue: d.salonAdi || undefined,
    capacity: numOrNull(d.kapasite) ?? undefined,
    founded: d.kurulusTarihi ? String(d.kurulusTarihi).slice(0, 4) : undefined,
    coach: coach ? personName(`${coach.firstName} ${coach.lastName}`, 'tr') : undefined,
    record: ts ? { w: num(ts.kazanmaToplam), l: num(ts.kaybetmeToplam) } : undefined,
    standing: row ? { rank: row.r.rank, group: row.group } : undefined,
    roster,
    staff: (staff?.data ?? []).map((s: any) => ({ name: personName(`${s.firstName} ${s.lastName}`, 'tr'), role: s.job, photo: s.resim || undefined })),
    games: sortGames(await withLive(gamesList)),
    stats: st,
  };
}

// ---------- players ----------

function careerAvg(r: any): PlayerAverages {
  const gp = num(r.matchCount) || 1;
  const [two, twoA] = [num(r.fieldGoalsMade), num(r.fieldGoalsAttempted)];
  const [three, threeA] = [num(r.threePointsMade), num(r.threePointsAttempted)];
  const [ft, ftA] = [num(r.freeThowsMade), num(r.freeThowsAttempted)];
  const sec = parseMinutes(r.formattedTotalSeconds) ?? num(r.totalSeconds);
  return {
    gp,
    min: sec ? sec / 60 / gp : undefined,
    pts: num(r.totalPoints) / gp,
    reb: num(r.rebounds) / gp,
    oreb: num(r.offensiveRebounds) / gp,
    dreb: num(r.defensiveRebounds) / gp,
    ast: num(r.assists) / gp,
    stl: num(r.steals) / gp,
    blk: num(r.blocks) / gp,
    tov: num(r.tournovers) / gp,
    pf: num(r.fauls) / gp,
    eff: num(r.playerEfficiency) / gp,
    fgPct: twoA + threeA ? ((two + three) / (twoA + threeA)) * 100 : undefined,
    tpPct: threeA ? (three / threeA) * 100 : undefined,
    ftPct: ftA ? (ft / ftA) * 100 : undefined,
    fgm: (two + three) / gp,
    fga: (twoA + threeA) / gp,
    tpm: three / gp,
    tpa: threeA / gp,
    ftm: ft / gp,
    fta: ftA / gp,
  };
}

async function player(league: LeagueDef, id: string): Promise<PlayerDetail> {
  const i = await info(league);
  const [prof, logRes] = await Promise.all([
    getJson('tbf', `/api/Player/get-player-detail-profile-and-career-info/${id}`),
    fetch(proxyUrl('tbf', `/api/Player/get-player-detail-match-statistic/${i.seasonId}/${id}`), {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: '{}',
    })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
  ]);
  const p = prof?.data?.playerProfile ?? {};
  const log = logRes?.data;
  const sum = log?.playerStatisticsSummary;
  let averages: PlayerAverages | undefined;
  if (sum && num(sum.gameCount) > 0) {
    const fgm = num(sum.twoPtsMadeSum) + num(sum.threePtsMadeSum);
    const fga = num(sum.twoPtsAttemptedSum) + num(sum.threePtsAttemptedSum);
    averages = {
      gp: num(sum.gameCount),
      min: num(sum.averageSeconds) / 60,
      pts: num(sum.pointsAverage),
      reb: num(sum.totalReboundsAverage),
      oreb: num(sum.offensiveReboundsAverage),
      dreb: num(sum.defensiveReboundsAverage),
      ast: num(sum.assistsAverage),
      stl: num(sum.stealsAverage),
      blk: num(sum.blocksAverage),
      tov: num(sum.turnoversAverage),
      pf: num(sum.foulsAverage),
      eff: num(sum.efficiencyAverage),
      fgPct: fga ? (fgm / fga) * 100 : undefined,
      tpPct: numOrNull(sum.threePtsPercentage) ?? undefined,
      ftPct: numOrNull(sum.freeThrowsPercentage) ?? undefined,
      fgm: fgm / num(sum.gameCount),
      fga: fga / num(sum.gameCount),
      tpm: num(sum.threePtsMadeAverage),
      tpa: num(sum.threePtsAttemptedAverage),
      ftm: num(sum.freeThrowsMadeAverage),
      fta: num(sum.freeThrowsAttemptedAverage),
    };
  }
  const gameLog: GameLogRow[] = (log?.playerMatchStatistics ?? []).map((m: any) => {
    const [ftm, fta] = madeAtt(m.freeThrows);
    const [twm, twa] = madeAtt(m.twoPointers);
    const [tpm, tpa] = madeAtt(m.threePointers);
    const [dd, mm, yy] = String(m.date ?? '').split('-');
    return {
      gameId: m.matchId ? String(m.matchId) : undefined,
      date: yy ? `${yy}-${mm}-${dd}T12:00:00Z` : m.date,
      opponent: fixTeam(m.opponent),
      line: {
        sec: parseMinutes(m.duration), min: m.duration,
        pts: num(m.points), reb: num(m.totalRebounds), oreb: num(m.offRebounds), dreb: num(m.defRebounds),
        ast: num(m.assists), stl: num(m.steals), blk: num(m.blocks), tov: num(m.turnovers), pf: num(m.fouls),
        fgm: twm + tpm, fga: twa + tpa, tpm, tpa, ftm, fta, eff: numOrNull(m.efficiency) ?? undefined,
      },
    } satisfies GameLogRow;
  });
  gameLog.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const career: CareerRow[] = (prof?.data?.careerInfo ?? [])
    .filter((r: any) => num(r.matchCount) > 0)
    .map((r: any) => ({ season: r.seasonCode, team: fixTeam(r.teamName), league: r.activityName, avg: careerAvg(r) }));
  return {
    bio: {
      id,
      name: p.fullName ?? '',
      number: p.formaNo || undefined,
      photo: p.playerPic || undefined,
      team: p.teamName ? { id: '', name: fixTeam(p.teamName), logo: p.teamLogo || undefined } : undefined,
      height: numOrNull(p.height) ?? undefined,
      weight: numOrNull(p.weight) ?? undefined,
      birthDate: p.birthDate ?? undefined,
      age: numOrNull(p.age) ?? ageFrom(p.birthDate),
      nationality: p.country ? teamName(p.country, 'tr') : undefined,
    },
    season: i.season,
    averages,
    gameLog,
    career,
  };
}

// ---------- leaders / schedule / search ----------

const LEADER_ENDPOINTS: Array<[LeaderKey, string]> = [
  ['pts', 'get-point-leaders'],
  ['reb', 'get-ribound-leaders'],
  ['ast', 'get-asist-leaders'],
  ['stl', 'get-top-calma-leaders'],
  ['blk', 'get-blok-leaders'],
  ['eff', 'get-mvp-leaders'],
];

async function leaders(league: LeagueDef): Promise<LeaderCategory[]> {
  const i = await info(league);
  const lists = await Promise.all(
    LEADER_ENDPOINTS.map(([, path]) => getJsonOrNull('tbf', `/api/Player/${path}`, { seasonId: i.seasonId, leagueId: i.activityId }).catch(() => null)),
  );
  const out: LeaderCategory[] = [];
  LEADER_ENDPOINTS.forEach(([key], idx) => {
    const rows: any[] = lists[idx]?.data?.avg ?? [];
    if (!rows.length) return;
    out.push({
      key,
      entries: rows.slice(0, 10).map((x) => ({
        playerId: String(x.oyuncuKodu),
        name: x.oyuncuAdi,
        photo: x.fotograf || undefined,
        team: { id: String(x.takimKodu ?? ''), name: fixTeam(x.takimAdi), logo: x.takimIslemLogo || x.tuzelLogo || x.orjinalResim || undefined },
        value: Math.round(num(x.grup) * 10) / 10,
        gp: numOrNull(x.macSayisi) ?? undefined,
      })),
    });
  });
  return out;
}

async function schedule(league: LeagueDef, round?: string): Promise<LeagueSchedule> {
  const i = await info(league);
  const w = await getJsonOrNull('tbf', '/api/League/get-league-weeks', { leagueId: i.activityId, seasonId: i.seasonId });
  const weeks: any[] = w?.data ?? [];
  const rounds = weeks.map((x) => ({
    id: String(x.sezon_Hafta),
    label: /^\d+$/.test(String(x.sezon_Hafta)) ? String(x.sezon_Hafta) : x.display_Text ?? String(x.sezon_Hafta),
    current: x.isCurrentWeek === true,
  }));
  const pick = round ?? rounds.find((r) => r.current)?.id ?? rounds[0]?.id ?? '';
  const j = pick
    ? await getJsonOrNull('tbf', '/api/Match/get-all-matches-for-filter', { ActivityId: i.activityId, WeekFilter: pick, Page: 1, PageSize: -1 })
    : null;
  const games = (j?.data ?? []).map((m: any) => gameFromMatch(league, m));
  return { kind: 'week', rounds, round: pick, games: sortGames(await withLive(games)) };
}

async function searchPlayers(league: LeagueDef, q: string): Promise<PlayerHit[]> {
  const i = await info(league);
  const j = await getJsonOrNull('tbf', '/api/Player/get-player-list', {
    seasonId: i.seasonId, leagueId: i.activityId, page: 1, pageSize: 15, searchPlayerName: q,
  });
  return (j?.data ?? []).map((x: any) => ({
    id: String(x.kisiID),
    name: x.adiSoyadi,
    leagueId: league.id,
    team: fixTeam(x.takimAdi),
    photo: x.fotograf || undefined,
    number: x.formaNo || undefined,
  }));
}

export const tbfProvider: Provider = { gamesByDate, game, history, standings, teams, team, player, leaders, schedule, searchPlayers };
