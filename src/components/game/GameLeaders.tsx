import { Link } from 'react-router';
import type { Game, GameLeader, Side } from '../../data/types';
import { useI18n, type TKey } from '../../i18n';
import { PlayerPhoto } from '../ui/Media';
import s from './game.module.css';

const ORDER: Array<{ key: GameLeader['key']; label: TKey }> = [
  { key: 'pts', label: 'lPts' },
  { key: 'reb', label: 'lReb' },
  { key: 'ast', label: 'lAst' },
  { key: 'eff', label: 'lEff' },
];

export function GameLeaders({ leaders, game }: { leaders: GameLeader[]; game: Game }) {
  const { t, num } = useI18n();
  const rows = ORDER.map((o) => ({
    ...o,
    home: leaders.find((l) => l.key === o.key && l.side === 'home'),
    away: leaders.find((l) => l.key === o.key && l.side === 'away'),
  })).filter((r) => r.home || r.away);
  if (!rows.length) return null;

  const cell = (l: GameLeader | undefined, side: Side) => {
    if (!l) return <span className={s.leaderEmpty}>–</span>;
    const inner = (
      <>
        <PlayerPhoto src={l.photo} name={l.name} size={40} />
        <span className={s.leaderName}>{l.name}</span>
        <span className={s.leaderValue}>{num(l.value)}</span>
      </>
    );
    const cls = `${s.leader} ${side === 'away' ? s.leaderAway : ''}`;
    return l.playerId ? (
      <Link to={`/oyuncu/${game.leagueId}/${encodeURIComponent(l.playerId)}`} className={cls}>
        {inner}
      </Link>
    ) : (
      <span className={cls}>{inner}</span>
    );
  };

  return (
    <div className={s.leaders}>
      {rows.map((r) => (
        <div key={r.key} className={s.leaderRow}>
          {cell(r.home, 'home')}
          <span className={s.leaderLabel}>{t(r.label)}</span>
          {cell(r.away, 'away')}
        </div>
      ))}
    </div>
  );
}
