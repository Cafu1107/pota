import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { CornerDownLeft, Loader2, Search, X } from 'lucide-react';
import { LEAGUES, getLeague } from '../../data/leagues';
import { useAllTeams, usePlayerSearch } from '../../data/queries';
import { useI18n } from '../../i18n';
import { useDebounced } from '../../lib/hooks';
import { fold, matches } from '../../lib/text';
import { closeSearch, useSearchOpen } from '../../state/ui';
import { LeagueBadge, PlayerPhoto, TeamLogo } from '../ui/Media';
import s from './shell.module.css';

interface ResultItem {
  key: string;
  to: string;
  title: string;
  meta: string;
  media: ReactNode;
}

export function SearchDialog() {
  const open = useSearchOpen();
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const dq = useDebounced(q, 280);
  const navigate = useNavigate();
  const { t, lang } = useI18n();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      requestAnimationFrame(() => input.current?.focus());
    } else if (!open && d.open) d.close();
  }, [open]);

  const teams = useAllTeams(open);
  const players = usePlayerSearch(open ? dq : '');

  const groups = useMemo(() => {
    const term = q.trim();
    if (!term) return [] as Array<{ title: string; items: ResultItem[] }>;
    const leagueItems: ResultItem[] = LEAGUES.filter((l) => matches(`${l.name.tr} ${l.name.en} ${l.short}`, term))
      .slice(0, 4)
      .map((l) => ({ key: `l:${l.id}`, to: `/lig/${l.id}`, title: l.name[lang], meta: l.short, media: <LeagueBadge league={l} size={28} /> }));
    const seen = new Set<string>();
    const teamItems: ResultItem[] = teams
      .filter(({ team }) => matches(`${team.name} ${team.short ?? ''} ${team.abbr ?? ''}`, term))
      .sort((a, b) => {
        const fa = fold(a.team.name).startsWith(fold(term)) ? 0 : 1;
        const fb = fold(b.team.name).startsWith(fold(term)) ? 0 : 1;
        return fa - fb || a.league.order - b.league.order;
      })
      .filter(({ team, league }) => {
        const k = `${league.id}:${team.id}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, 8)
      .map(({ team, league }) => ({
        key: `t:${league.id}:${team.id}`,
        to: `/takim/${league.id}/${encodeURIComponent(team.id)}`,
        title: team.name,
        meta: league.short,
        media: <TeamLogo team={team} size={28} />,
      }));
    const playerItems: ResultItem[] = term.length >= 3
      ? players.hits
          .filter((h) => matches(h.name, term))
          .slice(0, 12)
          .map((h) => ({
            key: `p:${h.leagueId}:${h.id}`,
            to: `/oyuncu/${h.leagueId}/${encodeURIComponent(h.id)}`,
            title: h.name,
            meta: [h.team, getLeague(h.leagueId)?.short].filter(Boolean).join(' · '),
            media: <PlayerPhoto src={h.photo} name={h.name} size={30} />,
          }))
      : [];
    return [
      { title: t('searchLeagues'), items: leagueItems },
      { title: t('searchTeams'), items: teamItems },
      { title: t('searchPlayers'), items: playerItems },
    ].filter((g) => g.items.length);
  }, [q, teams, players.hits, lang, t]);

  const flat = groups.flatMap((g) => g.items);
  useEffect(() => setActive(0), [q]);

  const go = (item: ResultItem | undefined) => {
    if (!item) return;
    closeSearch();
    setQ('');
    navigate(item.to);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(flat.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(flat[active]);
    }
  };

  useEffect(() => {
    document.getElementById(`sr-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const term = q.trim();
  let index = -1;
  return (
    <dialog
      ref={ref}
      className={s.searchDialog}
      aria-label={t('navSearch')}
      onClose={() => {
        closeSearch();
        setQ('');
      }}
      onClick={(e) => {
        if (e.target === ref.current) closeSearch();
      }}
    >
      <div className={s.searchBox}>
        <div className={s.searchInputRow}>
          <Search size={19} aria-hidden className={s.searchInputIcon} />
          <input
            ref={input}
            className={s.searchInput}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
            role="combobox"
            aria-expanded={flat.length > 0}
            aria-controls="search-results"
            aria-activedescendant={flat.length ? `sr-${active}` : undefined}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
          />
          {players.loading && term.length >= 3 && <Loader2 size={17} className={s.spin} aria-label={t('searchLoading')} />}
          <button type="button" className={s.iconBtn} onClick={() => closeSearch()} aria-label={t('close')}>
            <X size={18} />
          </button>
        </div>
        <div className={s.searchResults} id="search-results" role="listbox" aria-label={t('navSearch')}>
          {groups.map((g) => (
            <div key={g.title} className={s.searchGroup} role="group" aria-label={g.title}>
              <h3 className={s.searchGroupTitle}>{g.title}</h3>
              {g.items.map((it) => {
                index += 1;
                const i = index;
                return (
                  <button
                    key={it.key}
                    id={`sr-${i}`}
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    className={`${s.searchItem} ${i === active ? s.searchItemActive : ''}`}
                    onMouseMove={() => setActive(i)}
                    onClick={() => go(it)}
                  >
                    {it.media}
                    <span className={s.searchItemText}>
                      <span className={s.searchItemTitle}>{it.title}</span>
                      {it.meta && <span className={s.searchItemMeta}>{it.meta}</span>}
                    </span>
                    {i === active && <CornerDownLeft size={15} aria-hidden className={s.searchEnter} />}
                  </button>
                );
              })}
            </div>
          ))}
          {term && !groups.length && !(players.loading && term.length >= 3) && (
            <p className={s.searchEmpty}>{term.length < 3 ? t('searchMinChars') : t('searchNoResults', { q: term })}</p>
          )}
          {!term && <p className={s.searchEmpty}>{t('searchMinChars')}</p>}
        </div>
      </div>
    </dialog>
  );
}
