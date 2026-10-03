import type { LeagueDef, Region } from './types';

const TBF_LOGO = 'https://tbf.org.tr/assets/images/sites-logo/';
const ESPN_LEAGUE_LOGO = 'https://a.espncdn.com/i/teamlogos/leagues/500/';

// Every league with a free data source (verified 2026-10-02). Order is the
// default reading order on the scores page: Turkey, Europe, USA, world.
export const LEAGUES: LeagueDef[] = [
  {
    id: 'bsl', source: 'tbf', tbfPrefix: 'bsl', short: 'BSL', region: 'tr', flag: 'TR', gender: 'm',
    name: { tr: 'Basketbol Süper Ligi', en: 'Turkish Super League' },
    periodMinutes: 10, periods: 4, court: 'fiba', order: 1, logo: TBF_LOGO + 'bslrenkli.svg',
  },
  {
    id: 'kbsl', source: 'tbf', tbfPrefix: 'kbsl', short: 'KBSL', region: 'tr', flag: 'TR', gender: 'w',
    name: { tr: 'Kadınlar Basketbol Süper Ligi', en: 'Turkish Women’s Super League' },
    periodMinutes: 10, periods: 4, court: 'fiba', order: 2, logo: TBF_LOGO + 'kbslrenkli.svg',
  },
  {
    id: 'tbl', source: 'tbf', tbfPrefix: 'tbl', short: 'TBL', region: 'tr', flag: 'TR', gender: 'm',
    name: { tr: 'Türkiye Basketbol Ligi', en: 'Turkish Basketball League' },
    periodMinutes: 10, periods: 4, court: 'fiba', order: 3, logo: TBF_LOGO + 'tblrenkli.svg',
  },
  {
    id: 'tkbl', source: 'tbf', tbfPrefix: 'tkbl', short: 'TKBL', region: 'tr', flag: 'TR', gender: 'w',
    name: { tr: 'Türkiye Kadınlar Basketbol Ligi', en: 'Turkish Women’s Basketball League' },
    periodMinutes: 10, periods: 4, court: 'fiba', order: 4, logo: TBF_LOGO + 'tkblrenkli.svg',
  },
  {
    id: 'tb2l', source: 'tbf', tbfPrefix: 'tb2l', short: 'TB2L', region: 'tr', flag: 'TR', gender: 'm',
    name: { tr: 'Türkiye Basketbol 2. Ligi', en: 'Turkish Basketball 2nd League' },
    periodMinutes: 10, periods: 4, court: 'fiba', order: 5, logo: TBF_LOGO + 'tb2lrenkli.svg',
  },
  {
    id: 'bgl', source: 'tbf', tbfPrefix: 'bgl', short: 'BGL', region: 'tr', flag: 'TR', gender: 'm',
    name: { tr: 'Basketbol Gençler Ligi', en: 'Turkish Youth League' },
    periodMinutes: 10, periods: 4, court: 'fiba', order: 6, logo: TBF_LOGO + 'BGL_lkerlogorenklicropped1.svg',
  },
  {
    id: 'bglk', source: 'tbf', tbfPrefix: 'bglk', short: 'BGLK', region: 'tr', flag: 'TR', gender: 'w',
    name: { tr: 'Basketbol Gençler Ligi Kızlar', en: 'Turkish Girls’ Youth League' },
    periodMinutes: 10, periods: 4, court: 'fiba', order: 7, logo: TBF_LOGO + 'BGL_lkerlogorenklicropped1.svg',
  },
  {
    id: 'ebbl', source: 'tbf', tbfPrefix: 'ebbl', short: 'EBBL', region: 'tr', flag: 'TR', gender: 'm',
    name: { tr: 'Erkekler Bölgesel Basketbol Ligi', en: 'Men’s Regional League' },
    periodMinutes: 10, periods: 4, court: 'fiba', order: 8, logo: TBF_LOGO + 'ebbl-renkli.svg',
  },
  {
    id: 'kbbl', source: 'tbf', tbfPrefix: 'kbbl', short: 'KBBL', region: 'tr', flag: 'TR', gender: 'w',
    name: { tr: 'Kadınlar Bölgesel Basketbol Ligi', en: 'Women’s Regional League' },
    periodMinutes: 10, periods: 4, court: 'fiba', order: 9, logo: TBF_LOGO + 'kbbl-renkli.svg',
  },
  {
    id: 'euroleague', source: 'euroleague', elCode: 'E', short: 'EuroLeague', region: 'eu', flag: 'EU', gender: 'm',
    name: { tr: 'EuroLeague', en: 'EuroLeague' },
    periodMinutes: 10, periods: 4, court: 'fiba', order: 10,
  },
  {
    id: 'eurocup', source: 'euroleague', elCode: 'U', short: 'EuroCup', region: 'eu', flag: 'EU', gender: 'm',
    name: { tr: 'EuroCup', en: 'EuroCup' },
    periodMinutes: 10, periods: 4, court: 'fiba', order: 11,
  },
  {
    id: 'nba', source: 'espn', espnSlug: 'nba', short: 'NBA', region: 'us', flag: 'US', gender: 'm',
    name: { tr: 'NBA', en: 'NBA' },
    periodMinutes: 12, periods: 4, court: 'nba', order: 12, logo: ESPN_LEAGUE_LOGO + 'nba.png',
  },
  {
    id: 'wnba', source: 'espn', espnSlug: 'wnba', short: 'WNBA', region: 'us', flag: 'US', gender: 'w',
    name: { tr: 'WNBA', en: 'WNBA' },
    periodMinutes: 10, periods: 4, court: 'fiba', order: 13, logo: ESPN_LEAGUE_LOGO + 'wnba.png',
  },
  {
    id: 'gleague', source: 'espn', espnSlug: 'nba-development', short: 'G League', region: 'us', flag: 'US', gender: 'm',
    name: { tr: 'NBA G League', en: 'NBA G League' },
    periodMinutes: 12, periods: 4, court: 'nba', order: 14,
  },
  {
    id: 'ncaam', source: 'espn', espnSlug: 'mens-college-basketball', short: 'NCAA', region: 'us', flag: 'US', gender: 'm',
    name: { tr: 'NCAA Erkekler', en: 'NCAA Men' },
    periodMinutes: 20, periods: 2, court: 'ncaa', order: 15, logo: 'https://a.espncdn.com/i/espn/misc_logos/500/ncaa.png',
  },
  {
    id: 'ncaaw', source: 'espn', espnSlug: 'womens-college-basketball', short: 'NCAAW', region: 'us', flag: 'US', gender: 'w',
    name: { tr: 'NCAA Kadınlar', en: 'NCAA Women' },
    periodMinutes: 10, periods: 4, court: 'ncaa', order: 16, logo: 'https://a.espncdn.com/i/espn/misc_logos/500/ncaa.png',
  },
  {
    id: 'nbl', source: 'espn', espnSlug: 'nbl', short: 'NBL', region: 'world', flag: 'AU', gender: 'm',
    name: { tr: 'NBL (Avustralya)', en: 'NBL (Australia)' },
    periodMinutes: 10, periods: 4, court: 'fiba', order: 17, logo: ESPN_LEAGUE_LOGO + 'nbl.png',
  },
  {
    id: 'fiba', source: 'espn', espnSlug: 'fiba', short: 'FIBA', region: 'world', flag: 'WORLD', gender: 'm',
    name: { tr: 'FIBA Milli Takımlar', en: 'FIBA National Teams' },
    periodMinutes: 10, periods: 4, court: 'fiba', order: 18, logo: ESPN_LEAGUE_LOGO + 'fiba.png',
  },
];

const byId = new Map(LEAGUES.map((l) => [l.id, l]));

export function getLeague(id: string | undefined): LeagueDef | undefined {
  return id ? byId.get(id) : undefined;
}

export const REGIONS: Region[] = ['tr', 'eu', 'us', 'world'];

export function leaguesByRegion(region: Region): LeagueDef[] {
  return LEAGUES.filter((l) => l.region === region);
}
