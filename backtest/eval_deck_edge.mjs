// Deck-edge experiment (2026-10-25): how often does "a cloud deck with a western edge"
// (deck_edge.mjs) fire, do the forecasts agree with ERA5 on it, and how does the current formula
// score those evenings? Also re-checks the recorded photo cases (cases.json). Changes nothing live.
//
//   /opt/homebrew/bin/node backtest/eval_deck_edge.mjs
//
// Same evenings and cache as scripts/backtest.mjs (2026-07-10 … 2026-10-07).
import { readFile, writeFile } from 'node:fs/promises';
import { SPOTS, REGIONS } from '../spots.js';
import { sunsetInfo } from '../sun.js';
import { MODELS, PATH_KM, memberScore, clarityFactor, inSector, label } from '../model.js';
import { OBS_VARS, PATH_VARS, buildInputs, detectBrokenModels, addDays } from '../data.js';
import { HF, ERA, ERA_OBS_VARS, MIDS, WINDOW, backtestDates, omLayer, asAllModels, pathKey, counts, contingency } from './lib.mjs';
import { deckEdge, ensembleShare, DECK } from './deck_edge.mjs';

const DATES = backtestDates();
const SUN = DATES.map((d) => SPOTS.map((s) => sunsetInfo(d, s.lat, s.lon, s.elev)));
console.log(`deck-edge experiment ${DATES[0]} … ${DATES.at(-1)}`);

const rows = [];
for (let w0 = 0; w0 < DATES.length; w0 += WINDOW) {
  const days = DATES.slice(w0, w0 + WINDOW).map((d, k) => ({ date: d, i: w0 + k }));
  const startUtc = days[0].date, endUtc = addDays(days.at(-1).date, 1);
  const keys = [], keyIdx = {};
  const dayPathIndex = days.map(({ i }) => Object.fromEntries(SPOTS.map((s, j) => [s.id, PATH_KM.slice(1).map((km) => {
    const k = pathKey(s, SUN[i][j].azimuth, km);
    if (keyIdx[k] == null) { keyIdx[k] = keys.length; keys.push(k); }
    return keyIdx[k];
  })])));
  const keyPts = keys.map((k) => k.split(',').map(Number));
  const spotPts = SPOTS.map((s) => [s.lat, s.lon]);
  const [fObs, fPath, tObs, tPath] = await Promise.all([
    omLayer(HF, spotPts, startUtc, endUtc, MIDS, OBS_VARS, { cell_selection: 'nearest' }),
    omLayer(HF, keyPts, startUtc, endUtc, MIDS, PATH_VARS, { cell_selection: 'sea' }),
    omLayer(ERA, spotPts, startUtc, endUtc, ['era5'], ERA_OBS_VARS, { cell_selection: 'nearest' }),
    omLayer(ERA, keyPts, startUtc, endUtc, ['era5'], PATH_VARS, { cell_selection: 'sea' }),
  ]);
  const fcData = { obs: fObs, path: fPath, pathKeys: keys };
  const excluded = detectBrokenModels(fcData);
  const truthData = { obs: tObs.map(asAllModels), path: tPath.map(asAllModels), pathKeys: keys };
  for (const [k, { date, i }] of days.entries()) {
    fcData.pathIndex = truthData.pathIndex = dayPathIndex[k];
    for (const [j, spot] of SPOTS.entries()) {
      const sun = SUN[i][j];
      const fin = buildInputs(fcData, j, spot, sun.sunset, 0, excluded);
      const tin = buildInputs(truthData, j, spot, sun.sunset, 0);
      const tm = tin.members[0];
      if (tm.path[0]?.low == null) continue;
      const base = { clarity: clarityFactor(null), horizon: inSector(sun.azimuth, spot.view) ? 1 : 0.88, aboveFog: false };
      const tr = memberScore(tm, base), td = deckEdge(tm.path);
      if (!tr || !td) continue;
      const scored = fin.members.map((m) => ({ m, r: memberScore(m, base), d: deckEdge(m.path) })).filter((x) => x.r && x.d);
      if (!scored.length) continue;
      const W = scored.reduce((s, x) => s + x.m.w, 0);
      const ens = scored.reduce((s, x) => s + x.r.score * x.m.w, 0) / W;
      const share = ensembleShare(scored.map((x) => x.m));
      rows.push({
        date, region: spot.region, spot: spot.id, ens, truth: tr.score,
        t: { deck: td.deck, strict: td.fires, lenient: td.firesLenient, edgeKm: td.edgeKm, canvasQ: tr.canvasQ, light: tr.light },
        f: { strict: share.strict >= 0.5, lenient: share.lenient >= 0.5, deck: scored.reduce((s, x) => s + (x.d.deck ? x.m.w : 0), 0) / W >= 0.5 },
        m: Object.fromEntries(scored.map((x) => [x.m.name, { strict: x.d.fires, lenient: x.d.firesLenient, score: x.r.score }])),
      });
    }
  }
  console.log(`window ${startUtc}…${endUtc}: ${rows.length} spot-evenings so far`);
}
console.log(`done: ${counts.calls} API calls, ${counts.cached} from cache`);

