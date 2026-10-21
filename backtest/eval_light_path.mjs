// Light-path experiment (2026-10-21), inspired by sunsetbot.top's cloud-base geometry:
// after sunset a cloud at height h stays lit until the sun's ray, grazing the haze / marine-layer
// top at hb, no longer reaches it. That ray's lowest point lies D = sqrt(2·R·(h − hb)) toward the sun,
// and during the glow it sweeps from the canvas out to D. So the stretch of ocean whose low cloud
// matters depends on the canvas height: ≈ 210 km for mid cloud (4.5 km), ≈ 320 km for high cloud (9 km).
// The site samples a fixed 75 / 150 / 250 km. This script compares, for the same evenings as the main
// backtest, the current light factor with geometry-weighted variants that add 300 and 350 km points.
//
//   /opt/homebrew/bin/node backtest/eval_light_path.mjs [--end 2026-10-07] [--days 90]
//
// Reuses backtest/cache for the spot layers and METARs; only the extended path points are new.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { SPOTS } from '../spots.js';
import { sunsetInfo } from '../sun.js';
import { MODELS, memberScore, clarityFactor, inSector, label, clamp } from '../model.js';
import { OBS_VARS, PATH_VARS, buildInputs, parseLocation, sample, destPoint, distanceKm, detectBrokenModels, addDays } from '../data.js';

const HF = 'https://historical-forecast-api.open-meteo.com/v1/forecast';
const ERA = 'https://archive-api.open-meteo.com/v1/archive';
const IEM = 'https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py';
const IEM_NET = 'https://mesonet.agron.iastate.edu/geojson/network/CA_ASOS.geojson';
const CACHE = new URL('cache/', import.meta.url);
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const NDAYS = +arg('days', 90);
const END = arg('end', '2026-10-07');
const DATES = Array.from({ length: NDAYS }, (_, i) => addDays(END, i - NDAYS + 1));
const WINDOW = 14, CHUNK = 60;
const STATIONS = ['CEC', 'EKA', 'O87', 'LLR', 'HAF', 'MRY', 'L52', 'SBA', 'OXR', 'SMO', 'LAX', 'TOA', 'OKB', 'CRQ', 'NZY', 'SAN'];
const ERA_OBS_VARS = ['cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high', 'cloud_cover', 'temperature_2m', 'relative_humidity_2m', 'precipitation'];
const MIDS = MODELS.map((m) => m.id);
const EXT_KM = [25, 75, 150, 250, 300, 350];

