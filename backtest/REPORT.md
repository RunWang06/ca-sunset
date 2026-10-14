# 天气输入回测 · Weather-input backtest

> 由 `scripts/backtest.mjs` 生成 · generated 2026-10-14T21:52Z · 2026-07-10 … 2026-10-07 · 90 个傍晚 evenings × 58 个机位 spots = 5220 样本 samples

本回测只检验**天气输入**（云、雾）准不准，不检验晚霞是否好看。
This backtest checks how good the **weather inputs** (cloud, fog) are — not whether the glow was beautiful.

## 结论 · Findings（2026-07-10 … 2026-10-07，夏末到初秋 late summer → early autumn）

**中文**

1. **雾/低云：HRRR 明显最好，ECMWF 几乎看不见海洋层。** 对 16 个沿海机场 METAR，HRRR 的 HSS 0.59（命中 88%），GFS 0.41，ICON 0.36（误报 58%），ECMWF 只有 0.16（只报出 11% 的雾）。ERA5 本身也只抓到 16% 的雾——**ERA5 不能当雾的实况**，所以第 1、4a 节里“HRRR 低云偏多 +30%”主要是 ERA5 漏雾，不是 HRRR 错。网站给 HRRR 更多雾判断权重的做法有据可依。
2. **网站在机位取的格点比机场格点差**（HRRR HSS 0.59 → 0.43），南加州/圣地亚哥最明显（0.48 → 0.11）：海滩机位的“最近格点”常落在海上，近岸层云在那里，而岸上是晴的 → 误报雾、评分偏低。这是取样问题，不是权重问题。
3. **集合比任何单个模型都好。** 对混合实况（机位低云/能见度用 METAR，其余用 ERA5）：集合 MAE 10.0 分、r 0.74；单个模型 MAE 12.4–13.5、r 0.54–0.63。即使只提前 0–6 小时，集合评分也平均差约 10 分，72% 的晚上落在同一档；网站实际提前 6–30 小时，只会更差。
4. **平均评分偏差**（对混合实况）：HRRR −12，ICON −7，集合 −4.5，GFS −1，ECMWF +5。HRRR 偏悲观来自光路低云偏多（比 ERA5 多 24%）和高云偏少（−10%）。
5. **ECMWF/GFS 的高云确实比 HRRR/ICON 多**（平均 19% vs 12%，18% 的晚上多出 ≥20 个百分点，反过来只有 2%）。但对 ERA5 而言 ECMWF 只多 +1、GFS +5，反而 HRRR 少 −10。ERA5 与 ECMWF 同源，所以**无法判定到底是谁错**——需要卫星云图才能定论。10-13 旧金山那一例（ECMWF/GFS 报很多高云、实际只有几缕）与“ECMWF/GFS 偏多”一致，但只是一例。
6. **光路低云（75–250 km）是最大的未知数：** HRRR/ICON 比 ERA5 多 18–24%，ECMWF/GFS 少 10–16%，分歧很大，ERA5 在海上远处是否可靠也未验证。
7. **提前一天：** 只能检验总云量，day-1 与 day-0 对 ERA5 的误差差别不大（±2%），说明这里主要误差来自“模型 vs 实况”的系统差异，而不是提前量；但这个检验受 ERA5 漏雾影响。

**关于 model.js 权重的建议（未修改，等你决定）：先不改。** 网格搜索最优权重最多只降 0.7 分 MAE，而且用前一半日期拟合的权重在后一半日期上反而**比现在差**（例如混合实况 8.58 → 9.04）。也就是说，现有权重已经在噪声范围内接近最优。更值得做的是：(a) 机位取样——海滩机位改用陆地格点（`cell_selection: 'land'`）或对比海/陆两个格点；(b) 用 GOES 卫星云图验证高云和光路低云；(c) 冬季再跑一次（雾少、锋面云多，结论可能不同）。如果一定要调权重，唯一稳定的信号是南加州/圣地亚哥 HRRR、ICON 偏差大，可以考虑分区域权重，但证据还不够。

**English**

