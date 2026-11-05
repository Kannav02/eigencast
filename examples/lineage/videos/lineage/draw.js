// Score, Loss, Wall: canvas scene drawing, ported from the HTML player.
// Every frame is a pure function of (scene index, scene time), so Remotion can render any frame directly.
import { COLORS as C, FONTS } from "eigencast/draw";

const FONT = { mono: FONTS.mono, display: FONTS.display, body: FONTS.body };
let ctx = null;
const TEXT_SCALE = 1.12; // Computer Modern has a small x-height; sizes below are in design px

// ---------- math helpers ----------
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const prog = (t, a, b) => clamp((t - a) / (b - a));
const ease = u => u * u * (3 - 2 * u);
const lerp = (a, b, u) => a + (b - a) * u;
const sig = z => 1 / (1 + Math.exp(-z));
const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function gauss(r) { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }

// ---------- datasets ----------
const r1 = mulberry32(7);
const D1 = []; for (let i = 0; i < 14; i++) { const x = 0.5 + i * 0.7; D1.push({ x, y: 1 + 0.6 * x + 0.7 * gauss(r1) }); }
const r2 = mulberry32(11);
const D2 = []; for (let i = 0; i < 24; i++) { const x = 0.3 + i * (9.4 / 23); D2.push({ x, y: (x + 1.0 * gauss(r2) > 5) ? 1 : 0 }); }
function makeBump(seed, n) {
  const r = mulberry32(seed), out = [];
  for (let i = 0; i < n; i++) {
    const x = clamp(0.2 + i * (9.6 / (n - 1)) + (r() - 0.5) * 0.2, 0, 10);
    const inside = x > 3.5 && x < 6.5;
    out.push({ x, y: (inside ? r() < 0.92 : r() < 0.04) ? 1 : 0 });
  }
  return out;
}
const D3 = makeBump(8, 44), D3v = makeBump(99, 44);

// ---------- models ----------
function ols(pts) {
  const mx = mean(pts.map(p => p.x)), my = mean(pts.map(p => p.y));
  let sxy = 0, sxx = 0; pts.forEach(p => { sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) ** 2; });
  const w = sxy / sxx; return { w, b: my - w * mx, my };
}
/** Logistic regression by batch gradient descent.
 *  1. Start at w = b = 0 (p = 0.5 everywhere).
 *  2. Each step: gradient of mean log loss is mean((p - y)·x) and mean(p - y).
 *  3. Save snapshots so the animation can replay the descent. */
function logisticFit(pts, iters = 6000, lr = 0.05) {
  let w = 0, b = 0; const snaps = [{ w, b }];
  for (let k = 1; k <= iters; k++) {
    let gw = 0, gb = 0;
    for (const p of pts) { const e = sig(w * p.x + b) - p.y; gw += e * p.x; gb += e; }
    w -= lr * gw / pts.length; b -= lr * gb / pts.length;
    if (k % 60 === 0) snaps.push({ w, b });
  }
  return { w, b, snaps };
}
function snapAt(snaps, u) {
  const k = u * u * (snaps.length - 1), i = Math.floor(k), j = Math.min(i + 1, snaps.length - 1), f = k - i;
  return { w: lerp(snaps[i].w, snaps[j].w, f), b: lerp(snaps[i].b, snaps[j].b, f) };
}
const logloss = (pts, pFn) => mean(pts.map(p => { const q = clamp(pFn(p), 1e-6, 1 - 1e-6); return -(p.y * Math.log(q) + (1 - p.y) * Math.log(1 - q)); }));
const gini2 = (n1, n) => n ? 2 * (n1 / n) * (1 - n1 / n) : 0;

/** CART classification tree on one feature.
 *  1. Sort rows by x.
 *  2. Try every cut between distinct x values; keep the one with lowest weighted Gini.
 *  3. Recurse on both sides until depth runs out or a node is pure. */
function fitGini(pts, depth) {
  function build(arr, d) {
    const n = arr.length, n1 = arr.reduce((s, p) => s + p.y, 0);
    const node = { leaf: true, v: n1 / n, n, n1 };
    if (d === 0 || n < 2 || n1 === 0 || n1 === n) return node;
    let best = null, bestImp = gini2(n1, n) * n - 1e-9, c1 = 0;
    for (let i = 1; i < n; i++) {
      c1 += arr[i - 1].y;
      if (arr[i].x === arr[i - 1].x) continue;
      const imp = gini2(c1, i) * i + gini2(n1 - c1, n - i) * (n - i);
      if (imp < bestImp) { bestImp = imp; best = i; }
    }
    if (best === null) return node;
    return { leaf: false, thr: (arr[best - 1].x + arr[best].x) / 2, n, n1, v: n1 / n, L: build(arr.slice(0, best), d - 1), R: build(arr.slice(best), d - 1) };
  }
  return build([...pts].sort((a, b) => a.x - b.x), depth);
}
function pred(node, x) { while (!node.leaf) node = x < node.thr ? node.L : node.R; return node.v; }
function leaves(node, out = []) { if (node.leaf) out.push(node); else { leaves(node.L, out); leaves(node.R, out); } return out; }
function boot(pts, seed) {
  const r = mulberry32(seed), n = pts.length, counts = new Array(n).fill(0), out = [];
  for (let i = 0; i < n; i++) { const k = Math.floor(r() * n); counts[k]++; out.push(pts[k]); }
  return { pts: out, counts };
}

/** XGBoost-style regression tree on gradients.
 *  1. Leaf value = -G / (H + lambda) from summed gradients and hessians.
 *  2. Split gain = GL²/(HL+λ) + GR²/(HR+λ) - G²/(H+λ); keep the best positive cut.
 *  3. Recurse to the given depth. */
