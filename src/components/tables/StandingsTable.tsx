import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Star } from 'lucide-react';
import type { LeagueDef, StandingGroup, StandingRow } from '../../data/types';
import { useI18n, type TKey } from '../../i18n';
import { useFavoriteTeamKeys } from '../../state/favorites';
import { TeamLogo } from '../ui/Media';
import s from './tables.module.css';

type Zone = NonNullable<StandingRow['zone']>;
type ColKey = 'gp' | 'w' | 'l' | 'pct' | 'gb' | 'pf' | 'pa' | 'diff' | 'pts' | 'home' | 'away' | 'streak';
/** Columns are drawn in groups with a quiet rule between them. */
type ColGroup = 'record' | 'rank' | 'score' | 'split';

type Col = {
  key: ColKey;
  group: ColGroup;
  get: (r: StandingRow) => string | number | undefined;
};

const LABEL: Record<ColKey, { short: TKey; mid: TKey; long: TKey }> = {
  gp: { short: 'colGp', mid: 'colGpMid', long: 'colGpLong' },
  w: { short: 'colW', mid: 'colWMid', long: 'colWLong' },
  l: { short: 'colL', mid: 'colLMid', long: 'colLLong' },
  pct: { short: 'colPct', mid: 'colPctMid', long: 'colPctLong' },
  gb: { short: 'colGb', mid: 'colGbMid', long: 'colGbLong' },
  pf: { short: 'colPf', mid: 'colPfMid', long: 'colPfLong' },
  pa: { short: 'colPa', mid: 'colPaMid', long: 'colPaLong' },
  diff: { short: 'colDiff', mid: 'colDiffMid', long: 'colDiffLong' },
  pts: { short: 'colPts', mid: 'colPtsMid', long: 'colPtsLong' },
  home: { short: 'colHome', mid: 'colHomeMid', long: 'colHomeLong' },
  away: { short: 'colAway', mid: 'colAwayMid', long: 'colAwayLong' },
  streak: { short: 'colStreak', mid: 'colStreakMid', long: 'colStreakLong' },
};

const ZONE_ORDER: Zone[] = ['top', 'playoff', 'playin', 'down'];
const ZONE_LABEL: Record<Zone, TKey> = { top: 'legendPlayoff', playoff: 'legendPlayoff', playin: 'legendPlayin', down: 'legendDown' };

const pct3 = (v: number | undefined) => (v !== undefined ? v.toFixed(3).replace(/^0/, '') : undefined);
const signed = (v: number | undefined) => (v !== undefined ? (v > 0 ? `+${v}` : String(v)) : undefined);

/** Which columns this table has, in reading order: record, the ranking value, scoring, splits. */
function buildCols(rows: StandingRow[], compact: boolean): { cols: Col[]; rankKey: ColKey } {
  const has = (f: (r: StandingRow) => unknown) => rows.some((r) => f(r) !== undefined && f(r) !== null && f(r) !== '');
  const byPoints = has((r) => r.pts);
  const rankKey: ColKey = byPoints ? 'pts' : 'pct';
  const cols: Col[] = [
    { key: 'gp', group: 'record', get: (r) => r.gp },
    { key: 'w', group: 'record', get: (r) => r.w },
    { key: 'l', group: 'record', get: (r) => r.l },
  ];
  if (byPoints) cols.push({ key: 'pts', group: 'rank', get: (r) => r.pts });
  else if (has((r) => r.pct)) cols.push({ key: 'pct', group: 'rank', get: (r) => pct3(r.pct) });
  if (compact) return { cols, rankKey };
  if (has((r) => r.gb)) cols.push({ key: 'gb', group: 'rank', get: (r) => (r.gb === '-' ? '–' : r.gb) });
  if (has((r) => r.pf)) cols.push({ key: 'pf', group: 'score', get: (r) => r.pf });
  if (has((r) => r.pa)) cols.push({ key: 'pa', group: 'score', get: (r) => r.pa });
  if (has((r) => r.diff)) cols.push({ key: 'diff', group: 'score', get: (r) => signed(r.diff) });
  if (has((r) => r.home)) cols.push({ key: 'home', group: 'split', get: (r) => r.home });
  if (has((r) => r.away)) cols.push({ key: 'away', group: 'split', get: (r) => r.away });
  if (has((r) => r.streak)) cols.push({ key: 'streak', group: 'split', get: (r) => r.streak });
  return { cols, rankKey };
}

