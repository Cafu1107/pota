import { keepPreviousData, queryOptions, useQueries, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { providerFor } from './api';
import { getLeague, LEAGUES } from './leagues';
import type { Game, GameDetail, LeagueDef, PlayerHit } from './types';
import { todayKey } from '../lib/time';

const SECOND = 1000;
const MINUTE = 60 * SECOND;

// Live cadence. The proxy refreshes hot endpoints every ~3 s on its own, so a
// poll is a cache read; these intervals set how fast a change reaches the screen.
const LIVE_GAME_MS = 5 * SECOND;
const LIVE_LIST_MS = 8 * SECOND;
const SOON_MS = 15 * SECOND;

function needsLivePolling(games: Game[] | undefined): boolean {
  if (!games?.length) return false;
  const now = Date.now();
  return games.some((g) => {
    if (g.status === 'live') return true;
    if (g.status !== 'scheduled') return false;
    const t = new Date(g.start).getTime();
    return t - now < 20 * MINUTE && now - t < 4 * 60 * MINUTE;
  });
}

function gamesRefetch(day: string, games: Game[] | undefined): number | false {
  if (games?.some((g) => g.status === 'live')) return LIVE_LIST_MS;
  if (needsLivePolling(games)) return SOON_MS;
  return day === todayKey() ? 2 * MINUTE : false;
}

// ---------- query definitions (shared by hooks and prefetching) ----------

export function gamesOptions(league: LeagueDef, day: string) {
  return queryOptions({
    queryKey: ['games', league.id, day] as const,
    queryFn: () => providerFor(league).gamesByDate(league, day),
    staleTime: 5 * SECOND,
    refetchInterval: (q) => gamesRefetch(day, q.state.data),
    retry: 1,
  });
}

export function gameOptions(leagueId: string, id: string) {
  const league = getLeague(leagueId)!;
  return queryOptions<GameDetail>({
    queryKey: ['game', leagueId, id] as const,
    queryFn: () => providerFor(league).game(league, id),
    staleTime: 4 * SECOND,
    refetchInterval: (q) => {
      const g = q.state.data?.game;
      if (!g) return false;
      if (g.status === 'live') return LIVE_GAME_MS;
      if (g.status === 'scheduled') return (new Date(g.start).getTime() - Date.now()) / MINUTE < 15 ? SOON_MS : false;
      return false;
    },
    retry: 1,
  });
}

export function teamOptions(leagueId: string, id: string) {
  const league = getLeague(leagueId)!;
  return queryOptions({
    queryKey: ['team', leagueId, id] as const,
    queryFn: () => providerFor(league).team(league, id),
    staleTime: 2 * MINUTE,
    refetchInterval: (q) => (q.state.data?.games.some((g) => g.status === 'live') ? 15 * SECOND : needsLivePolling(q.state.data?.games) ? 30 * SECOND : false),
  });
}

export function playerOptions(leagueId: string, id: string) {
  const league = getLeague(leagueId)!;
  return queryOptions({
    queryKey: ['player', leagueId, id] as const,
    queryFn: () => providerFor(league).player(league, id),
    staleTime: 10 * MINUTE,
  });
}

export function standingsOptions(leagueId: string) {
  const league = getLeague(leagueId)!;
  return queryOptions({
    queryKey: ['standings', leagueId] as const,
    queryFn: () => providerFor(league).standings(league),
    staleTime: 3 * MINUTE,
  });
}

// ---------- hooks ----------

export interface LeagueGamesResult {
  league: LeagueDef;
  games: Game[];
  isLoading: boolean;
  isError: boolean;
}

/** Games of every league for one local day, fetched in parallel. */
export function useAllGames(day: string, leagues: LeagueDef[] = LEAGUES) {
  return useQueries({
    queries: leagues.map((l) => gamesOptions(l, day)),
    combine: (results) => {
      const byLeague: LeagueGamesResult[] = results.map((r, i) => ({
        league: leagues[i],
        games: r.data ?? [],
        isLoading: r.isLoading,
        isError: r.isError,
      }));
      return {
        byLeague,
        loading: results.filter((r) => r.isLoading).length,
        settled: results.filter((r) => !r.isLoading).length,
        total: results.length,
        failed: byLeague.filter((r) => r.isError).map((r) => r.league),
        fetching: results.some((r) => r.isFetching),
        updatedAt: Math.max(0, ...results.map((r) => r.dataUpdatedAt)),
      };
    },
  });
}

export function useLeagueGames(leagueId: string | undefined, day: string) {
  const league = getLeague(leagueId);
  return useQuery({ ...gamesOptions(league ?? LEAGUES[0], day), enabled: !!league });
}

export function useGame(leagueId: string | undefined, id: string | undefined) {
  return useQuery({ ...gameOptions(leagueId ?? LEAGUES[0].id, id ?? ''), enabled: !!getLeague(leagueId) && !!id });
}

/** Head to head for a game: meetings across the seasons the source offers, and both teams' form. */
export function useGameHistory(game: Game | undefined) {
  const league = getLeague(game?.leagueId);
  return useQuery({
    queryKey: ['history', game?.leagueId, game?.id, game?.home.team.id, game?.away.team.id],
    queryFn: () => providerFor(league!).history(league!, game!),
    enabled: !!league && !!game,
    staleTime: 10 * MINUTE,
    retry: 1,
  });
}

export function useStandings(leagueId: string | undefined) {
  return useQuery({ ...standingsOptions(leagueId ?? LEAGUES[0].id), enabled: !!getLeague(leagueId) });
}

export function useTeams(leagueId: string | undefined) {
  const league = getLeague(leagueId);
  return useQuery({
    queryKey: ['teams', leagueId],
    queryFn: () => providerFor(league!).teams(league!),
    enabled: !!league,
    staleTime: 6 * 60 * MINUTE,
  });
}

export function useTeam(leagueId: string | undefined, id: string | undefined) {
  return useQuery({ ...teamOptions(leagueId ?? LEAGUES[0].id, id ?? ''), enabled: !!getLeague(leagueId) && !!id });
}

export function usePlayer(leagueId: string | undefined, id: string | undefined) {
  return useQuery({ ...playerOptions(leagueId ?? LEAGUES[0].id, id ?? ''), enabled: !!getLeague(leagueId) && !!id });
}

export function useLeaders(leagueId: string | undefined) {
  const league = getLeague(leagueId);
  return useQuery({
    queryKey: ['leaders', leagueId],
    queryFn: () => providerFor(league!).leaders(league!),
    enabled: !!league,
    staleTime: 30 * MINUTE,
  });
}

export function useSchedule(leagueId: string | undefined, round: string | undefined) {
  const league = getLeague(leagueId);
  return useQuery({
    queryKey: ['schedule', leagueId, round ?? 'current'],
    queryFn: () => providerFor(league!).schedule(league!, round),
    enabled: !!league,
    staleTime: MINUTE,
    placeholderData: keepPreviousData,
    refetchInterval: (q) => (q.state.data?.games.some((g) => g.status === 'live') ? 10 * SECOND : needsLivePolling(q.state.data?.games) ? 20 * SECOND : false),
  });
}

/** Player search across every league; each source answers for its own leagues. */
export function usePlayerSearch(q: string) {
  const term = q.trim();
  return useQueries({
    queries: LEAGUES.map((l) => ({
      queryKey: ['search', l.id, term.toLocaleLowerCase('tr-TR')],
      queryFn: () => providerFor(l).searchPlayers(l, term),
      enabled: term.length >= 3,
      staleTime: 10 * MINUTE,
      retry: 0,
    })),
    combine: (results) => ({
      hits: results.flatMap((r) => r.data ?? []) as PlayerHit[],
      loading: results.some((r) => r.isLoading && r.fetchStatus !== 'idle'),
    }),
  });
}

/** Team lists of every league, for global search. */
export function useAllTeams(enabled: boolean) {
  return useQueries({
    queries: LEAGUES.map((l) => ({
      queryKey: ['teams', l.id],
      queryFn: () => providerFor(l).teams(l),
      enabled,
      staleTime: 6 * 60 * MINUTE,
      retry: 0,
    })),
    combine: (results) => results.flatMap((r, i) => (r.data ?? []).map((team) => ({ team, league: LEAGUES[i] }))),
  });
}

// ---------- prefetching ----------

const warmed = new Set<string>();

/** Start loading a page's data before the click lands (hover, focus, touchstart). */
export function prefetchGame(qc: QueryClient, leagueId: string, id: string) {
  const k = `g:${leagueId}:${id}`;
  if (warmed.has(k) || !getLeague(leagueId)) return;
  warmed.add(k);
  window.setTimeout(() => warmed.delete(k), 4 * SECOND);
  qc.prefetchQuery(gameOptions(leagueId, id)).catch(() => {});
}

export function prefetchTeam(qc: QueryClient, leagueId: string, id: string) {
  const k = `t:${leagueId}:${id}`;
  if (warmed.has(k) || !getLeague(leagueId)) return;
  warmed.add(k);
  window.setTimeout(() => warmed.delete(k), 60 * SECOND);
  qc.prefetchQuery(teamOptions(leagueId, id)).catch(() => {});
}

export function prefetchDay(qc: QueryClient, day: string) {
  const k = `d:${day}`;
  if (warmed.has(k)) return;
  warmed.add(k);
  window.setTimeout(() => warmed.delete(k), 60 * SECOND);
  for (const l of LEAGUES) qc.prefetchQuery(gamesOptions(l, day)).catch(() => {});
}

export function usePrefetch() {
  const qc = useQueryClient();
  return {
    game: useCallback((leagueId: string, id: string) => prefetchGame(qc, leagueId, id), [qc]),
    team: useCallback((leagueId: string, id: string) => prefetchTeam(qc, leagueId, id), [qc]),
    day: useCallback((day: string) => prefetchDay(qc, day), [qc]),
  };
}
