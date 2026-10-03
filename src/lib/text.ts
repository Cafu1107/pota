/** Lower-case, accent-free form for matching ("Fenerbahçe" ~ "fenerbahce"). */
export function fold(s: string): string {
  return s
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matches(haystack: string, needle: string): boolean {
  const n = fold(needle);
  if (!n) return false;
  const h = fold(haystack);
  return h.includes(n) || h.split(' ').some((w) => w.startsWith(n));
}
