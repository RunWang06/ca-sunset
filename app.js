import { SPOTS, REGIONS, REGION_BY_ID } from './spots.js';
import { sunsetInfo, compass, compassEn } from './sun.js';
import { loadData, buildInputs, laDate, addDays, distanceKm, destPoint } from './data.js';
import { forecast, PATH_KM } from './model.js';
import { tr, lang, setLang, detectLang, fmtTime, fmtTimeHtml, fmtDay, placeName, regionLabel, regionParen } from './i18n.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const t = fmtTime;     // plain-text clock time
const tb = fmtTimeHtml; // clock time for big numerals (small AM/PM)
const dir = (az) => (lang === 'en' ? compassEn(az) : compass(az));
const ALL_REGION = { id: 'all', name: '全海岸', en: 'All Coast' };
// Secondary-language place name, shown under / after the primary one.
const alt = (s) => `<span class="alt">${esc(placeName(s).alt)}</span>`;
const main = (s) => esc(placeName(s).main);
const pct = (x) => (x == null ? '—' : `${Math.round(x * 100)}%`);
const tone = (s) => (s == null ? 'var(--line)' : s >= 80 ? 'var(--s4)' : s >= 65 ? 'var(--s3)' : s >= 45 ? 'var(--s2)' : s >= 25 ? 'var(--s1)' : 'var(--s0)');

const state = { day: 0, region: 'all', sort: 'score', query: '', selected: null, userLoc: null, data: null, results: [[], []], dates: [], suns: [[], []], loading: true };

// ---------- setup ----------
function initDates() {
  const now = Date.now();
  const d0 = laDate(now);
  state.dates = [d0, addDays(d0, 1)];
  state.suns = state.dates.map((d) => SPOTS.map((s) => sunsetInfo(d, s.lat, s.lon, s.elev)));
  const lastDusk = Math.max(...state.suns[0].map((s) => s.dusk));
  state.todayOver = now > lastDusk;
  if (state.todayOver) state.day = 1;
}

function renderDaySeg() {
  $('#daySeg').innerHTML = state.dates.map((d, i) => {
    return `<button role="tab" data-day="${i}" aria-selected="${state.day === i}">${tr(`day.${i}`)} <span class="num" style="opacity:.7;font-size:12px">${fmtDay(d)}</span></button>`;
  }).join('');
}

function renderChips() {
  const items = [ALL_REGION, ...REGIONS];
  $('#regionChips').innerHTML = items.map((r) => `<button role="tab" data-region="${r.id}" aria-selected="${state.region === r.id}">${esc(placeName(r).main)}${alt(r)}</button>`).join('');
}

