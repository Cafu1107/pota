import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router';
import { CalendarDays, GitCompareArrows, Monitor, Moon, Newspaper, Search, Settings2, Star, Sun, Trophy, Download, X } from 'lucide-react';
import { useI18n, type TKey } from '../../i18n';
import { setLang, setTheme, useSettings, type ThemePref } from '../../state/settings';
import { openSearch, promptInstall, useCanInstall } from '../../state/ui';
import { Segmented } from '../ui/Controls';
import { LogoMark, Wordmark } from './Logo';
import { SearchDialog } from './SearchDialog';
import s from './shell.module.css';

const NAV: Array<{ to: string; key: TKey; icon: typeof Trophy; end?: boolean }> = [
  { to: '/', key: 'navScores', icon: CalendarDays, end: true },
  { to: '/ligler', key: 'navLeagues', icon: Trophy },
  { to: '/haberler', key: 'navNews', icon: Newspaper },
  { to: '/favoriler', key: 'navFavorites', icon: Star },
  { to: '/karsilastir', key: 'navCompare', icon: GitCompareArrows },
];

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const theme = useSettings((x) => x.theme);
  const lang = useSettings((x) => x.lang);
  const canInstall = useCanInstall();
  return (
    <div className={s.settings} role="dialog" aria-label={t('settings')}>
      <div className={s.settingsHead}>
        <h2 className={s.settingsTitle}>{t('settings')}</h2>
        <button type="button" className={s.iconBtn} onClick={onClose} aria-label={t('close')}>
          <X size={18} />
        </button>
      </div>
      <div className={s.settingsRow}>
        <span className={s.settingsLabel}>{t('language')}</span>
        <Segmented
          label={t('language')}
          size="sm"
          value={lang}
          onChange={(v) => setLang(v)}
          options={[
            { value: 'tr', label: 'Türkçe' },
            { value: 'en', label: 'English' },
          ]}
        />
      </div>
      <div className={s.settingsRow}>
        <span className={s.settingsLabel}>{t('theme')}</span>
        <Segmented<ThemePref>
          label={t('theme')}
          size="sm"
          value={theme}
          onChange={(v) => setTheme(v)}
          options={[
            { value: 'system', label: t('themeSystem'), icon: <Monitor size={14} /> },
            { value: 'light', label: t('themeLight'), icon: <Sun size={14} /> },
            { value: 'dark', label: t('themeDark'), icon: <Moon size={14} /> },
          ]}
        />
      </div>
      {canInstall && (
        <div className={s.settingsInstall}>
          <p>{t('installHint')}</p>
          <button type="button" className={s.primaryBtn} onClick={() => promptInstall()}>
            <Download size={16} />
            {t('installApp')}
          </button>
        </div>
      )}
      <div className={s.settingsNote}>
        <h3>{t('dataSources')}</h3>
        <p>{t('dataSourcesNote')}</p>
      </div>
    </div>
  );
}

function QuickToggles() {
  const { t, lang } = useI18n();
  const theme = useSettings((x) => x.theme);
  const next: Record<ThemePref, ThemePref> = { system: 'light', light: 'dark', dark: 'system' };
  const label = { system: t('themeSystem'), light: t('themeLight'), dark: t('themeDark') }[theme];
  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
  return (
    <div className={s.quick}>
      <div className={s.langPill} role="group" aria-label={t('language')}>
        {(['tr', 'en'] as const).map((l) => (
          <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)}>
            {l.toUpperCase()}
          </button>
        ))}
      </div>
      <button type="button" className={s.iconBtn} onClick={() => setTheme(next[theme])} aria-label={`${t('theme')}: ${label}`} title={`${t('theme')}: ${label}`}>
        <Icon size={19} />
      </button>
    </div>
  );
}

function TopBar() {
  const { t } = useI18n();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => setSettingsOpen(false), [location.pathname]);
  useEffect(() => {
    if (!settingsOpen) return;
    const onDown = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setSettingsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSettingsOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [settingsOpen]);

  return (
    <header className={s.topbar}>
      <div className={s.topbarInner}>
        <Link to="/" className={s.brand} aria-label="Pota">
          <span className={s.brandFull}>
            <Wordmark />
          </span>
          <span className={s.brandMark}>
            <LogoMark />
          </span>
        </Link>
        <nav className={s.topNav} aria-label="Pota">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `${s.topNavItem} ${isActive ? s.topNavActive : ''}`}>
              {t(n.key)}
            </NavLink>
          ))}
        </nav>
        <button type="button" className={s.searchField} onClick={openSearch} aria-label={t('navSearch')}>
          <Search size={17} aria-hidden />
          <span className={s.searchPlaceholder}>{t('searchPlaceholder')}</span>
          <kbd className={s.kbd}>{t('searchShortcut')}</kbd>
        </button>
        <div className={s.topActions} ref={wrap}>
          <QuickToggles />
          <button type="button" className={`${s.iconBtn} ${s.searchIcon}`} onClick={openSearch} aria-label={t('navSearch')}>
            <Search size={20} />
          </button>
          <button
            type="button"
            className={s.iconBtn}
            aria-label={t('settings')}
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((v) => !v)}
          >
            <Settings2 size={20} />
          </button>
          {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
        </div>
      </div>
    </header>
  );
}

function BottomNav() {
  const { t } = useI18n();
  return (
    <nav className={s.bottomNav} aria-label="Pota">
      {NAV.map((n) => {
        const Icon = n.icon;
        return (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `${s.bottomItem} ${isActive ? s.bottomActive : ''}`}>
            <Icon size={21} strokeWidth={1.9} aria-hidden />
            <span>{t(n.key)}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

export function AppShell() {
  const { t } = useI18n();

  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1200));
    const handle = idle(() => {
      void import('../../pages/Game');
      void import('../../pages/League');
      void import('../../pages/Team');
      void import('../../pages/Player');
      void import('../../pages/News');
    });
    return () => (window.cancelIdleCallback ? window.cancelIdleCallback(handle as number) : window.clearTimeout(handle as number));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        openSearch();
      } else if (e.key === '/' && !typing) {
        e.preventDefault();
        openSearch();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <a href="#main" className="skip-link">
        {t('skipToContent')}
      </a>
      <TopBar />
      <main id="main" className={s.main}>
        <Outlet />
      </main>
      <footer className={s.footer}>
        <p>{t('footerNote')}</p>
      </footer>
      <BottomNav />
      <SearchDialog />
      <ScrollRestoration />
    </>
  );
}
