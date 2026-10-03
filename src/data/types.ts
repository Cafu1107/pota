// Normalized domain model. Every provider maps its source JSON into these shapes,
// so pages never know which API a league comes from.

export type SourceId = 'espn' | 'euroleague' | 'tbf';
export type Region = 'tr' | 'eu' | 'us' | 'world';
export type Lang = 'tr' | 'en';
export type Side = 'home' | 'away';

export interface LeagueDef {
  /** URL slug, e.g. "bsl", "euroleague", "nba". */
  id: string;
  source: SourceId;
  name: Record<Lang, string>;
  /** Short label for chips and dense rows: "BSL", "EuroLeague", "NBA". */
  short: string;
  region: Region;
  /** Country/area code for the flag: TR, EU, US, AU, WORLD. */
  flag: 'TR' | 'EU' | 'US' | 'AU' | 'WORLD';
  gender: 'm' | 'w';
  /** Minutes per period and number of regulation periods. */
  periodMinutes: number;
  periods: number;
  /** Court geometry used by the shot chart. */
  court: 'fiba' | 'nba' | 'ncaa';
  order: number;
  logo?: string;
  espnSlug?: string;
  elCode?: 'E' | 'U';
  tbfPrefix?: string;
}

export type GameStatus = 'scheduled' | 'live' | 'final' | 'postponed' | 'cancelled';

export interface TeamRef {
  id: string;
  name: string;
  short?: string;
  abbr?: string;
  logo?: string;
  /** "#rrggbb" when the source provides team colors. */
  color?: string;
  color2?: string;
}

export interface GameSide {
  team: TeamRef;
  score: number | null;
  /** Points per period, overtime periods appended. */
  periods: number[];
  winner?: boolean;
  record?: string;
}

export interface Game {
  id: string;
  leagueId: string;
  /** ISO timestamp in UTC. */
  start: string;
  status: GameStatus;
  /** Current period while live; last period once final (5+ means overtime). */
  period?: number;
  clock?: string;
  /** Between periods (includes halftime). */
  isBreak?: boolean;
  isHalftime?: boolean;
  /** Start time not confirmed by the source. */
  timeTbd?: boolean;
  home: GameSide;
  away: GameSide;
  venue?: string;
  city?: string;
  round?: string;
  broadcast?: string;
  /** Source specific identifiers needed to load more detail. */
  ref?: Record<string, string | number | undefined>;
}

export interface StatLine {
  sec?: number;
  min?: string;
  pts: number;
  reb: number;
  oreb: number;
  dreb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pf: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
  pm?: number;
  eff?: number;
}

export interface PlayerLine extends StatLine {
  id: string;
  name: string;
  number?: string;
  position?: string;
  photo?: string;
  starter?: boolean;
  /** Did not play. */
  dnp?: boolean;
  onCourt?: boolean;
}

export interface TeamBox {
  players: PlayerLine[];
  totals: StatLine;
  coach?: string;
}

export type CompareKey =
  | 'pts' | 'fg' | 'fgPct' | 'twoPct' | 'tp' | 'tpPct' | 'ft' | 'ftPct'
  | 'reb' | 'oreb' | 'dreb' | 'ast' | 'stl' | 'blk' | 'tov' | 'pf'
  | 'eff' | 'ptsOffTov' | 'fastBreak' | 'secondChance' | 'paint' | 'bench'
  | 'biggestLead' | 'biggestRun' | 'leadChanges' | 'timesTied' | 'timeLeading';

export interface TeamCompareRow {
  key: CompareKey;
  home: number;
  away: number;
  /** Optional display strings, e.g. "24/32" or "28:38". */
  homeText?: string;
  awayText?: string;
  /** Lower is better (turnovers, fouls). */
  inverse?: boolean;
  pct?: boolean;
}

export type PlayKind =
  | 'two' | 'three' | 'ft' | 'rebound' | 'assist' | 'steal' | 'block' | 'turnover'
  | 'foul' | 'timeout' | 'sub' | 'period' | 'jump' | 'other';

export interface Play {
  id: string;
  period: number;
  clock: string;
  side?: Side;
  playerId?: string;
  player?: string;
  kind: PlayKind;
  /** Source sub-type: shot style (layup, dunk…), free throw '1of2', period 'start' / 'end'. */
  detail?: string;
  /** Source description (language in GameDetail.playsLang); may be empty for structured feeds. */
  text: string;
  /** Source text in the source language, used when structured fields are missing. */
  rawText?: string;
  made?: boolean;
  points?: number;
  homeScore?: number;
  awayScore?: number;
}

/**
 * Shot in half-court meters: x is lateral (-7.5 … 7.5, 0 = basket line),
 * y is the distance from the baseline (basket at ~1.575).
 */
export interface Shot {
  x: number;
  y: number;
  made: boolean;
  value: 2 | 3;
  side: Side;
  period?: number;
  playerId?: string;
  player?: string;
}

export interface GameLeader {
  key: 'pts' | 'reb' | 'ast' | 'eff' | 'stl' | 'blk';
  side: Side;
  playerId?: string;
  name: string;
  photo?: string;
  value: number;
  line?: string;
}

