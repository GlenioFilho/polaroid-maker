// Modelos de suporte. Cada um devolve peças (sólido + papel de cor), onde a
// foto fica (só para a pré-visualização) e, se aceitar, onde vai o texto.
//
// Convenções: mm, Z para cima, a frente do suporte olha para -Y.
// ctx = { P (foto), gap (fenda), s (escala), hasText, o (opções do modelo) }
// textBox: { face: 'front', y, cx, cz, w, h }  -> texto na face frontal (plano y)
// tex: [{ role, sec, y?, margin? }]           -> áreas da face frontal que aceitam textura (seção x,z)
//          { face: 'top',   z, cx, cy, w, h }  -> texto em cima (plano z)
import {
  cs, csUnion, csSub, csMove, csRotate, csRound, csBounds, csIntersect, rect, circle, ellipse, band, roundedRect,
  xz, yz, xy, box, union, sub, move, rotate,
} from './geo.js';
import { HALLOWEEN } from './halloween.js';

const sc = (s) => (pts) => pts.map(([x, z]) => [x * s, z * s]);

/** Silhueta em pé (vista de frente) com fenda no topo. */
function slotCut(sec, T, gap, zb) {
  const b = csBounds(sec);
  const front = (T - gap) / 2;
  return { cut: box(b.min[0] - 5, b.max[0] + 5, front, front + gap, zb, b.max[1] + 5), yc: front + gap / 2 };
}

/** Barra (retângulo) de largura w ao longo do segmento (x0, z0) → (x1, z1). */
function bar(x0, z0, x1, z1, w) {
  const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz), nx = -dz / l * w / 2, nz = dx / l * w / 2;
  return [[x0 + nx, z0 + nz], [x0 - nx, z0 - nz], [x1 - nx, z1 - nz], [x1 + nx, z1 + nz]];
}

/** Bloco visto de lado, com fenda inclinada para trás (clássico e pé da moldura). */
function slotBlock({ W, D, H, ch, tilt, slot, yc, gap }) {
  const body = yz([[0, 0], [D, 0], [D, H], [ch, H], [0, H - ch]], 0, W);
  const t = tilt * Math.PI / 180;
  const zb = H - slot * Math.cos(t), yb = yc - slot * Math.sin(t);
  const cut = move(rotate(box(-1, W + 1, -gap / 2, gap / 2, 0, 300), -tilt, 0, 0), 0, yb, zb);
  return { m: sub(body, cut), zb, yb };
}

