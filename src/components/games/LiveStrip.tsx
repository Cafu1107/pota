import { Link } from 'react-router';
import type { Game, LeagueDef, Side } from '../../data/types';
import { useI18n } from '../../i18n';
import { teamColors } from '../../lib/color';
import { useResolvedTheme } from '../../state/settings';
import { TeamLogo } from '../ui/Media';
import { LiveDot, RollingScore } from '../ui/Live';
import { gamePath } from './GameRow';
import s from './games.module.css';

/** Swipeable row of live games for phones and tablets. */
export function LiveStrip({ items }: { items: Array<{ game: Game; league: LeagueDef }> }) {
  const i18n = useI18n();
  const theme = useResolvedTheme();
  if (!items.length) return null;
  return (
    <section className={s.strip} aria-label={i18n.t('filterLive')}>
      <h2 className={s.stripTitle}>
        <LiveDot />
        {i18n.t('liveCount', { n: items.length })}
      </h2>
      <div className={`${s.stripScroller} ${items.length === 1 ? s.stripSingle : ''}`}>
        {items.map(({ game: g, league }) => {
          const colors = teamColors(g.home.team, g.away.team, theme);
          const st = i18n.statusShort(g, league);
          return (
            <Link key={g.id} to={gamePath(g)} className={s.stripCard}>
              <span className={s.stripBars} aria-hidden>
                <i style={{ background: colors.home }} />
                <i style={{ background: colors.away }} />
              </span>
              <span className={s.stripMeta}>
                <span className={s.stripLeague}>{league.short}</span>
                <span className={s.stripStatus}>
                  {st.top}
                  {st.bottom ? ` · ${st.bottom}` : ''}
                </span>
              </span>
              {(['home', 'away'] as Side[]).map((side) => (
                <span key={side} className={s.stripTeam}>
                  <TeamLogo team={g[side].team} size={22} />
                  <span className={s.stripName}>{g[side].team.short ?? g[side].team.name}</span>
                  <span className={s.stripScore}>
                    <RollingScore value={g[side].score} live />
                  </span>
                </span>
              ))}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
