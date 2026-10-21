# 光路几何实验 · Light-path geometry experiment

2026-10-21 · 脚本 script: `backtest/eval_light_path.mjs` · 数据 data: 2026-07-10 … 2026-10-07，90 个傍晚 × 58 个机位 = 5220 样本 samples；混合实况 hybrid truth（10 km 内有沿海机场的机位）1331 · 结果 results: `backtest/light_path_results.json`（不进 git，重跑可得 git-ignored, rerun to get it）

重跑 To rerun：`/opt/homebrew/bin/node backtest/eval_light_path.mjs`（机位数据和 METAR 直接用 `backtest/cache`；第一次运行要额外下载 300/350 km 的采样点，约 20 分钟）。
Reuses `backtest/cache` for the spot layers and METARs; the first run downloads the 300/350 km points (about 20 min).

## 想法 · Idea

来自 sunsetbot.top 的云底几何法：日落后，高度 h 的云要靠一条掠过地面霾层/海洋层顶（hb ≈ 1 km）的光线照亮。这条光线的最低点在太阳方向 √(2R(h − hb)) 处，并且在余晖期间从云下方一路移到那里。所以哪一段远海的低云会挡光，取决于云有多高：中云（4.5 km）约到 240 km，高云（9 km）约到 350 km（都加上云本身离观景点约 30 km）。网站原来固定看 75 / 150 / 250 km，权重 .3 / .4 / .3，高云时看得不够远。
From sunsetbot.top's cloud-base geometry: after sunset a cloud at height h is lit by a ray grazing the haze / marine-layer top (hb ≈ 1 km). That ray's lowest point lies √(2R(h − hb)) toward the sun and sweeps out there during the glow. So which stretch of ocean can block the light depends on the cloud's height: ≈ 240 km for mid cloud (4.5 km), ≈ 350 km for high cloud (9 km), each including the ≈ 30 km the canvas itself lies out. The site sampled a fixed 75 / 150 / 250 km at .3 / .4 / .3, which falls short for high cloud.

## 方案 · Variants

每个采样点代表一段海面（75: 50–112、150: 112–200、250: 200–275、300: 275–325、350: 325–375 km），权重 = 它与被照亮那段距离的重叠长度，再按画布里高云所占比例在中云/高云两套权重之间混合。挡光公式（`low×0.8 + mid×0.3`，光路 = 1 − 1.15 × block）不变。
Each point stands for a stretch of ocean; its weight is its overlap with the lit stretch, blended between the mid- and high-cloud weights by the canvas's high-cloud share. The blocking formula is unchanged.

- **now**：现在的做法 current 75/150/250 @ .3/.4/.3
- **ext300**：只加 300 km，不用几何 add 300 km without geometry, .25/.3/.25/.2
- **geo**：几何权重（预先选定的主方案）geometry weights (the pre-declared candidate)
- **geoLate**：几何权重再按距离加权（越晚越红）geometry × distance (later = redder)

## 结果 · Results

预报（4 个模型，当天权重）vs 实况（ERA5；混合实况 = 机位低云/能见度用 METAR，其余用 ERA5），两侧用同一套公式。前一半 H1 = 07-10…08-23，后一半 H2 = 08-24…10-07。
Forecast (4 models, day-0 weights) vs truth (ERA5; hybrid = METAR low cloud / visibility at the spot, ERA5 elsewhere), same formula on both sides.

| 方案 Variant | 光路 MAE light MAE（H1 / H2） | 光路 r light r（H1 / H2） | 评分 MAE score MAE（H1 / H2） | 评分 r score r（H1 / H2） | 对混合实况 MAE vs hybrid（H1 / H2） | 与现在相比换档 label changes vs now |
| --- | --- | --- | --- | --- | --- | --- |
| now | 0.187 / 0.154 | 0.722 / 0.749 | 10.57 / 9.69 | 0.687 / 0.765 | 11.53 / 8.60 | – |
| ext300 | 0.181 / 0.148 | 0.726 / 0.768 | 10.21 / 9.35 | 0.682 / 0.771 | 11.17 / 8.49 | 2.5% |
| **geo（采用 adopted）** | **0.180 / 0.148** | **0.727 / 0.763** | **10.06 / 9.30** | 0.677 / 0.767 | **10.92 / 8.48** | 2.2% |
| geoLate | 0.183 / 0.156 | 0.718 / 0.759 | 9.86 / 9.28 | 0.667 / 0.762 | 10.76 / 8.64 | 4.2% |