// ---------- map ----------
let map, markers = {}, rayLayer;
function initMap() {
  if (!window.L) { $('#map').innerHTML = `<p class="empty">${tr('map.failed')}</p>`; return; }
  map = L.map('map', { zoomControl: false, attributionControl: true, scrollWheelZoom: matchMedia('(min-width: 960px)').matches }).setView([36.6, -120.6], 6);
  L.control.zoom({ position: 'topright' }).addTo(map);
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  const base = `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_${dark ? 'Dark' : 'Light'}_Gray_`;
  L.tileLayer(`${base}Base/MapServer/tile/{z}/{y}/{x}`, { attribution: 'Tiles © Esri — Esri, HERE, Garmin, © OpenStreetMap', maxZoom: 16 }).addTo(map);
  L.tileLayer(`${base}Reference/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 16, pane: 'shadowPane' }).addTo(map);
  map.fitBounds([[32.5, -124.4], [41.9, -117.1]], { padding: [10, 10] });
  const zoomClass = () => map.getContainer().classList.toggle('z-low', map.getZoom() < 8);
  map.on('zoomend', zoomClass); zoomClass();
}

function renderMarkers() {
  if (!map) return;
  const res = state.results[state.day];
  SPOTS.forEach((s, i) => {
    const r = res[i];
    const sc = r?.score;
    const visible = matchesFilter(s);
    const html = `<div class="mk ${state.selected === s.id ? 'sel' : ''} ${visible ? '' : 'dim'}" style="background:${tone(sc)}">${sc ?? '·'}</div>`;
    const icon = L.divIcon({ html, className: '', iconSize: [30, 30], iconAnchor: [15, 15] });
    const pn = placeName(s);
    const tip = `${esc(pn.main)}<br><small>${esc(pn.alt)}</small>`;
    if (!markers[s.id]) {
      markers[s.id] = L.marker([s.lat, s.lon], { icon, keyboard: true, title: `${pn.main} ${pn.alt}` })
        .addTo(map).on('click', () => openSpot(s.id))
        .bindTooltip(tip, { direction: 'top', offset: [0, -14] });
    } else { markers[s.id].setIcon(icon); markers[s.id].setTooltipContent(tip); }
    markers[s.id].setZIndexOffset(state.selected === s.id ? 1000 : (sc ?? 0));
  });
}

function drawRay(spot, idx) {
  if (!map) return;
  if (rayLayer) rayLayer.remove();
  const r = state.results[state.day][idx];
  const az = state.suns[0][idx].azimuth;
  const end = destPoint(spot.lat, spot.lon, az, 260);
  const group = L.layerGroup();
  L.polyline([[spot.lat, spot.lon], end], { color: '#ff7a45', weight: 2, dashArray: '4 6', opacity: .9 }).addTo(group);
  const prof = r?.profile || [];
  PATH_KM.slice(1).forEach((km, k) => {
    const p = destPoint(spot.lat, spot.lon, az, km);
    const low = prof[k + 1]?.low;
    L.circleMarker(p, {
      radius: 7, weight: 2, color: '#fff', fillOpacity: .95,
      fillColor: low == null ? '#999' : low > 0.5 ? '#7c8597' : low > 0.2 ? '#e6b45c' : '#ff7a45',
    }).bindTooltip(tr('ray.tip', { km, p: pct(low) }), { direction: 'top' }).addTo(group);
  });
  rayLayer = group.addTo(map);
  const wide = matchMedia('(min-width: 960px)').matches;
  map.flyToBounds(L.latLngBounds([[spot.lat, spot.lon], end]), { duration: 0.6, maxZoom: 9, paddingTopLeft: [30, 30], paddingBottomRight: [wide ? 510 : 30, 30] });
}

// ---------- compute ----------
function compute() {
  const { data } = state;
  for (const day of [0, 1]) {
    const date = state.dates[day];
    const month = +date.slice(5, 7) - 1;
    state.results[day] = SPOTS.map((s, i) => {
      const sun = state.suns[day][i];
      const inp = buildInputs(data, i, s, sun.sunset, day);
      const f = forecast({ spot: s, sun, day, ...inp, region: REGION_BY_ID[s.region], month });
      // consensus cloud cross-section along the sunset ray (for the profile chart)
      f.profile = PATH_KM.map((_, k) => {
        const acc = { low: [0, 0], mid: [0, 0], high: [0, 0] };
        for (const m of inp.members) {
          const c = m.path[k];
          if (!c) continue;
          for (const key of ['low', 'mid', 'high']) if (c[key] != null) { acc[key][0] += c[key] * m.w; acc[key][1] += m.w; }
        }
        const o = {};
        for (const key of ['low', 'mid', 'high']) o[key] = acc[key][1] ? acc[key][0] / acc[key][1] : null;
        return o;
      });
      f.sun = sun;
      return f;
    });
  }
}

// ---------- list & answer ----------
function matchesFilter(s) {
  if (state.region !== 'all' && s.region !== state.region) return false;
  const q = state.query.trim().toLowerCase();
  if (!q) return true;
  return [s.name, s.en, REGION_BY_ID[s.region].name, REGION_BY_ID[s.region].en].some((x) => x.toLowerCase().includes(q));
}

function rows() {
  const res = state.results[state.day];
  let list = SPOTS.map((s, i) => ({ s, i, r: res[i] })).filter(({ s }) => matchesFilter(s));
  const by = {
    score: (a, b) => (b.r?.score ?? -1) - (a.r?.score ?? -1),
    prob: (a, b) => (b.r?.prob ?? -1) - (a.r?.prob ?? -1),
    ns: (a, b) => b.s.lat - a.s.lat,
    dist: (a, b) => (state.userLoc ? distanceKm(state.userLoc, a.s) - distanceKm(state.userLoc, b.s) : 0),
  }[state.sort];
  return list.sort(by);
}

function badge(score, small = true) {
  if (score == null) return `<div class="badge na">N/A</div>`;
  const lab = tr(`legend.${score >= 80 ? 4 : score >= 65 ? 3 : score >= 45 ? 2 : score >= 25 ? 1 : 0}`);
  return `<div class="badge num" style="background:${tone(score)}"><div>${score}${small ? `<small>${lab}</small>` : ''}</div></div>`;
}

function renderList() {
  if (state.loading) {
    $('#spotList').innerHTML = Array.from({ length: 6 }, () => '<li class="sk" style="height:66px"></li>').join('');
    return;
  }
  const list = rows();
  if (!list.length) { $('#spotList').innerHTML = `<li class="empty">${tr('list.empty', { q: esc(state.query) })}</li>`; return; }
  $('#spotList').innerHTML = list.map(({ s, r }) => {
    const reg = regionLabel(REGION_BY_ID[s.region]);
    const dist = state.userLoc ? ` · ${Math.round(distanceKm(state.userLoc, s))} km` : '';
    const past = state.day === 0 && Date.now() > r.sun.dusk;
    return `<li class="spot ${state.selected === s.id ? 'active' : ''} ${past ? 'past' : ''}" data-id="${s.id}" tabindex="0">
      ${badge(r.score)}
      <div style="min-width:0">
        <div class="nm">${main(s)}${alt(s)}</div>
        <div class="meta num">${past ? tr('list.over') : tr('list.sunset', { t: t(r.sun.sunset) })} · ${dir(r.sun.azimuth)}${dist} · ${esc(reg)}</div>
        <div class="hl">${esc(tr(r.headline))}</div>
      </div>
      <div class="right num">${r.prob == null ? '' : `<b>${pct(r.prob)}</b>${tr('list.prob')}`}</div>
    </li>`;
  }).join('');
}

function renderAnswer() {
  const el = $('#answer');
  if (state.loading) { el.innerHTML = '<div class="sk" style="height:168px;border-radius:20px"></div><div class="sk" style="height:64px"></div>'; return; }
  const res = state.results[state.day];
  const now = Date.now();
  const inScope = SPOTS.map((s, i) => ({ s, i, r: res[i] })).filter(({ s, r }) => r.score != null && (state.region === 'all' || s.region === state.region));
  // Today: only recommend places whose afterglow hasn't ended yet.
  const pool = state.day === 0 ? inScope.filter(({ r }) => r.sun.dusk > now) : inScope;
  if (!inScope.length) { el.innerHTML = `<div class="coast-note">${tr('ans.noData')}</div>`; return; }
  if (!pool.length) {
    el.innerHTML = `<div class="hero dull"><div class="eyebrow">${tr('ans.overEyebrow')}</div><h2>${tr('ans.overTitle')}</h2>
      <p class="why">${tr('ans.overWhy')}</p><div class="over"><button id="goTomorrow">${tr('ans.overBtn')}</button></div></div>`;
    return;
  }
  // Rank by expected value: a high score that probably won't happen should not beat a solid, likely one.
  const rank = ({ r }) => r.score * (0.6 + 0.8 * r.prob);
  pool.sort((a, b) => rank(b) - rank(a));
  const best = pool[0];
  const dull = best.r.score < 35;
  const dayWord = tr(`day.${state.day}`);
  let countdown = '';
  if (state.day === 0 && best.r.timing.arrive > now) {
    const m = Math.round((best.r.timing.arrive - now) / 60000);
    countdown = m >= 60 ? tr('ans.countdownHM', { h: Math.floor(m / 60), m: m % 60 }) : tr('ans.countdownM', { m });
  } else if (state.day === 0 && best.r.sun.dusk > now) countdown = tr('ans.glowNow');
  const scope = state.region === 'all' ? tr('scope.all') : regionParen(REGION_BY_ID[state.region]);
  const good = best.r.reasons.find((x) => x.tone === 'good');
  const sep = lang === 'en' ? '. ' : '。';
  el.innerHTML = `
    <div class="hero ${dull ? 'dull' : ''}" data-id="${best.s.id}" tabindex="0" role="button" aria-label="${esc(tr('ans.open', { name: placeName(best.s).main }))}">
      <div class="eyebrow">${esc(tr(dull ? 'ans.eyebrowDull' : 'ans.eyebrow', { day: dayWord, scope }))}</div>
      <h2>${main(best.s)}</h2>
      <div class="eyebrow">${esc(placeName(best.s).alt)} · ${esc(regionLabel(REGION_BY_ID[best.s.region]))}</div>
      <p class="why">${esc(tr(best.r.headline))}${good && !dull ? `${sep}${esc(tr(good.id, good.vars))}` : ''}</p>
      <div class="kpis num">
        <div class="kpi"><b>${best.r.score}</b><span>${tr('kpi.score')}</span></div>
        <div class="kpi"><b>${pct(best.r.prob)}</b><span>${tr('kpi.prob', { c: tr(`conf.${best.r.confidence.level}`) })}</span></div>
        <div class="kpi"><b>${tb(best.r.timing.arrive)}</b><span>${tr('kpi.arrive')}</span></div>
        <div class="kpi"><b>${tb(best.r.sun.sunset)}</b><span>${tr('kpi.sunset', { dir: dir(best.r.sun.azimuth) })}</span></div>
      </div>
      ${countdown ? `<div class="eyebrow" style="margin-top:10px">${countdown}</div>` : ''}
    </div>
    ${state.region === 'all' ? `<div class="region-best">${REGIONS.map((reg) => {
      const p = pool.filter((x) => x.s.region === reg.id);
      if (!p.length) return '';
      const b = p[0];
      return `<button class="rb" data-id="${b.s.id}">
        <div class="r">${esc(tr('rb.best', { region: regionLabel(reg) }))}</div>
        <div class="n">${main(b.s)}</div>
        <div class="ne">${esc(placeName(b.s).alt)}</div>
        <div class="m num"><span class="badge" style="width:auto;height:auto;padding:1px 6px;border-radius:6px;font-size:12px;background:${tone(b.r.score)}">${b.r.score}</span>${pct(b.r.prob)} · ${tr('rb.arrive', { t: t(b.r.timing.arrive) })}</div>
      </button>`;
    }).join('')}</div>` : `<div class="coast-note"><b>${esc(tr('coast.climate', { region: regionParen(REGION_BY_ID[state.region]) }))}</b>${tr(`note.${state.region}`)}</div>`}
  `;
}

function renderStatus(extra = '') {
  const d = state.data;
  let html = '';
  if (state.loading) {
    const p = state.progress;
    html = tr('status.loading', { p: p ? ` (${p[0]}/${p[1]})` : '' });
  } else if (d) {
    const age = Math.round((Date.now() - d.at) / 60000);
    const ageText = age >= 60 ? tr('age.hm', { h: Math.floor(age / 60), m: age % 60 }) : tr('age.m', { m: age });
    html = d.stale
      ? `<span class="warn">${tr('status.stale', { age: ageText, t: t(d.at) })}</span> · <a href="#" id="refresh">${tr('status.retry')}</a>`
      : `${tr('status.updated', { t: t(d.at) })}${d.source ? tr(`src.${d.source}`) : ''} · <a href="#" id="refresh">${tr('status.refresh')}</a>`;
    if (d.errors?.length && !d.stale) html += ` · <span class="warn">${esc(tr('status.partial', { e: errorText(d.errors) }))}</span>`;
  }
  if (state.todayOver && state.day === 1) html = `${tr('status.todayOver')} ${html}`;
  $('#status').innerHTML = html + extra;
}

// Data-layer errors are structured; older data.json files may still carry plain strings.
function errorText(errors) {
  return errors.map((e) => (typeof e === 'string' ? e : tr('err.layer', {
    layer: tr(`layer.${e.layer}`), failed: e.failed, total: e.total,
    reason: ['timeout', 'network', 'ratelimit'].includes(e.reason) ? tr(`reason.${e.reason}`) : e.reason,
  }))).join(tr('err.sep'));
}

// ---------- language ----------
// Static markup: data-i18n="key" sets text; data-i18n-attr="attr:key;attr:key" sets attributes.
// Long prose (method dialog, footer) has one block per language marked data-lang; CSS shows the active one.
function applyStatic() {
  document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
  document.title = tr('title');
  document.querySelector('meta[name="description"]').content = tr('meta.desc');
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = tr(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    for (const pair of el.dataset.i18nAttr.split(';')) {
      const [attr, key] = pair.split(':');
      el.setAttribute(attr, tr(key));
    }
  });
}

function switchLang(next) {
  setLang(next, { remember: true });
  const url = new URL(location.href);
  url.searchParams.set('lang', lang); // shared links open in the sender's language
  history.replaceState(null, '', url);
  applyStatic();
  renderAll();
  if (state.selected) { const i = SPOTS.findIndex((x) => x.id === state.selected); drawRay(SPOTS[i], i); }
}

function renderAll() {
  renderDaySeg(); renderChips(); renderStatus(); renderAnswer(); renderList(); renderMarkers();
  if (state.selected) renderSheet();
}

// ---------- detail sheet ----------
function ring(score) {
  const C = 2 * Math.PI * 40, v = (score ?? 0) / 100;
  return `<div class="ring"><svg viewBox="0 0 92 92"><circle cx="46" cy="46" r="40" fill="none" stroke="var(--line)" stroke-width="8"/>
    <circle cx="46" cy="46" r="40" fill="none" stroke="${tone(score)}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${C * v} ${C}"/></svg>
    <div class="v"><b class="num">${score ?? '—'}</b><span>${tr('ring.score')}</span></div></div>`;
}

function compassSvg(az, view) {
  const cx = 60, cy = 60, R = 46;
  const pt = (a, r) => [cx + r * Math.sin((a * Math.PI) / 180), cy - r * Math.cos((a * Math.PI) / 180)];
  const [f, to] = view;
  const span = ((to - f + 360) % 360);
  const [x1, y1] = pt(f, R), [x2, y2] = pt(to, R);
  const [sx, sy] = pt(az, R - 4);
  return `<svg viewBox="0 0 120 120" width="120" height="120" role="img" aria-label="${tr('dir.aria', { az: Math.round(az) })}">
    <circle cx="${cx}" cy="${cy}" r="${R}" fill="var(--bg)" stroke="var(--line)"/>
    <path d="M${cx},${cy} L${x1},${y1} A${R},${R} 0 ${span > 180 ? 1 : 0} 1 ${x2},${y2} Z" fill="#3b82c4" opacity=".22"/>
    <line x1="${cx}" y1="${cy}" x2="${sx}" y2="${sy}" stroke="#ff7a45" stroke-width="3" stroke-linecap="round"/>
    <circle cx="${sx}" cy="${sy}" r="7" fill="#ffb347" stroke="#ff7a45" stroke-width="2"/>
    <circle cx="${cx}" cy="${cy}" r="3" fill="var(--ink)"/>
    <text x="${cx}" y="10" text-anchor="middle">N</text><text x="${cx}" y="118" text-anchor="middle">S</text>
    <text x="4" y="${cy + 3}">W</text><text x="110" y="${cy + 3}">E</text>
  </svg>`;
}

function profileSvg(prof) {
  // Cross-section: observer on the left, sun direction on the right. Layers drawn with opacity = coverage.
  const W = 340, H = 150, x0 = 26, x1 = W - 14, yb = H - 22;
  const xs = PATH_KM.map((km) => x0 + (Math.sqrt(km) / Math.sqrt(250)) * (x1 - x0));
  const layers = [['high', 18, 44, '#f3c6a5'], ['mid', 50, 78, '#e79a7d'], ['low', 92, yb - 4, '#8a93a6']];
  let cells = '';
  prof.forEach((c, k) => {
    const left = k === 0 ? x0 : (xs[k - 1] + xs[k]) / 2;
    const right = k === prof.length - 1 ? x1 : (xs[k] + xs[k + 1]) / 2;
    for (const [key, y0, y1, col] of layers) {
      const v = c?.[key];
      if (v == null) cells += `<rect x="${left + 1}" y="${y0}" width="${right - left - 2}" height="${y1 - y0}" fill="none" stroke="var(--line)" stroke-dasharray="2 3"/>`;
      else if (v > 0.03) cells += `<rect x="${left + 1}" y="${y0}" width="${right - left - 2}" height="${y1 - y0}" rx="6" fill="${col}" opacity="${(0.15 + 0.85 * v).toFixed(2)}"/>`;
    }
  });
  const labels = PATH_KM.map((km, k) => `<text x="${xs[k]}" y="${H - 6}" text-anchor="${k === PATH_KM.length - 1 ? 'end' : 'middle'}">${km === 0 ? tr('profile.you') : km + 'km'}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${tr('profile.aria')}">
    <text x="2" y="34">${tr('profile.high')}</text><text x="2" y="67">${tr('profile.mid')}</text><text x="2" y="${(92 + yb) / 2 + 3}">${tr('profile.low')}</text>
    ${cells}
    <line x1="${x0}" y1="${yb}" x2="${x1}" y2="${yb}" stroke="var(--ink-3)"/>
    <circle cx="${x1 - 2}" cy="${yb}" r="9" fill="#ffb347" opacity=".9"/>
    ${labels}
  </svg>`;
}

function renderSheet() {
  const idx = SPOTS.findIndex((s) => s.id === state.selected);
  if (idx < 0) return;
  const s = SPOTS[idx], r = state.results[state.day][idx], reg = REGION_BY_ID[s.region];
  const sun = r.sun, tm = r.timing;
  const dayWord = tr(`day.${state.day}`);
  // timeline geometry: arrive → dusk+10
  const t0 = tm.arrive, t1 = tm.dusk + 10 * 60000, span = t1 - t0;
  const pos = (x) => `${Math.max(0, Math.min(100, ((x - t0) / span) * 100)).toFixed(1)}%`;
  const near = SPOTS.map((o, i) => ({ o, i, d: distanceKm(s, o), r: state.results[state.day][i] }))
    .filter((x) => x.o.id !== s.id && x.d <= 110 && x.r.score != null).sort((a, b) => b.r.score - a.r.score).slice(0, 6);
  const f = r.factors || {};
  const factorRow = (name, v, note) => `<div class="factor"><span>${name}</span><div class="bar"><i style="width:${Math.round((v ?? 0) * 100)}%;background:${(v ?? 0) >= 0.8 ? 'var(--good)' : (v ?? 0) >= 0.55 ? 'var(--neutral)' : 'var(--bad)'}"></i></div><span class="num" title="${note}">${v == null ? '—' : Math.round(v * 100)}</span></div>`;

  const pn = placeName(s);
  const note = [tr(tm.peakKey), s.hike ? tr('tl.hike') : '', sun.elevationGainMin >= 1 ? tr('tl.elev', { n: sun.elevationGainMin }) : ''].filter(Boolean).join(lang === 'en' ? ' ' : '');
  const fogText = r.aboveFog ? tr('f.aboveFog') : tr('f.fogRisk', { p: pct(r.fogRisk) });
  $('#sheetBody').innerHTML = `
    <div class="sheet-top">
      <button class="x" id="closeSheet" aria-label="${tr('close')}">✕</button>
      <div style="min-width:0"><h2 id="sheetTitle">${esc(pn.main)}</h2><p>${esc(pn.alt)} · ${esc(regionLabel(reg))} · ${tr('sheet.elev', { m: s.elev })}</p></div>
      <button class="ghost share" id="shareBtn">${tr('share.btn')}</button>
    </div>

    <div class="card">
      <div class="scoreline">
        ${ring(r.score)}
        <div class="stat"><b class="num">${pct(r.prob)}</b><span>${tr('stat.prob')}</span><em>${tr('stat.probHint')}</em></div>
        <div class="stat"><b>${r.confidence ? tr(`conf.${r.confidence.level}`) : '—'}</b><span>${tr('stat.conf')}</span><em>${r.confidence ? tr('stat.spread', { n: r.confidence.spread }) : ''}</em></div>
      </div>
      <p class="headline">${esc(tr(r.label))} · ${esc(tr(r.headline))}</p>
    </div>

    <div class="card">
      <h3>${esc(tr('card.when', { day: lang === 'en' ? dayWord.toLowerCase() : dayWord }))}</h3>
      <div class="tl"><div class="tl-bar"></div>
        <div class="tl-peak" style="left:${pos(tm.peakStart)};width:calc(${pos(tm.peakEnd)} - ${pos(tm.peakStart)})" title="${tr('tl.peakTitle')}"></div></div>
      <div class="tl-ticks num">
        <div><b>${tb(tm.arrive)}</b>${tr('tl.arrive')}</div>
        <div><b>${tb(sun.sunset)}</b>${tr('tl.sunset')}</div>
        <div><b>${tb(tm.peakStart)}</b>${tr('tl.peakUntil', { t: t(tm.peakEnd) })}</div>
        <div><b>${tb(sun.dusk)}</b>${tr('tl.dusk')}</div>
      </div>
      <p class="tl-note">${esc(note)}</p>
    </div>

    <div class="card">
      <h3>${tr('card.why')}</h3>
      <ul class="reasons">${r.reasons.map((x) => `<li class="${x.tone}">${esc(tr(x.id, x.vars))}</li>`).join('') || `<li>${tr('why.none')}</li>`}</ul>
    </div>

    <div class="card">
      <h3>${tr('card.dir')}</h3>
      <div class="dir">
        ${compassSvg(sun.azimuth, s.view)}
        <div>
          <p><b>${tr('dir.face', { dir: compass(sun.azimuth), en: compassEn(sun.azimuth), az: Math.round(sun.azimuth) })}</b></p>
          <p style="color:var(--ink-2)">${tr(r.ocean ? 'dir.ocean' : 'dir.land')}${lang === 'en' ? ' ' : ''}${tr('dir.sector')}</p>
          ${r.aboveFog ? `<p style="color:var(--good)">${tr('dir.aboveFog', { m: r.mlTop })}</p>` : ''}
        </div>
      </div>
      <div class="profile" style="margin-top:12px">
        ${profileSvg(r.profile)}
        <p class="cap">${tr('profile.cap')}</p>
      </div>
    </div>

    <div class="card">
      <h3>${tr('card.factors')}</h3>
      <div class="factors">
        ${factorRow(tr('f.canvas'), f.canvasQ, tr('f.canvasHint'))}
        ${factorRow(tr('f.light'), f.light, tr('f.lightHint'))}
        ${factorRow(tr('f.local'), f.local, tr('f.localHint'))}
        ${factorRow(tr('f.clarity'), f.clarity, tr('f.clarityHint'))}
      </div>
      <p class="factor-note num">${tr('f.note', { cv: pct(f.cv), h: pct(f.high), m: pct(f.mid), fl: pct(f.farLow), fog: fogText, aod: r.aod == null ? tr('f.missing') : r.aod.toFixed(2), vis: f.vis != null ? tr('f.vis', { km: (f.vis / 1000).toFixed(0) }) : '' })}</p>
    </div>

    <div class="card">
      <h3>${tr('card.models')}</h3>
      <div class="models">
        ${r.members.map((m) => `<div class="mrow"><span>${m.name}</span>${m.score == null ? `<span class="na">${tr('models.na')}</span>` : `<div class="mtrack"><span class="mdot" style="left:${m.score}%;background:${tone(m.score)}"></span></div>`}<span class="num">${m.score ?? ''}</span></div>`).join('')}
      </div>
      <p class="factor-note">${esc(tr('models.note', { region: regionLabel(reg) }))}</p>
    </div>

    ${near.length ? `<div class="card">
      <h3>${tr('card.near')}</h3>
      <ul class="near">${near.map(({ o, d, r: nr }) => `<li data-id="${o.id}">${badge(nr.score, false)}
        <div style="min-width:0"><div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${main(o)}${alt(o)}</div><small>${esc(tr(nr.headline))}</small></div>
        <div style="text-align:right;font-size:12px;color:var(--ink-3)" class="num">${nr.score >= (r.score ?? 0) + 10 && nr.score >= 35 ? `<div class="better">${tr('near.better')}</div>` : ''}${Math.round(d)} km<br>${pct(nr.prob)}</div></li>`).join('')}</ul>
      <p class="factor-note">${tr('near.note')}</p>
    </div>` : ''}

    <div class="card">
      <h3>${tr('card.region')}</h3>
      <p class="region-note"><b>${esc(regionParen(reg))}${lang === 'en' ? ': ' : '：'}</b>${tr(`note.${reg.id}`)}</p>
      ${r.warnings?.length ? `<ul class="warns" style="margin-top:8px">${r.warnings.map((w) => `<li>${esc(tr(w.id, w.vars))}</li>`).join('')}</ul>` : ''}
      <p class="factor-note">${tr('region.disclaimer')}</p>
    </div>
  `;
}

function openSpot(id, { pan = true } = {}) {
  state.selected = id;
  const idx = SPOTS.findIndex((s) => s.id === id);
  if (idx < 0 || state.loading) return;
  renderSheet();
  $('#sheet').hidden = false; $('#scrim').hidden = false;
  $('#sheet').scrollTop = 0;
  document.body.style.overflow = matchMedia('(min-width: 960px)').matches ? '' : 'hidden';
  history.replaceState(null, '', `#s=${id}&d=${state.day}`);
  renderMarkers(); renderList();
  if (pan) drawRay(SPOTS[idx], idx);
  $('#closeSheet')?.focus({ preventScroll: true });
}
function closeSheet() {
  state.selected = null;
  $('#sheet').hidden = true; $('#scrim').hidden = true; document.body.style.overflow = '';
  history.replaceState(null, '', location.pathname + location.search);
  if (rayLayer) { rayLayer.remove(); rayLayer = null; }
  renderMarkers(); renderList();
}

// ---------- search ----------
function renderSuggest() {
  const q = state.query.trim().toLowerCase();
  const ul = $('#suggest');
  if (!q) { ul.hidden = true; return; }
  const hits = SPOTS.map((s, i) => ({ s, i })).filter(({ s }) => [s.name, s.en, REGION_BY_ID[s.region].name, REGION_BY_ID[s.region].en].some((x) => x.toLowerCase().includes(q))).slice(0, 8);
  if (!hits.length) { ul.hidden = true; return; }
  ul.innerHTML = hits.map(({ s, i }, k) => {
    const r = state.results[state.day][i];
    return `<li data-id="${s.id}" role="option" aria-selected="${k === 0}"><span>${main(s)} <small>${esc(placeName(s).alt)}</small></span><small class="num">${r?.score ?? ''}</small></li>`;
  }).join('');
  ul.hidden = false;
}

// ---------- events ----------
function bind() {
  $('#daySeg').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    state.day = +b.dataset.day; renderAll();
    if (state.selected) { const i = SPOTS.findIndex((s) => s.id === state.selected); drawRay(SPOTS[i], i); history.replaceState(null, '', `#s=${state.selected}&d=${state.day}`); }
  });
  $('#regionChips').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    state.region = b.dataset.region; renderChips(); renderAnswer(); renderList(); renderMarkers();
    if (map && !state.selected) {
      const pts = SPOTS.filter(matchesFilter).map((s) => [s.lat, s.lon]);
      if (pts.length) map.flyToBounds(pts, { padding: [30, 30], duration: 0.5, maxZoom: 9 });
    }
  });
  $('#sort').addEventListener('change', (e) => {
    state.sort = e.target.value;
    if (state.sort === 'dist' && !state.userLoc) locate(); else renderList();
  });
  const search = $('#search');
  search.addEventListener('input', () => { state.query = search.value; renderSuggest(); renderList(); renderMarkers(); });
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { const li = $('#suggest li'); if (li) { pick(li.dataset.id); } }
    if (e.key === 'Escape') { $('#suggest').hidden = true; }
  });
  search.addEventListener('blur', () => setTimeout(() => { $('#suggest').hidden = true; }, 150));
  $('#suggest').addEventListener('mousedown', (e) => { const li = e.target.closest('li'); if (li) { e.preventDefault(); pick(li.dataset.id); } });
  function pick(id) { search.value = ''; state.query = ''; $('#suggest').hidden = true; renderList(); renderMarkers(); openSpot(id); search.blur(); }

  const openFrom = (e) => { const el = e.target.closest('[data-id]'); if (el) openSpot(el.dataset.id); };
  $('#spotList').addEventListener('click', openFrom);
  $('#spotList').addEventListener('keydown', (e) => { if (e.key === 'Enter') openFrom(e); });
  $('#answer').addEventListener('click', (e) => {
    if (e.target.closest('#goTomorrow')) { state.day = 1; renderAll(); return; }
    openFrom(e);
  });
  $('#answer').addEventListener('keydown', (e) => { if (e.key === 'Enter') openFrom(e); });
  $('#sheetBody').addEventListener('click', (e) => {
    if (e.target.closest('#closeSheet')) return closeSheet();
    if (e.target.closest('#shareBtn')) return share();
    const li = e.target.closest('.near li'); if (li) openSpot(li.dataset.id);
  });
  $('#scrim').addEventListener('click', closeSheet);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.selected) closeSheet(); });
  $('#status').addEventListener('click', (e) => { if (e.target.id === 'refresh') { e.preventDefault(); load(true); } });
  $('#methodBtn').addEventListener('click', () => $('#methodDlg').showModal());
  $('#langBtn').addEventListener('click', () => switchLang(lang === 'en' ? 'zh' : 'en'));
  window.addEventListener('hashchange', () => {
    const h = new URLSearchParams(location.hash.slice(1));
    const id = h.get('s');
    if (!id || id === state.selected || state.loading) return;
    if (h.get('d') != null) state.day = +h.get('d') === 1 ? 1 : 0;
    renderAll(); openSpot(id);
  });
}

