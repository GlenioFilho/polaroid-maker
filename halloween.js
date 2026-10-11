// Coleção Halloween: peças de decoração (sem foto).
// Mesmas convenções de models.js: mm, Z para cima, frente olha para -Y.
// Luminárias: casca oca com abertura embaixo para vela LED (tea light de até 40 mm).
import {
  cs, csUnion, csSub, csMove, csScale, csIntersect, csOffset, rect, circle, ellipse, roundedRect,
  xz, xy, union, sub, revolve, warp, twist,
} from './geo.js';

const W_LAMP = 2.4;   // parede das luminárias (mm)
const R_OPEN = 24;    // raio da abertura de baixo (vela LED de 38–40 mm passa folgada)

/** Espelha o lado direito de um perfil (x >= 0) e fecha a silhueta inteira. */
function mirrorSil(right, top) {
  return [[0, 0], ...right, [0, top], ...right.slice().reverse().map(([x, z]) => [-x, z])];
}

/**
 * Casca oca girada a partir de uma silhueta: parede W_LAMP, piso em anel, abertura embaixo
 * e teto interno em cone de 45° (imprime sem suporte por dentro).
 */
function lampShell(sil, zc, segs = 144) {
  const cone = [[0, zc], [-600, zc - 600], [600, zc - 600]];
  const inner = csUnion([csIntersect(csOffset(sil, -W_LAMP), cone), rect(-R_OPEN, -1, R_OPEN, W_LAMP + 1)]);
  return revolve(csSub(sil, inner), segs);
}

/** Deformação radial: f(ângulo a partir da frente, z) multiplica x e y. */
const radial = (f) => (v) => {
  if (Math.hypot(v[0], v[1]) < 1e-9) return;
  const k = f(Math.atan2(v[1], v[0]) + Math.PI / 2, v[2]);
  v[0] *= k; v[1] *= k;
};

/** Leva um desenho em unidades (centro 0,0) para a frente: escala k, centro em (0, zc). */
const place = (sec, k, zc) => csMove(csScale(sec, k), 0, zc);
const mirrorX = (pts) => pts.map(([x, z]) => [-x, z]).reverse();

// ---- Rostos (unidades: ~1 = largura do rosto) --------------------------------------
function jackFace(kind) {
  const eye = (pts) => [pts, mirrorX(pts)];
  if (kind === 'fofo') {
    return csUnion([circle(-0.25, 0.2, 0.11, 40), circle(0.25, 0.2, 0.11, 40),
      csSub(ellipse(0, -0.05, 0.32, 0.24, 64), ellipse(0, 0.05, 0.36, 0.24, 64))]);
  }
  if (kind === 'bravo') {
    const top = [], bot = [];
    for (let i = 0; i <= 8; i++) top.push([-0.55 + 1.1 * i / 8, i % 2 ? -0.22 : -0.1]);
    for (let i = 0; i <= 8; i++) {
      const x = 0.55 - 1.1 * i / 8;
      bot.push([x, -0.2 - 0.24 * Math.cos(x / 0.55 * Math.PI / 2) + (i % 2 === 0 && i > 0 && i < 8 ? 0.12 : 0)]);
    }
    return csUnion([...eye([[-0.46, 0.32], [-0.4, 0.06], [-0.1, 0.14]]),
      [[-0.07, -0.02], [0.07, -0.02], [0, 0.08]], [...top, ...bot]]);
  }
  // feliz: olhos e nariz triangulares, sorriso com dois dentes
  const smile = csSub(csSub(ellipse(0, -0.08, 0.5, 0.32, 72), ellipse(0, 0.04, 0.56, 0.3, 72)),
    csUnion([rect(-0.17, -0.33, -0.07, -0.2), rect(0.07, -0.33, 0.17, -0.2)]));
  return csUnion([...eye([[-0.45, 0.1], [-0.13, 0.1], [-0.29, 0.38]]),
    [[-0.07, -0.03], [0.07, -0.03], [0, 0.09]], smile]);
}

