import { createBrowserRouter } from 'react-router';
import { AppShell } from './components/shell/AppShell';
import { ScoresPage } from './pages/Scores';
import { NotFound, RouteError } from './pages/NotFound';

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    errorElement: <RouteError />,
    hydrateFallbackElement: <div aria-busy="true" />,
    children: [
      { index: true, element: <ScoresPage /> },
      { path: 'ligler', lazy: () => import('./pages/Leagues').then((m) => ({ Component: m.LeaguesPage })) },
      {
        path: 'lig/:leagueId',
        lazy: () => import('./pages/League').then((m) => ({ Component: m.LeaguePage })),
        children: [
          { index: true, lazy: () => import('./pages/League').then((m) => ({ Component: m.LeagueFixtures })) },
          { path: 'puan-durumu', lazy: () => import('./pages/League').then((m) => ({ Component: m.LeagueStandings })) },
          { path: 'liderler', lazy: () => import('./pages/League').then((m) => ({ Component: m.LeagueLeaders })) },
          { path: 'takimlar', lazy: () => import('./pages/League').then((m) => ({ Component: m.LeagueTeams })) },
        ],
      },
      {
        path: 'mac/:leagueId/:gameId',
        lazy: () => import('./pages/Game').then((m) => ({ Component: m.GamePage })),
        children: [
          { index: true, lazy: () => import('./pages/Game').then((m) => ({ Component: m.GameSummary })) },
          { path: 'box-score', lazy: () => import('./pages/Game').then((m) => ({ Component: m.GameBox })) },
          { path: 'mac-akisi', lazy: () => import('./pages/Game').then((m) => ({ Component: m.GamePlays })) },
          { path: 'sut-haritasi', lazy: () => import('./pages/Game').then((m) => ({ Component: m.GameShots })) },
          { path: 'karsilasmalar', lazy: () => import('./pages/Game').then((m) => ({ Component: m.GameMeetings })) },
        ],
      },
      {
        path: 'takim/:leagueId/:teamId',
        lazy: () => import('./pages/Team').then((m) => ({ Component: m.TeamPage })),
        children: [
          { index: true, lazy: () => import('./pages/Team').then((m) => ({ Component: m.TeamOverview })) },
          { path: 'kadro', lazy: () => import('./pages/Team').then((m) => ({ Component: m.TeamRoster })) },
          { path: 'maclar', lazy: () => import('./pages/Team').then((m) => ({ Component: m.TeamGames })) },
        ],
      },
      { path: 'oyuncu/:leagueId/:playerId', lazy: () => import('./pages/Player').then((m) => ({ Component: m.PlayerPage })) },
      { path: 'karsilastir', lazy: () => import('./pages/Compare').then((m) => ({ Component: m.ComparePage })) },
      { path: 'haberler', lazy: () => import('./pages/News').then((m) => ({ Component: m.NewsPage })) },
      { path: 'favoriler', lazy: () => import('./pages/Favorites').then((m) => ({ Component: m.FavoritesPage })) },
      { path: '*', element: <NotFound /> },
    ],
  },
], {
  // "/pota" on GitHub Pages, "" locally.
  basename: import.meta.env.BASE_URL.replace(/\/$/, ''),
});
