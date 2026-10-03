import { espnProvider } from './providers/espn';
import { euroleagueProvider } from './providers/euroleague';
import { tbfProvider } from './providers/tbf';
import type { LeagueDef, Provider, SourceId } from './types';

const PROVIDERS: Record<SourceId, Provider> = {
  espn: espnProvider,
  euroleague: euroleagueProvider,
  tbf: tbfProvider,
};

export function providerFor(league: LeagueDef): Provider {
  return PROVIDERS[league.source];
}