1. **Fog / low cloud: HRRR is clearly best; ECMWF is nearly blind to the marine layer.** Against 16 coastal-airport METARs: HRRR HSS 0.59 (POD 88%), GFS 0.41, ICON 0.36 (FAR 58%), ECMWF 0.16 (catches 11% of fog evenings). ERA5 itself catches only 16% — **ERA5 is not usable as fog truth**, so HRRR's "+30% low cloud" vs ERA5 (sections 1, 4a) is mostly ERA5 missing fog. Giving HRRR extra say on fog is supported.
2. **The site's own grid cell is worse than the airport's cell** (HRRR HSS 0.59 → 0.43), worst in SoCal/San Diego (0.48 → 0.11): a beach spot's nearest cell is often offshore, where the stratus sits while the beach is clear → false fog, scores too low. A sampling issue, not a weighting one.
3. **The ensemble beats every single model.** Against the hybrid truth (METAR low cloud/visibility at the spot, ERA5 elsewhere): ensemble MAE 10.0 points, r 0.74; single models 12.4–13.5, r 0.54–0.63. Even at 0–6 h lead the ensemble is ~10 points off on average and in the same label band 72% of the time; the site's real 6–30 h lead can only be worse.
4. **Mean score bias** vs hybrid truth: HRRR −12, ICON −7, ensemble −4.5, GFS −1, ECMWF +5. HRRR's pessimism comes from more low cloud on the light path (+24 vs ERA5) and less high cloud (−10).
5. **ECMWF/GFS do show more high cloud than HRRR/ICON** (mean 19% vs 12%; ≥20 points more on 18% of evenings, the reverse on 2%). But vs ERA5, ECMWF is only +1 and GFS +5, while HRRR is −10. ERA5 shares ECMWF's physics, so **who is right can't be settled** without satellite data. The 10-13 SF case fits "ECMWF/GFS too much" but is one case.
6. **Light-path low cloud (75–250 km) is the biggest unknown:** HRRR/ICON +18–24% vs ERA5, ECMWF/GFS −10–16%, and ERA5 far offshore is itself unverified.
7. **Day-1 lead:** only total cloud can be tested; day-1 and day-0 errors vs ERA5 differ by ~2%, so model-vs-truth systematic differences dominate over lead time here — though ERA5's missing fog clouds this test.

**Recommendation on weights in model.js (not changed — your call): leave them for now.** A grid search finds at most 0.7 points of MAE to gain, and weights fit on the first half of the dates do **worse than the current ones** on the second half (e.g. hybrid truth 8.58 → 9.04). The current weights are already within noise of optimal. Better next steps: (a) spot sampling — use the land cell (`cell_selection: 'land'`) for beach spots or compare sea vs land cells; (b) verify high cloud and light-path low cloud with GOES satellite cloud products; (c) rerun in winter (less fog, more frontal cloud). If weights must change, the only consistent signal is larger HRRR/ICON error in SoCal/San Diego, which could justify regional weights — but the evidence is thin.

## 方法 · Method

- **预报 Forecast**：Open-Meteo Historical Forecast API，4 个模型（HRRR、ECMWF IFS 0.25°、GFS、ICON），变量与网站完全相同，用 `data.js` 的 `buildInputs()` 取日落前后 ±30 分钟的加权值，再用 `model.js` 打分。该 API 把**每次运行的最初几个小时**拼接成连续序列，所以提前量只有约 0–6 小时（HRRR 每小时更新，约 0–1 h；全球模式约 0–6 h）。网站实际用的是 6–30 h 提前量，**所以这里的误差是下限**，真实预报只会更差。
  Historical Forecast API stitches the **first hours of each run**, i.e. ~0–6 h lead (HRRR ~0–1 h). The site's real lead is 6–30 h, so these errors are a **lower bound**.
- **提前一天 Day-1**：Previous Runs API 的 `_previous_day1` 只提供总云量（不分高中低），所以只能检验总云量随提前量变差多少。
  The Previous Runs API offers day-1 lead only for total cloud cover (no low/mid/high split).
- **实况 Truth**：ERA5 再分析（Open-Meteo archive，约 25 km，滞后约 5 天），同一取样代码。ERA5 分辨率粗，会**抹平沿岸海洋层**（窄条雾带常被算成 0 或被平均），且它本身是 ECMWF 系统产物，评判 ECMWF 时偏宽松。ERA5 没有能见度和 925 hPa 温度。
  ERA5 (~25 km) smooths out the narrow coastal marine layer, is produced with ECMWF's own model (lenient to ECMWF), and has no visibility / 925 hPa temperature.
- **独立雾实况 Independent fog truth**：16 个沿海机场 METAR（Iowa Environmental Mesonet）：日落 ±40 分钟内最近一报，6500 ft 以下 BKN/OVC/VV 记为“有雾/低云”。ASOS 云高仪只看到 12 000 ft 以下，所以 METAR 只能验证低云，不能验证高云。机场：CEC, EKA, O87, LLR, HAF, MRY, L52, SBA, OXR, SMO, LAX, TOA, OKB, CRQ, NZY, SAN。
  Coastal airport METARs: BKN/OVC/VV below 6500 ft at sunset = fog/low deck. ASOS ceilometers only see below 12 000 ft, so METARs verify low cloud only.
