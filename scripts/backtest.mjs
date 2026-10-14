// Offline backtest of the WEATHER INPUTS (not glow beauty): for past evenings, compare each model's
// forecast at sunset with what actually happened, and run the site's own scoring on both.
//
//   /opt/homebrew/bin/node scripts/backtest.mjs [--days 90] [--end YYYY-MM-DD] [--dry]
//
// Forecast side: Open-Meteo Historical Forecast API (first hours of every run stitched together, so
// a lead time of roughly 0–6 h), plus the Previous Runs API for a day-1 check of total cloud.
// Truth side: ERA5 reanalysis (Open-Meteo archive, ~25 km, ~5-day lag) for all cloud layers, and
// coastal airport METARs (Iowa Environmental Mesonet) as an independent check of fog / low cloud.
// Raw responses are cached under backtest/cache/ (git-ignored), so reruns cost no API calls.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { SPOTS, REGIONS, REGION_BY_ID } from '../spots.js';
import { sunsetInfo } from '../sun.js';
import { MODELS, PATH_KM, forecast, memberScore, clarityFactor, inSector, label } from '../model.js';
import { OBS_VARS, PATH_VARS, buildInputs, parseLocation, sample, destPoint, distanceKm, detectBrokenModels, addDays } from '../data.js';

const HF = 'https://historical-forecast-api.open-meteo.com/v1/forecast';
const PR = 'https://previous-runs-api.open-meteo.com/v1/forecast';
const ERA = 'https://archive-api.open-meteo.com/v1/archive';
const IEM = 'https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py';
const IEM_NET = 'https://mesonet.agron.iastate.edu/geojson/network/CA_ASOS.geojson';
const ROOT = new URL('../backtest/', import.meta.url);
const CACHE = new URL('cache/', ROOT);

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const DRY = process.argv.includes('--dry');
const NDAYS = +arg('days', 90);
// ERA5 on Open-Meteo lags ~5 days; sunset (local date D) falls on UTC date D+1.
const END = arg('end', addDays(new Date().toISOString().slice(0, 10), -7));
const DATES = Array.from({ length: NDAYS }, (_, i) => addDays(END, i - NDAYS + 1));
const WINDOW = 14; // days per request: Open-Meteo counts > 2 weeks as more than one call

// Coastal airports used as fog truth (inland/bay-side fields such as SFO, SNA, NKX, MYF left out).
const STATIONS = ['CEC', 'EKA', 'O87', 'LLR', 'HAF', 'MRY', 'L52', 'SBA', 'OXR', 'SMO', 'LAX', 'TOA', 'OKB', 'CRQ', 'NZY', 'SAN'];
const ERA_OBS_VARS = ['cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high', 'cloud_cover', 'temperature_2m', 'relative_humidity_2m', 'precipitation'];
const MIDS = MODELS.map((m) => m.id);
const CHUNK = 60;

