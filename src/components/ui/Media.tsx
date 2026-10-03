import { useState } from 'react';
import type { LeagueDef, TeamRef } from '../../data/types';
import { hexToRgb, inkOn } from '../../lib/color';
import s from './ui.module.css';

function initials(name: string, max = 3) {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, max).toLocaleUpperCase('tr-TR');
  return words
    .slice(0, max)
    .map((w) => w[0])
    .join('')
    .toLocaleUpperCase('tr-TR');
}

const isTbf = (src: string) => /tbf\.org\.tr/.test(src);

export function TeamLogo({ team, size = 24, className }: { team: Pick<TeamRef, 'name' | 'logo' | 'abbr' | 'color'>; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };
  if (team.logo && !failed) {
    return (
      <img
        src={team.logo}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        referrerPolicy={isTbf(team.logo) ? 'no-referrer' : undefined}
        className={`${s.logo} ${className ?? ''}`}
        style={style}
        onError={() => setFailed(true)}
      />
    );
  }
  const bg = team.color && hexToRgb(team.color) ? team.color : undefined;
  return (
    <span
      aria-hidden
      className={`${s.monogram} ${className ?? ''}`}
      style={{ ...style, background: bg, color: bg ? inkOn(bg) : undefined, fontSize: Math.max(8, size * 0.36) }}
    >
      {(team.abbr && team.abbr.length <= 4 ? team.abbr : initials(team.name)).slice(0, 3)}
    </span>
  );
}

export function PlayerPhoto({ src, name, size = 40, className }: { src?: string; name: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };
  if (src && !failed) {
    return (
      <span className={`${s.photo} ${className ?? ''}`} style={style}>
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy={isTbf(src) ? 'no-referrer' : undefined}
          onError={() => setFailed(true)}
        />
      </span>
    );
  }
  return (
    <span aria-hidden className={`${s.photo} ${s.photoFallback} ${className ?? ''}`} style={{ ...style, fontSize: Math.max(9, size * 0.34) }}>
      {initials(name, 2)}
    </span>
  );
}

export function Flag({ code, size = 16 }: { code: LeagueDef['flag']; size?: number }) {
  const w = size;
  const h = Math.round((size * 2) / 3);
  const common = { width: w, height: h, viewBox: '0 0 30 20', className: s.flag, 'aria-hidden': true } as const;
  switch (code) {
    case 'TR': {
      const star = Array.from({ length: 10 }, (_, i) => {
        const r = i % 2 === 0 ? 2.5 : 1;
        const a = Math.PI + (i * Math.PI) / 5;
        return `${(17 + r * Math.cos(a)).toFixed(2)},${(10 + r * Math.sin(a)).toFixed(2)}`;
      }).join(' ');
      return (
        <svg {...common}>
          <rect width="30" height="20" fill="#E30A17" />
          <circle cx="11" cy="10" r="5" fill="#fff" />
          <circle cx="12.25" cy="10" r="4" fill="#E30A17" />
          <polygon points={star} fill="#fff" />
        </svg>
      );
    }
    case 'EU':
      return (
        <svg {...common}>
          <rect width="30" height="20" fill="#003399" />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i * Math.PI) / 6;
            return <circle key={i} cx={15 + 6 * Math.cos(a)} cy={10 + 6 * Math.sin(a)} r="0.95" fill="#FFCC00" />;
          })}
        </svg>
      );
    case 'US':
      return (
        <svg {...common}>
          <rect width="30" height="20" fill="#fff" />
          {Array.from({ length: 7 }, (_, i) => (
            <rect key={i} y={i * (20 / 6.5)} width="30" height={20 / 13} fill="#B22234" />
          ))}
          <rect width="13" height={(20 / 13) * 7} fill="#3C3B6E" />
        </svg>
      );
    case 'AU':
      return (
        <svg {...common}>
          <rect width="30" height="20" fill="#012169" />
          <path d="M0 0L15 10M15 0L0 10" stroke="#fff" strokeWidth="2" />
          <path d="M0 0L15 10M15 0L0 10" stroke="#E4002B" strokeWidth="0.8" />
          <path d="M7.5 0V10M0 5H15" stroke="#fff" strokeWidth="3" />
          <path d="M7.5 0V10M0 5H15" stroke="#E4002B" strokeWidth="1.6" />
          <circle cx="7.5" cy="15" r="1.6" fill="#fff" />
          <circle cx="22.5" cy="5" r="0.9" fill="#fff" />
          <circle cx="19.5" cy="10" r="0.9" fill="#fff" />
          <circle cx="25.5" cy="9" r="0.9" fill="#fff" />
          <circle cx="22.5" cy="16" r="1" fill="#fff" />
        </svg>
      );
    default:
      return (
        <svg {...common} viewBox="0 0 20 20" width={h} height={h}>
          <circle cx="10" cy="10" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M1.5 10h17M10 1.5c2.6 2.4 3.9 5.2 3.9 8.5s-1.3 6.1-3.9 8.5M10 1.5C7.4 3.9 6.1 6.7 6.1 10s1.3 6.1 3.9 8.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      );
  }
}

export function LeagueBadge({ league, size = 24, wide }: { league: LeagueDef; size?: number; wide?: boolean }) {
  const [failed, setFailed] = useState(false);
  // TBF ships wide wordmarks: shown only where the layout gives them width.
  const logoReadable = league.source !== 'tbf' || !!wide;
  if (league.logo && !failed && logoReadable && wide && league.source === 'tbf') {
    return (
      <img
        src={league.logo}
        alt=""
        height={size}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className={s.leagueLogo}
        style={{ height: size, width: 'auto', maxWidth: size * 3 }}
        onError={() => setFailed(true)}
      />
    );
  }
  if (league.logo && !failed && logoReadable) {
    return (
      <img
        src={league.logo}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        referrerPolicy={isTbf(league.logo) ? 'no-referrer' : undefined}
        className={s.leagueLogo}
        style={{ width: size, height: size }}
        onError={() => setFailed(true)}
      />
    );
  }
  const text = league.id === 'euroleague' ? 'EL' : league.id === 'eurocup' ? 'EC' : league.id === 'gleague' ? 'G' : league.short.replace(/[^A-Za-z0-9]/g, '').slice(0, 4);
  return (
    <span
      aria-hidden
      className={s.leagueTile}
      style={{ minWidth: size, height: size, padding: text.length > 2 ? '0 4px' : 0, fontSize: Math.max(8, Math.round(size * (text.length > 2 ? 0.36 : 0.42))) }}
    >
      {text}
    </span>
  );
}
