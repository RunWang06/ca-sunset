import json, statistics as st
R = json.load(open('backtest/results.json'))
rows = [r for r in R['rows'] if r.get('hybrid')]
W0 = {'HRRR': .35, 'ECMWF': .27, 'GFS': .19, 'ICON': .19}   # today's weights in model.js
def ens(r, k):
    w = dict(W0)
    if r['region'] in ('socal', 'sd'): w['HRRR'] *= k
    num = den = 0
    for m, v in r['models'].items():
        if v.get('score') is None: continue
        num += w[m] * v['score']; den += w[m]
    return num / den if den else None
# 1) sanity: k=1 reproduces the backtest's ensemble score
diff = [abs(round(ens(r, 1)) - r['ens']) for r in rows]
print(f"sanity k=1 vs stored ens: max |diff| = {max(diff)}, mean = {st.mean(diff):.2f}")
def band(s): return 4 if s >= 80 else 3 if s >= 65 else 2 if s >= 45 else 1 if s >= 25 else 0
def metrics(rs, k):
    e = [(ens(r, k), r['hybrid']['score']) for r in rs]
    e = [(a, b) for a, b in e if a is not None]
    mae = st.mean(abs(a - b) for a, b in e); bias = st.mean(a - b for a, b in e)
    same = st.mean(band(a) == band(b) for a, b in e)
    # "worth going" decisions (>=45) vs truth
    tp = sum(a >= 45 and b >= 45 for a, b in e); fp = sum(a >= 45 and b < 45 for a, b in e); fn = sum(a < 45 and b >= 45 for a, b in e)
    return mae, bias, same, len(e), tp, fp, fn
dates = sorted({r['date'] for r in rows}); half = dates[len(dates)//2]
A = lambda rs: [r for r in rs if r['date'] < half]; B = lambda rs: [r for r in rs if r['date'] >= half]
KS = [1, .75, .5, .25, 0]
for reg in ['socal', 'sd', 'socal+sd']:
    rs = [r for r in rows if (r['region'] in ('socal', 'sd')) if reg == 'socal+sd' or r['region'] == reg]
    print(f"\n== {reg}: n={len(rs)}  ({dates[0]}…{half} | {half}…{dates[-1]})")
    print("  k     | all: MAE  bias  same-band | 1st half MAE | 2nd half MAE | worth-going TP/FP/FN")
    for k in KS:
        m = metrics(rs, k); a = metrics(A(rs), k); b = metrics(B(rs), k)
        print(f"  {k:<5} | {m[0]:5.2f} {m[1]:+5.1f}   {m[2]:.0%}     | {a[0]:6.2f}       | {b[0]:6.2f}       | {m[4]}/{m[5]}/{m[6]}")
    # 2-fold out-of-sample: choose k on one half, score on the other
    for name, tr, te in [('fit 1st→test 2nd', A(rs), B(rs)), ('fit 2nd→test 1st', B(rs), A(rs))]:
        kbest = min(KS, key=lambda k: metrics(tr, k)[0])
        print(f"  {name}: best k={kbest}  test MAE {metrics(te, 1)[0]:.2f} → {metrics(te, kbest)[0]:.2f}")
# other regions unaffected?
other = [r for r in rows if r['region'] not in ('socal', 'sd')]
print(f"\nother regions (unchanged): MAE {metrics(other, 1)[0]:.2f} / {metrics(other, 0.5)[0]:.2f}")
