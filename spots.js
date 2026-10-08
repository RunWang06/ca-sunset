// Coastal climate regions. fog = rough monthly frequency of a coastal marine layer / fog at
// sunset (Jan..Dec); base = rough prior that a random evening produces a notable glow.
// These are coarse climatology priors used only to temper probabilities, not forecasts.
export const REGIONS = [
  {
    id: 'north', name: '北海岸', en: 'North Coast',
    note: '湿润的太平洋锋面与夏季持久层云。冬春锋面过境前后常有好云，7–9 月沿岸低云最多，9–10 月相对最佳。',
    fog: [0.35, 0.35, 0.35, 0.4, 0.5, 0.6, 0.7, 0.72, 0.55, 0.4, 0.35, 0.35],
    base: [0.24, 0.24, 0.22, 0.18, 0.12, 0.1, 0.1, 0.12, 0.18, 0.22, 0.24, 0.25],
  },
  {
    id: 'bay', name: '湾区', en: 'Bay Area',
    note: '夏季海雾经金门海峡（Golden Gate）倒灌，6–8 月海边平地常整晚被雾；Mt Tam、Twin Peaks 等高处可能在雾层之上。9–10 月是晚霞旺季。',
    fog: [0.2, 0.2, 0.25, 0.3, 0.45, 0.62, 0.75, 0.75, 0.5, 0.35, 0.25, 0.2],
    base: [0.24, 0.24, 0.22, 0.18, 0.12, 0.1, 0.1, 0.12, 0.2, 0.24, 0.25, 0.25],
  },
  {
    id: 'central', name: '中央海岸', en: 'Central Coast',
    note: '大苏尔（Big Sur）高崖常处在海洋层顶附近，雾线高度决定成败；圣克鲁兹（Santa Cruz）面朝南，夏季日落落在陆地一侧。',
    fog: [0.25, 0.25, 0.3, 0.35, 0.5, 0.6, 0.7, 0.7, 0.5, 0.35, 0.25, 0.25],
    base: [0.24, 0.24, 0.22, 0.18, 0.12, 0.1, 0.1, 0.12, 0.2, 0.23, 0.25, 0.25],
  },
  {
    id: 'socal', name: '南加州', en: 'SoCal',
    note: '5 月灰、6 月阴（May Gray / June Gloom）；秋冬 Santa Ana 离岸风让空气极通透，但也可能带来山火烟。海峡群岛（Channel Islands）与帕洛斯弗迪斯（Palos Verdes） 会遮挡部分海平线。',
    fog: [0.2, 0.25, 0.3, 0.4, 0.6, 0.65, 0.5, 0.45, 0.35, 0.25, 0.2, 0.2],
    base: [0.26, 0.26, 0.24, 0.18, 0.1, 0.08, 0.12, 0.14, 0.18, 0.22, 0.26, 0.28],
  },
  {
    id: 'sd', name: '圣地亚哥', en: 'San Diego',
    note: '海洋层通常较浅（300–600 m），Mt Soledad、Torrey Pines、Cabrillo 等高点更容易在雾上；夏末季风偶尔带来高空云。',
    fog: [0.2, 0.25, 0.3, 0.4, 0.6, 0.65, 0.5, 0.4, 0.35, 0.25, 0.2, 0.2],
    base: [0.26, 0.26, 0.24, 0.18, 0.1, 0.08, 0.14, 0.16, 0.18, 0.22, 0.26, 0.28],
  },
];

export const REGION_BY_ID = Object.fromEntries(REGIONS.map((r) => [r.id, r]));

// view: compass sector [from, to] (clockwise) where the horizon is open sea.
// elev: viewing height in metres. hike: needs a walk / drive up, arrive earlier.
const S = (id, region, name, en, lat, lon, elev, view, extra = {}) => ({ id, region, name, en, lat, lon, elev, view, ...extra });

