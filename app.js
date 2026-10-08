import { SPOTS, REGIONS, REGION_BY_ID } from './spots.js';
import { sunsetInfo, compass, compassEn } from './sun.js';
import { loadData, buildInputs, laDate, addDays, distanceKm, destPoint } from './data.js';
import { forecast, MODELS, PATH_KM } from './model.js';

const TZ = 'America/Los_Angeles';
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtTime = new Intl.DateTimeFormat('zh-CN', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const fmtDay = new Intl.DateTimeFormat('zh-CN', { timeZone: TZ, month: 'numeric', day: 'numeric', weekday: 'short' });
const t = (ms) => fmtTime.format(new Date(ms));
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
    const [y, m, dd] = d.split('-').map(Number);
    const lab = fmtDay.format(new Date(Date.UTC(y, m - 1, dd, 20)));
    return `<button role="tab" data-day="${i}" aria-selected="${state.day === i}">${i ? '明天' : '今天'} <span class="num" style="opacity:.7;font-size:12px">${lab}</span></button>`;
  }).join('');
}

function renderChips() {
  const items = [{ id: 'all', name: '全海岸' }, ...REGIONS];
  $('#regionChips').innerHTML = items.map((r) => `<button role="tab" data-region="${r.id}" aria-selected="${state.region === r.id}">${r.name}<span class="en">${r.en || 'All Coast'}</span></button>`).join('');
}

// ---------- map ----------
let map, markers = {}, rayLayer;
function initMap() {
  if (!window.L) { $('#map').innerHTML = '<p class="empty">地图加载失败，可用下方列表浏览。</p>'; return; }
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
    if (!markers[s.id]) {
      markers[s.id] = L.marker([s.lat, s.lon], { icon, keyboard: true, title: `${s.name} ${s.en}` })
        .addTo(map).on('click', () => openSpot(s.id))
        .bindTooltip(`${esc(s.name)}<br><small>${esc(s.en)}</small>`, { direction: 'top', offset: [0, -14] });
    } else markers[s.id].setIcon(icon);
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
    }).bindTooltip(`${km} km · 低云 ${pct(low)}`, { direction: 'top' }).addTo(group);
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
  const lab = score >= 80 ? '火烧云' : score >= 65 ? '值得去' : score >= 45 ? '不错' : score >= 25 ? '一般' : '平淡';
  return `<div class="badge num" style="background:${tone(score)}"><div>${score}${small ? `<small>${lab}</small>` : ''}</div></div>`;
}

