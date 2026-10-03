import { useMemo } from 'react';
import { tr } from './tr';
import { en } from './en';
import type { Dict } from './tr';
import type { Game, Lang, LeagueDef } from '../data/types';
import { useSettings } from '../state/settings';
import { parseDayKey, todayKey, addDays } from '../lib/time';

export type TKey = keyof typeof tr;
const DICTS: Record<Lang, Dict> = { tr, en };

function interpolate(s: string, vars?: Record<string, string | number>) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

export function makeI18n(lang: Lang) {
  const dict = DICTS[lang];
  const locale = lang === 'tr' ? 'tr-TR' : 'en-GB';
  const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat | Intl.RelativeTimeFormat>();
  const nf = (digits: number, style?: 'percent') => {
    const key = `n${digits}${style ?? ''}`;
    let f = cache.get(key) as Intl.NumberFormat | undefined;
    if (!f) {
      f = new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits, style });
      cache.set(key, f);
    }
    return f;
  };
  const df = (key: string, opts: Intl.DateTimeFormatOptions) => {
    let f = cache.get(key) as Intl.DateTimeFormat | undefined;
    if (!f) {
      f = new Intl.DateTimeFormat(locale, opts);
      cache.set(key, f);
    }
    return f;
  };

  const t = (key: TKey, vars?: Record<string, string | number>) => interpolate(dict[key] ?? tr[key] ?? key, vars);

  const num = (n: number | undefined | null, digits = 0) =>
    n === undefined || n === null || !Number.isFinite(n) ? '–' : nf(digits).format(n);
  /** Average-style number: one decimal, but whole numbers stay whole when exact. */
  const avg = (n: number | undefined | null) => num(n, 1);
  const pct = (n: number | undefined | null, digits = 1) =>
    n === undefined || n === null || !Number.isFinite(n) ? '–' : nf(digits, 'percent').format(n / 100);

  const time = (iso: string) => df('time', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  const dateShort = (iso: string) => df('dshort', { day: 'numeric', month: 'short' }).format(new Date(iso));
  const dateLong = (iso: string) => df('dlong', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
  const dateMedium = (iso: string) => df('dmed', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso));
  const dateShortYear = (iso: string) => df('dsy', { day: 'numeric', month: 'short', year: '2-digit' }).format(new Date(iso));
  const dateNumeric = (iso: string) => df('dnum', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));
  const weekdayShort = (d: Date) => df('wd', { weekday: 'short' }).format(d);
  const dayMonth = (d: Date) => df('dm', { day: 'numeric', month: 'short' }).format(d);

  const dayLabel = (key: string) => {
    const today = todayKey();
    if (key === today) return t('today');
    if (key === addDays(today, -1)) return t('yesterday');
    if (key === addDays(today, 1)) return t('tomorrow');
    return weekdayShort(parseDayKey(key));
  };

  const relativeIn = (iso: string) => {
    const mins = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60000));
    if (mins < 60) return lang === 'tr' ? `${mins} dk` : `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return lang === 'tr' ? `${h} sa ${m} dk` : `${h}h ${m}m`;
  };

  /** "12 dk. önce" / "12 min. ago"; past a day it becomes a date. */
  const ago = (iso: string) => {
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return t('agoNow');
    let rf = cache.get('rel') as Intl.RelativeTimeFormat | undefined;
    if (!rf) {
      rf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' });
      cache.set('rel', rf);
    }
    if (mins < 60) return rf.format(-mins, 'minute');
    if (mins < 24 * 60) return rf.format(-Math.floor(mins / 60), 'hour');
    return dateShort(iso);
  };

  /** "3Ç", "Q3", "UZ", "OT2", "1Y". */
  const period = (league: LeagueDef | undefined, p: number | undefined, long = false) => {
    if (!p) return '';
    const regs = league?.periods ?? 4;
    if (p > regs) {
      const n = p - regs;
      if (long) return n > 1 ? `${t('periodOtLong')} ${n}` : t('periodOtLong');
      return n > 1 ? t('periodOtN', { n }) : t('periodOt');
    }
    if (regs === 2) return t(long ? 'periodHLong' : 'periodH', { n: p });
    return t(long ? 'periodQLong' : 'periodQ', { n: p });
  };

  /** Compact status for the status column of a game row. */
  const statusShort = (g: Game, league?: LeagueDef): { top: string; bottom?: string } => {
    switch (g.status) {
      case 'live':
        if (g.isHalftime) return { top: t('statusHalftime') };
        if (!g.period) return { top: t('statusLiveShort'), bottom: g.isBreak ? undefined : g.clock };
        if (g.isBreak) return { top: period(league, g.period), bottom: t('statusBreak') };
        return { top: period(league, g.period), bottom: g.clock };
      case 'final':
        return { top: (g.period ?? 0) > (league?.periods ?? 4) ? t('statusFinalOt') : t('statusFinal') };
      case 'postponed':
        return { top: t('statusPostponed') };
      case 'cancelled':
        return { top: t('statusCancelled') };
      default:
        return { top: g.timeTbd ? '–' : time(g.start) };
    }
  };

  const statusLong = (g: Game, league?: LeagueDef): string => {
    switch (g.status) {
      case 'live':
        if (g.isHalftime) return t('statusHalftimeLong');
        if (g.isBreak) return g.period ? t('periodEndLong', { p: period(league, g.period, true) }) : t('statusBreakLong');
        if (!g.period) return g.clock ? `${t('statusLiveShort')} · ${g.clock}` : t('statusLiveShort');
        return `${period(league, g.period, true)}${g.clock ? ' · ' + g.clock : ''}`;
      case 'final':
        return (g.period ?? 0) > (league?.periods ?? 4) ? `${t('statusFinalLong')} (${t('periodOt')})` : t('statusFinalLong');
      case 'postponed':
        return t('statusPostponedLong');
      case 'cancelled':
        return t('statusCancelledLong');
      default:
        return g.timeTbd ? t('timeTbd') : t('statusScheduledLong');
    }
  };

  /** "W3" → week 3, "R12" → round 12, anything else as-is. */
  const roundLabel = (r: string | undefined) => {
    if (!r) return '';
    const w = /^W(\d+)$/.exec(r);
    if (w) return t('weekN', { n: w[1] });
    const m = /^R(\d+)$/.exec(r);
    if (m) return t('roundN', { n: m[1] });
    return r;
  };

  return {
    lang, locale, t, num, avg, pct, time, dateShort, dateShortYear, dateLong, dateMedium, dateNumeric, dayLabel, dayMonth,
    weekdayShort, relativeIn, ago, period, statusShort, statusLong, roundLabel,
  };
}

export type I18n = ReturnType<typeof makeI18n>;

export function useI18n(): I18n {
  const lang = useSettings((s) => s.lang);
  return useMemo(() => makeI18n(lang), [lang]);
}

export function leagueName(league: LeagueDef, lang: Lang) {
  return league.name[lang];
}