export const SPOTS = [
  S('crescent', 'north', '新月城 · 炮台角灯塔', 'Battery Point Lighthouse, Crescent City', 41.744, -124.203, 8, [200, 320]),
  S('sumeg', 'north', '苏梅格州立公园', "Sue-meg (Patrick's Point)", 41.135, -124.160, 60, [200, 320]),
  S('trinidad', 'north', '特立尼达州立海滩', 'Trinidad State Beach', 41.065, -124.150, 20, [190, 315]),
  S('samoa', 'north', '尤里卡 · 萨摩亚海滩', 'Samoa Beach, Eureka', 40.800, -124.195, 6, [200, 330]),
  S('shelter', 'north', '庇护湾', 'Shelter Cove', 40.024, -124.073, 25, [160, 290]),
  S('fortbragg', 'north', '布拉格堡 · 玻璃海滩', 'Glass Beach, Fort Bragg', 39.452, -123.815, 10, [200, 330]),
  S('mendocino', 'north', '门多西诺岬', 'Mendocino Headlands', 39.305, -123.805, 20, [190, 330]),
  S('ptarena', 'north', '阿里纳角灯塔', 'Point Arena Lighthouse', 38.954, -123.740, 20, [180, 350]),
  S('searanch', 'north', '海牧场', 'The Sea Ranch', 38.700, -123.450, 25, [180, 320]),
  S('bodega', 'north', '博德加岬', 'Bodega Head', 38.303, -123.066, 60, [170, 320]),

  S('ptreyes', 'bay', '雷耶斯角灯塔', 'Point Reyes Lighthouse', 37.996, -123.022, 80, [150, 330]),
  S('tam', 'bay', '塔玛佩斯山东峰', 'Mt. Tamalpais East Peak', 37.929, -122.578, 760, [180, 330], { hike: true }),
  S('muir', 'bay', '缪尔海滩观景台', 'Muir Beach Overlook', 37.862, -122.590, 130, [180, 290]),
  S('hawk', 'bay', '鹰山 · 马林岬', 'Hawk Hill, Marin Headlands', 37.826, -122.499, 280, [200, 300], { hike: true }),
  S('landsend', 'bay', '大地尽头 · 苏特罗浴场', 'Lands End / Sutro Baths', 37.780, -122.513, 30, [220, 320]),
  S('oceanbeach', 'bay', '旧金山海洋海滩', 'Ocean Beach SF', 37.760, -122.511, 5, [200, 320]),
  S('twinpeaks', 'bay', '双子峰', 'Twin Peaks', 37.752, -122.447, 280, [210, 300]),
  S('mori', 'bay', '帕西菲卡 · 莫里角', 'Mori Point, Pacifica', 37.616, -122.494, 60, [200, 300]),
  S('pillar', 'bay', '半月湾 · 皮拉角', 'Pillar Point, Half Moon Bay', 37.495, -122.498, 20, [170, 280]),
  S('pigeon', 'bay', '鸽子角灯塔', 'Pigeon Point Lighthouse', 37.182, -122.394, 20, [160, 320]),

  S('westcliff', 'central', '圣克鲁兹 · 西崖大道', 'West Cliff Drive, Santa Cruz', 36.951, -122.040, 15, [150, 255]),
  S('natbridges', 'central', '天然桥州立海滩', 'Natural Bridges', 36.951, -122.058, 5, [160, 262]),
  S('moss', 'central', '莫斯兰丁', 'Moss Landing', 36.804, -121.789, 5, [230, 300]),
  S('asilomar', 'central', '太平洋丛林 · 阿西洛玛', 'Asilomar, Pacific Grove', 36.617, -121.937, 10, [200, 320]),
  S('carmel', 'central', '卡梅尔海滩', 'Carmel Beach', 36.553, -121.928, 10, [200, 290]),
  S('garrapata', 'central', '加拉帕塔 · 索贝拉内斯角', 'Garrapata / Soberanes Point', 36.452, -121.928, 30, [190, 300]),
  S('bixby', 'central', '比克斯比大桥', 'Bixby Bridge, Big Sur', 36.371, -121.902, 80, [180, 280]),
  S('pfeiffer', 'central', '菲佛海滩', 'Pfeiffer Beach', 36.238, -121.816, 10, [200, 300]),
  S('mcway', 'central', '麦克维瀑布', 'McWay Falls', 36.158, -121.672, 60, [180, 280]),
  S('ragged', 'central', '粗糙角', 'Ragged Point', 35.778, -121.330, 120, [180, 320]),
  S('moonstone', 'central', '坎布里亚 · 月光石海滩', 'Moonstone Beach, Cambria', 35.574, -121.112, 10, [200, 300]),
  S('morro', 'central', '莫罗岩', 'Morro Rock', 35.371, -120.866, 5, [200, 320]),
  S('montana', 'central', '蒙塔尼亚德奥罗', 'Montaña de Oro Bluff Trail', 35.270, -120.890, 30, [190, 310]),
  S('pismo', 'central', '皮斯莫海滩码头', 'Pismo Beach Pier', 35.138, -120.643, 10, [190, 265]),

  S('ellwood', 'socal', '戈利塔 · 埃尔伍德崖', 'Ellwood Bluffs, Goleta', 34.418, -119.890, 20, [170, 245]),
  S('sbshore', 'socal', '圣塔芭芭拉 · 海岸线公园', 'Shoreline Park, Santa Barbara', 34.401, -119.711, 30, [160, 255]),
  S('ventura', 'socal', '文图拉码头', 'Ventura Pier', 34.274, -119.290, 5, [180, 285]),
  S('elmatador', 'socal', '埃尔马塔多海滩', 'El Matador State Beach', 34.038, -118.874, 20, [170, 260]),
  S('dume', 'socal', '杜姆角', 'Point Dume, Malibu', 34.001, -118.807, 60, [150, 290]),
  S('smpier', 'socal', '圣莫尼卡码头', 'Santa Monica Pier', 34.008, -118.499, 5, [190, 265]),
  S('venice', 'socal', '威尼斯海滩', 'Venice Beach', 33.985, -118.473, 5, [195, 265]),
  S('griffith', 'socal', '格里菲斯天文台', 'Griffith Observatory', 34.118, -118.300, 340, [220, 265]),
  S('manhattan', 'socal', '曼哈顿海滩码头', 'Manhattan Beach Pier', 33.884, -118.411, 5, [210, 290]),
  S('vicente', 'socal', '帕洛斯弗迪斯 · 文森特角', 'Point Vicente, Palos Verdes', 33.742, -118.411, 40, [180, 320]),
  S('huntington', 'socal', '亨廷顿海滩码头', 'Huntington Beach Pier', 33.655, -118.005, 5, [190, 280]),
  S('cdm', 'socal', '科罗纳德尔马 · 瞭望角', 'Lookout Point, Corona del Mar', 33.594, -117.877, 30, [190, 275]),
  S('heisler', 'socal', '拉古纳海滩 · 海斯勒公园', 'Heisler Park, Laguna Beach', 33.545, -117.789, 20, [190, 300]),
  S('danapt', 'socal', '达纳角岬', 'Dana Point Headlands', 33.459, -117.715, 60, [180, 290]),
  S('sanclemente', 'socal', '圣克莱门特码头', 'San Clemente Pier', 33.419, -117.620, 5, [190, 300]),

  S('oceanside', 'sd', '欧申赛德码头', 'Oceanside Pier', 33.193, -117.386, 5, [200, 320]),
  S('carlsbad', 'sd', '卡尔斯巴德州立海滩', 'Carlsbad State Beach', 33.150, -117.348, 10, [200, 320]),
  S('swamis', 'sd', '恩西尼塔斯 · 斯瓦米', "Swami's, Encinitas", 33.035, -117.293, 25, [200, 320]),
  S('gliderport', 'sd', '托里松滑翔机场', 'Torrey Pines Gliderport', 32.890, -117.251, 100, [200, 330]),
  S('lajolla', 'sd', '拉霍亚 · 斯克里普斯公园', 'La Jolla Cove / Scripps Park', 32.850, -117.272, 10, [230, 340]),
  S('soledad', 'sd', '索莱达山', 'Mount Soledad', 32.840, -117.245, 250, [200, 330]),
  S('sunsetcliffs', 'sd', '日落崖', 'Sunset Cliffs', 32.720, -117.256, 20, [190, 320]),
  S('cabrillo', 'sd', '卡布里略国家纪念地', 'Cabrillo National Monument', 32.672, -117.241, 120, [190, 300]),
  S('coronado', 'sd', '科罗纳多海滩', 'Coronado Beach', 32.682, -117.183, 5, [190, 290]),
];
