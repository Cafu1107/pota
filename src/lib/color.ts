// Runtime checks for team colors. Team colors come from the data sources, so
// each one is tested against the surface it is drawn on (contrast ≥ 3:1, enough
// chroma to read as a hue) and against the opposing team (OKLab ΔE ≥ 15).
// Anything that fails falls back to the validated series palette.

import type { TeamRef } from '../data/types';

type RGB = [number, number, number];

export const SERIES = {
  light: { s1: '#2a78d6', s2: '#eb6834' },
  dark: { s1: '#3987e5', s2: '#d95926' },
} as const;

export const SURFACE = { light: '#ffffff', dark: '#171a20' } as const;

export function hexToRgb(hex: string): RGB | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const lin = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

export function luminance([r, g, b]: RGB): number {
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(a: string, b: string): number {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  if (!ra || !rb) return 1;
  const la = luminance(ra);
  const lb = luminance(rb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function oklab(hex: string): [number, number, number] | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map(lin) as RGB;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** OKLab distance ×100 (the dataviz method's ΔE). */
export function deltaE(a: string, b: string): number {
  const A = oklab(a);
  const B = oklab(b);
  if (!A || !B) return 0;
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]) * 100;
}

export function chroma(hex: string): number {
  const L = oklab(hex);
  return L ? Math.hypot(L[1], L[2]) : 0;
}

function usable(hex: string | undefined, mode: 'light' | 'dark'): hex is string {
  if (!hex) return false;
  return contrast(hex, SURFACE[mode]) >= 3 && chroma(hex) >= 0.06;
}

export interface TeamColors {
  home: string;
  away: string;
}

/** Validated identity colors for the two teams of a game, for the given theme. */
export function teamColors(home: TeamRef, away: TeamRef, mode: 'light' | 'dark'): TeamColors {
  const series = SERIES[mode];
  const h = [home.color, home.color2].find((c) => usable(c, mode)) ?? series.s1;
  const own = [away.color, away.color2].filter((c): c is string => usable(c, mode));
  const a =
    own.find((c) => deltaE(c, h) >= 15) ??
    [series.s2, series.s1].find((c) => deltaE(c, h) >= 15) ??
    series.s2;
  return { home: h, away: a };
}

/** A single team's identity color (team pages, shot charts). */
export function teamColor(team: TeamRef | undefined, mode: 'light' | 'dark'): string {
  return [team?.color, team?.color2].find((c) => usable(c, mode)) ?? SERIES[mode].s1;
}

/** Translucent wash of a color for large tinted regions (headers). */
export function wash(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return 'transparent';
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

/** Ink (dark or white) readable on top of a fill. */
export function inkOn(hex: string): string {
  return contrast(hex, '#ffffff') >= 4.5 ? '#ffffff' : '#12151a';
}