function fitXGB(pts, g, h, depth, lambda) {
  const idx = pts.map((_, i) => i).sort((a, b) => pts[a].x - pts[b].x);
  function build(ids, d) {
    let G = 0, Hs = 0; for (const i of ids) { G += g[i]; Hs += h[i]; }
    const leaf = { leaf: true, v: -G / (Hs + lambda) };
    if (d === 0 || ids.length < 2) return leaf;
    const base = G * G / (Hs + lambda); let best = -1, bg = 1e-6, GL = 0, HL = 0;
    for (let k = 1; k < ids.length; k++) {
      GL += g[ids[k - 1]]; HL += h[ids[k - 1]];
      if (pts[ids[k]].x === pts[ids[k - 1]].x) continue;
      const GR = G - GL, HR = Hs - HL;
      const gain = GL * GL / (HL + lambda) + GR * GR / (HR + lambda) - base;
      if (gain > bg) { bg = gain; best = k; }
    }
    if (best < 0) return leaf;
    return { leaf: false, thr: (pts[ids[best - 1]].x + pts[ids[best]].x) / 2, L: build(ids.slice(0, best), d - 1), R: build(ids.slice(best), d - 1) };
  }
  return build(idx, depth);
}
const GRID = Array.from({ length: 241 }, (_, i) => i * 10 / 240);
/** Binary gradient boosting with log loss.
 *  1. Start every score at log prior odds.
 *  2. Each round: g = p - y, h = p(1 - p); fit a tree; add eta * tree to scores.
 *  3. Record scores on train rows and a plotting grid, plus train/val loss. */
function boost(train, val, depth, eta, rounds, lambda = 1) {
  const prior = mean(train.map(p => p.y)), F0 = Math.log(prior / (1 - prior));
  let F = train.map(() => F0), Fv = val.map(() => F0), Fg = GRID.map(() => F0);
  const ll = (pts, Fs) => mean(pts.map((p, i) => { const q = clamp(sig(Fs[i]), 1e-6, 1 - 1e-6); return -(p.y * Math.log(q) + (1 - p.y) * Math.log(1 - q)); }));
  const out = { prior, F0, Fg: [Fg.slice()], Fp: [F.slice()], trees: [null], tr: [ll(train, F)], va: [ll(val, Fv)] };
  for (let r = 1; r <= rounds; r++) {
    const g = F.map((f, i) => sig(f) - train[i].y), h = F.map(f => { const p = sig(f); return p * (1 - p); });
    const tree = fitXGB(train, g, h, depth, lambda);
    F = F.map((f, i) => f + eta * pred(tree, train[i].x));
    Fv = Fv.map((f, i) => f + eta * pred(tree, val[i].x));
    Fg = Fg.map((f, i) => f + eta * pred(tree, GRID[i]));
    out.Fg.push(Fg.slice()); out.Fp.push(F.slice()); out.trees.push(tree);
    out.tr.push(ll(train, F)); out.va.push(ll(val, Fv));
  }
  return out;
}
const interpArr = (arr, r) => { const i = Math.min(Math.floor(r), arr.length - 1), j = Math.min(i + 1, arr.length - 1), f = r - i; return arr[i].map((v, k) => lerp(v, arr[j][k], f)); };

// precompute
const fitD1 = ols(D1), fitD2 = ols(D2);
const L2 = logisticFit(D2), L3 = logisticFit(D3);
const T1 = fitGini(D3, 1), T2 = fitGini(D3, 2), T8 = fitGini(D3, 8);
const bootTrees = [1, 2, 3, 4].map(s => fitGini(boot(D3, 100 + s).pts, 8));
const sweep = (() => {
  const arr = [...D3].sort((a, b) => a.x - b.x), n = arr.length, n1 = arr.reduce((s, p) => s + p.y, 0), out = []; let c1 = 0;
  for (let i = 1; i < n; i++) { c1 += arr[i - 1].y; out.push({ x: (arr[i - 1].x + arr[i].x) / 2, g: (gini2(c1, i) * i + gini2(n1 - c1, n - i) * (n - i)) / n }); }
  return out;
})();
const sweepBest = sweep.reduce((a, b) => b.g < a.g ? b : a);
const forest = Array.from({ length: 30 }, (_, k) => { const b = boot(D3, 500 + k); return { tree: fitGini(b.pts, 8), counts: b.counts }; });
const favg = (x, k) => { let s = 0; for (let j = 0; j < k; j++) s += pred(forest[j].tree, x); return s / k; };
const misfit = D3v.map(p => Math.abs(favg(p.x, 30) - p.y) > 0.5); // judged on held-out rows: a forest fits its own training rows
const B = boost(D3, D3v, 2, 0.3, 40), BO = boost(D3, D3v, 3, 0.3, 300);
const treeLim = Math.max(...B.trees.slice(1).flatMap(t => leaves(t).map(l => Math.abs(0.3 * l.v)))) * 1.15;
const boBest = BO.va.reduce((bi, v, i, a) => v < a[bi] ? i : bi, 0);
const boMax = Math.max(BO.tr[0], ...BO.va) * 1.08;
const rareIdx = (() => { const r = mulberry32(3), s = new Set(); while (s.size < 10) s.add(Math.floor(r() * 1000)); return s; })();