- **打分 Scoring**：两侧都用网站的 `memberScore()` / `forecast()`；AOD 设为缺失（两侧相同，清晰度为常数），不使用 profile（因此不触发“在雾上方”）。“仅云”变体去掉 ERA5 没有的能见度和 925 hPa 温度，使差异只来自云。
  Both sides use the site's own scoring; AOD missing on both sides, no profile (no above-fog case). The "cloud-only" variant drops visibility and 925 hPa temperature, which ERA5 lacks.

## 1. 机位低云 Low cloud at the spot（%，预报 − ERA5 forecast − ERA5）

| 区域 Region | HRRR 偏差/MAE bias/MAE | ECMWF 偏差/MAE bias/MAE | GFS 偏差/MAE bias/MAE | ICON 偏差/MAE bias/MAE | ERA5 均值 mean | n |
| --- | --- | --- | --- | --- | --- | --- |
| 全部 All | +30 / 32 | -4 / 9 | +11 / 19 | +22 / 27 | 11 | 5220 |
| 北海岸 North Coast | +32 / 36 | +2 / 13 | +25 / 31 | +24 / 31 | 15 | 900 |
| 湾区 Bay Area | +30 / 33 | -10 / 15 | -3 / 18 | +21 / 28 | 22 | 900 |
| 中央海岸 Central Coast | +33 / 36 | -4 / 8 | +8 / 16 | +19 / 25 | 10 | 1260 |
| 南加州 SoCal | +20 / 23 | -3 / 3 | +10 / 14 | +16 / 18 | 4 | 1350 |
| 圣地亚哥 San Diego | +38 / 39 | -5 / 5 | +18 / 23 | +35 / 37 | 6 | 810 |

## 2. 机位中高云覆盖 Mid+high coverage (canvas)（%）

| 区域 Region | HRRR 偏差/MAE bias/MAE | ECMWF 偏差/MAE bias/MAE | GFS 偏差/MAE bias/MAE | ICON 偏差/MAE bias/MAE | ERA5 均值 mean | n |
| --- | --- | --- | --- | --- | --- | --- |
| 全部 All | -9 / 11 | +3 / 9 | +5 / 11 | +4 / 10 | 18 | 5220 |
| 北海岸 North Coast | -11 / 12 | +3 / 9 | +5 / 9 | +2 / 8 | 20 | 900 |
| 湾区 Bay Area | -11 / 12 | +4 / 9 | +5 / 10 | +2 / 8 | 22 | 900 |
| 中央海岸 Central Coast | -10 / 12 | +3 / 9 | +6 / 11 | +4 / 9 | 19 | 1260 |
| 南加州 SoCal | -6 / 10 | +3 / 9 | +4 / 11 | +4 / 11 | 14 | 1350 |
| 圣地亚哥 San Diego | -6 / 11 | +3 / 10 | +4 / 13 | +6 / 14 | 17 | 810 |

### 2b. 仅高云 High cloud only（%）

| 区域 Region | HRRR 偏差/MAE bias/MAE | ECMWF 偏差/MAE bias/MAE | GFS 偏差/MAE bias/MAE | ICON 偏差/MAE bias/MAE | ERA5 均值 mean | n |
| --- | --- | --- | --- | --- | --- | --- |
| 全部 All | -10 / 11 | +1 / 9 | +5 / 10 | +1 / 8 | 16 | 5220 |
| 北海岸 North Coast | -11 / 12 | +2 / 9 | +6 / 9 | +1 / 7 | 17 | 900 |
| 湾区 Bay Area | -12 / 12 | +2 / 9 | +6 / 10 | +1 / 7 | 20 | 900 |
| 中央海岸 Central Coast | -11 / 12 | +1 / 9 | +5 / 10 | +2 / 7 | 18 | 1260 |
| 南加州 SoCal | -7 / 9 | +1 / 7 | +5 / 9 | +1 / 9 | 12 | 1350 |
| 圣地亚哥 San Diego | -9 / 11 | -0 / 10 | +4 / 12 | +3 / 10 | 14 | 810 |

## 3. 光路低云 Light-path low cloud, 75–250 km toward the sun（%）

