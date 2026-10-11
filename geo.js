// Núcleo de geometria: Manifold (sólidos sem falhas) + texto com opentype.js.
import Module from 'https://cdn.jsdelivr.net/npm/manifold-3d@3.5.4/manifold.js';
import * as opentype from 'https://cdn.jsdelivr.net/npm/opentype.js@1.3.4/dist/opentype.module.js';

let W = null;
let bag = [];           // objetos WASM criados neste build (liberados no fim)

export async function initGeo() {
  W = await Module();
  W.setup();
}

const keep = (o) => { bag.push(o); return o; };

/** Libera a memória WASM de tudo o que foi criado desde a última chamada. */
export function freeAll() {
  for (const o of bag) { try { o.delete(); } catch (e) { /* já liberado */ } }
  bag = [];
}

// ---- 2D -------------------------------------------------------------------
/** Seção 2D a partir de contornos [[x, y], ...] (ou lista de contornos). */
export function cs(polys, rule = 'NonZero') {
  if (polys instanceof W.CrossSection) return polys;
  return keep(new W.CrossSection(polys, rule));
}
export const csUnion = (list) => keep(W.CrossSection.union(list.map((p) => cs(p))));
export const csSub = (a, b) => keep(cs(a).subtract(cs(b)));
export const csMove = (a, x, y) => keep(cs(a).translate([x, y]));
export const csScale = (a, k) => keep(cs(a).scale(typeof k === 'number' ? [k, k] : k));
export const csRotate = (a, deg) => keep(cs(a).rotate(deg));
/** Arredonda os cantos (vivos e reentrantes) com raio r. */
export const csRound = (a, r) => keep(keep(keep(cs(a).offset(-r, 'Round', 2, 48)).offset(2 * r, 'Round', 2, 48)).offset(-r, 'Round', 2, 48));
export const csBounds = (a) => cs(a).bounds();

export const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
export function circle(cx, cy, r, n = 72) {
  const p = [];
  for (let i = 0; i < n; i++) p.push([cx + r * Math.cos(2 * Math.PI * i / n), cy + r * Math.sin(2 * Math.PI * i / n)]);
  return p;
}
export function ellipse(cx, cy, rx, ry, n = 72) {
  return circle(0, 0, 1, n).map(([x, y]) => [cx + x * rx, cy + y * ry]);
}
/** Faixa em arco entre os raios r0..r1 e os ângulos a0..a1 (graus). */
export function band(cx, cy, r0, r1, a0, a1, n = 64) {
  const out = [], inn = [];
  for (let i = 0; i <= n; i++) {
    const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180;
    out.push([cx + r1 * Math.cos(a), cy + r1 * Math.sin(a)]);
    inn.push([cx + r0 * Math.cos(a), cy + r0 * Math.sin(a)]);
  }
  return out.concat(inn.reverse());
}
export function roundedRect(x0, y0, x1, y1, r, n = 12) {
  const pts = [];
  for (const [cx, cy, a] of [[x1 - r, y0 + r, -90], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, 90], [x0 + r, y0 + r, 180]]) {
    for (let i = 0; i <= n; i++) {
      const t = (a + 90 * i / n) * Math.PI / 180;
      pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
    }
  }
  return pts;
}

// ---- 3D -------------------------------------------------------------------
/** Perfil visto de frente (x, z), com espessura de y0 a y1. */
export const xz = (p, y0, y1) => keep(keep(keep(cs(p).extrude(y1 - y0)).rotate([90, 0, 0])).translate([0, y1, 0]));
/** Perfil visto de lado (y, z), com largura de x0 a x1. */
export const yz = (p, x0, x1) => keep(keep(keep(cs(p).extrude(x1 - x0)).rotate([90, 0, 90])).translate([x0, 0, 0]));
/** Perfil visto de cima (x, y), de z0 a z1. */
export const xy = (p, z0, z1) => keep(keep(cs(p).extrude(z1 - z0)).translate([0, 0, z0]));
export const box = (x0, x1, y0, y1, z0, z1) => keep(keep(W.Manifold.cube([x1 - x0, y1 - y0, z1 - z0])).translate([x0, y0, z0]));
export const union = (list) => keep(W.Manifold.union(list));
export const sub = (a, b) => keep(a.subtract(b));
export const move = (a, x, y, z) => keep(a.translate([x, y, z]));
export const rotate = (a, rx, ry, rz) => keep(a.rotate([rx, ry, rz]));
export const isEmpty = (a) => a.isEmpty();
export const intersect = (a, b) => keep(a.intersect(b));
/** Gira um perfil (x = raio, y = altura) em volta do eixo Z. Use a silhueta inteira (simétrica). */
export const revolve = (p, n = 96) => keep(cs(p).revolve(n));
/** Deforma cada vértice: f([x, y, z]) altera o ponto no lugar. */
export const warp = (a, f) => keep(a.warp(f));
/** Extrusão em Z com giro (graus) e escala no topo. */
export const twist = (p, z0, h, deg, top = 1, n = 16) => keep(keep(cs(p).extrude(h, n, deg, top)).translate([0, 0, z0]));

/** Malha para exibir/exportar: { pos: Float32Array, idx: Uint32Array } */
export function meshOf(m) {
  const g = m.getMesh();
  const n = g.numProp, vp = g.vertProperties, nv = vp.length / n;
  const pos = new Float32Array(nv * 3);
  for (let i = 0; i < nv; i++) { pos[3 * i] = vp[n * i]; pos[3 * i + 1] = vp[n * i + 1]; pos[3 * i + 2] = vp[n * i + 2]; }
  return { pos, idx: new Uint32Array(g.triVerts) };
}