// ---------- drawing helpers ----------
let BASE = 1;
const alpha = a => { ctx.globalAlpha = clamp(BASE * a); };
function plot(px, py, pw, ph, xmin, xmax, ymin, ymax) {
  return { px, py, pw, ph, xmin, xmax, ymin, ymax, X: x => px + (x - xmin) / (xmax - xmin) * pw, Y: y => py + ph - (y - ymin) / (ymax - ymin) * ph };
}
function txt(s, x, y, o = {}) {
  alpha(o.alpha ?? 1);
  ctx.font = `${o.weight || 400} ${Math.round((o.size || 14) * TEXT_SCALE)}px ${FONT[o.font || "body"]}`;
  ctx.fillStyle = o.color || C.ink; ctx.textAlign = o.align || "left"; ctx.textBaseline = "alphabetic";
  ctx.fillText(s, x, y);
}
function mono(s, x, y, o = {}) { txt(s, x, y, Object.assign({ font: "mono", size: 15 }, o)); }
function seg(x1, y1, x2, y2, col, w = 1, a = 1, dash) {
  alpha(a); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.setLineDash(dash || []);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.setLineDash([]);
}
function box(x, y, w, h, stroke, lw = 1, fill = C.panel, a = 1) {
  alpha(a); ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.fill(); ctx.stroke();
}
function arrow(x1, y1, x2, y2, col, w, a) {
  const len = Math.hypot(x2 - x1, y2 - y1); if (len < 2) return;
  seg(x1, y1, x2, y2, col, w, a);
  const ang = Math.atan2(y2 - y1, x2 - x1), L = Math.min(7, len * 0.5);
  alpha(a); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - L * Math.cos(ang - 0.45), y2 - L * Math.sin(ang - 0.45));
  ctx.lineTo(x2 - L * Math.cos(ang + 0.45), y2 - L * Math.sin(ang + 0.45)); ctx.closePath(); ctx.fill();
}
function withClip(P, fn) { ctx.save(); ctx.beginPath(); ctx.rect(P.px - 2, P.py - 2, P.pw + 4, P.ph + 4); ctx.clip(); fn(); ctx.restore(); }
function curve(P, f, col, w = 2.5, a = 1, x0 = P.xmin, x1 = P.xmax, dash) {
  if (x1 <= x0) return;
  withClip(P, () => {
    alpha(a); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.setLineDash(dash || []); ctx.beginPath();
    const N = 320; for (let i = 0; i <= N; i++) { const x = x0 + (x1 - x0) * i / N, y = P.Y(f(x)); i ? ctx.lineTo(P.X(x), y) : ctx.moveTo(P.X(x), y); }
    ctx.stroke(); ctx.setLineDash([]);
  });
}
function gridCurve(P, Fs, col, w = 2.5, a = 1) {
  withClip(P, () => {
    alpha(a); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
    GRID.forEach((x, i) => { const y = P.Y(sig(Fs[i])); i ? ctx.lineTo(P.X(x), y) : ctx.moveTo(P.X(x), y); }); ctx.stroke();
  });
}
function dots(P, pts, colFn, a = 1, r = 4.2) {
  pts.forEach((p, i) => { alpha(a); ctx.fillStyle = colFn(p, i); ctx.beginPath(); ctx.arc(P.X(p.x), P.Y(p.y), r, 0, 7); ctx.fill(); });
}
function ring(x, y, r, col, a, w = 1.6) { alpha(a); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke(); }
const classCol = p => p.y ? C.rare : C.major;
function axes(P, yt) {
  yt.forEach(v => { const y = P.Y(v); seg(P.px, y, P.px + P.pw, y, C.grid, 1, 0.7); mono(String(v), P.px - 10, y + 4, { size: 12, color: C.muted, align: "right" }); });
  const yb = P.py + P.ph; seg(P.px, yb, P.px + P.pw, yb, C.muted, 1, 0.8);
  [0, 5, 10].forEach(v => mono(String(v), P.X(v), yb + 18, { size: 11, color: C.muted, align: "center" }));
  mono("feature x", P.px + P.pw, yb + 34, { size: 11, color: C.muted, align: "right" });
}
function insetFrame(P, label) {
  seg(P.px, P.py, P.px, P.py + P.ph, C.muted, 1, 0.7); seg(P.px, P.py + P.ph, P.px + P.pw, P.py + P.ph, C.muted, 1, 0.7);
  mono(label, P.px, P.py - 12, { size: 11, color: C.muted });
}

const PM = [60, 90, 560, 370]; // main plot rect
const P1 = plot(...PM, 0, 10, -0.5, 8.5);
const P2 = plot(...PM, 0, 10, -0.6, 1.6);
const P3 = plot(...PM, 0, 10, -0.15, 1.15);
const RX = 680; // right panel x

// ---------- scenes ----------
const SC = [];
const scene = (name, dur, beats, draw) => SC.push({ name, dur, beats, draw });

scene("The lineage", 10, [
  [0, "OVERVIEW", "Every model in this lineage is three choices: a score function, a loss, and a way to minimize the loss."],
  [5, "OVERVIEW", "Each new model exists because the previous one hit a wall. Watch for four things: the score, the loss, the wall, and the fix."]
], t => {
  const hi = t < 1.5 ? -1 : t < 3 ? 0 : t < 4.5 ? 1 : t < 6.5 ? 2 : -1;
  const items = [["score function", "what shape of answer it can draw"], ["loss", "how wrong an answer is"], ["minimizer", "how it finds the best answer"]];
  items.forEach((it, i) => {
    const x = 55 + i * 290, y = 160, w = 270, h = 130;
    box(x, y, w, h, i === hi ? C.gold : C.grid, i === hi ? 2 : 1);
    txt(it[0], x + 18, y + 52, { font: "display", size: 25, weight: 700 });
    txt(it[1], x + 18, y + 88, { size: 15, color: C.muted });
    if (i < 2) txt("+", x + w + 10, y + h / 2 + 8, { size: 24, color: C.muted, align: "center" });
  });
  txt("Each model exists because the previous one hit a wall.", 480, 380, { align: "center", size: 21, color: t >= 5 ? C.ink : C.muted });
  mono("linear → logistic → tree → forest → boosting", 480, 422, { align: "center", size: 14, color: C.muted });
});

