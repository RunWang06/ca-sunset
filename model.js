// Sunset-glow model. Pure functions only (no DOM, no network) so it can be unit-tested in Node.
//
// Physical idea: a vivid afterglow needs (1) mid/high cloud to act as a canvas near the observer
// and toward the sun, (2) a clear light path far out along the sunset azimuth so the sun can light
// those clouds from below, (3) no fog / low cloud in the observer's own line of sight, and
// (4) reasonably clean air. Each member model is scored separately; the spread between models is
// what turns the viewing score into a probability.

export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const sigm = (x) => 1 / (1 + Math.exp(-x));
const pct = (x) => Math.round(x * 100);

// Distances (km) sampled along the sunset azimuth. Index 0 is the observer.
// 300 and 350 km added 2026-10-21 for the high-cloud light path (see LIGHT below).
export const PATH_KM = [0, 25, 75, 150, 250, 300, 350];

/**
 * Light-path geometry (the cloud-base method of sunsetbot.top). During the afterglow the sun's ray
 * to a canvas cloud at height h grazes the haze / marine-layer top hb at a point that sweeps from the
 * canvas out to x0 + √(2R(h − hb)) toward the sun — ≈ 240 km for mid cloud (4.5 km), ≈ 350 km for high
 * cloud (9 km) — so low cloud anywhere along that stretch can cut the light. Each sampled distance
 * stands for a stretch of ocean; its weight is how much of the lit stretch it covers, blended by the
 * canvas's high-cloud share. Replaced fixed 75/150/250 km weights of .3/.4/.3. Backtest
 * (backtest/LIGHT_PATH.md, Jul–Oct 2026): light-factor MAE and r, score MAE and score MAE vs METAR
 * hybrid truth all improved in both halves of the period (score MAE 10.13 → 9.68); gains are small.
 */
export const LIGHT = { R: 6371, hb: 1, x0: 30, mid: 4.5, high: 9, bins: { 75: [50, 112], 150: [112, 200], 250: [200, 275], 300: [275, 325], 350: [325, 375] } };
function lightWeightsFor(h) {
  const end = LIGHT.x0 + Math.sqrt(2 * LIGHT.R * (h - LIGHT.hb));
  const w = PATH_KM.map((km) => {
    const bin = LIGHT.bins[km];
    return bin ? Math.max(0, Math.min(bin[1], end) - Math.max(bin[0], LIGHT.x0)) : 0;
  });
  const t = w.reduce((a, x) => a + x, 0);
  return w.map((x) => x / t);
}
const LIGHT_W = { mid: lightWeightsFor(LIGHT.mid), high: lightWeightsFor(LIGHT.high) };
/** Weight of each PATH_KM point in the light path, given the canvas's high-cloud share (0–1). */
export const lightWeights = (hs) => LIGHT_W.mid.map((m, i) => (1 - hs) * m + hs * LIGHT_W.high[i]);

// Member weights by day index [today, tomorrow]. HRRR (3 km) resolves the marine layer far better
// than the global models but degrades past ~24 h, so its weight drops tomorrow.
// GEM was dropped: Open-Meteo's GEM mid/high cloud layers come back as 0 everywhere (checked
// 2026-10-13 across all spots and hours while total cover was non-zero), which pinned it at the
// clear-sky score and inflated the spread. detectBrokenModels() in data.js guards against a repeat.
export const MODELS = [
  { id: 'ncep_hrrr_conus', name: 'HRRR', w: [0.35, 0.22] },
  { id: 'ecmwf_ifs025', name: 'ECMWF', w: [0.27, 0.32] },
  { id: 'gfs_global', name: 'GFS', w: [0.19, 0.23] },
  { id: 'icon_seamless', name: 'ICON', w: [0.19, 0.23] },
];

export const NOTABLE = 55; // "notable glow" threshold used for the probability

// Text is returned as i18n keys (+ vars) so the model stays language-independent; see i18n.js.
export function label(score) {
  if (score == null) return 'label.na';
  if (score >= 80) return 'label.fire';
  if (score >= 65) return 'label.worth';
  if (score >= 45) return 'label.good';
  if (score >= 25) return 'label.fair';
  return 'label.flat';
}

