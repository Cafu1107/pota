import type { Game, LeagueDef, Side } from '../../data/types';
import { useI18n } from '../../i18n';
import { TeamLogo } from '../ui/Media';
import s from './games.module.css';

/** Points per period for both teams, with the running total. */
export function QuarterTable({ game, league, compact }: { game: Game; league?: LeagueDef; compact?: boolean }) {
  const i18n = useI18n();
  const regs = league?.periods ?? 4;
  const n = Math.max(regs, game.home.periods.length, game.away.periods.length);
  if (!game.home.periods.length && !game.away.periods.length) return null;
  const cols = Array.from({ length: n }, (_, i) => i + 1);
  const current = game.status === 'live' ? game.period : undefined;
  return (
    <table className={`${s.qTable} ${compact ? s.qCompact : ''}`}>
      <caption className="sr-only">{i18n.t('quarterScores')}</caption>
      <thead>
        <tr>
          <th scope="col" className={s.qTeamHead}>
            <span className="sr-only">{i18n.t('colTeam')}</span>
          </th>
          {cols.map((p) => (
            <th key={p} scope="col" className={p === current ? s.qCurrent : undefined}>
              {i18n.period(league, p)}
            </th>
          ))}
          <th scope="col" className={s.qTotal}>
            {compact ? 'T' : i18n.t('total')}
          </th>
        </tr>
      </thead>
      <tbody>
        {(['home', 'away'] as Side[]).map((side) => {
          const sd = game[side];
          return (
            <tr key={side}>
              <th scope="row" className={s.qTeam}>
                <TeamLogo team={sd.team} size={18} />
                <span className={s.qTeamName}>{sd.team.abbr && sd.team.abbr.length <= 4 ? sd.team.abbr : sd.team.short ?? sd.team.name}</span>
              </th>
              {cols.map((p) => {
                const v = sd.periods[p - 1];
                const other = (side === 'home' ? game.away : game.home).periods[p - 1];
                const won = v !== undefined && other !== undefined && v > other;
                return (
                  <td key={p} className={`${p === current ? s.qCurrent : ''} ${won ? s.qWon : ''}`}>
                    {v ?? ''}
                  </td>
                );
              })}
              <td className={`${s.qTotal} ${sd.winner ? s.qWon : ''}`}>{sd.score ?? ''}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
