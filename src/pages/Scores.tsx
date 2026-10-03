import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarX2, RotateCw, Star, Radio } from 'lucide-react';
import { useAllGames, usePrefetch, useStandings } from '../data/queries';
import type { Game, LeagueDef } from '../data/types';
import { useI18n } from '../i18n';
import { addDays, isValidDayKey, todayKey } from '../lib/time';
import { useMediaQuery, useNow } from '../lib/hooks';
import { favKey, useFavoriteTeamKeys, useFavorites } from '../state/favorites';
import { DateStrip } from '../components/scores/DateStrip';
import { LeagueRail, type RailCounts } from '../components/scores/LeagueRail';
import { LeagueGroup } from '../components/games/LeagueGroup';
import { FeaturedGame, type FeaturedKind } from '../components/games/FeaturedGame';
import { LiveStrip } from '../components/games/LiveStrip';
import { StandingsTable } from '../components/tables/StandingsTable';
import { NewsMiniList } from '../components/news/NewsParts';
import { preferLang, useNews } from '../data/news';
import { Segmented } from '../components/ui/Controls';
import { Card, CardHeader, EmptyState, Skeleton } from '../components/ui/States';
import { LiveDot } from '../components/ui/Live';
import u from '../components/ui/ui.module.css';
import s from '../components/scores/scores.module.css';

type Filter = 'all' | 'live' | 'fav';

function pickFeatured(groups: Array<{ league: LeagueDef; games: Game[] }>, favs: Set<string>): { game: Game; league: LeagueDef; kind: FeaturedKind } | null {
  const all = groups.flatMap(({ league, games }) => games.map((game) => ({ game, league })));
  const isFav = (g: Game) => favs.has(favKey(g.leagueId, g.home.team.id)) || favs.has(favKey(g.leagueId, g.away.team.id));
  const rank = (x: { game: Game; league: LeagueDef }) => (isFav(x.game) ? 0 : 1) * 100 + x.league.order;
  const live = all.filter((x) => x.game.status === 'live').sort((a, b) => rank(a) - rank(b));
  if (live[0]) return { ...live[0], kind: 'live' };
  const now = Date.now();
  const next = all
    .filter((x) => x.game.status === 'scheduled' && new Date(x.game.start).getTime() > now - 30 * 60_000)
    .sort((a, b) => rank(a) - rank(b) || new Date(a.game.start).getTime() - new Date(b.game.start).getTime());
  if (next[0]) return { ...next[0], kind: 'next' };
  const last = all
    .filter((x) => x.game.status === 'final')
    .sort((a, b) => rank(a) - rank(b) || new Date(b.game.start).getTime() - new Date(a.game.start).getTime());
  return last[0] ? { ...last[0], kind: 'last' } : null;
}

function StandingsSnippet({ league, highlight }: { league: LeagueDef; highlight: string[] }) {
  const { t, lang } = useI18n();
  const q = useStandings(league.id);
  const groups = q.data ?? [];
  if (!groups.length || !groups[0].rows.length) return null;
  return (
    <Card>
      <CardHeader title={`${league.name[lang]}`}>
        <Link to={`/lig/${league.id}/puan-durumu`} className={s.cardLink}>
          {t('tabStandings')}
        </Link>
      </CardHeader>
      <StandingsTable groups={[{ ...groups[0], name: undefined }]} league={league} compact limit={8} highlight={highlight} />
    </Card>
  );
}

/** Latest headlines; fetched only once the scores have landed so they never compete. */
function NewsSnippet({ enabled }: { enabled: boolean }) {
  const { t, lang } = useI18n();
  const news = useNews(enabled);
  const items = preferLang(news.items, lang, 5);
  if (!items.length) return null;
  return (
    <Card>
      <CardHeader title={t('newsLatest')}>
        <Link to="/haberler" className={s.cardLink}>
          {t('newsSeeAll')}
        </Link>
      </CardHeader>
      <NewsMiniList items={items} />
    </Card>
  );
}