/** Canvas quality from combined mid/high coverage (0–1). Clear sky still gives a golden sunset. */
export function canvasQuality(cv) {
  if (cv < 0.45) return 0.22 + 0.78 * Math.sin((Math.PI / 2) * (cv / 0.45));
  if (cv <= 0.72) return 1;
  return 1 - 0.45 * ((cv - 0.72) / 0.28);
}

/**
 * Marine-layer heuristic from a strong inversion over a humid surface. Global models often
 * report 0 % low cloud under a 10 °C inversion with saturated air — this catches that case.
 */
export function marineHeuristic(t2, t925, rh) {
  if (t2 == null || t925 == null || rh == null) return null;
  return sigm((t925 - t2 - 3) / 1.5) * sigm((rh - 82) / 5);
}

export function clarityFactor(aod) {
  if (aod == null) return 0.88;
  if (aod <= 0.15) return 1;
  if (aod <= 0.35) return 1 - (aod - 0.15);
  return clamp(0.8 - (aod - 0.35), 0.3, 1);
}

export function inSector(az, [from, to]) {
  const a = ((az % 360) + 360) % 360;
  return from <= to ? a >= from && a <= to : a >= from || a <= to;
}

const coverage = (c) => 1 - (1 - (c.high ?? 0)) * (1 - (c.mid ?? 0));
function wavg(items) {
  let s = 0, w = 0;
  for (const [v, wt] of items) if (v != null && Number.isFinite(v)) { s += v * wt; w += wt; }
  return w ? s / w : null;
}

/**
 * Score one model member.
 * m.path[i] = { low, mid, high } fractions at PATH_KM[i]; m.path[0] also has vis (m), t2, t925, rh, precip.
 */
export function memberScore(m, ctx) {
  const obs = m.path[0];
  if (!obs || (obs.low == null && obs.mid == null && obs.high == null)) return null;
  const near = m.path[1], p75 = m.path[2];

  const heur = marineHeuristic(obs.t2, obs.t925, obs.rh);
  const effLow = Math.max(obs.low ?? 0, heur != null ? 0.8 * heur : 0);

  // 1) Canvas: mid/high clouds over the observer and the western sky.
  const canvasPts = [[obs, 0.35], [near, 0.4], [p75, 0.25]].filter(([c]) => c && c.mid != null);
  const cv = wavg(canvasPts.map(([c, w]) => [coverage(c), w]));
  const high = wavg(canvasPts.map(([c, w]) => [c.high, w]));
  const mid = wavg(canvasPts.map(([c, w]) => [c.mid, w]));
  let canvasQ = canvasQuality(cv ?? 0);
  if (ctx.aboveFog) canvasQ = Math.max(canvasQ, 0.45); // a lit sea of fog is a show by itself

  // 2) Light path: low (and thick mid) cloud 75–350 km toward the sun blocks the light; how far out
  // matters depends on how high the canvas is (LIGHT above).
  const hs = high != null && mid != null && high + mid > 0.02 ? high / (high + mid) : 0.5;
  const lw = lightWeights(hs);
  const far = m.path.map((c, i) => [c, lw[i]]).filter(([c, w]) => w > 0 && c && c.low != null);
  const block = far.length ? wavg(far.map(([c, w]) => [clamp(c.low * 0.8 + (c.mid ?? 0) * 0.3), w])) : null;
  const farLow = far.length ? wavg(far.map(([c, w]) => [c.low, w])) : null;
  const light = block == null ? 0.85 : clamp(1 - 1.15 * block, 0.05, 1);

  // 3) Local obstruction: fog / low cloud at the spot and just offshore.
  const nearLow = near?.low ?? effLow;
  let local;
  if (ctx.aboveFog) local = 0.97;
  else {
    // A clear gap just offshore lets light in under a local deck, so the near point still counts a little.
    const b = clamp(0.8 * effLow + 0.2 * nearLow);
    local = 1 - 0.92 * Math.pow(b, 1.6);
    if (obs.vis != null) local *= obs.vis < 1000 ? 0.1 : obs.vis < 10000 ? 0.1 + 0.9 * ((obs.vis - 1000) / 9000) : 1;
  }
  if ((obs.precip ?? 0) > 0.3) local *= 0.6;

  const score = 100 * canvasQ * light * local * ctx.clarity * ctx.horizon;
  return { score: clamp(score, 0, 100), cv, high, mid, canvasQ, light, block, farLow, local, effLow, heur, nearLow, vis: obs.vis, precip: obs.precip, low: obs.low };
}

