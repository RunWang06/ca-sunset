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
export const PATH_KM = [0, 25, 75, 150, 250];

// Member weights by day index [today, tomorrow]. HRRR (3 km) resolves the marine layer far better
// than the global models but degrades past ~24 h, so its weight drops tomorrow.
export const MODELS = [
  { id: 'ncep_hrrr_conus', name: 'HRRR', w: [0.32, 0.2] },
  { id: 'ecmwf_ifs025', name: 'ECMWF', w: [0.23, 0.28] },
  { id: 'gfs_global', name: 'GFS', w: [0.15, 0.17] },
  { id: 'icon_seamless', name: 'ICON', w: [0.15, 0.18] },
  { id: 'gem_seamless', name: 'GEM', w: [0.15, 0.17] },
];

export const NOTABLE = 55; // "明显晚霞" threshold used for the probability

export function label(score) {
  if (score == null) return '数据不足';
  if (score >= 80) return '火烧云级';
  if (score >= 65) return '值得去';
  if (score >= 45) return '不错';
  if (score >= 25) return '一般';
  return '平淡';
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

  // 2) Light path: low (and thick mid) cloud 75–250 km toward the sun blocks the light.
  const far = [[m.path[2], 0.3], [m.path[3], 0.4], [m.path[4], 0.3]].filter(([c]) => c && c.low != null);
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
 *        profile, region:{fog,base}, month, pathAvailable }
 */