| 区域 Region | HRRR 偏差/MAE bias/MAE | ECMWF 偏差/MAE bias/MAE | GFS 偏差/MAE bias/MAE | ICON 偏差/MAE bias/MAE | ERA5 均值 mean | n |
| --- | --- | --- | --- | --- | --- | --- |
| 全部 All | +24 / 28 | -16 / 20 | -10 / 19 | +18 / 25 | 28 | 5220 |
| 北海岸 North Coast | +17 / 24 | -16 / 21 | -17 / 24 | +23 / 28 | 35 | 900 |
| 湾区 Bay Area | +25 / 29 | -14 / 19 | -11 / 21 | +24 / 30 | 32 | 900 |
| 中央海岸 Central Coast | +22 / 28 | -29 / 31 | -19 / 26 | +16 / 25 | 43 | 1260 |
| 南加州 SoCal | +24 / 27 | -9 / 12 | -1 / 12 | +14 / 18 | 15 | 1350 |
| 圣地亚哥 San Diego | +31 / 34 | -10 / 14 | -4 / 12 | +19 / 25 | 16 | 810 |

## 4. 雾 / 低云判断 Fog vs no fog（low ≥ 50%）

### 4a. 对 ERA5（全部机位）· vs ERA5 at all spots

| 模型 Model | 准确率 Accuracy | 命中率 POD | 误报率 FAR | HSS | 实况雾/低云频率 Base rate | n |
| --- | --- | --- | --- | --- | --- | --- |
| HRRR | 68% | 85% | 83% | 0.19 | 8% | 5220 |
| ECMWF | 93% | 20% | 48% | 0.26 | 8% | 5220 |
| GFS | 81% | 58% | 78% | 0.23 | 8% | 5220 |
| ICON | 68% | 76% | 84% | 0.16 | 8% | 5220 |

按区域 By region:

| 区域 Region | HRRR 准确率/HSS acc/HSS | ECMWF 准确率/HSS acc/HSS | GFS 准确率/HSS acc/HSS | ICON 准确率/HSS acc/HSS | n |
| --- | --- | --- | --- | --- | --- |
| 全部 All | 68% / 0.19 | 93% / 0.26 | 81% / 0.23 | 68% / 0.16 | 5220 |
| 北海岸 North Coast | 64% / 0.21 | 88% / 0.36 | 69% / 0.24 | 64% / 0.16 | 900 |
| 湾区 Bay Area | 68% / 0.37 | 82% / 0.23 | 81% / 0.38 | 66% / 0.32 | 900 |
| 中央海岸 Central Coast | 62% / 0.09 | 94% / 0.06 | 86% / 0.26 | 71% / 0.14 | 1260 |
| 南加州 SoCal | 80% / 0.04 | 98% / 0.07 | 86% / 0.04 | 80% / 0.00 | 1350 |
| 圣地亚哥 San Diego | 62% / 0.07 | 97% / 0.00 | 79% / 0.08 | 53% / 0.01 | 810 |

### 4b. 对机场 METAR（独立实况）· vs airport METARs (independent)

| 模型 Model | 准确率 Accuracy | 命中率 POD | 误报率 FAR | HSS | 实况雾/低云频率 Base rate | n |
| --- | --- | --- | --- | --- | --- | --- |
| HRRR | 84% | 88% | 43% | 0.59 | 21% | 1142 |
| ECMWF | 81% | 11% | 0% | 0.16 | 21% | 1142 |
| GFS | 81% | 49% | 44% | 0.41 | 21% | 1142 |
| ICON | 73% | 71% | 58% | 0.36 | 21% | 1142 |
| ERA5 | 81% | 16% | 26% | 0.20 | 21% | 1142 |

按区域 By region:

| 区域 Region | HRRR 准确率/HSS acc/HSS | ECMWF 准确率/HSS acc/HSS | GFS 准确率/HSS acc/HSS | ICON 准确率/HSS acc/HSS | ERA5 准确率/HSS acc/HSS | n |
| --- | --- | --- | --- | --- | --- | --- |
| 全部 All | 84% / 0.59 | 81% / 0.16 | 81% / 0.41 | 73% / 0.36 | 81% / 0.20 | 1142 |
| 北海岸 North Coast | 84% / 0.67 | 64% / 0.26 | 67% / 0.33 | 77% / 0.54 | 54% / 0.04 | 171 |
| 湾区 Bay Area | 83% / 0.60 | 42% / 0.07 | 77% / 0.55 | 81% / 0.57 | 63% / 0.34 | 84 |
| 中央海岸 Central Coast | 87% / 0.74 | 57% / 0.00 | 64% / 0.28 | 77% / 0.53 | 59% / 0.06 | 90 |
| 南加州 SoCal | 90% / 0.48 | 94% / 0.00 | 89% / 0.09 | 85% / 0.20 | 93% / -0.01 | 437 |
| 圣地亚哥 San Diego | 76% / 0.34 | 89% / 0.00 | 83% / 0.03 | 55% / 0.04 | 89% / 0.13 | 360 |

