# “云层西缘”实验 · Cloud-deck-with-a-western-edge experiment

2026-10-25 · 脚本 scripts: `backtest/deck_edge.mjs`（检测）、`backtest/eval_deck_edge.mjs`（回测）· 数据 data: 2026-07-10 … 2026-10-07，5220 个地点·傍晚 spot-evenings，全部来自 `backtest/cache` · **线上模型没有改 The live model is unchanged.**

重跑 To rerun：`/opt/homebrew/bin/node backtest/eval_deck_edge.mjs`（几秒，不调接口 a few seconds, no API calls）。

## 起因 · Why

2026-10-25 伯克利海边的实拍（`cases.json` 里的 `2026-10-25-bay`）：大片破碎的中云被整片照成粉红，Claude 按网站的标准估计约 82 分。网站给旧金山附近的 3 个地点只有 28–29 分（“一般”），标题是“光路被挡”。模型显示头顶基本满天中高云，这层云往西延伸到 250–300 km 后就没了。这正是 sunsetbot 重点看的“云边界距离”：太阳从云层西缘外照进来，把整片云底点亮。现在的公式在这种情况下扣了两次分：头顶“满天云”时画布 ≤ 0.6，云层自己往西延伸的部分又被当成光路上挡光的中云。
On 2026-10-25 a broken mid deck over Berkeley lit up vivid pink (Claude's estimate ≈ 82 on the site's scale), while the site gave the nearby SF spots 28–29 ("light path blocked"). The models had a near-overcast mid/high deck overhead ending 250–300 km toward the sun — the "cloud edge" case sunsetbot.top looks for. The current formula penalises it twice: the overhead deck counts as overcast (canvas ≤ 0.6), and the deck's own westward extension counts as mid cloud blocking the light path.

## 检测规则（看结果之前定好的）· Detector (thresholds fixed before looking at results)

对每个模型：
- **云层**：观景点 / 25 / 75 km 的中高云覆盖率（权重 .35 / .4 / .25）≥ 70%。
- **西缘**：从 150 km 起往外，第一个“画布那层云” < 35% 的采样点，而且再往外都 < 50%。中云画布只看中云，因为更远处的高云在光线上方，不挡光；高云或混合画布看中云和高云合计。西缘最远只算到画布能被照到的距离：中云 240 km，高云 350 km（即 `model.js` 里的 LIGHT）。
- **宽松版**：只要求“有云层、有西缘”。**严格版**：还要求西缘以外的平均低云 < 40%。
- 集合：触发的模型权重之和 ≥ 50% 才算触发。

Per model:
- **Deck**: mid/high cover at the observer / 25 / 75 km (weights .35 / .4 / .25) ≥ 70%.
- **Edge**: the first point from 150 km out where the canvas layer drops below 35% and stays below 50% further out. A mid deck checks mid cloud only, since high cloud further out is above the ray. A high or mixed deck checks mid and high together. The edge has to be within the canvas's light reach: 240 km for a mid deck, 350 km for a high one (LIGHT in `model.js`).
- **Lenient** = deck + edge. **Strict** additionally needs mean low cloud beyond the edge < 40%.
- Ensemble fires when the members that fire carry ≥ 50% of the weight.

## 结果 · Results

以 ERA5 为“实况”（只说明天气形势有没有出现，不说明晚霞好不好看）· ERA5 as truth for the *weather pattern*, not for beauty.

### 宽松版 Lenient

| 区域 Region | ERA5 触发率 truth rate | 预报触发率 forecast rate | 命中 POD | 误报 FAR | HSS（前半 / 后半 H1 / H2） | 触发时现评分 current score when it fires | 其中 < 45 分 share < 45 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 全部 All | 6.6%（342） | 4.2% | 42% | 35% | 0.48（0.50 / 0.47） | 38 | 57% |
| 北海岸 North Coast | 7.6% | 5.1% | 54% | 20% | 0.63（0.63 / 0.62） | 30 | 65% |
| 湾区 Bay Area | 10.9% | 6.7% | 39% | 37% | 0.43（0.57 / 0.34） | 35 | 65% |
| 中央海岸 Central Coast | 5.8% | 3.6% | 38% | 38% | 0.45（0.51 / 0.41） | 38 | 59% |
| 南加州 SoCal | 4.4% | 2.1% | 35% | 25% | 0.46（0.27 / 0.60） | 51 | 28% |
| 圣地亚哥 San Diego | 5.3% | 4.7% | 42% | 53% | 0.42（0.48 / 0.37） | 38 | 63% |

各模型单独 Per model：HRRR 触发 2.8%（HSS 0.34），ECMWF 6.5%（0.49），GFS 9.3%（0.48），ICON 7.1%（0.49）。HRRR 很少触发，因为它的中高云西缘往往在更远处。· HRRR rarely fires; its deck edges tend to lie farther out.

