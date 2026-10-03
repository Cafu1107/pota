import { useState, type ReactNode } from 'react';
import { Newspaper, Play } from 'lucide-react';
import { NEWS_SOURCES, newsImage, type NewsItem } from '../../data/news';
import { useI18n } from '../../i18n';
import s from './news.module.css';

/** Photo at the size it is shown; quiet placeholder when there is none or it fails. */
export function NewsImage({ item, width, className, eager }: { item: NewsItem; width: number; className?: string; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  const src = newsImage(item.image, width);
  return (
    <span className={`${s.img} ${className ?? ''}`}>
      {src && !failed ? (
        <img
          src={src}
          alt=""
          loading={eager ? 'eager' : 'lazy'}
          fetchPriority={eager ? 'high' : undefined}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className={s.imgEmpty} aria-hidden>
          <Newspaper size={Math.min(28, Math.round(width / 6))} strokeWidth={1.6} />
        </span>
      )}
      {item.video && (
        <span className={s.play} aria-hidden>
          <Play size={12} fill="currentColor" strokeWidth={0} />
        </span>
      )}
    </span>
  );
}

/** "NTV Spor · 12 dk. önce" plus video / language tags. */
export function NewsMeta({ item, when = 'ago' }: { item: NewsItem; when?: 'ago' | 'time' | 'none' }) {
  const i18n = useI18n();
  const { t } = i18n;
  return (
    <span className={s.meta}>
      <span className={s.source}>{NEWS_SOURCES[item.source].name}</span>
      {when !== 'none' && (
        <time dateTime={item.published} title={`${i18n.dateLong(item.published)} ${i18n.time(item.published)}`}>
          {when === 'ago' ? i18n.ago(item.published) : i18n.time(item.published)}
        </time>
      )}
      {item.video && <span className={s.tag}>{t('newsVideo')}</span>}
      {item.lang !== i18n.lang && (
        <span className={s.tag} title={item.lang === 'en' ? t('newsLangEn') : t('newsLangTr')}>
          {item.lang.toUpperCase()}
        </span>
      )}
    </span>
  );
}

/** Every story is a plain link out to the outlet that published it. */
export function NewsLink({ item, className, children }: { item: NewsItem; className?: string; children: ReactNode }) {
  const { t } = useI18n();
  return (
    <a href={item.url} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
      <span className="sr-only">{` (${t('newsOpensAt', { source: NEWS_SOURCES[item.source].name })})`}</span>
    </a>
  );
}

/** Compact headline list for side cards (scores page aside). */
export function NewsMiniList({ items }: { items: NewsItem[] }) {
  return (
    <ul className={s.mini}>
      {items.map((it) => (
        <li key={it.id}>
          <NewsLink item={it} className={s.miniRow}>
            <span className={s.miniText}>
              <span className={s.miniTitle}>{it.title}</span>
              <NewsMeta item={it} />
            </span>
            {it.image && <NewsImage item={it} width={76} className={s.miniThumb} />}
          </NewsLink>
        </li>
      ))}
    </ul>
  );
}
