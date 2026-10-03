import { Link, useParams } from 'react-router';
import { GitCompareArrows, History, ListOrdered } from 'lucide-react';
import { getLeague } from '../data/leagues';
import { usePlayer } from '../data/queries';
import type { PlayerAverages } from '../data/types';
import { useI18n } from '../i18n';
import { teamColor, wash } from '../lib/color';
import { useResolvedTheme } from '../state/settings';
import { HeroCard, PageStack, StatTile, TileGrid } from '../components/layout/Page';
import { LeagueBadge, PlayerPhoto, TeamLogo } from '../components/ui/Media';
import { Card, CardHeader, EmptyState, ErrorState, Skeleton } from '../components/ui/States';
import { NotFound } from './NotFound';
import t from '../components/tables/tables.module.css';
import s from './player.module.css';

export function PlayerPage() {
  const { leagueId, playerId } = useParams();
  const league = getLeague(leagueId);
  const i18n = useI18n();
  const { t: tr, lang } = i18n;
  const theme = useResolvedTheme();
  const q = usePlayer(leagueId, playerId);
  if (!league) return <NotFound title={tr('leagueNotFound')} />;
  if (q.isLoading)
    return (
      <PageStack>
        <HeroCard>
          <div className={s.hero}>
            <Skeleton w={140} h={140} r={70} />
            <div className={s.heroText}>
              <Skeleton w={260} h={28} />
              <Skeleton w={160} h={14} />
            </div>
          </div>
        </HeroCard>
      </PageStack>
    );
  if (q.isError || !q.data) return <ErrorState onRetry={() => q.refetch()} title={tr('playerNotFound')} />;
  const { bio, averages, gameLog, career, season } = q.data;
  const color = teamColor(bio.team, theme);
  const facts: Array<[string, string]> = [];
  if (bio.age || bio.birthDate) facts.push([tr('age'), `${bio.age ?? ''}${bio.birthDate ? ` (${i18n.dateNumeric(bio.birthDate)})` : ''}`.trim()]);
  if (bio.height) facts.push([tr('height'), `${bio.height} cm`]);
  if (bio.weight) facts.push([tr('weight'), `${bio.weight} kg`]);
  if (bio.nationality) facts.push([tr('nationality'), bio.nationality]);
  if (bio.birthPlace) facts.push([tr('birthPlace'), bio.birthPlace]);
  if (bio.college) facts.push([tr('college'), bio.college]);
  if (bio.experience) {
    const n = /^(\d+)(st|nd|rd|th) season$/i.exec(bio.experience)?.[1];
    facts.push([tr('experience'), n ? tr('experienceN', { n }) : /rookie/i.test(bio.experience) ? tr('rookie') : bio.experience]);
  }

  return (
    <PageStack>
      <HeroCard>
        <div className={s.hero} style={{ backgroundImage: `linear-gradient(110deg, ${wash(color, 0.2)} 0%, ${wash(color, 0.05)} 50%, transparent 100%)` }}>
          <PlayerPhoto src={bio.photo} name={bio.name} size={132} className={s.photo} />
          <div className={s.heroText}>
            <h1 className={s.name}>{bio.name}</h1>
            {(bio.number || bio.position) && (
              <div className={s.kicker}>
                {bio.number && <span className={s.number}>#{bio.number}</span>}
                {bio.position && <span>{bio.position}</span>}
              </div>
            )}
            <div className={s.teamLine}>
              {bio.team && (
                bio.team.id ? (
                  <Link to={`/takim/${league.id}/${encodeURIComponent(bio.team.id)}`} className={s.team}>
                    <TeamLogo team={bio.team} size={22} />
                    {bio.team.name}
                  </Link>
                ) : (
                  <span className={s.team}>
                    <TeamLogo team={bio.team} size={22} />
                    {bio.team.name}
                  </span>
                )
              )}
              <Link to={`/lig/${league.id}`} className={s.leagueLink}>
                <LeagueBadge league={league} size={16} />
                {league.name[lang]}
              </Link>
            </div>
          </div>
          <Link to={`/karsilastir?a=${league.id}:${encodeURIComponent(bio.id)}`} className={s.compare}>
            <GitCompareArrows size={16} aria-hidden />
            {tr('compareWith')}
          </Link>
        </div>
        {facts.length > 0 && (
          <dl className={s.facts}>
            {facts.map(([k, v]) => (
              <div key={k} className={s.fact}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </HeroCard>

      <Card>
        <CardHeader title={tr('seasonAverages')}>{season && <span>{season}</span>}</CardHeader>
        {averages ? <AverageTiles avg={averages} /> : <EmptyState icon={<History size={22} />} title={tr('noAverages')} />}
      </Card>

      <Card>
        <CardHeader title={tr('gameLog')} />
        {gameLog && gameLog.length ? (
          <div className={t.scroll}>
            <table className={`${t.table} ${s.log}`}>
              <thead>
                <tr>
                  <th scope="col" className={s.left}>{tr('colDate')}</th>
                  <th scope="col" className={s.left}>{tr('colOpp')}</th>
                  {gameLog.some((g) => g.score) && <th scope="col">{tr('colResult')}</th>}
                  <th scope="col">{tr('sMin')}</th>
                  <th scope="col">{tr('sPts')}</th>
                  <th scope="col">{tr('sReb')}</th>
                  <th scope="col">{tr('sAst')}</th>
                  <th scope="col">{tr('sStl')}</th>
                  <th scope="col">{tr('sBlk')}</th>
                  <th scope="col">{tr('sTov')}</th>
                  <th scope="col">{tr('sFg')}</th>
                  <th scope="col">{tr('s3p')}</th>
                  <th scope="col">{tr('sFt')}</th>
                  {gameLog.some((g) => g.line.eff !== undefined) && <th scope="col">{tr('sEff')}</th>}
                </tr>
              </thead>
              <tbody>
                {gameLog.map((g, i) => (
                  <tr key={(g.gameId ?? '') + i}>
                    <td className={s.left}>
                      {g.gameId ? <Link to={`/mac/${league.id}/${encodeURIComponent(g.gameId)}`} className={s.dateLink}>{i18n.dateShort(g.date)}</Link> : i18n.dateShort(g.date)}
                    </td>
                    <td className={s.left}>
                      <span className={s.opp}>
                        <span className={s.oppMark}>{g.home === undefined ? '' : g.home ? i18n.t('vs') : i18n.t('at')}</span>
                        {g.opponentLogo && <TeamLogo team={{ name: g.opponent, logo: g.opponentLogo }} size={18} />}
                        {g.opponent}
                      </span>
                    </td>
                    {gameLog.some((x) => x.score) && (
                      <td>
                        {g.result && <span className={g.result === 'W' ? s.w : s.l}>{g.result === 'W' ? i18n.t('formWin') : i18n.t('formLoss')}</span>} {g.score}
                      </td>
                    )}
                    <td>{g.line.min ?? (g.line.sec ? Math.round(g.line.sec / 60) : '–')}</td>
                    <td className={t.strong}>{g.line.pts}</td>
                    <td>{g.line.reb}</td>
                    <td>{g.line.ast}</td>
                    <td>{g.line.stl}</td>
                    <td>{g.line.blk}</td>
                    <td>{g.line.tov}</td>
                    <td>{`${g.line.fgm}-${g.line.fga}`}</td>
                    <td>{`${g.line.tpm}-${g.line.tpa}`}</td>
                    <td>{`${g.line.ftm}-${g.line.fta}`}</td>
                    {gameLog.some((x) => x.line.eff !== undefined) && <td>{g.line.eff ?? '–'}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={<ListOrdered size={22} />} title={tr('noGameLog')} />
        )}
      </Card>

      <Card>
        <CardHeader title={tr('career')} />
        {career && career.length ? (
          <div className={t.scroll}>
            <table className={`${t.table} ${s.log}`}>
              <thead>
                <tr>
                  <th scope="col" className={s.left}>{tr('colSeason')}</th>
                  <th scope="col" className={s.left}>{tr('colTeam')}</th>
                  <th scope="col" className={s.left}>{tr('colLeague')}</th>
                  <th scope="col">{tr('sGp')}</th>
                  <th scope="col">{tr('sMin')}</th>
                  <th scope="col">{tr('sPts')}</th>
                  <th scope="col">{tr('sReb')}</th>
                  <th scope="col">{tr('sAst')}</th>
                  <th scope="col">{tr('sStl')}</th>
                  <th scope="col">{tr('sBlk')}</th>
                  <th scope="col" title={tr('lFgPct')}>{tr('sFg')}%</th>
                  <th scope="col" title={tr('l3pPct')}>{tr('s3p')}%</th>
                  <th scope="col" title={tr('lFtPct')}>{tr('sFt')}%</th>
                </tr>
              </thead>
              <tbody>
                {career.map((c, i) => (
                  <tr key={c.season + (c.team ?? '') + (c.league ?? '') + i}>
                    <td className={s.left}>{c.season}</td>
                    <td className={s.left}>{c.team ?? '–'}</td>
                    <td className={s.left}>{c.league ?? '–'}</td>
                    <td>{c.avg.gp}</td>
                    <td>{i18n.avg(c.avg.min)}</td>
                    <td className={t.strong}>{i18n.avg(c.avg.pts)}</td>
                    <td>{i18n.avg(c.avg.reb)}</td>
                    <td>{i18n.avg(c.avg.ast)}</td>
                    <td>{i18n.avg(c.avg.stl)}</td>
                    <td>{i18n.avg(c.avg.blk)}</td>
                    <td>{i18n.pct(c.avg.fgPct)}</td>
                    <td>{i18n.pct(c.avg.tpPct)}</td>
                    <td>{i18n.pct(c.avg.ftPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={<History size={22} />} title={tr('noCareer')} />
        )}
      </Card>
    </PageStack>
  );
}

function AverageTiles({ avg }: { avg: PlayerAverages }) {
  const i18n = useI18n();
  const { t } = i18n;
  return (
    <TileGrid>
      <StatTile label={t('lPts')} value={i18n.avg(avg.pts)} />
      <StatTile label={t('lReb')} value={i18n.avg(avg.reb)} sub={avg.oreb !== undefined ? `${i18n.avg(avg.oreb)} / ${i18n.avg(avg.dreb)}` : undefined} />
      <StatTile label={t('lAst')} value={i18n.avg(avg.ast)} />
      <StatTile label={t('lStl')} value={i18n.avg(avg.stl)} />
      <StatTile label={t('lBlk')} value={i18n.avg(avg.blk)} />
      {avg.eff !== undefined && <StatTile label={t('lEff')} value={i18n.avg(avg.eff)} />}
      <StatTile label={t('lFgPct')} value={i18n.pct(avg.fgPct)} sub={avg.fga ? `${i18n.avg(avg.fgm)} / ${i18n.avg(avg.fga)}` : undefined} />
      <StatTile label={t('l3pPct')} value={i18n.pct(avg.tpPct)} sub={avg.tpa ? `${i18n.avg(avg.tpm)} / ${i18n.avg(avg.tpa)}` : undefined} />
      <StatTile label={t('lFtPct')} value={i18n.pct(avg.ftPct)} sub={avg.fta ? `${i18n.avg(avg.ftm)} / ${i18n.avg(avg.fta)}` : undefined} />
      <StatTile label={t('lMin')} value={i18n.avg(avg.min)} />
      <StatTile label={t('lTov')} value={i18n.avg(avg.tov)} />
      <StatTile label={t('lGp')} value={i18n.num(avg.gp)} sub={avg.gs !== undefined ? `${t('sGs')}: ${avg.gs}` : undefined} />
    </TileGrid>
  );
}