// ---------- report ----------
const half = DATES[Math.floor(DATES.length / 2)];
const pc = (x) => (x == null ? '–' : `${(x * 100).toFixed(1)}%`);
const f2 = (x) => (x == null ? '–' : x.toFixed(2));
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const groups = [['全部 All', () => true], ...REGIONS.map((r) => [`${r.name} ${r.en}`, (x) => x.region === r.id])];
const out = {};
const lines = [];
const P = (s = '') => { lines.push(s); console.log(s); };

P(`spot-evenings: ${rows.length}; halves ${DATES[0]}…${addDays(half, -1)} | ${half}…${DATES.at(-1)}`);
P(`thresholds: ${JSON.stringify(DECK)}`);
for (const v of ['lenient', 'strict']) {
  P(`\n## ${v}`);
  P('| 区域 Region | ERA5 触发率 truth rate | 预报触发率 forecast rate | POD | FAR | HSS (H1 / H2) | ERA5 触发时现评分 truth score when it fires | 其中 < 45 分 share < 45 | n |');
  P('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  out[v] = {};
  for (const [name, g] of groups) {
    const rs = rows.filter(g);
    const c = contingency(rs.map((r) => [r.f[v], r.t[v]]));
    const c1 = contingency(rs.filter((r) => r.date < half).map((r) => [r.f[v], r.t[v]]));
    const c2 = contingency(rs.filter((r) => r.date >= half).map((r) => [r.f[v], r.t[v]]));
    const fired = rs.filter((r) => r.t[v]);
    const ts = mean(fired.map((r) => r.truth)), low = fired.length ? fired.filter((r) => r.truth < 45).length / fired.length : null;
    out[v][name] = { n: rs.length, truthRate: c.base, fcRate: c.rate, pod: c.pod, far: c.far, hss: c.hss, hss1: c1.hss, hss2: c2.hss, truthScore: ts, lowShare: low, nFired: fired.length };
    P(`| ${name} | ${pc(c.base)} (${fired.length}) | ${pc(c.rate)} | ${pc(c.pod)} | ${pc(c.far)} | ${f2(c.hss)} (${f2(c1.hss)} / ${f2(c2.hss)}) | ${ts == null ? '–' : ts.toFixed(0)} | ${pc(low)} | ${rs.length} |`);
  }
  P(`\n每个模型自己的触发率 per-model fire rate (${v}) vs ERA5 ${pc(rows.filter((r) => r.t[v]).length / rows.length)}:`);
  P(MODELS.map((M) => {
    const rs = rows.filter((r) => r.m[M.name]);
    const c = contingency(rs.map((r) => [r.m[M.name][v], r.t[v]]));
    return `${M.name} ${pc(c.rate)} (POD ${pc(c.pod)}, FAR ${pc(c.far)}, HSS ${f2(c.hss)})`;
  }).join(' · '));
}
// How the current formula treats deck-edge evenings (ERA5 truth side, lenient).
const fired = rows.filter((r) => r.t.lenient), rest = rows.filter((r) => r.t.deck && !r.t.lenient);
P(`\nERA5 deck evenings with an edge (lenient, n ${fired.length}): mean canvas ${f2(mean(fired.map((r) => r.t.canvasQ)))}, light ${f2(mean(fired.map((r) => r.t.light)))}, score ${mean(fired.map((r) => r.truth))?.toFixed(1)}`);
P(`ERA5 deck evenings without an edge (n ${rest.length}): mean canvas ${f2(mean(rest.map((r) => r.t.canvasQ)))}, light ${f2(mean(rest.map((r) => r.t.light)))}, score ${mean(rest.map((r) => r.truth))?.toFixed(1)}`);
const edges = {}; for (const r of fired) edges[r.t.edgeKm] = (edges[r.t.edgeKm] || 0) + 1;
P(`edge distance (ERA5, lenient): ${Object.entries(edges).map(([k, n]) => `${k} km ×${n}`).join(', ')}`);
const byDate = {}; for (const r of fired) byDate[r.date] = (byDate[r.date] || 0) + 1;
P(`evenings with ≥ 5 spots firing (ERA5, lenient): ${Object.entries(byDate).filter(([, n]) => n >= 5).map(([d, n]) => `${d} ×${n}`).join(', ') || 'none'}`);

// ---------- photo cases ----------
let cases = [];
try { cases = JSON.parse(await readFile(new URL('cases.json', import.meta.url), 'utf8')); } catch {}
P('\n## 实拍案例 Photo cases (forecast snapshot in cases.json)');
for (const c of cases) for (const s of c.spots) {
  const e = s.deckEdge;
  P(`${c.id} ${s.spot}: observed ${c.observed.rating} (${c.observed.ratedBy}), site score ${s.forecast.score}, deck-edge share strict ${pc(e.ensemble?.strict)} / lenient ${pc(e.ensemble?.lenient)} · ${e.members.map((m) => `${m.name} ${m.firesLenient ? (m.fires ? 'strict' : 'lenient') : m.deck ? 'deck, no edge' : '–'}`).join(', ')}`);
}
await writeFile(new URL('deck_edge_results.json', import.meta.url), JSON.stringify({ dates: [DATES[0], DATES.at(-1)], half, thresholds: DECK, out, cases: cases.map((c) => c.id) }, null, 1));
