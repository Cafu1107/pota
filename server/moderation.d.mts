export const ALLOWED_EMOJI: string[];
export const MIN_BODY: number;
export const MAX_BODY: number;
export const MAX_NAME: number;
export const MAX_LINES: number;

export function filterEmoji(text: string, allowed?: Set<string>): { text: string; removed: number };
export function hasLink(text: string): boolean;
export function censor(text: string): { text: string; count: number };
export function moderate(input: { name?: unknown; body?: unknown }):
  | { ok: true; name: string; body: string; censored: number; emojiRemoved: number }
  | { ok: false; error: 'link' | 'short' | 'long' };
