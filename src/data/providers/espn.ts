// ESPN public API: NBA, WNBA, G League, NCAA, NBL, FIBA.
import { getJson, getJsonOrNull } from '../http';
import type {
  GameHistory,
  CareerRow, Game, GameDetail, GameLeader, GameLogRow, LeaderCategory, LeaderKey, LeagueDef, LeagueSchedule,
  Play, PlayKind, PlayerAverages, PlayerDetail, PlayerHit, PlayerLine, Provider, RosterPlayer, Shot, Side,
  StandingGroup, StandingRow, StatLine, TeamBox, TeamDetail, TeamRef,
} from '../types';
import {
  compareFromTotals, emptyLine, feetInchesToCm, hexColor, lbsToKg, madeAtt, num, numOrNull, parseMinutes,
  pushCompare, sortGames,
} from '../normalize';
import { addDays, localDayOf, todayKey, zoneDatesForLocalDay } from '../../lib/time';
import { buildHistory, seasonLabel } from '../../lib/history';

const FT = 0.3048;

const site = <T = any>(l: LeagueDef, path: string, params?: Record<string, string | number | undefined>) =>
  getJson<T>('espn', `/apis/site/v2/sports/basketball/${l.espnSlug}${path}`, params);

/** Smaller ESPN images through their resizing service. */
export function espnImage(href: string | undefined, w: number, h = w): string | undefined {
  if (!href) return undefined;
  const m = /^https?:\/\/a\.espncdn\.com(\/i\/[^?]+)/.exec(href);
  return m ? `https://a.espncdn.com/combiner/i?img=${m[1]}&w=${w}&h=${h}&scale=crop&cquality=80` : href;
}

function teamRef(t: any): TeamRef {
  const logo = t?.logo ?? t?.logos?.[0]?.href;
  return {
    id: String(t?.id ?? ''),
    name: t?.displayName ?? t?.name ?? '',
    short: t?.shortDisplayName ?? t?.name,
    abbr: t?.abbreviation,
    logo: espnImage(logo, 96),
    color: hexColor(t?.color),
    color2: hexColor(t?.alternateColor),
  };
}

function statusOf(st: any): Pick<Game, 'status' | 'period' | 'clock' | 'isBreak' | 'isHalftime'> {
  const name: string = st?.type?.name ?? '';
  const state: string = st?.type?.state ?? 'pre';
  const period = num(st?.period) || undefined;
  if (/POSTPONED|SUSPENDED/.test(name)) return { status: 'postponed' };
  if (/CANCEL/.test(name)) return { status: 'cancelled' };
  if (state === 'in') {
    const isHalftime = name === 'STATUS_HALFTIME';
    const isBreak = isHalftime || name === 'STATUS_END_PERIOD';
    return { status: 'live', period, clock: st?.displayClock, isBreak, isHalftime };
  }
  if (state === 'post') return { status: 'final', period };
  return { status: 'scheduled' };
}

function scoreOf(c: any): number | null {
  if (c?.score === undefined || c?.score === null || c?.score === '') return null;
  if (typeof c.score === 'object') return numOrNull(c.score.value ?? c.score.displayValue);
  return numOrNull(c.score);
}

function gameFrom(league: LeagueDef, ev: any, comp: any): Game {
  const cs: any[] = comp?.competitors ?? [];
  const h = cs.find((c) => c.homeAway === 'home') ?? cs[0];
  const a = cs.find((c) => c.homeAway === 'away') ?? cs[1];
  const st = statusOf(comp?.status ?? ev?.status);
  const side = (c: any) => ({
    team: teamRef(c?.team),
    score: st.status === 'scheduled' || st.status === 'postponed' || st.status === 'cancelled' ? null : scoreOf(c),
    periods: (c?.linescores ?? []).map((x: any) => num(x.value ?? x.displayValue)),
    winner: c?.winner === true ? true : undefined,
    record: c?.records?.find((r: any) => r.type === 'total')?.summary ?? c?.record?.[0]?.summary ?? c?.records?.[0]?.summary,
  });
  return {
    id: String(ev?.id ?? comp?.id),
    leagueId: league.id,
    start: new Date(comp?.date ?? ev?.date).toISOString(),
    timeTbd: comp?.timeValid === false,
    ...st,
    home: side(h),
    away: side(a),
    venue: comp?.venue?.fullName,
    city: comp?.venue?.address?.city,
    round: comp?.notes?.[0]?.headline ?? comp?.series?.summary,
    broadcast: comp?.broadcasts?.flatMap((b: any) => b.names ?? []).join(', ') || undefined,
  };
}

