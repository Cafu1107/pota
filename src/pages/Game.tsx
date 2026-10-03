import { Link, Outlet, useOutletContext, useParams } from 'react-router';
import { Clock3, Crosshair, ListOrdered, Users } from 'lucide-react';
import { getLeague } from '../data/leagues';
import { useGame, useGameHistory } from '../data/queries';
import type { GameDetail, LeagueDef, Side } from '../data/types';
import { useI18n } from '../i18n';
import { teamColors, wash, type TeamColors } from '../lib/color';
import { useNow } from '../lib/hooks';
import { useResolvedTheme } from '../state/settings';
import { QuarterTable } from '../components/games/QuarterTable';
import { LeadTracker } from '../components/game/LeadTracker';
import { TeamCompare } from '../components/game/TeamCompare';
import { GameLeaders } from '../components/game/GameLeaders';
import { FormCompare, H2HMeetings, H2HSkeleton, H2HSummary, SeasonCompare } from '../components/game/HeadToHead';
import { Comments } from '../components/game/Comments';
import { GameVideo } from '../components/video/Video';
import { commentKey, useComments } from '../data/comments';
import { BoxScore } from '../components/game/BoxScore';
import { PlayByPlay } from '../components/game/PlayByPlay';
import { ShotChart } from '../components/shots/ShotChart';
import { RouteTabs } from '../components/ui/Controls';
import { LeagueBadge, TeamLogo } from '../components/ui/Media';
import { LiveDot, RollingScore } from '../components/ui/Live';
import { Card, CardHeader, EmptyState, ErrorState, Skeleton } from '../components/ui/States';
import { NotFound } from './NotFound';
import s from '../components/game/game.module.css';

interface Ctx {
  detail: GameDetail;
  league: LeagueDef;
  colors: TeamColors;
}

const useGameCtx = () => useOutletContext<Ctx>();

function Freshness({ updatedAt }: { updatedAt: number }) {
  const { t } = useI18n();
  const now = useNow(1000);
  const sec = Math.max(0, Math.round((now - updatedAt) / 1000));
  return (
    <span className={s.fresh}>
      <LiveDot />
      {t('liveUpdating')} · {sec < 3 ? t('updatedJustNow') : t('updatedAgo', { s: sec })}
    </span>
  );
}

function GameHeader({ detail, league, colors }: Ctx) {
  const i18n = useI18n();
  const { t, lang } = i18n;
  const g = detail.game;
  const live = g.status === 'live';
  const team = (side: Side) => {
    const sd = g[side];
    const won = g.status === 'final' && sd.winner;
    return (
      <Link to={`/takim/${league.id}/${encodeURIComponent(sd.team.id)}`} className={`${s.hTeam} ${side === 'away' ? s.hTeamAway : ''}`}>
        <TeamLogo team={sd.team} size={72} className={s.hLogo} />
        <span className={`${s.hTeamName} ${won ? s.hWinner : ''}`}>{sd.team.name}</span>
        {sd.record && <span className={s.hRecord}>{sd.record}</span>}
      </Link>
    );
  };
  return (
    <section
      className={s.header}
      style={{
        backgroundImage: `linear-gradient(105deg, ${wash(colors.home, 0.16)} 0%, ${wash(colors.home, 0.04)} 38%, ${wash(colors.away, 0.04)} 62%, ${wash(colors.away, 0.16)} 100%)`,
      }}
    >
      <div className={s.hMeta}>
        <Link to={`/lig/${league.id}`} className={s.hLeague}>
          <LeagueBadge league={league} size={18} />
          {league.name[lang]}
        </Link>
        {g.round && <span>{i18n.roundLabel(g.round)}</span>}
        <span>{i18n.dateMedium(g.start)}</span>
      </div>
      <div className={s.hBoard}>
        {team('home')}
        <div className={s.hCenter}>
          {g.status === 'scheduled' || g.status === 'postponed' || g.status === 'cancelled' ? (
            <>
              <span className={s.hTime}>{g.timeTbd ? '–' : i18n.time(g.start)}</span>
              <span className={s.hStatus}>{g.status === 'scheduled' ? t('startsIn', { t: i18n.relativeIn(g.start) }) : i18n.statusLong(g, league)}</span>
            </>
          ) : (
            <>
              <span className={s.hScore}>
                <span className={g.status === 'final' && g.home.winner === false ? s.hLoser : undefined}>
                  <RollingScore value={g.home.score} live={live} />
                </span>
                <span className={s.hDash}>–</span>
                <span className={g.status === 'final' && g.away.winner === false ? s.hLoser : undefined}>
                  <RollingScore value={g.away.score} live={live} />
                </span>
              </span>
              <span className={`${s.hStatus} ${live ? s.hStatusLive : ''}`}>
                {live && <LiveDot />}
                {i18n.statusLong(g, league)}
              </span>
            </>
          )}
        </div>
        {team('away')}
      </div>
      <div className={s.hBars} aria-hidden>
        <span style={{ background: colors.home }} />
        <span style={{ background: colors.away }} />
      </div>
      {(g.home.periods.length > 0 || g.away.periods.length > 0) && (
        <div className={s.hQuarters}>
          <QuarterTable game={g} league={league} />
        </div>
      )}
      {live && <Freshness updatedAt={detail.updatedAt} />}
    </section>
  );
}

