import type { LeagueDef, Play } from '../data/types';
import type { I18n } from './index';

/**
 * Play text in the UI language. Sources with prose in the same language keep
 * their own wording; everything else is rebuilt from the structured fields.
 */
export function describePlay(p: Play, i18n: I18n, league: LeagueDef | undefined, playsLang?: 'tr' | 'en'): string {
  if (playsLang && playsLang === i18n.lang && p.text) return p.text;
  const { t } = i18n;
  const d = (p.detail ?? '').toLowerCase();
  switch (p.kind) {
    case 'two':
      if (p.made) return d.includes('dunk') ? t('playDunkMade') : d.includes('layup') ? t('playLayupMade') : t('playTwoMade');
      return d.includes('layup') ? t('playLayupMiss') : t('playTwoMiss');
    case 'three':
      return p.made ? t('playThreeMade') : t('playThreeMiss');
    case 'ft':
      return p.made ? t('playFtMade') : t('playFtMiss');
    case 'rebound':
      return d.startsWith('off') ? t('playReboundOff') : d.startsWith('def') ? t('playReboundDef') : t('playRebound');
    case 'assist':
      return t('playAssist');
    case 'steal':
      return t('playSteal');
    case 'block':
      return t('playBlock');
    case 'turnover':
      return t('playTurnover');
    case 'foul':
      if (d.includes('offensive')) return t('playFoulOff');
      if (d.includes('technical')) return t('playFoulTech');
      if (d.includes('unsportsmanlike')) return t('playFoulUns');
      return t('playFoul');
    case 'timeout':
      return d === 'tv' ? t('playTimeoutTv') : t('playTimeout');
    case 'sub':
      return d === 'in' ? t('playSubIn') : d === 'out' ? t('playSubOut') : t('playSub');
    case 'period': {
      if (d === 'game-start') return t('playGameStart');
      if (d === 'game-end') return t('playGameEnd');
      const name = i18n.period(league, p.period, true);
      return d === 'end' ? t('playPeriodEnd', { p: name }) : t('playPeriodStart', { p: name });
    }
    case 'jump':
      return t('playJump');
    default:
      return p.text || t('playOther');
  }
}

/** Plays that tell the story of a game at a glance. */
export function isKeyPlay(p: Play): boolean {
  if (p.kind === 'period') return true;
  if (p.kind === 'three' && p.made) return true;
  if (p.kind === 'two' && p.made && /dunk|alley/i.test(p.detail ?? '')) return true;
  if (p.kind === 'block' || p.kind === 'steal') return true;
  if (p.kind === 'foul' && /technical|unsportsmanlike|disqualifying/i.test(p.detail ?? '')) return true;
  return false;
}
