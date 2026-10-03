import { Link } from 'react-router';
import { History } from 'lucide-react';
import type { Game, GameHistory, LeagueDef, Side, StandingRow, TeamRef } from '../../data/types';
import { useStandings } from '../../data/queries';
import { useI18n } from '../../i18n';
import { summarizeHistory } from '../../lib/history';
import type { TeamColors } from '../../lib/color';
import { gamePath, GameRow } from '../games/GameRow';
import { TeamLogo } from '../ui/Media';
import { Card, CardHeader, EmptyState, Skeleton } from '../ui/States';
import s from './game.module.css';

const SIDES = ['home', 'away'] as const;

function scopeLabel(i18n: ReturnType<typeof useI18n>, h: GameHistory) {
  return h.seasons.length > 1 ? i18n.t('h2hSeasons', { n: h.seasons.length }) : i18n.t('h2hThisSeason');
}

/** Wins each, a split bar in team colors, points per meeting, biggest wins and the last result. */
export function H2HSummary({
  game,
  history,
  colors,
  linkAll,
}: {
  game: Game;
  history: GameHistory;
  colors: TeamColors;
  /** Shows a "see all" link to the head-to-head tab (summary page). */
  linkAll?: string;
}) {
  const i18n = useI18n();
  const { t } = i18n;
  const sum = summarizeHistory(game, history.meetings);
  const next = [...history.meetings].reverse().find((m) => m.status === 'scheduled' && new Date(m.start).getTime() > Date.now());
  const team = (side: Side): TeamRef => game[side].team;

  return (
    <Card>
      <CardHeader title={t('h2hTitle')}>
        {linkAll ? (
          <Link to={linkAll} className={s.cardLink}>
            {t('h2hSeeAll')}
          </Link>
        ) : (
          <span>{scopeLabel(i18n, history)}</span>
        )}
      </CardHeader>
      {sum.played === 0 ? (
        <EmptyState icon={<History size={22} />} title={t('h2hNone')} hint={t('h2hNoneHint', { seasons: history.seasons.join(', ') })} />
      ) : (
        <div className={s.h2h}>
          <div className={s.h2hRecord}>
            {SIDES.map((side) => (
              <div key={side} className={`${s.h2hTeam} ${side === 'away' ? s.h2hTeamAway : ''}`}>
                <TeamLogo team={team(side)} size={40} />
                <span className={s.h2hName}>{team(side).short ?? team(side).name}</span>
                <span className={s.h2hWins}>
                  <span className="tnum">{sum.wins[side]}</span>
                  <small>{t('h2hWins')}</small>
                </span>
              </div>
            ))}
          </div>
          <div
            className={s.h2hBar}
            role="img"
            aria-label={`${team('home').name} ${sum.wins.home}, ${team('away').name} ${sum.wins.away}`}
            style={{ gridTemplateColumns: `${sum.wins.home}fr ${sum.wins.away}fr` }}
          >
            <span style={{ background: colors.home }} />
            <span style={{ background: colors.away }} />
          </div>
          <p className={s.h2hScope}>
            {t(sum.played === 1 ? 'h2hPlayedOne' : 'h2hPlayed', { n: sum.played })} · {history.seasons.join(', ')}
          </p>
          <dl className={s.h2hStats}>
            <div>
              <dd className="tnum">{i18n.avg(sum.avgPts.home)}</dd>
              <dt>{t('h2hAvgPts')}</dt>
              <dd className="tnum">{i18n.avg(sum.avgPts.away)}</dd>
            </div>
            <div>
              <dd className="tnum">{sum.biggest.home ? `+${sum.biggest.home.margin}` : '–'}</dd>
              <dt>{t('h2hBiggest')}</dt>
              <dd className="tnum">{sum.biggest.away ? `+${sum.biggest.away.margin}` : '–'}</dd>
            </div>
          </dl>
          {sum.last && (
            <Link to={gamePath(sum.last)} className={s.h2hLast}>
              <span className={s.h2hLastLabel}>{t('h2hLast')}</span>
              <span className={s.h2hLastGame}>
                {sum.last.home.team.short ?? sum.last.home.team.name}{' '}
                <b className="tnum">
                  {sum.last.home.score}–{sum.last.away.score}
                </b>{' '}
                {sum.last.away.team.short ?? sum.last.away.team.name}
              </span>
              <span className={s.h2hLastDate}>{i18n.dateShort(sum.last.start)}</span>
            </Link>
          )}
        </div>
      )}
      {next && next.id !== game.id && (
        <Link to={gamePath(next)} className={s.h2hNext}>
          <span className={s.h2hLastLabel}>{t('h2hNext')}</span>
          <span className={s.h2hLastGame}>
            {next.home.team.short ?? next.home.team.name} – {next.away.team.short ?? next.away.team.name}
          </span>
          <span className={s.h2hLastDate}>{i18n.dateShort(next.start)}</span>
        </Link>
      )}
    </Card>
  );
}

/** Every meeting, newest first, grouped by season when there are several. */
export function H2HMeetings({ history, league }: { history: GameHistory; league: LeagueDef }) {
  const { t } = useI18n();
  if (!history.meetings.length) return null;
  return (
    <Card>
      <CardHeader title={t('h2hAll')}>
        <span>{t(history.meetings.length === 1 ? 'h2hPlayedOne' : 'h2hPlayed', { n: history.meetings.length })}</span>
      </CardHeader>
      <div className={s.meetings}>
        {history.meetings.map((g) => (
          <GameRow key={g.id} game={g} league={league} showDate />
        ))}
      </div>
    </Card>
  );
}

