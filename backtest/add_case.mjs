// Record a real photo / observation case together with the forecast the site had at the time.
// These cases are the only "was it actually beautiful" truth we have; the weather backtest can't
// judge beauty. Run it the same evening, while the live data.json still covers that sunset.
//
//   /opt/homebrew/bin/node backtest/add_case.mjs --id 2026-10-25-bay --date 2026-10-25 \
//     --data https://runwang06.github.io/ca-sunset/data.json --spots oceanbeach,twinpeaks,hawk \
//     --area "Berkeley / Emeryville shoreline" --lat 37.84 --lon -122.30 --dir 250 --time 18:35 \
//     --rating 80 --rated-by claude --desc "vivid pink broken mid deck" --photo IMG_xxxx.jpg
//
// --rating is the 0–100 score the evening deserved, on the site's own scale (label bands:
// 80 火烧云 / 65 值得去 / 45 不错 / 25 一般). Location is rounded to 0.01° (~1 km) because the case
// file is public. Photos stay out of git; only the file name is kept.
import { readFile, writeFile } from 'node:fs/promises';
import { SPOTS, REGION_BY_ID } from '../spots.js';
import { sunsetInfo } from '../sun.js';
import { forecast, label } from '../model.js';
import { buildInputs, detectBrokenModels } from '../data.js';
import { deckEdge, ensembleShare } from './deck_edge.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const FILE = new URL('cases.json', import.meta.url);
const src = arg('data');
const json = src.startsWith('http') ? await (await fetch(`${src}?x=${Date.now()}`)).json() : JSON.parse(await readFile(src, 'utf8'));
const data = json.data;
const date = arg('date', data.startDate);
const day = date === data.startDate ? 0 : date === new Date(Date.parse(data.startDate) + 864e5).toISOString().slice(0, 10) ? 1 : null;
if (day == null) throw new Error(`data.json starts ${data.startDate}; it has no forecast for ${date}`);
const excluded = detectBrokenModels(data);
const r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);
const cell = (c) => c && { low: r2(c.low), mid: r2(c.mid), high: r2(c.high) };

const spots = arg('spots').split(',').map((id) => {
  const i = SPOTS.findIndex((s) => s.id === id);
  if (i < 0) throw new Error(`unknown spot ${id}`);
  const s = SPOTS[i], sun = sunsetInfo(date, s.lat, s.lon, s.elev);
  const inp = buildInputs(data, i, s, sun.sunset, day, excluded);
  const f = forecast({ spot: s, sun, day, ...inp, region: REGION_BY_ID[s.region], month: +date.slice(5, 7) - 1, excluded });
  return {
    spot: id, sunset: new Date(sun.sunset).toISOString(), azimuth: Math.round(sun.azimuth),
    forecast: { score: f.score, label: f.label, prob: r2(f.prob), confidence: f.confidence.level, spread: f.confidence.spread, fogRisk: r2(f.fogRisk), aod: r2(f.aod), headline: f.headline, members: f.members.map((m) => ({ name: m.name, score: m.score })) },
    deckEdge: { ensemble: ensembleShare(inp.members), members: inp.members.map((m) => ({ name: m.name, ...deckEdge(m.path) })) },
    inputs: inp.members.map((m) => ({ name: m.name, w: m.w, path: m.path.map(cell), obs: m.path[0] && { vis: m.path[0].vis && Math.round(m.path[0].vis), t2: r2(m.path[0].t2), t925: r2(m.path[0].t925), rh: r2(m.path[0].rh) } })),
  };
});

const rating = arg('rating') != null ? +arg('rating') : null;
const entry = {
  id: arg('id'), date, area: arg('area'),
  where: { lat: +(+arg('lat')).toFixed(2), lon: +(+arg('lon')).toFixed(2), facing: arg('dir') != null ? +arg('dir') : null, time: arg('time') ?? null },
  observed: { rating, label: rating == null ? null : label(rating), ratedBy: arg('rated-by', 'user'), description: arg('desc', ''), photo: arg('photo', null) },
  data: { builtAt: new Date(json.at).toISOString(), source: src.startsWith('http') ? src : 'local data.json', day },
  spots,
};
let cases = [];
try { cases = JSON.parse(await readFile(FILE, 'utf8')); } catch {}
cases = cases.filter((c) => c.id !== entry.id).concat(entry).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
await writeFile(FILE, JSON.stringify(cases, null, 1) + '\n');
console.log(`saved ${entry.id}: ${spots.map((s) => `${s.spot} ${s.forecast.score} (deck-edge ${s.deckEdge.ensemble ? Math.round(s.deckEdge.ensemble.strict * 100) + '% / ' + Math.round(s.deckEdge.ensemble.lenient * 100) + '%' : '–'})`).join(', ')}`);