全期 All：geo 评分 MAE 10.13 → 9.68，对混合实况 10.07 → 9.70，同档比例 73.0% → 73.9%，平均每个地点评分变动 0.5 分。
Whole period: geo score MAE 10.13 → 9.68, vs hybrid 10.07 → 9.70, same label band 73.0% → 73.9%; scores move 0.5 points on average.

## 结论 · Decision

- **采用 geo。** 光路 MAE、光路相关系数、评分 MAE、对混合实况的 MAE，前后两半都变好。唯一变差的是前一半的评分相关系数（0.687 → 0.677），所以一部分 MAE 改善可能来自“看得更远、取平均更平滑”，不全是几何本身的功劳。改善幅度小（约 0.4 分）。
  **Adopt geo.** Light MAE, light r, score MAE and MAE vs hybrid truth all improve in both halves. The one metric that slips is score r in the first half (0.687 → 0.677), so part of the MAE gain may come from averaging over a longer path rather than from the geometry itself. The gain is small (~0.4 points).
- **geoLate 不用**：后一半的光路 MAE 和相关系数都变差。· **geoLate rejected**: light MAE and r get worse in the second half.
- ext300（不用几何、只是加远点）效果和 geo 差不多，说明几何的额外贡献在噪声范围内；选 geo 是因为它有物理依据，而且中云时不受 250 km 以外云的影响。
  ext300 (no geometry, just a farther point) does about as well, so the geometry's own contribution is within noise; geo is chosen because it is physically grounded and keeps mid-cloud evenings independent of cloud beyond ~240 km.

## 局限 · Caveats

- **这个回测检验的是“天气输入能否预报”，不是“晚霞是否真的好看”。** 改公式会同时改变预报和实况两侧，所以只能说明新公式下的评分更可预报，不能证明它更接近人眼看到的晚霞。没有实拍观测，这一点无法检验。
  **This backtest checks how predictable the inputs are, not whether the glow was beautiful.** A formula change alters both sides, so it shows the new score is more predictable, not that it matches what people saw — there are no glow observations to test that.
- ERA5 在 300–350 km 远海的低云本身未经验证。· ERA5 low cloud 300–350 km offshore is itself unverified.
- 云高用典型值（中云 4.5 km、高云 9 km），Open-Meteo 不提供云底高度。· Typical cloud heights; Open-Meteo has no cloud base.
- 只有夏末到初秋，预报提前量 0–6 h。· Late summer–early autumn only; 0–6 h lead.
- 线上影响：远海采样点从约 147 个增加到约 189 个，`data.json` 每次多 1 个请求（6 → 7），文件约大 15%。· Live impact: ~147 → ~189 path points, one more request per build (6 → 7), `data.json` ~15% larger.

## 同时做的时间改进（不影响评分）· Timing change made alongside (no effect on the score)

同一几何也给出余晖持续时间：云在太阳低于地平线 δ = √(2(h − hb)/R) + x/R 前一直被照亮（x = 50 km），除以当天当地太阳的下沉速度得到分钟数（`model.js` 的 `glowMinutes()`）。原来的固定时段（高云 +3…+25 min、中云 −5…+15 min）改为按季节、纬度、海拔计算，加州海岸高云约 16–21 分钟、中云约 11–15 分钟。没有实测余晖时间可以回测，所以这一项只基于几何。
The same geometry gives the afterglow's length; the fixed windows became season-, latitude- and elevation-aware (high cloud ≈ 16–21 min, mid ≈ 11–15 min after sunset). There are no observed glow times to backtest it against, so it rests on geometry alone.
