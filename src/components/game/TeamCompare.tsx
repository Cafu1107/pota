import type { CompareKey, Game, TeamCompareRow } from '../../data/types';
import { useI18n, type TKey } from '../../i18n';
import type { TeamColors } from '../../lib/color';
import s from './game.module.css';

export const COMPARE_LABEL: Record<CompareKey, TKey> = {
  pts: 'lPts',
  fg: 'lFg',
  fgPct: 'lFgPct',
  twoPct: 'l2p',
  tp: 'l3p',
  tpPct: 'l3pPct',
  ft: 'lFt',
  ftPct: 'lFtPct',
  reb: 'lReb',
  oreb: 'lOreb',
  dreb: 'lDreb',
  ast: 'lAst',
  stl: 'lStl',
  blk: 'lBlk',
  tov: 'lTov',
  pf: 'lPf',
  eff: 'lEff',
  ptsOffTov: 'lPtsOffTov',
  fastBreak: 'lFastBreak',
  secondChance: 'lSecondChance',
  paint: 'lPaint',
  bench: 'lBench',
  biggestLead: 'lBiggestLead',
  biggestRun: 'lBiggestRun',
  leadChanges: 'lLeadChanges',
  timesTied: 'lTimesTied',
  timeLeading: 'lTimeLeading',
};

/** Shared stats (lead changes, times tied) belong to both teams; no leader. */
const SHARED: CompareKey[] = ['leadChanges', 'timesTied'];

/**
 * Paired bars per stat, growing out from the centre. The side that leads a
 * stat wears its team colour; the trailing side stays neutral.
 */
export function TeamCompare({ rows, game, colors }: { rows: TeamCompareRow[]; game: Game; colors: TeamColors }) {
  const i18n = useI18n();
  const { t } = i18n;
  const fmt = (r: TeamCompareRow, v: number, text?: string) => {
    if (r.pct) return i18n.pct(v);
    if (text && r.key === 'timeLeading') return text;
    return Number.isInteger(v) ? i18n.num(v) : i18n.num(v, 1);
  };
  return (
    <div className={s.compare}>
      <div className={s.compareTeams} aria-hidden>
        <span>
          <i style={{ background: colors.home }} />
          {game.home.team.short ?? game.home.team.name}
        </span>
        <span>
          {game.away.team.short ?? game.away.team.name}
          <i style={{ background: colors.away }} />
        </span>
      </div>
      <dl className={s.compareList}>
        {rows.map((r) => {
          const shared = SHARED.includes(r.key);
          const max = Math.max(r.home, r.away, r.pct ? 0 : 1);
          const homeLead = !shared && (r.inverse ? r.home < r.away : r.home > r.away);
          const awayLead = !shared && (r.inverse ? r.away < r.home : r.away > r.home);
          const hw = max > 0 ? (r.pct ? r.home : (r.home / max) * 100) : 0;
          const aw = max > 0 ? (r.pct ? r.away : (r.away / max) * 100) : 0;
          return (
            <div key={r.key} className={s.compareRow}>
              <dt className={s.compareLabel}>{t(COMPARE_LABEL[r.key])}</dt>
              <dd className={s.compareValues}>
                <span className={`${s.compareVal} ${homeLead ? s.lead : ''}`}>
                  {fmt(r, r.home, r.homeText)}
                  {r.pct && r.homeText && <small>{r.homeText}</small>}
                </span>
                <span className={s.compareBars} aria-hidden>
                  <span className={s.barHalf}>
                    <span style={{ transform: `scaleX(${Math.min(100, hw) / 100})`, background: homeLead || shared ? colors.home : undefined }} />
                  </span>
                  <span className={`${s.barHalf} ${s.barRight}`}>
                    <span style={{ transform: `scaleX(${Math.min(100, aw) / 100})`, background: awayLead || shared ? colors.away : undefined }} />
                  </span>
                </span>
                <span className={`${s.compareVal} ${s.compareValAway} ${awayLead ? s.lead : ''}`}>
                  {fmt(r, r.away, r.awayText)}
                  {r.pct && r.awayText && <small>{r.awayText}</small>}
                </span>
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
