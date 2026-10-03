import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ArrowDownWideNarrow } from 'lucide-react';
import type { Game, LeagueDef, PlayerLine, Side, StatLine, TeamBox } from '../../data/types';
import { useI18n, type TKey } from '../../i18n';
import { useMediaQuery } from '../../lib/hooks';
import { Segmented } from '../ui/Controls';
import { PlayerPhoto, TeamLogo } from '../ui/Media';
import t from '../tables/tables.module.css';
import s from './game.module.css';

type ColKey = 'min' | 'pts' | 'fg' | 'two' | 'three' | 'ft' | 'reb' | 'oreb' | 'dreb' | 'ast' | 'stl' | 'blk' | 'tov' | 'pf' | 'pm' | 'eff';

interface Col {
  key: ColKey;
  short: TKey;
  long: TKey;
  value: (l: StatLine) => number;
  text: (l: StatLine) => string;
  wide?: boolean;
  best?: boolean;
}

const pair = (a: number, b: number) => `${a}-${b}`;
const clock = (sec?: number) => (sec === undefined ? '–' : `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`);

const ALL_COLS: Col[] = [
  { key: 'min', short: 'sMin', long: 'lMin', value: (l) => l.sec ?? 0, text: (l) => (l.sec !== undefined ? clock(l.sec) : l.min ?? '–') },
  { key: 'pts', short: 'sPts', long: 'lPts', value: (l) => l.pts, text: (l) => String(l.pts), best: true },
  { key: 'fg', short: 'sFg', long: 'lFg', value: (l) => l.fgm, text: (l) => pair(l.fgm, l.fga) },
  { key: 'two', short: 's2p', long: 'l2p', value: (l) => l.fgm - l.tpm, text: (l) => pair(l.fgm - l.tpm, l.fga - l.tpa), wide: true },
  { key: 'three', short: 's3p', long: 'l3p', value: (l) => l.tpm, text: (l) => pair(l.tpm, l.tpa) },
  { key: 'ft', short: 'sFt', long: 'lFt', value: (l) => l.ftm, text: (l) => pair(l.ftm, l.fta) },
  { key: 'reb', short: 'sReb', long: 'lReb', value: (l) => l.reb, text: (l) => String(l.reb), best: true },
  { key: 'oreb', short: 'sOreb', long: 'lOreb', value: (l) => l.oreb, text: (l) => String(l.oreb), wide: true },
  { key: 'dreb', short: 'sDreb', long: 'lDreb', value: (l) => l.dreb, text: (l) => String(l.dreb), wide: true },
  { key: 'ast', short: 'sAst', long: 'lAst', value: (l) => l.ast, text: (l) => String(l.ast), best: true },
  { key: 'stl', short: 'sStl', long: 'lStl', value: (l) => l.stl, text: (l) => String(l.stl), best: true },
  { key: 'blk', short: 'sBlk', long: 'lBlk', value: (l) => l.blk, text: (l) => String(l.blk), best: true },
  { key: 'tov', short: 'sTov', long: 'lTov', value: (l) => l.tov, text: (l) => String(l.tov) },
  { key: 'pf', short: 'sPf', long: 'lPf', value: (l) => l.pf, text: (l) => String(l.pf) },
  { key: 'pm', short: 'sPm', long: 'lPm', value: (l) => l.pm ?? 0, text: (l) => (l.pm === undefined ? '–' : l.pm > 0 ? `+${l.pm}` : String(l.pm)) },
  { key: 'eff', short: 'sEff', long: 'lEff', value: (l) => l.eff ?? 0, text: (l) => (l.eff === undefined ? '–' : String(l.eff)), best: true },
];

