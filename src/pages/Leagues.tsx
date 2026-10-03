import { Link } from 'react-router';
import { ChevronRight } from 'lucide-react';
import { LEAGUES, REGIONS } from '../data/leagues';
import { useAllGames } from '../data/queries';
import type { Region } from '../data/types';
import { useI18n, type TKey } from '../i18n';
import { todayKey } from '../lib/time';
import { togglePinnedLeague, useFavorites } from '../state/favorites';
import { PageStack, Section } from '../components/layout/Page';
import { Flag, LeagueBadge } from '../components/ui/Media';
import { LiveDot } from '../components/ui/Live';
import { Pin } from 'lucide-react';
import s from './leagues.module.css';

const REGION_KEY: Record<Region, TKey> = { tr: 'regionTr', eu: 'regionEu', us: 'regionUs', world: 'regionWorld' };

export function LeaguesPage() {
  const { t, lang } = useI18n();
  const pinned = useFavorites((f) => f.leagues);
  const today = useAllGames(todayKey());
  const count = (id: string) => today.byLeague.find((r) => r.league.id === id);
  return (
    <PageStack>
      <header className={s.intro}>
        <h1 className={s.title}>{t('leaguesTitle')}</h1>
        <p className={s.lead}>{t('leaguesIntro')}</p>
      </header>
      {REGIONS.map((r) => (
        <Section
          key={r}
          title={
            <span className={s.regionTitle}>
              <Flag code={r === 'tr' ? 'TR' : r === 'eu' ? 'EU' : r === 'us' ? 'US' : 'WORLD'} size={18} />
              {t(REGION_KEY[r])}
            </span>
          }
        >
          <div className={s.grid}>
            {LEAGUES.filter((l) => l.region === r).map((l) => {
              const c = count(l.id);
              const live = c?.games.filter((g) => g.status === 'live').length ?? 0;
              const isPinned = pinned.includes(l.id);
              return (
                <div key={l.id} className={s.card}>
                  <Link to={`/lig/${l.id}`} className={s.cardLink}>
                    <LeagueBadge league={l} size={44} />
                    <span className={s.cardText}>
                      <span className={s.name}>{l.name[lang]}</span>
                      <span className={s.meta}>
                        {l.short}
                        {l.gender === 'w' && ` · ${t('women')}`}
                        {c && c.games.length > 0 && (
                          <>
                            {' · '}
                            {t('gamesCount', { n: c.games.length })}
                          </>
                        )}
                      </span>
                    </span>
                    {live > 0 && (
                      <span className={s.live}>
                        <LiveDot />
                        {live}
                      </span>
                    )}
                    <ChevronRight size={18} className={s.chev} aria-hidden />
                  </Link>
                  <button
                    type="button"
                    className={`${s.pin} ${isPinned ? s.pinOn : ''}`}
                    aria-pressed={isPinned}
                    aria-label={isPinned ? t('unpinLeague') : t('pinLeague')}
                    title={isPinned ? t('unpinLeague') : t('pinLeague')}
                    onClick={() => togglePinnedLeague(l.id)}
                  >
                    <Pin size={15} fill={isPinned ? 'currentColor' : 'none'} />
                  </button>
                </div>
              );
            })}
          </div>
        </Section>
      ))}
    </PageStack>
  );
}
