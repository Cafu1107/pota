import { useRef, useState, type FormEvent } from 'react';
import { Flag, MessageSquare, Send } from 'lucide-react';
import { ALLOWED_EMOJI, MAX_BODY, MAX_NAME, filterEmoji, hasLink } from '../../../server/moderation.mjs';
import { CommentError, commentKey, fetchComments, postComment, reportComment, useAddComment, useComments, type GameComment } from '../../data/comments';
import type { Game } from '../../data/types';
import { useI18n } from '../../i18n';
import { createStore } from '../../state/store';
import { Card, CardHeader, EmptyState, ErrorState, Skeleton } from '../ui/States';
import s from './comments.module.css';

// Per-viewer memory: nickname, which comments are mine, which I reported.
const mine = createStore('pota:comments', { name: '', own: [] as number[], reported: [] as number[] });

function errorText(t: ReturnType<typeof useI18n>['t'], e: unknown) {
  if (e instanceof CommentError) {
    if (e.code === 'link') return t('commentErrLink');
    if (e.code === 'short') return t('commentErrShort');
    if (e.code === 'long') return t('commentErrLong', { n: MAX_BODY });
    if (e.code === 'rate') return t('commentErrRate', { s: e.retryAfter ?? 20 });
    if (e.code === 'duplicate') return t('commentErrDuplicate');
  }
  return t('commentErrServer');
}

function Composer({ gameKey, onPosted }: { gameKey: string; onPosted: (c: GameComment) => void }) {
  const { t } = useI18n();
  const savedName = mine.useStore((x) => x.name);
  const [name, setName] = useState(savedName);
  const [body, setBody] = useState('');
  const [hp, setHp] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  const accept = (value: string) => {
    const f = filterEmoji(value);
    if (f.removed) setNote({ kind: 'error', text: t('commentEmojiBlocked') });
    else if (note?.text === t('commentEmojiBlocked')) setNote(null);
    setBody([...f.text].slice(0, MAX_BODY).join(''));
  };

  const insertEmoji = (e: string) => {
    const el = area.current;
    const at = el?.selectionStart ?? body.length;
    const end = el?.selectionEnd ?? body.length;
    const next = body.slice(0, at) + e + body.slice(end);
    accept(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + e.length, at + e.length);
    });
  };

  const submit = async (ev?: FormEvent) => {
    ev?.preventDefault();
    if (busy) return;
    const text = body.trim();
    if ([...text].length < 2) return setNote({ kind: 'error', text: t('commentErrShort') });
    if (hasLink(text) || hasLink(name)) return setNote({ kind: 'error', text: t('commentErrLink') });
    setBusy(true);
    setNote(null);
    try {
      const r = await postComment({ game: gameKey, name: name.trim(), body: text, website: hp });
      mine.set((x) => ({ name: name.trim(), own: r.comment ? [...x.own, r.comment.id].slice(-200) : x.own }));
      if (r.comment) onPosted(r.comment);
      setBody('');
      if (r.censored) setNote({ kind: 'info', text: t('commentCensored') });
    } catch (e) {
      setNote({ kind: 'error', text: errorText(t, e) });
    } finally {
      setBusy(false);
    }
  };

  const left = MAX_BODY - [...body].length;
  return (
    <form className={s.composer} onSubmit={submit} noValidate>
      <div className={s.row}>
        <label className={s.nameField}>
          <span className="sr-only">{t('commentName')}</span>
          <input
            value={name}
            onChange={(e) => setName(filterEmoji(e.target.value, new Set()).text.slice(0, MAX_NAME))}
            placeholder={t('commentNamePlaceholder')}
            maxLength={MAX_NAME}
            autoComplete="nickname"
            enterKeyHint="next"
          />
        </label>
      </div>
      <label className={s.bodyField}>
        <span className="sr-only">{t('commentLabel')}</span>
        <textarea
          ref={area}
          value={body}
          onChange={(e) => accept(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void submit();
          }}
          placeholder={t('commentPlaceholder')}
          rows={3}
          maxLength={MAX_BODY * 2}
        />
      </label>
      {/* Honeypot: hidden from people, filled in by bots. */}
      <input className={s.hp} tabIndex={-1} autoComplete="off" aria-hidden value={hp} onChange={(e) => setHp(e.target.value)} name="website" />
      <div className={s.tools}>
        <div className={s.emojiBar} role="group" aria-label={t('commentEmojiBar')}>
          {ALLOWED_EMOJI.map((e) => (
            <button key={e} type="button" className={s.emoji} onClick={() => insertEmoji(e)} aria-label={e}>
              {e}
            </button>
          ))}
        </div>
        <span className={`${s.count} ${left < 40 ? s.countLow : ''}`} aria-live="polite">
          {left}
        </span>
        <button type="submit" className={s.send} disabled={busy || [...body.trim()].length < 2}>
          <Send size={15} aria-hidden />
          {busy ? t('commentSending') : t('commentSend')}
        </button>
      </div>
      {note && (
        <p className={note.kind === 'error' ? s.error : s.info} role={note.kind === 'error' ? 'alert' : 'status'}>
          {note.text}
        </p>
      )}
      <p className={s.rules}>{t('commentRules')}</p>
    </form>
  );
}

