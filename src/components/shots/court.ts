import type { LeagueDef, Shot } from '../../data/types';

/** Half-court geometry in meters; the basket sits near y = 0 (the baseline). */
export interface CourtGeo {
  width: number;
  half: number;
  basketY: number;
  backboardY: number;
  rim: number;
  threeR: number;
  cornerX: number;
  keyW: number;
  keyL: number;
  ftR: number;
  raR: number;
  centerR: number;
}

const FIBA: CourtGeo = {
  width: 15,
  half: 14,
  basketY: 1.575,
  backboardY: 1.2,
  rim: 0.225,
  threeR: 6.75,
  cornerX: 6.6,
  keyW: 4.9,
  keyL: 5.8,
  ftR: 1.8,
  raR: 1.25,
  centerR: 1.8,
};

const NBA: CourtGeo = {
  width: 15.24,
  half: 14.33,
  basketY: 1.6,
  backboardY: 1.22,
  rim: 0.23,
  threeR: 7.24,
  cornerX: 6.71,
  keyW: 4.88,
  keyL: 5.79,
  ftR: 1.83,
  raR: 1.22,
  centerR: 1.83,
};

const NCAA: CourtGeo = { ...NBA, threeR: 6.75, cornerX: 6.6, keyW: 3.66 };

export function courtFor(league: LeagueDef | undefined): CourtGeo {
  return league?.court === 'nba' ? NBA : league?.court === 'ncaa' ? NCAA : FIBA;
}

/** y where the corner three straight lines meet the arc. */
export function cornerMeetY(g: CourtGeo): number {
  return g.basketY + Math.sqrt(Math.max(0, g.threeR ** 2 - g.cornerX ** 2));
}

export type Zone = 'paint' | 'mid' | 'three';

export function zoneOf(shot: Shot, g: CourtGeo): Zone {
  if (shot.value === 3) return 'three';
  if (Math.abs(shot.x) <= g.keyW / 2 && shot.y <= g.keyL) return 'paint';
  return 'mid';
}

export interface ZoneStat {
  made: number;
  att: number;
}

export function zoneStats(shots: Shot[], g: CourtGeo): Record<Zone | 'all', ZoneStat> {
  const out: Record<Zone | 'all', ZoneStat> = {
    paint: { made: 0, att: 0 },
    mid: { made: 0, att: 0 },
    three: { made: 0, att: 0 },
    all: { made: 0, att: 0 },
  };
  for (const s of shots) {
    const z = zoneOf(s, g);
    out[z].att++;
    out.all.att++;
    if (s.made) {
      out[z].made++;
      out.all.made++;
    }
  }
  return out;
}