### 4c. 机位所用格点 vs 附近机场 METAR · The spot's own grid cell (as the site samples it) vs the nearby airport

| 模型 Model | 准确率 Accuracy | 命中率 POD | 误报率 FAR | HSS | 实况雾/低云频率 Base rate | n |
| --- | --- | --- | --- | --- | --- | --- |
| HRRR | 75% | 84% | 55% | 0.43 | 21% | 1331 |
| ECMWF | 81% | 10% | 3% | 0.15 | 21% | 1331 |
| GFS | 79% | 57% | 50% | 0.39 | 21% | 1331 |
| ICON | 68% | 66% | 63% | 0.27 | 21% | 1331 |
| ERA5 | 82% | 22% | 25% | 0.27 | 21% | 1331 |

按区域 By region:

| 区域 Region | HRRR 准确率/HSS acc/HSS | ECMWF 准确率/HSS acc/HSS | GFS 准确率/HSS acc/HSS | ICON 准确率/HSS acc/HSS | ERA5 准确率/HSS acc/HSS | n |
| --- | --- | --- | --- | --- | --- | --- |
| 全部 All | 75% / 0.43 | 81% / 0.15 | 79% / 0.39 | 68% / 0.27 | 82% / 0.27 | 1331 |
| 北海岸 North Coast | 79% / 0.58 | 64% / 0.26 | 67% / 0.33 | 77% / 0.54 | 54% / 0.06 | 171 |
| 湾区 Bay Area | 86% / 0.66 | 42% / 0.07 | 79% / 0.57 | 81% / 0.57 | 63% / 0.34 | 84 |
| 中央海岸 Central Coast | 81% / 0.63 | 58% / 0.03 | 72% / 0.43 | 72% / 0.43 | 66% / 0.24 | 180 |
| 南加州 SoCal | 73% / 0.11 | 95% / -0.00 | 91% / 0.14 | 82% / 0.11 | 94% / -0.01 | 446 |
| 圣地亚哥 San Diego | 70% / 0.24 | 90% / 0.00 | 74% / 0.13 | 48% / -0.00 | 90% / 0.25 | 450 |

低云量 MAE（METAR 量级：FEW 19 / SCT 44 / BKN 75 / OVC 100）· Low-cloud amount vs METAR:

| 模型 Model | 偏差 bias | MAE | r | n |
| --- | --- | --- | --- | --- |
| HRRR | +11 | 19 | 0.73 | 1142 |
| ECMWF | -22 | 23 | 0.50 | 1142 |
| GFS | -8 | 22 | 0.48 | 1142 |
| ICON | +7 | 23 | 0.56 | 1142 |
| ERA5 | -19 | 22 | 0.46 | 1142 |

### 4d. 机位格点：最近 vs 陆地 vs 两者平均 · Spot cell: nearest vs land vs blend (vs METAR hybrid truth)

> **一次性测试，相关代码已删除（2026-10-14）。** 这一节来自一次单独的试验：比较海滩机位用“最近格点”和“陆地格点”的差别。结论是陆地格点基本没有改进（集合评分 MAE 10.0 → 9.6，湾区反而 5.4 → 7.0），南加州的雾误报也不是格点落在海上造成的，所以网站保持 `nearest` 不变，`scripts/backtest.mjs` 里生成本节的代码也已删除。以后重新运行回测时，本节不会再出现。
> **One-off test; its code was removed (2026-10-14).** This section came from a separate experiment comparing the "nearest" and "land" grid cells for beach spots. The land cell barely helps (ensemble MAE 10.0 → 9.6, Bay Area worse 5.4 → 7.0), and SoCal's fog false alarms are not caused by offshore cells, so the site keeps `nearest` and the code that produced this section was removed from `scripts/backtest.mjs`. A future rerun will not include it.

N = `cell_selection: 'nearest'`（网站现在的做法 as the site does now），L = `'land'`，B = 两个格点逐小时平均 hourly mean of both。只用 10 km 内有机场的机位。“格点不同”= 最近格点 ≠ 陆地格点（通常是最近格点落在海上）。
Only spots with an airport within 10 km. "Cell moved" = the land cell differs from the nearest cell (usually the nearest one is offshore).

雾判断 HSS（low ≥ 50% vs METAR BKN/OVC/VV < 6500 ft）· Fog HSS:

