import { Link } from 'react-router';
import { ChevronRight, Pin } from 'lucide-react';
import type { Game, LeagueDef } from '../../data/types';
import { useI18n } from '../../i18n';
import { Flag, LeagueBadge } from '../ui/Media';
import { LiveDot } from '../ui/Live';
import { GameRow } from './GameRow';
import { useGamesWithVideo } from '../../data/videos';
import s from './games.module.css';

export function LeagueGroup({
  league,
  games,
  favorites,
  pinned,
  videos,
}: {
  league: LeagueDef;
  games: Game[];
  favorites?: Set<string>;
  pinned?: boolean;
  /** Look up game videos (enabled once the score lists have loaded). */
  videos?: boolean;
}) {
  const withVideo = useGamesWithVideo(league.id, games, !!videos);
  const { t, lang } = useI18n();
  const live = games.filter((g) => g.status === 'live').length;
  const region = { tr: t('regionTr'), eu: t('regionEu'), us: t('regionUs'), world: t('regionWorld') }[league.region];
  const headingId = `lg-${league.id}`;
  return (
    <section className={s.group} aria-labelledby={headingId}>
      <header className={s.groupHeader}>
        <Link to={`/lig/${league.id}`} className={s.groupLink}>
          <LeagueBadge league={league} size={22} />
          <span className={s.groupText}>
            <span className={s.groupName} id={headingId}>
              {league.name[lang]}
            </span>
            <span className={s.groupMeta}>
              <Flag code={league.flag} size={14} />
              {region}
              {league.gender === 'w' && league.region !== 'tr' ? ` · ${t('women')}` : ''}
            </span>
          </span>
          {pinned && <Pin aria-hidden size={13} className={s.groupPin} />}
          {live > 0 && (
            <span className={s.groupLive}>
              <LiveDot />
              {live}
            </span>
          )}
          <ChevronRight aria-hidden size={18} className={s.groupChevron} />
        </Link>
      </header>
      <div className={s.groupRows}>
        {games.map((g) => (
          <GameRow key={g.id} game={g} league={league} favorites={favorites} hasVideo={withVideo.has(g.id)} />
        ))}
      </div>
    </section>
  );
}