function ncaaParams(l: LeagueDef) {
  return l.espnSlug?.includes('college') ? { groups: 50, limit: 500 } : { limit: 200 };
}

async function gamesByDate(league: LeagueDef, day: string): Promise<Game[]> {
  const dates = zoneDatesForLocalDay(day, 'America/New_York').map((d) => d.replace(/-/g, ''));
  const pages = await Promise.all(dates.map((d) => site(league, '/scoreboard', { dates: d, ...ncaaParams(league) })));
  const seen = new Set<string>();
  const games: Game[] = [];
  for (const page of pages) {
    for (const ev of page?.events ?? []) {
      if (seen.has(ev.id)) continue;
      seen.add(ev.id);
      const g = gameFrom(league, ev, ev.competitions?.[0]);
      if (localDayOf(g.start) === day) games.push(g);
    }
  }
  return sortGames(games);
}

// ---------- game detail ----------

const KEY_INDEX = (keys: string[]) => (k: string) => keys.indexOf(k);

function lineFrom(keys: string[], stats: string[]): StatLine {
  const at = KEY_INDEX(keys);
  const get = (k: string) => (at(k) >= 0 ? stats[at(k)] : undefined);
  const [fgm, fga] = madeAtt(get('fieldGoalsMade-fieldGoalsAttempted'));
  const [tpm, tpa] = madeAtt(get('threePointFieldGoalsMade-threePointFieldGoalsAttempted'));
  const [ftm, fta] = madeAtt(get('freeThrowsMade-freeThrowsAttempted'));
  const minutes = get('minutes');
  const line: StatLine = {
    ...emptyLine(),
    pts: num(get('points')),
    reb: num(get('rebounds') ?? get('totalRebounds')),
    oreb: num(get('offensiveRebounds')),
    dreb: num(get('defensiveRebounds')),
    ast: num(get('assists')),
    stl: num(get('steals')),
    blk: num(get('blocks')),
    tov: num(get('turnovers')),
    pf: num(get('fouls')),
    fgm, fga, tpm, tpa, ftm, fta,
  };
  if (minutes !== undefined && minutes !== '') {
    line.sec = num(minutes) * 60;
    line.min = String(num(minutes));
  }
  const pm = get('plusMinus');
  if (pm !== undefined && pm !== '') line.pm = num(pm);
  return line;
}

function boxFrom(j: any, homeId: string): Record<Side, TeamBox> | undefined {
  const out: Partial<Record<Side, TeamBox>> = {};
  for (const tp of j?.boxscore?.players ?? []) {
    const side: Side = String(tp.team?.id) === homeId ? 'home' : 'away';
    const st = tp.statistics?.[0];
    if (!st) continue;
    const keys: string[] = st.keys ?? st.names ?? [];
    const players: PlayerLine[] = (st.athletes ?? []).map((a: any) => {
      const dnp = a.didNotPlay === true || !a.stats?.length;
      const line = dnp ? emptyLine() : lineFrom(keys, a.stats);
      return {
        ...line,
        id: String(a.athlete?.id),
        name: a.athlete?.displayName ?? '',
        number: a.athlete?.jersey,
        position: a.athlete?.position?.abbreviation,
        photo: espnImage(a.athlete?.headshot?.href, 96, 70),
        starter: a.starter === true,
        dnp,
        onCourt: a.active === true,
      } satisfies PlayerLine;
    });
    const totals = st.totals?.length ? lineFrom(keys, st.totals) : emptyLine();
    delete totals.sec;
    delete totals.min;
    delete totals.pm;
    out[side] = { players, totals };
  }
  return out.home && out.away ? (out as Record<Side, TeamBox>) : undefined;
}