| 区域 Region | HRRR N / L / B | ECMWF N / L / B | GFS N / L / B | ICON N / L / B | n |
| --- | --- | --- | --- | --- | --- |
| 全部 All | 0.43 / 0.44 / 0.44 | 0.15 / 0.11 / 0.13 | 0.39 / 0.38 / 0.47 | 0.27 / 0.35 / 0.31 | 1331 |
| 北海岸 North Coast | 0.58 / 0.58 / 0.58 | 0.26 / 0.26 / 0.26 | 0.33 / 0.13 / 0.32 | 0.54 / 0.52 / 0.58 | 171 |
| 湾区 Bay Area | 0.66 / 0.63 / 0.66 | 0.07 / 0.00 / 0.03 | 0.57 / 0.57 / 0.57 | 0.57 / 0.47 / 0.54 | 84 |
| 中央海岸 Central Coast | 0.63 / 0.63 / 0.63 | 0.03 / 0.00 / 0.03 | 0.43 / 0.31 / 0.48 | 0.43 / 0.43 / 0.43 | 180 |
| 南加州 SoCal | 0.11 / 0.14 / 0.13 | -0.00 / -0.00 / -0.00 | 0.14 / 0.18 / 0.18 | 0.11 / 0.13 / 0.14 | 446 |
| 圣地亚哥 San Diego | 0.24 / 0.25 / 0.25 | 0.00 / 0.00 / 0.00 | 0.13 / -0.02 / 0.22 | -0.00 / 0.09 / 0.01 | 450 |
| 格点不同 Cell moved | 0.33 / 0.35 / 0.35 | 0.10 / 0.00 / 0.04 | 0.46 / 0.55 / 0.53 | 0.24 / 0.32 / 0.28 | 530 |
| 格点相同 Same cell | 0.50 / 0.50 / 0.50 | 0.16 / 0.15 / 0.16 | 0.35 / 0.29 / 0.44 | 0.31 / 0.37 / 0.33 | 801 |

误报率 / 命中率（HRRR）· HRRR FAR / POD:

| 区域 Region | N FAR / POD | L FAR / POD | B FAR / POD | 实况雾频率 Base rate | n |
| --- | --- | --- | --- | --- | --- |
| 全部 All | 55% / 84% | 54% / 84% | 55% / 85% | 21% | 1331 |
| 北海岸 North Coast | 16% / 70% | 16% / 70% | 16% / 70% | 48% | 171 |
| 湾区 Bay Area | 18% / 100% | 19% / 100% | 18% / 100% | 64% | 84 |
| 中央海岸 Central Coast | 29% / 96% | 29% / 96% | 29% / 96% | 43% | 180 |
| 南加州 SoCal | 89% / 61% | 87% / 65% | 88% / 65% | 5% | 446 |
| 圣地亚哥 San Diego | 77% / 85% | 77% / 83% | 77% / 85% | 10% | 450 |
| 格点不同 Cell moved | 67% / 92% | 65% / 92% | 66% / 93% | 16% | 530 |
| 格点相同 Same cell | 46% / 81% | 46% / 81% | 46% / 81% | 25% | 801 |

评分 MAE（分）对混合实况 · Score MAE vs hybrid truth:

| 区域 Region | HRRR N / L / B | ECMWF N / L / B | GFS N / L / B | ICON N / L / B | ENS N / L / B | 集合偏差 ENS bias N / L / B | n |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 全部 All | 13.5 / 13.2 / 13.3 | 12.9 / 13.4 / 13.2 | 12.4 / 12.5 / 12.3 | 12.4 / 12.1 / 12.1 | 10.0 / 9.6 / 9.7 | -4.5 / -2.7 / -3.2 | 1331 |
| 北海岸 North Coast | 9.1 / 9.1 / 9.1 | 12.0 / 12.0 / 12.0 | 11.7 / 13.9 / 13.3 | 9.4 / 9.0 / 9.1 | 8.2 / 8.5 / 8.4 | -0.8 / -0.1 / -0.3 | 171 |
| 湾区 Bay Area | 5.3 / 5.3 / 5.3 | 13.1 / 19.2 / 16.8 | 10.1 / 11.4 / 11.4 | 5.7 / 5.6 / 5.6 | 5.4 / 7.0 / 6.5 | +3.3 / +5.4 / +4.8 | 84 |
| 中央海岸 Central Coast | 9.1 / 9.1 / 9.1 | 14.1 / 15.4 / 14.7 | 9.3 / 9.4 / 9.4 | 8.1 / 8.1 / 8.1 | 8.0 / 7.7 / 7.8 | -0.9 / +0.1 / -0.1 | 180 |
| 南加州 SoCal | 15.1 / 14.4 / 14.7 | 11.5 / 12.0 / 11.9 | 11.5 / 11.4 / 11.4 | 11.8 / 11.5 / 11.6 | 10.0 / 9.5 / 9.6 | -5.5 / -4.0 / -4.3 | 446 |
| 圣地亚哥 San Diego | 17.0 / 16.6 / 16.7 | 13.9 / 13.6 / 13.7 | 15.2 / 14.5 / 14.1 | 17.1 / 16.6 / 16.5 | 12.5 / 11.2 / 11.6 | -7.7 / -5.1 / -5.9 | 450 |
| 格点不同 Cell moved | 14.9 / 14.0 / 14.4 | 13.0 / 14.0 / 13.6 | 12.9 / 12.8 / 12.7 | 13.0 / 12.6 / 12.6 | 10.5 / 10.0 / 10.1 | -5.1 / -3.0 / -3.6 | 530 |
| 格点相同 Same cell | 12.6 / 12.6 / 12.6 | 12.8 / 13.1 / 12.9 | 12.1 / 12.3 / 12.0 | 12.0 / 11.7 / 11.8 | 9.7 / 9.3 / 9.4 | -4.0 / -2.5 / -3.0 | 801 |