/** Estimate the marine-layer top (m) from pressure-level cloud cover (fractions) or PBL height. */
export function marineLayerTop(profile) {
  if (!profile) return null;
  const levels = [[profile.cc1000, 110], [profile.cc975, 320], [profile.cc950, 540], [profile.cc925, 760], [profile.cc900, 990]];
  let top = null, started = false;
  for (const [cc, h] of levels) {
    if (cc != null && cc >= 0.4) { top = h + 120; started = true; } else if (started) break;
  }
  if (top == null && profile.blh != null) top = clamp(profile.blh, 150, 900);
  return top == null ? null : Math.round(top / 10) * 10;
}

/**
 * Full forecast for one spot and one evening.
 * ctx: { spot, sun:{sunset,dusk,azimuth}, day, members:[{id,name,w,path}], aq:{aod,pm25,dust}|null,
 *        profile, region:{fog,base}, month, pathAvailable, excluded:[{id,name}] }
 */
export function forecast(ctx) {
  const { spot, sun, day, aq, region, month } = ctx;
  const ocean = inSector(sun.azimuth, spot.view);
  const aod = aq?.aod ?? null;
  const base = { clarity: clarityFactor(aod), horizon: ocean ? 1 : 0.88, aboveFog: false };
  const warnings = [];

  let scored = ctx.members.map((m) => ({ ...m, r: memberScore(m, base) })).filter((m) => m.r);
  if (!scored.length) {
    return { insufficient: true, score: null, prob: null, label: label(null), ocean, warnings: [{ id: 'warn.noData' }], reasons: [], members: [], timing: timing(sun, null, spot), headline: 'hl.na' };
  }

  // Fog: is there a marine layer, and is this spot above it?
  // Require real low cloud at the spot's cell or just offshore (an elevated spot's own cell may be
  // clear precisely because it sits above the deck). Only spots ≥ 100 m can be "above the fog".
  const hrrrM = scored.find((m) => m.id === 'ncep_hrrr_conus');
  const offshoreLow = Math.max(hrrrM?.path[1]?.low ?? 0, wavg(scored.map((m) => [m.path[1]?.low, m.w])) ?? 0);
  const fogPresent = Math.max(ctx.profile?.low ?? 0, offshoreLow) >= 0.4;
  const mlTop = fogPresent ? marineLayerTop(ctx.profile) : null;
  const aboveFog = spot.elev >= 100 && fogPresent && mlTop != null && spot.elev > mlTop + 50;
  if (aboveFog) scored = scored.map((m) => ({ ...m, r: memberScore(m, { ...base, aboveFog: true }) })).filter((m) => m.r);

  const W = scored.reduce((s, m) => s + m.w, 0);
  const avg = (f) => wavg(scored.map((m) => [f(m.r), m.w]));
  const score = avg((r) => r.score);
  const spread = Math.sqrt(scored.reduce((s, m) => s + m.w * (m.r.score - score) ** 2, 0) / W);
  const probRaw = scored.reduce((s, m) => s + m.w * sigm((m.r.score - NOTABLE) / 7), 0) / W;
  const n = scored.length;
  const reliability = n >= 4 ? (day === 0 ? 0.85 : 0.72) : n >= 2 ? 0.6 : 0.45;
  const prior = region.base[month];
  const prob = clamp(reliability * probRaw + (1 - reliability) * prior, 0.02, 0.95);

  const f = {
    cv: avg((r) => r.cv), high: avg((r) => r.high), mid: avg((r) => r.mid),
    canvasQ: avg((r) => r.canvasQ), light: avg((r) => r.light), farLow: avg((r) => r.farLow),
    local: avg((r) => r.local), effLow: avg((r) => r.effLow), clarity: base.clarity,
    vis: avg((r) => r.vis), heur: avg((r) => r.heur), precip: avg((r) => r.precip),
  };
  const hrrr = scored.find((m) => m.id === 'ncep_hrrr_conus');
  const globals = scored.filter((m) => m.id !== 'ncep_hrrr_conus');
  const globalLow = globals.length ? wavg(globals.map((m) => [m.r.low, m.w])) : null;
  // HRRR gets extra say on fog specifically: it is the only member that resolves the marine layer.
  // Regions can lower it where HRRR is verified to over-forecast fog (spots.js hrrrFogWeight).
  const wH = hrrr ? (day === 0 ? (region.hrrrFogWeight ?? 0.5) : 0.3) : 0;
  const fogModel = wH * (hrrr?.r.effLow ?? 0) + (0.85 - wH) * (f.effLow ?? 0);
  const fogRisk = aboveFog ? null : clamp(fogModel + 0.15 * region.fog[month]);

  const aodMissing = aod == null;
  if (aodMissing) warnings.push({ id: 'warn.aod' });
  if (!ctx.pathAvailable) warnings.push({ id: 'warn.path' });
  if (n < 3) warnings.push({ id: 'warn.few', vars: { n } });
  if (!hrrr) warnings.push({ id: 'warn.noHrrr' });
  if (f.vis == null) warnings.push({ id: 'warn.noVis' });
  if (ctx.excluded?.length) warnings.push({ id: 'warn.excluded', vars: { names: ctx.excluded.map((e) => e.name).join(' / ') } });

  let conf = 1 - spread / 28 - (n < 3 ? 0.25 : 0) - day * 0.12 - (aodMissing ? 0.05 : 0) - (ctx.pathAvailable ? 0 : 0.1) - (hrrr ? 0 : 0.1);
  if (!aboveFog && fogRisk >= 0.3 && fogRisk <= 0.7) conf -= 0.1; // marginal fog is the hardest call on this coast
  const confidence = { level: conf >= 0.6 ? 'high' : conf >= 0.35 ? 'mid' : 'low', spread: Math.round(spread), value: conf };

  const out = {
    insufficient: false, score: Math.round(score), label: label(score), prob, probRaw, confidence, ocean, aboveFog, mlTop,
    fogRisk, hrrrLow: hrrr?.r.low ?? null, globalLow, aod, pm25: aq?.pm25 ?? null, factors: f, warnings,
    members: MODELS.map((M) => {
      const s = scored.find((m) => m.id === M.id);
      return { id: M.id, name: M.name, score: s ? Math.round(s.r.score) : null, excluded: !!ctx.excluded?.some((e) => e.id === M.id) };
    }),
  };
  out.greenFlash = ocean && f.light > 0.9 && (f.farLow ?? 1) < 0.1 && (aod ?? 1) < 0.12 && (f.cv ?? 1) < 0.4 && (fogRisk ?? 0) < 0.2;
  out.timing = timing(sun, f, spot);
  out.split = splitGroups(scored);
  out.reasons = reasons(out, sun, spot);
  out.headline = headline(out);
  out.headlineVars = out.split ? { names: (out.split.hi.w >= out.split.lo.w ? out.split.lo : out.split.hi).names } : undefined;
  return out;
}