// ---------- polite, cached fetching ----------
// Rough Open-Meteo call weight: locations × (variables·models / 10) × (days / 14), fractional.
const weightOf = (nLoc, nSeries, nDays) => nLoc * Math.max(1, nSeries / 10) * Math.max(1, nDays / 14);
const LIMIT_MIN = 500, LIMIT_HOUR = 4500; // below the free tier's 600/min and 5000/h
const spent = []; // [ms, weight]
let calls = 0, cached = 0, weightTotal = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function throttle(w) {
  for (;;) {
    const now = Date.now();
    const inWin = (ms) => spent.filter(([t]) => now - t < ms).reduce((s, [, x]) => s + x, 0);
    if (inWin(60e3) + w <= LIMIT_MIN && inWin(3600e3) + w <= LIMIT_HOUR) break;
    await sleep(5000);
  }
  spent.push([Date.now(), w]);
}
async function cachedGet(url, w = 0, { text = false } = {}) {
  const file = new URL(createHash('sha1').update(url).digest('hex') + (text ? '.txt' : '.json'), CACHE);
  try { const s = await readFile(file, 'utf8'); cached++; return text ? s : JSON.parse(s); } catch {}
  if (DRY) { calls++; weightTotal += w; return null; }
  await throttle(w);
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(180e3) });
      const body = await res.text();
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} ${body.slice(0, 200)}`), { status: res.status });
      if (!text) JSON.parse(body); // don't cache a truncated body
      await writeFile(file, body);
      calls++; weightTotal += w;
      return text ? body : JSON.parse(body);
    } catch (e) {
      if (attempt >= 8 || (e.status && e.status < 500 && e.status !== 429)) throw e;
      const wait = e.status === 429 ? 65e3 * (attempt + 1) : 5e3 * 2 ** attempt;
      console.log(`  retry in ${Math.round(wait / 1000)} s (${e.message.slice(0, 80)})`);
      await sleep(wait);
    }
  }
}

/** Fetch an Open-Meteo layer for many points; returns locs in data.js's parsed shape (or nulls). */
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
    if (!json) { out.push(...p.map(() => null)); continue; }
    out.push(...(Array.isArray(json) ? json : [json]).map((l) => parseLocation(l, models, vars)));
  }
  return out;
}
// Present an ERA5 location as if every ensemble model had produced it, so buildInputs() samples it
// with exactly the same code path as the forecasts.
const asAllModels = (loc) => loc && { t: loc.t, s: Object.fromEntries(MIDS.map((id) => [id, loc.s.era5])) };

// ---------- geometry: sunsets and path points per spot per day (same snapping as data.js) ----------
const SUN = DATES.map((d) => SPOTS.map((s) => sunsetInfo(d, s.lat, s.lon, s.elev)));
const pathKey = (s, az, km) => {
  const [la, lo] = destPoint(s.lat, s.lon, az, km);
  const step = km <= 25 ? 0.1 : km <= 75 ? 0.25 : 0.5;
  return `${(Math.round(la / step) * step).toFixed(2)},${(Math.round(lo / step) * step).toFixed(2)}`;
};

// ---------- METAR truth ----------
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
    // Low cloud = the most opaque layer with base ≤ 6500 ft (~2 km, the low-cloud layer top).
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

// ---------- stats ----------
const acc = {};
const push = (key, f, t) => { if (f != null && t != null && Number.isFinite(f) && Number.isFinite(t)) (acc[key] ||= []).push([f, t]); };
function stats(key) {
  const p = acc[key] || [];
  const n = p.length;
  if (!n) return { n: 0 };
  let e = 0, ae = 0, sf = 0, st = 0;
  for (const [f, t] of p) { e += f - t; ae += Math.abs(f - t); sf += f; st += t; }
  const mf = sf / n, mt = st / n;
  let cov = 0, vf = 0, vt = 0;
  for (const [f, t] of p) { cov += (f - mf) * (t - mt); vf += (f - mf) ** 2; vt += (t - mt) ** 2; }
  return { n, bias: e / n, mae: ae / n, r: vf && vt ? cov / Math.sqrt(vf * vt) : null, mf, mt };
}
function contingency(key) {
  const p = acc[key] || [];
  let a = 0, b = 0, c = 0, d = 0; // hit, false alarm, miss, correct negative
  for (const [f, t] of p) { if (f && t) a++; else if (f && !t) b++; else if (!f && t) c++; else d++; }
  const n = a + b + c + d;
  return { n, acc: n ? (a + d) / n : null, pod: a + c ? a / (a + c) : null, far: a + b ? b / (a + b) : null, base: n ? (a + c) / n : null,
    hss: n ? (2 * (a * d - b * c)) / ((a + c) * (c + d) + (a + b) * (b + d) || 1) : null };
}

// ---------- main ----------
await mkdir(CACHE, { recursive: true });
console.log(`backtest ${DATES[0]} … ${DATES.at(-1)} (${DATES.length} evenings, ${SPOTS.length} spots)`);

const net = await cachedGet(IEM_NET, 0);
const stationMeta = STATIONS.map((id) => {
  const f = net?.features.find((x) => x.properties.sid === id);
  if (!f) return null;
  const st = { id, name: f.properties.sname, lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] };
  const near = SPOTS.map((s) => [s, distanceKm(s, st)]).sort((x, y) => x[1] - y[1])[0];
  return { ...st, region: near[0].region, spot: near[0].id };
}).filter(Boolean);
const metars = DRY ? {} : await loadMetars(stationMeta);
// Spots with one of those airports within 10 km get a hybrid truth: METAR low cloud + visibility at
// the spot, ERA5 for everything else (mid/high cloud, the offshore and light-path points).
const spotStation = SPOTS.map((s) => stationMeta.find((st) => distanceKm(s, st) <= 10) || null);

const brokenLog = [];
const rows = []; // per spot-evening summary, written to backtest/results.json
const scoreSpread = []; // for the "ECMWF/GFS vs HRRR/ICON high cloud" comparison

for (let w0 = 0; w0 < DATES.length; w0 += WINDOW) {
  const days = DATES.slice(w0, w0 + WINDOW).map((d, k) => ({ date: d, i: w0 + k }));
  const startUtc = days[0].date, endUtc = addDays(days.at(-1).date, 1);
  // Path points used on any evening of this window.
  const keys = [], keyIdx = {};
  const dayPathIndex = days.map(({ i }) => Object.fromEntries(SPOTS.map((s, j) => [s.id, PATH_KM.slice(1).map((km) => {
    const k = pathKey(s, SUN[i][j].azimuth, km);
    if (keyIdx[k] == null) { keyIdx[k] = keys.length; keys.push(k); }
    return keyIdx[k];
  })])));
  const keyPts = keys.map((k) => k.split(',').map(Number));
  const spotPts = SPOTS.map((s) => [s.lat, s.lon]);
  const stPts = stationMeta.map((s) => [s.lat, s.lon]);
  console.log(`window ${startUtc}…${endUtc}: ${keys.length} path points`);

  const [fObs, fPath, tObs, tPath, fSt, tSt, prev] = await Promise.all([
    omLayer(HF, spotPts, startUtc, endUtc, MIDS, OBS_VARS, { cell_selection: 'nearest' }),
    omLayer(HF, keyPts, startUtc, endUtc, MIDS, PATH_VARS, { cell_selection: 'sea' }),
    omLayer(ERA, spotPts, startUtc, endUtc, ['era5'], ERA_OBS_VARS, { cell_selection: 'nearest' }),
    omLayer(ERA, keyPts, startUtc, endUtc, ['era5'], PATH_VARS, { cell_selection: 'sea' }),
    omLayer(HF, stPts, startUtc, endUtc, MIDS, ['cloud_cover_low', 'visibility'], { cell_selection: 'nearest' }),
    omLayer(ERA, stPts, startUtc, endUtc, ['era5'], ['cloud_cover_low'], { cell_selection: 'nearest' }),
    omLayer(PR, spotPts, startUtc, endUtc, MIDS, ['cloud_cover', 'cloud_cover_previous_day1'], { cell_selection: 'nearest' }),
  ]);
  if (DRY) continue;

  const fcData = { obs: fObs, path: fPath, pathKeys: keys };
  const excluded = detectBrokenModels(fcData);
  if (excluded.length) brokenLog.push({ window: `${startUtc}…${endUtc}`, models: excluded.map((e) => e.name) });
  const truthData = { obs: tObs.map(asAllModels), path: tPath.map(asAllModels), pathKeys: keys };

  for (const [k, { date, i }] of days.entries()) {
    const month = +date.slice(5, 7) - 1;
    fcData.pathIndex = truthData.pathIndex = dayPathIndex[k];
    for (const [j, spot] of SPOTS.entries()) {
      const sun = SUN[i][j], T = sun.sunset, reg = spot.region;
      const region = REGION_BY_ID[reg];
      const fin = buildInputs(fcData, j, spot, T, 0, excluded);
      const tin = buildInputs(truthData, j, spot, T, 0);
      const truthM = { ...tin.members[0], id: 'era5', name: 'ERA5', w: 1 };
      if (truthM.path[0]?.low == null) continue;
      const base = { clarity: clarityFactor(null), horizon: inSector(sun.azimuth, spot.view) ? 1 : 0.88, aboveFog: false };
      const tr = memberScore(truthM, base);
      // Cloud-only variant: drop inputs ERA5 can't supply (visibility, 925 hPa temperature), so the
      // score difference is down to cloud alone.
      const cloudOnly = (m) => ({ ...m, path: [m.path[0] && { ...m.path[0], vis: null, t925: null }, ...m.path.slice(1)] });
      const ctx = (members, pathAvailable) => ({ spot, sun, day: 0, members, aq: null, profile: null, region, month, pathAvailable, excluded });
      const ens = forecast(ctx(fin.members, fin.pathAvailable));
      const ensC = forecast(ctx(fin.members.map(cloudOnly), fin.pathAvailable));
      const tEns = forecast({ ...ctx([truthM], tin.pathAvailable), excluded: [] });
      const row = { date, spot: spot.id, region: reg, truth: { score: Math.round(tr.score), low: tr.low, cv: tr.cv, high: tr.high, farLow: tr.farLow }, ens: ens.score, ensCloud: ensC.score, models: {} };

      for (const g of [reg, 'all']) {
        push(`score|ENS|${g}`, ens.score, tEns.score);
        push(`scoreC|ENS|${g}`, ensC.score, tEns.score);
        push(`label|ENS|${g}`, +(label(ens.score) === label(tEns.score)), 1);
      }
      const ob = spotStation[j] && metarAt(metars[spotStation[j].id], T);
      const hy = ob && memberScore({ ...truthM, path: [{ ...truthM.path[0], low: ob.low, vis: ob.vis }, ...truthM.path.slice(1)] }, base);
      if (hy) {
        row.hybrid = { score: Math.round(hy.score), low: ob.low, station: spotStation[j].id };
        const hEns = forecast({ ...ctx([{ ...truthM, path: [{ ...truthM.path[0], low: ob.low, vis: ob.vis }, ...truthM.path.slice(1)] }], tin.pathAvailable), excluded: [] });
        for (const g of [reg, 'all']) {
          push(`scoreH|ENS|${g}`, ens.score, hEns.score); push(`scoreH|ERA5|${g}`, tr.score, hy.score);
          push(`spFog|ERA5|${g}`, +(tr.low >= 0.5), +(ob.low >= 0.75));
        }
      }
      for (const m of fin.members) {
        const r = memberScore(m, base), rc = memberScore(cloudOnly(m), base);
        if (!r) continue;
        const name = m.name;
        row.models[name] = { score: Math.round(r.score), low: r.low, cv: r.cv, high: r.high, farLow: r.farLow };
        if (hy) for (const g of [reg, 'all']) {
          push(`scoreH|${name}|${g}`, r.score, hy.score);
          if (r.low != null) push(`spFog|${name}|${g}`, +(r.low >= 0.5), +(ob.low >= 0.75));
        }
        for (const g of [reg, 'all']) {
          push(`low|${name}|${g}`, r.low, tr.low);
          push(`cv|${name}|${g}`, r.cv, tr.cv);
          push(`high|${name}|${g}`, r.high, tr.high);
          push(`mid|${name}|${g}`, r.mid, tr.mid);
          push(`farLow|${name}|${g}`, r.farLow, tr.farLow);
          push(`fog|${name}|${g}`, r.low != null ? +(r.low >= 0.5) : null, +(tr.low >= 0.5));
          push(`fogEff|${name}|${g}`, r.effLow != null ? +(r.effLow >= 0.5) : null, +(tr.low >= 0.5));
          push(`score|${name}|${g}`, r.score, tr.score);
          push(`scoreC|${name}|${g}`, rc.score, tr.score);
        }
      }
      // Day-1 vs day-0 total cloud at the spot (Previous Runs API), against ERA5 total cloud.
      const tTot = sample(tObs[j], 'era5', 'cloud_cover', T);
      for (const M of MODELS) {
        push(`tot0|${M.name}|all`, sample(prev[j], M.id, 'cloud_cover', T), tTot);
        push(`tot1|${M.name}|all`, sample(prev[j], M.id, 'cloud_cover_previous_day1', T), tTot);
      }
      const hi = (n) => row.models[n]?.high;
      if (hi('ECMWF') != null && hi('GFS') != null && hi('HRRR') != null && hi('ICON') != null) {
        scoreSpread.push({ eg: (hi('ECMWF') + hi('GFS')) / 2, hi: (hi('HRRR') + hi('ICON')) / 2, t: tr.high });
      }
      rows.push(row);
    }

    // Station fog check: model and ERA5 at the airport's own grid cell vs the METAR at sunset.
    for (const [j, st] of stationMeta.entries()) {
      const T = sunsetInfo(date, st.lat, st.lon, 0).sunset;
      const ob = metarAt(metars[st.id], T);
      if (!ob) continue;
      const fog = +(ob.low >= 0.75); // BKN/OVC/VV below 6500 ft
      const e = sample(tSt[j], 'era5', 'cloud_cover_low', T);
      for (const g of [st.region, 'all']) {
        push(`stLow|ERA5|${g}`, e != null ? e / 100 : null, ob.low);
        push(`stFog|ERA5|${g}`, e != null ? +(e >= 50) : null, fog);
        for (const M of MODELS) {
          const v = sample(fSt[j], M.id, 'cloud_cover_low', T);
          push(`stLow|${M.name}|${g}`, v != null ? v / 100 : null, ob.low);
          push(`stFog|${M.name}|${g}`, v != null ? +(v >= 50) : null, fog);
        }
      }
    }
  }
}

if (DRY) {
  console.log(`dry run: ${calls + cached} requests planned, ${cached} cached, est. weight of uncached ≈ ${Math.round(weightTotal)}`);
  process.exit(0);
}
console.log(`done: ${calls} API calls (est. weight ${Math.round(weightTotal)}), ${cached} from cache, ${rows.length} spot-evenings`);

// ---------- report ----------
const NAMES = MODELS.map((m) => m.name);
const GROUPS = ['all', ...REGIONS.map((r) => r.id)];
const GNAME = { all: '全部 All', ...Object.fromEntries(REGIONS.map((r) => [r.id, `${r.name} ${r.en}`])) };
const p0 = (x) => (x == null ? '–' : `${Math.round(x * 100)}`);
const sg = (x, k = 100) => (x == null ? '–' : `${x * k >= 0 ? '+' : ''}${(x * k).toFixed(k === 100 ? 0 : 1)}`);
const f1 = (x) => (x == null ? '–' : x.toFixed(1));
const f2 = (x) => (x == null ? '–' : x.toFixed(2));
const table = (head, body) => [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...body.map((r) => `| ${r.join(' | ')} |`)].join('\n');

function cloudTable(v) {
  return table(['区域 Region', ...NAMES.map((n) => `${n} 偏差/MAE bias/MAE`), 'ERA5 均值 mean', 'n'],
    GROUPS.map((g) => {
      const s = NAMES.map((n) => stats(`${v}|${n}|${g}`));
      return [GNAME[g], ...s.map((x) => (x.n ? `${sg(x.bias)} / ${p0(x.mae)}` : '–')), p0(s.find((x) => x.n)?.mt), s[0].n || 0];
    }));
}
function fogTable(prefix, names) {
  return table(['模型 Model', '准确率 Accuracy', '命中率 POD', '误报率 FAR', 'HSS', '实况雾/低云频率 Base rate', 'n'],
    names.map((n) => { const c = contingency(`${prefix}|${n}|all`); return [n, p0(c.acc) + '%', p0(c.pod) + '%', p0(c.far) + '%', f2(c.hss), p0(c.base) + '%', c.n]; }));
}
function fogRegionTable(prefix, names) {
  return table(['区域 Region', ...names.map((n) => `${n} 准确率/HSS acc/HSS`), 'n'],
    GROUPS.map((g) => { const c = names.map((n) => contingency(`${prefix}|${n}|${g}`)); return [GNAME[g], ...c.map((x) => (x.n ? `${p0(x.acc)}% / ${f2(x.hss)}` : '–')), c[0].n]; }));
}
function scoreTable(prefix, names = [...NAMES, 'ENS']) {
  return table(['区域 Region', ...names.map((n) => `${n} MAE / r`), 'n'],
    GROUPS.map((g) => { const s = names.map((n) => stats(`${prefix}|${n}|${g}`)); return [GNAME[g], ...s.map((x) => (x.n ? `${f1(x.mae)} / ${f2(x.r)}` : '–')), s.at(-1).n]; }));
}
const hyBias = [...NAMES, 'ENS', 'ERA5'].map((n) => { const s = stats(`scoreH|${n}|all`); return [n, f1(s.bias), f1(s.mf), f1(s.mt), s.n]; });
const biasRows = [...NAMES, 'ENS'].map((n) => { const s = stats(`score|${n}|all`); return [n, f1(s.bias), f1(s.mf), f1(s.mt)]; });
const labelAgree = stats('label|ENS|all');
const hiStat = (() => {
  const n = scoreSpread.length;
  const mean = (f) => scoreSpread.reduce((s, x) => s + f(x), 0) / (n || 1);
  const share = (f) => scoreSpread.filter(f).length / (n || 1);
  return { n, eg: mean((x) => x.eg), hi: mean((x) => x.hi), t: mean((x) => x.t),
    egFalse: share((x) => x.eg >= 0.25 && x.t < 0.1), hiFalse: share((x) => x.hi >= 0.25 && x.t < 0.1),
    egMore: share((x) => x.eg - x.hi >= 0.2), hiMore: share((x) => x.hi - x.eg >= 0.2) };
})();
const tot = table(['模型 Model', '当天 day-0 偏差/MAE', '提前一天 day-1 偏差/MAE', 'n'],
  NAMES.map((n) => { const a = stats(`tot0|${n}|all`), b = stats(`tot1|${n}|all`); return [n, `${sg(a.bias, 1)} / ${f1(a.mae)}`, `${sg(b.bias, 1)} / ${f1(b.mae)}`, b.n]; }));

let findings = '';
try { findings = await readFile(new URL('findings.md', ROOT), 'utf8'); } catch {}

const md = `# 天气输入回测 · Weather-input backtest