/** First and last place of each zone, from the first group that has it. */
function zoneRanges(groups: StandingGroup[]) {
  const out = new Map<Zone, { from: number; to: number }>();
  for (const z of ZONE_ORDER) {
    for (const g of groups) {
      const ranks = g.rows.filter((r) => r.zone === z).map((r) => r.rank);
      if (ranks.length) {
        out.set(z, { from: Math.min(...ranks), to: Math.max(...ranks) });
        break;
      }
    }
  }
  // "top" and "playoff" read the same; keep one entry.
  if (out.has('top') && out.has('playoff')) out.delete('top');
  return out;
}

/** True while the table can still scroll further right, for the edge fade. */
function useMoreRight<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, []);
  return [ref, more] as const;
}

function GroupTable({
  rows,
  cols,
  rankKey,
  showForm,
  league,
  compact,
  highlight,
}: {
  rows: StandingRow[];
  cols: Col[];
  rankKey: ColKey;
  showForm: boolean;
  league: LeagueDef;
  compact: boolean;
  highlight?: string[];
}) {
  const i18n = useI18n();
  const { t } = i18n;
  const favs = useFavoriteTeamKeys();
  const navigate = useNavigate();
  const [scrollRef, moreRight] = useMoreRight<HTMLDivElement>();
  const teamPath = (r: StandingRow) => `/takim/${league.id}/${encodeURIComponent(r.team.id)}`;

  const colClass = (c: Col, i: number) =>
    [c.key === rankKey ? s.rankValue : '', i > 0 && cols[i - 1].group !== c.group ? s.groupStart : ''].join(' ');

  return (
    <div className={`${s.scrollWrap} ${moreRight ? s.moreRight : ''}`}>
      <div className={s.scroll} ref={scrollRef}>
        <table className={`${s.table} ${s.standingsTable} ${compact ? s.compact : ''}`}>
          <thead>
            <tr>
              <th scope="col" className={`${s.rankCol} ${s.stickRank}`}>
                {t('colRank')}
              </th>
              <th scope="col" className={`${s.teamCol} ${s.stickTeam}`}>
                {t('colTeam')}
              </th>
              {cols.map((c, i) => (
                <th key={c.key} scope="col" className={colClass(c, i)}>
                  <abbr title={t(LABEL[c.key].long)} className={s.short}>
                    {t(LABEL[c.key].short)}
                  </abbr>
                  {!compact && <span className={s.long}>{t(LABEL[c.key].mid)}</span>}
                </th>
              ))}
              {showForm && (
                <th scope="col" className={`${s.formCol} ${s.groupStart}`} title={t('colFormLong')}>
                  <span className={s.short}>{t('colForm')}</span>
                  <span className={s.long}>{t('colFormMid')}</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const fav = favs.has(`${league.id}:${r.team.id}`);
              const hl = highlight?.includes(r.team.id);
              const next = rows[idx + 1];
              const prev = rows[idx - 1];
              // Rule under the last row of a zone, and over the first relegation row.
              const zoneEnd = r.zone && r.zone !== 'down' && next && next.zone !== r.zone;
              const downStart = r.zone === 'down' && prev && prev.zone !== 'down';
              const cls = [s.clickRow, hl ? s.highlight : '', fav ? s.favRow : '', zoneEnd ? s[`end_${r.zone}`] : '', downStart ? s.start_down : '']
                .filter(Boolean)
                .join(' ');
              return (
                <tr key={r.team.id || r.rank} className={cls} onClick={() => navigate(teamPath(r))}>
                  <td className={`${s.rankCol} ${s.stickRank}`}>
                    <span className={`${s.rank} ${r.zone ? s[`zone_${r.zone}`] : ''}`}>{r.rank}</span>
                  </td>
                  <th scope="row" className={`${s.teamCol} ${s.stickTeam}`}>
                    <Link to={teamPath(r)} className={s.teamCell} onClick={(e) => e.stopPropagation()}>
                      <TeamLogo team={r.team} size={compact ? 18 : 22} />
                      {compact ? (
                        <span className={s.teamName}>{r.team.short ?? r.team.name}</span>
                      ) : (
                        <>
                          <span className={`${s.teamName} ${s.nameFull}`}>{r.team.name}</span>
                          <span className={`${s.teamName} ${s.nameShort}`}>{r.team.short ?? r.team.name}</span>
                        </>
                      )}
                      {fav && <Star aria-hidden size={12} className={s.fav} fill="currentColor" strokeWidth={0} />}
                    </Link>
                  </th>
                  {cols.map((c, i) => (
                    <td key={c.key} className={colClass(c, i)}>
                      {c.get(r) ?? '–'}
                    </td>
                  ))}
                  {showForm && (
                    <td className={`${s.formCol} ${s.groupStart}`}>
                      <span className={s.form}>
                        {(r.form ?? []).slice(-5).map((w, i) => (
                          <span key={i} className={w ? s.formW : s.formL} title={w ? t('formWinLong') : t('formLossLong')}>
                            {w ? t('formWin') : t('formLoss')}
                          </span>
                        ))}
                      </span>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StandingsTable({
  groups,
  league,
  compact = false,
  limit,
  highlight,
}: {
  groups: StandingGroup[];
  league: LeagueDef;
  compact?: boolean;
  limit?: number;
  highlight?: string[];
}) {
  const { t } = useI18n();
  // A limited table (side card) only explains the zones it actually shows.
  const shown = limit ? groups.map((g) => ({ ...g, rows: g.rows.slice(0, limit) })) : groups;
  const rows = shown.flatMap((g) => g.rows);
  const { cols, rankKey } = buildCols(rows, compact);
  const showForm = !compact && rows.some((r) => r.form?.length);
  const zones = zoneRanges(shown);
  const keyCols: Array<ColKey | 'form'> = [...cols.map((c) => c.key), ...(showForm ? (['form'] as const) : [])];

  return (
    <div className={s.standings}>
      {shown.map((g, gi) => (
        <div key={gi} className={s.group}>
          {(g.name || g.season) && (
            <h3 className={s.groupTitle}>
              {g.name}
              {g.season && <span className={s.groupSeason}>{t('seasonPast', { season: g.season })}</span>}
            </h3>
          )}
          <GroupTable
            rows={g.rows}
            cols={cols}
            rankKey={rankKey}
            showForm={showForm}
            league={league}
            compact={compact}
            highlight={highlight}
          />
        </div>
      ))}

      <footer className={`${s.legend} ${compact ? s.legendCompact : ''}`}>
        {zones.size > 0 && (
          <ul className={s.zoneList} aria-label={t('legendZones')}>
            {[...zones].map(([z, r]) => (
              <li key={z}>
                <span className={`${s.rank} ${s.swatch} ${s[`zone_${z}`]}`} aria-hidden />
                <span className={s.zoneName}>{t(ZONE_LABEL[z])}</span>
                <span className={s.zoneRange}>{r.from === r.to ? t('zoneSingle', { n: r.from }) : t('zoneRange', { from: r.from, to: r.to })}</span>
              </li>
            ))}
          </ul>
        )}
        <dl className={`${s.abbrList} ${compact ? '' : s.abbrNarrowOnly}`} aria-label={t('legendTitle')}>
          {keyCols.map((k) => (
            <div key={k}>
              <dt>{k === 'form' ? t('colForm') : t(LABEL[k].short)}</dt>
              <dd>{k === 'form' ? t('colFormLong') : t(LABEL[k].long)}</dd>
            </div>
          ))}
        </dl>
      </footer>
    </div>
  );
}
