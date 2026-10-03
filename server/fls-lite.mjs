// Compact live state from a FIBA LiveStats data.json (≈30 KB gzipped → ≈0.3 KB).
// Shared by the local proxy and the Cloudflare Worker so list polling stays cheap.

const n = (v) => {
  const x = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(x) ? x : 0;
};

function periods(t) {
  const out = [];
  for (let i = 1; i <= 10; i++) {
    const v = t?.[`p${i}_score`];
    if (v === undefined) break;
    out.push(n(v));
  }
  let ot = 0;
  for (let i = 1; i <= 6; i++) {
    const v = t?.[`ot${i}_score`];
    if (v === undefined) break;
    out.push(n(v));
    ot++;
  }
  if (!ot && t?.ot_score !== undefined && t?.ot_score !== null && t?.ot_score !== '') out.push(n(t.ot_score));
  return out;
}

/** @param {any} j parsed data.json */
export function flsLite(j) {
  const pbp = Array.isArray(j?.pbp) ? j.pbp : [];
  const last = pbp[0];
  const team = (k) => ({ name: j?.tm?.[k]?.name ?? '', score: n(j?.tm?.[k]?.score), periods: periods(j?.tm?.[k]) });
  return {
    started: pbp.length > 0,
    ended: pbp.some((p) => p.actionType === 'game' && p.subType === 'end'),
    isBreak: last?.actionType === 'period' && last?.subType === 'end',
    period: n(j?.period) || 1,
    periodType: j?.periodType ?? 'REGULAR',
    periodsMax: n(j?.periodsMax) || 4,
    clock: String(j?.clock ?? ''),
    tm: { 1: team('1'), 2: team('2') },
  };
}