/** Same footprint as the loaded page (header card, tabs, first panel) so nothing jumps. */
function GameSkeleton() {
  return (
    <div className={s.page} aria-busy="true">
      <div className={s.headerCard}>
        <section className={`${s.header} ${s.headerSkel}`}>
          <div className={s.hMeta}>
            <Skeleton w={180} h={12} />
          </div>
          <div className={s.hBoard}>
            <div className={s.hTeam}>
              <Skeleton w={72} h={72} r={36} />
              <Skeleton w={120} h={14} />
            </div>
            <div className={s.hCenter}>
              <Skeleton w={150} h={44} r={8} />
            </div>
            <div className={s.hTeam}>
              <Skeleton w={72} h={72} r={36} />
              <Skeleton w={120} h={14} />
            </div>
          </div>
          <div className={s.skelQuarters}>
            <Skeleton w="100%" h={56} r={8} />
          </div>
        </section>
        <div className={s.skelTabs}>
          {[64, 72, 88, 76].map((w, i) => (
            <Skeleton key={i} w={w} h={12} />
          ))}
        </div>
      </div>
      <Card>
        <div className={s.skelPanel}>
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} w="100%" h={30} r={6} />
          ))}
        </div>
      </Card>
    </div>
  );
}

export function GamePage() {
  const { leagueId, gameId } = useParams();
  const league = getLeague(leagueId);
  const { t } = useI18n();
  const theme = useResolvedTheme();
  const q = useGame(leagueId, gameId);
  const comments = useComments(q.data ? commentKey(q.data.game) : undefined);
  if (!league) return <NotFound title={t('leagueNotFound')} />;
  if (q.isLoading) return <GameSkeleton />;
  if (q.isError || !q.data) return <ErrorState onRetry={() => q.refetch()} title={t('gameNotFound')} />;
  const detail = q.data;
  const colors = teamColors(detail.game.home.team, detail.game.away.team, theme);
  const base = `/mac/${league.id}/${encodeURIComponent(detail.game.id)}`;
  const tabs = [
    { to: base, label: t('tabSummary'), end: true },
    { to: `${base}/box-score`, label: t('tabBox') },
    { to: `${base}/mac-akisi`, label: t('tabPlays') },
    { to: `${base}/sut-haritasi`, label: t('tabShots') },
  ];
  tabs.push({ to: `${base}/karsilasmalar`, label: t('tabMeetings') });
  const commentTotal = comments.data?.total ?? 0;
  tabs.push({ to: `${base}/yorumlar`, label: commentTotal ? `${t('tabComments')} (${commentTotal})` : t('tabComments') });
  const ctx: Ctx = { detail, league, colors };
  return (
    <div className={s.page}>
      <h1 className="sr-only">
        {detail.game.home.team.name} – {detail.game.away.team.name}
      </h1>
      <div className={s.headerCard}>
        <GameHeader {...ctx} />
        <RouteTabs items={tabs} label={t('tabSummary')} />
      </div>
      <div className={s.panel}>
        <Outlet context={ctx} />
      </div>
    </div>
  );
}

// ---------- tabs ----------

function NotStarted() {
  const { t } = useI18n();
  return <EmptyState icon={<Clock3 size={22} />} title={t('notStartedYet')} hint={t('notStartedHint')} />;
}

