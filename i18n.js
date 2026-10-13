// UI strings in Chinese and English, plus language-aware formatting.
// Values are strings with {placeholders} or functions of the vars object (for grammar that differs).
// Place names are not translated here: spots and regions carry both names and are always shown together.
// tests.html checks that both languages define exactly the same keys.

const TZ = 'America/Los_Angeles';

export const STRINGS = {
  zh: {
    // page chrome
    'title': '加州海岸晚霞预报',
    'meta.desc': '加州整条海岸的日落与火烧云预测：哪里值得去、几点到、为什么。',
    'sub': '今天哪里值得去 · 几点到 · 为什么',
    'btn.method': '方法与局限',
    'btn.methodShort': '方法',
    'btn.lang': 'EN',
    'btn.langAria': 'Switch to English',
    'close': '关闭',
    'aria.daySeg': '选择日期',
    'search.ph': '搜索地点：Ocean Beach、拉霍亚 La Jolla…',
    'aria.search': '搜索地点',
    'aria.answer': '推荐',
    'aria.list': '地点排名',
    'aria.chips': '按地区筛选',
    'aria.map': '地图',
    'sort.label': '排序',
    'sort.score': '观赏评分',
    'sort.prob': '发生概率',
    'sort.ns': '由北到南',
    'sort.dist': '离我最近',
    'legend.0': '平淡', 'legend.1': '一般', 'legend.2': '不错', 'legend.3': '值得去', 'legend.4': '火烧云',
    'day.0': '今天', 'day.1': '明天',
    'map.failed': '地图加载失败，可用下方列表浏览。',
    'ray.tip': '{km} km · 低云 {p}',

    // list
    'list.empty': '没有匹配“{q}”的地点',
    'list.over': '今日已结束',
    'list.sunset': '日落 {t}',
    'list.prob': '概率',

    // answer card
    'ans.noData': '所选范围暂时没有可用预测数据。',
    'ans.overEyebrow': '今天',
    'ans.overTitle': '这一带今天的日落已经结束',
    'ans.overWhy': '看看明天哪里值得去。',
    'ans.overBtn': '看明天的预测',
    'ans.eyebrow': '{day}{scope}最值得去',
    'ans.eyebrowDull': '{day}{scope}晚霞机会都不大 · 相对最好的是',
    'scope.all': '全加州海岸',
    'ans.open': '查看 {name} 详情',
    'ans.countdownHM': '距建议到达还有 {h} 小时 {m} 分',
    'ans.countdownM': '距建议到达还有 {m} 分钟',
    'ans.glowNow': '晚霞时段进行中',
    'kpi.score': '观赏评分',
    'kpi.prob': '发生概率 · {c}置信',
    'kpi.arrive': '建议到达',
    'kpi.sunset': '日落 · {dir}',
    'rb.best': '{region}最佳',
    'rb.arrive': '{t} 到',
    'coast.climate': '{region}气候特点：',

    // status line
    'status.loading': '正在获取 5 个气象模型、海洋层结构和空气质量数据{p}…服务器较忙时可能需要半分钟',
    'status.stale': '网络不稳定，暂时显示 {age}前（{t}）的数据',
    'status.retry': '重试',
    'status.refresh': '刷新',
    'status.updated': '数据更新于 {t}',
    'src.prebuilt': '（云端每小时更新）',
    'src.cache': '（本机缓存）',
    'src.live': '（实时获取）',
    'status.partial': '部分数据没取到，相关地点显示“数据不足”或按保守值估计：{e}',
    'status.todayOver': '今天的日落已经结束，显示明天的预测。',
    'status.autoRetry': '刷新失败，1 分钟后自动重试',
    'status.refreshFail': '刷新失败（{e}），继续显示之前的数据',
    'status.locating': '正在定位…',
    'status.geoUnsupported': '浏览器不支持定位',
    'status.geoFailed': '无法获取位置，已按评分排序',
    'age.hm': '{h} 小时 {m} 分钟',
    'age.m': '{m} 分钟',
    'fail.title': '暂时无法获取气象数据。',
    'fail.body': 'Open-Meteo 免费气象接口目前响应很慢或连接中断（已自动重试 3 次）。<br>页面会在 30 秒后自动再试，也可以现在 {link}。',
    'fail.link': '手动重试',
    'err.layer': '{layer} {failed}/{total} 组失败（{reason}）',
    'err.sep': '；',
    'layer.obs': '观景点天气',
    'layer.path': '日落方向远海云量',
    'layer.profile': '海洋层垂直结构',
    'layer.aq': '空气质量',
    'reason.timeout': '请求超时',
    'reason.network': '网络连接中断',
    'reason.ratelimit': '调用太频繁，被限流',

    // labels & confidence
    'label.fire': '火烧云级', 'label.worth': '值得去', 'label.good': '不错', 'label.fair': '一般', 'label.flat': '平淡', 'label.na': '数据不足',
    'conf.high': '高', 'conf.mid': '中', 'conf.low': '低',

    // detail sheet
    'sheet.elev': '海拔约 {m} m',
    'share.btn': '分享',
    'share.copied': '已复制链接',
    'share.title': '{name} 晚霞预报',
    'ring.score': '观赏评分',
    'stat.prob': '发生概率',
    'stat.probHint': '出现明显晚霞（≥55 分）的可能',
    'stat.conf': '置信度',
    'stat.spread': '模型分歧 ±{n} 分',
    'card.when': '{day}几点到',
    'tl.arrive': '建议到达',
    'tl.sunset': '日落',
    'tl.peakUntil': '最佳至 {t}',
    'tl.dusk': '天黑（民用昏影）',
    'tl.peakTitle': '最佳观赏',
    'tl.hike': '这里需要上山或步行，已提前 45 分钟。',
    'tl.elev': '因海拔较高，日落比海边晚约 {n} 分钟。',
    'peak.clear': '天空较干净：太阳落入海平线前后最好看，之后颜色较淡。',
    'peak.high': '以高云（卷云）为主：余晖通常在日落后 5–20 分钟最红，别太早离开。',
    'peak.mid': '以中云为主：日落前后 15 分钟内最精彩。',
    'card.why': '为什么',
    'why.none': '暂无足够数据给出理由。',
    'card.dir': '看哪个方向',
    'dir.face': '面朝{dir}（{en} {az}°）',
    'dir.ocean': '太阳落入开阔海平线。',
    'dir.land': '日落点在陆地或山体后，太阳会比海平线日落更早消失。',
    'dir.sector': '蓝色扇区为开阔海面方向。',
    'dir.aboveFog': '预计雾层顶约 {m} m，你在雾层之上。',
    'dir.aria': '日落方位 {az} 度',
    'profile.aria': '日落方向云层剖面',
    'profile.high': '高云', 'profile.mid': '中云', 'profile.low': '低云', 'profile.you': '你',
    'profile.cap': '沿日落方向的云层剖面（多模型加权）：颜色越实，云越多。晚霞需要“近处有中高云、远处低云少”。虚线框表示无数据。',
    'card.factors': '评分构成',
    'f.canvas': '云层画布', 'f.canvasHint': '中高云覆盖',
    'f.light': '光路通畅', 'f.lightHint': '远海低云',
    'f.local': '本地遮挡', 'f.localHint': '海雾/低云/能见度',
    'f.clarity': '空气透明', 'f.clarityHint': 'AOD',
    'f.note': '中高云 {cv}（高云 {h} · 中云 {m}）· 远海低云 {fl} · {fog} · AOD {aod}{vis}',
    'f.aboveFog': '雾上观景',
    'f.fogRisk': '海雾风险 {p}',
    'f.missing': '缺失',
    'f.vis': ' · 能见度 {km} km',
    'card.models': '各模型怎么看',
    'models.na': '无数据',
    'models.note': '观赏评分是各模型的加权平均；概率看有几个模型达到“明显晚霞”，再按时效和{region}的气候基准收缩。HRRR 分辨率 3 km，最擅长海雾，但只覆盖约 48 小时。',
    'card.near': '附近 110 km 内比较',
    'near.better': '更好',
    'near.note': '距离为直线距离，实际车程请以导航为准。',
    'fb.title': '今天在这里看到晚霞了吗？',
    'fb.glow': '看到明显晚霞',
    'fb.some': '有些颜色',
    'fb.none': '没有（有雾或晴空无云）',
    'fb.thanks': '谢谢！你的回答：{a}',
    'fb.note': '匿名回答，只记录地点、日期、当时显示的评分/概率/置信度和你的选择，用来校准预测概率。每个地点每天只能答一次。',
    'card.region': '地区气候与数据说明',
    'region.disclaimer': '评分与概率均为实验性估计，尚未用实际观测校准。出发前可再刷新一次，或查看实时卫星云图。',

    // regional climate notes
    'note.north': '湿润的太平洋锋面与夏季持久层云。冬春锋面过境前后常有好云，7–9 月沿岸低云最多，9–10 月相对最佳。',
    'note.bay': '夏季海雾经金门海峡（Golden Gate）倒灌，6–8 月海边平地常整晚被雾；Mt Tam、Twin Peaks 等高处可能在雾层之上。9–10 月是晚霞旺季。',
    'note.central': '大苏尔（Big Sur）高崖常处在海洋层顶附近，雾线高度决定成败；圣克鲁兹（Santa Cruz）面朝南，夏季日落落在陆地一侧。',
    'note.socal': '5 月灰、6 月阴（May Gray / June Gloom）；秋冬 Santa Ana 离岸风让空气极通透，但也可能带来山火烟。海峡群岛（Channel Islands）与帕洛斯弗迪斯（Palos Verdes）会遮挡部分海平线。',
    'note.sd': '海洋层通常较浅（300–600 m），Mt Soledad、Torrey Pines、Cabrillo 等高点更容易在雾上；夏末季风偶尔带来高空云。',

    // model warnings
    'warn.noData': '所有气象模型在这个时刻都没有返回数据。',
    'warn.aod': '气溶胶（AOD）数据缺失，空气透明度按保守值 0.88 估计。',
    'warn.path': '日落方向远海采样点缺少数据，光路通畅度按 0.85 估计。',
    'warn.few': (v) => `只有 ${v.n} 个模型返回数据，结果可信度较低。`,
    'warn.noHrrr': '高分辨率 HRRR 模型此时段无数据（常见于 30 小时以后），海雾判断主要依赖全球模型，可能低估低云。',
    'warn.noVis': '能见度数据缺失（仅 HRRR/GFS 提供）。',

    // model reasons
    'r.aboveFog': '观景点海拔约 {elev} m，预计高于海洋层顶（约 {top} m）——有机会俯瞰被夕阳染色的云海。',
    'r.canvasNone': '西边中高云很少：多半是干净的金色落日，难出现大片火烧云。',
    'r.canvasFew': '中高云偏少（约 {cv}%），可能只有零星云彩被染色。',
    'r.canvasGood': (v) => `西边天空约 ${v.cv}% 中高云（${v.kind === 'high' ? '以卷云等高云为主' : '以高积云等中云为主'}）——晚霞的“画布”充足。`,
    'r.canvasThick': '中高云接近满天（约 {cv}%），云层太厚时阳光难以照进来。',
    'r.lightGood': '日落方向 75–250 km 的远海低云少，阳光能从云底下方照亮云层。',
    'r.lightPart': '日落方向远海有部分低云（约 {fl}%），余晖可能被削弱。',
    'r.lightBad': '日落方向远海有成片低云/云堤（约 {fl}%），太阳可能提前没入云中、照不亮天空。',
    'r.fogHigh': (v) => `本地低云/海雾风险高（约 ${v.fr}%）：在海边平地可能什么都看不到。${fogExtra('zh', v)}`,
    'r.fogMid': (v) => `有一定海雾/低云风险（约 ${v.fr}%），雾线进退很难准确预报。${fogExtra('zh', v)}`,
    'r.fogLow': '观景点附近低云和海雾少，视线开阔。',
    'r.visLow': '能见度只有约 {km} km。',
    'r.aodNone': '缺少气溶胶数据，空气透明度按保守值估计。',
    'r.aodClean': '空气通透（AOD {aod}），颜色会更干净饱和。',
    'r.aodLight': '轻度气溶胶（AOD {aod}），色调可能更暖但稍发朦。',
    'r.aodHeavy': (v) => `烟霾较重（AOD ${v.aod}${v.pm25 != null ? `，PM2.5 ${v.pm25}` : ''}）：太阳偏暗红，云彩对比度降低。`,
    'r.horizonOcean': '太阳落向开阔海平线（方位 {az}°）。',
    'r.horizonLand': '这里日落方向（{az}°）被陆地或山体挡住，太阳会提前消失，但头顶的云仍能被照亮。',
    'r.modelSplit': '各模型分歧大（相差约 ±{n} 分），结果不稳定，出发前建议再刷新一次。',
    'r.modelAgree': '多个气象模型的判断比较一致。',
    'r.greenFlash': '海平线干净、空气通透：日落最后一刻有机会看到绿闪。',

    // headlines
    'hl.na': '数据不足，暂时无法评估',
    'hl.aboveFog': '有望在雾层之上看云海晚霞',
    'hl.great': '中高云充足、光路通畅，值得专程去',
    'hl.fog': '本地海雾/低云可能挡住视线',
    'hl.light': '远海低云挡光，余晖可能偏弱',
    'hl.haze': '烟霾较重，颜色发闷',
    'hl.thick': '云层偏厚，阳光可能透不进来',
    'hl.clear': '天空干净，适合看金色落日，难有火烧云',
    'hl.fogSome': '有晚霞的云，但海雾风险不小',
    'hl.lightSome': '有晚霞的云，但远海低云可能挡光',
    'hl.fair': '有一定晚霞机会，条件中等',
    'hl.few': '云彩不多，晚霞机会有限',
  },

  en: {
    'title': 'California Coast Sunset Forecast',
    'meta.desc': 'Sunset and afterglow forecast for the whole California coast: where to go, when to arrive, and why.',
    'sub': 'Where to go · when to arrive · why',
    'btn.method': 'Method & limits',
    'btn.methodShort': 'Method',
    'btn.lang': '中文',
    'btn.langAria': '切换到中文',
    'close': 'Close',
    'aria.daySeg': 'Choose a day',
    'search.ph': 'Search spots: La Jolla, Big Sur, 大苏尔…',
    'aria.search': 'Search spots',
    'aria.answer': 'Recommendation',
    'aria.list': 'Spot ranking',
    'aria.chips': 'Filter by region',
    'aria.map': 'Map',
    'sort.label': 'Sort',
    'sort.score': 'Viewing score',
    'sort.prob': 'Chance',
    'sort.ns': 'North to south',
    'sort.dist': 'Nearest to me',
    'legend.0': 'Flat', 'legend.1': 'Fair', 'legend.2': 'Good', 'legend.3': 'Worth it', 'legend.4': 'Fiery',
    'day.0': 'Today', 'day.1': 'Tomorrow',
    'map.failed': 'The map failed to load; use the list below.',
    'ray.tip': '{km} km · low cloud {p}',

    'list.empty': 'No spots match “{q}”',
    'list.over': 'Over for today',
    'list.sunset': 'Sunset {t}',
    'list.prob': 'chance',

    'ans.noData': 'No forecast data is available for this area yet.',
    'ans.overEyebrow': 'Today',
    'ans.overTitle': 'Today’s sunsets here are over',
    'ans.overWhy': 'See where tomorrow looks good.',
    'ans.overBtn': 'Show tomorrow',
    'ans.eyebrow': '{day}’s best pick on {scope}',
    'ans.eyebrowDull': '{day}: slim chances on {scope} · best bet',
    'scope.all': 'the California coast',
    'ans.open': 'Open details for {name}',
    'ans.countdownHM': 'Arrive in {h} h {m} min',
    'ans.countdownM': 'Arrive in {m} min',
    'ans.glowNow': 'The sunset window is on now',
    'kpi.score': 'Viewing score',
    'kpi.prob': 'Chance · {c} confidence',
    'kpi.arrive': 'Arrive by',
    'kpi.sunset': 'Sunset · {dir}',
    'rb.best': 'Best in {region}',
    'rb.arrive': 'by {t}',
    'coast.climate': '{region} climate: ',

    'status.loading': 'Fetching 5 weather models, marine-layer structure and air quality{p}… this can take half a minute when the server is busy',
    'status.stale': 'Connection unstable — showing data from {age} ago ({t})',
    'status.retry': 'Retry',
    'status.refresh': 'Refresh',
    'status.updated': 'Updated {t}',
    'src.prebuilt': ' (refreshed hourly in the cloud)',
    'src.cache': ' (cached on this device)',
    'src.live': ' (fetched live)',
    'status.partial': 'Some data is missing; affected spots show “No data” or use conservative estimates: {e}',
    'status.todayOver': 'Today’s sunsets are over — showing tomorrow.',
    'status.autoRetry': 'Refresh failed; retrying in 1 minute',
    'status.refreshFail': 'Refresh failed ({e}); still showing the previous data',
    'status.locating': 'Locating…',
    'status.geoUnsupported': 'This browser can’t share your location',
    'status.geoFailed': 'Couldn’t get your location; sorted by score instead',
    'age.hm': '{h} h {m} min',
    'age.m': '{m} min',
    'fail.title': 'Weather data is unavailable right now.',
    'fail.body': 'The free Open-Meteo weather API is responding very slowly or dropping connections (already retried 3 times).<br>The page will try again in 30 seconds, or you can {link} now.',
    'fail.link': 'retry',
    'err.layer': '{layer}: {failed}/{total} batches failed ({reason})',
    'err.sep': '; ',
    'layer.obs': 'spot weather',
    'layer.path': 'offshore clouds toward the sunset',
    'layer.profile': 'marine-layer profile',
    'layer.aq': 'air quality',
    'reason.timeout': 'timed out',
    'reason.network': 'connection dropped',
    'reason.ratelimit': 'rate-limited',

    'label.fire': 'Fiery', 'label.worth': 'Worth the trip', 'label.good': 'Good', 'label.fair': 'Fair', 'label.flat': 'Flat', 'label.na': 'No data',
    'conf.high': 'High', 'conf.mid': 'Medium', 'conf.low': 'Low',

    'sheet.elev': 'elev. ~{m} m',
    'share.btn': 'Share',
    'share.copied': 'Link copied',
    'share.title': '{name} sunset forecast',
    'ring.score': 'Score',
    'stat.prob': 'Chance',
    'stat.probHint': 'of a notable glow (score ≥ 55)',
    'stat.conf': 'Confidence',
    'stat.spread': 'models differ by ±{n}',
    'card.when': 'When to be there {day}',
    'tl.arrive': 'Arrive by',
    'tl.sunset': 'Sunset',
    'tl.peakUntil': 'best until {t}',
    'tl.dusk': 'Dark (civil dusk)',
    'tl.peakTitle': 'Best viewing',
    'tl.hike': 'This spot needs a hike or a drive up, so arrival is 45 min early.',
    'tl.elev': 'Thanks to the elevation, the sun sets ~{n} min later than at the beach.',
    'peak.clear': 'Clear sky: best just before and as the sun meets the horizon; color fades soon after.',
    'peak.high': 'Mostly high (cirrus) cloud: the afterglow usually peaks 5–20 min after sunset — don’t leave early.',
    'peak.mid': 'Mostly mid-level cloud: the best show is within 15 minutes of sunset.',
    'card.why': 'Why',
    'why.none': 'Not enough data to explain this forecast.',
    'card.dir': 'Which way to look',
    'dir.face': 'Face {en} ({az}°)',
    'dir.ocean': 'The sun sets over an open ocean horizon.',
    'dir.land': 'The sun sets behind land or hills here, so it disappears earlier than at an ocean horizon.',
    'dir.sector': 'The blue sector marks open sea.',
    'dir.aboveFog': 'Fog top expected around {m} m — you’ll be above it.',
    'dir.aria': 'Sunset azimuth {az} degrees',
    'profile.aria': 'Cloud cross-section toward the sunset',
    'profile.high': 'High', 'profile.mid': 'Mid', 'profile.low': 'Low', 'profile.you': 'You',
    'profile.cap': 'Cloud cross-section toward the sunset (multi-model weighted): darker means more cloud. A great glow needs mid/high cloud nearby and little low cloud far out. Dashed boxes mean no data.',
    'card.factors': 'Score breakdown',
    'f.canvas': 'Cloud canvas', 'f.canvasHint': 'mid/high cloud cover',
    'f.light': 'Light path', 'f.lightHint': 'offshore low cloud',
    'f.local': 'Local view', 'f.localHint': 'fog / low cloud / visibility',
    'f.clarity': 'Air clarity', 'f.clarityHint': 'AOD',
    'f.note': 'Mid/high cloud {cv} (high {h} · mid {m}) · offshore low cloud {fl} · {fog} · AOD {aod}{vis}',
    'f.aboveFog': 'above the fog',
    'f.fogRisk': 'fog risk {p}',
    'f.missing': 'missing',
    'f.vis': ' · visibility {km} km',
    'card.models': 'What each model says',
    'models.na': 'no data',
    'models.note': 'The viewing score is a weighted average of the models. The chance counts how many models reach a notable glow, then shrinks toward the {region} climate baseline depending on lead time. HRRR (3 km) is best at fog but only covers about 48 hours.',
    'card.near': 'Nearby (within 110 km)',
    'near.better': 'Better',
    'near.note': 'Straight-line distances; check your navigation app for driving time.',
    'fb.title': 'Did you see it here today?',
    'fb.glow': 'A notable glow',
    'fb.some': 'Some color',
    'fb.none': 'Nothing (fog or clear sky)',
    'fb.thanks': 'Thanks! You answered: {a}',
    'fb.note': 'Anonymous: only the spot, date, the score / chance / confidence shown and your answer are recorded, to calibrate the forecast chance. One answer per spot per day.',
    'card.region': 'Regional climate & data notes',
    'region.disclaimer': 'Scores and chances are experimental estimates, not yet calibrated against observations. Refresh before you leave, or check live satellite imagery.',

    'note.north': 'Moist Pacific fronts and persistent summer stratus. Clouds around winter and spring fronts are often good; coastal low cloud peaks July–September, and September–October is relatively best.',
    'note.bay': 'In summer, fog pours in through the Golden Gate and often blankets the shoreline all evening from June to August; high points such as Mt Tam and Twin Peaks may sit above it. September–October is peak sunset season.',
    'note.central': 'Big Sur’s high cliffs often sit right around the marine-layer top, so the fog line decides everything. Santa Cruz faces south, so in summer the sun sets over land.',
    'note.socal': 'May Gray and June Gloom. In fall and winter, offshore Santa Ana winds make the air exceptionally clear but can bring wildfire smoke. The Channel Islands and Palos Verdes block parts of the horizon.',
    'note.sd': 'The marine layer is usually shallow (300–600 m), so high points such as Mt Soledad, Torrey Pines and Cabrillo are more often above it. Late-summer monsoon moisture occasionally brings high cloud.',

    'warn.noData': 'No weather model returned data for this time.',
    'warn.aod': 'Aerosol (AOD) data is missing; air clarity is estimated conservatively at 0.88.',
    'warn.path': 'Offshore sample points toward the sunset are missing; the light path is estimated at 0.85.',
    'warn.few': (v) => `Only ${v.n} model${v.n === 1 ? '' : 's'} returned data, so this forecast is less reliable.`,
    'warn.noHrrr': 'The high-resolution HRRR model has no data for this time (common beyond ~30 hours), so fog relies on global models, which may underestimate low cloud.',
    'warn.noVis': 'Visibility data is missing (only HRRR and GFS provide it).',

    'r.aboveFog': 'At about {elev} m you should be above the marine layer (top ~{top} m) — a chance to look down on a sunlit sea of fog.',
    'r.canvasNone': 'Few mid/high clouds to the west: most likely a clean golden sunset rather than a fiery sky.',
    'r.canvasFew': 'Mid/high clouds are sparse (~{cv}%), so only scattered clouds may light up.',
    'r.canvasGood': (v) => `About ${v.cv}% mid/high cloud to the west (${v.kind === 'high' ? 'mostly cirrus-type high cloud' : 'mostly altocumulus-type mid cloud'}) — plenty of canvas for color.`,
    'r.canvasThick': 'Mid/high cloud is nearly overcast (~{cv}%); thick layers can keep the sunlight out.',
    'r.lightGood': 'Little low cloud 75–250 km out toward the sunset, so sunlight can reach the cloud bases.',
    'r.lightPart': 'Some low cloud far offshore toward the sunset (~{fl}%) may weaken the afterglow.',
    'r.lightBad': 'A bank of low cloud far offshore (~{fl}%) may swallow the sun early and leave the sky unlit.',
    'r.fogHigh': (v) => `High risk of local fog or low cloud (~${v.fr}%): from beach level you may see nothing.${fogExtra('en', v)}`,
    'r.fogMid': (v) => `Some risk of fog or low cloud (~${v.fr}%); the fog line is hard to forecast.${fogExtra('en', v)}`,
    'r.fogLow': 'Little low cloud or fog near the spot; a clear line of sight.',
    'r.visLow': 'Visibility is only about {km} km.',
    'r.aodNone': 'No aerosol data; air clarity uses a conservative estimate.',
    'r.aodClean': 'Clean air (AOD {aod}) — colors should be crisp and saturated.',
    'r.aodLight': 'Light aerosols (AOD {aod}): warmer tones, slightly hazy.',
    'r.aodHeavy': (v) => `Heavy haze or smoke (AOD ${v.aod}${v.pm25 != null ? `, PM2.5 ${v.pm25}` : ''}): a dim red sun and low-contrast clouds.`,
    'r.horizonOcean': 'The sun sets toward an open ocean horizon (azimuth {az}°).',
    'r.horizonLand': 'The sunset direction here ({az}°) is blocked by land, so the sun disappears early — but clouds overhead can still light up.',
    'r.modelSplit': 'The models disagree a lot (about ±{n} points); refresh before you leave.',
    'r.modelAgree': 'The weather models largely agree.',
    'r.greenFlash': 'Clean horizon and clear air: a chance of a green flash at the very last moment.',

    'hl.na': 'Not enough data to assess',
    'hl.aboveFog': 'A shot at a sea-of-fog sunset from above',
    'hl.great': 'Plenty of mid/high cloud and a clear light path — go for it',
    'hl.fog': 'Local fog or low cloud may block the view',
    'hl.light': 'Offshore low cloud may dim the afterglow',
    'hl.haze': 'Heavy haze — muted colors',
    'hl.thick': 'Cloud too thick — sunlight may not get through',
    'hl.clear': 'Clear sky: a golden sunset, unlikely to be fiery',
    'hl.fogSome': 'Good clouds, but a real risk of fog',
    'hl.lightSome': 'Good clouds, but offshore low cloud may block the light',
    'hl.fair': 'Some chance of color; middling conditions',
    'hl.few': 'Few clouds; a limited chance of color',
  },
};

