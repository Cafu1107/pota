import { useEffect, useRef } from 'react';
import { Link, Outlet, useOutletContext, useParams, useSearchParams } from 'react-router';
import { ChevronLeft, ChevronRight, ListOrdered, Trophy, Users } from 'lucide-react';
import { getLeague } from '../data/leagues';
import { useLeaders, useSchedule, useStandings, useTeams } from '../data/queries';
import type { Game, LeaderCategory, LeaderKey, LeagueDef, LeagueSchedule } from '../data/types';
import { useI18n, type TKey } from '../i18n';
import { localDayOf, parseDayKey } from '../lib/time';
import { togglePinnedLeague, useFavorites, toggleFavoriteTeam, favKey, useFavoriteTeamKeys } from '../state/favorites';
import { GameRow } from '../components/games/GameRow';
import { StandingsTable } from '../components/tables/StandingsTable';
import { HeroCard, PageHeader, PageStack, PinButton } from '../components/layout/Page';
import { RouteTabs, StarButton } from '../components/ui/Controls';
import { Flag, LeagueBadge, PlayerPhoto, TeamLogo } from '../components/ui/Media';
import { Card, CardHeader, EmptyState, ErrorState, Skeleton } from '../components/ui/States';
import { NotFound } from './NotFound';
import s from './league.module.css';

interface Ctx {
  league: LeagueDef;
}
const useLeagueCtx = () => useOutletContext<Ctx>();

export function LeaguePage() {
  const { leagueId } = useParams();
  const league = getLeague(leagueId);
  const i18n = useI18n();
  const { t, lang } = i18n;
  const pinned = useFavorites((f) => f.leagues.includes(leagueId ?? ''));
  if (!league) return <NotFound title={t('leagueNotFound')} />;
  const base = `/lig/${league.id}`;
  const region = { tr: t('regionTr'), eu: t('regionEu'), us: t('regionUs'), world: t('regionWorld') }[league.region];
  return (
    <PageStack>
      <HeroCard>
        <PageHeader
          media={<LeagueBadge league={league} size={56} wide />}
          title={league.name[lang]}
          subtitle={
            <>
              <span className={s.region}>
                <Flag code={league.flag} size={16} />
                {region}
              </span>
              {league.gender === 'w' && <span>{t('women')}</span>}
              <span>{league.short}</span>
            </>
          }
          actions={<PinButton active={pinned} onToggle={() => togglePinnedLeague(league.id)} labelOn={t('unpinLeague')} labelOff={t('pinLeague')} />}
        />
        <RouteTabs
          label={league.name[lang]}
          items={[
            { to: base, label: t('tabFixtures'), end: true },
            { to: `${base}/puan-durumu`, label: t('tabStandings') },
            { to: `${base}/liderler`, label: t('tabLeaders') },
            { to: `${base}/takimlar`, label: t('tabTeams') },
          ]}
        />
      </HeroCard>
      <Outlet context={{ league }} />
    </PageStack>
  );
}

function roundText(sch: LeagueSchedule, id: string, label: string, i18n: ReturnType<typeof useI18n>) {
  if (sch.kind === 'date') {
    const d = parseDayKey(id);
    return `${i18n.dayLabel(id)} · ${i18n.dayMonth(d)}`;
  }
  if (/^\d+$/.test(label)) return sch.kind === 'week' ? i18n.t('weekN', { n: label }) : i18n.t('roundN', { n: label });
  return label;
}

function groupByDay(games: Game[]) {
  const out: Array<{ day: string; games: Game[] }> = [];
  for (const g of games) {
    const d = localDayOf(g.start);
    const last = out[out.length - 1];
    if (last && last.day === d) last.games.push(g);
    else out.push({ day: d, games: [g] });
  }
  return out;
}

