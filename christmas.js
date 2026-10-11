// Coleção Natal (Christmas): peças para vender na loja da Europa, por isso nomes, descrições,
// opções e dicas ficam em inglês.
// Mesmas convenções de models.js: mm, Z para cima, frente olha para -Y.
// Peças planas (enfeites, flocos) são desenhadas deitadas: o desenho fica em (x, y) e a frente é o topo (+Z).
import {
  cs, csUnion, csSub, csMove, csScale, csRotate, csIntersect, csOffset, rect, circle, ellipse, roundedRect,
  csBounds, textSection, xz, xy, box, union, sub, move, rotate, intersect, revolve, warp, twist,
} from './geo.js';

const W_LAMP = 2.4;   // parede da luminária (mm)
const R_OPEN = 24;    // abertura de baixo (vela LED de 38–40 mm)

/** Espelha o lado direito de um perfil (x >= 0) e fecha a silhueta inteira. */
function mirrorSil(right, top) {
  return [[0, 0], ...right, [0, top], ...right.slice().reverse().map(([x, z]) => [-x, z])];
}

/** Casca oca girada: parede W_LAMP, piso em anel, abertura embaixo, teto interno em cone de 45°. */
function lampShell(sil, zc, segs = 144) {
  const cone = [[0, zc], [-600, zc - 600], [600, zc - 600]];
  const inner = csUnion([csIntersect(csOffset(sil, -W_LAMP), cone), rect(-R_OPEN, -1, R_OPEN, W_LAMP + 1)]);
  return revolve(csSub(sil, inner), segs);
}

/** Barra de largura w entre dois pontos. */
function bar(x0, y0, x1, y1, w) {
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy), nx = -dy / l * w / 2, ny = dx / l * w / 2;
  return [[x0 + nx, y0 + ny], [x0 - nx, y0 - ny], [x1 - nx, y1 - ny], [x1 + nx, y1 + ny]];
}

/** Estrela de n pontas, raio externo R e interno r, com uma ponta para cima. */
function starPts(n, R, r, cx = 0, cy = 0) {
  const p = [];
  for (let i = 0; i < 2 * n; i++) {
    const a = Math.PI / 2 + Math.PI * i / n, k = i % 2 ? r : R;
    p.push([cx + k * Math.cos(a), cy + k * Math.sin(a)]);
  }
  return p;
}

