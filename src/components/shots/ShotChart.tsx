import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameDetail, LeagueDef, Shot, Side } from '../../data/types';
import { useI18n } from '../../i18n';
import type { TeamColors } from '../../lib/color';
import { useMediaQuery } from '../../lib/hooks';
import { Segmented } from '../ui/Controls';
import { TeamLogo } from '../ui/Media';
import { courtFor, zoneStats, type Zone } from './court';
import { HalfCourt, shotKey } from './HalfCourt';
import s from './shots.module.css';

const ZONES: Zone[] = ['paint', 'mid', 'three'];

/** Keys of shots that were not there on the previous render (live arrivals). */
function useFreshKeys(shots: Shot[], live: boolean): Set<string> {
  const prev = useRef<Set<string> | null>(null);
  const keys = useMemo(() => new Set(shots.map(shotKey)), [shots]);
  const fresh = useMemo(() => {
    if (!live || !prev.current) return new Set<string>();
    return new Set([...keys].filter((k) => !prev.current!.has(k)));
  }, [keys, live]);
  useEffect(() => {
    prev.current = keys;
  }, [keys]);
  return fresh;
}

export function ShotChart({ detail, league, colors }: { detail: GameDetail; league?: LeagueDef; colors: TeamColors }) {
  const i18n = useI18n();
  const { t } = i18n;
  const g = detail.game;
  const geo = courtFor(league);
  const wide = useMediaQuery('(min-width: 760px)');
  const [side, setSide] = useState<Side>('home');
  const [period, setPeriod] = useState<string>('all');
  const [player, setPlayer] = useState<string>('all');
  const all = detail.shots ?? [];
  const fresh = useFreshKeys(all, g.status === 'live');

  const periods = useMemo(() => [...new Set(all.map((x) => x.period).filter((p): p is number => !!p))].sort((a, b) => a - b), [all]);
  const players = useMemo(() => {
    const m = new Map<string, { name: string; side: Side; n: number }>();
    for (const sh of all) {
      if (!sh.player) continue;
      const k = `${sh.side}:${sh.player}`;
      const cur = m.get(k);
      m.set(k, { name: sh.player, side: sh.side, n: (cur?.n ?? 0) + 1 });
    }
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n);
  }, [all]);

  const filtered = all.filter(
    (sh) => (period === 'all' || String(sh.period) === period) && (player === 'all' || `${sh.side}:${sh.player}` === player),
  );

  const column = (sd: Side) => {
    const shots = filtered.filter((x) => x.side === sd);
    const z = zoneStats(shots, geo);
    const team = g[sd].team;
    const pctAll = z.all.att ? (z.all.made / z.all.att) * 100 : undefined;
    return (
      <section key={sd} className={s.col} aria-label={team.name}>
        <header className={s.colHead}>
          <TeamLogo team={team} size={24} />
          <span className={s.colTeam}>{team.short ?? team.name}</span>
          <span className={s.colFg}>
            <span className="tnum">{t('shotsOf', { made: z.all.made, att: z.all.att })}</span>
            <span className={s.colPct}>{i18n.pct(pctAll)}</span>
          </span>
        </header>
        <HalfCourt
          geo={geo}
          shots={shots}
          color={colors[sd]}
          liveKeys={fresh}
          label={`${team.name}: ${t('made')} ${z.all.made}, ${t('missed')} ${z.all.att - z.all.made}`}
        />
        <table className={s.zones}>
          <tbody>
            {ZONES.map((zone) => {
              const st = z[zone];
              const p = st.att ? (st.made / st.att) * 100 : undefined;
              return (
                <tr key={zone}>
                  <th scope="row">{t(zone === 'paint' ? 'shotZonePaint' : zone === 'mid' ? 'shotZoneMid' : 'shotZoneThree')}</th>
                  <td className="tnum">{t('shotsOf', { made: st.made, att: st.att })}</td>
                  <td className={s.zoneBar}>
                    <span className={s.track}>
                      <span style={{ width: `${p ?? 0}%`, background: colors[sd] }} />
                    </span>
                  </td>
                  <td className={`tnum ${s.zonePct}`}>{i18n.pct(p)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    );
  };

  return (
    <div className={s.panel}>
      <div className={s.filters}>
        {!wide && (
          <Segmented<Side>
            label={t('colTeam')}
            size="sm"
            value={side}
            onChange={(v) => {
              setSide(v);
              setPlayer('all');
            }}
            options={[
              { value: 'home', label: g.home.team.abbr ?? g.home.team.short ?? g.home.team.name },
              { value: 'away', label: g.away.team.abbr ?? g.away.team.short ?? g.away.team.name },
            ]}
          />
        )}
        <label className={s.select}>
          <span className="sr-only">{t('allPeriods')}</span>
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="all">{t('allPeriods')}</option>
            {periods.map((p) => (
              <option key={p} value={String(p)}>
                {i18n.period(league, p, true)}
              </option>
            ))}
          </select>
        </label>
        <label className={s.select}>
          <span className="sr-only">{t('allPlayers')}</span>
          <select value={player} onChange={(e) => setPlayer(e.target.value)}>
            <option value="all">{t('allPlayers')}</option>
            {(['home', 'away'] as Side[])
              .filter((sd) => wide || sd === side)
              .map((sd) => (
                <optgroup key={sd} label={g[sd].team.short ?? g[sd].team.name}>
                  {players
                    .filter(([, v]) => v.side === sd)
                    .map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.name} ({v.n})
                      </option>
                    ))}
                </optgroup>
              ))}
          </select>
        </label>
        <div className={s.legend} aria-hidden>
          <span>
            <i className={s.legendMade} />
            {t('made')}
          </span>
          <span>
            <i className={s.legendMiss} />
            {t('missed')}
          </span>
        </div>
      </div>
      <div className={s.cols}>{wide ? (['home', 'away'] as Side[]).map(column) : column(side)}</div>
    </div>
  );
}

/** Two thumbnail half-courts for cards. */
export function MiniShots({ detail, league, colors }: { detail: GameDetail; league?: LeagueDef; colors: TeamColors }) {
  const geo = courtFor(league);
  const shots = detail.shots ?? [];
  const fresh = useFreshKeys(shots, detail.game.status === 'live');
  if (!shots.length) return null;
  return (
    <div className={s.mini}>
      {(['home', 'away'] as Side[]).map((sd) => (
        <HalfCourt
          key={sd}
          mini
          geo={geo}
          shots={shots.filter((x) => x.side === sd)}
          color={colors[sd]}
          liveKeys={fresh}
          label={detail.game[sd].team.name}
        />
      ))}
    </div>
  );
}
