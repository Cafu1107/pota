// Comment rules, shared by the browser (instant feedback while typing) and the
// servers (server/comments.mjs, enforced on every post):
// - text only: no links, so no photos or videos either;
// - emoji only from a short list;
// - swearing and slang (Turkish and English) are masked automatically.

export const ALLOWED_EMOJI = ['🏀', '🔥', '👏', '😂', '😮', '😢'];
export const MIN_BODY = 2;
export const MAX_BODY = 400;
export const MAX_NAME = 24;

const ALLOWED = new Set(ALLOWED_EMOJI);
const PICTOGRAPH = /\p{Extended_Pictographic}/u;
// The parts emoji are assembled from: joiner, variation selectors, keycap,
// skin tones, flag letters and tag characters.
const EMOJI_PARTS = /[‍︎️⃣\u{1f3fb}-\u{1f3ff}\u{1f1e6}-\u{1f1ff}\u{e0020}-\u{e007f}]/gu;
const INVISIBLE = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f­؜᠎​‌‎‏‪-‮⁠-⁤⁦-⁯﻿]/g;

/** Drops every emoji except the allowed ones (a skin-toned 👏🏽 becomes 👏). */
export function filterEmoji(text, allowed = ALLOWED) {
  let removed = 0;
  const out = [...String(text).replace(EMOJI_PARTS, '')]
    .filter((ch) => {
      if (!PICTOGRAPH.test(ch) || allowed.has(ch)) return true;
      removed++;
      return false;
    })
    .join('');
  return { text: out, removed };
}

// Links are refused outright: that is how photos and videos get shared.
const LINK =
  /(?:https?:\/\/|www\.|\b[\p{L}\p{N}-]{2,}\s?\.\s?(?:com|net|org|tv)\b|\b[\p{L}\p{N}-]{2,}\.(?:info|io|me|ly|gg|co|app|link|xyz|site|online|live|tr|be|ru|de|uk|us|to|cc|fm|tk)\b|youtu\.?be|t\.me\/|discord\.gg)/iu;

export const hasLink = (text) => LINK.test(String(text).normalize('NFKC'));

// ---------- profanity ----------

const FOLD = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '€': 'e' };

/**
 * Lowercase, Turkish letters folded, look-alike digits mapped, separators dropped.
 * The strict form keeps the dotless ı: "sıkı" (tight) and "sıkıştı" are basketball
 * words, while the "sik-" swear family is spelled with a dotted i.
 */
function fold(word, strict = false) {
  let out = '';
  for (const ch of word.toLocaleLowerCase('tr-TR').normalize('NFC')) out += (strict && ch === 'ı' ? 'ı' : FOLD[ch]) ?? LEET[ch] ?? ch;
  return out.replace(strict ? /[^a-zı]/g : /[^a-z]/g, '');
}
const squeeze = (w) => w.replace(/(.)\1+/g, '$1');

// Whole words only (short or ambiguous roots).
const EXACT = new Set([
  'amk', 'amq', 'aq', 'mk', 'oc', 'pic', 'mal', 'pust', 'ass',
  'bok', 'boka', 'boku', 'bokunu', 'boktan', 'boklu', 'bokum', 'boklar',
  'wtf', 'stfu', 'fag', 'dick', 'cunt', 'twat', 'prick',
]);
// Word starts, never inside words: "aşıktır", "kayarak", "namına" stay clean.
const PREFIX = [
  'amina', 'amcik', 'orospu', 'orosbu', 'orspu', 'yarak', 'yarag', 'dalyarak', 'pezevenk', 'kahpe', 'serefsiz', 'gerizekal',
  'salak', 'aptal', 'dangalak', 'embesil', 'ibne', 'ipne', 'yavsak', 'kaltak', 'surtuk', 'fahise', 'kancik', 'gavat', 'kavat',
  'lavuk', 'tasak', 'dasak', 'kodumun', 'pust', 'gotveren', 'gotlek',
  'fuck', 'fck', 'shit', 'bitch', 'bastard', 'ashol', 'motherf', 'whore', 'slut', 'retard', 'idiot', 'moron', 'dumbas',
];
// The "sik-" family, matched on the strict fold (see above).
const PREFIX_STRICT = ['siktir', 'hasiktir', 'sikerim', 'sikeyim', 'sikiyim', 'sikim', 'sikik', 'sikis', 'siktim', 'siktig', 'sikec', 'sikic', 'sikmek', 'sikiyo'];
// Checked before squeezing, where the doubled letter is what makes it rude.
const PREFIX_RAW = ['yarr', 'nigg', 'fagg'];
// Inside other words too (compounds written together).
const INSIDE = ['orospu', 'orosbu', 'fuck', 'motherf', 'pezevenk'];
// "göt" and its rude forms; "götürdü" (took the game) is fine.
const GOT = /^göt(?:ün(?:e|ü|den)?|ler|veren|lek|oş)?$/;

