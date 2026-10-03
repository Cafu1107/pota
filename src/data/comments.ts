// Client for the comments API (server/comments.mjs): list, post, report.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { API_BASE } from './http';
import type { Game } from './types';

export interface GameComment {
  id: number;
  game: string;
  name: string;
  body: string;
  createdAt: number;
}

interface Page {
  comments: GameComment[];
  total: number;
}

export class CommentError extends Error {
  constructor(
    public status: number,
    public code: string,
    public retryAfter?: number,
  ) {
    super(code);
    this.name = 'CommentError';
  }
}

export const commentKey = (g: Pick<Game, 'leagueId' | 'id'>) => `${g.leagueId}:${g.id}`;

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* empty or not JSON */
  }
  if (!res.ok) throw new CommentError(res.status, body?.error ?? 'server', body?.retryAfter);
  return body as T;
}

export const fetchComments = (key: string, before?: number) =>
  call<Page>(`/comments?game=${encodeURIComponent(key)}${before ? `&before=${before}` : ''}`);

export const postComment = (input: { game: string; name: string; body: string; website?: string }) =>
  call<{ comment: GameComment | null; censored: number; emojiRemoved: number }>('/comments', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });

export const reportComment = (id: number) => call<{ ok: boolean; hidden: boolean }>(`/comments/${id}/report`, { method: 'POST' });

/** Latest page plus the total; polls while `live` is set and the page is visible. */
export function useComments(key: string | undefined, live = false) {
  return useQuery({
    queryKey: ['comments', key],
    queryFn: () => fetchComments(key!),
    enabled: !!key,
    staleTime: 15_000,
    refetchInterval: live ? 20_000 : false,
    retry: 1,
  });
}

/** Puts a just-posted comment on top without waiting for the next poll. */
export function useAddComment(key: string) {
  const qc = useQueryClient();
  return useCallback(
    (c: GameComment) =>
      qc.setQueryData<Page>(['comments', key], (old) =>
        old ? { comments: [c, ...old.comments.filter((x) => x.id !== c.id)], total: old.total + 1 } : { comments: [c], total: 1 },
      ),
    [qc, key],
  );
}
