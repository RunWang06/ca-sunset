// Data layer: Open-Meteo weather (5 models) + CAMS air quality, fetched directly from the browser.
import { MODELS, PATH_KM } from './model.js';

const WX = 'https://api.open-meteo.com/v1/forecast';
const AQ = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const TZ = 'America/Los_Angeles';
const CACHE_PREFIX = 'ca-sunset-v1:';
const CACHE_TTL = 30 * 60 * 1000;
const CHUNK = 60;

const OBS_VARS = ['cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high', 'visibility', 'temperature_2m', 'relative_humidity_2m', 'temperature_925hPa', 'precipitation'];
const PATH_VARS = ['cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high'];
const PROFILE_VARS = ['cloud_cover_low', 'cloud_cover_1000hPa', 'cloud_cover_975hPa', 'cloud_cover_950hPa', 'cloud_cover_925hPa', 'cloud_cover_900hPa', 'boundary_layer_height'];
const PROFILE_MODELS = ['ncep_hrrr_conus', 'gfs_global'];
const AQ_VARS = ['aerosol_optical_depth', 'pm2_5', 'dust'];

// ---------- geo & time helpers ----------
const R = 6371, rad = Math.PI / 180;
export function destPoint(lat, lon, brg, km) {
  const d = km / R, b = brg * rad, p1 = lat * rad, l1 = lon * rad;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
  const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return [p2 / rad, l2 / rad];
}
export function distanceKm(a, b) {
  const dp = (b.lat - a.lat) * rad, dl = (b.lon - a.lon) * rad;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const fmtDate = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const fmtHour = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hourCycle: 'h23' });
export const laDate = (ms) => fmtDate.format(new Date(ms));
export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// ---------- fetching ----------
async function getJSON(url, timeout = 20000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) {
      let reason = `HTTP ${res.status}`;
      try { reason = (await res.json()).reason || reason; } catch {}
      throw new Error(reason);
    }
    return await res.json();
  } finally { clearTimeout(t); }
}

// Keep only late-afternoon/evening hours: that is all the model needs, and it keeps the cache small.
const keepHour = (sec) => { const h = +fmtHour.format(new Date(sec * 1000)); return h >= 14 && h <= 22; };

function parseLocation(loc, models, vars) {
  const h = loc.hourly || {};
  const idx = (h.time || []).map((t, i) => (keepHour(t) ? i : -1)).filter((i) => i >= 0);
  const out = { t: idx.map((i) => h.time[i]), s: {} };
  for (const m of models) {
    out.s[m] = {};
    for (const v of vars) {
      const arr = h[`${v}_${m}`] ?? (models.length === 1 ? h[v] : undefined);
      out.s[m][v] = arr ? idx.map((i) => arr[i]) : null;
    }
  }
  return out;
}

async function fetchPoints(base, points, params, models, vars) {
  const chunks = [];
  for (let i = 0; i < points.length; i += CHUNK) chunks.push(points.slice(i, i + CHUNK));
  const results = await Promise.all(chunks.map(async (pts) => {
    const q = new URLSearchParams({
      latitude: pts.map((p) => p[0].toFixed(3)).join(','),
      longitude: pts.map((p) => p[1].toFixed(3)).join(','),
      hourly: vars.join(','), timeformat: 'unixtime', timezone: 'GMT', ...params,
    });
    if (models) q.set('models', models.join(','));
    const json = await getJSON(`${base}?${q}`);
    const arr = Array.isArray(json) ? json : [json];
    return arr.map((loc) => parseLocation(loc, models || ['cams'], vars));
  }));
  return results.flat();
}

function cacheGet(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return Date.now() - v.at < CACHE_TTL ? v : null;
  } catch { return null; }
}
function cacheSet(key, data) {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX) && k !== CACHE_PREFIX + key) localStorage.removeItem(k);
    }
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), data }));
  } catch {}
}

/**
 * Fetch everything for all spots. azimuths[spotId] = today's sunset azimuth (path direction).
 * Returns { at, fromCache, errors[], obs[], path[], profile[], aq[], pathKeys, pathIndex }.
 */
export async function loadData(spots, azimuths, startDate, { force = false } = {}) {
  const endDate = addDays(startDate, 2); // GMT dates: tomorrow's sunset falls on the next UTC day
  const cacheKey = `${startDate}`;
  if (!force) { const c = cacheGet(cacheKey); if (c) return { ...c.data, at: c.at, fromCache: true }; }

  const obsPts = spots.map((s) => [s.lat, s.lon]);
  // Points along each spot's sunset azimuth. Far points are snapped to a 0.25° grid (the global
  // models' resolution) so neighbouring spots share them and the request stays small.
  const pathIndex = {}, pathKeys = [], pathPts = [];
  for (const s of spots) {
    pathIndex[s.id] = PATH_KM.slice(1).map((km) => {
      const [la, lo] = destPoint(s.lat, s.lon, azimuths[s.id], km);
      const step = km <= 25 ? 0.1 : 0.25;
      const key = `${(Math.round(la / step) * step).toFixed(2)},${(Math.round(lo / step) * step).toFixed(2)}`;
      let i = pathKeys.indexOf(key);
      if (i < 0) { i = pathKeys.length; pathKeys.push(key); pathPts.push(key.split(',').map(Number)); }
      return i;
    });
  }
  const modelIds = MODELS.map((m) => m.id);
  const dates = { start_date: startDate, end_date: endDate };
  const errors = [];
  const safe = (label, p) => p.catch((e) => { errors.push(`${label}：${e.message}`); return null; });

  const [obs, path, profile, aq] = await Promise.all([
    safe('观景点天气', fetchPoints(WX, obsPts, { ...dates, cell_selection: 'nearest' }, modelIds, OBS_VARS)),
    safe('日落方向远海云量', fetchPoints(WX, pathPts, { ...dates, cell_selection: 'sea' }, modelIds, PATH_VARS)),
    safe('海洋层垂直结构', fetchPoints(WX, obsPts, { ...dates, cell_selection: 'nearest' }, PROFILE_MODELS, PROFILE_VARS)),
    safe('空气质量', fetchPoints(AQ, obsPts, { ...dates, domains: 'cams_global' }, null, AQ_VARS)),
  ]);
  if (!obs && !path) throw new Error(errors.join('；') || '无法获取气象数据');
  const data = { errors, obs, path, profile, aq, pathKeys, pathIndex, azimuths };
  if (!errors.length) cacheSet(cacheKey, data);
  return { ...data, at: Date.now(), fromCache: false };
}