function CommentItem({ c }: { c: GameComment }) {
  const i18n = useI18n();
  const { t } = i18n;
  const own = mine.useStore((x) => x.own.includes(c.id));
  const reported = mine.useStore((x) => x.reported.includes(c.id));
  const name = c.name || t('commentNamePlaceholder');
  const iso = new Date(c.createdAt).toISOString();
  const report = async () => {
    if (!window.confirm(t('commentReportConfirm'))) return;
    try {
      await reportComment(c.id);
    } catch {
      /* the button still turns into "reported"; a failed report is not worth an error */
    }
    mine.set((x) => ({ reported: [...x.reported, c.id].slice(-500) }));
  };
  return (
    <li className={s.item}>
      <span className={s.avatar} aria-hidden>
        {[...name][0]?.toLocaleUpperCase(i18n.locale)}
      </span>
      <div className={s.main}>
        <div className={s.head}>
          <span className={s.name}>{name}</span>
          {own && <span className={s.you}>{t('commentYou')}</span>}
          <time dateTime={iso} title={`${i18n.dateLong(iso)} ${i18n.time(iso)}`} className={s.when}>
            {i18n.ago(iso)}
          </time>
          {!own && (
            <button type="button" className={s.report} onClick={report} disabled={reported} title={reported ? t('commentReported') : t('commentReport')}>
              <Flag size={13} aria-hidden />
              <span className={reported ? undefined : 'sr-only'}>{reported ? t('commentReported') : t('commentReport')}</span>
            </button>
          )}
        </div>
        <p className={s.body}>{c.body}</p>
      </div>
    </li>
  );
}

export function Comments({ game }: { game: Game }) {
  const { t } = useI18n();
  const key = commentKey(game);
  const q = useComments(key, true);
  const add = useAddComment(key);
  const [older, setOlder] = useState<GameComment[]>([]);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const latest = q.data?.comments ?? [];
  const latestIds = new Set(latest.map((c) => c.id));
  const list = [...latest, ...older.filter((c) => !latestIds.has(c.id))];
  const total = q.data?.total ?? 0;

  const loadOlder = async () => {
    const last = list[list.length - 1];
    if (!last) return;
    setLoadingOlder(true);
    try {
      const page = await fetchComments(key, last.id);
      setOlder((o) => [...o, ...page.comments]);
    } finally {
      setLoadingOlder(false);
    }
  };

  return (
    <Card>
      <CardHeader title={t('commentsTitle')}>{total > 0 && <span>{t(total === 1 ? 'commentCountOne' : 'commentCount', { n: total })}</span>}</CardHeader>
      <Composer gameKey={key} onPosted={add} />
      {q.isLoading ? (
        <div className={s.loading}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} w="100%" h={48} r={8} />
          ))}
        </div>
      ) : q.isError && !q.data ? (
        <ErrorState onRetry={() => q.refetch()} title={t('commentsUnavailable')} />
      ) : list.length === 0 ? (
        <EmptyState icon={<MessageSquare size={22} />} title={t('commentsEmpty')} hint={t('commentsEmptyHint')} />
      ) : (
        <>
          <ul className={s.list}>
            {list.map((c) => (
              <CommentItem key={c.id} c={c} />
            ))}
          </ul>
          {list.length < total && (
            <div className={s.more}>
              <button type="button" className={s.moreBtn} onClick={loadOlder} disabled={loadingOlder}>
                {t('commentLoadMore')}
              </button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