// Optional sentences appended to the fog reasons.
function fogExtra(lang, v) {
  let s = '';
  if (v.hrrr != null) s += lang === 'zh'
    ? `高分辨率 HRRR 显示约 ${v.hrrr}% 低云，全球模式只有 ${v.glob}%，后者常低估海洋层。`
    : ` The high-resolution HRRR shows ~${v.hrrr}% low cloud versus ${v.glob}% in the global models, which often miss the marine layer.`;
  if (v.inv) s += lang === 'zh' ? '近地面逆温强、湿度高，典型的海洋层天气。' : ' A strong low-level inversion and high humidity — classic marine-layer weather.';
  return s;
}

// ---------- current language ----------
const STORE_KEY = 'ca-sunset-lang';
export let lang = 'zh';

/** URL ?lang= wins, then the viewer's saved choice, then the browser language. */
export function detectLang() {
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'zh' || q === 'en') return q;
  try { const s = localStorage.getItem(STORE_KEY); if (s === 'zh' || s === 'en') return s; } catch {}
  const nav = (navigator.languages && navigator.languages[0]) || navigator.language || '';
  return /^zh/i.test(nav) ? 'zh' : 'en';
}

export function setLang(l, { remember = false } = {}) {
  lang = l === 'en' ? 'en' : 'zh';
  if (remember) { try { localStorage.setItem(STORE_KEY, lang); } catch {} }
  fmt = makeFormatters(lang);
}