// ---------- sampling ----------
function interp(arr, t, T) {
  if (!arr || !t.length) return null;
  if (T < t[0] || T > t[t.length - 1]) return null;
  for (let i = 0; i < t.length - 1; i++) {
    if (T >= t[i] && T <= t[i + 1]) {
      const a = arr[i], b = arr[i + 1];
      if (a == null && b == null) return null;
      if (a == null) return b;
      if (b == null) return a;
      return a + ((b - a) * (T - t[i])) / (t[i + 1] - t[i] || 1);
    }
  }
  return t[t.length - 1] === T ? arr[t.length - 1] : null;
}
// Smooth over the sunset hour: 30 min before, at, and 30 min after.
function sample(loc, model, v, Tms) {
  if (!loc) return null;
  const arr = loc.s[model]?.[v];
  const T = Tms / 1000;
  const pts = [[T - 1800, 0.25], [T, 0.5], [T + 1800, 0.25]];
  let s = 0, w = 0;
  for (const [tt, wt] of pts) { const x = interp(arr, loc.t, tt); if (x != null) { s += x * wt; w += wt; } }
  return w ? s / w : null;
}
const frac = (x) => (x == null ? null : Math.max(0, Math.min(1, x / 100)));

/** Assemble the model-input context for one spot, one day, given the loaded dataset. */
export function buildInputs(data, spotIdx, spot, sunsetMs, day) {
  const obsLoc = data.obs?.[spotIdx];
  const pathLocs = (data.pathIndex[spot.id] || []).map((i) => data.path?.[i]);
  const members = MODELS.map((M) => {
    const obs = obsLoc && {
      low: frac(sample(obsLoc, M.id, 'cloud_cover_low', sunsetMs)),
      mid: frac(sample(obsLoc, M.id, 'cloud_cover_mid', sunsetMs)),
      high: frac(sample(obsLoc, M.id, 'cloud_cover_high', sunsetMs)),
      vis: sample(obsLoc, M.id, 'visibility', sunsetMs),
      t2: sample(obsLoc, M.id, 'temperature_2m', sunsetMs),
      t925: sample(obsLoc, M.id, 'temperature_925hPa', sunsetMs),
      rh: sample(obsLoc, M.id, 'relative_humidity_2m', sunsetMs),
      precip: sample(obsLoc, M.id, 'precipitation', sunsetMs),
    };
    const path = pathLocs.map((loc) => {
      const c = { low: frac(sample(loc, M.id, 'cloud_cover_low', sunsetMs)), mid: frac(sample(loc, M.id, 'cloud_cover_mid', sunsetMs)), high: frac(sample(loc, M.id, 'cloud_cover_high', sunsetMs)) };
      return c.low == null && c.mid == null && c.high == null ? null : c;
    });
    return { id: M.id, name: M.name, w: M.w[day], path: [obs, ...path] };
  });

  let profile = null;
  const pl = data.profile?.[spotIdx];
  for (const m of PROFILE_MODELS) {
    const low = frac(sample(pl, m, 'cloud_cover_low', sunsetMs));
    if (low == null) continue;
    profile = {
      low,
      cc1000: frac(sample(pl, m, 'cloud_cover_1000hPa', sunsetMs)),
      cc975: frac(sample(pl, m, 'cloud_cover_975hPa', sunsetMs)),
      cc950: frac(sample(pl, m, 'cloud_cover_950hPa', sunsetMs)),
      cc925: frac(sample(pl, m, 'cloud_cover_925hPa', sunsetMs)),
      cc900: frac(sample(pl, m, 'cloud_cover_900hPa', sunsetMs)),
      blh: sample(pl, m, 'boundary_layer_height', sunsetMs),
      model: m,
    };
    break;
  }
  const aqLoc = data.aq?.[spotIdx];
  const aq = aqLoc ? { aod: sample(aqLoc, 'cams', 'aerosol_optical_depth', sunsetMs), pm25: sample(aqLoc, 'cams', 'pm2_5', sunsetMs), dust: sample(aqLoc, 'cams', 'dust', sunsetMs) } : null;
  const pathAvailable = members.some((m) => m.path.slice(2).some(Boolean));
  return { members, profile, aq, pathAvailable, pathPoints: (data.pathIndex[spot.id] || []).map((i) => data.pathKeys[i].split(',').map(Number)) };
}