function renderList() {
  if (state.loading) {
    $('#spotList').innerHTML = Array.from({ length: 6 }, () => '<li class="sk" style="height:66px"></li>').join('');
    return;
  }
  const list = rows();
  if (!list.length) { $('#spotList').innerHTML = `<li class="empty">没有匹配“${esc(state.query)}”的地点</li>`; return; }
  $('#spotList').innerHTML = list.map(({ s, r }) => {
    const reg = `${REGION_BY_ID[s.region].name} ${REGION_BY_ID[s.region].en}`;
    const dist = state.userLoc ? ` · ${Math.round(distanceKm(state.userLoc, s))} km` : '';
    const past = state.day === 0 && Date.now() > r.sun.dusk;
    return `<li class="spot ${state.selected === s.id ? 'active' : ''} ${past ? 'past' : ''}" data-id="${s.id}" tabindex="0">
      ${badge(r.score)}
      <div style="min-width:0">
        <div class="nm">${esc(s.name)}<span class="en">${esc(s.en)}</span></div>
        <div class="meta num">${reg} · ${past ? '今日已结束' : `日落 ${t(r.sun.sunset)}`} · ${compass(r.sun.azimuth)}${dist}</div>
        <div class="hl">${esc(r.headline)}</div>
      </div>
      <div class="right num">${r.prob == null ? '' : `<b>${pct(r.prob)}</b>概率`}</div>
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
  if (!inScope.length) { el.innerHTML = '<div class="coast-note">所选范围暂时没有可用预测数据。</div>'; return; }
  if (!pool.length) {
    el.innerHTML = `<div class="hero dull"><div class="eyebrow">今天</div><h2>这一带今天的日落已经结束</h2>
      <p class="why">看看明天哪里值得去。</p><div class="over"><button id="goTomorrow">看明天的预测</button></div></div>`;
    return;
  }
  // Rank by expected value: a high score that probably won't happen should not beat a solid, likely one.
  const rank = ({ r }) => r.score * (0.6 + 0.8 * r.prob);
  pool.sort((a, b) => rank(b) - rank(a));
  const best = pool[0];
  const dull = best.r.score < 35;
  const dayWord = state.day ? '明天' : '今天';
  let countdown = '';
  if (state.day === 0 && best.r.timing.arrive > now) {
    const m = Math.round((best.r.timing.arrive - now) / 60000);
    countdown = m >= 60 ? `距建议到达还有 ${Math.floor(m / 60)} 小时 ${m % 60} 分` : `距建议到达还有 ${m} 分钟`;
  } else if (state.day === 0 && best.r.sun.dusk > now) countdown = '晚霞时段进行中';
  const scope = state.region === 'all' ? '全加州海岸' : `${REGION_BY_ID[state.region].name}（${REGION_BY_ID[state.region].en}）`;
  const good = best.r.reasons.filter((x) => x.tone === 'good').slice(0, 1).map((x) => x.text)[0];
  el.innerHTML = `
    <div class="hero ${dull ? 'dull' : ''}" data-id="${best.s.id}" tabindex="0" role="button" aria-label="查看 ${esc(best.s.name)} 详情">
      <div class="eyebrow">${dull ? `${dayWord}${scope}晚霞机会都不大 · 相对最好的是` : `${dayWord}${scope}最值得去`}</div>
      <h2>${esc(best.s.name)}</h2>
      <div class="eyebrow">${esc(best.s.en)} · ${REGION_BY_ID[best.s.region].name} ${REGION_BY_ID[best.s.region].en}</div>
      <p class="why">${esc(best.r.headline)}${good && !dull ? `。${esc(good)}` : ''}</p>
      <div class="kpis num">
        <div class="kpi"><b>${best.r.score}</b><span>观赏评分</span></div>
        <div class="kpi"><b>${pct(best.r.prob)}</b><span>发生概率 · ${best.r.confidence.level}置信</span></div>
        <div class="kpi"><b>${t(best.r.timing.arrive)}</b><span>建议到达</span></div>
        <div class="kpi"><b>${t(best.r.sun.sunset)}</b><span>日落 · ${compass(best.r.sun.azimuth)}</span></div>
      </div>
      ${countdown ? `<div class="eyebrow" style="margin-top:10px">${countdown}</div>` : ''}
    </div>
    ${state.region === 'all' ? `<div class="region-best">${REGIONS.map((reg) => {
      const p = pool.filter((x) => x.s.region === reg.id);
      if (!p.length) return '';
      const b = p[0];
      return `<button class="rb" data-id="${b.s.id}">
        <div class="r">${reg.name}最佳 · ${reg.en}</div>
        <div class="n">${esc(b.s.name)}</div>
        <div class="ne">${esc(b.s.en)}</div>
        <div class="m num"><span class="badge" style="width:auto;height:auto;padding:1px 6px;border-radius:6px;font-size:12px;background:${tone(b.r.score)}">${b.r.score}</span>${pct(b.r.prob)} · ${t(b.r.timing.arrive)} 到</div>
      </button>`;
    }).join('')}</div>` : `<div class="coast-note"><b>${REGION_BY_ID[state.region].name}（${REGION_BY_ID[state.region].en}）气候特点：</b>${REGION_BY_ID[state.region].note}</div>`}
  `;
}

function renderStatus(extra = '') {
  const d = state.data;
  let html = '';
  if (state.loading) html = '正在获取 5 个气象模型、海洋层结构和空气质量数据…';
  else if (d) {
    html = `数据更新于 ${t(d.at)}${d.fromCache ? '（缓存）' : ''} · <a href="#" id="refresh">刷新</a>`;
    if (d.errors?.length) html += ` · <span class="warn">部分数据获取失败：${esc(d.errors.join('；'))}</span>`;
  }
  if (state.todayOver && state.day === 1) html = `今天的日落已经结束，显示明天的预测。 ${html}`;
  $('#status').innerHTML = html + extra;
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
    <div class="v"><b class="num">${score ?? '—'}</b><span>观赏评分</span></div></div>`;
}

function compassSvg(az, view) {
  const cx = 60, cy = 60, R = 46;
  const pt = (a, r) => [cx + r * Math.sin((a * Math.PI) / 180), cy - r * Math.cos((a * Math.PI) / 180)];
  const [f, to] = view;
  const span = ((to - f + 360) % 360);
  const [x1, y1] = pt(f, R), [x2, y2] = pt(to, R);
  const [sx, sy] = pt(az, R - 4);
  return `<svg viewBox="0 0 120 120" width="120" height="120" role="img" aria-label="日落方位 ${Math.round(az)} 度">
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
  const labels = PATH_KM.map((km, k) => `<text x="${xs[k]}" y="${H - 6}" text-anchor="middle">${km === 0 ? '你' : km + 'km'}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="日落方向云层剖面">
    <text x="2" y="34">高云</text><text x="2" y="67">中云</text><text x="2" y="${(92 + yb) / 2 + 3}">低云</text>
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
  const dayWord = state.day ? '明天' : '今天';
  // timeline geometry: arrive → dusk+10
  const t0 = tm.arrive, t1 = tm.dusk + 10 * 60000, span = t1 - t0;
  const pos = (x) => `${Math.max(0, Math.min(100, ((x - t0) / span) * 100)).toFixed(1)}%`;
  const near = SPOTS.map((o, i) => ({ o, i, d: distanceKm(s, o), r: state.results[state.day][i] }))
    .filter((x) => x.o.id !== s.id && x.d <= 110 && x.r.score != null).sort((a, b) => b.r.score - a.r.score).slice(0, 6);
  const f = r.factors || {};
  const factorRow = (name, v, note) => `<div class="factor"><span>${name}</span><div class="bar"><i style="width:${Math.round((v ?? 0) * 100)}%;background:${(v ?? 0) >= 0.8 ? 'var(--good)' : (v ?? 0) >= 0.55 ? 'var(--neutral)' : 'var(--bad)'}"></i></div><span class="num" title="${note}">${v == null ? '—' : Math.round(v * 100)}</span></div>`;

  $('#sheetBody').innerHTML = `
    <div class="sheet-top">
      <button class="x" id="closeSheet" aria-label="关闭">✕</button>
      <div style="min-width:0"><h2 id="sheetTitle">${esc(s.name)}</h2><p>${esc(s.en)} · ${reg.name} ${reg.en} · 海拔约 ${s.elev} m</p></div>
      <button class="ghost share" id="shareBtn">分享</button>
    </div>

    <div class="card">
      <div class="scoreline">
        ${ring(r.score)}
        <div class="stat"><b class="num">${pct(r.prob)}</b><span>发生概率</span><em>出现明显晚霞（≥55 分）的可能</em></div>
        <div class="stat"><b>${r.confidence?.level ?? '—'}</b><span>置信度</span><em>${r.confidence ? `模型分歧 ±${r.confidence.spread} 分` : ''}</em></div>
      </div>
      <p class="headline">${esc(r.label)} · ${esc(r.headline)}</p>
    </div>

    <div class="card">
      <h3>${dayWord}几点到</h3>
      <div class="tl"><div class="tl-bar"></div>
        <div class="tl-peak" style="left:${pos(tm.peakStart)};width:calc(${pos(tm.peakEnd)} - ${pos(tm.peakStart)})" title="最佳观赏"></div></div>
      <div class="tl-ticks num">
        <div><b>${t(tm.arrive)}</b>建议到达</div>
        <div><b>${t(sun.sunset)}</b>日落</div>
        <div><b>${t(tm.peakStart)}</b>最佳至 ${t(tm.peakEnd)}</div>
        <div><b>${t(sun.dusk)}</b>天黑（民用昏影）</div>
      </div>
      <p class="tl-note">${esc(tm.peakNote)}${s.hike ? ' 这里需要上山或步行，已提前 45 分钟。' : ''}${sun.elevationGainMin >= 1 ? ` 因海拔较高，日落比海边晚约 ${sun.elevationGainMin} 分钟。` : ''}</p>
    </div>

    <div class="card">
      <h3>为什么</h3>
      <ul class="reasons">${r.reasons.map((x) => `<li class="${x.tone}">${esc(x.text)}</li>`).join('') || '<li>暂无足够数据给出理由。</li>'}</ul>
    </div>

    <div class="card">
      <h3>看哪个方向</h3>
      <div class="dir">
        ${compassSvg(sun.azimuth, s.view)}
        <div>
          <p><b>面朝${compass(sun.azimuth)}（${compassEn(sun.azimuth)} ${Math.round(sun.azimuth)}°）</b></p>
          <p style="color:var(--ink-2)">${r.ocean ? '太阳落入开阔海平线。' : '日落点在陆地或山体后，太阳会比海平线日落更早消失。'}蓝色扇区为开阔海面方向。</p>
          ${r.aboveFog ? `<p style="color:var(--good)">预计雾层顶约 ${r.mlTop} m，你在雾层之上。</p>` : ''}
        </div>
      </div>
      <div class="profile" style="margin-top:12px">
        ${profileSvg(r.profile)}
        <p class="cap">沿日落方向的云层剖面（多模型加权）：颜色越实，云越多。晚霞需要“近处有中高云、远处低云少”。虚线框表示无数据。</p>
      </div>
    </div>

    <div class="card">
      <h3>评分构成</h3>
      <div class="factors">
        ${factorRow('云层画布', f.canvasQ, '中高云覆盖')}
        ${factorRow('光路通畅', f.light, '远海低云')}
        ${factorRow('本地遮挡', f.local, '海雾/低云/能见度')}
        ${factorRow('空气透明', f.clarity, 'AOD')}
      </div>
      <p class="factor-note num">中高云 ${pct(f.cv)}（高云 ${pct(f.high)} · 中云 ${pct(f.mid)}）· 远海低云 ${pct(f.farLow)} · ${r.aboveFog ? '雾上观景' : `海雾风险 ${pct(r.fogRisk)}`} · AOD ${r.aod == null ? '缺失' : r.aod.toFixed(2)}${f.vis != null ? ` · 能见度 ${(f.vis / 1000).toFixed(0)} km` : ''}</p>
    </div>

    <div class="card">
      <h3>各模型怎么看</h3>
      <div class="models">
        ${r.members.map((m) => `<div class="mrow"><span>${m.name}</span>${m.score == null ? '<span class="na">无数据</span>' : `<div class="mtrack"><span class="mdot" style="left:${m.score}%;background:${tone(m.score)}"></span></div>`}<span class="num">${m.score ?? ''}</span></div>`).join('')}
      </div>
      <p class="factor-note">观赏评分是各模型的加权平均；概率看有几个模型达到“明显晚霞”，再按时效和${reg.name}的气候基准收缩。HRRR 分辨率 3 km，最擅长海雾，但只覆盖约 48 小时。</p>
    </div>

    ${near.length ? `<div class="card">
      <h3>附近 110 km 内比较</h3>
      <ul class="near">${near.map(({ o, d, r: nr }) => `<li data-id="${o.id}">${badge(nr.score, false)}
        <div style="min-width:0"><div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(o.name)}<span class="en">${esc(o.en)}</span></div><small>${esc(nr.headline)}</small></div>
        <div style="text-align:right;font-size:12px;color:var(--ink-3)" class="num">${nr.score >= (r.score ?? 0) + 10 && nr.score >= 35 ? '<div class="better">更好</div>' : ''}${Math.round(d)} km<br>${pct(nr.prob)}</div></li>`).join('')}</ul>
      <p class="factor-note">距离为直线距离，实际车程请以导航为准。</p>
    </div>` : ''}

    <div class="card">
      <h3>地区气候与数据说明</h3>
      <p class="region-note"><b>${reg.name}（${reg.en}）：</b>${reg.note}</p>
      ${r.warnings?.length ? `<ul class="warns" style="margin-top:8px">${r.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
      <p class="factor-note">评分与概率均为实验性估计，尚未用实际观测校准。出发前可再刷新一次，或查看实时卫星云图。</p>
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
    return `<li data-id="${s.id}" role="option" aria-selected="${k === 0}"><span>${esc(s.name)} <small>${esc(s.en)}</small></span><small class="num">${r?.score ?? ''}</small></li>`;
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
    if (navigator.share) await navigator.share({ title: `${s.name} ${s.en} 晚霞预报`, url });
    else { await navigator.clipboard.writeText(url); $('#shareBtn').textContent = '已复制链接'; }
  } catch {}
}

function locate() {
  if (!navigator.geolocation) { renderStatus(' · <span class="warn">浏览器不支持定位</span>'); return; }
  renderStatus(' · 正在定位…');
  navigator.geolocation.getCurrentPosition(
    (p) => { state.userLoc = { lat: p.coords.latitude, lon: p.coords.longitude }; renderStatus(); renderList(); },
    () => { renderStatus(' · <span class="warn">无法获取位置，已按评分排序</span>'); state.sort = 'score'; $('#sort').value = 'score'; renderList(); },
    { timeout: 10000, maximumAge: 600000 },
  );
}

// ---------- load ----------
async function load(force = false) {
  state.loading = true; renderStatus(); renderAnswer(); renderList();
  try {
    const az = Object.fromEntries(SPOTS.map((s, i) => [s.id, state.suns[0][i].azimuth]));
    state.data = await loadData(SPOTS, az, state.dates[0], { force });
    compute();
    state.loading = false;
    renderAll();
    const h = new URLSearchParams(location.hash.slice(1));
    if (h.get('s') && !state.selected) { if (h.get('d') != null) state.day = +h.get('d') === 1 ? 1 : 0; renderAll(); openSpot(h.get('s')); }
  } catch (e) {
    state.loading = false;
    $('#answer').innerHTML = `<div class="coast-note"><b>无法获取气象数据。</b>${esc(e.message)}<br>可能是网络问题或 Open-Meteo 免费接口的调用频率限制，请稍后 <a href="#" id="retry">重试</a>。</div>`;
    $('#retry')?.addEventListener('click', (ev) => { ev.preventDefault(); load(true); });
    $('#spotList').innerHTML = '';
    $('#status').innerHTML = '';
  }
}

initDates();
renderDaySeg(); renderChips();
initMap();
bind();
load();
