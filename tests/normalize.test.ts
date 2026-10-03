import { describe, expect, it } from 'vitest';
import { compareFromTotals, efficiency, emptyLine, feetInchesToCm, madeAtt, parseMinutes, personName, teamName } from '../src/data/normalize';
import { deltaE, contrast, teamColors } from '../src/lib/color';
import { addDays, istanbulToIso, zoneDatesForLocalDay, clockToSeconds } from '../src/lib/time';
import { fold, matches } from '../src/lib/text';
import { courtFor, zoneOf, cornerMeetY } from '../src/components/shots/court';
import { getLeague } from '../src/data/leagues';

describe('names', () => {
  it('turns "LAST, FIRST" capitals into a readable name', () => {
    expect(personName('GARCIA, DAVID')).toBe('David Garcia');
    expect(personName('LARKIN, SHANE')).toBe('Shane Larkin');
  });

  it('keeps mixed-case names untouched', () => {
    expect(personName('Terrell Carter II', 'tr')).toBe('Terrell Carter II');
    expect(personName("De'Aaron Fox")).toBe("De'Aaron Fox");
  });

  it('uses Turkish casing rules with vowel harmony for dotless I', () => {
    expect(personName('AHMET TATLICI', 'tr')).toBe('Ahmet Tatlıcı');
    expect(teamName('PİZZABULLS BORDO BANDIRMA')).toBe('Pizzabulls Bordo Bandırma');
    expect(teamName('ALİAĞA PETKİM SPOR')).toBe('Aliağa Petkim Spor');
  });

  it('keeps short codes, lowercases joining words', () => {
    expect(teamName('GALATASARAY MCT TECHNIC')).toBe('Galatasaray MCT Technic');
    expect(teamName('ABD')).toBe('ABD');
    expect(teamName('ULKER SPORTS AND EVENT HALL', 'en')).toBe('Ulker Sports and Event Hall');
  });
});

describe('stat parsing', () => {
  it('parses made-attempted pairs and minutes', () => {
    expect(madeAtt('5-10')).toEqual([5, 10]);
    expect(madeAtt('3/4')).toEqual([3, 4]);
    expect(parseMinutes('25:19')).toBe(1519);
    expect(parseMinutes('00:25:19')).toBe(1519);
    expect(parseMinutes('PT25M19S')).toBe(1519);
  });

  it('converts imperial sizes', () => {
    expect(feetInchesToCm('6\' 8"')).toBe(203);
  });

  it('computes NBA-style efficiency like TBF does', () => {
    // Yiğitcan Saybir vs Bandırma, 25.09.2026: TBF lists efficiency 12.
    const line = { ...emptyLine(), pts: 18, reb: 2, ast: 1, stl: 1, blk: 1, tov: 3, fgm: 7, fga: 14, ftm: 3, fta: 4 };
    expect(efficiency(line)).toBe(12);
  });

  it('builds comparison rows with inverse stats', () => {
    const h = { ...emptyLine(), fgm: 30, fga: 60, tov: 10 };
    const a = { ...emptyLine(), fgm: 20, fga: 60, tov: 15 };
    const rows = compareFromTotals(h, a);
    expect(rows.find((r) => r.key === 'fg')?.home).toBe(50);
    expect(rows.find((r) => r.key === 'tov')?.inverse).toBe(true);
  });
});

describe('time', () => {
  it('converts Istanbul wall clock to UTC', () => {
    expect(istanbulToIso('2026-10-02T19:00:00')).toBe('2026-10-02T16:00:00.000Z');
  });

  it('adds days across month ends', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('maps a local day to one or two US Eastern dates', () => {
    const dates = zoneDatesForLocalDay('2026-10-02', 'America/New_York');
    expect(dates.length).toBeGreaterThanOrEqual(1);
    expect(dates.length).toBeLessThanOrEqual(2);
  });

  it('reads game clocks', () => {
    expect(clockToSeconds('5:50')).toBe(350);
    expect(clockToSeconds('34.2')).toBeCloseTo(34.2);
  });
});

describe('search folding', () => {
  it('matches without Turkish letters', () => {
    expect(fold('Fenerbahçe Beşiktaş Iğdır')).toBe('fenerbahce besiktas igdir');
    expect(matches('Karşıyaka', 'karsi')).toBe(true);
    expect(matches('Galatasaray MCT Technic', 'technic')).toBe(true);
  });
});

describe('court geometry', () => {
  it('meets the FIBA corner three at the right height', () => {
    const g = courtFor(getLeague('bsl'));
    expect(cornerMeetY(g)).toBeCloseTo(2.99, 1);
  });

  it('classifies shot zones', () => {
    const g = courtFor(getLeague('euroleague'));
    expect(zoneOf({ x: 0, y: 2, made: true, value: 2, side: 'home' }, g)).toBe('paint');
    expect(zoneOf({ x: 4, y: 6, made: true, value: 2, side: 'home' }, g)).toBe('mid');
    expect(zoneOf({ x: 6.8, y: 1, made: false, value: 3, side: 'home' }, g)).toBe('three');
  });
});

describe('team colors', () => {
  it('replaces colors that vanish on the surface or collide', () => {
    const navy = { id: '1', name: 'A', color: '#0a1a3a' };
    const navy2 = { id: '2', name: 'B', color: '#0b1c3c' };
    const c = teamColors(navy, navy2, 'dark');
    expect(contrast(c.home, '#171a20')).toBeGreaterThanOrEqual(3);
    expect(deltaE(c.home, c.away)).toBeGreaterThanOrEqual(15);
  });

  it('keeps distinct, readable team colors', () => {
    const green = { id: '1', name: 'Karşıyaka', color: '#1a8c3a' };
    const red = { id: '2', name: 'Galatasaray', color: '#c8102e' };
    expect(teamColors(green, red, 'light')).toEqual({ home: '#1a8c3a', away: '#c8102e' });
  });
});