scene("Linear regression", 34, [
  [0, "SCORE", "Linear regression predicts a number as a weighted sum: ŷ = w·x + b. Its score function is a straight line."],
  [6, "LOSS", "Loss is squared error. Each vertical gap is a residual, and each square is that residual squared."],
  [12, "LOSS", "Training picks the w and b that make the total square area smallest. Linear regression has a direct formula for this, no iteration needed."],
  [20, "WALL", "Now use it for a yes/no label, coded as 0 or 1."],
  [26, "WALL", "The line predicts values below 0 and above 1, which can't be probabilities. And a straight line can't bend to fit anything curved."]
], t => {
  const a2 = ease(prog(t, 20, 21.5));
  if (a2 < 1) {
    BASE = 1 - a2;
    axes(P1, [0, 2, 4, 6, 8]);
    const u = ease(prog(t, 12, 18)), w = lerp(0, fitD1.w, u), b = lerp(fitD1.my, fitD1.b, u), f = x => w * x + b;
    const ar = prog(t, 6, 8);
    if (ar > 0) D1.forEach(p => {
      const xp = P1.X(p.x), yp = P1.Y(p.y), yf = P1.Y(f(p.x)), s = Math.abs(yp - yf);
      alpha(0.16 * ar); ctx.fillStyle = C.gold; ctx.fillRect(xp, Math.min(yp, yf), s, s);
      seg(xp, yp, xp, yf, C.gold, 1.5, ar);
    });
    curve(P1, f, C.ink, 2.5, prog(t, 2, 4));
    dots(P1, D1, () => C.major, 0.3 + 0.7 * prog(t, 0, 1.5));
    mono("ŷ = w·x + b", RX, 130, { size: 24 });
    mono(`w = ${w.toFixed(2)}`, RX, 172, { color: C.muted });
    mono(`b = ${b.toFixed(2)}`, RX, 196, { color: C.muted });
    if (t >= 6) {
      const sse = D1.reduce((s, p) => s + (p.y - f(p.x)) ** 2, 0);
      mono("Σ (y − ŷ)²", RX, 250, { color: C.gold });
      txt(sse.toFixed(1), RX, 292, { font: "display", size: 36, weight: 700, color: C.gold });
    }
    if (t >= 12) { txt("Solved directly with a", RX, 340, { color: C.muted }); txt("formula, no iteration.", RX, 360, { color: C.muted }); }
  }
  if (a2 > 0) {
    BASE = a2;
    axes(P2, [0, 1]);
    const f = x => fitD2.w * x + fitD2.b;
    curve(P2, f, C.ink, 2.5, 1, 0, lerp(0, 10, prog(t, 21.5, 24)));
    dots(P2, D2, classCol, 1);
    mono("labels: 0 or 1", RX, 130, { size: 17 });
    if (t >= 24) { mono(`ŷ(x=0)  = ${f(0).toFixed(2)}`, RX, 172, { color: C.muted }); mono(`ŷ(x=10) = ${f(10).toFixed(2)}`, RX, 196, { color: C.muted }); }
    if (t >= 26) {
      const ah = prog(t, 26, 27), xHi = (1 - fitD2.b) / fitD2.w, xLo = -fitD2.b / fitD2.w;
      curve(P2, f, C.rare, 4.5, ah, clamp(xHi, 0, 10), 10);
      curve(P2, f, C.rare, 4.5, ah, 0, clamp(xLo, 0, 10));
      mono(`${f(10).toFixed(2)}?`, P2.X(10) - 4, P2.Y(f(10)) - 12, { align: "right", color: C.rare, alpha: ah });
      mono(`${f(0).toFixed(2)}?`, P2.X(0) + 8, P2.Y(f(0)) + 20, { color: C.rare, alpha: ah });
      txt("Not a probability,", RX, 250, { size: 18, color: C.rare, alpha: ah });
      txt("and it can't bend.", RX, 274, { size: 18, color: C.rare, alpha: ah });
    }
  }
  BASE = 1;
});