/**
 * Afterglow geometry (the cloud-base method sunsetbot.top uses): after sunset a cloud at height h
 * stays lit until the sun is δ = √(2(h − hb)/R) below the horizon, where hb is the haze / marine-layer
 * top the grazing ray must clear; a cloud x km toward the sun gains another x/R. Open-Meteo gives
 * cover by layer, not cloud base, so typical heights are used: mid 4.5 km, high 9 km, with x = 50 km
 * for the western sky the viewer watches. Returns minutes after sea-level sunset.
 * Timing only — it does not touch the score. Not verified against observed glow times (none exist).
 */
export const GLOW = { R: 6371, hb: 1, x: 50, mid: 4.5, high: 9 };
export function glowMinutes(h, descent) {
  if (!(descent > 0)) return null;
  const deg = (Math.sqrt((2 * (h - GLOW.hb)) / GLOW.R) + GLOW.x / GLOW.R) * (180 / Math.PI);
  return deg / descent;
}

/** Which layer makes up the canvas: 'high' / 'mid' when it holds ≥ 60 % of it, else 'mix'. */
export function canvasKind(high, mid) {
  if (high == null || mid == null || high + mid < 1e-6) return 'mix';
  const share = high / (high + mid);
  return share >= 0.6 ? 'high' : share <= 0.4 ? 'mid' : 'mix';
}

