import { memo, useState } from 'react';
import type { Shot } from '../../data/types';
import { useI18n } from '../../i18n';
import { cornerMeetY, type CourtGeo } from './court';
import s from './shots.module.css';

const PAD = 0.35;

function CourtLines({ g }: { g: CourtGeo }) {
  const hw = g.width / 2;
  const meet = cornerMeetY(g);
  const line = { fill: 'none', stroke: 'var(--court-line)', strokeWidth: 1.25, vectorEffect: 'non-scaling-stroke' as const };
  return (
    <g>
      <rect x={-hw} y={0} width={g.width} height={g.half} {...line} fill="var(--surface)" />
      <rect x={-g.keyW / 2} y={0} width={g.keyW} height={g.keyL} fill="var(--court-paint)" stroke="var(--court-line)" strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
      <path d={`M ${-g.ftR} ${g.keyL} A ${g.ftR} ${g.ftR} 0 0 0 ${g.ftR} ${g.keyL}`} {...line} />
      <path
        d={`M ${-g.cornerX} 0 L ${-g.cornerX} ${meet} A ${g.threeR} ${g.threeR} 0 0 0 ${g.cornerX} ${meet} L ${g.cornerX} 0`}
        {...line}
      />
      <path d={`M ${-g.raR} ${g.basketY} A ${g.raR} ${g.raR} 0 0 0 ${g.raR} ${g.basketY}`} {...line} />
      <path d={`M ${-g.centerR} ${g.half} A ${g.centerR} ${g.centerR} 0 0 1 ${g.centerR} ${g.half}`} {...line} />
      <line x1={-0.9} x2={0.9} y1={g.backboardY} y2={g.backboardY} stroke="var(--ink-3)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      <circle cx={0} cy={g.basketY} r={g.rim} fill="none" stroke="var(--ink-3)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </g>
  );
}

interface Props {
  geo: CourtGeo;
  shots: Shot[];
  color: string;
  label: string;
  /** Smaller marks for thumbnails. */
  mini?: boolean;
  /** Animate the most recent shots in (live). */
  liveKeys?: Set<string>;
}

export const shotKey = (sh: Shot, i: number) => `${sh.side}-${sh.period ?? 0}-${sh.x.toFixed(2)}-${sh.y.toFixed(2)}-${i}`;

function HalfCourtBase({ geo, shots, color, label, mini, liveKeys }: Props) {
  const i18n = useI18n();
  const [hover, setHover] = useState<number | null>(null);
  const hw = geo.width / 2;
  const r = mini ? 0.26 : 0.21;
  const active = hover !== null ? shots[hover] : undefined;
  const order = shots.map((sh, i) => ({ sh, i })).sort((a, b) => Number(a.sh.made) - Number(b.sh.made));
  return (
    <div className={s.courtWrap}>
      <svg
        viewBox={`${-hw - PAD} ${-PAD} ${geo.width + PAD * 2} ${geo.half + PAD * 2}`}
        className={s.court}
        role="img"
        aria-label={label}
        onPointerLeave={() => setHover(null)}
      >
        <CourtLines g={geo} />
        {order.map(({ sh, i }) => {
          const k = shotKey(sh, i);
          const fresh = liveKeys?.has(k);
          return (
            <g key={k} className={fresh ? s.fresh : undefined} onPointerEnter={() => setHover(i)}>
              {!mini && <circle cx={sh.x} cy={sh.y} r={0.5} fill="transparent" />}
              {sh.made ? (
                <circle cx={sh.x} cy={sh.y} r={r} fill={color} stroke="var(--surface)" strokeWidth={0.07} />
              ) : (
                <circle cx={sh.x} cy={sh.y} r={r * 0.82} fill="none" stroke="var(--ink-3)" strokeWidth={mini ? 0.09 : 0.075} />
              )}
              {hover === i && <circle cx={sh.x} cy={sh.y} r={r + 0.16} fill="none" stroke="var(--ink)" strokeWidth={0.06} />}
            </g>
          );
        })}
      </svg>
      {active && !mini && (
        <div
          className={s.tip}
          style={{
            left: `${((active.x + hw + PAD) / (geo.width + PAD * 2)) * 100}%`,
            top: `${((active.y + PAD) / (geo.half + PAD * 2)) * 100}%`,
          }}
          role="status"
        >
          <strong>{active.made ? i18n.t('made') : i18n.t('missed')}</strong>
          <span>
            {active.value === 3 ? i18n.t('s3p') : i18n.t('s2p')}
            {active.period ? ` · ${i18n.period(undefined, active.period)}` : ''}
          </span>
          {active.player && <span className={s.tipPlayer}>{active.player}</span>}
        </div>
      )}
    </div>
  );
}

export const HalfCourt = memo(HalfCourtBase);
