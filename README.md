# California Coast Sunset Forecast

**English** · [中文](README.zh-CN.md)

**Live site: https://runwang06.github.io/ca-sunset/**

A sunset and afterglow forecast for the entire California coast: 58 cities, beaches and viewpoints from Crescent City to Coronado. Sunsets only. It answers three questions: **where is worth going today or tomorrow, when to arrive, and why**.

A fully static site with no backend and no API keys. Anonymous visit counts go to GoatCounter (see below). Weather data is fetched once an hour by GitHub Actions and deployed to GitHub Pages together with the site (see "How data reaches the browser" below).

## Run locally

```bash
python3 serve.py
```

Then open http://127.0.0.1:8765. The test page is at http://127.0.0.1:8765/tests.html; its title shows PASS or FAIL.

`serve.py` is `http.server` with caching turned off, for debugging. It always serves the folder it lives in, wherever you launch it from. The page uses ES modules, so it can't be opened directly via `file://`.

Without a local `data.json`, the page calls Open-Meteo directly. You can also generate one first with Node.js: `node scripts/build-data.mjs data.json` (the file is git-ignored).

## Deployment and updates

GitHub Actions deploys the site to GitHub Pages (`.github/workflows/pages.yml`).

Commit and push your changes. GitHub Actions refetches the data and redeploys, and the live site updates in about 2 minutes:

```bash
git add -A && git commit -m "update" && git push
```

## How data reaches the browser

Open-Meteo's free API is rate-limited per IP: about 600 calls per minute, 5,000 per hour and 10,000 per day, and requests with many variables count as several calls. One full download for the coast (58 spots plus 142 offshore sample points, × 4 models) uses roughly a whole minute's quota. If every visitor called the API directly, they would easily get throttled (HTTP 429) or time out waiting in line.

So:

1. **GitHub Actions runs every hour** (`.github/workflows/pages.yml`). It uses `scripts/build-data.mjs` to call exactly the same `fetchAll()` as the page, writes the result to `data.json`, and deploys it to Pages along with the site.
2. The browser reads its local cache first (valid for 30 minutes), then `data.json` (valid for 2.5 hours). Only when neither is available does it call Open-Meteo directly: 60 points per batch, at most 4 requests at a time, a 45-second timeout, and 2 automatic retries. After a 429 it waits 20–40 seconds before retrying.
3. If one batch fails, only the affected spots show "No data". If everything fails, the page shows the last successful download from the past 12 hours, says clearly how old it is, and retries automatically after a minute.

Note: GitHub pauses scheduled workflows after 60 days without commits to the repository. If that happens, re-enable the workflow on the repository's Actions page. Until then the page falls back to calling Open-Meteo directly.

## Bilingual (Chinese / English)

- **UI and explanations switch languages** with the **EN / 中文** button in the top-right corner. On a first visit, the language follows the browser setting: Chinese systems get Chinese, everything else gets English. After that, the visitor's choice is remembered.
- **Links can carry a language**: `?lang=en` or `?lang=zh`. Switching languages adds this to the address bar, so a shared link opens in the same language.
- **Place names are always shown in both languages.** The current language's name comes first, and the other follows on the same line or the next one.
- **All text lives in `i18n.js`**, with Chinese and English side by side. The model (`model.js`) and the data (`data.js`, `data.json`) contain no UI text. They output only "text key + numbers", and the page renders them in the current language. So switching languages never refetches data, and the cloud only needs one copy of it.
- **When you change any text, change both languages.** `tests.html` checks this automatically: both languages define the same keys, placeholders are consistent, every key used by the page and the model exists, and there are no unused entries.

## Visitor stats

