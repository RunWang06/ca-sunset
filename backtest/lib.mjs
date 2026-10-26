// Shared helpers for the backtest experiments (eval_*.mjs): polite cached Open-Meteo fetching with
// the same cache keys as scripts/backtest.mjs, airport METARs, and the backtest's date range.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { MODELS } from '../model.js';
import { parseLocation, destPoint, addDays } from '../data.js';

export const HF = 'https://historical-forecast-api.open-meteo.com/v1/forecast';
export const ERA = 'https://archive-api.open-meteo.com/v1/archive';
const IEM = 'https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py';
export const IEM_NET = 'https://mesonet.agron.iastate.edu/geojson/network/CA_ASOS.geojson';
const CACHE = new URL('cache/', import.meta.url);
await mkdir(CACHE, { recursive: true });

export const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
/** Evenings of the main backtest (default 2026-07-10 … 2026-10-07, so everything comes from the cache). */
export function backtestDates() {
  const n = +arg('days', 90), end = arg('end', '2026-10-07');
  return Array.from({ length: n }, (_, i) => addDays(end, i - n + 1));
}
export const WINDOW = 14, CHUNK = 60;
export const STATIONS = ['CEC', 'EKA', 'O87', 'LLR', 'HAF', 'MRY', 'L52', 'SBA', 'OXR', 'SMO', 'LAX', 'TOA', 'OKB', 'CRQ', 'NZY', 'SAN'];
export const ERA_OBS_VARS = ['cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high', 'cloud_cover', 'temperature_2m', 'relative_humidity_2m', 'precipitation'];
export const MIDS = MODELS.map((m) => m.id);

// Rough Open-Meteo call weight: locations × (variables·models / 10) × (days / 14).
const weightOf = (nLoc, nSeries, nDays) => nLoc * Math.max(1, nSeries / 10) * Math.max(1, nDays / 14);
const spent = [];
export const counts = { calls: 0, cached: 0 };
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
export async function cachedGet(url, w = 0, { text = false } = {}) {
  const file = new URL(createHash('sha1').update(url).digest('hex') + (text ? '.txt' : '.json'), CACHE);
  try { const s = await readFile(file, 'utf8'); counts.cached++; return text ? s : JSON.parse(s); } catch {}
  await throttle(w);
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(180e3) });
      const body = await res.text();
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} ${body.slice(0, 200)}`), { status: res.status });
      if (!text) JSON.parse(body);
      await writeFile(file, body);
      counts.calls++;
      return text ? body : JSON.parse(body);
    } catch (e) {
      if (attempt >= 8 || (e.status && e.status < 500 && e.status !== 429)) throw e;
      const wait = e.status === 429 ? 65e3 * (attempt + 1) : 5e3 * 2 ** attempt;
      console.log(`  retry in ${Math.round(wait / 1000)} s (${e.message.slice(0, 80)})`);
      await sleep(wait);
    }
  }
}
/** An Open-Meteo layer for many points, in data.js's parsed shape. */
export async function omLayer(base, pts, startUtc, endUtc, models, vars, extra = {}) {
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
/** Present an ERA5 location as if every ensemble model had produced it. */
export const asAllModels = (loc) => loc && { t: loc.t, s: Object.fromEntries(MIDS.map((id) => [id, loc.s.era5])) };
/** Same grid snapping as data.js / scripts/backtest.mjs. */
export const pathKey = (s, az, km) => {
  const [la, lo] = destPoint(s.lat, s.lon, az, km);
  const step = km <= 25 ? 0.1 : km <= 75 ? 0.25 : 0.5;
  return `${(Math.round(la / step) * step).toFixed(2)},${(Math.round(lo / step) * step).toFixed(2)}`;
};

// ---------- METAR (identical query to scripts/backtest.mjs, so it comes from the cache) ----------
const COVER = { CLR: 0, SKC: 0, NSC: 0, FEW: 0.19, SCT: 0.44, BKN: 0.75, OVC: 1, VV: 1 };
export async function stationMeta() {
  const net = await cachedGet(IEM_NET, 0);
  return STATIONS.map((id) => {
    const f = net?.features.find((x) => x.properties.sid === id);
    return f && { id, lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] };
  }).filter(Boolean);
}
export async function loadMetars(meta, dates) {
  const q = new URLSearchParams({ data: 'vsby', tz: 'Etc/UTC', format: 'onlycomma', latlon: 'no', missing: 'null', trace: 'null', report_type: '3' });
  for (const k of ['skyc1', 'skyl1', 'skyc2', 'skyl2', 'skyc3', 'skyl3']) q.append('data', k);
  for (const s of meta) q.append('station', s.id);
  const a = dates[0], b = addDays(dates.at(-1), 2);
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
export const metarAt = (list, T) => {
  let best = null;
  for (const o of list || []) if (Math.abs(o.t - T) <= 40 * 60e3 && (!best || Math.abs(o.t - T) < Math.abs(best.t - T))) best = o;
  return best;
};

// ---------- stats ----------
export function contingency(pairs) {
  let a = 0, b = 0, c = 0, d = 0;
  for (const [f, t] of pairs) { if (f && t) a++; else if (f && !t) b++; else if (!f && t) c++; else d++; }
  const n = a + b + c + d;
  return { n, hits: a, falseAlarms: b, misses: c, pod: a + c ? a / (a + c) : null, far: a + b ? b / (a + b) : null, base: n ? (a + c) / n : null, rate: n ? (a + b) / n : null,
    hss: n ? (2 * (a * d - b * c)) / ((a + c) * (c + d) + (a + b) * (b + d) || 1) : null };
}
