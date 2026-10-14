# 分地区 HRRR 权重实验 · Regional HRRR weight experiment

2026-10-14 · 数据 data: `backtest/results.json`（2026-07-10 … 2026-10-07，有 10 km 内沿海机场的机位 spots with a coastal airport within 10 km：南加州 SoCal 446、圣地亚哥 San Diego 450 个傍晚 spot-evenings）· 实况 truth: METAR 低云/能见度 + ERA5（见 REPORT.md §5b）

重跑 To rerun：`results.json` 不进 git，先运行 `node scripts/backtest.mjs` 生成它（约 1–2 小时，受 Open-Meteo 免费额度限制），再运行 `python3 backtest/eval_score_weight.py` 和 `python3 backtest/eval_fog_weight.py`。
`results.json` is git-ignored: run `node scripts/backtest.mjs` first (about 1–2 h under Open-Meteo's free limits), then the two `backtest/eval_*.py` scripts.

回测发现 HRRR 在南加州和圣地亚哥日落时低云报得太多（海雾误报率 77–89%，而实际有雾的傍晚只占 5–10%）。这里检验：只在这两个地区降低 HRRR 的权重，准确率会不会提高。判断标准：前后两半日期**都**要变好，避免只是拟合噪声。
The backtest found HRRR over-forecasts sunset low cloud in SoCal and San Diego (fog false-alarm rate 77–89% while fog occurs on only 5–10% of evenings). Test: does lowering HRRR's weight in just these regions improve accuracy? Criterion: **both** halves of the period must improve, so the change isn't fitting noise.

## 1. 评分权重 · Score weight — 不改 not changed

HRRR 在集合评分里的权重乘以 k（其余模型按比例补上）· HRRR's weight in the ensemble score × k (others renormalised). 脚本 script: `backtest/eval_score_weight.py`

| 地区 Region | k = 1（现在 now） | 最好 best | 两半日期检验 two-fold out-of-sample |
| --- | --- | --- | --- |
| 南加州 SoCal | MAE 9.99 | k = 0.25: 9.75 | 两次都只改善约 0.24 分，但误报“值得去”从 4 次增加到 16 次 · ~0.24 pt better in both folds, but false "worth going" 4 → 16 |
| 圣地亚哥 San Diego | MAE 12.52 | k = 0.5: 12.26 | 结论相反：一次变差 9.34 → 9.57，另一次选回 k = 1 · inconsistent: one fold worse, the other picks k = 1 |

提升太小、不稳定，评分权重保持不变。· Too small and inconsistent; score weights unchanged.

## 2. 海雾风险权重 · Fog-risk weight — 圣地亚哥 0.5 → 0.35，南加州不变

海雾风险 = wH × HRRR 低云 + (0.85 − wH) × 各模型加权平均 + 0.15 × 气候基准（当天预报 wH = 0.5）。对比机场 METAR 的“有雾/低云”（6500 ft 以下 BKN/OVC/VV），用“海雾风险 ≥ 60%”（页面上的“海雾风险高”）计算 HSS。脚本 script: `backtest/eval_fog_weight.py`
Fog risk = wH × HRRR low cloud + (0.85 − wH) × weighted mean + 0.15 × climatology (wH = 0.5 for day 0). Scored against METAR fog/low deck with "fog risk ≥ 60%" (the page's "high fog risk").

| 地区 Region | wH | HSS | 前一半 1st half | 后一半 2nd half | 误报率 false alarm | 命中率 hit | 提示次数 warnings |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 圣地亚哥 San Diego | 0.5（原来 before） | 0.39 | 0.33 | 0.46 | 66% | 76% | 102 |
| 圣地亚哥 San Diego | **0.35（采用 adopted）** | **0.47** | **0.41** | **0.54** | 58% | 74% | 81 |
| 南加州 SoCal | 0.5 | 0.17 | 0.13 | 0.21 | 85% | 52% | 78 |
| 南加州 SoCal | 0.35 | 0.17 | 0.13 | 0.21 | 83% | 35% | 48 |

- **圣地亚哥：采用 0.35。** 两半日期都明显提升，误报减少，命中率几乎不变。只改当天预报；明天本来就是 0.3，不变。
  **San Diego: adopt 0.35.** Both halves clearly improve; fewer false alarms at nearly the same hit rate. Day 0 only; day 1 is already 0.3.
- **南加州：不改。** 准确度（HSS）不变，只是少报——真正有雾时报出来的比例从 52% 降到 35%。
  **SoCal: unchanged.** No HSS gain; it just warns less, catching fog 35% of the time instead of 52%.
- 其他地区不受影响（HSS 0.66）。· Other regions unaffected (HSS 0.66).

## 局限 · Caveats

- 只有夏末到初秋 90 天；冬季雾少、锋面云多，冬天应重跑一次。· Late summer to early autumn only; rerun in winter.
- 回测的预报提前量只有 0–6 小时，网站实际是 6–30 小时。· Backtest lead is 0–6 h; the site's is 6–30 h.
- 用各模型的原始低云代替网站里的“有效低云”（后者还包含逆温 + 湿度修正），属于近似。· Uses raw model low cloud as a proxy for the site's effective low cloud (which adds the inversion + humidity heuristic).
