import { useState } from 'react';
import { ExternalLink, Play } from 'lucide-react';
import type { Game } from '../../data/types';
import { useGameVideo, type Video } from '../../data/videos';
import { useI18n } from '../../i18n';
import { Card, CardHeader } from '../ui/States';
import s from './video.module.css';

export const watchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;
const thumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

/** A thumbnail until clicked, then the YouTube player (privacy-enhanced mode). */
export function VideoEmbed({ video, className }: { video: Video; className?: string }) {
  const { t } = useI18n();
  const [playing, setPlaying] = useState(false);
  return (
    <div className={`${s.frame} ${className ?? ''}`}>
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0&playsinline=1`}
          title={video.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      ) : (
        <button type="button" className={s.poster} onClick={() => setPlaying(true)} aria-label={t('videoPlay', { title: video.title })}>
          <img src={thumb(video.id)} alt="" loading="lazy" decoding="async" />
          <span className={s.play} aria-hidden>
            <Play size={22} fill="currentColor" strokeWidth={0} />
          </span>
        </button>
      )}
    </div>
  );
}

function label(t: ReturnType<typeof useI18n>['t'], video: Video, game: Game) {
  if (video.type === 'highlights') return t('videoHighlights');
  if (game.status === 'live') return t('videoLive');
  if (game.status === 'final') return t('videoFullGame');
  return t('videoUpcoming');
}

/** The game's highlights (or the federation's broadcast) when an official channel has it. */
export function GameVideo({ game }: { game: Game }) {
  const i18n = useI18n();
  const { t } = i18n;
  const video = useGameVideo(game);
  if (!video) return null;
  return (
    <Card>
      <CardHeader title={label(t, video, game)}>
        <a href={watchUrl(video.id)} target="_blank" rel="noopener noreferrer" className={s.yt}>
          {t('videoWatchOnYoutube')}
          <ExternalLink size={13} aria-hidden />
        </a>
      </CardHeader>
      <VideoEmbed video={video} className={s.gameFrame} />
      <p className={s.caption}>
        <span className={s.title}>{video.title}</span>
        <span className={s.meta}>
          {t('videoFrom', { channel: video.channel })} · {i18n.dateShort(video.published)}
        </span>
      </p>
    </Card>
  );
}

/** Small card for strips of videos (news page). */
export function VideoTile({ video }: { video: Video }) {
  const i18n = useI18n();
  return (
    <article className={s.tile}>
      <VideoEmbed video={video} className={s.tileFrame} />
      <a href={watchUrl(video.id)} target="_blank" rel="noopener noreferrer" className={s.tileText}>
        <span className={s.tileTitle}>{video.title}</span>
        <span className={s.meta}>
          {video.channel} · {i18n.ago(video.published)}
        </span>
      </a>
    </article>
  );
}