function playKind(p: any): PlayKind {
  const t: string = (p.type?.text ?? '').toLowerCase();
  if (p.shootingPlay) {
    if (t.includes('free throw')) return 'ft';
    return p.pointsAttempted === 3 || /three point/i.test(p.text ?? '') ? 'three' : 'two';
  }
  if (t.includes('rebound')) return 'rebound';
  if (t.includes('turnover') || t === 'bad pass' || t.includes('lost ball') || t.includes('traveling') || t.includes('offensive charge')) return 'turnover';
  if (t.includes('foul') || t.includes('technical')) return 'foul';
  if (t.includes('timeout')) return 'timeout';
  if (t.includes('substitution')) return 'sub';
  if (t.includes('end period') || t.includes('end game') || t.includes('start period')) return 'period';
  if (t.includes('jumpball') || t.includes('jump ball')) return 'jump';
  return 'other';
}

function playDetail(p: any, kind: PlayKind): string | undefined {
  const t: string = (p.type?.text ?? '').toLowerCase();
  if (kind === 'period') return t.includes('end game') ? 'game-end' : t.includes('end') ? 'end' : 'start';
  if (kind === 'rebound') return t.includes('offensive') ? 'offensive' : t.includes('defensive') ? 'defensive' : undefined;
  if (kind === 'foul') return t.includes('offensive') ? 'offensive' : t.includes('technical') ? 'technical' : t.includes('flagrant') ? 'unsportsmanlike' : undefined;
  if (kind === 'two' || kind === 'three') return t.includes('dunk') ? 'dunk' : t.includes('layup') || t.includes('finger roll') ? 'layup' : t.includes('hook') ? 'hookshot' : t.includes('tip') ? 'tipin' : 'jumpshot';
  if (kind === 'timeout') return t.includes('official') || t.includes('tv') ? 'tv' : undefined;
  return undefined;
}

function playsFrom(j: any, homeId: string, names: Map<string, string>): Play[] {
  const out: Play[] = [];
  for (const p of j?.plays ?? []) {
    const kind = playKind(p);
    const pid = p.participants?.[0]?.athlete?.id ? String(p.participants[0].athlete.id) : undefined;
    const teamId = p.team?.id ? String(p.team.id) : undefined;
    out.push({
      id: String(p.id ?? p.sequenceNumber),
      period: num(p.period?.number),
      clock: p.clock?.displayValue ?? '',
      side: teamId ? (teamId === homeId ? 'home' : 'away') : undefined,
      playerId: pid,
      player: pid ? names.get(pid) : undefined,
      kind,
      detail: playDetail(p, kind),
      text: p.text ?? p.type?.text ?? '',
      rawText: p.text,
      made: p.shootingPlay ? p.scoringPlay === true : undefined,
      points: p.scoringPlay ? num(p.scoreValue) : undefined,
      homeScore: numOrNull(p.homeScore) ?? undefined,
      awayScore: numOrNull(p.awayScore) ?? undefined,
    });
  }
  return out;
}

function shotsFrom(j: any, homeId: string, names: Map<string, string>): Shot[] {
  const out: Shot[] = [];
  for (const p of j?.plays ?? []) {
    if (!p.shootingPlay || /free throw/i.test(p.type?.text ?? '')) continue;
    const c = p.coordinate;
    if (!c || c.x < -5 || c.x > 55 || c.y < -10 || c.y > 94) continue;
    const pid = p.participants?.[0]?.athlete?.id ? String(p.participants[0].athlete.id) : undefined;
    out.push({
      x: (c.x - 25) * FT,
      y: Math.min(c.y * FT + 1.6, 14),
      made: p.scoringPlay === true,
      value: p.pointsAttempted === 3 || /three point/i.test(p.text ?? '') ? 3 : 2,
      side: String(p.team?.id) === homeId ? 'home' : 'away',
      period: num(p.period?.number),
      playerId: pid,
      player: pid ? names.get(pid) : undefined,
    });
  }
  return out;
}

