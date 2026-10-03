// Date helpers. Dates the user picks are local calendar days ("YYYY-MM-DD");
// game times are UTC instants.

const pad = (n: number) => String(n).padStart(2, '0');

export function toDayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayKey(): string {
  return toDayKey(new Date());
}

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, delta: number): string {
  const d = parseDayKey(key);
  d.setDate(d.getDate() + delta);
  return toDayKey(d);
}

export function isValidDayKey(key: string | null | undefined): key is string {
  return !!key && /^\d{4}-\d{2}-\d{2}$/.test(key) && !Number.isNaN(parseDayKey(key).getTime());
}

/** Local day key of a UTC instant. */
export function localDayOf(iso: string): string {
  return toDayKey(new Date(iso));
}

/** UTC range [start, end) of a local day. */
export function localDayRange(key: string): [number, number] {
  const start = parseDayKey(key).getTime();
  const end = parseDayKey(addDays(key, 1)).getTime();
  return [start, end];
}

function dateInZone(ms: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(
    new Date(ms),
  );
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Calendar dates in `timeZone` that overlap the given local day. */
export function zoneDatesForLocalDay(key: string, timeZone: string): string[] {
  const [start, end] = localDayRange(key);
  const a = dateInZone(start, timeZone);
  const b = dateInZone(end - 1, timeZone);
  return a === b ? [a] : [a, b];
}

/**
 * Turkey has used a fixed UTC+3 since 2016. TBF publishes local wall-clock
 * times without an offset; this turns them into UTC ISO strings.
 */
export function istanbulToIso(local: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(local);
  if (!m) return new Date(local).toISOString();
  const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 3, +m[5], +(m[6] ?? 0));
  return new Date(ms).toISOString();
}

export function minutesUntil(iso: string): number {
  return (new Date(iso).getTime() - Date.now()) / 60000;
}

/** "MM:SS" → seconds. Accepts "H:MM:SS" too. */
export function clockToSeconds(clock: string | undefined | null): number {
  if (!clock) return 0;
  const parts = clock.split(':').map((p) => parseFloat(p) || 0);
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

export function secondsToClock(total: number): string {
  const s = Math.max(0, Math.round(total));
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
}

export function ageFrom(birthDate: string | undefined): number | undefined {
  if (!birthDate) return undefined;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return undefined;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}