> 由 \`scripts/backtest.mjs\` 生成 · generated ${new Date().toISOString().slice(0, 16)}Z · ${DATES[0]} … ${DATES.at(-1)} · ${DATES.length} 个傍晚 evenings × ${SPOTS.length} 个机位 spots = ${rows.length} 样本 samples

本回测只检验**天气输入**（云、雾）准不准，不检验晚霞是否好看。
This backtest checks how good the **weather inputs** (cloud, fog) are — not whether the glow was beautiful.

${findings ? findings.trim() + '\n' : ''}
## 方法 · Method

- **预报 Forecast**：Open-Meteo Historical Forecast API，4 个模型（HRRR、ECMWF IFS 0.25°、GFS、ICON），变量与网站完全相同，用 \`data.js\` 的 \`buildInputs()\` 取日落前后 ±30 分钟的加权值，再用 \`model.js\` 打分。该 API 把**每次运行的最初几个小时**拼接成连续序列，所以提前量只有约 0–6 小时（HRRR 每小时更新，约 0–1 h；全球模式约 0–6 h）。网站实际用的是 6–30 h 提前量，**所以这里的误差是下限**，真实预报只会更差。
  Historical Forecast API stitches the **first hours of each run**, i.e. ~0–6 h lead (HRRR ~0–1 h). The site's real lead is 6–30 h, so these errors are a **lower bound**.
- **提前一天 Day-1**：Previous Runs API 的 \`_previous_day1\` 只提供总云量（不分高中低），所以只能检验总云量随提前量变差多少。
  The Previous Runs API offers day-1 lead only for total cloud cover (no low/mid/high split).
- **实况 Truth**：ERA5 再分析（Open-Meteo archive，约 25 km，滞后约 5 天），同一取样代码。ERA5 分辨率粗，会**抹平沿岸海洋层**（窄条雾带常被算成 0 或被平均），且它本身是 ECMWF 系统产物，评判 ECMWF 时偏宽松。ERA5 没有能见度和 925 hPa 温度。
  ERA5 (~25 km) smooths out the narrow coastal marine layer, is produced with ECMWF's own model (lenient to ECMWF), and has no visibility / 925 hPa temperature.
- **独立雾实况 Independent fog truth**：${stationMeta.length} 个沿海机场 METAR（Iowa Environmental Mesonet）：日落 ±40 分钟内最近一报，6500 ft 以下 BKN/OVC/VV 记为“有雾/低云”。ASOS 云高仪只看到 12 000 ft 以下，所以 METAR 只能验证低云，不能验证高云。机场：${stationMeta.map((s) => s.id).join(', ')}。
  Coastal airport METARs: BKN/OVC/VV below 6500 ft at sunset = fog/low deck. ASOS ceilometers only see below 12 000 ft, so METARs verify low cloud only.
- **打分 Scoring**：两侧都用网站的 \`memberScore()\` / \`forecast()\`；AOD 设为缺失（两侧相同，清晰度为常数），不使用 profile（因此不触发“在雾上方”）。“仅云”变体去掉 ERA5 没有的能见度和 925 hPa 温度，使差异只来自云。
  Both sides use the site's own scoring; AOD missing on both sides, no profile (no above-fog case). The "cloud-only" variant drops visibility and 925 hPa temperature, which ERA5 lacks.
${brokenLog.length ? `- **自动剔除 Auto-excluded**：${brokenLog.map((b) => `${b.window}: ${b.models.join('/')}`).join('; ')}\n` : ''}
## 1. 机位低云 Low cloud at the spot（%，预报 − ERA5 forecast − ERA5）

${cloudTable('low')}

## 2. 机位中高云覆盖 Mid+high coverage (canvas)（%）

${cloudTable('cv')}

### 2b. 仅高云 High cloud only（%）

${cloudTable('high')}

## 3. 光路低云 Light-path low cloud, 75–250 km toward the sun（%）

${cloudTable('farLow')}

## 4. 雾 / 低云判断 Fog vs no fog（low ≥ 50%）

### 4a. 对 ERA5（全部机位）· vs ERA5 at all spots

${fogTable('fog', NAMES)}

按区域 By region:

${fogRegionTable('fog', NAMES)}

### 4b. 对机场 METAR（独立实况）· vs airport METARs (independent)

${fogTable('stFog', [...NAMES, 'ERA5'])}

按区域 By region:

${fogRegionTable('stFog', [...NAMES, 'ERA5'])}

### 4c. 机位所用格点 vs 附近机场 METAR · The spot's own grid cell (as the site samples it) vs the nearby airport

${fogTable('spFog', [...NAMES, 'ERA5'])}

按区域 By region:

${fogRegionTable('spFog', [...NAMES, 'ERA5'])}

低云量 MAE（METAR 量级：FEW 19 / SCT 44 / BKN 75 / OVC 100）· Low-cloud amount vs METAR:

${table(['模型 Model', '偏差 bias', 'MAE', 'r', 'n'], [...NAMES, 'ERA5'].map((n) => { const s = stats(`stLow|${n}|all`); return [n, sg(s.bias), p0(s.mae), f2(s.r), s.n]; }))}

## 5. 网站评分：预报 vs 实况 Site score from forecast vs from truth

完整输入 Full inputs（MAE 分 / 相关系数 r）：

${scoreTable('score')}

仅云 Cloud-only：

${scoreTable('scoreC')}

平均分 Mean score（全部 all）：

${table(['模型 Model', '偏差 bias', '预报均值 forecast mean', 'ERA5 均值 truth mean'], biasRows)}

集合评分与实况落在同一档（火烧云/值得去/不错/一般/平淡）的比例 · Ensemble and truth in the same label band: **${p0(labelAgree.mf)}%**

### 5b. 对混合实况评分 Score vs hybrid truth (METAR low cloud + visibility at the spot, ERA5 elsewhere)

只用 10 km 内有沿海机场的机位（${SPOTS.filter((_, j) => spotStation[j]).map((s) => s.id).join(', ')}）。ERA5 列表示“只用 ERA5 当实况”本身差多少。
Only spots with a coastal airport within 10 km. The ERA5 column shows how far ERA5-alone truth is from this better truth.

${scoreTable('scoreH', [...NAMES, 'ENS', 'ERA5'])}

${table(['模型 Model', '偏差 bias', '预报均值 forecast mean', '混合实况均值 hybrid-truth mean', 'n'], hyBias)}

## 6. ECMWF/GFS 是否比 HRRR/ICON 高估高云？ Do ECMWF/GFS overstate high cloud vs HRRR/ICON?

${table(['', 'ECMWF+GFS', 'HRRR+ICON', 'ERA5'], [
  ['平均高云 mean high cloud', p0(hiStat.eg) + '%', p0(hiStat.hi) + '%', p0(hiStat.t) + '%'],
  ['模式 ≥25% 而 ERA5 <10% 的比例 · model ≥25% while ERA5 <10%', p0(hiStat.egFalse) + '%', p0(hiStat.hiFalse) + '%', ''],
  ['比另一组多 ≥20 个百分点 · ≥20 pts more than the other pair', p0(hiStat.egMore) + '%', p0(hiStat.hiMore) + '%', ''],
])}

n = ${hiStat.n}。注意 ERA5 与 ECMWF 同源，若 ECMWF 有系统性高云偏多，ERA5 可能也偏多。
Caveat: ERA5 shares ECMWF's physics, so an ECMWF high-cloud excess may partly be in ERA5 too.

## 7. 提前量 Lead time: total cloud, day-0 vs day-1（%）

${tot}
`;
await writeFile(new URL('REPORT.md', ROOT), md);
await writeFile(new URL('results.json', ROOT), JSON.stringify({ dates: [DATES[0], DATES.at(-1)], stations: stationMeta, brokenLog, rows }));
console.log('wrote backtest/REPORT.md and backtest/results.json');