const LEADER_KEYS: Record<string, GameLeader['key']> = { points: 'pts', rebounds: 'reb', assists: 'ast' };

async function game(league: LeagueDef, id: string): Promise<GameDetail> {
  const j = await site(league, '/summary', { event: id });
  const hc = j?.header?.competitions?.[0] ?? {};
  const g = gameFrom(league, { id, date: hc.date, status: hc.status }, { ...hc, venue: j?.gameInfo?.venue });
  const homeId = g.home.team.id;
  const box = boxFrom(j, homeId);
  const names = new Map<string, string>();
  if (box) for (const s of ['home', 'away'] as Side[]) for (const p of box[s].players) names.set(p.id, p.name);

  let compare = box ? compareFromTotals(box.home.totals, box.away.totals) : undefined;
  const teamStats = (side: Side) => {
    const t = (j?.boxscore?.teams ?? []).find((x: any) => (String(x.team?.id) === homeId) === (side === 'home'));
    const m = new Map<string, string>();
    for (const s of t?.statistics ?? []) m.set(s.name, s.displayValue);
    return m;
  };
  if (compare) {
    const hs = teamStats('home');
    const as = teamStats('away');
    pushCompare(compare, 'ptsOffTov', hs.get('turnoverPoints'), as.get('turnoverPoints'));
    pushCompare(compare, 'fastBreak', hs.get('fastBreakPoints'), as.get('fastBreakPoints'));
    pushCompare(compare, 'paint', hs.get('pointsInPaint'), as.get('pointsInPaint'));
    pushCompare(compare, 'biggestLead', hs.get('largestLead'), as.get('largestLead'));
    if (hs.get('leadChanges')) pushCompare(compare, 'leadChanges', hs.get('leadChanges'), as.get('leadChanges'));
    if (box && box.home.totals.fga === 0 && box.away.totals.fga === 0) compare = undefined;
  }

  const leaders: GameLeader[] = [];
  for (const block of j?.leaders ?? []) {
    const side: Side = String(block.team?.id) === homeId ? 'home' : 'away';
    for (const cat of block.leaders ?? []) {
      const key = LEADER_KEYS[cat.name];
      const top = cat.leaders?.[0];
      if (!key || !top?.athlete) continue;
      leaders.push({
        key, side,
        playerId: String(top.athlete.id),
        name: top.athlete.displayName,
        photo: espnImage(top.athlete.headshot?.href, 160, 116),
        value: num(top.displayValue ?? top.value),
        line: top.summary ?? top.shortDisplayValue,
      });
    }
  }

  const meetings: Game[] = (j?.seasonseries?.[0]?.events ?? [])
    .filter((e: any) => String(e.id) !== String(id))
    .map((e: any) => gameFrom(league, { id: e.id, date: e.date, status: { type: e.statusType ?? { state: e.status } } }, e));

  const plays = playsFrom(j, homeId, names);
  const shots = shotsFrom(j, homeId, names);
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
    officials: (j?.gameInfo?.officials ?? []).map((o: any) => o.displayName).filter(Boolean),
    attendance: numOrNull(j?.gameInfo?.attendance) ?? undefined,
    meetings: meetings.length ? meetings : undefined,
    playsLang: 'en',
    missing,
    updatedAt: Date.now(),
  };
}

// ---------- standings / teams ----------