export function timing(sun, f, spot) {
  const min = 60000, s = sun.sunset;
  const s0 = sun.seaLevelSunset ?? s;
  let peak, peakKey, peakVars;
  const kind = canvasKind(f?.high, f?.mid);
  const lHigh = glowMinutes(GLOW.high, sun.descent), lMid = glowMinutes(GLOW.mid, sun.descent);
  const after = (t) => Math.max(1, Math.round((t - s) / min));
  if (!f || (f.cv ?? 0) < 0.15) { peak = [s - 15 * min, s + 5 * min]; peakKey = 'peak.clear'; }
  else if (kind === 'high') {
    // The deepest red comes late, as the grazing ray lengthens: the last ~60 % of the lit time.
    peak = lHigh ? [s0 + 0.4 * lHigh * min, s0 + lHigh * min] : [s + 3 * min, s + 25 * min];
    peakKey = 'peak.high';
    peakVars = { a: after(peak[0]), b: after(peak[1]) };
  } else if (kind === 'mix') {
    // Both layers: the mid cloud colours first, the high cloud stays lit longest.
    peak = [s - 5 * min, lHigh ? s0 + lHigh * min : s + 20 * min];
    peakKey = 'peak.mix';
    peakVars = { b: after(peak[1]) };
  } else {
    peak = [s - 5 * min, lMid ? s0 + lMid * min : s + 15 * min];
    peakKey = 'peak.mid';
    peakVars = { b: after(peak[1]) };
  }
  const lead = spot.hike ? 45 : 25;
  return { arrive: s - lead * min, sunset: s, peakStart: peak[0], peakEnd: peak[1], dusk: sun.dusk, peakKey, peakVars, lead };
}

