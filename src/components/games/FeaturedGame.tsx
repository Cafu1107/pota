import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import type { Game, LeagueDef, Side } from '../../data/types';
import { useGame } from '../../data/queries';
import { useI18n } from '../../i18n';
import { teamColors, wash } from '../../lib/color';
import { useResolvedTheme } from '../../state/settings';
import { LeagueBadge, TeamLogo } from '../ui/Media';
import { LiveDot, RollingScore } from '../ui/Live';
import { MiniShots } from '../shots/ShotChart';
import { QuarterTable } from './QuarterTable';
import { gamePath } from './GameRow';
import s from './featured.module.css';

export type FeaturedKind = 'live' | 'next' | 'last';

export function FeaturedGame({ game, league, kind, compact }: { game: Game; league: LeagueDef; kind: FeaturedKind; compact?: boolean }) {
  const i18n = useI18n();
  const { t, lang } = i18n;
  const theme = useResolvedTheme();
  const detail = useGame(game.leagueId, game.status === 'scheduled' ? undefined : game.id);
  const g = detail.data?.game ?? game;
  const colors = teamColors(g.home.team, g.away.team, theme);
  const live = g.status === 'live';
  const title = kind === 'live' ? t('featuredLive') : kind === 'next' ? t('featuredNext') : t('featuredLast');

  const team = (side: Side) => (
    <div className={s.team}>
      <TeamLogo team={g[side].team} size={52} />
      <span className={s.teamName}>{g[side].team.short ?? g[side].team.name}</span>
    </div>
  );

  return (
    <section className={s.card} aria-label={title}>
      <header className={s.head}>
        <h2 className={s.title}>
          {live && <LiveDot />}
          {title}
        </h2>
        <Link to={`/lig/${league.id}`} className={s.league}>
          <LeagueBadge league={league} size={16} />
          {league.name[lang]}
        </Link>
      </header>
      <Link
        to={gamePath(g)}
        className={s.board}
        style={{ backgroundImage: `linear-gradient(100deg, ${wash(colors.home, 0.14)} 0%, transparent 42%, transparent 58%, ${wash(colors.away, 0.14)} 100%)` }}
      >
        {team('home')}
        <div className={s.center}>
          {g.status === 'scheduled' ? (
            <>
              <span className={s.time}>{g.timeTbd ? '–' : i18n.time(g.start)}</span>
              <span className={s.status}>{i18n.dateMedium(g.start)}</span>
            </>
          ) : (
            <>
              <span className={s.score}>
                <RollingScore value={g.home.score} live={live} />
                <span className={s.dash}>–</span>
                <RollingScore value={g.away.score} live={live} />
              </span>
              <span className={`${s.status} ${live ? s.statusLive : ''}`}>{i18n.statusLong(g, league)}</span>
            </>
          )}
        </div>
        {team('away')}
      </Link>
      <div className={s.bars} aria-hidden>
        <span style={{ background: colors.home }} />
        <span style={{ background: colors.away }} />
      </div>
      {g.home.periods.length > 0 && (
        <div className={s.quarters}>
          <QuarterTable game={g} league={league} compact />
        </div>
      )}
      {!compact && detail.data && (detail.data.shots?.length ?? 0) > 0 && (
        <div className={s.shots}>
          <MiniShots detail={detail.data} league={league} colors={colors} />
        </div>
      )}
      <Link to={gamePath(g)} className={s.cta}>
        {t('goToGame')}
        <ArrowRight size={16} aria-hidden />
      </Link>
    </section>
  );
}