格点差异 Cell distance nearest→land (km)：crescent 0, samoa 0, shelter 4.2, mendocino 0, pillar 3, asilomar 0, carmel 0, pismo 0, ellwood 0, smpier 0, venice 3, manhattan 3, vicente 3, oceanside 0, carlsbad 3, sunsetcliffs 0, cabrillo 3, coronado 0
全部机位中格点不同的 Spots (of all 58) whose cell moves: 29

## 5. 网站评分：预报 vs 实况 Site score from forecast vs from truth

完整输入 Full inputs（MAE 分 / 相关系数 r）：

| 区域 Region | HRRR MAE / r | ECMWF MAE / r | GFS MAE / r | ICON MAE / r | ENS MAE / r | n |
| --- | --- | --- | --- | --- | --- | --- |
| 全部 All | 14.3 / 0.58 | 11.8 / 0.61 | 12.1 / 0.54 | 13.0 / 0.54 | 10.1 / 0.73 | 5220 |
| 北海岸 North Coast | 13.7 / 0.50 | 10.7 / 0.65 | 11.1 / 0.62 | 13.0 / 0.63 | 9.9 / 0.72 | 900 |
| 湾区 Bay Area | 11.6 / 0.65 | 10.5 / 0.60 | 11.2 / 0.55 | 11.0 / 0.62 | 8.5 / 0.74 | 900 |
| 中央海岸 Central Coast | 12.1 / 0.63 | 13.1 / 0.55 | 10.5 / 0.58 | 10.2 / 0.63 | 8.3 / 0.75 | 1260 |
| 南加州 SoCal | 15.5 / 0.54 | 11.2 / 0.63 | 12.4 / 0.54 | 13.9 / 0.47 | 10.8 / 0.72 | 1350 |
| 圣地亚哥 San Diego | 19.6 / 0.53 | 13.7 / 0.58 | 16.0 / 0.39 | 18.5 / 0.36 | 13.8 / 0.66 | 810 |

仅云 Cloud-only：

| 区域 Region | HRRR MAE / r | ECMWF MAE / r | GFS MAE / r | ICON MAE / r | ENS MAE / r | n |
| --- | --- | --- | --- | --- | --- | --- |
| 全部 All | 13.7 / 0.60 | 12.7 / 0.62 | 12.3 / 0.54 | 12.7 / 0.55 | 9.5 / 0.74 | 5220 |
| 北海岸 North Coast | 12.9 / 0.53 | 11.4 / 0.68 | 11.6 / 0.61 | 12.4 / 0.64 | 8.9 / 0.75 | 900 |
| 湾区 Bay Area | 11.0 / 0.65 | 12.1 / 0.60 | 12.0 / 0.56 | 10.7 / 0.63 | 7.9 / 0.75 | 900 |
| 中央海岸 Central Coast | 11.6 / 0.64 | 15.5 / 0.53 | 10.7 / 0.60 | 9.8 / 0.64 | 8.1 / 0.76 | 1260 |
| 南加州 SoCal | 14.7 / 0.56 | 11.3 / 0.64 | 12.2 / 0.55 | 13.6 / 0.47 | 10.3 / 0.73 | 1350 |
| 圣地亚哥 San Diego | 18.7 / 0.55 | 13.0 / 0.64 | 15.9 / 0.40 | 18.4 / 0.36 | 12.7 / 0.69 | 810 |

平均分 Mean score（全部 all）：