scene("Logistic regression", 44, [
  [0, "SCORE", "Logistic regression keeps the weighted sum, z = w·x + b, but reads it as log-odds (right)."],
  [7, "SCORE", "The sigmoid, p = 1 / (1 + e^−z), squashes any z into a probability between 0 and 1. The straight line becomes an S-curve."],
  [14, "LOSS", "Loss is log loss: each row pays −log(probability it gave its true class). Bigger rings mean bigger penalties."],
  [18, "LOSS", "Confident and right costs almost nothing. Confident and wrong costs a lot. XGBoost uses this same loss."],
  [22, "LOSS", "Starting from a flat guess, gradient descent nudges w and b downhill on log loss until the curve fits."],
  [30, "WALL", "The wall: log-odds must be a straight line in x. Give it a class that lives in the middle of the range..."],
  [36, "WALL", "...and the best S-curve it can draw is nearly flat. It can't say \"high in the middle, low at both ends\" unless you hand-build a feature for it."]
], t => {
  const toD3 = ease(prog(t, 30, 31.5));
  if (toD3 < 1) {
    BASE = 1 - toD3;
    axes(P2, [0, 1]);
    let w = L2.w, b = L2.b;
    if (t >= 22) ({ w, b } = snapAt(L2.snaps, prog(t, 22.5, 29)));
    const lin = x => fitD2.w * x + fitD2.b, lg = x => sig(w * x + b), m = ease(prog(t, 7, 12));
    curve(P2, x => lerp(lin(x), lg(x), m), C.ink, 2.5);
    const ptrue = p => p.y ? lg(p.x) : 1 - lg(p.x);
    if (t >= 14) { const a = prog(t, 14, 16); D2.forEach(p => ring(P2.X(p.x), P2.Y(p.y), 6 + 7 * Math.min(-Math.log(ptrue(p)), 3), C.gold, a)); }
    dots(P2, D2, classCol);
    if (t < 14) {
      const z0 = L2.b, z1 = L2.w * 10 + L2.b, Pz = plot(RX + 10, 120, 220, 130, 0, 10, Math.min(z0, z1) - 1, Math.max(z0, z1) + 1);
      insetFrame(Pz, "z = w·x + b   (log-odds)");
      seg(Pz.px, Pz.Y(0), Pz.px + Pz.pw, Pz.Y(0), C.grid, 1, 1, [3, 3]);
      mono("0", Pz.px - 6, Pz.Y(0) + 4, { size: 10, color: C.muted, align: "right" });
      curve(Pz, x => L2.w * x + L2.b, C.major, 2);
      if (t >= 7) {
        mono("p = 1 / (1 + e^−z)", RX, 320, { size: 16, alpha: prog(t, 7, 8) });
        txt("squashes z into 0..1", RX, 346, { color: C.muted, alpha: prog(t, 7, 8) });
      }
    } else {
      const Pl = plot(RX + 10, 120, 220, 150, 0, 1, 0, 4.2);
      insetFrame(Pl, "penalty = −log p(true class)");
      curve(Pl, p => -Math.log(Math.max(p, 0.012)), C.gold, 2, 1, 0.012, 1);
      mono("p →", Pl.px + Pl.pw, Pl.py + Pl.ph + 16, { size: 10, color: C.muted, align: "right" });
      D2.forEach(p => { const q = ptrue(p); alpha(0.85); ctx.fillStyle = classCol(p); ctx.beginPath(); ctx.arc(Pl.X(q), Pl.Y(Math.min(-Math.log(q), 4.2)), 3, 0, 7); ctx.fill(); });
      const ll = logloss(D2, p => lg(p.x));
      mono("log loss (average)", RX, 330, { color: C.gold, size: 13 });
      txt(ll.toFixed(2), RX, 370, { font: "display", size: 36, weight: 700, color: C.gold });
      if (t >= 18 && t < 22) {
        const sorted = [...D2].sort((a, b) => ptrue(b) - ptrue(a)), good = sorted[0], bad = sorted[sorted.length - 1], a = prog(t, 18, 19);
        mono(`right: ${(-Math.log(ptrue(good))).toFixed(2)}`, P2.X(good.x), P2.Y(good.y) - 22, { size: 12, color: C.good, align: "center", alpha: a });
        mono(`wrong: ${(-Math.log(ptrue(bad))).toFixed(2)}`, P2.X(bad.x), P2.Y(bad.y) + (bad.y ? -30 : 38), { size: 12, color: C.rare, align: "center", alpha: a });
      }
    }
  }
  if (toD3 > 0) {
    BASE = toD3;
    axes(P3, [0, 1]);
    if (t >= 37) { alpha(0.08); ctx.fillStyle = C.rare; ctx.fillRect(P3.X(3.5), P3.py, P3.X(6.5) - P3.X(3.5), P3.ph); }
    const { w, b } = snapAt(L3.snaps, ease(prog(t, 31.5, 35)));
    curve(P3, x => sig(w * x + b), C.ink, 2.5);
    dots(P3, D3, classCol);
    mono("best S-curve here:", RX, 130, { size: 15 });
    mono(`p ranges ${sig(L3.b).toFixed(2)} to ${sig(L3.w * 10 + L3.b).toFixed(2)}`, RX, 156, { size: 13, color: C.muted });
    if (t >= 36) { txt("Needs a hand-built", RX, 220, { size: 18, color: C.rare }); txt("feature like |x − 5|.", RX, 244, { size: 18, color: C.rare }); }
  }
  BASE = 1;
});

function drawTree(node) {
  function place(n, d, x0, x1, py, px) {
    const cx = (x0 + x1) / 2, y = 120 + d * 78, w = Math.min(x1 - x0 - 8, 120), h = 40;
    if (py != null) seg(px, py, cx, y, C.grid, 1.2);
    box(cx - w / 2, y, w, h, n.leaf ? C.grid : C.muted, 1, C.panel);
    if (n.leaf) {
      mono(`p=${n.v.toFixed(2)}`, cx, y + 17, { size: 11, align: "center", color: n.v > 0.5 ? C.rare : C.major });
      mono(`n=${n.n}`, cx, y + 32, { size: 10, align: "center", color: C.muted });
    } else {
      mono(`x < ${n.thr.toFixed(1)}`, cx, y + 25, { size: 13, align: "center" });
      place(n.L, d + 1, x0, cx, y + h, cx); place(n.R, d + 1, cx, x1, y + h, cx);
    }
  }
  place(node, 0, RX - 10, 940, null, null);
}
function splitLines(node, t, times) {
  const list = []; (function walk(n, d) { if (!n.leaf) { list.push({ thr: n.thr, d }); walk(n.L, d + 1); walk(n.R, d + 1); } })(node, 0);
  list.forEach(s => { const a = prog(t, times[s.d], times[s.d] + 1); if (a > 0) { seg(P3.X(s.thr), P3.py, P3.X(s.thr), P3.py + P3.ph, C.muted, 1, a, [4, 4]); mono(`x<${s.thr.toFixed(1)}`, P3.X(s.thr) + 4, P3.py + 14 + s.d * 16, { size: 11, color: C.muted, alpha: a }); } });
}