function GroupsSkeleton() {
  return (
    <div className={s.groups} aria-hidden>
      {[5, 3, 4].map((n, i) => (
        <div key={i} className={s.skelGroup}>
          <div className={s.skelHead}>
            <Skeleton w={22} h={22} r={6} />
            <Skeleton w={160} h={12} />
          </div>
          {Array.from({ length: n }, (_, j) => (
            <div key={j} className={s.skelRow}>
              <Skeleton w={34} h={11} />
              <div className={s.skelTeams}>
                <Skeleton w="62%" h={11} />
                <Skeleton w="48%" h={11} />
              </div>
              <Skeleton w={22} h={11} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function ScoresPage() {
  const i18n = useI18n();
  const { t } = i18n;
  const [params, setParams] = useSearchParams();
  const qDay = params.get('tarih');
  const day = isValidDayKey(qDay) ? qDay : todayKey();
  const [filter, setFilter] = useState<Filter>('all');
  const favs = useFavoriteTeamKeys();
  const pinned = useFavorites((f) => f.leagues);
  const wideAside = useMediaQuery('(min-width: 1180px)');
  const queryClient = useQueryClient();
  const prefetch = usePrefetch();
  const data = useAllGames(day);
  useNow(15_000);

  const setDay = (d: string) => {
    const next = new URLSearchParams(params);
    if (d === todayKey()) next.delete('tarih');
    else next.set('tarih', d);
    setParams(next, { replace: true });
    setFilter('all');
  };

  const isFavGame = (g: Game) => favs.has(favKey(g.leagueId, g.home.team.id)) || favs.has(favKey(g.leagueId, g.away.team.id));

  const ordered = useMemo(() => {
    const groups = data.byLeague.filter((r) => r.games.length > 0);
    return groups.sort((a, b) => {
      const pa = pinned.includes(a.league.id) ? 0 : 1;
      const pb = pinned.includes(b.league.id) ? 0 : 1;
      const fa = a.games.some(isFavGame) ? 0 : 1;
      const fb = b.games.some(isFavGame) ? 0 : 1;
      return pa - pb || fa - fb || a.league.order - b.league.order;
    });
  }, [data.byLeague, pinned, favs]);

  const counts = useMemo(() => {
    const m = new Map<string, RailCounts>();
    for (const r of data.byLeague) m.set(r.league.id, { games: r.games.length, live: r.games.filter((g) => g.status === 'live').length });
    return m;
  }, [data.byLeague]);

  const totalGames = ordered.reduce((n, r) => n + r.games.length, 0);
  const liveGames = ordered.reduce((n, r) => n + r.games.filter((g) => g.status === 'live').length, 0);
  const favGames = ordered.reduce((n, r) => n + r.games.filter(isFavGame).length, 0);

  const visible = ordered
    .map((r) => ({
      ...r,
      games: filter === 'live' ? r.games.filter((g) => g.status === 'live') : filter === 'fav' ? r.games.filter(isFavGame) : r.games,
    }))
    .filter((r) => r.games.length > 0);

  const featured = useMemo(() => pickFeatured(ordered, favs), [ordered, favs]);
  const liveItems = useMemo(
    () =>
      ordered
        .flatMap(({ league, games }) => games.filter((g) => g.status === 'live').map((game) => ({ game, league })))
        .sort((a, b) => (isFavGame(a.game) ? 0 : 1) - (isFavGame(b.game) ? 0 : 1) || a.league.order - b.league.order),
    [ordered, favs],
  );
  const loadingFirst = totalGames === 0 && data.loading > 0;
  const allSettled = data.loading === 0;

  // When the day has settled, use idle time to warm what is likely to be opened next.
  useEffect(() => {
    if (!allSettled) return;
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 400));
    const handle = idle(() => {
      for (const { game } of liveItems.slice(0, 6)) prefetch.game(game.leagueId, game.id);
      if (featured) prefetch.game(featured.game.leagueId, featured.game.id);
      prefetch.day(addDays(day, 1));
      prefetch.day(addDays(day, -1));
    });
    return () => (window.cancelIdleCallback ? window.cancelIdleCallback(handle as number) : window.clearTimeout(handle as number));
  }, [allSettled, day]);

  // Load-time marks (read by the perf script and visible in DevTools > Performance).
  useEffect(() => {
    if (totalGames > 0 && !performance.getEntriesByName('pota:first-games').length) performance.mark('pota:first-games');
    if (allSettled && !performance.getEntriesByName('pota:all-leagues').length) performance.mark('pota:all-leagues');
  }, [totalGames, allSettled]);

  const jump = (league: LeagueDef) => {
    setFilter('all');
    requestAnimationFrame(() => document.getElementById(`lg-${league.id}`)?.closest('section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const retryFailed = () => {
    for (const l of data.failed) queryClient.invalidateQueries({ queryKey: ['games', l.id, day] });
  };

  const list = (
    <div className={s.listCol}>
      <div className={s.toolbar}>
        <Segmented<Filter>
          label={t('filterAll')}
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: t('filterAll'), count: totalGames },
            { value: 'live', label: t('filterLive'), count: liveGames, icon: liveGames ? <LiveDot /> : undefined },
            { value: 'fav', label: t('filterFavorites'), count: favGames },
          ]}
        />
        {!allSettled && (
          <span className={s.progress} role="status">
            <span className={s.progressBar} style={{ transform: `scaleX(${data.settled / data.total})` }} />
            {t('loadingLeagues', { done: data.settled, total: data.total })}
          </span>
        )}
      </div>

      {loadingFirst ? (
        <GroupsSkeleton />
      ) : visible.length > 0 ? (
        <div className={s.groups}>
          {visible.map((r) => (
            <LeagueGroup key={r.league.id} league={r.league} games={r.games} favorites={favs} pinned={pinned.includes(r.league.id)} videos={allSettled} />
          ))}
        </div>
      ) : allSettled || totalGames > 0 ? (
        <Card>
          {filter === 'live' ? (
            <EmptyState
              icon={<Radio size={22} />}
              title={t('noLiveGames')}
              hint={t('noLiveGamesHint')}
              action={
                <button type="button" className={u.button} onClick={() => setFilter('all')}>
                  {t('showAllGames')}
                </button>
              }
            />
          ) : filter === 'fav' ? (
            <EmptyState
              icon={<Star size={22} />}
              title={favs.size ? t('noFavoriteGames') : t('noFavoritesYet')}
              hint={favs.size ? undefined : t('noFavoritesHint')}
              action={
                <button type="button" className={u.button} onClick={() => setFilter('all')}>
                  {t('showAllGames')}
                </button>
              }
            />
          ) : (
            <EmptyState
              icon={<CalendarX2 size={22} />}
              title={t('noGamesDay')}
              hint={t('noGamesDayHint')}
              action={
                <button type="button" className={u.button} onClick={() => setDay(day === todayKey() ? addDays(day, 1) : todayKey())}>
                  {day === todayKey() ? i18n.t('tomorrow') : t('backToToday')}
                </button>
              }
            />
          )}
        </Card>
      ) : (
        <GroupsSkeleton />
      )}

      {allSettled && data.failed.length > 0 && (
        <p className={s.failed}>
          {t('leaguesFailed', { list: data.failed.map((l) => l.short).join(', ') })}
          <button type="button" className={s.retry} onClick={retryFailed}>
            <RotateCw size={13} />
            {t('retry')}
          </button>
        </p>
      )}
    </div>
  );

  return (
    <div className={s.page}>
      <h1 className="sr-only">{t('navScores')}</h1>
      <aside className={s.railCol}>
        <LeagueRail counts={counts} onJump={jump} />
      </aside>
      <div className={s.mainCol}>
        <div className={s.dateBar}>
          <DateStrip value={day} onChange={setDay} />
        </div>
        {!wideAside && liveItems.length > 0 && filter !== 'live' && <LiveStrip items={liveItems} />}
        {list}
      </div>
      {wideAside && (
        <aside className={s.asideCol}>
          {featured && <FeaturedGame key={featured.game.id} game={featured.game} league={featured.league} kind={featured.kind} />}
          {featured && <StandingsSnippet league={featured.league} highlight={[featured.game.home.team.id, featured.game.away.team.id]} />}
          <NewsSnippet enabled={allSettled} />
        </aside>
      )}
    </div>
  );
}
