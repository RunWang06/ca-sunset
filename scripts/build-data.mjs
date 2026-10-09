// Prebuild data.json for the site (run hourly by .github/workflows/pages.yml).
// Uses exactly the same fetch code as the browser, so the page can use the file as-is.
import { writeFile } from 'node:fs/promises';
import { SPOTS } from '../spots.js';
import { sunsetInfo } from '../sun.js';
import { fetchAll, laDate } from '../data.js';

const out = process.argv[2] || 'data.json';
const startDate = laDate(Date.now());
const azimuths = Object.fromEntries(SPOTS.map((s) => [s.id, sunsetInfo(startDate, s.lat, s.lon, s.elev).azimuth]));

const t0 = Date.now();
const data = await fetchAll(SPOTS, azimuths, startDate, {
  onProgress: (done, total) => console.log(`requests ${done}/${total}`),
});
const json = JSON.stringify({ version: 1, at: Date.now(), data });
await writeFile(out, json);
console.log(`wrote ${out}: ${(json.length / 1024).toFixed(0)} KB, ${data.pathKeys.length} path points, ` +
  `${((Date.now() - t0) / 1000).toFixed(1)} s, errors: ${data.errors.length ? data.errors.join('; ') : 'none'}`);
