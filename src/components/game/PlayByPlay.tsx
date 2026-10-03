import { Fragment, useMemo, useState } from 'react';
import { ArrowDownUp } from 'lucide-react';
import type { GameDetail, LeagueDef, Play } from '../../data/types';
import { useI18n } from '../../i18n';
import { describePlay, isKeyPlay } from '../../i18n/plays';
import { Segmented } from '../ui/Controls';
import { TeamLogo } from '../ui/Media';
import s from './game.module.css';

type Filter = 'all' | 'scoring' | 'key';

export function PlayByPlay({ detail, league }: { detail: GameDetail; league?: LeagueDef }) {
  const i18n = useI18n();
  const { t } = i18n;
  const g = detail.game;
  const [filter, setFilter] = useState<Filter>('all');
  const [newestFirst, setNewestFirst] = useState(g.status === 'live');

  const plays = useMemo(() => {
    const base = (detail.plays ?? []).filter((p) => p.kind !== 'sub' && !(p.kind === 'other' && !p.text));
    const f =
      filter === 'scoring'
        ? base.filter((p) => (p.points ?? 0) > 0)
        : filter === 'key'
          ? base.filter((p) => isKeyPlay(p) || (p.points ?? 0) >= 3)
          : base;
    return newestFirst ? [...f].reverse() : f;
  }, [detail.plays, filter, newestFirst]);

  const groups = useMemo(() => {
    const out: Array<{ period: number; plays: Play[] }> = [];
    for (const p of plays) {
      const last = out[out.length - 1];
      if (last && last.period === p.period) last.plays.push(p);
      else out.push({ period: p.period, plays: [p] });
    }
    return out;
  }, [plays]);

  return (
    <div className={s.pbp}>
      <div className={s.pbpTools}>
        <Segmented<Filter>
          label={t('tabPlays')}
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: t('playsAll') },
            { value: 'scoring', label: t('playsScoring') },
            { value: 'key', label: t('playsKey') },
          ]}
        />
        <button type="button" className={s.orderBtn} onClick={() => setNewestFirst((v) => !v)} aria-pressed={newestFirst}>
          <ArrowDownUp size={14} aria-hidden />
          {newestFirst ? t('newestFirst') : t('oldestFirst')}
        </button>
      </div>
      <ol className={s.pbpList}>
        {groups.map((grp, gi) => (
          <Fragment key={`${grp.period}-${gi}`}>
            <li className={s.pbpPeriod} aria-hidden={false}>
              <span>{i18n.period(league, grp.period, true)}</span>
              {g.home.periods[grp.period - 1] !== undefined && (
                <span className="tnum">
                  {g.home.periods[grp.period - 1]} – {g.away.periods[grp.period - 1]}
                </span>
              )}
            </li>
            {grp.plays.map((p) => {
              const team = p.side ? g[p.side].team : undefined;
              const scored = (p.points ?? 0) > 0;
              const text = describePlay(p, i18n, league, detail.playsLang);
              const usesRaw = detail.playsLang === i18n.lang && !!p.text;
              return (
                <li key={`${p.id}-${p.period}`} className={`${s.pbpRow} ${scored ? s.pbpScore : ''} ${p.kind === 'period' ? s.pbpMarker : ''}`}>
                  <span className={s.pbpClock}>{p.clock}</span>
                  <span className={s.pbpTeam}>{team ? <TeamLogo team={team} size={18} /> : null}</span>
                  <span className={s.pbpText}>
                    {p.player && !usesRaw && <strong>{p.player}</strong>}
                    {p.player && !usesRaw ? ' · ' : ''}
                    {text}
                  </span>
                  <span className={s.pbpRight}>
                    {scored && <span className={s.pbpPts}>+{p.points}</span>}
                    {p.homeScore !== undefined && p.awayScore !== undefined && (
                      <span className={s.pbpResult}>
                        <span className={scored && p.side === 'home' ? s.pbpHot : undefined}>{p.homeScore}</span>
                        <span className={s.pbpDash}>-</span>
                        <span className={scored && p.side === 'away' ? s.pbpHot : undefined}>{p.awayScore}</span>
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </Fragment>
        ))}
      </ol>
    </div>
  );
}
