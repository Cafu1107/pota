import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Newspaper, RotateCw } from 'lucide-react';
import { NEWS_ORDER, NEWS_SOURCES, preferLang, useNews, type NewsItem, type NewsSourceId, type NewsTopic } from '../data/news';
import { useI18n } from '../i18n';
import { addDays, localDayOf, parseDayKey, todayKey } from '../lib/time';
import { NewsImage, NewsLink, NewsMeta } from '../components/news/NewsParts';
import { Chip, Segmented } from '../components/ui/Controls';
import { Card, EmptyState, Skeleton } from '../components/ui/States';
import u from '../components/ui/ui.module.css';
import n from '../components/news/news.module.css';

type TopicFilter = 'all' | NewsTopic;
const TOPICS: TopicFilter[] = ['all', 'tr', 'eu', 'nba'];
const PAGE = 40;
const RAIL = 4;

function isTopic(v: string | null): v is TopicFilter {
  return !!v && (TOPICS as string[]).includes(v);
}
function isSource(v: string | null): v is NewsSourceId {
  return !!v && v in NEWS_SOURCES;
}

function Lead({ item }: { item: NewsItem }) {
  return (
    <NewsLink item={item} className={n.lead}>
      <NewsImage item={item} width={720} className={n.leadImg} eager />
      <span className={n.leadBody}>
        <span className={n.leadTitle}>{item.title}</span>
        {item.summary && <span className={n.leadSummary}>{item.summary}</span>}
        <NewsMeta item={item} />
      </span>
    </NewsLink>
  );
}

function RailRow({ item }: { item: NewsItem }) {
  return (
    <NewsLink item={item} className={n.railRow}>
      <span className={n.railText}>
        <span className={n.railTitle}>{item.title}</span>
        <NewsMeta item={item} />
      </span>
      <NewsImage item={item} width={128} className={n.railThumb} />
    </NewsLink>
  );
}

function RiverRow({ item }: { item: NewsItem }) {
  const i18n = useI18n();
  return (
    <NewsLink item={item} className={n.row}>
      <time className={n.rowTime} dateTime={item.published}>
        {i18n.time(item.published)}
      </time>
      <span className={n.rowText}>
        <span className={n.rowTitle}>{item.title}</span>
        {item.summary && <span className={n.rowSummary}>{item.summary}</span>}
        <NewsMeta item={item} when="time" />
      </span>
      {item.image && <NewsImage item={item} width={168} className={n.rowThumb} />}
    </NewsLink>
  );
}

