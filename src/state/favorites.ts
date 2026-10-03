import { createStore } from './store';
import type { TeamRef } from '../data/types';

export interface FavTeam {
  leagueId: string;
  id: string;
  name: string;
  logo?: string;
  color?: string;
}

interface Favorites {
  teams: FavTeam[];
  leagues: string[];
}

const store = createStore<Favorites>('pota:favorites', { teams: [], leagues: [] });

export const useFavorites = store.useStore;

const teamKey = (leagueId: string, id: string) => `${leagueId}:${id}`;

export function isFavoriteTeam(f: Favorites, leagueId: string, id: string) {
  return f.teams.some((t) => teamKey(t.leagueId, t.id) === teamKey(leagueId, id));
}

export function toggleFavoriteTeam(leagueId: string, team: TeamRef) {
  store.set((s) => {
    const k = teamKey(leagueId, team.id);
    const exists = s.teams.some((t) => teamKey(t.leagueId, t.id) === k);
    return {
      teams: exists
        ? s.teams.filter((t) => teamKey(t.leagueId, t.id) !== k)
        : [...s.teams, { leagueId, id: team.id, name: team.name, logo: team.logo, color: team.color }],
    };
  });
}

export function togglePinnedLeague(leagueId: string) {
  store.set((s) => ({
    leagues: s.leagues.includes(leagueId) ? s.leagues.filter((l) => l !== leagueId) : [...s.leagues, leagueId],
  }));
}

/** Set of "leagueId:teamId" for fast lookups in lists. */
export function useFavoriteTeamKeys(): Set<string> {
  const teams = useFavorites((s) => s.teams);
  // Recomputed on change only; the store returns the same array otherwise.
  return favoriteKeyCache(teams);
}

let lastTeams: FavTeam[] | null = null;
let lastKeys = new Set<string>();
function favoriteKeyCache(teams: FavTeam[]) {
  if (teams !== lastTeams) {
    lastTeams = teams;
    lastKeys = new Set(teams.map((t) => teamKey(t.leagueId, t.id)));
  }
  return lastKeys;
}

export const favKey = teamKey;