export function forecast(ctx) {
  const { spot, sun, day, aq, region, month } = ctx;
  const ocean = inSector(sun.azimuth, spot.view);
  const aod = aq?.aod ?? null;
  const base = { clarity: clarityFactor(aod), horizon: ocean ? 1 : 0.88, aboveFog: false };
  const warnings = [];

  let scored = ctx.members.map((m) => ({ ...m, r: memberScore(m, base) })).filter((m) => m.r);
  if (!scored.length) {
    return { insufficient: true, score: null, prob: null, label: label(null), ocean, warnings: ['所有气象模型在这个时刻都没有返回数据。'], reasons: [], members: [], timing: timing(sun, null, spot), headline: '数据不足，暂时无法评估' };
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
  const wH = hrrr ? (day === 0 ? 0.5 : 0.3) : 0;
  const fogModel = wH * (hrrr?.r.effLow ?? 0) + (0.85 - wH) * (f.effLow ?? 0);
  const fogRisk = aboveFog ? null : clamp(fogModel + 0.15 * region.fog[month]);

  const aodMissing = aod == null;
  if (aodMissing) warnings.push('气溶胶（AOD）数据缺失，空气透明度按保守值 0.88 估计。');
  if (!ctx.pathAvailable) warnings.push('日落方向远海采样点缺少数据，光路通畅度按 0.85 估计。');
  if (n < 3) warnings.push(`只有 ${n} 个模型返回数据，结果可信度较低。`);
  if (!hrrr) warnings.push('高分辨率 HRRR 模型此时段无数据（常见于 30 小时以后），海雾判断主要依赖全球模型，可能低估低云。');
  if (f.vis == null) warnings.push('能见度数据缺失（仅 HRRR/GFS 提供）。');

  let conf = 1 - spread / 28 - (n < 3 ? 0.25 : 0) - day * 0.12 - (aodMissing ? 0.05 : 0) - (ctx.pathAvailable ? 0 : 0.1) - (hrrr ? 0 : 0.1);
  if (!aboveFog && fogRisk >= 0.3 && fogRisk <= 0.7) conf -= 0.1; // marginal fog is the hardest call on this coast
  const confidence = { level: conf >= 0.6 ? '高' : conf >= 0.35 ? '中' : '低', spread: Math.round(spread), value: conf };

  const out = {
    insufficient: false, score: Math.round(score), label: label(score), prob, probRaw, confidence, ocean, aboveFog, mlTop,
    fogRisk, hrrrLow: hrrr?.r.low ?? null, globalLow, aod, pm25: aq?.pm25 ?? null, factors: f, warnings,
    members: MODELS.map((M) => {
      const s = scored.find((m) => m.id === M.id);
      return { id: M.id, name: M.name, score: s ? Math.round(s.r.score) : null };
    }),
  };
  out.greenFlash = ocean && f.light > 0.9 && (f.farLow ?? 1) < 0.1 && (aod ?? 1) < 0.12 && (f.cv ?? 1) < 0.4 && (fogRisk ?? 0) < 0.2;
  out.timing = timing(sun, f, spot);
  out.reasons = reasons(out, sun, spot, region, month);
  out.headline = headline(out);
  return out;
}

export function timing(sun, f, spot) {
  const min = 60000, s = sun.sunset;
  let peak, peakNote;
  const highShare = f && f.high != null && f.mid != null ? f.high / (f.high + f.mid + 1e-6) : 0.5;
  if (!f || (f.cv ?? 0) < 0.15) { peak = [s - 15 * min, s + 5 * min]; peakNote = '天空较干净：太阳落入海平线前后最好看，之后颜色较淡。'; }
  else if (highShare >= 0.6) { peak = [s + 3 * min, s + 25 * min]; peakNote = '以高云（卷云）为主：余晖通常在日落后 5–20 分钟最红，别太早离开。'; }
  else { peak = [s - 5 * min, s + 15 * min]; peakNote = '以中云为主：日落前后 15 分钟内最精彩。'; }
  const lead = spot.hike ? 45 : 25;
  return { arrive: s - lead * min, sunset: s, peakStart: peak[0], peakEnd: peak[1], dusk: sun.dusk, peakNote, lead };
}

function reasons(o, sun, spot, region, month) {
  const f = o.factors, r = [];
  const cv = pct(f.cv ?? 0);
  const kind = (f.high ?? 0) > (f.mid ?? 0) ? '以卷云等高云为主' : '以高积云等中云为主';
  if (o.aboveFog) r.push({ tone: 'good', k: 'canvas', text: `观景点海拔约 ${spot.elev} m，预计高于海洋层顶（约 ${o.mlTop} m）——有机会俯瞰被夕阳染色的云海。` });
  if ((f.cv ?? 0) < 0.12) r.push({ tone: 'neutral', k: 'canvas', text: '西边中高云很少：多半是干净的金色落日，难出现大片火烧云。' });
  else if (f.cv < 0.3) r.push({ tone: 'neutral', k: 'canvas', text: `中高云偏少（约 ${cv}%），可能只有零星云彩被染色。` });
  else if (f.cv <= 0.75) r.push({ tone: 'good', k: 'canvas', text: `西边天空约 ${cv}% 中高云（${kind}）——晚霞的“画布”充足。` });
  else r.push({ tone: 'bad', k: 'canvas', text: `中高云接近满天（约 ${cv}%），云层太厚时阳光难以照进来。` });

  const farLow = pct(f.farLow ?? 0);
  if (f.light >= 0.85) r.push({ tone: 'good', k: 'light', text: '日落方向 75–250 km 的远海低云少，阳光能从云底下方照亮云层。' });
  else if (f.light >= 0.55) r.push({ tone: 'neutral', k: 'light', text: `日落方向远海有部分低云（约 ${farLow}%），余晖可能被削弱。` });
  else r.push({ tone: 'bad', k: 'light', text: `日落方向远海有成片低云/云堤（约 ${farLow}%），太阳可能提前没入云中、照不亮天空。` });

  if (!o.aboveFog) {
    const fr = pct(o.fogRisk);
    const hint = o.hrrrLow != null && o.globalLow != null && o.hrrrLow - o.globalLow > 0.35
      ? `高分辨率 HRRR 显示约 ${pct(o.hrrrLow)}% 低云，全球模式只有 ${pct(o.globalLow)}%，后者常低估海洋层。` : '';
    const inv = (f.heur ?? 0) > 0.5 ? '近地面逆温强、湿度高，典型的海洋层天气。' : '';
    if (o.fogRisk >= 0.6) r.push({ tone: 'bad', k: 'local', text: `本地低云/海雾风险高（约 ${fr}%）：在海边平地可能什么都看不到。${hint}${inv}` });
    else if (o.fogRisk >= 0.3) r.push({ tone: 'neutral', k: 'local', text: `有一定海雾/低云风险（约 ${fr}%），雾线进退很难准确预报。${hint}${inv}` });
    else r.push({ tone: 'good', k: 'local', text: '观景点附近低云和海雾少，视线开阔。' });
    if (f.vis != null && f.vis < 5000) r.push({ tone: 'bad', k: 'local', text: `能见度只有约 ${(f.vis / 1000).toFixed(1)} km。` });
  }

  if (o.aod == null) r.push({ tone: 'neutral', k: 'clarity', text: '缺少气溶胶数据，空气透明度按保守值估计。' });
  else if (o.aod < 0.1) r.push({ tone: 'good', k: 'clarity', text: `空气通透（AOD ${o.aod.toFixed(2)}），颜色会更干净饱和。` });
  else if (o.aod <= 0.3) r.push({ tone: 'neutral', k: 'clarity', text: `轻度气溶胶（AOD ${o.aod.toFixed(2)}），色调可能更暖但稍发朦。` });
  else r.push({ tone: 'bad', k: 'clarity', text: `烟霾较重（AOD ${o.aod.toFixed(2)}${o.pm25 != null ? `，PM2.5 ${Math.round(o.pm25)}` : ''}）：太阳偏暗红，云彩对比度降低。` });

  if (o.ocean) r.push({ tone: 'good', k: 'horizon', text: `太阳落向开阔海平线（方位 ${Math.round(sun.azimuth)}°）。` });
  else r.push({ tone: 'neutral', k: 'horizon', text: `这里日落方向（${Math.round(sun.azimuth)}°）被陆地或山体挡住，太阳会提前消失，但头顶的云仍能被照亮。` });

  if (o.confidence.spread >= 18) r.push({ tone: 'neutral', k: 'model', text: `各模型分歧大（相差约 ±${o.confidence.spread} 分），结果不稳定，出发前建议再刷新一次。` });
  else if (o.members.filter((m) => m.score != null).length >= 4 && o.confidence.spread <= 8 && !(o.hrrrLow != null && o.globalLow != null && Math.abs(o.hrrrLow - o.globalLow) > 0.35)) r.push({ tone: 'good', k: 'model', text: '多个气象模型的判断比较一致。' });
  if (o.greenFlash) r.push({ tone: 'good', k: 'horizon', text: '海平线干净、空气通透：日落最后一刻有机会看到绿闪。' });
  return r;
}

function headline(o) {
  if (o.insufficient) return '数据不足，暂时无法评估';
  const f = o.factors;
  if (o.aboveFog && o.score >= 45) return '有望在雾层之上看云海晚霞';
  if (o.score >= 65) return '中高云充足、光路通畅，值得专程去';
  if (f.local < 0.55) return '本地海雾/低云可能挡住视线';
  if (f.light < 0.55) return '远海低云挡光，余晖可能偏弱';
  if (f.clarity < 0.8) return '烟霾较重，颜色发闷';
  if ((f.cv ?? 0) > 0.75) return '云层偏厚，阳光可能透不进来';
  if ((f.cv ?? 0) < 0.15) return '天空干净，适合看金色落日，难有火烧云';
  if (f.local < 0.75) return '有晚霞的云，但海雾风险不小';
  if (f.light < 0.75) return '有晚霞的云，但远海低云可能挡光';
  if (o.score >= 45) return '有一定晚霞机会，条件中等';
  return '云彩不多，晚霞机会有限';
}