scene("Decision tree", 44, [
  [0, "SCORE", "A decision tree asks yes/no questions like \"is x < 3.6?\". Each leaf predicts the share of class 1 among its rows, so the score function is a step function."],
  [8, "LOSS", "Loss is impurity. Gini = 1 − Σp²: a pure leaf scores 0, a 50/50 leaf scores 0.5."],
  [16, "LOSS", "Each split is chosen greedily: try every cut, keep the one that lowers weighted Gini the most."],
  [24, "FIX", "It finds the middle bump that logistic regression couldn't, with no feature engineering."],
  [28, "WALL", "The wall: let it grow deep and it chases every noisy label..."],
  [34, "WALL", "...and retraining on a slightly different sample of rows gives a very different tree. That's high variance, or overfitting."]
], t => {
  axes(P3, [0, 1]);
  const base = mean(D3.map(p => p.y));
  if (t < 28) {
    splitLines(T2, t, [1.5, 4.5]);
    const tree = t < 1.5 ? null : t < 4.5 ? T1 : T2;
    curve(P3, tree ? x => pred(tree, x) : () => base, C.ink, 2.5);
  } else if (t < 34) {
    const a = ease(prog(t, 28, 30));
    curve(P3, x => pred(T2, x), C.ink, 2.5, 1 - a);
    curve(P3, x => pred(T8, x), C.ink, 2.5, a);
  } else {
    const k = Math.floor((t - 34) / 2) % 4;
    for (let j = 0; j < 4; j++) if (j !== k) curve(P3, x => pred(bootTrees[j], x), C.muted, 1, 0.25);
    curve(P3, x => pred(bootTrees[k], x), C.ink, 2.5);
  }
  if (t >= 16 && t < 24) { const sx = lerp(0, 10, prog(t, 16, 22)); seg(P3.X(sx), P3.py, P3.X(sx), P3.py + P3.ph, C.gold, 1.5, 0.9); }
  dots(P3, D3, classCol);

  if (t < 8 || (t >= 24 && t < 28)) drawTree(T2);
  else if (t < 16) {
    const lv = leaves(T2);
    lv.forEach((l, i) => {
      const y = 110 + i * 62, bw = 230, a = prog(t, 8 + i * 0.6, 9 + i * 0.6);
      mono(`leaf ${i + 1}   n=${l.n}`, RX, y, { size: 12, color: C.muted, alpha: a });
      alpha(a); ctx.fillStyle = C.rare; ctx.fillRect(RX, y + 8, bw * l.v, 14);
      ctx.fillStyle = C.major; ctx.fillRect(RX + bw * l.v, y + 8, bw * (1 - l.v), 14);
      mono(`Gini ${gini2(l.n1, l.n).toFixed(2)}`, RX, y + 40, { size: 13, color: C.gold, alpha: a });
    });
    const wg = lv.reduce((s, l) => s + gini2(l.n1, l.n) * l.n, 0) / D3.length;
    mono(`root ${gini2(T2.n1, T2.n).toFixed(2)} → ${wg.toFixed(2)}`, RX, 110 + lv.length * 62 + 4, { size: 14, color: C.gold, alpha: prog(t, 12, 13) });
  } else if (t < 24) {
    const Pg = plot(RX + 10, 130, 220, 160, 0, 10, 0, 0.55), sx = lerp(0, 10, prog(t, 16, 22));
    insetFrame(Pg, "weighted Gini after the cut");
    withClip(Pg, () => {
      alpha(1); ctx.strokeStyle = C.gold; ctx.lineWidth = 2; ctx.beginPath(); let first = true;
      sweep.forEach(s => { if (s.x <= sx) { const X = Pg.X(s.x), Y = Pg.Y(s.g); first ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y); first = false; } }); ctx.stroke();
    });
    mono("cut position x →", Pg.px + Pg.pw, Pg.py + Pg.ph + 16, { size: 10, color: C.muted, align: "right" });
    if (t >= 22) { ring(Pg.X(sweepBest.x), Pg.Y(sweepBest.g), 6, C.good, 1, 2); mono(`best cut: x < ${sweepBest.x.toFixed(1)}`, RX, 360, { size: 15, color: C.good }); }
  } else if (t < 34) {
    mono("depth 8", RX, 130, { size: 18 }); mono(`${leaves(T8).length} leaves`, RX, 158, { color: C.muted });
    txt("Fits every noisy label.", RX, 210, { size: 17, color: C.rare });
  } else {
    const k = Math.floor((t - 34) / 2) % 4;
    mono(`bootstrap sample #${k + 1}`, RX, 130, { size: 16 });
    txt("Same model, same settings,", RX, 180, { size: 17, color: C.rare });
    txt("different tree every time.", RX, 204, { size: 17, color: C.rare });
  }
});

scene("Random forest", 40, [
  [0, "FIX", "Random forest starts with bootstrap samples: draw rows at random, with replacement. Some rows get drawn twice, some never (hollow)."],
  [7, "SCORE", "Grow a deep tree on each sample. The forest's score is the average of all the trees' predictions (bold line)."],
  [16, "LOSS", "There's no shared loss. Each tree minimizes Gini on its own sample, independently of the others."],
  [22, "FIX", "The trees' random mistakes point in different directions and cancel out, so variance drops."],
  [28, "WALL", "The wall: no tree ever looks at what the others got wrong, so mistakes they share survive the average. Circled: new rows it still gets wrong."],
  [35, "WALL", "To fix that, build trees in sequence, each one aimed at what's still wrong."]
], t => {
  axes(P3, [0, 1]);
  if (t < 7) {
    const cnt = forest[0].counts;
    if (t >= 3.5) curve(P3, x => pred(forest[0].tree, x), C.ink, 2, prog(t, 3.5, 5));
    D3.forEach((p, i) => {
      const X = P3.X(p.x), Y = P3.Y(p.y);
      if (cnt[i] === 0) ring(X, Y, 4.5, C.muted, 0.8, 1.2);
      else { alpha(1); ctx.fillStyle = classCol(p); ctx.beginPath(); ctx.arc(X, Y, 3 + 2.2 * cnt[i], 0, 7); ctx.fill(); }
    });
    const left = cnt.filter(c => c === 0).length, dup = cnt.filter(c => c > 1).length;
    mono("bootstrap sample #1", RX, 130, { size: 16 });
    mono(`${D3.length} draws, with replacement`, RX, 160, { size: 12, color: C.muted });
    mono(`${left} rows never drawn`, RX, 200, { size: 13 });
    mono(`${dup} rows drawn 2+ times`, RX, 224, { size: 13 });
    txt("Bigger dot = drawn more often.", RX, 264, { color: C.muted });
  } else {
    const k = t < 16 ? clamp(Math.floor((t - 7) / 0.28) + 1, 1, 30) : 30;
    for (let j = 0; j < k; j++) curve(P3, x => pred(forest[j].tree, x), C.major, 1, 0.14);
    curve(P3, x => favg(x, k), C.ink, 3);
    dots(P3, D3, classCol);
    if (t >= 28) { const a = prog(t, 28, 29.5); D3v.forEach((p, i) => { ring(P3.X(p.x), P3.Y(p.y), 4, classCol(p), a, 1.5); if (misfit[i]) ring(P3.X(p.x), P3.Y(p.y), 11, C.rare, a, 2); }); }
    mono(`trees: ${k} / 30`, RX, 130, { size: 16 });
    mono("score = average of", RX, 170, { size: 13, color: C.muted });
    mono("all trees' predictions", RX, 190, { size: 13, color: C.muted });
    if (t >= 16) { txt("Each tree: own sample,", RX, 240, { size: 16, color: C.gold }); txt("own Gini, no shared loss.", RX, 262, { size: 16, color: C.gold }); }
    if (t >= 28) { txt(`${misfit.filter(Boolean).length} held-out rows wrong.`, RX, 320, { size: 17, color: C.rare }); txt("Nothing aims at them.", RX, 344, { size: 17, color: C.rare }); }
  }
});

