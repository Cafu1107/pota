import type { Game, GameStatus, PlayerAverages, StatLine, TeamCompareRow, CompareKey } from './types';

export const num = (v: unknown, fallback = 0): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(',', '.').replace('%', ''));
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
};

export const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = num(v, NaN);
  return Number.isFinite(n) ? n : null;
};

/** "5-10" / "5/10" → [5, 10] */
export function madeAtt(v: unknown): [number, number] {
  if (typeof v !== 'string') return [0, 0];
  const m = /(\d+(?:\.\d+)?)\s*[-/]\s*(\d+(?:\.\d+)?)/.exec(v);
  return m ? [parseFloat(m[1]), parseFloat(m[2])] : [0, 0];
}

export function emptyLine(): StatLine {
  return { pts: 0, reb: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0 };
}

export const pct = (made: number, att: number): number => (att > 0 ? (made / att) * 100 : 0);

export function hexColor(c: unknown): string | undefined {
  if (typeof c !== 'string') return undefined;
  const s = c.trim().replace(/^#/, '');
  if (/^[0-9a-f]{6}$/i.test(s)) return '#' + s.toLowerCase();
  if (/^[0-9a-f]{3}$/i.test(s)) return '#' + s.split('').map((x) => x + x).join('').toLowerCase();
  return undefined;
}

/** 6' 8" → 203 cm */
export function feetInchesToCm(v: unknown): number | undefined {
  if (typeof v !== 'string') return undefined;
  const m = /(\d+)\s*'\s*(\d+)?/.exec(v);
  if (!m) return undefined;
  return Math.round((parseInt(m[1]) * 12 + (m[2] ? parseInt(m[2]) : 0)) * 2.54);
}

export function lbsToKg(v: unknown): number | undefined {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n * 0.4536) : undefined;
}

