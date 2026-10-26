# 实拍案例 · Photo cases

`backtest/cases.json` 记录真实看到的晚霞，以及网站当时的预报（每个模型的云量剖面、评分、概率、云层西缘检测）。这是目前唯一能判断“到底好不好看”的实况，天气回测做不到这一点。
`backtest/cases.json` records real observed sunsets together with what the site forecast at the time (each model's cloud profile, score, chance, deck-edge check). It is the only "was it actually beautiful" truth we have; the weather backtest can't judge that.

## 怎么加一个案例 · Adding a case

当天晚上运行（线上 `data.json` 每小时更新，过了当天就拿不到当时的预报了）· Run it the same evening (the live `data.json` moves on):

```bash
/opt/homebrew/bin/node backtest/add_case.mjs --id 2026-10-25-bay --date 2026-10-25 \
  --data https://runwang06.github.io/ca-sunset/data.json --spots oceanbeach,twinpeaks,hawk \
  --area "Berkeley / Emeryville shoreline" --lat 37.84 --lon -122.30 --dir 250 --time 18:35 \
  --rating 80 --rated-by user --desc "vivid pink broken mid deck" --photo IMG_1234.HEIC
```

- `--rating`：这个傍晚值多少分，用网站自己的 0–100 标准（80 火烧云 / 65 值得去 / 45 不错 / 25 一般）。· The score the evening deserved on the site's own scale.
- `--rated-by`：`user`（拍摄者）或 `claude`（看照片估计）。· Photographer or Claude's estimate.
- `--spots`：离拍摄点最近、看同一片西边天空的地点。· The nearest spots that see the same western sky.
- 坐标只保留两位小数（约 1 km），因为这个文件公开在 GitHub 上；照片不进 git，只记文件名。· Location rounded to 0.01° (~1 km) because the file is public; photos stay out of git.
- 同一个 `--id` 再跑一次会覆盖旧记录，可以用来补上拍摄者自己的评分。· Re-running with the same `--id` replaces the entry (e.g. to add the photographer's own rating).

## 现有案例 · Cases so far

| id | 地点 Where | 实况 Observed | 网站 Site | 说明 Notes |
| --- | --- | --- | --- | --- |
| 2026-10-25-sd | UTC / La Jolla，朝 247° | ≈ 55（Claude 估计 estimate） | 65–67，概率 54–56%，低置信 | 薄卷云被照成粉橙色，地平线干净。HRRR 31 太悲观，ECMWF 99 / GFS 85–93 太乐观，集合平均接近实况。· Thin cirrus, clean horizon; ensemble mean close, members far off both ways. |
| 2026-10-25-bay | 伯克利 / 埃默里维尔海边，朝旧金山 Berkeley shoreline toward SF | ≈ 82（Claude 估计 estimate） | 28–29，概率 14–17%，标题“光路被挡” | 大片破碎中云被整片照红，明显漏报。模型显示有云层、西缘在 250–300 km，见 `DECK_EDGE.md`。· Vivid broken mid deck; a clear miss — deck with an edge 250–300 km out. |

两个案例的评分都还缺拍摄者自己的打分。· Both still lack the photographer's own rating.
