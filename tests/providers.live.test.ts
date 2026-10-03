// Live smoke test against the real upstream APIs (needs network).
// Run: npx vitest run tests/providers.live.test.ts
import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
// @ts-expect-error plain ESM module without types
import { createProxyMiddleware } from '../server/proxy.mjs';
import type { LeagueDef, Provider } from '../src/data/types';

const PORT = 5199;
let server: Server;
let providerFor: (l: LeagueDef) => Provider;
let getLeague: (id: string) => LeagueDef | undefined;
let todayKey: () => string;
let addDays: (k: string, d: number) => string;

beforeAll(async () => {
  const proxy = createProxyMiddleware();
  server = createServer((req, res) => proxy(req, res, () => res.writeHead(404).end()));
  await new Promise<void>((r) => server.listen(PORT, '127.0.0.1', () => r()));
  vi.stubEnv('VITE_PROXY_BASE', `http://127.0.0.1:${PORT}/proxy`);
  ({ providerFor } = await import('../src/data/api'));
  ({ getLeague } = await import('../src/data/leagues'));
  ({ todayKey, addDays } = await import('../src/lib/time'));
});

afterAll(() => server?.close());

const summary = (o: unknown) => (JSON.stringify(o, null, 0) ?? String(o)).slice(0, 400);

async function exercise(leagueId: string, days: number[], opts: { teamId?: string; playerQuery?: string } = {}) {
  const league = getLeague(leagueId)!;
  const p = providerFor(league);
  let found: { id: string } | undefined;
  for (const d of days) {
    const day = addDays(todayKey(), d);
    const games = await p.gamesByDate(league, day);
    console.log(`[${leagueId}] ${day}: ${games.length} games`, games.slice(0, 3).map((g) => `${g.home.team.name} ${g.home.score ?? ''}-${g.away.score ?? ''} ${g.away.team.name} [${g.status}${g.period ? ' P' + g.period : ''}${g.clock ? ' ' + g.clock : ''}]`));
    const pick = games.find((g) => g.status === 'final' || g.status === 'live');
    if (pick && !found) found = pick;
  }
  if (found) {
    const det = await p.game(league, found.id);
    console.log(`[${leagueId}] game ${found.id}: box=${!!det.box} players=${det.box?.home.players.length}/${det.box?.away.players.length} plays=${det.plays?.length} shots=${det.shots?.length} compare=${det.compare?.length} leaders=${det.leaders?.length} periods=${det.game.home.periods.join(',')}|${det.game.away.periods.join(',')} missing=${det.missing}`);
    expect(det.game.home.team.name).toBeTruthy();
    if (det.box) {
      const sample = det.box.home.players.find((x) => !x.dnp);
      console.log(`[${leagueId}] sample line`, summary(sample));
    }
    if (det.plays?.length) console.log(`[${leagueId}] plays`, summary(det.plays.slice(-3)));
    if (det.shots?.length) console.log(`[${leagueId}] shots`, summary(det.shots.slice(0, 2)));
  }
  const st = await p.standings(league);
  console.log(`[${leagueId}] standings groups=${st.length} rows=${st[0]?.rows.length}`, summary(st[0]?.rows[0]));
  const teams = await p.teams(league);
  console.log(`[${leagueId}] teams=${teams.length}`, summary(teams[0]));
  const teamId = opts.teamId ?? teams[0]?.id;
  if (teamId) {
    const t = await p.team(league, teamId);
    console.log(`[${leagueId}] team ${t.team.name}: roster=${t.roster.length} games=${t.games.length} coach=${t.coach} record=${summary(t.record)} standing=${summary(t.standing)} stats=${t.stats?.length}`);
    console.log(`[${leagueId}] roster[0]`, summary(t.roster[0]));
    const pl = t.roster.find((r) => r.id);
    if (pl) {
      const pd = await p.player(league, pl.id);
      console.log(`[${leagueId}] player ${pd.bio.name}: avg=${summary(pd.averages)} log=${pd.gameLog?.length} career=${pd.career?.length}`);
    }
  }
  const lead = await p.leaders(league);
  console.log(`[${leagueId}] leaders cats=${lead.map((c) => c.key + ':' + c.entries.length).join(',')}`, summary(lead[0]?.entries[0]));
  const sch = await p.schedule(league);
  console.log(`[${leagueId}] schedule kind=${sch.kind} rounds=${sch.rounds.length} round=${sch.round} games=${sch.games.length}`);
  if (opts.playerQuery) {
    const hits = await p.searchPlayers(league, opts.playerQuery);
    console.log(`[${leagueId}] search "${opts.playerQuery}": ${hits.length}`, summary(hits[0]));
  }
}

describe('providers (live)', () => {
  it('tbf: bsl', async () => exercise('bsl', [-7, -1, 0], { playerQuery: 'Saybir' }), 120_000);
  it('euroleague', async () => exercise('euroleague', [-1, 0], { teamId: 'ULK', playerQuery: 'Vezenkov' }), 120_000);
  it('nba', async () => exercise('nba', [0, -1], { teamId: '2', playerQuery: 'Tatum' }), 120_000);
  it('nbl', async () => exercise('nbl', [-1, 0]), 120_000);
});