async function standings(league: LeagueDef): Promise<StandingGroup[]> {
  const path = `/apis/v2/sports/basketball/${league.espnSlug}/standings`;
  const current = await getJson('espn', path);
  let groups = parseStandings(current);
  // Before a season starts every row is 0-0; show the last completed season instead.
  const year = num(current?.season?.year ?? current?.children?.[0]?.standings?.season);
  if (year && groups.length && groups.every((g) => g.rows.every((r) => r.gp === 0))) {
    const prev = await getJsonOrNull('espn', path, { season: year - 1 });
    const older = prev ? parseStandings(prev) : [];
    if (older.some((g) => g.rows.some((r) => r.gp > 0))) {
      const label = prev?.children?.[0]?.standings?.seasonDisplayName ?? `${year - 2}-${String(year - 1).slice(2)}`;
      groups = older.map((g) => ({ ...g, season: label }));
    }
  }
  // NBA conferences: seeds 1-6 go straight to the playoffs, 7-10 to the play-in.
  if (league.id === 'nba' && groups.length === 2) {
    for (const g of groups) for (const r of g.rows) r.zone = r.rank <= 6 ? 'playoff' : r.rank <= 10 ? 'playin' : undefined;
  }
  return groups;
}

function parseStandings(j: any): StandingGroup[] {
  const groups = j?.children?.length ? j.children : [j];
  return groups
    .map((grp: any) => {
      const rows: StandingRow[] = (grp?.standings?.entries ?? []).map((e: any) => {
        const s = new Map<string, any>();
        for (const x of e.stats ?? []) s.set(x.name ?? x.type, x);
        const v = (k: string) => s.get(k)?.value;
        const d = (k: string) => s.get(k)?.displayValue ?? s.get(k)?.summary;
        return {
          rank: num(v('playoffSeed')),
          team: teamRef(e.team),
          w: num(v('wins')),
          l: num(v('losses')),
          gp: num(v('wins')) + num(v('losses')),
          pct: numOrNull(v('winPercent')) ?? undefined,
          pf: numOrNull(v('pointsFor')) ?? undefined,
          pa: numOrNull(v('pointsAgainst')) ?? undefined,
          diff: numOrNull(v('pointDifferential') ?? v('differential')) ?? undefined,
          gb: d('gamesBehind'),
          streak: d('streak'),
          home: d('Home') ?? d('home'),
          away: d('Road') ?? d('road'),
        } satisfies StandingRow;
      });
      rows.sort((a, b) => (a.rank && b.rank ? a.rank - b.rank : (b.pct ?? 0) - (a.pct ?? 0)));
      rows.forEach((r, i) => (r.rank = r.rank || i + 1));
      return { name: grp?.name, rows };
    })
    .filter((g: StandingGroup) => g.rows.length);
}

async function teams(league: LeagueDef): Promise<TeamRef[]> {
  const j = await site(league, '/teams', { limit: 500 });
  const list = j?.sports?.[0]?.leagues?.[0]?.teams ?? [];
  return list.map((t: any) => teamRef(t.team)).sort((a: TeamRef, b: TeamRef) => a.name.localeCompare(b.name));
}

function rosterPlayer(a: any): RosterPlayer {
  return {
    id: String(a.id),
    name: a.displayName ?? a.fullName,
    number: a.jersey,
    position: a.position?.abbreviation,
    photo: espnImage(a.headshot?.href, 160, 116),
    height: typeof a.height === 'number' ? Math.round(a.height * 2.54) : feetInchesToCm(a.displayHeight),
    weight: lbsToKg(a.weight ?? a.displayWeight),
    birthDate: a.dateOfBirth,
    age: numOrNull(a.age) ?? undefined,
    nationality: a.birthPlace?.country ?? a.citizenship,
  };
}

