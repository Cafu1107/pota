import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ArrowLeftRight, GitCompareArrows, Search, X } from 'lucide-react';
import { LEAGUES, getLeague } from '../data/leagues';
import { usePlayer, usePlayerSearch, useTeam, useTeams } from '../data/queries';
import type { LeagueDef, PlayerAverages, TeamDetail } from '../data/types';
import { useI18n, type TKey } from '../i18n';
import { useDebounced } from '../lib/hooks';
import { matches } from '../lib/text';
import { PageStack } from '../components/layout/Page';
import { Segmented } from '../components/ui/Controls';
import { LeagueBadge, PlayerPhoto, TeamLogo } from '../components/ui/Media';
import { Card, EmptyState, Skeleton } from '../components/ui/States';
import s from './compare.module.css';

type Mode = 'players' | 'teams';
type SlotKey = 'a' | 'b';

const parseRef = (v: string | null) => {
  if (!v) return null;
  const i = v.indexOf(':');
  if (i < 0) return null;
  const league = getLeague(v.slice(0, i));
  const id = decodeURIComponent(v.slice(i + 1));
  return league && id ? { league, id } : null;
};

interface Row {
  key: string;
  label: TKey;
  a?: number;
  b?: number;
  pct?: boolean;
  inverse?: boolean;
}

function playerRows(a?: PlayerAverages, b?: PlayerAverages): Row[] {
  const r = (key: keyof PlayerAverages, label: TKey, extra: Partial<Row> = {}): Row => ({ key, label, a: a?.[key] as number | undefined, b: b?.[key] as number | undefined, ...extra });
  return [
    r('pts', 'lPts'),
    r('reb', 'lReb'),
    r('ast', 'lAst'),
    r('stl', 'lStl'),
    r('blk', 'lBlk'),
    r('eff', 'lEff'),
    r('tov', 'lTov', { inverse: true }),
    r('min', 'lMin'),
    r('fgPct', 'lFgPct', { pct: true }),
    r('tpPct', 'l3pPct', { pct: true }),
    r('ftPct', 'lFtPct', { pct: true }),
    r('gp', 'lGp'),
  ].filter((x) => x.a !== undefined || x.b !== undefined);
}

function teamRows(a?: TeamDetail, b?: TeamDetail): Row[] {
  const get = (d: TeamDetail | undefined, k: string) => d?.stats?.find((x) => x.key === k)?.value;
  const keys: Array<[string, TKey, Partial<Row>]> = [
    ['pts', 'lPts', {}],
    ['opp', 'lOpp', { inverse: true }],
    ['reb', 'lReb', {}],
    ['ast', 'lAst', {}],
    ['stl', 'lStl', {}],
    ['blk', 'lBlk', {}],
    ['tov', 'lTov', { inverse: true }],
    ['eff', 'lEff', {}],
    ['fgPct', 'lFgPct', { pct: true }],
    ['tpPct', 'l3pPct', { pct: true }],
    ['ftPct', 'lFtPct', { pct: true }],
  ];
  const win = (d?: TeamDetail) => (d?.record && d.record.w + d.record.l > 0 ? (d.record.w / (d.record.w + d.record.l)) * 100 : undefined);
  return [
    { key: 'win', label: 'colPct' as TKey, a: win(a), b: win(b), pct: true },
    ...keys.map(([k, label, extra]) => ({ key: k, label, a: get(a, k), b: get(b, k), ...extra })),
  ].filter((x) => x.a !== undefined || x.b !== undefined);
}

