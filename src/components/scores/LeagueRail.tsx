import { Link } from 'react-router';
import { Pin } from 'lucide-react';
import type { LeagueDef, Region } from '../../data/types';
import { LEAGUES, REGIONS } from '../../data/leagues';
import { useI18n, type TKey } from '../../i18n';
import { useFavorites } from '../../state/favorites';
import { LeagueBadge } from '../ui/Media';
import { LiveDot } from '../ui/Live';
import s from './scores.module.css';

const REGION_KEY: Record<Region, TKey> = { tr: 'regionTr', eu: 'regionEu', us: 'regionUs', world: 'regionWorld' };

export interface RailCounts {
  games: number;
  live: number;
}

export function LeagueRail({ counts, onJump }: { counts: Map<string, RailCounts>; onJump: (league: LeagueDef) => void }) {
  const { t, lang } = useI18n();
  const pinned = useFavorites((f) => f.leagues);
  const pinnedLeagues = LEAGUES.filter((l) => pinned.includes(l.id));

  const item = (l: LeagueDef) => {
    const c = counts.get(l.id);
    const has = (c?.games ?? 0) > 0;
    const content = (
      <>
        <LeagueBadge league={l} size={20} />
        <span className={s.railName}>{l.name[lang]}</span>
        {c && c.live > 0 ? (
          <span className={s.railLive}>
            <LiveDot />
            {c.live}
          </span>
        ) : has ? (
          <span className={s.railCount}>{c!.games}</span>
        ) : null}
      </>
    );
    return has ? (
      <button key={l.id} type="button" className={s.railItem} onClick={() => onJump(l)}>
        {content}
      </button>
    ) : (
      <Link key={l.id} to={`/lig/${l.id}`} className={`${s.railItem} ${s.railIdle}`}>
        {content}
      </Link>
    );
  };

  return (
    <nav className={s.rail} aria-label={t('allLeagues')}>
      {pinnedLeagues.length > 0 && (
        <div className={s.railGroup}>
          <h2 className={s.railTitle}>
            <Pin size={12} aria-hidden />
            {t('pinnedLeagues')}
          </h2>
          {pinnedLeagues.map(item)}
        </div>
      )}
      {REGIONS.map((r) => (
        <div key={r} className={s.railGroup}>
          <h2 className={s.railTitle}>{t(REGION_KEY[r])}</h2>
          {LEAGUES.filter((l) => l.region === r).map(item)}
        </div>
      ))}
    </nav>
  );
}