function isRude(token) {
  const lower = token.toLocaleLowerCase('tr-TR');
  if (GOT.test(lower) || lower.startsWith('piç') || lower === 'çük') return true;
  const n0 = fold(token);
  if (n0.length < 2) return false;
  const n1 = squeeze(n0);
  if (EXACT.has(n0) || EXACT.has(n1)) return true;
  if (PREFIX.some((p) => n0.startsWith(p) || n1.startsWith(p))) return true;
  if (PREFIX_RAW.some((p) => n0.startsWith(p))) return true;
  const s0 = fold(token, true);
  const s1 = squeeze(s0);
  if (PREFIX_STRICT.some((p) => s0.startsWith(p) || s1.startsWith(p))) return true;
  return INSIDE.some((p) => n1.includes(p));
}

const mask = (raw) => {
  const chars = [...raw];
  return chars[0] + '*'.repeat(Math.min(Math.max(chars.length - 1, 2), 8));
};

const TOKEN = /[\p{L}\p{N}@$€]+(?:[._*-]+[\p{L}\p{N}@$€]+)*/gu;
// "a m k", "s.i.k.t.i.r": three or more single letters with separators between.
const SPACED = /(?<![\p{L}\p{N}])\p{L}(?:[\s._*-]+\p{L}(?![\p{L}\p{N}])){2,}/gu;

/** Masks rude words, keeping the first letter: "salak" → "s****". */
export function censor(text) {
  let count = 0;
  let out = String(text).replace(SPACED, (span) => {
    const joined = span.replace(/[\s._*-]+/g, '');
    if (!isRude(joined)) return span;
    count++;
    return mask(joined);
  });
  out = out.replace(TOKEN, (tok) => {
    if (!isRude(tok)) return tok;
    count++;
    return mask(tok);
  });
  return { text: out, count };
}

// ---------- the whole check ----------

export const MAX_LINES = 8;

function tidy(text, keepNewlines) {
  let t = String(text ?? '').normalize('NFC').replace(INVISIBLE, '').replace(/\r\n?/g, '\n');
  // "Zalgo" text: at most two combining marks on a letter.
  t = t.replace(/(\p{M}{2})\p{M}+/gu, '$1');
  if (keepNewlines) {
    t = t.replace(/[^\S\n]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n');
    let lines = 0;
    t = t.replace(/\n/g, () => (++lines >= MAX_LINES ? ' ' : '\n'));
  } else {
    t = t.replace(/\s+/g, ' ');
  }
  return t.trim();
}

// Nicknames that could pass for the site or its staff.
const RESERVED = /^(?:pota|admin|administrator|yonetici|moderator|moderat[oö]r|mod|sistem|system|official|resmi|destek|support)$/i;

/**
 * Applies every rule to a comment.
 * @returns {{ ok: true, name: string, body: string, censored: number, emojiRemoved: number } | { ok: false, error: 'link' | 'short' | 'long' }}
 */
export function moderate({ name, body }) {
  // Refuse oversized input before any heavier work (the hosted Worker has a small CPU budget).
  if (String(body ?? '').length > MAX_BODY * 4) return { ok: false, error: 'long' };
  const rawBody = tidy(body, true);
  const rawName = tidy(String(name ?? '').slice(0, MAX_NAME * 4), false);
  if (hasLink(rawBody) || hasLink(rawName)) return { ok: false, error: 'link' };
  const b = filterEmoji(rawBody);
  const n = filterEmoji(rawName, new Set());
  const cb = censor(tidy(b.text, true));
  const cn = censor(tidy(n.text, false));
  const finalBody = cb.text;
  if ([...finalBody].length < MIN_BODY) return { ok: false, error: 'short' };
  if ([...finalBody].length > MAX_BODY) return { ok: false, error: 'long' };
  const shortName = [...cn.text].slice(0, MAX_NAME).join('').trim();
  return {
    ok: true,
    // Reserved or symbol-only names fall back to the default ("Taraftar" / "Fan").
    name: RESERVED.test(fold(shortName)) || !/[\p{L}\p{N}]/u.test(shortName) ? '' : shortName,
    body: finalBody,
    censored: cb.count + cn.count,
    emojiRemoved: b.removed,
  };
}