export interface GameDetail {
  game: Game;
  box?: Record<Side, TeamBox>;
  compare?: TeamCompareRow[];
  plays?: Play[];
  shots?: Shot[];
  leaders?: GameLeader[];
  officials?: string[];
  attendance?: number;
  coaches?: Partial<Record<Side, string>>;
  /** Previous meetings when the source provides them. */
  meetings?: Game[];
  /** Language of Play.text; when it differs from the UI language the text is rebuilt from structured fields. */
  playsLang?: Lang;
  /** What the source could not provide for this game. */
  missing?: Array<'box' | 'plays' | 'shots'>;
  updatedAt: number;
}

export interface StandingRow {
  rank: number;
  team: TeamRef;
  gp: number;
  w: number;
  l: number;
  pct?: number;
  pf?: number;
  pa?: number;
  diff?: number;
  /** League points (FIBA style 2 per win, 1 per loss). */
  pts?: number;
  gb?: string;
  streak?: string;
  home?: string;
  away?: string;
  /** Most recent last, true = win. */
  form?: boolean[];
  zone?: 'top' | 'playoff' | 'playin' | 'down';
}

export interface StandingGroup {
  name?: string;
  /** Set when the table shows a past season (e.g. pre-season fallback). */
  season?: string;
  rows: StandingRow[];
}

export interface RosterPlayer {
  id: string;
  name: string;
  number?: string;
  position?: string;
  photo?: string;
  /** Centimeters / kilograms. */
  height?: number;
  weight?: number;
  birthDate?: string;
  age?: number;
  nationality?: string;
  /** Season per-game numbers when the roster source includes them. */
  gp?: number;
  ppg?: number;
  rpg?: number;
  apg?: number;
}

export interface TeamSeasonStat {
  key: 'pts' | 'reb' | 'ast' | 'stl' | 'blk' | 'tov' | 'fgPct' | 'tpPct' | 'ftPct' | 'eff' | 'opp';
  value: number;
}

export interface TeamDetail {
  team: TeamRef;
  leagueId: string;
  city?: string;
  venue?: string;
  capacity?: number;
  founded?: string;
  coach?: string;
  record?: { w: number; l: number };
  standing?: { rank: number; group?: string };
  roster: RosterPlayer[];
  staff?: Array<{ name: string; role: string; photo?: string }>;
  games: Game[];
  stats?: TeamSeasonStat[];
}

export interface PlayerAverages {
  gp: number;
  gs?: number;
  min?: number;
  pts: number;
  reb: number;
  oreb?: number;
  dreb?: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pf?: number;
  eff?: number;
  fgPct?: number;
  tpPct?: number;
  ftPct?: number;
  fgm?: number;
  fga?: number;
  tpm?: number;
  tpa?: number;
  ftm?: number;
  fta?: number;
}

export interface GameLogRow {
  gameId?: string;
  date: string;
  opponent: string;
  opponentLogo?: string;
  home?: boolean;
  result?: 'W' | 'L';
  score?: string;
  line: StatLine;
}

export interface CareerRow {
  season: string;
  team?: string;
  league?: string;
  avg: PlayerAverages;
}

export interface PlayerBio {
  id: string;
  name: string;
  number?: string;
  position?: string;
  photo?: string;
  team?: TeamRef;
  height?: number;
  weight?: number;
  birthDate?: string;
  age?: number;
  birthPlace?: string;
  nationality?: string;
  college?: string;
  experience?: string;
}

export interface PlayerDetail {
  bio: PlayerBio;
  season?: string;
  averages?: PlayerAverages;
  gameLog?: GameLogRow[];
  career?: CareerRow[];
}

export type LeaderKey = 'pts' | 'reb' | 'ast' | 'stl' | 'blk' | 'eff' | 'tpm' | 'min';

export interface LeaderEntry {
  playerId: string;
  name: string;
  photo?: string;
  team?: TeamRef;
  value: number;
  gp?: number;
}

export interface LeaderCategory {
  key: LeaderKey;
  entries: LeaderEntry[];
}

export interface RoundInfo {
  id: string;
  label: string;
  current?: boolean;
}

export interface LeagueSchedule {
  kind: 'round' | 'week' | 'date';
  rounds: RoundInfo[];
  round: string;
  games: Game[];
}

export interface PlayerHit {
  id: string;
  name: string;
  leagueId: string;
  team?: string;
  photo?: string;
  number?: string;
}

/** Head to head: what the two teams of a game did against each other and lately. */
export interface GameHistory {
  /** Games between the two teams (any status), newest first. */
  meetings: Game[];
  /** Seasons the meetings were looked up in, newest first ("2026-27"). */
  seasons: string[];
  /** Each team's finished games before this one, newest first (up to five). */
  form: Record<Side, Game[]>;
}

export interface Provider {
  gamesByDate(league: LeagueDef, date: string): Promise<Game[]>;
  game(league: LeagueDef, id: string): Promise<GameDetail>;
  history(league: LeagueDef, game: Game): Promise<GameHistory>;
  standings(league: LeagueDef): Promise<StandingGroup[]>;
  teams(league: LeagueDef): Promise<TeamRef[]>;
  team(league: LeagueDef, id: string): Promise<TeamDetail>;
  player(league: LeagueDef, id: string): Promise<PlayerDetail>;
  leaders(league: LeagueDef): Promise<LeaderCategory[]>;
  schedule(league: LeagueDef, round?: string): Promise<LeagueSchedule>;
  searchPlayers(league: LeagueDef, q: string): Promise<PlayerHit[]>;
}