async function team(league: LeagueDef, id: string): Promise<TeamDetail> {
  const teamPath = `/apis/site/v2/sports/basketball/${league.espnSlug}/teams/${id}`;
  const [info, roster, sched, regular] = await Promise.all([
    site(league, `/teams/${id}`),
    getJsonOrNull('espn', `${teamPath}/roster`),
    getJsonOrNull('espn', `${teamPath}/schedule`),
    getJsonOrNull('espn', `${teamPath}/schedule`, { seasontype: 2 }),
  ]);
  const events = new Map<string, any>();
  for (const ev of [...(sched?.events ?? []), ...(regular?.events ?? [])]) events.set(String(ev.id), ev);
  const t = info?.team ?? {};
  const total = (t.record?.items ?? []).find((r: any) => r.type === 'total') ?? t.record?.items?.[0];
  const [w, l] = madeAtt(total?.summary);
  const athletes: any[] = roster?.athletes ?? [];
  const flat = athletes.flatMap((x: any) => (Array.isArray(x.items) ? x.items : [x]));
  const coach = roster?.coach?.[0];
  const statsMap = new Map<string, number>();
  for (const s of total?.stats ?? []) statsMap.set(s.name, s.value);
  const stats: TeamDetail['stats'] = [];
  if (statsMap.has('avgPointsFor')) stats.push({ key: 'pts', value: statsMap.get('avgPointsFor')! });
  if (statsMap.has('avgPointsAgainst')) stats.push({ key: 'opp', value: statsMap.get('avgPointsAgainst')! });
  return {
    team: teamRef(t),
    leagueId: league.id,
    city: t.location,
    venue: t.franchise?.venue?.fullName,
    coach: coach ? `${coach.firstName ?? ''} ${coach.lastName ?? ''}`.trim() : undefined,
    record: total ? { w, l } : undefined,
    standing: t.standingSummary
      ? { rank: num(/^(\d+)/.exec(t.standingSummary)?.[1]), group: /null/.test(t.standingSummary) ? undefined : t.standingSummary }
      : undefined,
    roster: flat.map(rosterPlayer).sort((a, b) => num(a.number, 999) - num(b.number, 999)),
    games: sortGames([...events.values()].map((ev: any) => gameFrom(league, ev, ev.competitions?.[0]))),
    stats: stats.length ? stats : undefined,
  };
}

// ---------- head to head ----------

/** Both teams' schedules this season, plus the home team's last two seasons (regular season and playoffs). */
async function history(league: LeagueDef, g: Game): Promise<GameHistory> {
  const path = (id: string) => `/apis/site/v2/sports/basketball/${league.espnSlug}/teams/${id}/schedule`;
  const sched = (id: string, params?: Record<string, string | number>) => getJsonOrNull('espn', path(id), params).catch(() => null);
  const games = (...lists: any[]) => lists.flatMap((j) => (j?.events ?? []).map((ev: any) => gameFrom(league, ev, ev.competitions?.[0])));
  const h = g.home.team.id;
  const a = g.away.team.id;
  const [hCur, hReg, aCur, aReg] = await Promise.all([sched(h), sched(h, { seasontype: 2 }), sched(a), sched(a, { seasontype: 2 })]);
  const year = num(hCur?.season?.year ?? hReg?.season?.year) || new Date(g.start).getFullYear() + 1;
  const [p1, p1po, p2, p2po, a1] = await Promise.all([
    sched(h, { season: year - 1, seasontype: 2 }),
    sched(h, { season: year - 1, seasontype: 3 }),
    sched(h, { season: year - 2, seasontype: 2 }),
    sched(h, { season: year - 2, seasontype: 3 }),
    sched(a, { season: year - 1, seasontype: 2 }),
  ]);
  const label = (j: any, y: number) => j?.requestedSeason?.displayName ?? j?.season?.displayName ?? seasonLabel(y - 1);
  return buildHistory(g, games(hCur, hReg, p1, p1po, p2, p2po), games(aCur, aReg, a1), [label(hCur, year), label(p1, year - 1), label(p2, year - 2)]);
}

// ---------- players ----------