async function share() {
  const url = location.href;
  const s = SPOTS.find((x) => x.id === state.selected);
  try {
    const pn = placeName(s);
    if (navigator.share) await navigator.share({ title: tr('share.title', { name: `${pn.main} ${pn.alt}` }), url });
    else { await navigator.clipboard.writeText(url); $('#shareBtn').textContent = tr('share.copied'); }
  } catch {}
}

function locate() {
  if (!navigator.geolocation) { renderStatus(` · <span class="warn">${tr('status.geoUnsupported')}</span>`); return; }
  renderStatus(` · ${tr('status.locating')}`);
  navigator.geolocation.getCurrentPosition(
    (p) => { state.userLoc = { lat: p.coords.latitude, lon: p.coords.longitude }; renderStatus(); renderList(); },
    () => { renderStatus(` · <span class="warn">${tr('status.geoFailed')}</span>`); state.sort = 'score'; $('#sort').value = 'score'; renderList(); },
    { timeout: 10000, maximumAge: 600000 },
  );
}

// ---------- load ----------
let retryTimer = null;
async function load(force = false) {
  clearTimeout(retryTimer);
  const hadData = !!state.data;
  state.loading = true; state.progress = null;
  renderStatus();
  if (!hadData) { renderAnswer(); renderList(); } // a refresh keeps showing the current forecast meanwhile
  try {
    const az = Object.fromEntries(SPOTS.map((s, i) => [s.id, state.suns[0][i].azimuth]));
    const data = await loadData(SPOTS, az, state.dates[0], {
      force, onProgress: (done, total) => { state.progress = [done, total]; if (state.loading) renderStatus(); },
    });
    // A stale fallback must not replace the (newer) forecast already on screen.
    if (!(data.stale && hadData)) { state.data = data; compute(); }
    state.loading = false;
    renderAll();
    if (data.stale) {
      renderStatus(` · <span class="warn">${tr('status.autoRetry')}</span>`);
      retryTimer = setTimeout(() => load(true), 60000);
    }
    const h = new URLSearchParams(location.hash.slice(1));
    if (h.get('s') && !state.selected) { if (h.get('d') != null) state.day = +h.get('d') === 1 ? 1 : 0; renderAll(); openSpot(h.get('s')); }
  } catch (e) {
    state.loading = false;
    if (hadData) {
      renderStatus(` · <span class="warn">${esc(tr('status.refreshFail', { e: errorText(e.errors || [e.message]) }))}</span>`);
      return;
    }
    $('#answer').innerHTML = `<div class="coast-note"><b>${tr('fail.title')}</b> ${tr('fail.body', { link: `<a href="#" id="retry">${tr('fail.link')}</a>` })}<br><small style="color:var(--ink-3)">${esc(errorText(e.errors || [e.message]))}</small></div>`;
    $('#retry')?.addEventListener('click', (ev) => { ev.preventDefault(); load(true); });
    $('#spotList').innerHTML = '';
    $('#status').innerHTML = '';
    retryTimer = setTimeout(() => load(true), 30000);
  }
}

setLang(detectLang());
applyStatic();
initDates();
renderDaySeg(); renderChips();
initMap();
bind();
load();