function FormColumn({ team, games, league }: { team: TeamRef; games: Game[]; league: LeagueDef }) {
  const i18n = useI18n();
  const { t } = i18n;
  const wins = games.filter((g) => g[g.home.team.id === team.id ? 'home' : 'away'].winner === true).length;
  return (
    <div className={s.form}>
      <header className={s.formHead}>
        <TeamLogo team={team} size={22} />
        <span>{team.short ?? team.name}</span>
        {games.length > 0 && (
          <span className={s.formRecord}>
            {wins}-{games.length - wins}
          </span>
        )}
      </header>
      {games.length ? (
        <ul className={s.formList}>
          {games.map((g) => {
            const mine: Side = g.home.team.id === team.id ? 'home' : 'away';
            const opp = g[mine === 'home' ? 'away' : 'home'];
            const won = g[mine].winner === true;
            return (
              <li key={g.id}>
                <Link to={`/mac/${league.id}/${encodeURIComponent(g.id)}`} className={s.formItem}>
                  <span className={won ? s.formW : s.formL} title={won ? t('formWinLong') : t('formLossLong')}>
                    {won ? t('formWin') : t('formLoss')}
                  </span>
                  <span className={s.formOpp}>
                    {mine === 'home' ? t('vs') : t('at')} {opp.team.short ?? opp.team.name}
                    <small className={s.formDate}>{i18n.dateShort(g.start)}</small>
                  </span>
                  <span className="tnum">
                    {g[mine].score}-{opp.score}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={s.muted}>{t('noGames')}</p>
      )}
    </div>
  );
}

/** Each team's last five results before this game, side by side. */
export function FormCompare({ game, history, league }: { game: Game; history: GameHistory; league: LeagueDef }) {
  const { t } = useI18n();
  return (
    <Card>
      <CardHeader title={t('formTitle')}>
        <span>{t('formBefore')}</span>
      </CardHeader>
      <div className={s.formGrid}>
        <FormColumn team={game.home.team} games={history.form.home} league={league} />
        <FormColumn team={game.away.team} games={history.form.away} league={league} />
      </div>
    </Card>
  );
}

/** Rank, record and scoring from the league table, for both teams. */
export function SeasonCompare({ game, league }: { game: Game; league: LeagueDef }) {
  const i18n = useI18n();
  const { t } = i18n;
  const q = useStandings(league.id);
  const rows = (q.data ?? []).flatMap((g) => g.rows);
  const find = (id: string) => rows.find((r) => r.team.id === id);
  const h = find(game.home.team.id);
  const a = find(game.away.team.id);
  if (!h || !a || (h.gp === 0 && a.gp === 0)) return null;
  const per = (r: StandingRow, v?: number) => (v !== undefined && r.gp ? v / r.gp : undefined);
  const lines: Array<{ label: string; home: string; away: string; better?: Side }> = [
    { label: t('scRank'), home: String(h.rank), away: String(a.rank), better: h.rank === a.rank ? undefined : h.rank < a.rank ? 'home' : 'away' },
    { label: t('record'), home: `${h.w}-${h.l}`, away: `${a.w}-${a.l}` },
  ];
  const pfH = per(h, h.pf);
  const pfA = per(a, a.pf);
  if (pfH !== undefined && pfA !== undefined) lines.push({ label: t('scPf'), home: i18n.avg(pfH), away: i18n.avg(pfA), better: pfH === pfA ? undefined : pfH > pfA ? 'home' : 'away' });
  const paH = per(h, h.pa);
  const paA = per(a, a.pa);
  if (paH !== undefined && paA !== undefined) lines.push({ label: t('scPa'), home: i18n.avg(paH), away: i18n.avg(paA), better: paH === paA ? undefined : paH < paA ? 'home' : 'away' });
  if (h.streak && a.streak) lines.push({ label: t('colStreakMid'), home: h.streak, away: a.streak });
  return (
    <Card>
      <CardHeader title={t('seasonCompare')}>
        <span>{league.short}</span>
      </CardHeader>
      <div className={s.scTeams}>
        <span>
          <TeamLogo team={game.home.team} size={20} />
          {game.home.team.short ?? game.home.team.name}
        </span>
        <span>
          {game.away.team.short ?? game.away.team.name}
          <TeamLogo team={game.away.team} size={20} />
        </span>
      </div>
      <dl className={s.h2hStats}>
        {lines.map((l) => (
          <div key={l.label}>
            <dd className={`tnum ${l.better === 'home' ? s.scBetter : ''}`}>{l.home}</dd>
            <dt>{l.label}</dt>
            <dd className={`tnum ${l.better === 'away' ? s.scBetter : ''}`}>{l.away}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

export function H2HSkeleton() {
  return (
    <Card>
      <div className={s.skelPanel}>
        <Skeleton w="60%" h={16} />
        <Skeleton w="100%" h={54} r={8} />
        <Skeleton w="100%" h={10} r={5} />
        <Skeleton w="100%" h={60} r={8} />
      </div>
    </Card>
  );
}
