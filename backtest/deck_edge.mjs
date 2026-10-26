// "Cloud deck with a western edge" detector — EXPERIMENT ONLY, not used by the live model.
//
// The classic big afterglow: a mid/high deck covers the sky overhead but ends somewhere toward the
// sun, with clear air beyond it. After sunset the sun shines in under the edge and lights the whole
// deck from below (sunsetbot.top treats the cloud-edge distance as a key input). The site's formula
// scores the same situation low twice: the overhead deck is "overcast" (canvas ≤ 0.6) and the deck's
// own extension toward the sun counts as mid cloud blocking the light path.
//
// Input: one member's path aligned with PATH_KM ([observer, 25, 75, 150, 250, 300, 350 km]), each
// point { low, mid, high } as fractions. Thresholds were fixed before looking at any results.
import { PATH_KM, canvasKind } from '../model.js';

export const DECK = {
  cover: 0.7,     // canvas (observer / 25 / 75 km, weights .35 / .4 / .25) at least this covered
  open: 0.35,     // the canvas layer drops below this at the edge …
  stayOpen: 0.5,  // … and stays below this further out
  lowClear: 0.4,  // strict variant: mean low cloud beyond the edge below this
  reach: { mid: 240, high: 350, mix: 350 }, // km; how far out an edge can still light the deck (LIGHT in model.js)
  minKm: 150,     // edges closer than this are a broken sky, not a deck
};

const cov = (c) => 1 - (1 - (c.high ?? 0)) * (1 - (c.mid ?? 0));
const wmean = (pts) => { let s = 0, w = 0; for (const [v, k] of pts) if (v != null) { s += v * k; w += k; } return w ? s / w : null; };

/** Returns { deck, kind, edgeKm, lowBeyond, edge, fires (strict), firesLenient } or null without data. */
export function deckEdge(path) {
  const near = [[path[0], 0.35], [path[1], 0.4], [path[2], 0.25]].filter(([c]) => c && c.mid != null);
  if (!near.length) return null;
  const cv = wmean(near.map(([c, w]) => [cov(c), w]));
  const kind = canvasKind(wmean(near.map(([c, w]) => [c.high, w])), wmean(near.map(([c, w]) => [c.mid, w])));
  // What has to clear for the light to get under the deck: a mid deck only needs the mid layer to
  // end (high cloud further out sits above the ray); a high or mixed deck needs mid and high gone.
  const upper = (c) => (kind === 'mid' ? c.mid ?? 0 : cov(c));
  const deck = cv >= DECK.cover;
  let edgeKm = null, edgeIdx = -1;
  for (let i = 1; i < PATH_KM.length; i++) {
    const km = PATH_KM[i], c = path[i];
    if (km < DECK.minKm || km > DECK.reach[kind] || !c || c.mid == null) continue;
    if (upper(c) < DECK.open && path.slice(i + 1).every((d) => !d || d.mid == null || upper(d) < DECK.stayOpen)) { edgeKm = km; edgeIdx = i; break; }
  }
  const lowBeyond = edgeIdx < 0 ? null : wmean(path.slice(edgeIdx).filter((c) => c && c.low != null).map((c) => [c.low, 1]));
  const edge = deck && edgeKm != null;
  return { deck, cv, kind, edgeKm, lowBeyond, edge, fires: edge && lowBeyond != null && lowBeyond < DECK.lowClear, firesLenient: edge };
}

/** Weighted share of members that fire (strict / lenient). members: [{ w, path }]. */
export function ensembleShare(members) {
  let s = 0, l = 0, w = 0;
  for (const m of members) {
    const d = deckEdge(m.path);
    if (!d) continue;
    w += m.w; if (d.fires) s += m.w; if (d.firesLenient) l += m.w;
  }
  return w ? { strict: s / w, lenient: l / w } : null;
}