scene("Gradient boosting / XGBoost", 58, [
  [0, "SCORE", "Gradient boosting's score is a sum of trees in log-odds: F(x) = base + η·Σ treeₘ(x), with p = sigmoid(F). The base is the log prior odds, so it starts flat at the class share."],
  [8, "LOSS", "Same log loss as logistic regression. Each row's gradient is g = p − y. The arrows show how far each row wants its prediction to move."],
  [14, "LOSS", "Round 1: fit a small tree to the gradients. Each leaf's value is −G / (H + λ), and the tree's output times η is added to F (bottom right)."],
  [21, "FIX", "Recompute the gradients and repeat. Rows that are already right stop pulling; the rest keep pulling. Bias drops one small tree at a time."],
  [35, "FIX", "Forty shallow trees later, the curve fits the bump."],
  [40, "WALL", "The wall: with deeper trees and more rounds, training loss keeps falling, but loss on held-out rows turns back up. That's overfitting."],
  [50, "FIX", "XGBoost's brakes: learning rate η, max_depth, lambda and gamma regularization, and early stopping at the best validation round."]
], t => {
  axes(P3, [0, 1]);
  let r = 0; if (t >= 17) r = t < 21 ? prog(t, 17, 20) : 1 + 39 * prog(t, 21, 34);
  if (t < 40) {
    const Fg = interpArr(B.Fg, r), Fp = interpArr(B.Fp, r);
    gridCurve(P3, Fg, C.ink, 2.5);
    if (t >= 7) {
      const a = 0.75 * prog(t, 7, 8.5);
      D3.forEach((p, i) => { const q = sig(Fp[i]); if (Math.abs(p.y - q) > 0.03) arrow(P3.X(p.x), P3.Y(q), P3.X(p.x), P3.Y(p.y), classCol(p), 1.5, a); });
    }
    dots(P3, D3, classCol);
    if (t < 7) {
      mono("F(x) = base + η·Σ treeₘ(x)", RX - 10, 130, { size: 14 });
      mono("p = sigmoid(F)", RX - 10, 158, { size: 14 });
      mono(`base = log(${B.prior.toFixed(2)} / ${(1 - B.prior).toFixed(2)})`, RX - 10, 210, { size: 13, color: C.muted });
      mono(`     = ${B.F0.toFixed(2)}`, RX - 10, 232, { size: 13, color: C.muted });
      txt(`Starts at p = ${B.prior.toFixed(2)} everywhere.`, RX - 10, 276, { color: C.muted });
    } else if (t < 14) {
      mono("g = p − y", RX, 140, { size: 24, color: C.gold });
      mono("class 1 row: g < 0", RX, 190, { size: 13, color: C.rare }); mono("  → push p up", RX, 210, { size: 13, color: C.muted });
      mono("class 0 row: g > 0", RX, 244, { size: 13, color: C.major }); mono("  → push p down", RX, 264, { size: 13, color: C.muted });
    } else {
      const m = clamp(Math.ceil(r) || 1, 1, 40);
      mono("leaf = −G / (H + λ)", RX - 10, 130, { size: 15, color: C.gold });
      mono(`round ${m} / 40`, RX - 10, 170, { size: 15 });
      mono(`train log loss ${B.tr[Math.round(r)].toFixed(2)}`, RX - 10, 196, { size: 13, color: C.muted });
      const Pt = plot(RX + 10, 300, 220, 120, 0, 10, -treeLim, treeLim);
      insetFrame(Pt, `η · tree ${m}  (added to F)`);
      seg(Pt.px, Pt.Y(0), Pt.px + Pt.pw, Pt.Y(0), C.grid, 1, 1, [3, 3]);
      curve(Pt, x => 0.3 * pred(B.trees[m], x), C.gold, 2);
    }
  } else {
    const R = Math.round(300 * prog(t, 40, 48));
    gridCurve(P3, BO.Fg[R], C.ink, 2.5);
    dots(P3, D3, classCol);
    const Po = plot(RX + 10, 120, 220, 160, 0, 300, 0, boMax);
    insetFrame(Po, "log loss vs. boosting round");
    [["tr", C.major], ["va", C.rare]].forEach(([key, col]) => {
      withClip(Po, () => { alpha(1); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i <= R; i++) { const X = Po.X(i), Y = Po.Y(BO[key][i]); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); } ctx.stroke(); });
    });
    mono("train", Po.px, Po.py + Po.ph + 18, { size: 11, color: C.major });
    mono("held-out", Po.px + 54, Po.py + Po.ph + 18, { size: 11, color: C.rare });
    mono(`round ${R}`, Po.px + Po.pw, Po.py + Po.ph + 18, { size: 11, color: C.muted, align: "right" });
    if (t >= 48) {
      const a = prog(t, 48, 49);
      seg(Po.X(boBest), Po.py, Po.X(boBest), Po.py + Po.ph, C.good, 1.5, a, [4, 3]);
      mono(`stop at round ${boBest}`, RX, 340, { size: 14, color: C.good, alpha: a });
    }
    if (t >= 50) {
      ["η  learning rate", "max_depth", "lambda, gamma", "early stopping"].forEach((s, i) => mono(s, RX, 380 + i * 22, { size: 13, alpha: prog(t, 50 + i * 0.6, 51 + i * 0.6) }));
    }
  }
});