export function LeagueFixtures() {
  const { league } = useLeagueCtx();
  const i18n = useI18n();
  const { t } = i18n;
  const [params, setParams] = useSearchParams();
  const round = params.get('tur') ?? undefined;
  const q = useSchedule(league.id, round);
  const favs = useFavoriteTeamKeys();
  const strip = useRef<HTMLDivElement>(null);
  const sch = q.data;

  useEffect(() => {
    strip.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [sch?.round]);

  const select = (id: string) => {
    const next = new URLSearchParams(params);
    next.set('tur', id);
    setParams(next, { replace: true });
  };
  const idx = sch ? sch.rounds.findIndex((r) => r.id === sch.round) : -1;

  return (
    <Card>
      {sch && sch.rounds.length > 0 && (
        <div className={s.rounds}>
          <button type="button" className={s.roundArrow} disabled={idx <= 0} onClick={() => idx > 0 && select(sch.rounds[idx - 1].id)} aria-label={t('prevDay')}>
            <ChevronLeft size={18} />
          </button>
          <div className={s.roundStrip} ref={strip}>
            {sch.rounds.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`${s.round} ${r.id === sch.round ? s.roundActive : ''}`}
                aria-current={r.id === sch.round}
                onClick={() => select(r.id)}
              >
                {roundText(sch, r.id, r.label, i18n)}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={s.roundArrow}
            disabled={idx < 0 || idx >= sch.rounds.length - 1}
            onClick={() => idx >= 0 && idx < sch.rounds.length - 1 && select(sch.rounds[idx + 1].id)}
            aria-label={t('nextDay')}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
      {q.isLoading ? (
        <div className={s.loading}>
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} w="100%" h={46} r={8} />
          ))}
        </div>
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : sch && sch.games.length ? (
        <div className={`${s.fixtures} ${q.isPlaceholderData ? s.stale : ''}`}>
          {groupByDay(sch.games).map((grp) => (
            <section key={grp.day} className={s.day}>
              <h3 className={s.dayTitle}>{i18n.dateLong(parseDayKey(grp.day).toISOString())}</h3>
              <div className={s.dayRows}>
                {grp.games.map((g) => (
                  <GameRow key={g.id} game={g} league={league} favorites={favs} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState icon={<ListOrdered size={22} />} title={t('noFixtures')} />
      )}
    </Card>
  );
}

export function LeagueStandings() {
  const { league } = useLeagueCtx();
  const { t } = useI18n();
  const q = useStandings(league.id);
  if (q.isLoading)
    return (
      <Card>
        <div className={s.loading}>
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} w="100%" h={34} r={6} />
          ))}
        </div>
      </Card>
    );
  if (q.isError) return <Card><ErrorState onRetry={() => q.refetch()} /></Card>;
  const groups = q.data ?? [];
  if (!groups.length) return <Card><EmptyState icon={<Trophy size={22} />} title={t('noStandings')} hint={t('noStandingsHint')} /></Card>;
  const past = groups[0].season;
  return (
    <Card>
      {past && <p className={s.note}>{t('seasonPastNote')}</p>}
      <StandingsTable groups={groups} league={league} />
    </Card>
  );
}

const LEADER_LABEL: Record<LeaderKey, TKey> = {
  pts: 'lPts',
  reb: 'lReb',
  ast: 'lAst',
  stl: 'lStl',
  blk: 'lBlk',
  eff: 'lEff',
  tpm: 'l3p',
  min: 'lMin',
};

function LeaderCard({ cat, league }: { cat: LeaderCategory; league: LeagueDef }) {
  const i18n = useI18n();
  const [first, ...rest] = cat.entries;
  return (
    <Card>
      <CardHeader title={i18n.t(LEADER_LABEL[cat.key])}>
        <span>{i18n.t('perGame')}</span>
      </CardHeader>
      {first && (
        <Link to={`/oyuncu/${league.id}/${encodeURIComponent(first.playerId)}`} className={s.leaderTop}>
          <PlayerPhoto src={first.photo} name={first.name} size={64} />
          <span className={s.leaderTopText}>
            <span className={s.leaderTopName}>{first.name}</span>
            {first.team && (
              <span className={s.leaderTeam}>
                <TeamLogo team={first.team} size={16} />
                {first.team.short ?? first.team.name}
              </span>
            )}
          </span>
          <span className={s.leaderTopValue}>{i18n.avg(first.value)}</span>
        </Link>
      )}
      <ol className={s.leaderList} start={2}>
        {rest.slice(0, 9).map((e, i) => (
          <li key={e.playerId + i}>
            <Link to={`/oyuncu/${league.id}/${encodeURIComponent(e.playerId)}`} className={s.leaderItem}>
              <span className={s.leaderRank}>{i + 2}</span>
              <PlayerPhoto src={e.photo} name={e.name} size={28} />
              <span className={s.leaderName}>
                {e.name}
                {e.team && <span className={s.leaderTeamSmall}>{e.team.short ?? e.team.name}</span>}
              </span>
              <span className={s.leaderValue}>{i18n.avg(e.value)}</span>
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function LeagueLeaders() {
  const { league } = useLeagueCtx();
  const { t } = useI18n();
  const q = useLeaders(league.id);
  if (q.isLoading)
    return (
      <div className={s.leadersGrid}>
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} w="100%" h={360} r={10} />
        ))}
      </div>
    );
  if (q.isError) return <Card><ErrorState onRetry={() => q.refetch()} /></Card>;
  const cats = q.data ?? [];
  if (!cats.length) return <Card><EmptyState icon={<Trophy size={22} />} title={t('noLeaders')} hint={t('noLeadersHint')} /></Card>;
  return (
    <div className={s.leadersGrid}>
      {cats.map((c) => (
        <LeaderCard key={c.key} cat={c} league={league} />
      ))}
    </div>
  );
}

export function LeagueTeams() {
  const { league } = useLeagueCtx();
  const { t } = useI18n();
  const q = useTeams(league.id);
  const favs = useFavoriteTeamKeys();
  if (q.isLoading)
    return (
      <div className={s.teamsGrid}>
        {Array.from({ length: 12 }, (_, i) => (
          <Skeleton key={i} w="100%" h={68} r={10} />
        ))}
      </div>
    );
  if (q.isError) return <Card><ErrorState onRetry={() => q.refetch()} /></Card>;
  const teams = q.data ?? [];
  if (!teams.length) return <Card><EmptyState icon={<Users size={22} />} title={t('noData')} /></Card>;
  return (
    <div className={s.teamsGrid}>
      {teams.map((team) => {
        const fav = favs.has(favKey(league.id, team.id));
        return (
          <Link key={team.id} to={`/takim/${league.id}/${encodeURIComponent(team.id)}`} className={s.teamTile}>
            <TeamLogo team={team} size={36} />
            <span className={s.teamTileName}>{team.name}</span>
            <StarButton size="sm" active={fav} onToggle={() => toggleFavoriteTeam(league.id, team)} labelOn={t('removeFavorite')} labelOff={t('addFavorite')} />
          </Link>
        );
      })}
    </div>
  );
}
