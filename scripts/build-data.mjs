// Prebuild data.json for the site (run hourly by .github/workflows/pages.yml).
// Uses exactly the same fetch code as the browser, so the page can use the file as-is.
import { writeFile } from 'node:fs/promises';
import { SPOTS } from '../spots.js';
import { sunsetInfo } from '../sun.js';
import { fetchAll, laDate, detectBrokenModels } from '../data.js';

const out = process.argv[2] || 'data.json';
const startDate = laDate(Date.now());
const azimuths = Object.fromEntries(SPOTS.map((s) => [s.id, sunsetInfo(startDate, s.lat, s.lon, s.elev).azimuth]));

const t0 = Date.now();
// Runs in the background, so be patient: Open-Meteo can take minutes under load from shared runner IPs.
const data = await fetchAll(SPOTS, azimuths, startDate, {
  onProgress: (done, total) => console.log(`requests ${done}/${total}`),
  net: { timeout: 150000, retries: 4 },
});
const json = JSON.stringify({ version: 1, at: Date.now(), data });
const broken = detectBrokenModels(data);
// Visible in the Actions log; the page runs the same check and excludes these models itself.
if (broken.length) console.log(`WARNING: model data looks broken, excluded by the page: ${broken.map((b) => b.name).join(', ')}`);
await writeFile(out, json);
console.log(`wrote ${out}: ${(json.length / 1024).toFixed(0)} KB, ${data.pathKeys.length} path points, ` +
  `${((Date.now() - t0) / 1000).toFixed(1)} s, errors: ${data.errors.length ? data.errors.map((e) => `${e.layer} ${e.failed}/${e.total} (${e.reason})`).join('; ') : 'none'}`);