function NewsSkeleton() {
  return (
    <div className={n.skeleton} aria-hidden>
      <div className={n.top}>
        <Card className={n.skelLead}>
          <Skeleton w="100%" h={0} className={n.skelImg} />
          <div className={n.skelBody}>
            <Skeleton w="92%" h={20} />
            <Skeleton w="70%" h={20} />
            <Skeleton w="40%" h={12} />
          </div>
        </Card>
        <Card className={n.rail}>
          {Array.from({ length: RAIL }, (_, i) => (
            <div key={i} className={n.skelRow}>
              <div className={n.skelBody}>
                <Skeleton w="95%" h={13} />
                <Skeleton w="75%" h={13} />
                <Skeleton w="35%" h={10} />
              </div>
              <Skeleton w={112} h={63} r={6} />
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

export function NewsPage() {
  const i18n = useI18n();
  const { t } = i18n;
  const [params, setParams] = useSearchParams();
  const topicParam = params.get('konu');
  const sourceParam = params.get('kaynak');
  const topic: TopicFilter = isTopic(topicParam) ? topicParam : 'all';
  const source: NewsSourceId | null = isSource(sourceParam) ? sourceParam : null;
  const [shown, setShown] = useState(PAGE);
  const news = useNews();

  const setFilter = (key: 'konu' | 'kaynak', value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
    setShown(PAGE);
  };

  const byTopic = useMemo(() => (topic === 'all' ? news.items : news.items.filter((x) => x.topic === topic)), [news.items, topic]);
  const items = useMemo(() => (source ? byTopic.filter((x) => x.source === source) : byTopic), [byTopic, source]);
  const counts = useMemo(() => {
    const c = {} as Record<NewsSourceId, number>;
    for (const id of NEWS_ORDER) c[id] = 0;
    for (const x of byTopic) c[x.source]++;
    return c;
  }, [byTopic]);

  // Lead and rail: recent stories with a photo, in the reader's language first.
  const { lead, rail, river } = useMemo(() => {
    const [lead, ...rail] = preferLang(items.slice(0, 40).filter((x) => x.image), i18n.lang, 1 + RAIL);
    const used = new Set([lead, ...rail].filter(Boolean).map((x) => x.id));
    return { lead, rail, river: items.filter((x) => !used.has(x.id)) };
  }, [items, i18n.lang]);

  const days = useMemo(() => {
    const out: Array<{ day: string; items: NewsItem[] }> = [];
    for (const it of river.slice(0, shown)) {
      const day = localDayOf(it.published);
      const last = out[out.length - 1];
      if (last && last.day === day) last.items.push(it);
      else out.push({ day, items: [it] });
    }
    return out;
  }, [river, shown]);

  const dayTitle = (day: string) => {
    const today = todayKey();
    if (day === today) return t('today');
    if (day === addDays(today, -1)) return t('yesterday');
    return i18n.dateLong(parseDayKey(day).toISOString());
  };

  const loading = news.items.length === 0 && news.pending > 0;

  return (
    <div className={n.page}>
      <header className={n.intro}>
        <h1 className={n.title}>{t('newsTitle')}</h1>
        <p className={n.lede}>{t('newsIntro')}</p>
      </header>

      <div className={n.filters}>
        <Segmented<TopicFilter>
          label={t('newsTopic')}
          value={topic}
          onChange={(v) => setFilter('konu', v === 'all' ? null : v)}
          options={[
            { value: 'all', label: t('filterAll') },
            { value: 'tr', label: t('newsTopicTr') },
            { value: 'eu', label: t('newsTopicEu') },
            { value: 'nba', label: t('newsTopicNba') },
          ]}
        />
        <div className={n.sources} role="group" aria-label={t('newsSources')}>
          <Chip active={!source} onClick={() => setFilter('kaynak', null)}>
            {t('newsAllSources')}
          </Chip>
          {NEWS_ORDER.map((id) => (
            <Chip key={id} active={source === id} onClick={() => setFilter('kaynak', source === id ? null : id)}>
              {NEWS_SOURCES[id].name}
              <span className={n.chipCount}>{counts[id]}</span>
            </Chip>
          ))}
        </div>
      </div>

      {loading ? (
        <NewsSkeleton />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Newspaper size={22} />}
            title={t('newsEmpty')}
            hint={t('newsEmptyHint')}
            action={
              (topic !== 'all' || source) && (
                <button type="button" className={u.button} onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                  {t('newsClear')}
                </button>
              )
            }
          />
        </Card>
      ) : (
        <>
          {lead && (
            <div className={n.top}>
              <Lead item={lead} />
              {rail.length > 0 && (
                <Card className={n.rail} as="div">
                  {rail.map((it) => (
                    <RailRow key={it.id} item={it} />
                  ))}
                </Card>
              )}
            </div>
          )}

          {days.length > 0 && (
            <Card className={n.river}>
              {days.map((d) => (
                <section key={d.day} aria-label={dayTitle(d.day)}>
                  <h2 className={n.dayTitle}>{dayTitle(d.day)}</h2>
                  {d.items.map((it) => (
                    <RiverRow key={it.id} item={it} />
                  ))}
                </section>
              ))}
              {river.length > shown && (
                <div className={n.more}>
                  <button type="button" className={u.button} onClick={() => setShown((v) => v + PAGE)}>
                    {t('newsMore')}
                  </button>
                </div>
              )}
            </Card>
          )}
        </>
      )}

      {news.failed.length > 0 && !loading && (
        <p className={n.failed}>
          {t('newsFailed', { list: news.failed.map((id) => NEWS_SOURCES[id].name).join(', ') })}
          <button type="button" className={n.retry} onClick={news.refetch}>
            <RotateCw size={13} />
            {t('retry')}
          </button>
        </p>
      )}
    </div>
  );
}