function averagesFrom(names: string[], stats: string[]): PlayerAverages {
  const at = (k: string) => {
    const i = names.indexOf(k);
    return i >= 0 ? stats[i] : undefined;
  };
  const [fgm, fga] = madeAtt(at('avgFieldGoalsMade-avgFieldGoalsAttempted'));
  const [tpm, tpa] = madeAtt(at('avgThreePointFieldGoalsMade-avgThreePointFieldGoalsAttempted'));
  const [ftm, fta] = madeAtt(at('avgFreeThrowsMade-avgFreeThrowsAttempted'));
  return {
    gp: num(at('gamesPlayed')),
    gs: numOrNull(at('gamesStarted')) ?? undefined,
    min: numOrNull(at('avgMinutes')) ?? undefined,
    pts: num(at('avgPoints')),
    reb: num(at('avgRebounds')),
    oreb: numOrNull(at('avgOffensiveRebounds')) ?? undefined,
    dreb: numOrNull(at('avgDefensiveRebounds')) ?? undefined,
    ast: num(at('avgAssists')),
    stl: num(at('avgSteals')),
    blk: num(at('avgBlocks')),
    tov: num(at('avgTurnovers')),
    pf: numOrNull(at('avgFouls')) ?? undefined,
    fgPct: numOrNull(at('fieldGoalPct')) ?? undefined,
    tpPct: numOrNull(at('threePointPct') ?? at('threePointFieldGoalPct')) ?? undefined,
    ftPct: numOrNull(at('freeThrowPct')) ?? undefined,
    fgm: fga ? fgm : undefined,
    fga: fga || undefined,
    tpm: tpa ? tpm : undefined,
    tpa: tpa || undefined,
    ftm: fta ? ftm : undefined,
    fta: fta || undefined,
  };
}

function dobFrom(display: string | undefined, iso: string | undefined): string | undefined {
  if (iso) return iso;
  const m = display && /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(display);
  return m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : undefined;
}

async function player(league: LeagueDef, id: string): Promise<PlayerDetail> {
  const base = `/apis/common/v3/sports/basketball/${league.espnSlug}/athletes/${id}`;
  const [info, overview, log, career] = await Promise.all([
    getJson('espn-web', base),
    getJsonOrNull('espn-web', base + '/overview'),
    getJsonOrNull('espn-web', base + '/gamelog'),
    getJsonOrNull('espn-web', base + '/stats'),
  ]);
  const a = info?.athlete ?? {};
  const bio = {
    id: String(a.id ?? id),
    name: a.displayName ?? '',
    number: a.jersey,
    position: a.position?.displayName,
    photo: espnImage(a.headshot?.href, 520, 380),
    team: a.team ? teamRef(a.team) : undefined,
    height: feetInchesToCm(a.displayHeight),
    weight: lbsToKg(a.displayWeight),
    birthDate: dobFrom(a.displayDOB, a.dateOfBirth),
    age: numOrNull(a.age) ?? undefined,
    birthPlace: a.displayBirthPlace,
    nationality: a.citizenship,
    college: a.college?.name,
    experience: a.displayExperience,
  };

  const st = overview?.statistics;
  const split = st?.splits?.find((s: any) => /regular/i.test(s.displayName)) ?? st?.splits?.[0];
  const averages = split ? averagesFrom(st.names, split.stats) : undefined;

  const gameLog: GameLogRow[] = [];
  if (log?.events && log?.seasonTypes) {
    const names: string[] = log.names ?? [];
    for (const stype of log.seasonTypes) {
      for (const cat of stype.categories ?? []) {
        for (const e of cat.events ?? []) {
          const meta = log.events[e.eventId];
          if (!meta) continue;
          const at = (k: string) => {
            const i = names.indexOf(k);
            return i >= 0 ? e.stats[i] : undefined;
          };
          const [fgm, fga] = madeAtt(at('fieldGoalsMade-fieldGoalsAttempted'));
          const [tpm, tpa] = madeAtt(at('threePointFieldGoalsMade-threePointFieldGoalsAttempted'));
          const [ftm, fta] = madeAtt(at('freeThrowsMade-freeThrowsAttempted'));
          gameLog.push({
            gameId: String(e.eventId),
            date: meta.gameDate,
            opponent: meta.opponent?.displayName ?? '',
            opponentLogo: espnImage(meta.opponent?.logo, 64),
            home: meta.atVs === 'vs',
            result: meta.gameResult === 'W' ? 'W' : meta.gameResult === 'L' ? 'L' : undefined,
            score: meta.score,
            line: {
              ...emptyLine(),
              sec: parseMinutes(at('minutes')),
              min: at('minutes'),
              pts: num(at('points')),
              reb: num(at('totalRebounds')),
              ast: num(at('assists')),
              stl: num(at('steals')),
              blk: num(at('blocks')),
              tov: num(at('turnovers')),
              pf: num(at('fouls')),
              fgm, fga, tpm, tpa, ftm, fta,
            },
          });
        }
      }
    }
    gameLog.sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime());
  }

  const careerRows: CareerRow[] = [];
  const avgCat = career?.categories?.find((c: any) => c.name === 'averages');
  if (avgCat) {
    const teamNames = new Map<string, string>();
    for (const t of career?.teams ? Object.values<any>(career.teams) : []) teamNames.set(String(t.id), t.displayName ?? t.abbreviation);
    for (const row of avgCat.statistics ?? []) {
      careerRows.push({
        season: row.season?.displayName ?? String(row.season?.year ?? ''),
        team: teamNames.get(String(row.teamId)) ?? row.teamSlug,
        league: league.short,
        avg: averagesFrom(avgCat.names, row.stats),
      });
    }
    careerRows.reverse();
  }

  return {
    bio,
    season: /(\d{4}-\d{2})/.exec(a.statsSummary?.displayName ?? split?.displayName ?? '')?.[1],
    averages: averages && averages.gp > 0 ? averages : undefined,
    gameLog: gameLog.slice(0, 40),
    career: careerRows,
  };
}