// ---------- cached fetching (same cache keys as scripts/backtest.mjs) ----------
const weightOf = (nLoc, nSeries, nDays) => nLoc * Math.max(1, nSeries / 10) * Math.max(1, nDays / 14);
const spent = []; let calls = 0, cached = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function throttle(w) {
  for (;;) {
    const now = Date.now();
    const inWin = (ms) => spent.filter(([t]) => now - t < ms).reduce((s, [, x]) => s + x, 0);
    if (inWin(60e3) + w <= 500 && inWin(3600e3) + w <= 4500) break;
    await sleep(5000);
  }
  spent.push([Date.now(), w]);
}
async function cachedGet(url, w = 0, { text = false } = {}) {
  const file = new URL(createHash('sha1').update(url).digest('hex') + (text ? '.txt' : '.json'), CACHE);
  try { const s = await readFile(file, 'utf8'); cached++; return text ? s : JSON.parse(s); } catch {}
  await throttle(w);
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(180e3) });
      const body = await res.text();
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} ${body.slice(0, 200)}`), { status: res.status });
      if (!text) JSON.parse(body);
      await writeFile(file, body);
      calls++;
      return text ? body : JSON.parse(body);
    } catch (e) {
      if (attempt >= 8 || (e.status && e.status < 500 && e.status !== 429)) throw e;
      const wait = e.status === 429 ? 65e3 * (attempt + 1) : 5e3 * 2 ** attempt;
      console.log(`  retry in ${Math.round(wait / 1000)} s (${e.message.slice(0, 80)})`);
      await sleep(wait);
    }
  }
}
async function omLayer(base, pts, startUtc, endUtc, models, vars, extra = {}) {
  const out = [];
  const nDays = (Date.parse(endUtc) - Date.parse(startUtc)) / 864e5 + 1;
  for (let i = 0; i < pts.length; i += CHUNK) {
    const p = pts.slice(i, i + CHUNK);
    const q = new URLSearchParams({
      latitude: p.map((x) => x[0].toFixed(3)).join(','), longitude: p.map((x) => x[1].toFixed(3)).join(','),
      hourly: vars.join(','), models: models.join(','), start_date: startUtc, end_date: endUtc,
      timeformat: 'unixtime', timezone: 'GMT', ...extra,
    });
    const json = await cachedGet(`${base}?${q}`, weightOf(p.length, vars.length * models.length, nDays));
    out.push(...(Array.isArray(json) ? json : [json]).map((l) => parseLocation(l, models, vars)));
  }
  return out;
}
const asAllModels = (loc) => loc && { t: loc.t, s: Object.fromEntries(MIDS.map((id) => [id, loc.s.era5])) };

// ---------- METAR (identical query to scripts/backtest.mjs, so it comes from the cache) ----------
const COVER = { CLR: 0, SKC: 0, NSC: 0, FEW: 0.19, SCT: 0.44, BKN: 0.75, OVC: 1, VV: 1 };
async function loadMetars(stationMeta) {
  const q = new URLSearchParams({ data: 'vsby', tz: 'Etc/UTC', format: 'onlycomma', latlon: 'no', missing: 'null', trace: 'null', report_type: '3' });
  for (const k of ['skyc1', 'skyl1', 'skyc2', 'skyl2', 'skyc3', 'skyl3']) q.append('data', k);
  for (const s of stationMeta) q.append('station', s.id);
  const a = DATES[0], b = addDays(DATES.at(-1), 2);
  q.set('year1', a.slice(0, 4)); q.set('month1', +a.slice(5, 7)); q.set('day1', +a.slice(8));
  q.set('year2', b.slice(0, 4)); q.set('month2', +b.slice(5, 7)); q.set('day2', +b.slice(8));
  const csv = await cachedGet(`${IEM}?${q}`, 0, { text: true });
  const by = {};
  for (const line of (csv || '').trim().split('\n').slice(1)) {
    const [st, valid, vsby, ...sky] = line.split(',');
    let low = 0, seen = false;
    for (let i = 0; i < 6; i += 2) {
      const c = sky[i], h = sky[i + 1];
      if (!c || c === 'null' || COVER[c] == null) continue;
      seen = true;
      if (c === 'CLR' || c === 'SKC' || c === 'NSC' || (h !== 'null' && +h <= 6500) || c === 'VV') low = Math.max(low, COVER[c]);
    }
    if (!seen) continue;
    (by[st] ||= []).push({ t: Date.parse(valid.replace(' ', 'T') + 'Z'), low, vis: vsby === 'null' ? null : +vsby * 1609 });
  }
  return by;
}
const metarAt = (list, T) => {
  let best = null;
  for (const o of list || []) if (Math.abs(o.t - T) <= 40 * 60e3 && (!best || Math.abs(o.t - T) < Math.abs(best.t - T))) best = o;
  return best;
};

// ---------- light-path variants ----------
const R = 6371, HB = 1; // km; haze / marine-layer top the grazing ray must clear
const H = { mid: 4.5, high: 9 }; // typical canvas heights (Open-Meteo: mid 2–6 km, high > 6 km)
const X0 = 30; // km; mean distance of the canvas toward the sun (site weights 0 / 25 / 75 km at .35/.4/.25)
// Each sampled distance stands for the stretch of ocean around it.
const BINS = { 75: [50, 112], 150: [112, 200], 250: [200, 275], 300: [275, 325], 350: [325, 375] };
const reach = (h) => X0 + Math.sqrt(2 * R * (h - HB));
const overlap = ([a, b], [c, d]) => Math.max(0, Math.min(b, d) - Math.max(a, c));
const geoWeights = (h, late = false) => Object.fromEntries(Object.entries(BINS).map(([km, bin]) => {
  const w = overlap(bin, [X0, reach(h)]);
  // "late": weight grows with distance, i.e. with time after sunset, when the colour is deepest.
  return [km, late ? w * ((bin[0] + bin[1]) / 2) / reach(h) : w];
}));
const blockOf = (c) => clamp(c.low * 0.8 + (c.mid ?? 0) * 0.3);
function lightFrom(path, weights) {
  let s = 0, w = 0;
  for (const [km, wt] of Object.entries(weights)) {
    const c = path[km];
    if (!c || c.low == null || !wt) continue;
    s += blockOf(c) * wt; w += wt;
  }
  return w ? clamp(1 - 1.15 * (s / w), 0.05, 1) : 0.85;
}
const VARIANTS = {
  now: () => ({ 75: 0.3, 150: 0.4, 250: 0.3 }),
  ext300: () => ({ 75: 0.25, 150: 0.3, 250: 0.25, 300: 0.2 }),
  geo: (hs) => mixW(geoWeights(H.mid), geoWeights(H.high), hs),
  geoLate: (hs) => mixW(geoWeights(H.mid, true), geoWeights(H.high, true), hs),
};
function mixW(a, b, hs) {
  const n = (o) => { const t = Object.values(o).reduce((s, x) => s + x, 0); return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v / t])); };
  const A = n(a), B = n(b);
  return Object.fromEntries(Object.keys(BINS).map((k) => [k, (1 - hs) * (A[k] ?? 0) + hs * (B[k] ?? 0)]));
}

// ---------- run ----------
console.log(`light-path experiment ${DATES[0]} … ${DATES.at(-1)}`);
console.log('reach (km): mid', Math.round(reach(H.mid)), '· high', Math.round(reach(H.high)));
const SUN = DATES.map((d) => SPOTS.map((s) => sunsetInfo(d, s.lat, s.lon, s.elev)));
const pathKey = (s, az, km) => {
  const [la, lo] = destPoint(s.lat, s.lon, az, km);
  const step = km <= 25 ? 0.1 : km <= 75 ? 0.25 : 0.5;
  return `${(Math.round(la / step) * step).toFixed(2)},${(Math.round(lo / step) * step).toFixed(2)}`;
};
await mkdir(CACHE, { recursive: true });
const net = await cachedGet(IEM_NET, 0);
const stationMeta = STATIONS.map((id) => {
  const f = net?.features.find((x) => x.properties.sid === id);
  return f && { id, lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] };
}).filter(Boolean);
const metars = await loadMetars(stationMeta);
const spotStation = SPOTS.map((s) => stationMeta.find((st) => distanceKm(s, st) <= 10) || null);

const rows = [];
for (let w0 = 0; w0 < DATES.length; w0 += WINDOW) {
  const days = DATES.slice(w0, w0 + WINDOW).map((d, k) => ({ date: d, i: w0 + k }));
  const startUtc = days[0].date, endUtc = addDays(days.at(-1).date, 1);
  const keys = [], keyIdx = {};
  const idx = days.map(({ i }) => SPOTS.map((s, j) => Object.fromEntries(EXT_KM.map((km) => {
    const k = pathKey(s, SUN[i][j].azimuth, km);
    if (keyIdx[k] == null) { keyIdx[k] = keys.length; keys.push(k); }
    return [km, keyIdx[k]];
  }))));
  const keyPts = keys.map((k) => k.split(',').map(Number));
  const spotPts = SPOTS.map((s) => [s.lat, s.lon]);
  console.log(`window ${startUtc}…${endUtc}: ${keys.length} path points`);
  const [fObs, fPath, tObs, tPath] = await Promise.all([
    omLayer(HF, spotPts, startUtc, endUtc, MIDS, OBS_VARS, { cell_selection: 'nearest' }),
    omLayer(HF, keyPts, startUtc, endUtc, MIDS, PATH_VARS, { cell_selection: 'sea' }),
    omLayer(ERA, spotPts, startUtc, endUtc, ['era5'], ERA_OBS_VARS, { cell_selection: 'nearest' }),
    omLayer(ERA, keyPts, startUtc, endUtc, ['era5'], PATH_VARS, { cell_selection: 'sea' }),
  ]);
  const excluded = detectBrokenModels({ obs: fObs, path: fPath });
  const skip = new Set(excluded.map((e) => e.id));
  const frac = (x) => (x == null ? null : clamp(x / 100));
  const cellAt = (loc, id, T) => {
    const c = { low: frac(sample(loc, id, 'cloud_cover_low', T)), mid: frac(sample(loc, id, 'cloud_cover_mid', T)), high: frac(sample(loc, id, 'cloud_cover_high', T)) };
    return c.low == null ? null : c;
  };
  for (const [k, { date }] of days.entries()) {
    for (const [j, spot] of SPOTS.entries()) {
      const sun = SUN[days[k].i][j], T = sun.sunset;
      const base = { clarity: clarityFactor(null), horizon: inSector(sun.azimuth, spot.view) ? 1 : 0.88, aboveFog: false };
      // Site-shaped path ([obs, 25, 75, 150, 250]) so memberScore() runs unchanged; the variants then
      // swap the light factor using the extended path.
      const pathOf = (locs, id) => Object.fromEntries(EXT_KM.map((km) => [km, cellAt(locs[idx[k][j][km]], id, T)]));
      const asMember = (obsLoc, locs, id, name, w) => {
        const p = pathOf(locs, id);
        const o = obsLoc && {
          low: frac(sample(obsLoc, id, 'cloud_cover_low', T)), mid: frac(sample(obsLoc, id, 'cloud_cover_mid', T)), high: frac(sample(obsLoc, id, 'cloud_cover_high', T)),
          vis: sample(obsLoc, id, 'visibility', T), t2: sample(obsLoc, id, 'temperature_2m', T), t925: sample(obsLoc, id, 'temperature_925hPa', T),
          rh: sample(obsLoc, id, 'relative_humidity_2m', T), precip: sample(obsLoc, id, 'precipitation', T),
        };
        return { id, name, w, ext: p, path: [o, p[25], p[75], p[150], p[250]] };
      };
      const truthLocs = tPath.map(asAllModels), truthObs = asAllModels(tObs[j]);
      const tm = asMember(truthObs, truthLocs, MIDS[0], 'ERA5', 1);
      const tr = memberScore(tm, base);
      if (!tr || tr.low == null) continue;
      const ob = spotStation[j] && metarAt(metars[spotStation[j].id], T);
      const hyM = ob && { ...tm, path: [{ ...tm.path[0], low: ob.low, vis: ob.vis }, ...tm.path.slice(1)] };
      const hy = hyM && memberScore(hyM, base);
      const members = MODELS.filter((M) => !skip.has(M.id)).map((M) => asMember(fObs[j], fPath, M.id, M.name, M.w[0]));
      const scored = members.map((m) => ({ m, r: memberScore(m, base) })).filter((x) => x.r);
      if (!scored.length) continue;
      const hsOf = (r) => (r.high != null && r.mid != null && r.high + r.mid > 0.02 ? r.high / (r.high + r.mid) : 0.5);
      const row = { date, spot: spot.id, region: spot.region, v: {} };
      for (const [name, wf] of Object.entries(VARIANTS)) {
        const scoreWith = (m, r) => {
          const L = lightFrom(m.ext, wf(hsOf(r)));
          return { s: r.light > 0 ? (r.score * L) / r.light : 100 * r.canvasQ * L * r.local * base.clarity * base.horizon, L };
        };
        let s = 0, w = 0, Ls = 0;
        for (const { m, r } of scored) { const x = scoreWith(m, r); s += x.s * m.w; Ls += x.L * m.w; w += m.w; }
        const t = scoreWith(tm, tr);
        row.v[name] = { ens: s / w, L: Ls / w, truth: t.s, tL: t.L, hybrid: hy ? scoreWith(hyM, hy).s : null };
      }
      rows.push(row);
    }
  }
}
console.log(`done: ${calls} API calls, ${cached} from cache, ${rows.length} spot-evenings`);

// ---------- stats ----------
const half = DATES[Math.floor(DATES.length / 2)];
const sets = { all: rows, h1: rows.filter((r) => r.date < half), h2: rows.filter((r) => r.date >= half) };
const mae = (rs, f) => { const p = rs.map(f).filter((x) => x && x[0] != null && x[1] != null); return [p.reduce((s, [a, b]) => s + Math.abs(a - b), 0) / p.length, p.length]; };
const corr = (rs, f) => {
  const p = rs.map(f).filter((x) => x && x[0] != null && x[1] != null);
  const ma = p.reduce((s, x) => s + x[0], 0) / p.length, mb = p.reduce((s, x) => s + x[1], 0) / p.length;
  let c = 0, va = 0, vb = 0; for (const [a, b] of p) { c += (a - ma) * (b - mb); va += (a - ma) ** 2; vb += (b - mb) ** 2; }
  return c / Math.sqrt(va * vb);
};
const res = {};
for (const name of Object.keys(VARIANTS)) {
  res[name] = {};
  for (const [sk, rs] of Object.entries(sets)) {
    res[name][sk] = {
      lightMAE: mae(rs, (r) => [r.v[name].L, r.v[name].tL])[0],
      lightR: corr(rs, (r) => [r.v[name].L, r.v[name].tL]),
      scoreMAE: mae(rs, (r) => [r.v[name].ens, r.v[name].truth])[0],
      scoreR: corr(rs, (r) => [r.v[name].ens, r.v[name].truth]),
      hybMAE: mae(rs, (r) => [r.v[name].ens, r.v[name].hybrid]),
      sameBand: rs.filter((r) => label(r.v[name].ens) === label(r.v[name].truth)).length / rs.length,
      vsNow: rs.reduce((s, r) => s + Math.abs(r.v[name].ens - r.v.now.ens), 0) / rs.length,
      labelChange: rs.filter((r) => label(r.v[name].ens) !== label(r.v.now.ens)).length / rs.length,
    };
  }
}
console.log(`halves: ${DATES[0]}…${addDays(half, -1)} | ${half}…${DATES.at(-1)}`);
for (const [name, r] of Object.entries(res)) {
  const f = (x) => x.toFixed(3);
  console.log(`\n${name}`);
  for (const sk of ['all', 'h1', 'h2']) {
    const x = r[sk];
    console.log(`  ${sk}: light MAE ${f(x.lightMAE)} r ${f(x.lightR)} | score MAE ${x.scoreMAE.toFixed(2)} r ${f(x.scoreR)} | hybrid MAE ${x.hybMAE[0].toFixed(2)} (n ${x.hybMAE[1]}) | same band ${(x.sameBand * 100).toFixed(1)}% | |Δ vs now| ${x.vsNow.toFixed(2)} · label changes ${(x.labelChange * 100).toFixed(1)}%`);
  }
}
await writeFile(new URL('light_path_results.json', import.meta.url), JSON.stringify({ dates: [DATES[0], DATES.at(-1)], half, reach: { mid: reach(H.mid), high: reach(H.high) }, res }, null, 1));
console.log('\nwrote backtest/light_path_results.json');