### 严格版 Strict

ERA5 触发率 3.2%，预报只有 1.0%，HSS 0.28，前后两半差很多（0.60 / 0.13）。**西缘以外的低云预报不稳定，严格版不可用。**
Truth rate 3.2%, forecast 1.0%, HSS 0.28 with very different halves (0.60 / 0.13). **Low cloud beyond the edge isn't predictable enough; the strict version is unusable.**

### 现公式怎么看这些傍晚 · How the current formula treats them

- ERA5 里“有云层、有西缘”的傍晚：平均画布 0.72、光路 0.64、评分 38。“有云层、没西缘”的：0.71 / 0.56 / 32.5。**现公式几乎区分不出这两种情况**，而按几何，前者才是会被整片照亮的情形。
  ERA5 deck evenings with an edge: canvas 0.72, light 0.64, score 38. Deck without an edge: 0.71 / 0.56 / 32.5. **The current formula barely tells them apart**, although geometrically only the first can be lit from below.
- 西缘距离 Edge distance：150 km ×116、250 km ×120、300 km ×64、350 km ×42。
- 很多地点同时触发的傍晚（ERA5，宽松版，≥ 5 个地点）· Evenings with ≥ 5 spots firing: 07-11、**07-12（20）**、07-13、07-20、08-13、08-17、08-18、**08-20（31）**、08-21、**08-25（19）**、08-26、08-27、08-28、09-03、09-06、09-08、09-09、09-10、09-13、09-19、**09-20（19）**、09-24、09-26、**09-27（19）**、10-02。

### 实拍案例 Photo cases

| 案例 Case | 实况 Observed | 网站评分 Site score | 西缘触发（严格 / 宽松）Deck-edge share (strict / lenient) |
| --- | --- | --- | --- |
| 2026-10-25-bay（伯克利 Berkeley → SF 地点 spots） | ≈ 82 | 28–29 | 19% / **65% → 触发 fires** |
| 2026-10-25-sd（UTC / La Jolla） | ≈ 55 | 65–67 | 19% / 19% → 不触发 doesn't fire |

**宽松版能把这两个案例分开**：大晚霞触发、薄卷云不触发。严格版分不开。不过只有两个案例。
**The lenient version separates the two cases** (fires on the big glow, not on the thin cirrus); strict doesn't. Two cases only.

## 结论 · Conclusion

- 这种形势不罕见：约 7% 的地点·傍晚，湾区约 11%。预报能抓到一部分（HSS ≈ 0.48，前后两半稳定）。现公式在这些傍晚平均只给 38 分，57% 低于 45 分。
  The pattern is not rare (≈ 7% of spot-evenings, ≈ 11% in the Bay Area), the forecasts catch it with HSS ≈ 0.48 (stable across halves), and the current formula scores those evenings 38 on average, 57% of them below 45.
- **还不能改线上模型。** 这个回测只能说明“这种天气形势会不会出现、能不能预报”，不能说明这些傍晚的晚霞是不是真的好看。目前支持“好看”的只有一个案例。
  **Not enough to change the live model.** The backtest shows the pattern occurs and is somewhat predictable, not that those evenings were beautiful; one photo case supports that.
- **下一步需要实拍实况**：找上面多个地点同时触发的那些日期的照片（自己拍的、社交媒体、网络摄像头存档），用 `backtest/add_case.mjs` 记下评分。如果这些傍晚多数确实好看，再考虑在模型里加一项“西缘加成”，比如有西缘时不按满天云扣画布分、不把云层本身算作挡光，并照例用前后两半检验。
  **Next: photo truth** for the dates above where many spots fire (own photos, social media, webcam archives), recorded with `backtest/add_case.mjs`. If most of those evenings were indeed good, consider a deck-edge term (no overcast penalty on the canvas, and the deck itself not counted as a light blocker when it has an edge), tested on both halves as usual.

## 局限 · Caveats

- ERA5 约 25 km 分辨率，看不出云的破碎程度，而且远海的中高云本身没有验证过。· ERA5 (~25 km) can't see how broken a deck is; far-offshore mid/high cloud is itself unverified.
- 云层是否“破碎”（伯克利那张照片的关键）在网格云量里看不出来，这个检测只看到了“有西缘”。· Whether a deck is broken (key in the Berkeley photo) is invisible in grid cover; the detector only sees the edge.
- 两个案例的评分都是 Claude 看照片估计的，不是拍摄者打的分。· Both case ratings are Claude's estimates from the photos, not the photographer's.
- 只有夏末到初秋；预报提前量 0–6 小时。· Late summer to early autumn; 0–6 h lead.