function GameInfo({ detail, league }: { detail: GameDetail; league: LeagueDef }) {
  const i18n = useI18n();
  const { t } = i18n;
  const g = detail.game;
  const items: Array<[string, string]> = [];
  items.push([t('dateLabel'), `${i18n.dateLong(g.start)}${g.timeTbd ? '' : ' · ' + i18n.time(g.start)}`]);
  if (g.round) items.push([t('round'), i18n.roundLabel(g.round)]);
  if (g.venue) items.push([t('venue'), g.venue]);
  if (g.city) items.push([t('city'), g.city]);
  if (detail.attendance) items.push([t('attendance'), i18n.num(detail.attendance)]);
  if (detail.coaches?.home || detail.coaches?.away)
    items.push([t('coach'), [detail.coaches?.home, detail.coaches?.away].filter(Boolean).join(' · ')]);
  if (detail.officials?.length) items.push([t('officials'), detail.officials.join(', ')]);
  if (g.broadcast) items.push([t('broadcast'), g.broadcast]);
  return (
    <Card>
      <CardHeader title={t('gameInfo')}>
        <span>{league.short}</span>
      </CardHeader>
      <dl className={s.info}>
        {items.map(([k, v]) => (
          <div key={k} className={s.infoRow}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

export function GameSummary() {
  const { detail, league, colors } = useGameCtx();
  const { t } = useI18n();
  const g = detail.game;
  const started = g.status === 'live' || g.status === 'final';
  if (!started) {
    return (
      <div className={s.grid}>
        <div className={s.colMain}>
          <GameVideo game={g} />
          <PreGame />
        </div>
        <div className={s.colSide}>
          <GameInfo detail={detail} league={league} />
          <SeasonCompare game={g} league={league} />
        </div>
      </div>
    );
  }
  const hasTimeline = (detail.plays ?? []).some((p) => p.homeScore !== undefined);
  return (
    <div className={s.grid}>
      <div className={s.colMain}>
        <GameVideo game={g} />
        {hasTimeline && (
          <Card>
            <CardHeader title={t('leadTracker')}>
              <span className={s.hint}>{t('leadTrackerHint')}</span>
            </CardHeader>
            <LeadTracker plays={detail.plays ?? []} game={g} league={league} colors={colors} />
          </Card>
        )}
        {detail.compare && detail.compare.length > 0 && (
          <Card>
            <CardHeader title={t('teamStats')} />
            <TeamCompare rows={detail.compare} game={g} colors={colors} />
          </Card>
        )}
      </div>
      <div className={s.colSide}>
        {detail.leaders && detail.leaders.length > 0 && (
          <Card>
            <CardHeader title={t('gameLeaders')} />
            <GameLeaders leaders={detail.leaders} game={g} />
          </Card>
        )}
        <GameInfo detail={detail} league={league} />
      </div>
    </div>
  );
}

export function GameBox() {
  const { detail, league } = useGameCtx();
  const { t } = useI18n();
  if (!detail.box) {
    return (
      <Card>
        {detail.game.status === 'scheduled' ? <NotStarted /> : <EmptyState icon={<Users size={22} />} title={t('noBoxScore')} hint={t('noBoxScoreHint')} />}
      </Card>
    );
  }
  return (
    <Card>
      <BoxScore box={detail.box} game={detail.game} league={league} />
    </Card>
  );
}

export function GamePlays() {
  const { detail, league } = useGameCtx();
  const { t } = useI18n();
  if (!detail.plays?.length) {
    return <Card>{detail.game.status === 'scheduled' ? <NotStarted /> : <EmptyState icon={<ListOrdered size={22} />} title={t('noPlays')} hint={t('noPlaysHint')} />}</Card>;
  }
  return (
    <Card>
      <PlayByPlay detail={detail} league={league} />
    </Card>
  );
}

export function GameShots() {
  const { detail, league, colors } = useGameCtx();
  const { t } = useI18n();
  if (!detail.shots?.length) {
    return <Card>{detail.game.status === 'scheduled' ? <NotStarted /> : <EmptyState icon={<Crosshair size={22} />} title={t('noShots')} hint={t('noShotsHint')} />}</Card>;
  }
  return (
    <Card>
      <div className={s.cardPad}>
        <ShotChart detail={detail} league={league} colors={colors} />
      </div>
    </Card>
  );
}

/** Head to head before tip-off: the record between the teams and their form. */
function PreGame() {
  const { detail, league, colors } = useGameCtx();
  const q = useGameHistory(detail.game);
  const base = `/mac/${league.id}/${encodeURIComponent(detail.game.id)}`;
  if (q.isLoading) return <H2HSkeleton />;
  if (!q.data) return <Card><NotStarted /></Card>;
  return (
    <>
      <H2HSummary game={detail.game} history={q.data} colors={colors} linkAll={`${base}/karsilasmalar`} />
      <FormCompare game={detail.game} history={q.data} league={league} />
    </>
  );
}

export function GameMeetings() {
  const { detail, league, colors } = useGameCtx();
  const { t } = useI18n();
  const q = useGameHistory(detail.game);
  if (q.isLoading) {
    return (
      <div className={s.grid}>
        <div className={s.colMain}>
          <H2HSkeleton />
        </div>
      </div>
    );
  }
  if (!q.data) {
    return (
      <Card>
        <ErrorState onRetry={() => q.refetch()} title={t('h2hError')} />
      </Card>
    );
  }
  return (
    <div className={s.grid}>
      <div className={s.colMain}>
        <H2HSummary game={detail.game} history={q.data} colors={colors} />
        <FormCompare game={detail.game} history={q.data} league={league} />
      </div>
      <div className={s.colSide}>
        <SeasonCompare game={detail.game} league={league} />
        <H2HMeetings history={q.data} league={league} />
      </div>
    </div>
  );
}

export function GameComments() {
  const { detail } = useGameCtx();
  return <Comments game={detail.game} />;
}
