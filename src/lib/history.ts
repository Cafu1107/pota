// Head to head: pure helpers shared by the providers (building the history from
// team schedules) and the UI (summing it up). No fetching here.
import type { Game, GameHistory, Side, TeamRef } from '../data/types';

const FORM_SIZE = 5;

const involves = (g: Game, id: string) => g.home.team.id === id || g.away.team.id === id;
const newestFirst = (a: Game, b: Game) => new Date(b.start).getTime() - new Date(a.start).getTime();

/** Schedules often lack logos and colors; borrow them from the game being viewed. */
function withRefs(g: Game, refs: Map<string, TeamRef>): Game {
  const fill = (t: TeamRef): TeamRef => {
    const r = refs.get(t.id);
    return r ? { ...t, logo: t.logo || r.logo, color: t.color ?? r.color, color2: t.color2 ?? r.color2, short: t.short ?? r.short, abbr: t.abbr ?? r.abbr } : t;
  };
  return { ...g, home: { ...g.home, team: fill(g.home.team) }, away: { ...g.away, team: fill(g.away.team) } };
}

/**
 * Builds the head-to-head view of `game` from the two teams' schedules (any seasons,
 * duplicates allowed). Form only counts games played before this one.
 */
export function buildHistory(game: Game, homeGames: Game[], awayGames: Game[], seasons: string[]): GameHistory {
  const hId = game.home.team.id;
  const aId = game.away.team.id;
  const refs = new Map<string, TeamRef>([
    [hId, game.home.team],
    [aId, game.away.team],
  ]);
  const meetings = new Map<string, Game>();
  for (const g of [...homeGames, ...awayGames]) {
    if (g.id === game.id || g.status === 'cancelled') continue;
    if (involves(g, hId) && involves(g, aId)) meetings.set(g.id, withRefs(g, refs));
  }
  const start = new Date(game.start).getTime();
  const formOf = (teamId: string, list: Game[]) => {
    const seen = new Set<string>();
    return list
      .filter((g) => {
        if (seen.has(g.id) || g.id === game.id || g.status !== 'final' || !involves(g, teamId)) return false;
        seen.add(g.id);
        return new Date(g.start).getTime() < start;
      })
      .sort(newestFirst)
      .slice(0, FORM_SIZE)
      .map((g) => withRefs(g, refs));
  };
  return {
    meetings: [...meetings.values()].sort(newestFirst),
    seasons,
    form: { home: formOf(hId, homeGames), away: formOf(aId, awayGames) },
  };
}

export interface HistorySummary {
  /** Finished meetings counted below. */
  played: number;
  /** Wins of this game's home and away team in those meetings. */
  wins: Record<Side, number>;
  /** Points per meeting for each team. */
  avgPts: Record<Side, number | undefined>;
  /** Each team's widest winning margin. */
  biggest: Partial<Record<Side, { game: Game; margin: number }>>;
  /** Most recent finished meeting. */
  last?: Game;
}

/** Sums up the finished meetings from the point of view of `game`'s two teams. */
export function summarizeHistory(game: Game, meetings: Game[]): HistorySummary {
  const ids: Record<Side, string> = { home: game.home.team.id, away: game.away.team.id };
  const wins: Record<Side, number> = { home: 0, away: 0 };
  const pts: Record<Side, number> = { home: 0, away: 0 };
  const biggest: HistorySummary['biggest'] = {};
  const finished = meetings.filter((g) => g.status === 'final' && g.home.score !== null && g.away.score !== null).sort(newestFirst);
  for (const g of finished) {
    for (const side of ['home', 'away'] as const) {
      const mine: Side = g.home.team.id === ids[side] ? 'home' : 'away';
      const theirs: Side = mine === 'home' ? 'away' : 'home';
      const margin = (g[mine].score ?? 0) - (g[theirs].score ?? 0);
      pts[side] += g[mine].score ?? 0;
      if (margin > 0) {
        wins[side]++;
        if (!biggest[side] || margin > biggest[side]!.margin) biggest[side] = { game: g, margin };
      }
    }
  }
  const n = finished.length;
  return {
    played: n,
    wins,
    avgPts: { home: n ? pts.home / n : undefined, away: n ? pts.away / n : undefined },
    biggest,
    last: finished[0],
  };
}

/** "2026-2027" or 2026 → "2026-27". */
export function seasonLabel(s: string | number): string {
  const m = /^(\d{4})(?:\s*[-/]\s*(\d{2,4}))?$/.exec(String(s).trim());
  if (!m) return String(s);
  const y = Number(m[1]);
  return `${y}-${String(m[2] ? Number(m[2]) : y + 1).slice(-2)}`;
}
