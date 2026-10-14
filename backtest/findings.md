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