/** Seconds → "M:SS" for minutes played. */
export function minutesText(sec: number | undefined): string | undefined {
  if (sec === undefined || !Number.isFinite(sec)) return undefined;
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** "25:19" / "00:25:19" / "PT25M19S" → seconds */
export function parseMinutes(v: unknown): number | undefined {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string' || !v) return undefined;
  const iso = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(v);
  if (iso) return (+(iso[1] ?? 0)) * 3600 + (+(iso[2] ?? 0)) * 60 + (+(iso[3] ?? 0));
  const parts = v.split(':').map((p) => parseFloat(p) || 0);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  const n = parseFloat(v);
  return Number.isFinite(n) ? n * 60 : undefined;
}

export type CaseLocale = 'tr' | 'en';

const BACK = new Set(['A', 'I', 'O', 'U']);
const FRONT = new Set(['E', 'İ', 'Ö', 'Ü']);

/**
 * Lower-cases an all-caps word. Turkish sources write dotted capitals as "İ",
 * so a plain "I" is either a Turkish "ı" or a foreign "i"; vowel harmony with
 * the neighbouring vowels decides ("TATLICI" → "tatlıcı", "TECHNIC" → "technic").
 */
function lowerWord(w: string, locale: CaseLocale): string {
  if (locale === 'en') return w.toLowerCase();
  let out = '';
  for (let i = 0; i < w.length; i++) {
    const c = w[i];
    if (c === 'I') {
      let harmony: 'back' | 'front' | undefined;
      for (let j = i - 1; j >= 0 && !harmony; j--) harmony = BACK.has(w[j]) ? 'back' : FRONT.has(w[j]) ? 'front' : undefined;
      for (let j = i + 1; j < w.length && !harmony; j++) harmony = BACK.has(w[j]) && w[j] !== 'I' ? 'back' : FRONT.has(w[j]) ? 'front' : undefined;
      out += harmony === 'front' ? 'i' : 'ı';
    } else out += c.toLocaleLowerCase('tr-TR');
  }
  return out;
}

const isAllCaps = (s: string) => {
  const letters = s.replace(/[^A-Za-zÇĞİÖŞÜçğıöşü]/g, '');
  return letters.length > 0 && letters === letters.toLocaleUpperCase('tr-TR') && letters !== letters.toLocaleLowerCase('tr-TR');
};

export function titleCase(s: string, locale: CaseLocale = 'tr'): string {
  return s
    .split(/(\s+|-|'|\.)/)
    .map((w) => {
      if (!w || /^(\s+|-|'|\.)$/.test(w)) return w;
      const lower = lowerWord(w, locale);
      const first = lower.charAt(0);
      return (locale === 'tr' ? first.toLocaleUpperCase('tr-TR') : first.toUpperCase()) + lower.slice(1);
    })
    .join('');
}

/** Title-case names that sources ship in capitals ("GARCIA, DAVID" → "David Garcia"). */
export function personName(raw: string | undefined | null, locale: CaseLocale = 'en'): string {
  if (!raw) return '';
  let s = raw.trim();
  if (s.includes(',')) {
    const [last, first] = s.split(',').map((x) => x.trim());
    s = first ? `${first} ${last}` : last;
  }
  if (isAllCaps(s)) s = titleCase(s, locale);
  return s.replace(/\s+/g, ' ');
}

/** Team / place names in all caps ("ANADOLU EFES") become title case, keeping short codes ("MCT", "ABD"). */
export function teamName(raw: string | undefined | null, locale: CaseLocale = 'tr'): string {
  if (!raw) return '';
  const s = raw.trim().replace(/\s+/g, ' ');
  if (!isAllCaps(s)) return s;
  const letters = s.replace(/[^A-Za-zÇĞİÖŞÜ]/g, '');
  if (letters.length <= 3) return s;
  return s
    .split(' ')
    .map((w, i) =>
      i > 0 && /^(AND|THE|OF|FOR|AT|IN)$/.test(w)
        ? w.toLowerCase()
        : w.length <= 3 && /^[A-ZÇĞİÖŞÜ.]+$/.test(w) && !/^(VE|DE|DA|VS|AND|THE)$/.test(w)
          ? w
          : titleCase(w, locale),
    )
    .join(' ');
}

export function statusOrder(s: GameStatus): number {
  return s === 'live' ? 0 : s === 'scheduled' ? 1 : s === 'final' ? 2 : 3;
}

export function sortGames(games: Game[]): Game[] {
  return [...games].sort((a, b) => {
    const t = new Date(a.start).getTime() - new Date(b.start).getTime();
    if (t !== 0) return t;
    return a.home.team.name.localeCompare(b.home.team.name);
  });
}

/** Team comparison rows from two box-score total lines. */
export function compareFromTotals(home: StatLine, away: StatLine): TeamCompareRow[] {
  const two = (l: StatLine) => [l.fgm - l.tpm, l.fga - l.tpa] as const;
  const [h2m, h2a] = two(home);
  const [a2m, a2a] = two(away);
  const rows: TeamCompareRow[] = [
    { key: 'fg', home: pct(home.fgm, home.fga), away: pct(away.fgm, away.fga), homeText: `${home.fgm}/${home.fga}`, awayText: `${away.fgm}/${away.fga}`, pct: true },
    { key: 'twoPct', home: pct(h2m, h2a), away: pct(a2m, a2a), homeText: `${h2m}/${h2a}`, awayText: `${a2m}/${a2a}`, pct: true },
    { key: 'tp', home: pct(home.tpm, home.tpa), away: pct(away.tpm, away.tpa), homeText: `${home.tpm}/${home.tpa}`, awayText: `${away.tpm}/${away.tpa}`, pct: true },
    { key: 'ft', home: pct(home.ftm, home.fta), away: pct(away.ftm, away.fta), homeText: `${home.ftm}/${home.fta}`, awayText: `${away.ftm}/${away.fta}`, pct: true },
    { key: 'reb', home: home.reb, away: away.reb },
    { key: 'oreb', home: home.oreb, away: away.oreb },
    { key: 'dreb', home: home.dreb, away: away.dreb },
    { key: 'ast', home: home.ast, away: away.ast },
    { key: 'stl', home: home.stl, away: away.stl },
    { key: 'blk', home: home.blk, away: away.blk },
    { key: 'tov', home: home.tov, away: away.tov, inverse: true },
    { key: 'pf', home: home.pf, away: away.pf, inverse: true },
  ];
  if (home.eff !== undefined && away.eff !== undefined) rows.push({ key: 'eff', home: home.eff, away: away.eff });
  return rows;
}

export function pushCompare(rows: TeamCompareRow[], key: CompareKey, home: unknown, away: unknown, extra: Partial<TeamCompareRow> = {}) {
  const h = numOrNull(home);
  const a = numOrNull(away);
  if (h === null || a === null) return;
  rows.push({ key, home: h, away: a, ...extra });
}

export function averagesFromTotals(t: StatLine & { gp: number; gs?: number }): PlayerAverages {
  const g = t.gp || 1;
  return {
    gp: t.gp,
    gs: t.gs,
    min: t.sec !== undefined ? t.sec / 60 / g : undefined,
    pts: t.pts / g,
    reb: t.reb / g,
    oreb: t.oreb / g,
    dreb: t.dreb / g,
    ast: t.ast / g,
    stl: t.stl / g,
    blk: t.blk / g,
    tov: t.tov / g,
    pf: t.pf / g,
    eff: t.eff !== undefined ? t.eff / g : undefined,
    fgPct: t.fga ? pct(t.fgm, t.fga) : undefined,
    tpPct: t.tpa ? pct(t.tpm, t.tpa) : undefined,
    ftPct: t.fta ? pct(t.ftm, t.fta) : undefined,
    fgm: t.fgm / g,
    fga: t.fga / g,
    tpm: t.tpm / g,
    tpa: t.tpa / g,
    ftm: t.ftm / g,
    fta: t.fta / g,
  };
}

/** Efficiency (PIR-like): PTS+REB+AST+STL+BLK − missed FG − missed FT − TOV. */
export function efficiency(l: StatLine): number {
  return l.pts + l.reb + l.ast + l.stl + l.blk - (l.fga - l.fgm) - (l.fta - l.ftm) - l.tov;
}

export function sumLines(lines: StatLine[]): StatLine {
  const t = emptyLine();
  let sec = 0;
  let hasSec = false;
  for (const l of lines) {
    t.pts += l.pts; t.reb += l.reb; t.oreb += l.oreb; t.dreb += l.dreb; t.ast += l.ast; t.stl += l.stl;
    t.blk += l.blk; t.tov += l.tov; t.pf += l.pf; t.fgm += l.fgm; t.fga += l.fga; t.tpm += l.tpm;
    t.tpa += l.tpa; t.ftm += l.ftm; t.fta += l.fta;
    if (l.sec !== undefined) { sec += l.sec; hasSec = true; }
    if (l.eff !== undefined) t.eff = (t.eff ?? 0) + l.eff;
  }
  if (hasSec) t.sec = sec;
  return t;
}