Anonymous visit counts are collected with [GoatCounter](https://www.goatcounter.com/) (dashboard: https://runwang06.goatcounter.com) to see how many people actually use the site. No cookies, no accounts, no location, no personal data; GoatCounter doesn't store IP addresses. Per page view it keeps the path, referrer, browser/OS, screen size and a country derived from the IP. The same statement is shown in the page footer and in the "Method & limits" dialog, in both languages. `vendor/goatcounter/count.js` is GoatCounter's script (ISC license) served from this repo, like Leaflet. Visits from `localhost` are not counted.

## Files

| File | Purpose |
| --- | --- |
| `spots.js` | 5 climate regions (monthly fog frequency and baseline glow chance; climate notes live in `i18n.js`) and 58 spots with Chinese and English names, coordinates, elevation, open-horizon direction, and whether a hike is needed |
| `sun.js` | Sunset time, azimuth, civil dusk, and horizon dip from elevation |
| `data.js` | Fetches and caches data, generates sample points along the sunset direction, interpolates to sunset time |
| `scripts/build-data.mjs` | Run hourly by GitHub Actions to generate `data.json` |
| `model.js` | Score, chance, confidence, and the text keys for reasons and notes. Pure functions: no DOM, and no text in any language |
| `i18n.js` | All Chinese and English text, language detection and switching, language-aware time and date formatting |
| `app.js` | UI: recommendation card, best spot per region, map, ranking, detail panel, language switch |
| `tests.html` | 43 tests: the model (synthetic scenarios) and translation completeness |
| `scripts/backtest.mjs`, `backtest/` | Backtest of the weather inputs against ERA5 and airport METARs (`backtest/REPORT.md`), plus the regional HRRR-weight experiment (`backtest/REGIONAL_FOG.md`). Analysis only; not deployed |
| `vendor/leaflet/` | Leaflet 1.9.4 map library (BSD-2-Clause, see its `LICENSE`), served from this repo so the map doesn't depend on a third-party CDN |
| `vendor/goatcounter/` | GoatCounter's `count.js` (ISC license) for the anonymous visit counts above |

## Data sources

- **Weather, 4 models** (Open-Meteo `/v1/forecast`): HRRR 3 km, ECMWF IFS 0.25°, GFS 0.25°, ICON. GEM was used at first but dropped: its mid/high cloud layers from Open-Meteo were 0 at every spot and hour even when its total cloud cover was not. As a safeguard, any model whose mid/high cloud is almost always 0 while most other models clearly show cloud is now excluded automatically and flagged on the page. Variables: low/mid/high cloud cover, visibility, 2 m temperature and humidity, 925 hPa temperature, precipitation.
- **Marine-layer structure** (HRRR, with GFS as fallback): cloud cover at the 1000–900 hPa pressure levels and boundary-layer height.
- **Air quality** (CAMS global): 550 nm aerosol optical depth (AOD), PM2.5, dust.

## What changed in the method compared with the San Diego version

The earlier version used single-point data and one combined formula. Extending it to the whole coast meant handling three problems separately:

1. **The light path toward the sunset.** Afterglow is sunlight shining up onto cloud bases from below the horizon. What really matters is whether there is a low-cloud bank 75–250 km offshore toward the sun, not just whether there is cloud overhead. The new version samples cloud cover at 25/75/150/250 km along each spot's sunset azimuth: near points count as the "canvas", far points as the "light path". Far points are snapped to 0.1°, 0.25° or 0.5° grids by distance and deduplicated (58 spots → 142 sample points).
2. **Global models miss the marine layer.** Measured at SF Ocean Beach on 2026-10-07: HRRR showed 100% low cloud, all four global models showed 0%, and it was 13 °C warmer at 925 hPa than at the surface, a classic marine-layer inversion. So the new version (a) builds a fog heuristic from inversion strength × surface humidity to correct each model's low cloud, and (b) gives HRRR extra weight when judging fog risk (50% today, 30% tomorrow). San Diego uses 35% today: a backtest against airport observations showed HRRR over-forecasts sunset fog there, and the lower weight was more accurate in both halves of the test period (see `backtest/REGIONAL_FOG.md`).
3. **Regional and terrain differences.** Each spot uses its own coordinates and elevation, with its open-horizon sector annotated. Santa Cruz, Santa Barbara and Malibu face south, so in summer the sun sets behind land. Viewpoints at 100 m or higher are marked "above the fog" when they are higher than the marine-layer top estimated from HRRR pressure-level cloud cover, which means a chance of a sea-of-fog sunset. Each climate region has its own monthly fog frequency and baseline glow chance.

## Scoring

Each model is scored separately:

```
score = 100 × canvas × light path × local view × air clarity × horizon
```

- **Canvas**: mid/high cloud coverage cv = 1 − (1−high)(1−mid), weighted 0.35 at the spot, 0.4 at 25 km and 0.25 at 75 km. It is 0.22 at cv = 0 (a clean golden sunset), 1 for 45–72%, and 0.55 at 100%.
- **Light path**: block = weighted average of `low×0.8 + mid×0.3` at 75/150/250 km; light path = 1 − 1.15 × block.
- **Local view**: b = 0.8 × effective low cloud + 0.2 × low cloud at 25 km; local = 1 − 0.92 × b^1.6, then reduced for visibility and precipitation. Above the fog, local = 0.97 and canvas is at least 0.45.
- **Air clarity**: 1 for AOD ≤ 0.15, decreasing beyond that to a minimum of 0.3; 0.88 with a warning when data is missing.
- **Horizon**: 1 when the sunset azimuth is inside the open-sea sector, otherwise 0.88.

**Viewing score** = weighted average of the model scores. Weights today: HRRR 0.35, ECMWF 0.27, GFS and ICON 0.19 each. Tomorrow: HRRR 0.22, ECMWF 0.32, GFS and ICON 0.23 each.

**Chance** = P(score ≥ 55). Each model contributes sigmoid((s−55)/7). The weighted result is then shrunk toward that region's baseline for the month, by an amount that depends on lead time and the number of models available (85% kept today, 72% tomorrow). This chance is **not yet calibrated against observations**. Use it to compare spots, not as a true frequency.

**Confidence** combines: model disagreement, number of models available, lead time, whether HRRR is available, whether AOD or light-path data is missing, and whether fog risk sits in the marginal 30–70% range (the fog line is the hardest thing to forecast).

**Best window**: with little mid/high cloud, from 15 minutes before to 5 minutes after sunset. With mostly high cloud, 3–25 minutes after sunset. With mostly mid cloud, from 5 minutes before to 15 minutes after. Arrive 25 minutes early, or 45 minutes early at spots that need a hike.

## Known limitations and next steps

- Gridded cloud cover can't show cloud texture or breaks. A next step could add live GOES-West satellite imagery for nowcasting.
- Horizon sectors and elevations are hand-annotated approximations; there is no DEM line-of-sight calculation.
- At pressure-level resolution the marine-layer top is coarse (about 200 m per level); shallow fog falls back to boundary-layer height.
- The chance needs calibration: collect "did you actually see it?" feedback from users, or backtest against historical satellite imagery.