scene("Your rare classes", 26, [
  [0, "LOSS", "Back to your problem. A region holds 10 rare rows and 990 majority rows, and the model says p(rare) = 1% there."],
  [6, "LOSS", "Each rare row pulls the rare score up hard (g = −0.99). Each majority row pushes it down a little (g = +0.01)."],
  [12, "WALL", "Summed, they cancel: −9.9 + 9.9 = 0. No tree splits here. The prior has won."],
  [18, "FIX", "Weight the rare rows ×5 and the sum becomes −39.6, so the tree acts. A threshold shift does the same job after training."]
], t => {
  for (let i = 0; i < 1000; i++) {
    const isR = rareIdx.has(i), x = 72 + (i % 50) * 11, y = 98 + Math.floor(i / 50) * 10.5;
    alpha(isR ? 1 : 0.55); ctx.fillStyle = isR ? C.rare : C.major; ctx.beginPath(); ctx.arc(x, y, isR ? 3.6 : 2, 0, 7); ctx.fill();
  }
  const s = 8, x0 = 72, wm = t >= 18 ? lerp(1, 5, ease(prog(t, 18, 21))) : 1;
  if (t >= 6) {
    const a = prog(t, 6, 7);
    alpha(a); ctx.fillStyle = C.rare; ctx.fillRect(x0, 340, 9.9 * s * wm, 22);
    mono(`10 × ${wm > 1.01 ? wm.toFixed(1) + " × " : ""}−0.99 = −${(9.9 * wm).toFixed(1)}`, x0 + 9.9 * s * wm + 10, 356, { size: 13, color: C.rare, alpha: a });
    alpha(a); ctx.fillStyle = C.major; ctx.fillRect(x0, 378, 9.9 * s, 22);
    mono("990 × +0.01 = +9.9", x0 + 9.9 * s + 10, 394, { size: 13, color: C.major, alpha: a });
  }
  if (t >= 12) {
    const a = prog(t, 12, 13), G = -9.9 * wm + 9.9;
    seg(x0, 420, x0, 450, C.muted, 1, a);
    alpha(a); ctx.fillStyle = C.ink; ctx.fillRect(x0, 424, Math.abs(G) * s, 22);
    mono(Math.abs(G) < 0.05 ? "G = 0  → no split" : `G = ${G.toFixed(1)}  → tree acts`, x0 + Math.abs(G) * s + 10, 440, { size: 14, color: Math.abs(G) < 0.05 ? C.rare : C.good, alpha: a });
  }
  mono("p(rare) = 0.01 here", RX, 130, { size: 14 });
  mono("g = p − y", RX, 170, { size: 18, color: C.gold });
  mono("rare:     0.01 − 1", RX, 204, { size: 13, color: C.rare }); mono("        = −0.99", RX, 224, { size: 13, color: C.rare });
  mono("majority: 0.01 − 0", RX, 256, { size: 13, color: C.major }); mono("        = +0.01", RX, 276, { size: 13, color: C.major });
  if (t >= 18) { txt("sample_weight = 5", RX, 330, { size: 17, color: C.good }); txt("on rare rows", RX, 352, { size: 17, color: C.good }); }
});

scene("Recap", 14, [
  [0, "OVERVIEW", "The whole lineage on one screen: each model's wall is what the next one fixes."]
], t => {
  const cols = [60, 200, 410, 560, 765], heads = ["MODEL", "SCORE", "LOSS", "WALL", "NEXT FIX"];
  heads.forEach((h, i) => mono(h, cols[i], 110, { size: 11, color: C.muted }));
  seg(60, 122, 920, 122, C.grid);
  const rows = [
    ["Linear", "w·x + b", "squared error", "not probabilities", "logistic"],
    ["Logistic", "sigmoid(w·x + b)", "log loss", "straight log-odds", "decision tree"],
    ["Tree", "step function", "Gini, greedy", "high variance", "random forest"],
    ["Forest", "average of trees", "Gini per tree", "shared errors stay", "boosting"],
    ["Boosting", "Σ η·trees (log-odds)", "log loss", "can overfit", "η, depth, early stop"]
  ];
  rows.forEach((r, j) => {
    const a = prog(t, 0.5 + j * 0.9, 1.3 + j * 0.9), y = 160 + j * 62;
    r.forEach((c, i) => txt(c, cols[i], y, { size: i === 0 ? 19 : 15, font: i === 0 ? "display" : i === 1 ? "mono" : "body", weight: i === 0 ? 700 : 400, color: i === 3 ? C.rare : i === 4 ? C.good : i === 2 ? C.gold : C.ink, alpha: a }));
    seg(60, y + 22, 920, y + 22, C.grid, 1, a * 0.6);
  });
});


export const SCENES = SC.map(s => ({ name: s.name, dur: s.dur, beats: s.beats }));

/** Draw one frame: background, chapter title, then the scene at time t (seconds, scene-local). */
export function renderFrame(context, sceneIndex, t, scale) {
  ctx = context;
  const s = SC[sceneIndex];
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = C.stage; ctx.fillRect(0, 0, 960, 540);
  BASE = 1;
  const label = sceneIndex === 0 || sceneIndex === SC.length - 1 ? s.name : `${sceneIndex}. ${s.name}`;
  txt(label, 60, 56, { font: "display", size: 32, weight: 500 });
  s.draw(t);
  ctx.globalAlpha = 1;
}
