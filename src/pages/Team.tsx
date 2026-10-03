import { Link, Outlet, useOutletContext, useParams } from 'react-router';
import { CalendarClock, Users } from 'lucide-react';
import { getLeague } from '../data/leagues';
import { useTeam } from '../data/queries';
import type { Game, LeagueDef, Side, TeamDetail, TeamSeasonStat } from '../data/types';
import { useI18n, type TKey } from '../i18n';
import { teamColor, wash } from '../lib/color';
import { favKey, toggleFavoriteTeam, useFavoriteTeamKeys } from '../state/favorites';
import { useResolvedTheme } from '../state/settings';
import { GameRow, gamePath } from '../components/games/GameRow';
import { HeroCard, PageHeader, PageStack, StatTile, TileGrid } from '../components/layout/Page';
import { RouteTabs, StarButton } from '../components/ui/Controls';
import { LeagueBadge, PlayerPhoto, TeamLogo } from '../components/ui/Media';
import { Card, CardHeader, EmptyState, ErrorState, Skeleton } from '../components/ui/States';
import { NotFound } from './NotFound';
import t from '../components/tables/tables.module.css';
import s from './team.module.css';

interface Ctx {
  team: TeamDetail;
  league: LeagueDef;
}
const useTeamCtx = () => useOutletContext<Ctx>();

const STAT_LABEL: Record<TeamSeasonStat['key'], TKey> = {
  pts: 'lPts',
  reb: 'lReb',
  ast: 'lAst',
  stl: 'lStl',
  blk: 'lBlk',
  tov: 'lTov',
  fgPct: 'lFgPct',
  tpPct: 'l3pPct',
  ftPct: 'lFtPct',
  eff: 'lEff',
  opp: 'lOpp',
};

export function TeamPage() {
  const { leagueId, teamId } = useParams();
  const league = getLeague(leagueId);
  const i18n = useI18n();
  const { lang } = i18n;
  const theme = useResolvedTheme();
  const favs = useFavoriteTeamKeys();
  const q = useTeam(leagueId, teamId);
  if (!league) return <NotFound title={i18n.t('leagueNotFound')} />;
  if (q.isLoading)
    return (
      <PageStack>
        <HeroCard>
          <div className={s.skelHead}>
            <Skeleton w={80} h={80} r={40} />
            <div className={s.skelText}>
              <Skeleton w={220} h={22} />
              <Skeleton w={140} h={12} />
            </div>
          </div>
        </HeroCard>
      </PageStack>
    );
  if (q.isError || !q.data) return <ErrorState onRetry={() => q.refetch()} title={i18n.t('teamNotFound')} />;
  const team = q.data;
  const color = teamColor(team.team, theme);
  const fav = favs.has(favKey(league.id, team.team.id));
  const base = `/takim/${league.id}/${encodeURIComponent(team.team.id)}`;
  return (
    <PageStack>
      <HeroCard>
        <PageHeader
          style={{ backgroundImage: `linear-gradient(100deg, ${wash(color, 0.18)} 0%, ${wash(color, 0.04)} 55%, transparent 100%)` }}
          media={<TeamLogo team={team.team} size={84} />}
          title={team.team.name}
          subtitle={
            <Link to={`/lig/${league.id}`} className={s.league}>
              <LeagueBadge league={league} size={18} />
              {league.name[lang]}
            </Link>
          }
          meta={
            <>
              {team.record && (
                <span>
                  <strong className={s.metaStrong}>
                    {team.record.w}-{team.record.l}
                  </strong>{' '}
                  {i18n.t('record')}
                </span>
              )}
              {team.standing?.rank ? <span>{team.standing.group && !/^\d/.test(team.standing.group) ? team.standing.group : i18n.t('rankInLeague', { n: team.standing.rank })}</span> : null}
              {team.city && <span>{team.city}</span>}
            </>
          }
          actions={
            <StarButton active={fav} onToggle={() => toggleFavoriteTeam(league.id, team.team)} labelOn={i18n.t('removeFavorite')} labelOff={i18n.t('addFavorite')} />
          }
        />
        <div className={s.bar} style={{ background: color }} aria-hidden />
        <RouteTabs
          label={team.team.name}
          items={[
            { to: base, label: i18n.t('tabOverview'), end: true },
            { to: `${base}/kadro`, label: i18n.t('tabRoster') },
            { to: `${base}/maclar`, label: i18n.t('tabGames') },
          ]}
        />
      </HeroCard>
      <Outlet context={{ team, league }} />
    </PageStack>
  );
}