function TeamTable({ box, side, game, cols }: { box: TeamBox; side: Side; game: Game; cols: Col[] }) {
  const i18n = useI18n();
  const { t: tr } = i18n;
  const [sort, setSort] = useState<ColKey | null>(null);
  const team = game[side].team;
  const played = box.players.filter((p) => !p.dnp);
  const dnp = box.players.filter((p) => p.dnp);
  const hasStarters = played.some((p) => p.starter);

  const best = useMemo(() => {
    const m = new Map<ColKey, number>();
    for (const c of cols) if (c.best) m.set(c.key, Math.max(0, ...played.map((p) => c.value(p))));
    return m;
  }, [cols, played]);

  const sorted = sort ? [...played].sort((a, b) => cols.find((c) => c.key === sort)!.value(b) - cols.find((c) => c.key === sort)!.value(a)) : null;
  const sections: Array<{ title?: string; rows: PlayerLine[] }> = sorted
    ? [{ rows: sorted }]
    : hasStarters
      ? [
          { title: tr('starters'), rows: played.filter((p) => p.starter) },
          { title: tr('bench'), rows: played.filter((p) => !p.starter) },
        ]
      : [{ rows: played }];

  const tot = box.totals;
  const pct = (a: number, b: number) => (b ? i18n.pct((a / b) * 100) : '–');
  const live = game.status === 'live';

  return (
    <section className={s.boxTeam} aria-label={team.name}>
      <header className={s.boxHead}>
        <TeamLogo team={team} size={26} />
        <h3 className={s.boxTeamName}>{team.name}</h3>
        {box.coach && (
          <span className={s.boxCoach}>
            {tr('coach')}: {box.coach}
          </span>
        )}
      </header>
      <div className={`${t.scroll} ${s.boxScroll}`}>
        <table className={`${t.table} ${s.boxTable}`}>
          <thead>
            <tr>
              <th scope="col" className={s.boxPlayerCol}>
                {sort ? (
                  <button type="button" className={s.sortReset} onClick={() => setSort(null)}>
                    {tr('starters')} / {tr('bench')}
                  </button>
                ) : (
                  <span className="sr-only">{tr('colTeam')}</span>
                )}
              </th>
              {cols.map((c) => (
                <th key={c.key} scope="col" className={c.wide ? t.wide : undefined} aria-sort={sort === c.key ? 'descending' : undefined}>
                  <button type="button" className={`${s.sortBtn} ${sort === c.key ? s.sortActive : ''}`} title={tr(c.long)} onClick={() => setSort(sort === c.key ? null : c.key)}>
                    {tr(c.short)}
                    {sort === c.key && <ArrowDownWideNarrow size={12} aria-hidden />}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sections.map((sec, si) => (
              <Fragment key={si}>
                {sec.title && sec.rows.length > 0 && (
                  <tr className={s.boxSection}>
                    <th scope="rowgroup" colSpan={cols.length + 1}>
                      {sec.title}
                    </th>
                  </tr>
                )}
                {sec.rows.map((p) => (
                  <tr key={`${p.id}-${p.number}-${p.name}`}>
                    <th scope="row" className={s.boxPlayerCol}>
                      <PlayerCell p={p} leagueId={game.leagueId} live={live} />
                    </th>
                    {cols.map((c) => {
                      const v = c.value(p);
                      const isBest = c.best && v > 0 && best.get(c.key) === v;
                      return (
                        <td key={c.key} className={`${c.wide ? t.wide : ''} ${isBest ? s.best : ''} ${c.key === 'pts' ? s.ptsCell : ''}`}>
                          {c.text(p)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
            {dnp.length > 0 && (
              <tr className={s.boxDnp}>
                <th scope="row" colSpan={cols.length + 1}>
                  <span className={s.dnpLabel}>{tr('didNotPlay')}:</span> {dnp.map((p) => p.name).join(', ')}
                </th>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className={s.boxTotals}>
              <th scope="row" className={s.boxPlayerCol}>
                {tr('totals')}
              </th>
              {cols.map((c) => (
                <td key={c.key} className={c.wide ? t.wide : undefined}>
                  {c.key === 'min' || c.key === 'pm' ? '' : c.text(tot)}
                </td>
              ))}
            </tr>
            <tr className={s.boxPct}>
              <th scope="row" className={s.boxPlayerCol}>
                %
              </th>
              {cols.map((c) => (
                <td key={c.key} className={c.wide ? t.wide : undefined}>
                  {c.key === 'fg' ? pct(tot.fgm, tot.fga) : c.key === 'two' ? pct(tot.fgm - tot.tpm, tot.fga - tot.tpa) : c.key === 'three' ? pct(tot.tpm, tot.tpa) : c.key === 'ft' ? pct(tot.ftm, tot.fta) : ''}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function PlayerCell({ p, leagueId, live }: { p: PlayerLine; leagueId: string; live: boolean }) {
  const { t } = useI18n();
  const content = (
    <>
      <span className={s.boxNo}>{p.number ?? ''}</span>
      <PlayerPhoto src={p.photo} name={p.name} size={28} className={s.boxPhoto} />
      <span className={s.boxName}>
        <span className={s.boxNameText}>{p.name}</span>
        {p.position && <span className={s.boxPos}>{p.position}</span>}
      </span>
      {live && p.onCourt && <span className={s.onCourt} title={t('onCourt')} aria-label={t('onCourt')} />}
    </>
  );
  return p.id ? (
    <Link to={`/oyuncu/${leagueId}/${encodeURIComponent(p.id)}`} className={s.boxPlayer}>
      {content}
    </Link>
  ) : (
    <span className={s.boxPlayer}>{content}</span>
  );
}

export function BoxScore({ box, game }: { box: Record<Side, TeamBox>; game: Game; league?: LeagueDef }) {
  const { t } = useI18n();
  const wide = useMediaQuery('(min-width: 900px)');
  const [side, setSide] = useState<Side>('home');
  const all = [...box.home.players, ...box.away.players];
  const cols = ALL_COLS.filter((c) => {
    if (c.key === 'pm') return all.some((p) => p.pm !== undefined && p.pm !== 0);
    if (c.key === 'eff') return all.some((p) => p.eff !== undefined);
    if (c.key === 'min') return all.some((p) => p.sec !== undefined || p.min);
    return true;
  });
  return (
    <div className={s.box}>
      {!wide && (
        <Segmented<Side>
          label={t('colTeam')}
          value={side}
          onChange={setSide}
          options={[
            { value: 'home', label: game.home.team.short ?? game.home.team.name },
            { value: 'away', label: game.away.team.short ?? game.away.team.name },
          ]}
        />
      )}
      {(wide ? (['home', 'away'] as Side[]) : [side]).map((sd) => (
        <TeamTable key={sd} box={box[sd]} side={sd} game={game} cols={cols} />
      ))}
    </div>
  );
}
