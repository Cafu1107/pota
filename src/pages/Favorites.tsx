import { Link } from 'react-router';
import { Pin, Star } from 'lucide-react';
import { LEAGUES, getLeague } from '../data/leagues';
import { useTeam, useTeams } from '../data/queries';
import type { Game, Side } from '../data/types';
import { useI18n } from '../i18n';
import { favKey, toggleFavoriteTeam, togglePinnedLeague, useFavoriteTeamKeys, useFavorites, type FavTeam } from '../state/favorites';
import { gamePath } from '../components/games/GameRow';
import { PageStack, Section } from '../components/layout/Page';
import { StarButton } from '../components/ui/Controls';
import { LeagueBadge, TeamLogo } from '../components/ui/Media';
import { LiveDot } from '../components/ui/Live';
import { Card, EmptyState, Skeleton } from '../components/ui/States';
import s from './favorites.module.css';

function GameLine({ game, teamId, label }: { game: Game; teamId: string; label: string }) {
  const i18n = useI18n();
  const league = getLeague(game.leagueId);
  const mine: Side = game.home.team.id === teamId ? 'home' : 'away';
  const opp = game[mine === 'home' ? 'away' : 'home'];
  const won = game.status === 'final' && game[mine].winner === true;
  return (
    <Link to={gamePath(game)} className={s.gameLine}>
      <span className={s.gameLabel}>{label}</span>
      <span className={s.gameOpp}>
        <TeamLogo team={opp.team} size={18} />
        {mine === 'home' ? i18n.t('vs') : i18n.t('at')} {opp.team.short ?? opp.team.name}
      </span>
      <span className={s.gameRight}>
        {game.status === 'final' ? (
          <>
            <span className={won ? s.w : s.l}>{won ? i18n.t('formWin') : i18n.t('formLoss')}</span>
            <span className="tnum">
              {game[mine].score}-{opp.score}
            </span>
          </>
        ) : game.status === 'live' ? (
          <span className={s.live}>
            <LiveDot />
            {game[mine].score}-{opp.score} · {i18n.statusShort(game, league).top}
          </span>
        ) : (
          <span className={s.when}>
            {i18n.dateShort(game.start)} {game.timeTbd ? '' : i18n.time(game.start)}
          </span>
        )}
      </span>
    </Link>
  );
}

function FavoriteCard({ fav }: { fav: FavTeam }) {
  const i18n = useI18n();
  const league = getLeague(fav.leagueId);
  const q = useTeam(fav.leagueId, fav.id);
  const games = q.data?.games ?? [];
  const now = Date.now();
  const live = games.find((g) => g.status === 'live');
  const next = games.find((g) => g.status === 'scheduled' && new Date(g.start).getTime() > now - 3 * 3600_000);
  const last = [...games].reverse().find((g) => g.status === 'final');
  const team = q.data?.team ?? { id: fav.id, name: fav.name, logo: fav.logo, color: fav.color };
  return (
    <article className={s.card}>
      <header className={s.cardHead}>
        <Link to={`/takim/${fav.leagueId}/${encodeURIComponent(fav.id)}`} className={s.cardTeam}>
          <TeamLogo team={team} size={40} />
          <span className={s.cardText}>
            <span className={s.cardName}>{team.name}</span>
            {league && (
              <span className={s.cardLeague}>
                <LeagueBadge league={league} size={14} />
                {league.short}
                {q.data?.record && ` · ${q.data.record.w}-${q.data.record.l}`}
              </span>
            )}
          </span>
        </Link>
        <StarButton active onToggle={() => toggleFavoriteTeam(fav.leagueId, team)} labelOn={i18n.t('removeFavorite')} labelOff={i18n.t('addFavorite')} />
      </header>
      <div className={s.cardGames}>
        {q.isLoading ? (
          <Skeleton w="100%" h={64} r={8} />
        ) : (
          <>
            {live && <GameLine game={live} teamId={fav.id} label={i18n.t('featuredLive')} />}
            {!live && next && <GameLine game={next} teamId={fav.id} label={i18n.t('nextGame')} />}
            {last && <GameLine game={last} teamId={fav.id} label={i18n.t('featuredLast')} />}
            {!live && !next && !last && <p className={s.none}>{i18n.t('noGames')}</p>}
          </>
        )}
      </div>
    </article>
  );
}

function Suggestions() {
  const { t } = useI18n();
  const favs = useFavoriteTeamKeys();
  const bsl = useTeams('bsl');
  const el = useTeams('euroleague');
  const turkishEl = (el.data ?? []).filter((x) => /fenerbah|efes|beşiktaş|besiktas|galatasaray|türk telekom|turk telekom|karşıyaka|karsiyaka/i.test(x.name));
  const list = [...turkishEl.map((team) => ({ team, leagueId: 'euroleague' })), ...(bsl.data ?? []).map((team) => ({ team, leagueId: 'bsl' }))];
  if (!list.length) return null;
  return (
    <Section title={t('suggestedTeams')}>
      <div className={s.suggest}>
        {list.map(({ team, leagueId }) => {
          const on = favs.has(favKey(leagueId, team.id));
          return (
            <button key={leagueId + team.id} type="button" className={`${s.suggestItem} ${on ? s.suggestOn : ''}`} aria-pressed={on} onClick={() => toggleFavoriteTeam(leagueId, team)}>
              <TeamLogo team={team} size={22} />
              <span>{team.short ?? team.name}</span>
              <small>{getLeague(leagueId)?.short}</small>
              <Star size={14} aria-hidden fill={on ? 'currentColor' : 'none'} />
            </button>
          );
        })}
      </div>
    </Section>
  );
}

export function FavoritesPage() {
  const { t, lang } = useI18n();
  const favs = useFavorites();
  const pinned = LEAGUES.filter((l) => favs.leagues.includes(l.id));
  return (
    <PageStack>
      <header className={s.intro}>
        <h1 className={s.title}>{t('favoritesTitle')}</h1>
      </header>
      <Section title={t('favoriteTeams')}>
        {favs.teams.length ? (
          <div className={s.grid}>
            {favs.teams.map((f) => (
              <FavoriteCard key={`${f.leagueId}:${f.id}`} fav={f} />
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState icon={<Star size={22} />} title={t('noFavoritesYet')} hint={t('noFavoritesHint')} />
          </Card>
        )}
      </Section>
      {pinned.length > 0 && (
        <Section title={t('pinnedLeagues')}>
          <div className={s.pinned}>
            {pinned.map((l) => (
              <div key={l.id} className={s.pinnedItem}>
                <Link to={`/lig/${l.id}`} className={s.pinnedLink}>
                  <LeagueBadge league={l} size={28} />
                  <span>{l.name[lang]}</span>
                </Link>
                <button type="button" className={s.unpin} onClick={() => togglePinnedLeague(l.id)} aria-label={t('unpinLeague')} title={t('unpinLeague')}>
                  <Pin size={15} fill="currentColor" />
                </button>
              </div>
            ))}
          </div>
        </Section>
      )}
      <Suggestions />
    </PageStack>
  );
}
