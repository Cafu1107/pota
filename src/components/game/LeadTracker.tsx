import { useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import type { Game, LeagueDef, Play } from '../../data/types';
import { useI18n } from '../../i18n';
import type { TeamColors } from '../../lib/color';
import { clockToSeconds } from '../../lib/time';
import s from './game.module.css';

interface Pt {
  t: number;
  m: number;
  h: number;
  a: number;
  period: number;
  clock: string;
}

const OT_SECONDS = 5 * 60;

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export function buildTimeline(plays: Play[], league: LeagueDef | undefined, game: Game) {
  const regLen = (league?.periodMinutes ?? 10) * 60;
  const regs = league?.periods ?? 4;
  const start = (p: number) => (p <= regs ? (p - 1) * regLen : regs * regLen + (p - regs - 1) * OT_SECONDS);
  const len = (p: number) => (p <= regs ? regLen : OT_SECONDS);
  const pts: Pt[] = [{ t: 0, m: 0, h: 0, a: 0, period: 1, clock: '' }];
  let last = pts[0];
  let maxPeriod = 1;
  for (const p of plays) {
    if (p.homeScore === undefined || p.awayScore === undefined) continue;
    const period = Math.max(1, p.period || 1);
    maxPeriod = Math.max(maxPeriod, period);
    if (p.homeScore === last.h && p.awayScore === last.a) continue;
    const elapsed = start(period) + Math.max(0, Math.min(len(period), len(period) - clockToSeconds(p.clock)));
    if (elapsed < last.t) continue;
    last = { t: elapsed, m: p.homeScore - p.awayScore, h: p.homeScore, a: p.awayScore, period, clock: p.clock };
    pts.push(last);
  }
  if (game.status === 'final') maxPeriod = Math.max(maxPeriod, game.period ?? regs, regs);
  const end = game.status === 'final' ? start(maxPeriod) + len(maxPeriod) : Math.max(last.t, start(maxPeriod) + 1);
  const total = Math.max(end, last.t, 1);
  return { pts, total, maxPeriod, start, len };
}

export function LeadTracker({ plays, game, league, colors }: { plays: Play[]; game: Game; league?: LeagueDef; colors: TeamColors }) {
  const i18n = useI18n();
  const { t } = i18n;
  const [wrap, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const data = useMemo(() => buildTimeline(plays, league, game), [plays, league, game]);
  const H = 196;
  const padL = 8;
  const padR = 8;
  const padT = 14;
  const padB = 26;
  const W = Math.max(width, 280);
  const maxAbs = Math.max(5, Math.ceil(Math.max(...data.pts.map((p) => Math.abs(p.m))) / 5) * 5);
  const zeroY = padT + (H - padT - padB) / 2;
  const x = (tt: number) => padL + (tt / data.total) * (W - padL - padR);
  const y = (m: number) => zeroY - (m / maxAbs) * ((H - padT - padB) / 2);
  const endX = x(game.status === 'final' ? data.total : data.pts[data.pts.length - 1].t);

  let d = `M ${x(0)} ${y(0)}`;
  for (let i = 1; i < data.pts.length; i++) d += ` H ${x(data.pts[i].t).toFixed(1)} V ${y(data.pts[i].m).toFixed(1)}`;
  d += ` H ${endX.toFixed(1)}`;
  const area = `${d} V ${zeroY} H ${x(0)} Z`;

  const homeAbbr = game.home.team.abbr ?? game.home.team.short ?? game.home.team.name;
  const awayAbbr = game.away.team.abbr ?? game.away.team.short ?? game.away.team.name;
  const periods = Array.from({ length: data.maxPeriod }, (_, i) => i + 1);
  const hp = hover !== null ? data.pts[hover] : undefined;
  const id = `lt-${game.id.replace(/[^a-z0-9]/gi, '')}`;

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const tt = ((e.clientX - rect.left - padL) / (rect.width - padL - padR)) * data.total;
    let lo = 0;
    let hi = data.pts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (data.pts[mid].t <= tt) lo = mid;
      else hi = mid - 1;
    }
    setHover(lo);
  };

  const biggest = data.pts.reduce(
    (acc, p) => (p.m > acc.home ? { ...acc, home: p.m } : -p.m > acc.away ? { ...acc, away: -p.m } : acc),
    { home: 0, away: 0 },
  );

  return (
    <div className={s.tracker}>
      <div className={s.trackerLegend}>
        <span>
          <i style={{ background: colors.home }} />
          {t('maxLead', { team: homeAbbr, n: biggest.home })}
        </span>
        <span>
          <i style={{ background: colors.away }} />
          {t('maxLead', { team: awayAbbr, n: biggest.away })}
        </span>
      </div>
      <div ref={wrap} className={s.trackerPlot}>
        {width > 0 && (
          <svg
            width={W}
            height={H}
            role="img"
            aria-label={`${t('leadTracker')}: ${homeAbbr} ${biggest.home}, ${awayAbbr} ${biggest.away}`}
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          >
            <defs>
              <clipPath id={`${id}-top`}>
                <rect x={0} y={0} width={W} height={zeroY} />
              </clipPath>
              <clipPath id={`${id}-bot`}>
                <rect x={0} y={zeroY} width={W} height={H - zeroY} />
              </clipPath>
            </defs>
            {periods.map((p) =>
              p > 1 ? <line key={p} x1={x(data.start(p))} x2={x(data.start(p))} y1={padT} y2={H - padB} stroke="var(--grid)" strokeWidth={1} /> : null,
            )}
            {[maxAbs, -maxAbs].map((m) => (
              <line key={m} x1={padL} x2={W - padR} y1={y(m)} y2={y(m)} stroke="var(--grid)" strokeWidth={1} />
            ))}
            <path d={area} fill={colors.home} opacity={0.16} clipPath={`url(#${id}-top)`} />
            <path d={area} fill={colors.away} opacity={0.16} clipPath={`url(#${id}-bot)`} />
            <path d={d} fill="none" stroke={colors.home} strokeWidth={2} strokeLinejoin="round" clipPath={`url(#${id}-top)`} />
            <path d={d} fill="none" stroke={colors.away} strokeWidth={2} strokeLinejoin="round" clipPath={`url(#${id}-bot)`} />
            <line x1={padL} x2={W - padR} y1={zeroY} y2={zeroY} stroke="var(--ink-3)" strokeWidth={1} />
            {periods.map((p) => (
              <text
                key={p}
                x={(x(data.start(p)) + x(Math.min(data.total, data.start(p) + data.len(p)))) / 2}
                y={H - 8}
                textAnchor="middle"
                className={s.trackerAxis}
              >
                {i18n.period(league, p)}
              </text>
            ))}
            <text x={padL + 2} y={y(maxAbs) - 4} className={s.trackerAxis}>
              +{maxAbs}
            </text>
            <text x={padL + 2} y={y(-maxAbs) + 12} className={s.trackerAxis}>
              +{maxAbs}
            </text>
            {hp && (
              <g>
                <line x1={x(hp.t)} x2={x(hp.t)} y1={padT} y2={H - padB} stroke="var(--ink-2)" strokeWidth={1} />
                <circle cx={x(hp.t)} cy={y(hp.m)} r={4.5} fill={hp.m >= 0 ? colors.home : colors.away} stroke="var(--surface)" strokeWidth={2} />
              </g>
            )}
          </svg>
        )}
        {hp && width > 0 && (
          <div className={s.trackerTip} style={{ left: Math.min(Math.max(x(hp.t), 70), W - 70) }} role="status">
            <strong className="tnum">
              {homeAbbr} {hp.h} – {hp.a} {awayAbbr}
            </strong>
            <span>
              {hp.m === 0 ? t('tied') : t('leadBy', { team: hp.m > 0 ? homeAbbr : awayAbbr, n: Math.abs(hp.m) })}
              {hp.clock ? ` · ${i18n.period(league, hp.period)} ${hp.clock}` : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