function reasons(o, sun, spot) {
  const f = o.factors, r = [];
  const add = (tone, k, id, vars) => r.push({ tone, k, id, vars });
  const cv = pct(f.cv ?? 0);
  if (o.aboveFog) add('good', 'canvas', 'r.aboveFog', { elev: spot.elev, top: o.mlTop });
  if ((f.cv ?? 0) < 0.12) add('neutral', 'canvas', 'r.canvasNone');
  else if (f.cv < 0.3) add('neutral', 'canvas', 'r.canvasFew', { cv });
  else if (f.cv <= 0.75) add('good', 'canvas', 'r.canvasGood', { cv, kind: canvasKind(f.high, f.mid) });
  else add('bad', 'canvas', 'r.canvasThick', { cv });

  const fl = pct(f.farLow ?? 0);
  if (f.light >= 0.85) add('good', 'light', 'r.lightGood');
  else if (f.light >= 0.55) add('neutral', 'light', 'r.lightPart', { fl });
  else add('bad', 'light', 'r.lightBad', { fl });

  if (!o.aboveFog) {
    const fog = {
      fr: pct(o.fogRisk),
      // Call out HRRR vs global disagreement: the global models routinely miss the marine layer.
      ...(o.hrrrLow != null && o.globalLow != null && o.hrrrLow - o.globalLow > 0.35 ? { hrrr: pct(o.hrrrLow), glob: pct(o.globalLow) } : {}),
      inv: (f.heur ?? 0) > 0.5,
    };
    if (o.fogRisk >= 0.6) add('bad', 'local', 'r.fogHigh', fog);
    else if (o.fogRisk >= 0.3) add('neutral', 'local', 'r.fogMid', fog);
    else add('good', 'local', 'r.fogLow');
    if (f.vis != null && f.vis < 5000) add('bad', 'local', 'r.visLow', { km: (f.vis / 1000).toFixed(1) });
  }

  if (o.aod == null) add('neutral', 'clarity', 'r.aodNone');
  else if (o.aod < 0.1) add('good', 'clarity', 'r.aodClean', { aod: o.aod.toFixed(2) });
  else if (o.aod <= 0.3) add('neutral', 'clarity', 'r.aodLight', { aod: o.aod.toFixed(2) });
  else add('bad', 'clarity', 'r.aodHeavy', { aod: o.aod.toFixed(2), pm25: o.pm25 != null ? Math.round(o.pm25) : null });

  const az = Math.round(sun.azimuth);
  if (o.ocean) add('good', 'horizon', 'r.horizonOcean', { az });
  else add('neutral', 'horizon', 'r.horizonLand', { az });

  if (o.split) add('neutral', 'model', 'r.modelSplitGroups', { hiNames: o.split.hi.names, hi: o.split.hi.score, loNames: o.split.lo.names, lo: o.split.lo.score });
  else if (o.confidence.spread >= 18) add('neutral', 'model', 'r.modelSplit', { n: o.confidence.spread });
  else if (o.members.filter((m) => m.score != null).length >= 4 && o.confidence.spread <= 8 && !(o.hrrrLow != null && o.globalLow != null && Math.abs(o.hrrrLow - o.globalLow) > 0.35)) add('good', 'model', 'r.modelAgree');
  if (o.greenFlash) add('good', 'horizon', 'r.greenFlash');
  return r;
}

/**
 * When the members fall into two camps far apart (e.g. three say clear ≈ 22, HRRR says 92), the
 * weighted average (≈ 47 "good") describes neither outcome. Backtests showed the average is still the
 * most accurate number, so the score stays — but the text then says who expects what.
 * Returns { hi, lo } groups ({ names, score, w }) when the widest gap between sorted scores is ≥ 40.
 */
export const SPLIT_GAP = 40;
export function splitGroups(scored) {
  const ms = scored.map((m) => ({ name: m.name, s: m.r.score, w: m.w })).sort((a, b) => a.s - b.s);
  let gap = 0, at = -1;
  for (let i = 1; i < ms.length; i++) if (ms[i].s - ms[i - 1].s > gap) { gap = ms[i].s - ms[i - 1].s; at = i; }
  if (ms.length < 2 || gap < SPLIT_GAP) return null;
  const group = (g) => {
    const w = g.reduce((s, m) => s + m.w, 0);
    return { names: g.map((m) => m.name).join(' / '), score: Math.round(g.reduce((s, m) => s + m.s * m.w, 0) / w), w };
  };
  return { lo: group(ms.slice(0, at)), hi: group(ms.slice(at)) };
}

function headline(o) {
  if (o.insufficient) return 'hl.na';
  // Camps far apart: say which way most of the weight leans and name the dissenting models.
  if (o.split) return o.split.hi.w >= o.split.lo.w ? 'hl.splitMostlyHigh' : 'hl.splitMostlyLow';
  const f = o.factors;
  if (o.aboveFog && o.score >= 45) return 'hl.aboveFog';
  if (o.score >= 65) return 'hl.great';
  if (f.local < 0.55) return 'hl.fog';
  if (f.light < 0.55) return 'hl.light';
  if (f.clarity < 0.8) return 'hl.haze';
  if ((f.cv ?? 0) > 0.75) return 'hl.thick';
  if ((f.cv ?? 0) < 0.15) return 'hl.clear';
  if (f.local < 0.75) return 'hl.fogSome';
  if (f.light < 0.75) return 'hl.lightSome';
  if (o.score >= 45) return 'hl.fair';
  return 'hl.few';
}
