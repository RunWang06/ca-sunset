import json, statistics as st
R = json.load(open('backtest/results.json'))
rows = [r for r in R['rows'] if r.get('hybrid')]
W0 = {'HRRR': .35, 'ECMWF': .27, 'GFS': .19, 'ICON': .19}
FOG = {'north': [0.35,0.35,0.35,0.4,0.5,0.6,0.7,0.72,0.55,0.4,0.35,0.35], 'bay': [0.2,0.2,0.25,0.3,0.45,0.62,0.75,0.75,0.5,0.35,0.25,0.2],
       'central': [0.25,0.25,0.3,0.35,0.5,0.6,0.7,0.7,0.5,0.35,0.25,0.25], 'socal': [0.2,0.25,0.3,0.4,0.6,0.65,0.5,0.45,0.35,0.25,0.2,0.2],
       'sd': [0.2,0.25,0.3,0.4,0.6,0.65,0.5,0.4,0.35,0.25,0.2,0.2]}
def fog_risk(r, wH):
    # Mirrors model.js: wH·HRRR + (0.85−wH)·weighted mean of all members + 0.15·climatology (member low as effLow proxy).
    ms = {m: v['low'] for m, v in r['models'].items() if v.get('low') is not None}
    if not ms: return None
    mean = sum(W0[m] * x for m, x in ms.items()) / sum(W0[m] for m in ms)
    h = ms.get('HRRR'); w = wH if h is not None else 0
    return min(1, max(0, w * (h or 0) + (0.85 - w) * mean + 0.15 * FOG[r['region']][int(r['date'][5:7]) - 1]))
def cont(rs, wH, thr):
    a = b = c = d = 0
    for r in rs:
        f = fog_risk(r, wH)
        if f is None: continue
        p, o = f >= thr, r['hybrid']['low'] >= 0.75   # METAR BKN/OVC/VV below 6500 ft
        a += p and o; b += p and not o; c += (not p) and o; d += (not p) and not o
    n = a + b + c + d
    e = ((a + b) * (a + c) + (c + d) * (b + d)) / n
    hss = (a + d - e) / (n - e) if n - e else 0
    return hss, (b / (a + b) if a + b else 0), (a / (a + c) if a + c else 0), n, a, b
dates = sorted({r['date'] for r in rows}); half = dates[len(dates)//2]
W = [0.5, 0.35, 0.25, 0.15, 0.0]
for reg in ['socal', 'sd', 'socal+sd', 'other (unchanged)']:
    rs = [r for r in rows if (r['region'] in ('socal', 'sd') if reg == 'socal+sd' else r['region'] not in ('socal', 'sd') if reg.startswith('other') else r['region'] == reg)]
    print(f"\n== {reg}: n={len(rs)}, observed fog/low deck {st.mean(r['hybrid']['low'] >= .75 for r in rs):.0%}")
    for thr, name in [(0.6, '"high fog risk" (≥60%)'), (0.3, '"some fog risk" (≥30%)')]:
        print(f"  {name}")
        for wH in W:
            hss, far, pod, n, hits, fa = cont(rs, wH, thr)
            h1 = cont([r for r in rs if r['date'] < half], wH, thr)[0]; h2 = cont([r for r in rs if r['date'] >= half], wH, thr)[0]
            print(f"    wH={wH:<4}: HSS {hss:5.2f} (1st half {h1:5.2f} / 2nd half {h2:5.2f})  false-alarm {far:4.0%}  hit {pod:4.0%}  warnings {hits+fa}")