// ---- Texto ----------------------------------------------------------------
const fontCache = new Map();
export async function loadFont(url) {
  if (!fontCache.has(url)) {
    fontCache.set(url, fetch(url).then((r) => {
      if (!r.ok) throw new Error('fonte não carregou');
      return r.arrayBuffer();
    }).then((buf) => opentype.parse(buf)));
  }
  return fontCache.get(url);
}

function contoursOf(cmds, steps = 8) {
  const out = [];
  let cur = [], px = 0, py = 0;
  const push = (x, y) => { cur.push([x, -y]); px = x; py = y; };
  const close = () => {
    if (cur.length > 1) {
      const [a, b] = [cur[0], cur[cur.length - 1]];
      if (Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6) cur.pop();
    }
    if (cur.length > 2) out.push(cur);
    cur = [];
  };
  for (const c of cmds) {
    if (c.type === 'M') { close(); push(c.x, c.y); }
    else if (c.type === 'L') push(c.x, c.y);
    else if (c.type === 'Q') {
      const [x0, y0] = [px, py];
      for (let i = 1; i <= steps; i++) {
        const t = i / steps, u = 1 - t;
        push(u * u * x0 + 2 * u * t * c.x1 + t * t * c.x, u * u * y0 + 2 * u * t * c.y1 + t * t * c.y);
      }
    } else if (c.type === 'C') {
      const [x0, y0] = [px, py];
      for (let i = 1; i <= steps; i++) {
        const t = i / steps, u = 1 - t;
        push(u * u * u * x0 + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x,
             u * u * u * y0 + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y);
      }
    } else if (c.type === 'Z') close();
  }
  close();
  return out;
}

/**
 * Texto (1 ou mais linhas) como seção 2D centrada em (0, 0),
 * cabendo numa caixa w × h (mm). Devolve null se não houver texto.
 */
export function textSection(font, lines, w, h) {
  const size = 10, lead = 1.25;
  const rows = [];
  lines.forEach((ln) => {
    ln = ln.trim();
    if (!ln) return;
    const poly = contoursOf(font.getPath(ln, 0, 0, size).commands);
    if (poly.length) rows.push(cs(poly));
  });
  if (!rows.length) return null;
  const placed = rows.map((r, i) => {
    const b = r.bounds();
    return csMove(r, -(b.min[0] + b.max[0]) / 2, -i * size * lead);
  });
  const all = placed.length > 1 ? csUnion(placed) : placed[0];
  const b = all.bounds();
  const bw = b.max[0] - b.min[0], bh = b.max[1] - b.min[1];
  const k = Math.min(w / bw, h / bh);
  return csScale(csMove(all, -(b.min[0] + b.max[0]) / 2, -(b.min[1] + b.max[1]) / 2), k);
}

// ---- Textura (crochê / tricô) ------------------------------------------------
export const csOffset = (a, d) => keep(cs(a).offset(d, 'Round', 2, 24));
export const csIntersect = (a, b) => keep(cs(a).intersect(cs(b)));
/** Silhueta de um sólido vista de frente: seção 2D em (x, z). */
export const footprint = (m) => keep(keep(m.rotate([-90, 0, 0])).project());

const STITCH = {
  // tricô: colunas de "V" (ponto meia), com um vão entre as colunas
  trico: { w: 4.6, h: 3.5, rx: 0.9, ry: 1.85, dx: 0.19, ang: 34, shift: 0 },
  // crochê: pontinhos em "V" menores e separados, linhas desencontradas
  croche: { w: 3.8, h: 3.4, rx: 0.75, ry: 1.45, dx: 0.2, ang: 30, shift: 0.5 },
};

/** Grade de pontos em V cobrindo a caixa b (bounds de uma seção 2D). */
function stitchPattern(kind, b) {
  const S = STITCH[kind], polys = [];
  const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[1] + b.max[1]) / 2;
  const nx = Math.ceil((b.max[0] - b.min[0]) / S.w / 2) + 2, nz = Math.ceil((b.max[1] - b.min[1]) / S.h / 2) + 2;
  const lobe = (x, z, side) => {
    const a = side * S.ang * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    return ellipse(0, 0, S.rx, S.ry, 16).map(([px, pz]) => [x + side * -S.w * S.dx + px * ca - pz * sa, z + px * sa + pz * ca]);
  };
  for (let j = -nz; j <= nz; j++) {
    const off = (j & 1) ? S.shift * S.w : 0;
    for (let i = -nx; i <= nx; i++) {
      const x = cx + i * S.w + off, z = cz + j * S.h;
      polys.push(lobe(x, z, 1), lobe(x, z, -1));
    }
  }
  return cs(polys, 'Positive');
}

/**
 * Relevo de pontos (0,75 mm, em dois degraus para ficar "fofinho") sobre a face
 * frontal y, dentro da seção sec, longe das áreas em excl (seções 2D).
 */
export function textureSolid(sec, excl, kind, y = 0, margin = 1.2) {
  if (!STITCH[kind]) return null;
  let R = csOffset(sec, -margin);
  if (excl.length) R = csSub(R, csOffset(csUnion(excl), 0.8));
  if (R.isEmpty()) return null;
  const pat = stitchPattern(kind, R.bounds());
  const A = csIntersect(R, pat), B = csIntersect(R, csOffset(pat, -0.35));
  if (A.isEmpty()) return null;     // (sólido vazio estraga a união com o resto)
  const layers = [xz(A, y - 0.4, y + 0.2)];
  if (!B.isEmpty()) layers.push(xz(B, y - 0.75, y - 0.3));
  const m = layers.length > 1 ? union(layers) : layers[0];
  return m.isEmpty() ? null : m;
}