function NextGame({ game, team, league }: { game: Game; team: TeamDetail; league: LeagueDef }) {
  const i18n = useI18n();
  const mine: Side = game.home.team.id === team.team.id ? 'home' : 'away';
  const opp = game[mine === 'home' ? 'away' : 'home'].team;
  return (
    <Link to={gamePath(game)} className={s.next}>
      <TeamLogo team={opp} size={44} />
      <span className={s.nextText}>
        <span className={s.nextOpp}>
          {mine === 'home' ? i18n.t('vs') : i18n.t('at')} {opp.name}
        </span>
        <span className={s.nextWhen}>
          {i18n.dateLong(game.start)}
          {game.timeTbd ? '' : ` · ${i18n.time(game.start)}`}
        </span>
        {game.venue && <span className={s.nextVenue}>{game.venue}</span>}
      </span>
      {game.status === 'live' ? (
        <span className={`${s.nextBadge} ${s.nextLive}`}>
          {game[mine].score}-{game[mine === 'home' ? 'away' : 'home'].score} · {i18n.statusShort(game, league).top}
        </span>
      ) : (
        <span className={s.nextBadge}>{i18n.relativeIn(game.start)}</span>
      )}
    </Link>
  );
}

export function TeamOverview() {
  const { team, league } = useTeamCtx();
  const i18n = useI18n();
  const { t } = i18n;
  const favs = useFavoriteTeamKeys();
  const now = Date.now();
  const upcoming = team.games.filter((g) => g.status === 'live' || (g.status === 'scheduled' && new Date(g.start).getTime() > now - 3 * 3600_000));
  const results = team.games.filter((g) => g.status === 'final').slice(-5).reverse();
  const next = upcoming[0];
  const topScorers = [...team.roster].filter((p) => p.ppg !== undefined && (p.gp ?? 0) > 0).sort((a, b) => (b.ppg ?? 0) - (a.ppg ?? 0)).slice(0, 5);
  const info: Array<[string, string]> = [];
  if (team.coach) info.push([t('coach'), team.coach]);
  if (team.venue) info.push([t('venue'), team.venue]);
  if (team.capacity) info.push([t('capacity'), i18n.num(team.capacity)]);
  if (team.city) info.push([t('city'), team.city]);
  if (team.founded) info.push([t('founded'), team.founded]);
  return (
    <div className={s.grid}>
      <div className={s.colMain}>
        {next && (
          <Card>
            <CardHeader title={next.status === 'live' ? t('featuredLive') : t('nextGame')} />
            <NextGame game={next} team={team} league={league} />
          </Card>
        )}
        <Card>
          <CardHeader title={t('lastGames')} />
          {results.length ? (
            <div className={s.rows}>
              {results.map((g) => (
                <GameRow key={g.id} game={g} league={league} favorites={favs} showLeague={false} />
              ))}
            </div>
          ) : (
            <EmptyState icon={<CalendarClock size={22} />} title={t('noGames')} />
          )}
        </Card>
        {team.stats && team.stats.length > 0 && (
          <Card>
            <CardHeader title={t('seasonStats')}>
              <span>{t('perGame')}</span>
            </CardHeader>
            <TileGrid>
              {team.stats.map((st) => (
                <StatTile key={st.key} label={t(STAT_LABEL[st.key])} value={st.key.endsWith('Pct') ? i18n.pct(st.value) : i18n.avg(st.value)} />
              ))}
            </TileGrid>
          </Card>
        )}
      </div>
      <div className={s.colSide}>
        {topScorers.length > 0 && (
          <Card>
            <CardHeader title={t('lPts')}>
              <span>{t('perGame')}</span>
            </CardHeader>
            <ol className={s.scorers}>
              {topScorers.map((p) => (
                <li key={p.id}>
                  <Link to={`/oyuncu/${league.id}/${encodeURIComponent(p.id)}`} className={s.scorer}>
                    <PlayerPhoto src={p.photo} name={p.name} size={34} />
                    <span className={s.scorerName}>{p.name}</span>
                    <span className={s.scorerValue}>{i18n.avg(p.ppg)}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </Card>
        )}
        {info.length > 0 && (
          <Card>
            <CardHeader title={t('teamInfo')} />
            <dl className={s.info}>
              {info.map(([k, v]) => (
                <div key={k} className={s.infoRow}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
        )}
        {team.staff && team.staff.length > 0 && (
          <Card>
            <CardHeader title={t('staff')} />
            <ul className={s.staff}>
              {team.staff.slice(0, 8).map((m) => (
                <li key={m.name + m.role}>
                  <PlayerPhoto src={m.photo} name={m.name} size={30} />
                  <span>
                    <strong>{m.name}</strong>
                    <small>{m.role}</small>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}

export function TeamRoster() {
  const { team, league } = useTeamCtx();
  const i18n = useI18n();
  const { t: tr } = i18n;
  const roster = team.roster;
  if (!roster.length) return <Card><EmptyState icon={<Users size={22} />} title={tr('noRoster')} /></Card>;
  const has = (k: 'position' | 'height' | 'weight' | 'age' | 'nationality' | 'ppg') => roster.some((p) => p[k] !== undefined && p[k] !== '');
  return (
    <Card>
      <div className={t.scroll}>
        <table className={`${t.table} ${s.roster}`}>
          <thead>
            <tr>
              <th scope="col" className={s.numCol}>
                {tr('sNo')}
              </th>
              <th scope="col" className={s.playerCol}>
                {tr('colPlayer')}
              </th>
              {has('position') && <th scope="col">{tr('position')}</th>}
              {has('height') && <th scope="col">{tr('height')}</th>}
              {has('weight') && <th scope="col" className={t.wide}>{tr('weight')}</th>}
              {has('age') && <th scope="col">{tr('age')}</th>}
              {has('nationality') && <th scope="col" className={t.wide}>{tr('nationality')}</th>}
              {has('ppg') && (
                <>
                  <th scope="col" title={tr('lGp')}>{tr('sGp')}</th>
                  <th scope="col" title={tr('lPts')}>{tr('sPts')}</th>
                  <th scope="col" title={tr('lReb')}>{tr('sReb')}</th>
                  <th scope="col" title={tr('lAst')}>{tr('sAst')}</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {roster.map((p) => (
              <tr key={p.id}>
                <td className={s.numCol}>{p.number ?? ''}</td>
                <th scope="row" className={s.playerCol}>
                  <Link to={`/oyuncu/${league.id}/${encodeURIComponent(p.id)}`} className={s.player}>
                    <PlayerPhoto src={p.photo} name={p.name} size={36} />
                    <span>{p.name}</span>
                  </Link>
                </th>
                {has('position') && <td>{p.position ?? '–'}</td>}
                {has('height') && <td>{p.height ? `${p.height} cm` : '–'}</td>}
                {has('weight') && <td className={t.wide}>{p.weight ? `${p.weight} kg` : '–'}</td>}
                {has('age') && <td>{p.age ?? '–'}</td>}
                {has('nationality') && <td className={t.wide}>{p.nationality ?? '–'}</td>}
                {has('ppg') && (
                  <>
                    <td>{p.gp ?? '–'}</td>
                    <td className={t.strong}>{i18n.avg(p.ppg)}</td>
                    <td>{i18n.avg(p.rpg)}</td>
                    <td>{i18n.avg(p.apg)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function TeamGames() {
  const { team, league } = useTeamCtx();
  const { t } = useI18n();
  const favs = useFavoriteTeamKeys();
  const now = Date.now();
  const upcoming = team.games.filter((g) => g.status === 'live' || (g.status === 'scheduled' && new Date(g.start).getTime() > now - 3 * 3600_000));
  const results = team.games.filter((g) => g.status === 'final').reverse();
  if (!team.games.length) return <Card><EmptyState icon={<CalendarClock size={22} />} title={t('noGames')} /></Card>;
  return (
    <div className={s.gamesGrid}>
      {upcoming.length > 0 && (
        <Card>
          <CardHeader title={t('upcoming')} />
          <div className={s.rows}>
            {upcoming.map((g) => (
              <GameRow key={g.id} game={g} league={league} favorites={favs} />
            ))}
          </div>
        </Card>
      )}
      {results.length > 0 && (
        <Card>
          <CardHeader title={t('results')} />
          <div className={s.rows}>
            {results.map((g) => (
              <GameRow key={g.id} game={g} league={league} favorites={favs} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