function ghostFace(kind) {
  const eyes = [ellipse(-0.28, 0.25, 0.1, 0.17, 40), ellipse(0.28, 0.25, 0.1, 0.17, 40)];
  if (kind === 'fofo') return csUnion([...eyes, csSub(ellipse(0, -0.02, 0.3, 0.2, 64), ellipse(0, 0.06, 0.34, 0.2, 64))]);
  return csUnion([...eyes, ellipse(0, -0.14, 0.13, 0.18, 48)]);
}

/** Morcego de asas abertas, largura 2 (de -1 a 1). */
function batPts() {
  const r = [[0, 0.3], [0.07, 0.32], [0.12, 0.5], [0.17, 0.28], [0.35, 0.38], [0.65, 0.6], [1, 0.62],
    [0.9, 0.35], [0.78, 0.1], [0.64, 0.22], [0.52, -0.02], [0.38, 0.1], [0.26, -0.14], [0.13, -0.08], [0, -0.3]];
  return [...r, ...mirrorX(r).slice(1, -1)];
}
const bat = (w, cx = 0, cz = 0) => csMove(csScale(cs(batPts()), w / 2), cx, cz);

const LAMP_HINT = 'Imprima <b>em pé</b>, sem suporte, com o piso na mesa. Parede de 2,4 mm: use 3 perímetros. '
  + 'Coloque por cima de uma <b>vela LED</b> (tea light). <b>Nunca use vela de verdade</b>: o plástico derrete.';

