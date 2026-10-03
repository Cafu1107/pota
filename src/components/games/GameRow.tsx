import { memo } from 'react';
import { Link } from 'react-router';
import { Star } from 'lucide-react';
import type { Game, LeagueDef, Side } from '../../data/types';
import { useI18n } from '../../i18n';
import { usePrefetch } from '../../data/queries';
import { TeamLogo } from '../ui/Media';
import { LiveDot, RollingScore, useFlashOnIncrease } from '../ui/Live';
import s from './games.module.css';

export function gamePath(g: Pick<Game, 'leagueId' | 'id'>) {
  return `/mac/${g.leagueId}/${encodeURIComponent(g.id)}`;
}

interface Props {
  game: Game;
  league?: LeagueDef;
  favorites?: Set<string>;
  showLeague?: boolean;
  compact?: boolean;
}

function GameRowBase({ game: g, league, favorites, showLeague, compact }: Props) {
  const i18n = useI18n();
  const prefetch = usePrefetch();
  const warm = () => prefetch.game(g.leagueId, g.id);
  const live = g.status === 'live';
  const final = g.status === 'final';
  const total = (g.home.score ?? 0) + (g.away.score ?? 0);
  const flash = useFlashOnIncrease(total, live);
  const st = i18n.statusShort(g, league);
  const maxPeriods = Math.max(g.home.periods.length, g.away.periods.length);

  const label = [
    g.home.team.name,
    g.home.score ?? '',
    '–',
    g.away.score ?? '',
    g.away.team.name,
    ',',
    g.status === 'scheduled' ? i18n.time(g.start) : i18n.statusLong(g, league),
  ].join(' ');

  const teamLine = (side: Side) => {
    const sd = g[side];
    const fav = favorites?.has(`${g.leagueId}:${sd.team.id}`);
    const lost = final && sd.winner === false;
    return (
      <div className={`${s.teamLine} ${lost ? s.lost : ''} ${final && sd.winner ? s.won : ''}`}>
        <TeamLogo team={sd.team} size={compact ? 18 : 20} />
        <span className={s.teamName}>{sd.team.short && sd.team.name.length > 22 ? sd.team.short : sd.team.name}</span>
        {fav && <Star aria-hidden size={12} className={s.favMark} fill="currentColor" strokeWidth={0} />}
      </div>
    );
  };

  return (
    <Link
      to={gamePath(g)}
      className={`${s.row} ${live ? s.rowLive : ''} ${flash ? s.flash : ''} ${compact ? s.rowCompact : ''}`}
      aria-label={label}
      onPointerEnter={warm}
      onFocus={warm}
      onTouchStart={warm}
    >
      <div className={`${s.status} ${live ? s.statusLive : ''}`}>
        {live ? (
          <>
            <span className={s.statusTop}>
              <LiveDot />
              {st.top}
            </span>
            {st.bottom && <span className={s.statusBottom}>{st.bottom}</span>}
          </>
        ) : (
          <>
            <span className={`${s.statusTop} ${g.status === 'scheduled' ? s.statusTime : ''}`}>{st.top}</span>
            {showLeague && league && <span className={s.statusLeague}>{league.short}</span>}
          </>
        )}
      </div>
      <div className={s.teams}>
        {teamLine('home')}
        {teamLine('away')}
      </div>
      {maxPeriods > 0 && (
        <div className={s.periods} aria-hidden style={{ gridTemplateColumns: `repeat(${maxPeriods}, minmax(22px, auto))` }}>
          {(['home', 'away'] as Side[]).map((side) =>
            Array.from({ length: maxPeriods }, (_, i) => (
              <span key={`${side}${i}`} className={s.period}>
                {g[side].periods[i] ?? ''}
              </span>
            )),
          )}
        </div>
      )}
      <div className={s.scores} aria-hidden>
        {(['home', 'away'] as Side[]).map((side) => (
          <span key={side} className={`${s.score} ${final && g[side].winner ? s.scoreWin : ''} ${final && g[side].winner === false ? s.scoreLost : ''}`}>
            {g[side].score !== null ? <RollingScore value={g[side].score} live={live} /> : ''}
          </span>
        ))}
      </div>
    </Link>
  );
}

export const GameRow = memo(GameRowBase);