/** Coração com a ponta para baixo, largura ~2 (unidades), centro (0, 0). */
function heartPts(n = 120) {
  const p = [];
  for (let i = 0; i < n; i++) {
    const t = 2 * Math.PI * i / n;
    p.push([16 * Math.sin(t) ** 3 / 16, (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16]);
  }
  return p;
}

/** Pinheiro em três andares (unidades: altura ~2, centro 0, 0), com tronco. */
function treePts() {
  const r = [[0, 1], [0.42, 0.38], [0.24, 0.4], [0.62, -0.2], [0.4, -0.18], [0.82, -0.78], [0.16, -0.78], [0.16, -1]];
  return [...r, ...r.slice(1).reverse().map(([x, y]) => [-x, y])];
}

/** Folha de azevinho (unidades: comprimento 2 ao longo de x), bordas com pontas. */
function hollyLeaf(n = 120) {
  const p = [];
  for (let i = 0; i < n; i++) {
    const a = 2 * Math.PI * i / n, spike = 1 + 0.22 * Math.max(0, Math.cos(10 * a)) ** 6;
    p.push([Math.cos(a), 0.42 * Math.sin(a) * spike]);
  }
  return p;
}

/** Furo em gota (eixo em Y, peça em pé): imprime sem suporte. */
const teardrop = (cx, cz, r) => csUnion([circle(cx, cz, r, 40), [[cx - r * 0.7071, cz + r * 0.7071], [cx + r * 0.7071, cz + r * 0.7071], [cx, cz + r * 1.4142]]]);

/** Gerador simples com semente (cada número gera sempre o mesmo floco). */
function rng(seed) {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Floco de neve de 6 braços, raio R, traço w; argola no braço de cima. */
function snowflake(seed, R, w) {
  const rand = rng(seed), arm = [bar(0, 0, 0, R, w)];
  const nb = 2 + Math.floor(rand() * 2), used = [];
  for (let i = 0; i < nb; i++) {
    let t = 0.28 + rand() * 0.52;
    if (used.some((u) => Math.abs(u - t) < 0.16)) t = used[used.length - 1] + 0.18;
    if (t > 0.85) continue;
    used.push(t);
    const L = R * (0.22 + rand() * 0.22) * (1.2 - t), y = t * R, ang = (rand() < 0.75 ? 60 : 45) * Math.PI / 180;
    arm.push(bar(0, y, L * Math.sin(ang), y + L * Math.cos(ang), w * 0.9), bar(0, y, -L * Math.sin(ang), y + L * Math.cos(ang), w * 0.9));
  }
  const tip = Math.floor(rand() * 3);
  if (tip === 0) arm.push([[0, R - 2.2 * w], [1.6 * w, R], [0, R + 1.6 * w], [-1.6 * w, R]]);
  else if (tip === 1) arm.push(circle(0, R, 1.3 * w, 32));
  const core = rand() < 0.5
    ? csSub(circle(0, 0, R * 0.24, 6), circle(0, 0, R * 0.24 - 1.1 * w, 6))
    : circle(0, 0, R * (0.1 + rand() * 0.08), 6);
  const one = csUnion(arm), all = [core];
  for (let k = 0; k < 6; k++) all.push(csRotate(one, 60 * k));
  const ring = csSub(circle(0, R + 4, 4.2, 40), circle(0, R + 4, 2.2, 40));
  return csUnion([...all, ring, bar(0, R - 1, 0, R + 2, w)]);
}

/** Junta pedaços soltos (pingo do i, letra que não encostou) com uma hastezinha para baixo. */
function connectPieces(sec, w) {
  for (let round = 1; round <= 4; round++) {
    const pieces = sec.decompose();
    if (pieces.length <= 1) { pieces.forEach((p) => p.delete()); break; }
    let main = pieces[0];
    for (const p of pieces) if (p.area() > main.area()) main = p;
    const bars = [];
    for (const p of pieces) {
      if (p === main) continue;
      const b = p.bounds(), cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[1] + b.max[1]) / 2;
      bars.push(rect(cx - w / 2, b.min[1] - 10 * round, cx + w / 2, cz));
    }
    pieces.forEach((p) => p.delete());
    sec = csUnion([sec, ...bars]);
  }
  return sec;
}

const FLAT = 'Print <b>lying flat</b>, exactly as shown. No supports needed. Thread a ribbon through the loop.';

export const CHRISTMAS = [
  {
    col: 'natal', noPhoto: true, key: 'bauble', name: 'Personalised Bauble', emoji: '🎄',
    desc: 'Flat Christmas tree ornament with a raised rim and a name or year on the front.',
    roles: [{ id: 'ball', label: 'Ornament', color: '#d23c3c' }, { id: 'cap', label: 'Cap & rim', color: '#c9a54a' }],
    text: true, textColor: '#f4f4f0', defText: ['Emma', '2026'],
    opts: [{ id: 'shape', label: 'Shape', choices: [['round', 'Round'], ['star', 'Star'], ['heart', 'Heart'], ['tree', 'Tree']], def: 'round' }],
    printHint: FLAT,
    build({ s, o }) {
      const R = 38 * s, T = 4, rim = 2.6 * s;
      let sec, top, tb;
      if (o.shape === 'star') {
        sec = cs(starPts(5, R * 1.18, R * 0.62)); top = R * 1.18;
        tb = { cx: 0, cy: -R * 0.04, w: R * 0.9, h: R * 0.62 };
      } else if (o.shape === 'heart') {
        sec = csMove(csScale(cs(heartPts()), R * 1.1), 0, R * 0.08); top = R * 0.08 + R * 1.1 * 0.31 + 4 * s;
        tb = { cx: 0, cy: R * 0.02, w: R * 1.15, h: R * 0.8 };
      } else if (o.shape === 'tree') {
        sec = csScale(cs(treePts()), R * 1.15); top = R * 1.15;
        tb = { cx: 0, cy: -R * 0.55, w: R * 1.15, h: R * 0.36 };
      } else {
        sec = cs(circle(0, 0, R, 128)); top = R;
        tb = { cx: 0, cy: 0, w: R * 1.45, h: R * 0.95 };
      }
      const capSec = o.shape === 'round'
        ? csUnion([roundedRect(-8 * s, top - 4 * s, 8 * s, top + 5 * s, 1.5 * s), circle(0, top + 9 * s, 5 * s, 48)])
        : circle(0, top + 3.2 * s, 5 * s, 48);
      const cap = csSub(capSec, circle(0, top + (o.shape === 'round' ? 9 : 3.2) * s, 2.4 * s, 40));
      const ball = xy(csSub(sec, capSec), 0, T);
      const ring = xy(csSub(csSub(sec, csOffset(sec, -rim)), capSec), T, T + 1);
      return {
        parts: [{ m: ball, role: 'ball' }, { m: union([xy(cap, 0, T + 1), ring]), role: 'cap' }],
        photos: [],
        textBox: { face: 'top', z: T, ...tb },
      };
    },
  },
  {
    col: 'natal', key: 'photo-ornament', name: 'Polaroid Photo Ornament', emoji: '📸',
    desc: 'Hanging photo frame for the tree. The instant photo slides in from the side; holly on the corner and a name or year at the bottom. Best with Instax Mini.',
    roles: [
      { id: 'frame', label: 'Frame', color: '#f4f4f0' },
      { id: 'leaves', label: 'Holly leaves', color: '#2e7d4f' },
      { id: 'berries', label: 'Berries', color: '#d23c3c' },
    ],
    text: true, textColor: '#d23c3c', defText: ['Christmas 2026'],
    printHint: 'Print <b>standing up</b>, exactly as shown. No supports needed. Slide the photo in from the right side.',
    build({ P, gap, s }) {
      const m = 5 * s, wall = 1.8, T = 2 * wall + gap;
      const x0 = -P.w / 2 - m, x1 = P.w / 2 + m, z1 = P.h + 2 * m;
      const outline = roundedRect(x0, 0, x1, z1, 6 * s);
      const tabZ = z1 + 3.5 * s;
      const tab = circle(0, tabZ, 6.5 * s, 48);
      const sil = csSub(csUnion([outline, tab]), teardrop(0, tabZ, 2.6 * s));
      const zb = m;   // fundo da foto
      const win = roundedRect(-P.imgW / 2 + 1, zb + P.h - P.imgTop - P.imgH + 1, P.imgW / 2 - 1, zb + P.h - P.imgTop - 1, 1.5);
      const pocket = box(-P.w / 2 - 0.4, x1 + 5, wall, wall + gap, zb - 0.4, zb + P.h + 0.4);
      const frame = sub(sub(xz(sil, 0, T), pocket), xz(win, -1, wall + 0.01));
      // azevinho no canto de cima, à esquerda (relevo de 1,2 mm na frente)
      const L = 9 * s, cxh = x0 + 9 * s, czh = z1 - 9 * s;
      const leafA = csMove(csRotate(csScale(cs(hollyLeaf()), L), 30), cxh + L * 0.8, czh - L * 0.25);
      const leafB = csMove(csRotate(csScale(cs(hollyLeaf()), L), -60), cxh + L * 0.1, czh - L * 0.95);
      const berries = csIntersect(csUnion([circle(cxh - 1.6 * s, czh + 0.8 * s, 2.3 * s, 32), circle(cxh + 2.4 * s, czh + 1.6 * s, 2.3 * s, 32),
        circle(cxh + 0.4 * s, czh - 2.4 * s, 2.3 * s, 32)]), outline);
      const leaves = csSub(csIntersect(csUnion([leafA, leafB]), outline), csOffset(berries, 0.01));
      const strip = P.h - P.imgTop - P.imgH;
      return {
        parts: [{ m: frame, role: 'frame' }, { m: xz(leaves, -1.2, 0), role: 'leaves' }, { m: xz(berries, -1.6, 0), role: 'berries' }],
        photos: [{ x: 0, y: wall + gap / 2, z: zb }],
        textBox: { face: 'front', y: 0, cx: 0, cz: zb + strip / 2, w: P.w - 6 * s, h: Math.min(strip - 5, 11 * s) },
      };
    },
  },
  {
    col: 'natal', noPhoto: true, key: 'snowflakes', name: 'Snowflake Ornaments', emoji: '❄️',
    desc: 'Set of unique snowflakes with a hanging loop. Every design number makes a different set.',
    roles: [{ id: 'flake', label: 'Snowflakes', color: '#f4f4f0' }],
    text: false,
    opts: [
      { id: 'seed', label: 'Design #', min: 1, max: 99, step: 1, def: 7, unit: '' },
      { id: 'n', label: 'How many', min: 1, max: 6, step: 1, def: 6, unit: '' },
      { id: 'size', label: 'Size', min: 50, max: 110, step: 5, def: 75, unit: ' mm' },
    ],
    printHint: FLAT + ' White, silver or glitter filament looks great.',
    build({ s, o }) {
      const R = o.size / 2 * s, w = Math.max(2.4, 2.8 * s), parts = [], g = 5;
      const per = Math.max(1, Math.floor((240 + g) / (2 * R + g)));
      for (let i = 0; i < o.n; i++) {
        const cx = (i % per) * (2 * R + g), cy = -Math.floor(i / per) * (2 * R + 8 + g);
        parts.push(xy(csMove(snowflake(o.seed * 31 + i, R, w), cx, cy), 0, 3));
      }
      return { parts: [{ m: union(parts), role: 'flake' }], photos: [] };
    },
  },
  {
    col: 'natal', noPhoto: true, key: 'tree-lamp', name: 'Christmas Tree Lamp', emoji: '🌲',
    desc: 'Hollow layered Christmas tree with star cut-outs and a star on top. Place it over an LED tea light and it glows.',
    roles: [{ id: 'tree', label: 'Tree', color: '#2e7d4f' }, { id: 'star', label: 'Star', color: '#f5d33f' }],
    text: false,
    opts: [
      { id: 'tiers', label: 'Tiers', min: 3, max: 5, step: 1, def: 4, unit: '' },
      { id: 'holes', label: 'Light holes', choices: [['stars', 'Stars'], ['dots', 'Dots'], ['none', 'None']], def: 'stars' },
    ],
    printHint: 'Print <b>standing up</b>, exactly as shown. No supports needed (45° overhangs). Wall 2.4 mm: use 3 perimeters. '
      + 'Place it over an <b>LED tea light</b>. <b>Never use a real candle</b>: the plastic melts.',
    build({ s, o }) {
      const N = o.tiers, R0 = 48 * s, H = 140 * s, tierH = (H - 18 * s) / N;
      // perfil base -> topo; cada andar começa mais largo que o topo do anterior (degrau a 45° para fora)
      const prof = [];
      let z = 0, b = R0;
      for (let i = 0; i < N; i++) {
        const last = i === N - 1, t = last ? 8 * s : b * 0.56, h = last ? tierH * 1.15 : tierH;
        prof.push([b, z], [t, z + h]);
        z += h;
        if (!last) { const nb = b * 0.8; z += nb - t; b = nb; }
      }
      const top = z;
      let tree = lampShell(mirrorSil(prof, top), top - 12 * s, 160);
      if (o.holes !== 'none') {
        const cuts = [];
        let zz = 0, bb = R0;
        for (let i = 0; i < N; i++) {
          const last = i === N - 1, t = last ? 8 * s : bb * 0.56, h = last ? tierH * 1.15 : tierH;
          const zc = zz + h * 0.42, rc = bb + (t - bb) * 0.42, n = Math.max(3, Math.round(rc * 2 * Math.PI / (22 * s)));
          if (rc > 12 * s) {
            const hole = o.holes === 'stars' ? starPts(5, 5 * s, 2.3 * s, 0, zc) : circle(0, zc, 3.2 * s, 24);
            const prism = xz(hole, -rc - 20, -rc * 0.4);
            for (let k = 0; k < n; k++) cuts.push(rotate(prism, 0, 0, 360 * (k + (i % 2) * 0.5) / n));
          }
          zz += h;
          if (!last) { const nb = bb * 0.8; zz += nb - t; bb = nb; }
        }
        tree = sub(tree, union(cuts));
      }
      // estrela em pé no topo; o vão entre as duas pontas de baixo é preenchido para não imprimir no ar
      const rs = 14 * s, a = -54 * Math.PI / 180, zs = top - 0.6 - rs * Math.sin(a);
      const tipX = rs * Math.cos(a), tipZ = zs + rs * Math.sin(a);
      const starSec = csUnion([starPts(5, rs, 0.43 * rs, 0, zs), [[-tipX, tipZ], [tipX, tipZ], [0, zs]]]);
      const star = xz(starSec, -3 * s, 3 * s);
      return { parts: [{ m: sub(tree, star), role: 'tree' }, { m: star, role: 'star' }], photos: [] };
    },
  },
  {
    col: 'natal', noPhoto: true, key: 'gnome', name: 'Nordic Gnome', emoji: '🎅',
    desc: 'Scandinavian Christmas gnome (tomte) with a floppy hat, fluffy beard and round nose. Four colours.',
    roles: [
      { id: 'hat', label: 'Hat', color: '#d23c3c' },
      { id: 'beard', label: 'Beard', color: '#f4f4f0' },
      { id: 'nose', label: 'Nose', color: '#f19bb4' },
      { id: 'body', label: 'Body', color: '#7d8a99' },
    ],
    text: false,
    opts: [
      { id: 'alt', label: 'Hat height', min: 70, max: 140, step: 5, def: 100, unit: '%' },
      { id: 'bend', label: 'Hat droop', min: 0, max: 100, step: 10, def: 60, unit: '%' },
    ],
    printHint: 'Print <b>standing up</b>, exactly as shown. No supports needed. 4 colours: hat, beard, nose and body.',
    build({ s, o }) {
      const Rb = 24 * s, zh = 27 * s, Hh = 85 * s * o.alt / 100, Rh = 27 * s;
      const body = revolve(mirrorSil([[Rb - 3 * s, 0], [Rb, 3 * s], [Rb, zh + 6 * s]], zh + 6 * s), 128);
      // gorro: cone um pouco abaulado + aba enrolada, ponta caída para a frente
      const hr = [];
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        hr.push([Math.max(1.5 * s, Rh * (1 - t) ** 0.8), zh + Hh * t]);
      }
      let hat = union([revolve(mirrorSil([[Rh, zh], ...hr], zh + Hh), 128),
        revolve(csUnion([circle(Rh - 1 * s, zh + 3.5 * s, 3.5 * s, 32), circle(-(Rh - 1 * s), zh + 3.5 * s, 3.5 * s, 32)]), 128)]);
      hat = sub(hat, revolve(rect(-Rh - 10, zh - 50, Rh + 10, zh), 64));
      const droop = o.bend / 100 * Hh * 0.35;
      hat = warp(hat, (v) => {
        const t = (v[2] - zh) / Hh;
        if (t > 0.35) { const u = (t - 0.35) / 0.65; v[1] -= droop * u * u; v[2] -= droop * 0.5 * u * u * u; }
      });
      // barba: cobre a frente e os lados; borda de baixo em V até a mesa, com ondinhas
      const Wb = Rb + 6 * s, bp = [];
      for (let i = 0; i <= 80; i++) {
        const u = -1 + 2 * i / 80;
        bp.push([Wb * u, 20 * s * Math.abs(u) ** 1.3 + 1.6 * s * Math.abs(Math.sin(3.5 * Math.PI * u)) * Math.abs(u)]);
      }
      bp.push([Wb, zh + 4 * s], [-Wb, zh + 4 * s]);
      const beardBlank = xz(bp, -Rb - 10, 4 * s);
      // casca da barba: mais grossa em cima (4,5 mm), fina embaixo (sem beirada no ar)
      const bs = [];
      for (let i = 0; i <= 20; i++) { const z = (zh + 4 * s) * i / 20; bs.push([Rb + 0.8 * s + 3.7 * s * (z / zh) ** 0.7, z]); }
      let beard = intersect(beardBlank, revolve(mirrorSil(bs, zh + 4 * s), 128));
      beard = warp(beard, (v) => {
        const r = Math.hypot(v[0], v[1]);
        if (r > Rb + 0.5) {   // mechas + barriga da barba para a frente
          const f = Math.max(0, -v[1] / r) ** 2, zz = Math.min(1, Math.max(0, v[2] / (zh + 4 * s)));
          const k = 1 + 0.025 * Math.cos(16 * Math.atan2(v[1], v[0])) + 0.16 * f * Math.sin(Math.PI * zz) ** 0.8;
          v[0] *= k; v[1] *= k;
        }
      });
      // nariz: gota com a ponta para baixo (cone de 45° por baixo: imprime sem suporte), meio escondido sob a aba
      const rn = 9.5 * s;
      const noseSec = csUnion([circle(0, 0, rn, 48), [[-rn * 0.7071, -rn * 0.7071], [rn * 0.7071, -rn * 0.7071], [0, -rn * 1.4142]]]);
      const nose = move(revolve(noseSec, 64), 0, -Rb - 3 * s, zh - 1 * s);
      hat = sub(hat, nose);
      beard = sub(sub(beard, nose), hat);
      return {
        parts: [
          { m: hat, role: 'hat' }, { m: beard, role: 'beard' }, { m: nose, role: 'nose' },
          { m: sub(body, union([hat, beard, nose])), role: 'body' },
        ],
        photos: [],
      };
    },
  },
  {
    col: 'natal', noPhoto: true, key: 'star-topper', name: 'Star Tree Topper', emoji: '⭐',
    desc: 'Faceted 3D star for the top of the tree, with a hollow sleeve that slides over the tip.',
    roles: [{ id: 'star', label: 'Star', color: '#c9a54a' }],
    text: false,
    opts: [
      { id: 'points', label: 'Points', choices: [[5, '5'], [6, '6'], [8, '8']], def: 5 },
      { id: 'size', label: 'Star width', min: 90, max: 160, step: 10, def: 120, unit: ' mm' },
    ],
    printHint: 'Print <b>standing up</b>, on the sleeve, with a <b>brim</b>. Use tree supports touching the build plate only, for the lower arms. '
      + 'Gold or silk filament looks best.',
    build({ s, o }) {
      const n = +o.points, R = o.size / 2 * s, r = R * (n === 5 ? 0.46 : n === 6 ? 0.55 : 0.62);
      const D = R * 0.24, slab = 3, sp = starPts(n, R, r);
      const half = move(twist(sp, 0, D, 0, 0, 1), 0, 0, slab / 2);
      let star = union([half, rotate(half, 0, 180, 0), move(xy(sp, 0, slab), 0, 0, -slab / 2)]);
      const Ls = 55 * s, zc = Ls + r * 0.6;
      star = move(rotate(star, 90, 0, 0), 0, 0, zc);
      // luva: cone oco aberto embaixo, teto em ponta (sem ponte)
      const ro0 = 16 * s, ro1 = 12 * s, ri0 = 12 * s, ri1 = 7.5 * s;
      const outer = revolve(mirrorSil([[ro0, 0], [ro1, Ls + r * 0.4]], Ls + r * 0.4), 96);
      const inner = revolve([[0, -1], [ri0, -1], [ri1, Ls - 6], [0, Ls - 6 + ri1], [-ri1, Ls - 6], [-ri0, -1]], 96);
      return { parts: [{ m: sub(union([star, outer]), inner), role: 'star' }], photos: [] };
    },
  },
  {
    col: 'natal', noPhoto: true, key: 'sign', name: 'Merry Christmas Sign', emoji: '✨',
    desc: 'Freestanding script-lettering sign with a Christmas tree, a star and a bauble. Write any two lines.',
    roles: [
      { id: 'letters', label: 'Letters & base', color: '#d23c3c' },
      { id: 'deco', label: 'Tree, star & bauble', color: '#d23c3c' },
    ],
    text: true, textShape: true, defFont: 'lobster', defText: ['Merry', 'Christmas'],
    opts: [{ id: 'thick', label: 'Thickness', min: 6, max: 15, step: 1, def: 10, unit: ' mm' }],
    printHint: 'Print <b>standing up</b>, exactly as shown. No supports needed. For a single colour, pick the same colour for both parts.',
    build({ s, o, font, lines }) {
      if (!font) throw new Error('font not loaded');
      const T = o.thick, h = 32 * s, base = 8 * s, gap = 0.6;
      const one = lines.length < 2;
      const fat = (sec) => csOffset(sec, 0.5);   // traço mais grosso: script fino imprime mal
      const maxW = 178 * s;   // cabe na mesa de 256 mm com a árvore e a bola
      let L2 = fat(textSection(font, [one ? lines[0] : lines[1]], maxW, h));
      let b2 = csBounds(L2);
      const tw = 34 * s, x2 = tw + 2 * s;   // árvore à esquerda da 2ª linha
      L2 = csMove(L2, x2 - b2.min[0], base - 1.2 * s - b2.min[1]);
      b2 = csBounds(L2);
      let letters = [L2];
      let top = b2.max[1], right1 = b2.max[0], z1 = b2.max[1];
      if (!one) {
        let L1 = fat(textSection(font, [lines[0]], maxW, h));
        const b1 = csBounds(L1);
        L1 = csMove(L1, tw * 0.55 - b1.min[0], b2.max[1] - 0.36 * h - b1.min[1]);
        const nb = csBounds(L1);
        letters.push(L1);
        top = nb.max[1]; right1 = nb.max[0]; z1 = (nb.min[1] + nb.max[1]) / 2;
      }
      // decoração: árvore (esquerda), estrela vazada (depois da 1ª linha), bola pendurada (direita)
      const th = Math.min(top - base, b2.max[1] - base + 10 * s);
      const tree = csMove(csScale(cs(treePts()), [tw / 1.64, th / 2]), tw / 2, base - 0.8 + th / 2);
      const rb = 11 * s, bx = b2.max[0] + rb + 1 * s, bz = base + rb - 1;
      const rs = 14 * s, sx = bx, sz = Math.max(one ? top + rs * 0.6 : z1 + rs * 0.2, bz + rb + 3 * s + rs);
      const starO = starPts(5, rs, rs * 0.45, sx, sz);
      const star = csSub(starO, csOffset(starPts(5, rs, rs * 0.45, sx, sz), -2.6 * s));
      const ball = csSub(csUnion([circle(bx, bz, rb, 64), roundedRect(bx - 4 * s, bz + rb - 2 * s, bx + 4 * s, bz + rb + 3 * s, 1)]),
        csUnion([rect(bx - rb * 0.72, bz + 0.6 * s, bx + rb * 0.72, bz + 2.6 * s), rect(bx - rb * 0.72, bz - 3.4 * s, bx + rb * 0.72, bz - 1.4 * s)]));
      const string = rect(bx - 1.1 * s, bz + rb + 2 * s, bx + 1.1 * s, sz - rs * 0.4);
      const x0 = 0, x1 = bx + rb;
      // base com triângulos vazados
      const notches = [];
      for (let x = x0 + 8 * s; x < x1 - 6 * s; x += 9 * s) notches.push([[x - 2.2 * s, 2.2 * s], [x + 2.2 * s, 2.2 * s], [x, 5.8 * s]]);
      const strip = csSub(roundedRect(x0 - 2 * s, 0, x1 + 2 * s, base, 1.5), csUnion(notches));
      const deco = csUnion([tree, star, ball]);
      let sec = csUnion([...letters, strip, string, deco]);
      sec = connectPieces(sec, 2.2 * s);
      const decoM = xz(csOffset(deco, -0.01), 0, T);
      const all = xz(sec, 0, T);
      return { parts: [{ m: sub(all, decoM), role: 'letters' }, { m: decoM, role: 'deco' }], photos: [] };
    },
  },
];