const POLAROID = [
  {
    key: 'classico', texture: true, name: 'Clássico', emoji: '▱',
    desc: 'Bloco com fenda inclinada e frente chanfrada. Texto na frente.',
    roles: [{ id: 'base', label: 'Bloco', color: '#e8dcc4' }],
    text: true, textColor: '#8b5a3c',
    opts: [{ id: 'tilt', label: 'Inclinação', min: 0, max: 25, step: 1, def: 12, unit: '°' }],
    build({ gap, s, o }) {
      const W = 60 * s, H = 22 * s, ch = 8 * s;
      const { m, zb, yb } = slotBlock({ W, D: 26 * s, H, ch, tilt: o.tilt, slot: 15 * s, yc: 14 * s, gap });
      return {
        parts: [{ m, role: 'base' }],
        photos: [{ x: W / 2, y: yb, z: zb, rx: -o.tilt }],
        textBox: { face: 'front', y: 0, cx: W / 2, cz: (H - ch) / 2, w: W - 8 * s, h: H - ch - 4 * s },
        tex: [{ role: 'base', sec: rect(0, 0, W, H - ch) }],
      };
    },
  },
  {
    key: 'nome', name: 'Base com nome', emoji: '✎',
    desc: 'Base larga com a foto atrás e um nome grande em cima, na frente.',
    roles: [{ id: 'base', label: 'Base', color: '#1c1c1e' }],
    text: true, textColor: '#f4f4f0',
    opts: [{ id: 'tilt', label: 'Inclinação', min: 0, max: 20, step: 1, def: 8, unit: '°' }],
    build({ P, gap, s, o }) {
      const W = P.w + 14, D = 36 * s, H = 12 * s, slot = 9 * s, ys = D - 9 * s;
      const t = o.tilt * Math.PI / 180;
      const zb = H - slot * Math.cos(t), yb = ys - slot * Math.sin(t);
      const body = xy(roundedRect(-W / 2, 0, W / 2, D, 5 * s), 0, H);
      const cut = move(rotate(box(-W, W, -gap / 2, gap / 2, 0, 300), -o.tilt, 0, 0), 0, yb, zb);
      const m3 = 3 * s, hT = ys - gap - 2 * m3 - 1;
      return {
        parts: [{ m: sub(body, cut), role: 'base' }],
        photos: [{ x: 0, y: yb, z: zb, rx: -o.tilt }],
        textBox: { face: 'top', z: H, cx: 0, cy: m3 + hT / 2, w: W - 12, h: hT },
      };
    },
  },
  {
    key: 'casinha', texture: true, name: 'Casinha', emoji: '⌂',
    desc: 'Telhado, chaminé, porta e janela. A foto sai do telhado.',
    roles: [
      { id: 'base', label: 'Paredes', color: '#f4f4f0' },
      { id: 'roof', label: 'Telhado', color: '#d23c3c' },
      { id: 'detail', label: 'Porta e janela', color: '#8b5a3c' },
    ],
    text: false,
    build({ gap, s }) {
      const S = sc(s), T = 16 * s;
      const roof = (x) => 32 + (35 - Math.abs(x)) * 26 / 35;
      const walls = xz(S(rect(-30, 0, 30, 32)), 0, T);
      const roofSec = cs(S([[-35, 32], [35, 32], [24, roof(24)], [24, 50], [18, 50], [18, roof(18)], [0, 58]]));
      const zb = 42 * s;
      const { cut, yc } = slotCut(roofSec, T, gap, zb);
      const d = 1 * s;
      const deco = [xz(S(rect(6, 0, 17, 21)), -d, 0), xz(S(circle(14.5, 10.5, 1.1, 24)), -1.9 * s, -d),
        xz(S(rect(-24, 12, -6, 13.2)), -d, 0)];
      for (const [x0, x1] of [[-22, -15.7], [-14.3, -8]]) {
        for (const [z0, z1] of [[14, 20.3], [21.7, 28]]) deco.push(xz(S(rect(x0, z0, x1, z1)), -d, 0));
      }
      return {
        parts: [{ m: walls, role: 'base' }, { m: sub(xz(roofSec, 0, T), cut), role: 'roof' },
          { m: union(deco), role: 'detail' }],
        photos: [{ x: 0, y: yc, z: zb }],
        tex: [{ role: 'base', sec: S(rect(-30, 0, 30, 32)) }, { role: 'roof', sec: roofSec }],
      };
    },
  },
  {
    key: 'montanhas', texture: true, name: 'Montanhas', emoji: '⛰',
    desc: 'Pico nevado e pinheirinhos. Texto na base, entre as árvores.',
    roles: [
      { id: 'base', label: 'Montanha', color: '#7d8a99' },
      { id: 'snow', label: 'Neve', color: '#f4f4f0' },
      { id: 'trees', label: 'Pinheiros', color: '#2e7d4f' },
    ],
    text: true, textColor: '#f4f4f0',
    build({ gap, s }) {
      const S = sc(s), T = 16 * s;
      const sec = cs(S([[-55, 0], [55, 0], [55, 8], [32, 34], [22, 25], [1.5, 56], [-1.5, 56],
        [-16, 36], [-30, 38], [-55, 12]]));
      const zb = 40 * s;
      const { cut, yc } = slotCut(sec, T, gap, zb);
      const left = (z) => -1.5 + (56 - z) / 20 * -14.5, right = (z) => 1.5 + (56 - z) / 31 * 20.5;
      const snow = S([[left(47), 47], [-5.5, 44.5], [-3, 46.5], [-0.5, 44], [2, 46.5], [4.5, 44.5],
        [right(47), 47], [1.5, 56], [-1.5, 56]]);
      const pine = (x, k) => S([[-1.2, 0], [1.2, 0], [1.2, 3], [6, 3], [2.5, 8], [4.5, 8], [1.5, 13], [3, 13], [0, 18],
        [-3, 13], [-1.5, 13], [-4.5, 8], [-2.5, 8], [-6, 3], [-1.2, 3]].map(([px, pz]) => [x + px * k, pz * k]));
      const trees = [[-45, 1], [-37, 0.8], [40, 0.9], [47, 0.75]].map(([x, k]) => xz(pine(x, k), -1 * s, 0));
      return {
        parts: [{ m: sub(xz(sec, 0, T), cut), role: 'base' }, { m: xz(snow, -1 * s, 0), role: 'snow' },
          { m: union(trees), role: 'trees' }],
        photos: [{ x: 0, y: yc, z: zb }],
        textBox: { face: 'front', y: 0, cx: 2 * s, cz: 6.5 * s, w: 54 * s, h: 9 * s },
        tex: [{ role: 'base', sec }],
      };
    },
  },
  {
    key: 'nuvem', texture: true, name: 'Nuvem sorridente', emoji: '☁',
    desc: 'Nuvem fofa com olhos, sorriso e bochechas.',
    roles: [
      { id: 'base', label: 'Nuvem', color: '#cfe3f5' },
      { id: 'face', label: 'Rosto', color: '#1c1c1e' },
      { id: 'cheeks', label: 'Bochechas', color: '#f19bb4' },
    ],
    text: true, textColor: '#1c1c1e',
    build({ gap, s }) {
      const S = sc(s), T = 16 * s;
      const blobs = [[-24, 22, 14], [0, 30, 20], [24, 22, 15], [-40, 14, 11], [40, 14, 11], [-14, 12, 13], [14, 12, 13]];
      let sec = csUnion(blobs.map(([x, z, r]) => S(circle(x, z, r))));
      sec = csRound(sec, 2.5 * s);
      sec = csMove(csSub(sec, S(rect(-80, -40, 80, 4))), 0, -4 * s);
      const zb = 26 * s;
      const { cut, yc } = slotCut(sec, T, gap, zb);
      const face = union([xz(S(circle(-9, 26, 2.8, 32)), -1 * s, 0), xz(S(circle(9, 26, 2.8, 32)), -1 * s, 0),
        xz(S(band(0, 25, 8, 10.4, 205, 335)), -1 * s, 0)]);
      const cheeks = union([-17, 17].map((x) => xz(S(circle(x, 19, 3.2, 32)), -0.6 * s, 0)));
      return {
        parts: [{ m: sub(xz(sec, 0, T), cut), role: 'base' }, { m: face, role: 'face' }, { m: cheeks, role: 'cheeks' }],
        photos: [{ x: 0, y: yc, z: zb }],
        textBox: { face: 'front', y: 0, cx: 0, cz: 7 * s, w: 40 * s, h: 7 * s },
        tex: [{ role: 'base', sec }],
      };
    },
  },
  {
    key: 'coracao', texture: true, name: 'Coração', emoji: '♥',
    desc: 'Coração em pé num pedestal, estilo troféu. Texto no pedestal.',
    roles: [
      { id: 'base', label: 'Coração', color: '#d23c3c' },
      { id: 'stand', label: 'Pedestal', color: '#f4f4f0' },
    ],
    text: true, textColor: '#d23c3c',
    build({ gap, s, hasText }) {
      const T = 16 * s, k = 2.3 * s, n = 240, pts = [];
      for (let i = 0; i < n; i++) {
        const t = 2 * Math.PI * i / n;
        pts.push([16 * Math.sin(t) ** 3 * k,
          (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * k]);
      }
      const ph = (hasText ? 12 : 6) * s, cut0 = -13 * k;
      const sec = csMove(csSub(pts, rect(-100, -100, 100, cut0)), 0, -cut0 + ph);
      const b = csBounds(sec), zb = b.max[1] - 20 * s;
      const { cut, yc } = slotCut(sec, T, gap, zb);
      const stand = xy(roundedRect(-34 * s, -5 * s, 34 * s, T + 5 * s, 6 * s), 0, ph);
      const shine = xz(circle(-14 * s, ph + 34 * s, 4 * s, 40), -0.8 * s, 0);
      return {
        parts: [{ m: sub(xz(sec, 0, T), cut), role: 'base' }, { m: stand, role: 'stand' }, { m: shine, role: 'stand' }],
        photos: [{ x: 0, y: yc, z: zb }],
        textBox: { face: 'front', y: -5 * s, cx: 0, cz: ph / 2, w: 58 * s, h: ph - 4 * s },
        tex: [{ role: 'base', sec: csSub(sec, rect(-100, 0, 100, ph)) }],
      };
    },
  },
  {
    key: 'carro', texture: true, name: 'Carrinho', emoji: '🚗',
    desc: 'Silhueta de carro com rodas dos dois lados. Texto na porta.',
    roles: [
      { id: 'base', label: 'Carroceria', color: '#2f6fd0' },
      { id: 'tires', label: 'Pneus', color: '#1c1c1e' },
      { id: 'detail', label: 'Vidros e calotas', color: '#c0c4c8' },
    ],
    text: true, textColor: '#f4f4f0',
    build({ gap, s, hasText }) {
      const S = sc(s), T = 18 * s;
      const sec = cs(S([[-55, 0], [55, 0], [55, 14], [52, 20], [38, 24], [20, 26], [8, 40], [-25, 41],
        [-42, 26], [-54, 25], [-56, 16]]));
      const zb = 27 * s;
      const { cut, yc } = slotCut(sec, T, gap, zb);
      const tires = [], detail = [];
      for (const wx of [-34, 34]) {
        tires.push(xz(S(circle(wx, 10.5, 10.5)), -1.6 * s, 0), xz(S(circle(wx, 10.5, 10.5)), T, T + 1.6 * s));
        detail.push(xz(S(circle(wx, 10.5, 4.5, 40)), -2.6 * s, -1.6 * s), xz(S(circle(wx, 10.5, 4.5, 40)), T + 1.6 * s, T + 2.6 * s));
      }
      for (const p of [[[-12, 28], [5, 28], [-1, 37.5], [-12, 37.5]], [[-37, 28], [-15, 28], [-15, 37.5], [-27, 37.5]],
        [[49, 15], [54, 15], [52.5, 18], [49, 18]], [[-54, 17], [-50, 17], [-50, 22], [-54.3, 22]]]) {
        detail.push(xz(S(p), -0.8 * s, 0));
      }
      if (!hasText) detail.push(xz(S(rect(-14, 12, -6, 13.4)), -0.6 * s, 0));
      return {
        parts: [{ m: sub(xz(sec, 0, T), cut), role: 'base' }, { m: union(tires), role: 'tires' },
          { m: union(detail), role: 'detail' }],
        photos: [{ x: 0, y: yc, z: zb }],
        textBox: { face: 'front', y: 0, cx: 0, cz: 7.2 * s, w: 38 * s, h: 7.5 * s },
        tex: [{ role: 'base', sec }],
      };
    },
  },
  {
    key: 'gatinho', texture: true, name: 'Gatinho', emoji: '🐱',
    desc: 'Cabeça de gato com orelhas, bigodes e patinhas. A foto sai entre as orelhas.',
    roles: [
      { id: 'base', label: 'Gato', color: '#f08a24' },
      { id: 'face', label: 'Olhos e bigodes', color: '#1c1c1e' },
      { id: 'pink', label: 'Nariz, orelhas e patas', color: '#f19bb4' },
    ],
    text: true, textColor: '#1c1c1e',
    build({ gap, s, hasText }) {
      const S = sc(s), T = 16 * s;
      let sec = csUnion([S(circle(0, 34, 24)), S(roundedRect(-30, 0, 30, 18, 8)),
        S([[-20.8, 46], [-6.2, 57.2], [-22, 66]]), S([[20.8, 46], [22, 66], [6.2, 57.2]])]);
      sec = csRound(sec, 1.5 * s);
      const zb = 50 * s;
      const { cut, yc } = slotCut(sec, T, gap, zb);
      const d = 1 * s;
      const face = [xz(S(ellipse(-9, 38, 3.2, 4.2, 40)), -d, 0), xz(S(ellipse(9, 38, 3.2, 4.2, 40)), -d, 0),
        xz(S(band(-2.4, 28.6, 1.9, 3.0, 200, 340, 24)), -d, 0), xz(S(band(2.4, 28.6, 1.9, 3.0, 200, 340, 24)), -d, 0)];
      for (const side of [-1, 1]) {
        for (const [dz, ang] of [[0, 8], [-3.2, -4]]) {
          const w = csMove(csRotate(S(rect(-6, -0.5, 6, 0.5)), side * ang), side * 17 * s, (31 + dz) * s);
          face.push(xz(w, -d, 0));
        }
      }
      const pink = [xz(S([[-2.6, 31.5], [2.6, 31.5], [0, 28.8]]), -d, 0),
        xz(S([[-18.6, 50], [-9.5, 56.3], [-19.8, 61.6]]), -d, 0), xz(S([[18.6, 50], [19.8, 61.6], [9.5, 56.3]]), -d, 0)];
      if (!hasText) pink.push(xz(S(circle(-13, 5, 5, 40)), -d, 0), xz(S(circle(13, 5, 5, 40)), -d, 0));
      return {
        parts: [{ m: sub(xz(sec, 0, T), cut), role: 'base' }, { m: union(face), role: 'face' },
          { m: union(pink), role: 'pink' }],
        photos: [{ x: 0, y: yc, z: zb }],
        textBox: { face: 'front', y: 0, cx: 0, cz: 6 * s, w: 40 * s, h: 7 * s },
        tex: [{ role: 'base', sec }],
      };
    },
  },
  {
    key: 'arcoiris', texture: true, name: 'Arco-íris', emoji: '🌈',
    desc: 'Três faixas coloridas com nuvens nos pés. Feito para multicor.',
    roles: [
      { id: 'c1', label: 'Faixa de fora', color: '#d23c3c' },
      { id: 'c2', label: 'Faixa do meio', color: '#f5d33f' },
      { id: 'c3', label: 'Faixa de dentro', color: '#2f6fd0' },
      { id: 'clouds', label: 'Nuvens', color: '#f4f4f0' },
    ],
    text: false,
    build({ gap, s }) {
      const S = sc(s), T = 14 * s;
      const cloud = (x, m) => [[x, 7, 9], [x + 10 * m, 4, 6], [x - 10 * m, 4, 6.5], [x - 4 * m, 12, 6]].map(([cx, cz, r]) => S(circle(cx, cz, r)));
      const clouds = csSub(csUnion([...cloud(-41, -1), ...cloud(41, 1)]), S(rect(-90, -30, 90, 0)));
      const zb = 34 * s;
      const outer = cs(S(band(0, 0, 32, 50, 0, 180, 128)));
      const { cut, yc } = slotCut(outer, T, gap, zb);
      const secs = [[44, 50, 'c1'], [38, 44, 'c2'], [32, 38, 'c3']].map(([r0, r1, role]) =>
        ({ sec: csSub(S(band(0, 0, r0, r1, 0, 180, 128)), clouds), role }));
      const bands = secs.map(({ sec, role }) => ({ m: sub(xz(sec, 0, T), cut), role }));
      return {
        parts: [...bands, { m: xz(clouds, -1 * s, T + 1 * s), role: 'clouds' }],
        photos: [{ x: 0, y: yc, z: zb }],
        tex: secs.map(({ sec, role }) => ({ role, sec, margin: 0.8 })),
      };
    },
  },
  {
    key: 'leque', texture: true, name: 'Leque de fotos', emoji: '🂠',
    desc: 'Cúpula com várias fendas: as fotos abrem como cartas na mão.',
    roles: [{ id: 'base', label: 'Cúpula', color: '#c9a7e0' }],
    text: true, textColor: '#f4f4f0',
    opts: [{ id: 'n', label: 'Quantas fotos', min: 2, max: 5, step: 1, def: 5, unit: '' }],
    build({ P, gap, s, o }) {
      const a = 44 * s, b = 38 * s, n = o.n;
      const dome = [];
      for (let i = 0; i <= 64; i++) dome.push([a * Math.cos(Math.PI * i / 64), b * Math.sin(Math.PI * i / 64)]);
      const wall = 3 * s, inner = 2.4 * s, A = 4 * (n - 1);
      const total = 2 * wall + n * gap + (n - 1) * inner;
      let m = xz(dome, 0, total);
      const photos = [];
      let y = wall;
      for (let k = 0; k < n; k++) {
        const th = n === 1 ? 0 : A - (2 * A * k) / (n - 1), r = th * Math.PI / 180;
        const bx = -70 * s * Math.sin(r), bz = -45 * s + 70 * s * Math.cos(r);
        const c = box(-(P.w / 2 + 0.6), P.w / 2 + 0.6, -gap / 2, gap / 2, 0, 300);
        m = sub(m, move(rotate(c, 0, -th, 0), bx, y + gap / 2, bz));
        photos.push({ x: bx, y: y + gap / 2, z: bz, ry: -th });
        y += gap + inner;
      }
      return {
        parts: [{ m, role: 'base' }],
        photos,
        textBox: { face: 'front', y: 0, cx: 0, cz: 6.5 * s, w: 56 * s, h: 8 * s },
        tex: [{ role: 'base', sec: dome }],
      };
    },
  },
  {
    key: 'moldura', name: 'Moldura', emoji: '▣',
    desc: 'Moldura fina (imprime deitada), foto entra por cima. Argola para prego, legenda opcional embaixo.',
    roles: [
      { id: 'base', label: 'Fundo', color: '#f4f4f0' },
      { id: 'rails', label: 'Trilhos', color: '#1c1c1e' },
    ],
    text: true, textColor: '#1c1c1e',
    build({ P, gap, hasText }) {
      const m = 4, xIn = P.w / 2 + 0.6, Wx = xIn + m, yIn = 3.4, H = yIn + P.h + 4.6;
      const plate = 1.6, space = Math.max(1.2, gap - 0.2), lip = 1.2, over = 3.1;
      const z1 = plate, z2 = plate + space, band_ = hasText ? 16 : 0;
      const ringY = H + 5.2;
      const ring = xy([circle(0, ringY, 6.5, 48), circle(0, ringY, 3.4, 48)].map((c, i) => (i ? c.reverse() : c)), 0, plate);
      const base = [xy(roundedRect(-Wx, -band_, Wx, H, 3), 0, plate), ring];
      if (hasText) base.push(box(-Wx, Wx, -band_, 0, plate, z2 + lip));
      const rails = [box(-Wx, -xIn, 0, H, z1, z2), box(xIn, Wx, 0, H, z1, z2), box(-xIn, xIn, 0, yIn, z1, z2),
        box(-Wx, -xIn + over, 0, H, z2, z2 + lip), box(xIn - over, Wx, 0, H, z2, z2 + lip),
        box(-xIn + over, xIn - over, 0, yIn + 2.5, z2, z2 + lip)];
      return {
        parts: [{ m: union(base), role: 'base' }, { m: union(rails), role: 'rails' }],
        photos: [{ x: 0, y: yIn + 0.1, z: z1 + Math.min(0.6, space / 2), rx: -90 }],
        textBox: { face: 'top', z: z2 + lip, cx: 0, cy: -band_ / 2, w: 2 * Wx - 10, h: band_ - 5 },
      };
    },
  },
  {
    key: 'pe', texture: true, name: 'Pé da moldura', emoji: '⊥',
    desc: 'Calço para a Moldura ficar em pé na mesa. Fenda larga para a espessura da moldura.',
    roles: [{ id: 'base', label: 'Pé', color: '#1c1c1e' }],
    text: true, textColor: '#f4f4f0',
    opts: [{ id: 'tilt', label: 'Inclinação', min: 5, max: 25, step: 1, def: 15, unit: '°' }],
    build({ gap, s, o }) {
      const W = 50 * s, H = 22 * s, ch = 10 * s;
      const frame = 1.6 + Math.max(1.2, gap - 0.2) + 1.2;          // espessura da Moldura
      const { m } = slotBlock({ W, D: 32 * s, H, ch, tilt: o.tilt, slot: 12 * s, yc: 17 * s, gap: frame + 0.4 });
      return {
        parts: [{ m, role: 'base' }],
        photos: [],
        textBox: { face: 'front', y: 0, cx: W / 2, cz: (H - ch) / 2, w: W - 8 * s, h: H - ch - 4 * s },
        tex: [{ role: 'base', sec: rect(0, 0, W, H - ch) }],
      };
    },
  },

  // ---------------------------------------------------------------- novos (v2)
  {
    key: 'margarida', texture: true, name: 'Margarida', emoji: '🌼',
    desc: 'Flor de pétalas com miolo de outra cor, caule e folhas num montinho de grama. Texto na grama.',
    roles: [
      { id: 'base', label: 'Pétalas', color: '#f4f4f0' },
      { id: 'center', label: 'Miolo', color: '#f5d33f' },
      { id: 'stem', label: 'Caule e grama', color: '#2e7d4f' },
    ],
    text: true, textColor: '#f4f4f0',
    build({ gap, s }) {
      const S = sc(s), T = 16 * s, hz = 46 * s;
      const petals = [S(circle(0, 0, 12))];
      for (let i = 0; i < 12; i++) petals.push(csRotate(S(ellipse(17, 0, 11, 6, 32)), i * 30 + 15));
      const head = csMove(csRound(csUnion(petals), 1 * s), 0, hz);
      const leaf = (x, z, a) => csMove(csRotate(S(ellipse(0, 0, 9, 3.6, 40)), a), x * s, z * s);
      const mound = csSub(csUnion([S(rect(-30, 0, 30, 7)), S(ellipse(0, 7, 30, 7, 72))]), S(rect(-40, -20, 40, 0)));
      const stem = csSub(csUnion([S(rect(-4, 10, 4, 47)), leaf(9, 25, 35), leaf(-9, 20, -35), mound]), head);
      const zb = 56 * s;
      const { cut, yc } = slotCut(head, T, gap, zb);
      return {
        parts: [{ m: sub(xz(head, 0, T), cut), role: 'base' }, { m: xz(stem, 0, T), role: 'stem' },
          { m: xz(S(circle(0, 46, 9.5, 48)), -1.2 * s, 0), role: 'center' }],
        photos: [{ x: 0, y: yc, z: zb }],
        textBox: { face: 'front', y: 0, cx: 0, cz: 5.5 * s, w: 44 * s, h: 7 * s },
        tex: [{ role: 'base', sec: head }, { role: 'stem', sec: stem }],
      };
    },
  },
  {
    key: 'cogumelo', texture: true, name: 'Cogumelo', emoji: '🍄',
    desc: 'Chapéu vermelho com bolinhas brancas e pé claro. Texto no pé.',
    roles: [
      { id: 'base', label: 'Chapéu', color: '#d23c3c' },
      { id: 'dots', label: 'Bolinhas', color: '#f4f4f0' },
      { id: 'stem', label: 'Pé', color: '#e8dcc4' },
    ],
    text: true, textColor: '#8b5a3c',
    build({ gap, s }) {
      const S = sc(s), T = 16 * s, pts = [];
      for (let i = 0; i <= 64; i++) pts.push([40 * Math.cos(Math.PI * i / 64), 30 + 30 * Math.sin(Math.PI * i / 64)]);
      for (let i = 1; i < 16; i++) { const x = -40 + 80 * i / 16; pts.push([x, 30 - 4 * (1 - (x / 40) ** 2)]); }
      const cap = csRound(S(pts), 2 * s);
      const stem = csSub(csRound(S([[-17, 0], [17, 0], [13, 9], [12, 31], [-12, 31], [-13, 9]]), 3 * s), cap);
      const zb = 41 * s;
      const { cut, yc } = slotCut(cap, T, gap, zb);
      const dots = [[-22, 41, 5.5], [2, 50, 6.5], [24, 41, 5], [-8, 34, 3.2], [13, 34, 3.4], [-33, 33, 2.8]]
        .map(([x, z, r]) => xz(S(circle(x, z, r, 40)), -1 * s, 0));
      return {
        parts: [{ m: sub(xz(cap, 0, T), cut), role: 'base' }, { m: union(dots), role: 'dots' },
          { m: xz(stem, 0, T), role: 'stem' }],
        photos: [{ x: 0, y: yc, z: zb }],
        textBox: { face: 'front', y: 0, cx: 0, cz: 14 * s, w: 21 * s, h: 9 * s },
        tex: [{ role: 'base', sec: cap }, { role: 'stem', sec: stem }],
      };
    },
  },
  {
    key: 'onda', texture: true, name: 'Onda (3 fotos)', emoji: '🌊',
    desc: 'Onda comprida com 3 fendas: a do meio mais alta e atrás, as dos lados na frente.',
    roles: [
      { id: 'base', label: 'Onda', color: '#2f6fd0' },
      { id: 'foam', label: 'Espuma', color: '#f4f4f0' },
    ],
    text: true, textColor: '#f4f4f0',
    build({ P, gap, s }) {
      const sp = Math.min(0.7 * P.w, (220 - P.w) / 2), half = sp + P.w / 2 + 6;
      const top = (x) => (20 + 8 * Math.cos(Math.PI * x / half)) * s;
      const N = 96, crest = [];
      for (let i = 0; i <= N; i++) { const x = -half + 2 * half * i / N; crest.push([x, top(x)]); }
      const prof = csRound([[half, 0], ...crest.slice().reverse(), [-half, 0]], 2);
      const foam = csIntersect(prof, [...crest.map(([x, z]) => [x, z + 1]).reverse(),
        ...crest.map(([x, z]) => [x, z - 3.5 * s])]);
      const wall = 6 * s, yF = wall + gap / 2, yB = yF + gap + 4 * s, D = yB + gap / 2 + wall;
      let m = xz(prof, 0, D);
      const photos = [];
      for (const k of [-1, 0, 1]) {
        const x = k * sp, y = k ? yF : yB, zb = top(x) - 11 * s;
        m = sub(m, box(x - P.w / 2 - 0.6, x + P.w / 2 + 0.6, y - gap / 2, y + gap / 2, zb, 300));
        photos.push({ x, y, z: zb });
      }
      return {
        parts: [{ m, role: 'base' }, { m: xz(foam, -1 * s, 0), role: 'foam' }],
        photos,
        textBox: { face: 'front', y: 0, cx: 0, cz: 5.5 * s, w: Math.min(80, half), h: 7 * s },
        tex: [{ role: 'base', sec: prof }],
      };
    },
  },
  {
    key: 'portalapis', texture: true, name: 'Porta-lápis', emoji: '✏',
    desc: 'Copo para lápis e canetas com a foto na frente, atrás de uma janela. A foto entra por cima.',
    roles: [
      { id: 'base', label: 'Copo', color: '#a8d5a2' },
      { id: 'trim', label: 'Moldura da foto', color: '#f4f4f0' },
    ],
    text: true, textColor: '#1c1c1e',
    build({ P, gap, s, hasText }) {
      const wall = 2.4, skin = 1.6, fw = 2 * skin + gap, xIn = P.w / 2 + 0.6;
      const W = P.w + 2 * (wall + 3), D = 58 * s, zp = 2, H = zp + P.h + 3;
      const zw = hasText ? 18 : 8, xw = P.w / 2 - 4;
      const outer = xy(roundedRect(-W / 2, 0, W / 2, D, 5), 0, H);
      const hollow = xy(roundedRect(-W / 2 + wall, fw, W / 2 - wall, D - wall, 3), 2.4, H + 1);
      const pocket = box(-xIn, xIn, skin, skin + gap, zp, H + 1);
      const winSec = roundedRect(-xw, zw, xw, H + 12, 4);
      const win = xz(winSec, -1, skin + 0.01);
      const trim = csIntersect(csSub(roundedRect(-xw - 3, zw - 3, xw + 3, H + 20, 6), winSec), rect(-W, 0, W, H));
      return {
        parts: [{ m: sub(outer, union([hollow, pocket, win])), role: 'base' }, { m: xz(trim, -1, 0), role: 'trim' }],
        photos: [{ x: 0, y: skin + gap / 2, z: zp }],
        textBox: { face: 'front', y: 0, cx: 0, cz: (zw - 3) / 2, w: W - 16, h: zw - 9 },
        tex: [{ role: 'base', sec: csSub(rect(-W / 2 + 5, 0, W / 2 - 5, H), roundedRect(-xw - 3, zw - 3, xw + 3, H + 20, 6)) }],
      };
    },
  },
  {
    key: 'cacto', texture: true, name: 'Cacto', emoji: '🌵',
    desc: 'Cacto de dois braços num vasinho, com uma florzinha. Texto no vaso.',
    roles: [
      { id: 'base', label: 'Cacto', color: '#2e7d4f' },
      { id: 'pot', label: 'Vaso', color: '#c0623e' },
      { id: 'flower', label: 'Flor', color: '#f19bb4' },
    ],
    text: true, textColor: '#f4f4f0',
    build({ gap, s }) {
      const S = sc(s), T = 16 * s;
      const pot = csRound(csUnion([S([[-22, 0], [22, 0], [26, 23], [-26, 23]]), S(rect(-28, 22, 28, 29))]), 1.2 * s);
      const body = csRound(csUnion([S(roundedRect(-11, 20, 11, 80, 10.9)),
        S(rect(-25, 40, -5, 49)), S(roundedRect(-31, 40, -19, 64, 5.9)),
        S(rect(5, 50, 25, 58)), S(roundedRect(19, 50, 31, 71, 5.9))]), 2 * s);
      const cact = csSub(body, pot);
      const zb = 62 * s;
      const { cut, yc } = slotCut(cact, T, gap, zb);
      const fl = [S(circle(25, 66, 1.6, 24))];
      for (let i = 0; i < 5; i++) {
        const a = i * 72 * Math.PI / 180;
        fl.push(S(circle(25 + 2.6 * Math.cos(a), 66 + 2.6 * Math.sin(a), 1.8, 24)));
      }
      return {
        parts: [{ m: sub(xz(cact, 0, T), cut), role: 'base' }, { m: xz(pot, -2 * s, T + 2 * s), role: 'pot' },
          { m: xz(csUnion(fl), -1.2 * s, 0), role: 'flower' }],
        photos: [{ x: 0, y: yc, z: zb }],
        textBox: { face: 'front', y: -2 * s, cx: 0, cz: 11 * s, w: 34 * s, h: 9 * s },
        tex: [{ role: 'base', sec: cact }, { role: 'pot', sec: pot, y: -2 * s }],
      };
    },
  },
  {
    key: 'arco', texture: true, name: 'Arco boho', emoji: '◠',
    desc: 'Arcos cheios em tons terrosos, estilo boho, sobre uma base. Texto na base.',
    roles: [
      { id: 'c1', label: 'Arco de fora', color: '#c0623e' },
      { id: 'c2', label: 'Arco do meio', color: '#c9a54a' },
      { id: 'c3', label: 'Miolo', color: '#e8dcc4' },
      { id: 'base', label: 'Base', color: '#f4f4f0' },
    ],
    text: true, textColor: '#c0623e',
    build({ gap, s }) {
      const S = sc(s), T = 14 * s, z0 = 12;
      const semi = (r) => {
        const p = [];
        for (let i = 0; i <= 128; i++) p.push([r * Math.cos(Math.PI * i / 128), z0 + r * Math.sin(Math.PI * i / 128)]);
        return S(p);
      };
      const baseSec = S(roundedRect(-56, 0, 56, z0, 3));
      const all = csUnion([semi(48), baseSec]);
      const zb = (z0 + 48 - 18) * s;
      const { cut, yc } = slotCut(all, T, gap, zb);
      const secs = [[csSub(semi(48), semi(35)), 'c1'], [csSub(semi(35), semi(22)), 'c2'], [semi(22), 'c3']];
      return {
        parts: [...secs.map(([sec, role]) => ({ m: sub(xz(sec, 0, T), cut), role })),
          { m: xz(baseSec, -3 * s, T + 3 * s), role: 'base' }],
        photos: [{ x: 0, y: yc, z: zb }],
        textBox: { face: 'front', y: -3 * s, cx: 0, cz: 6 * s, w: 92 * s, h: 7.5 * s },
        tex: secs.map(([sec, role]) => ({ role, sec, margin: 0.8 })),
      };
    },
  },
  {
    key: 'cavalete', name: 'Cavalete', emoji: '🖼',
    desc: 'Mini cavalete de pintor: a foto descansa na prateleira, encostada. Imprima com brim.',
    roles: [{ id: 'base', label: 'Cavalete', color: '#b98a5e' }],
    text: false,
    opts: [{ id: 'tilt', label: 'Inclinação', min: 8, max: 22, step: 1, def: 14, unit: '°' }],
    build({ P, s, o }) {
      const a = o.tilt, ta = Math.tan(a * Math.PI / 180), th = 6 * s;
      const Hf = (0.6 * P.h + 14) * s, zc = Hf * 0.58;
      const legX = (z) => 26 * s - (22 * s) * (z + 2) / (Hf + 2), cx = legX(zc) + 2 * s;
      const frameSec = csUnion([bar(-26 * s, -2, -4 * s, Hf, 7 * s), bar(26 * s, -2, 4 * s, Hf, 7 * s),
        rect(-cx, zc - 2.5 * s, cx, zc + 2.5 * s), roundedRect(-8 * s, Hf - 6 * s, 8 * s, Hf + 3 * s, 3 * s)]);
      const ground = box(-300, 300, -300, 300, -50, 0);
      const frame = rotate(xz(frameSec, 0, th), -a, 0, 0);
      const zl = 18 * s, yb = zl * ta, yf = yb - 10 * s;
      const lw = Math.min(P.w / 2 - 6, 32 * s);
      const ledge = yz([[yf, zl + 3.5 * s], [yf, zl - 1], [yb, zl - 1 - (yb - yf)], [yb + 1.5, zl - 1 - (yb - yf)],
        [yb + 1.5, zl], [yf + 2.2, zl], [yf + 2.2, zl + 3.5 * s]], -lw, lw);
      const zt = Hf - 2 * s, yt = zt * ta + th * 0.5, Ry = 0.55 * Hf;
      const leg = yz(bar(yt, zt, Ry + 2 * ta, -2, 6 * s), -3 * s, 3 * s);
      const xFoot = legX(0);
      const pads = [xy(circle(-xFoot, th / 2, 6 * s, 40), 0, 1.2), xy(circle(xFoot, th / 2, 6 * s, 40), 0, 1.2),
        xy(circle(0, Ry, 6 * s, 40), 0, 1.2)];
      return {
        parts: [{ m: sub(union([frame, ledge, leg, ...pads]), ground), role: 'base' }],
        photos: [{ x: 0, y: yb - 0.6, z: zl, rx: -a }],
      };
    },
  },
];

// Coleções: os suportes de foto ficam em "Polaroid"; as outras vêm de arquivos próprios.
export const COLLECTIONS = [
  { key: 'polaroid', label: '📷 Polaroid' },
  { key: 'halloween', label: '🎃 Halloween' },
  { key: 'natal', label: '🎄 Natal', soon: true },
];
export const MODELS = [...POLAROID.map((m) => ({ col: 'polaroid', ...m })), ...HALLOWEEN];