export const HALLOWEEN = [
  {
    col: 'halloween', noPhoto: true, key: 'abobora', name: 'Abóbora luminária', emoji: '🎃',
    desc: 'Abóbora oca com gomos e rosto recortado. Vai por cima de uma vela LED e o rosto acende.',
    roles: [{ id: 'abobora', label: 'Abóbora', color: '#f08a24' }, { id: 'cabo', label: 'Cabinho', color: '#2e7d4f' }],
    text: false,
    opts: [
      { id: 'face', label: 'Rosto', choices: [['feliz', 'Feliz'], ['bravo', 'Bravo'], ['fofo', 'Fofo']], def: 'feliz' },
      { id: 'gomos', label: 'Gomos', min: 6, max: 12, step: 1, def: 8, unit: '' },
      { id: 'alt', label: 'Altura', min: 65, max: 100, step: 5, def: 80, unit: '%' },
    ],
    printHint: LAMP_HINT,
    build({ s, o }) {
      const R = 55 * s, H = 2 * R * o.alt / 100, dimple = 4 * s;
      const t0 = Math.asin(0.72), t1 = Math.asin(0.16), zOf = (t) => H / 2 * (1 - Math.cos(t)), z0 = zOf(t0);
      const right = [];
      for (let i = 0; i <= 60; i++) {
        const t = t0 + (Math.PI - t1 - t0) * i / 60;
        right.push([R * Math.sin(t), zOf(t) - z0]);
      }
      const top = right[right.length - 1][1];
      const sil = mirrorSil(right, top - dimple);
      let body = lampShell(sil, top - dimple - 2.5 * W_LAMP, 160);
      const N = o.gomos;
      body = warp(body, radial((a) => 0.9 + 0.1 * Math.abs(Math.cos(N * a / 2)) ** 0.6));
      body = sub(body, xz(place(jackFace(o.face), R * 0.9, top * 0.5), -2 * R, 0));
      const stemSec = [];
      for (let i = 0; i < 48; i++) {
        const a = 2 * Math.PI * i / 48, r = 7 * s * (1 + 0.12 * Math.cos(6 * a));
        stemSec.push([r * Math.cos(a), r * Math.sin(a)]);
      }
      const stem = twist(stemSec, top - dimple - 2, 14 * s + dimple, 50, 0.7);
      return { parts: [{ m: sub(body, stem), role: 'abobora' }, { m: stem, role: 'cabo' }], photos: [] };
    },
  },
  {
    col: 'halloween', noPhoto: true, key: 'fantasma', name: 'Fantasminha luminária', emoji: '👻',
    desc: 'Fantasminha oco com barra ondulada. Olhos e boca recortados acendem com a vela LED.',
    roles: [{ id: 'fantasma', label: 'Fantasma', color: '#f4f4f0' }],
    text: false,
    opts: [
      { id: 'face', label: 'Rosto', choices: [['boo', 'Buuu!'], ['fofo', 'Fofo']], def: 'boo' },
      { id: 'alt', label: 'Altura', min: 80, max: 130, step: 5, def: 100, unit: '%' },
    ],
    printHint: LAMP_HINT,
    build({ s, o }) {
      const R = 40 * s, H = 105 * s * o.alt / 100, zs = 0.55 * H, right = [];
      for (let i = 0; i <= 20; i++) {
        const z = zs * i / 20;
        right.push([R * (0.8 + 0.2 * (1 - z / zs) ** 2), z]);
      }
      for (let i = 1; i < 30; i++) {
        const a = Math.PI / 2 * i / 30;
        right.push([0.8 * R * Math.cos(a), zs + (H - zs) * Math.sin(a)]);
      }
      let body = lampShell(mirrorSil(right, H), H - 3 * W_LAMP);
      body = warp(body, radial((a, z) => 1 + 0.07 * Math.cos(7 * a) * Math.max(0, 1 - z / (0.35 * H)) ** 1.5));
      body = sub(body, xz(place(ghostFace(o.face), R, H * 0.62), -2 * R, 0));
      return { parts: [{ m: body, role: 'fantasma' }], photos: [] };
    },
  },
  {
    col: 'halloween', noPhoto: true, key: 'lapide', name: 'Lápide com nome', emoji: '🪦',
    desc: 'Lápide de mesa na grama, com morcego em cima. Escreva um nome ou "BOO".',
    roles: [
      { id: 'pedra', label: 'Pedra', color: '#7d8a99' },
      { id: 'grama', label: 'Grama', color: '#2e7d4f' },
      { id: 'detalhe', label: 'Morcego', color: '#1c1c1e' },
    ],
    text: true, textColor: '#1c1c1e', defText: ['BOO'],
    printHint: 'Imprima <b>em pé</b>, como aparece aqui. Não precisa de suporte.',
    build({ s }) {
      const W = 64 * s, H = 82 * s, T = 14 * s, zb = 6 * s, ra = W / 2;
      const stoneSec = csUnion([rect(-ra, zb, ra, H - ra), circle(0, H - ra, ra, 96)]);
      const grass = xy(roundedRect(-ra - 10 * s, -12 * s, ra + 10 * s, T + 8 * s, 4 * s), 0, zb);
      return {
        parts: [{ m: xz(stoneSec, 0, T), role: 'pedra' }, { m: grass, role: 'grama' },
          { m: xz(bat(30 * s, 0, H - ra + 4 * s), -0.8, 0), role: 'detalhe' }],
        photos: [],
        textBox: { face: 'front', y: 0, cx: 0, cz: (zb + 6 * s + H - ra) / 2, w: W - 12 * s, h: H - ra - zb - 10 * s },
      };
    },
  },
  {
    col: 'halloween', noPhoto: true, key: 'morcegos', name: 'Kit de morcegos', emoji: '🦇',
    desc: 'Morcegos de parede em tamanhos variados. Cole com fita dupla face.',
    roles: [{ id: 'morcego', label: 'Morcegos', color: '#1c1c1e' }],
    text: false,
    opts: [{ id: 'n', label: 'Quantidade', min: 2, max: 9, step: 1, def: 6, unit: '' }],
    printHint: 'Imprima <b>deitado</b>, como aparece aqui. Cabem vários numa mesa só.',
    build({ s, o }) {
      const sizes = [110, 90, 75, 60].map((w) => w * s), parts = [];
      let x = 0, y = 0, rowH = 0;
      for (let i = 0; i < o.n; i++) {
        const w = sizes[i % sizes.length], h = w * 0.46;
        if (x + w > 220) { x = 0; y += rowH + 6; rowH = 0; }
        parts.push(xy(bat(w, x + w / 2, y + h * 0.33), 0, 2.4));
        x += w + 6; rowH = Math.max(rowH, h);
      }
      return { parts: [{ m: union(parts), role: 'morcego' }], photos: [] };
    },
  },
];