function Bars({ rows }: { rows: Row[] }) {
  const i18n = useI18n();
  const fmt = (r: Row, v?: number) => (v === undefined ? '–' : r.pct ? i18n.pct(v) : r.key === 'gp' ? i18n.num(v) : i18n.avg(v));
  return (
    <dl className={s.rows}>
      {rows.map((r) => {
        const max = Math.max(r.a ?? 0, r.b ?? 0) || 1;
        const aLead = r.a !== undefined && r.b !== undefined && (r.inverse ? r.a < r.b : r.a > r.b);
        const bLead = r.a !== undefined && r.b !== undefined && (r.inverse ? r.b < r.a : r.b > r.a);
        return (
          <div key={r.key} className={s.row}>
            <dt className={s.label}>{i18n.t(r.label)}</dt>
            <dd className={s.vals}>
              <span className={`${s.val} ${aLead ? s.leadVal : ''}`}>{fmt(r, r.a)}</span>
              <span className={s.bars} aria-hidden>
                <span className={s.half}>
                  <span className={s.fillA} style={{ transform: `scaleX(${(r.a ?? 0) / max})` }} />
                </span>
                <span className={`${s.half} ${s.halfB}`}>
                  <span className={s.fillB} style={{ transform: `scaleX(${(r.b ?? 0) / max})` }} />
                </span>
              </span>
              <span className={`${s.val} ${s.valB} ${bLead ? s.leadVal : ''}`}>{fmt(r, r.b)}</span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function PlayerPicker({ slot, onPick }: { slot: SlotKey; onPick: (leagueId: string, id: string) => void }) {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 300);
  const res = usePlayerSearch(dq);
  const hits = res.hits.filter((h) => matches(h.name, dq)).slice(0, 8);
  return (
    <div className={s.picker}>
      <label className={s.searchBox}>
        <Search size={16} aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('pickPlayer')} aria-label={`${t('pickPlayer')} ${slot.toUpperCase()}`} />
      </label>
      {dq.trim().length >= 3 && (
        <ul className={s.results}>
          {res.loading && hits.length === 0 && <li className={s.resultsNote}>{t('searchLoading')}</li>}
          {!res.loading && hits.length === 0 && <li className={s.resultsNote}>{t('searchNoResults', { q: dq.trim() })}</li>}
          {hits.map((h) => (
            <li key={`${h.leagueId}:${h.id}`}>
              <button type="button" className={s.result} onClick={() => onPick(h.leagueId, h.id)}>
                <PlayerPhoto src={h.photo} name={h.name} size={28} />
                <span className={s.resultText}>
                  <strong>{h.name}</strong>
                  <small>{[h.team, getLeague(h.leagueId)?.short].filter(Boolean).join(' · ')}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TeamPicker({ slot, onPick, defaultLeague }: { slot: SlotKey; onPick: (leagueId: string, id: string) => void; defaultLeague: string }) {
  const { t, lang } = useI18n();
  const [leagueId, setLeagueId] = useState(defaultLeague);
  const teams = useTeams(leagueId);
  return (
    <div className={s.teamPicker}>
      <label className={s.select}>
        <span className="sr-only">{t('pickLeague')}</span>
        <select value={leagueId} onChange={(e) => setLeagueId(e.target.value)}>
          {LEAGUES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name[lang]}
            </option>
          ))}
        </select>
      </label>
      <label className={s.select}>
        <span className="sr-only">
          {t('pickTeam')} {slot.toUpperCase()}
        </span>
        <select value="" onChange={(e) => e.target.value && onPick(leagueId, e.target.value)} disabled={teams.isLoading}>
          <option value="">{teams.isLoading ? t('loading') : t('pickTeam')}</option>
          {(teams.data ?? []).map((tm) => (
            <option key={tm.id} value={tm.id}>
              {tm.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function PlayerSlot({ refv, slot, onClear }: { refv: { league: LeagueDef; id: string }; slot: SlotKey; onClear: () => void }) {
  const q = usePlayer(refv.league.id, refv.id);
  const { t } = useI18n();
  const bio = q.data?.bio;
  return (
    <div className={`${s.chosen} ${slot === 'b' ? s.chosenB : ''}`}>
      {q.isLoading ? (
        <Skeleton w="100%" h={72} r={10} />
      ) : (
        <>
          <PlayerPhoto src={bio?.photo} name={bio?.name ?? '?'} size={64} />
          <span className={s.chosenText}>
            <Link to={`/oyuncu/${refv.league.id}/${encodeURIComponent(refv.id)}`} className={s.chosenName}>
              {bio?.name}
            </Link>
            <span className={s.chosenMeta}>
              {bio?.team?.name && <span>{bio.team.name}</span>}
              <span className={s.chosenLeague}>
                <LeagueBadge league={refv.league} size={14} />
                {refv.league.short}
              </span>
            </span>
          </span>
          <button type="button" className={s.clear} onClick={onClear} aria-label={t('clear')}>
            <X size={16} />
          </button>
        </>
      )}
    </div>
  );
}

function TeamSlot({ refv, slot, onClear }: { refv: { league: LeagueDef; id: string }; slot: SlotKey; onClear: () => void }) {
  const q = useTeam(refv.league.id, refv.id);
  const { t } = useI18n();
  const team = q.data?.team;
  return (
    <div className={`${s.chosen} ${slot === 'b' ? s.chosenB : ''}`}>
      {q.isLoading ? (
        <Skeleton w="100%" h={72} r={10} />
      ) : (
        <>
          {team && <TeamLogo team={team} size={56} />}
          <span className={s.chosenText}>
            <Link to={`/takim/${refv.league.id}/${encodeURIComponent(refv.id)}`} className={s.chosenName}>
              {team?.name}
            </Link>
            <span className={s.chosenMeta}>
              {q.data?.record && (
                <span className="tnum">
                  {q.data.record.w}-{q.data.record.l}
                </span>
              )}
              <span className={s.chosenLeague}>
                <LeagueBadge league={refv.league} size={14} />
                {refv.league.short}
              </span>
            </span>
          </span>
          <button type="button" className={s.clear} onClick={onClear} aria-label={t('clear')}>
            <X size={16} />
          </button>
        </>
      )}
    </div>
  );
}

export function ComparePage() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const mode: Mode = params.get('mod') === 'takim' ? 'teams' : 'players';
  const keys = mode === 'players' ? (['a', 'b'] as const) : (['ta', 'tb'] as const);
  const A = parseRef(params.get(keys[0]));
  const B = parseRef(params.get(keys[1]));

  const set = (k: string, v: string | null) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };
  const pick = (slot: SlotKey) => (leagueId: string, id: string) => set(slot === 'a' ? keys[0] : keys[1], `${leagueId}:${encodeURIComponent(id)}`);
  const swap = () => {
    const next = new URLSearchParams(params);
    const a = params.get(keys[0]);
    const b = params.get(keys[1]);
    if (b) next.set(keys[0], b);
    else next.delete(keys[0]);
    if (a) next.set(keys[1], a);
    else next.delete(keys[1]);
    setParams(next, { replace: true });
  };

  const pa = usePlayer(mode === 'players' ? A?.league.id : undefined, mode === 'players' ? A?.id : undefined);
  const pb = usePlayer(mode === 'players' ? B?.league.id : undefined, mode === 'players' ? B?.id : undefined);
  const ta = useTeam(mode === 'teams' ? A?.league.id : undefined, mode === 'teams' ? A?.id : undefined);
  const tb = useTeam(mode === 'teams' ? B?.league.id : undefined, mode === 'teams' ? B?.id : undefined);

  const rows = useMemo(
    () => (mode === 'players' ? playerRows(pa.data?.averages, pb.data?.averages) : teamRows(ta.data, tb.data)),
    [mode, pa.data, pb.data, ta.data, tb.data],
  );
  const ready = !!A && !!B;
  const differentLeagues = ready && A!.league.id !== B!.league.id && (A!.league.periodMinutes * A!.league.periods !== B!.league.periodMinutes * B!.league.periods);

  const slot = (k: SlotKey) => {
    const ref = k === 'a' ? A : B;
    if (ref) return mode === 'players' ? <PlayerSlot refv={ref} slot={k} onClear={() => set(k === 'a' ? keys[0] : keys[1], null)} /> : <TeamSlot refv={ref} slot={k} onClear={() => set(k === 'a' ? keys[0] : keys[1], null)} />;
    return mode === 'players' ? <PlayerPicker slot={k} onPick={pick(k)} /> : <TeamPicker slot={k} onPick={pick(k)} defaultLeague={(k === 'a' ? B : A)?.league.id ?? 'bsl'} />;
  };

  return (
    <PageStack>
      <header className={s.intro}>
        <h1 className={s.title}>{t('compareTitle')}</h1>
        <p className={s.lead}>{t('compareIntro')}</p>
      </header>
      <Card>
        <div className={s.toolbar}>
          <Segmented<Mode>
            label={t('compareTitle')}
            value={mode}
            onChange={(m) => {
              const next = new URLSearchParams(params);
              if (m === 'teams') next.set('mod', 'takim');
              else next.delete('mod');
              setParams(next, { replace: true });
            }}
            options={[
              { value: 'players', label: t('comparePlayers') },
              { value: 'teams', label: t('compareTeams') },
            ]}
          />
          {(A || B) && (
            <button type="button" className={s.swap} onClick={swap}>
              <ArrowLeftRight size={15} aria-hidden />
              {t('swap')}
            </button>
          )}
        </div>
        <div className={s.slots}>
          <div className={s.slot}>
            <span className={s.slotKey} aria-hidden>
              <i className={s.keyA} />A
            </span>
            {slot('a')}
          </div>
          <div className={s.slot}>
            <span className={s.slotKey} aria-hidden>
              <i className={s.keyB} />B
            </span>
            {slot('b')}
          </div>
        </div>
        {ready ? (
          <div className={s.body}>
            {differentLeagues && <p className={s.note}>{t('compareDifferentLeagues')}</p>}
            {rows.length ? <Bars rows={rows} /> : <p className={s.note}>{t('noData')}</p>}
          </div>
        ) : (
          <EmptyState icon={<GitCompareArrows size={22} />} title={t('compareEmpty')} hint={t('compareEmptyHint')} />
        )}
      </Card>
    </PageStack>
  );
}