// ---------- leaders / schedule / search ----------

const LEADER_MAP: Record<string, LeaderKey> = {
  pointsPerGame: 'pts',
  reboundsPerGame: 'reb',
  assistsPerGame: 'ast',
  stealsPerGame: 'stl',
  blocksPerGame: 'blk',
  '3PointsMadePerGame': 'tpm',
};

async function leaders(league: LeagueDef): Promise<LeaderCategory[]> {
  const j = await getJsonOrNull('espn-web', `/apis/site/v3/sports/basketball/${league.espnSlug}/leaders`);
  const cats: any[] = j?.leaders?.categories ?? [];
  const out: LeaderCategory[] = [];
  for (const c of cats) {
    const key = LEADER_MAP[c.name];
    if (!key || out.some((o) => o.key === key)) continue;
    out.push({
      key,
      entries: (c.leaders ?? []).slice(0, 10).map((x: any) => ({
        playerId: String(x.athlete?.id),
        name: x.athlete?.displayName ?? '',
        photo: espnImage(x.athlete?.headshot?.href, 96, 70),
        team: x.athlete?.team ? teamRef(x.athlete.team) : x.team ? teamRef(x.team) : undefined,
        value: num(x.value ?? x.displayValue),
      })),
    });
  }
  return out;
}

async function schedule(league: LeagueDef, round?: string): Promise<LeagueSchedule> {
  const today = todayKey();
  const day = round && /^\d{4}-\d{2}-\d{2}$/.test(round) ? round : today;
  const rounds = Array.from({ length: 15 }, (_, i) => {
    const d = addDays(day, i - 7);
    return { id: d, label: d, current: d === today };
  });
  return { kind: 'date', rounds, round: day, games: await gamesByDate(league, day) };
}

async function searchPlayers(league: LeagueDef, q: string): Promise<PlayerHit[]> {
  const j = await getJsonOrNull('espn-web', '/apis/common/v3/search', { query: q, type: 'player', sport: 'basketball', limit: 40 });
  return (j?.items ?? [])
    .filter((x: any) => (x.defaultLeagueSlug ?? x.league) === league.espnSlug)
    .map((x: any) => ({
      id: String(x.id),
      name: x.displayName,
      leagueId: league.id,
      team: x.teamRelationships?.[0]?.displayName,
      photo: espnImage(x.headshot?.href, 96, 70),
      number: x.jersey,
    }));
}

export const espnProvider: Provider = { gamesByDate, game, history, standings, teams, team, player, leaders, schedule, searchPlayers };