/** Translate a key. Falls back to Chinese, then to the key itself (tests flag both). */
export function tr(key, vars = {}) {
  const v = STRINGS[lang][key] ?? STRINGS.zh[key];
  if (v == null) return key;
  if (typeof v === 'function') return v(vars);
  return v.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
}

// ---------- formatting ----------
let fmt = makeFormatters(lang);
function makeFormatters(l) {
  return l === 'en'
    ? {
      time: new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }),
      day: new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', month: 'numeric', day: 'numeric' }),
    }
    : {
      time: new Intl.DateTimeFormat('zh-CN', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }),
      day: new Intl.DateTimeFormat('zh-CN', { timeZone: TZ, month: 'numeric', day: 'numeric', weekday: 'short' }),
    };
}
/** Clock time as plain text ("18:46" / "6:46 PM"). */
export const fmtTime = (ms) => fmt.time.format(new Date(ms));
/** Clock time for large numerals: the AM/PM marker is shrunk so it fits small tiles. */
export function fmtTimeHtml(ms) {
  if (lang !== 'en') return fmtTime(ms);
  return fmt.time.formatToParts(new Date(ms))
    .map((p) => (p.type === 'dayPeriod' ? `<small class="ampm">${p.value}</small>` : p.value.trim() ? p.value : ' ')).join('');
}
export function fmtDay(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return fmt.day.format(new Date(Date.UTC(y, m - 1, d, 20)));
}

// ---------- place names (always bilingual; the current language comes first) ----------
export const placeName = (s) => (lang === 'en' ? { main: s.en, alt: s.name } : { main: s.name, alt: s.en });
export const regionLabel = (r) => (lang === 'en' ? `${r.en} ${r.name}` : `${r.name} ${r.en}`);
export const regionParen = (r) => (lang === 'en' ? `${r.en} (${r.name})` : `${r.name}（${r.en}）`);