| 模型 Model | 偏差 bias | 预报均值 forecast mean | ERA5 均值 truth mean |
| --- | --- | --- | --- |
| HRRR | -13.1 | 10.9 | 24.0 |
| ECMWF | 3.6 | 27.7 | 24.0 |
| GFS | -2.0 | 22.0 | 24.0 |
| ICON | -9.2 | 14.9 | 24.0 |
| ENS | -5.7 | 18.3 | 24.0 |

集合评分与实况落在同一档（火烧云/值得去/不错/一般/平淡）的比例 · Ensemble and truth in the same label band: **72%**

### 5b. 对混合实况评分 Score vs hybrid truth (METAR low cloud + visibility at the spot, ERA5 elsewhere)

只用 10 km 内有沿海机场的机位（crescent, samoa, shelter, mendocino, pillar, asilomar, carmel, pismo, ellwood, smpier, venice, manhattan, vicente, oceanside, carlsbad, sunsetcliffs, cabrillo, coronado）。ERA5 列表示“只用 ERA5 当实况”本身差多少。
Only spots with a coastal airport within 10 km. The ERA5 column shows how far ERA5-alone truth is from this better truth.

| 区域 Region | HRRR MAE / r | ECMWF MAE / r | GFS MAE / r | ICON MAE / r | ENS MAE / r | ERA5 MAE / r | n |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 全部 All | 13.5 / 0.63 | 12.9 / 0.60 | 12.4 / 0.54 | 12.4 / 0.57 | 10.0 / 0.74 | 3.0 / 0.95 | 1331 |
| 北海岸 North Coast | 9.1 / 0.59 | 12.0 / 0.65 | 11.7 / 0.52 | 9.4 / 0.64 | 8.2 / 0.73 | 6.5 / 0.85 | 171 |
| 湾区 Bay Area | 5.3 / 0.81 | 13.1 / 0.75 | 10.1 / 0.69 | 5.7 / 0.78 | 5.4 / 0.88 | 8.9 / 0.83 | 84 |
| 中央海岸 Central Coast | 9.1 / 0.69 | 14.1 / 0.52 | 9.3 / 0.63 | 8.1 / 0.71 | 8.0 / 0.76 | 3.4 / 0.93 | 180 |
| 南加州 SoCal | 15.1 / 0.60 | 11.5 / 0.59 | 11.5 / 0.62 | 11.8 / 0.61 | 10.0 / 0.77 | 1.1 / 0.99 | 446 |
| 圣地亚哥 San Diego | 17.0 / 0.58 | 13.9 / 0.55 | 15.2 / 0.38 | 17.1 / 0.39 | 12.5 / 0.66 | 2.2 / 0.97 | 450 |

| 模型 Model | 偏差 bias | 预报均值 forecast mean | 混合实况均值 hybrid-truth mean | n |
| --- | --- | --- | --- | --- |
| HRRR | -12.1 | 11.5 | 23.6 | 1331 |
| ECMWF | 4.6 | 28.2 | 23.6 | 1331 |
| GFS | -0.9 | 22.7 | 23.6 | 1331 |
| ICON | -7.2 | 16.4 | 23.6 | 1331 |
| ENS | -4.5 | 19.1 | 23.6 | 1331 |
| ERA5 | 2.8 | 26.3 | 23.6 | 1331 |

## 6. ECMWF/GFS 是否比 HRRR/ICON 高估高云？ Do ECMWF/GFS overstate high cloud vs HRRR/ICON?

|  | ECMWF+GFS | HRRR+ICON | ERA5 |
| --- | --- | --- | --- |
| 平均高云 mean high cloud | 19% | 12% | 16% |
| 模式 ≥25% 而 ERA5 <10% 的比例 · model ≥25% while ERA5 <10% | 5% | 1% |  |
| 比另一组多 ≥20 个百分点 · ≥20 pts more than the other pair | 18% | 2% |  |

n = 5220。注意 ERA5 与 ECMWF 同源，若 ECMWF 有系统性高云偏多，ERA5 可能也偏多。
Caveat: ERA5 shares ECMWF's physics, so an ECMWF high-cloud excess may partly be in ERA5 too.

## 7. 提前量 Lead time: total cloud, day-0 vs day-1（%）

| 模型 Model | 当天 day-0 偏差/MAE | 提前一天 day-1 偏差/MAE | n |
| --- | --- | --- | --- |
| HRRR | +18.7 / 31.3 | +24.7 / 31.8 | 5220 |
| ECMWF | +6.3 / 16.5 | +3.0 / 18.2 | 5220 |
| GFS | +13.1 / 23.9 | +5.1 / 22.0 | 5220 |
| ICON | +21.3 / 28.3 | +18.7 / 27.6 | 5220 |
