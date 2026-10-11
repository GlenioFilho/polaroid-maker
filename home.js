// Coleção Home: decoração para o ano todo, vendida na loja da Europa (textos em inglês).
// Mesmas convenções de models.js: mm, Z para cima, frente olha para -Y.
import { csMove, csScale, csOffset, csBounds, textSection, wordSection, xz, box, sub, intersect, revolve, levelSet } from './geo.js';

// ---- Formas suaves (funções de distância, positivas dentro) --------------------------
const ellip = (p, c, r) => {
  const k = Math.hypot((p[0] - c[0]) / r[0], (p[1] - c[1]) / r[1], (p[2] - c[2]) / r[2]);
  return (1 - k) * Math.min(r[0], r[1], r[2]);
};
function capsule(p, a, b, r) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  const t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / (ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2)));
  return r - Math.hypot(ap[0] - t * ab[0], ap[1] - t * ab[1], ap[2] - t * ab[2]);
}
/** União suave (raio k). */
const smax = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.max(a, b) + h * h * k / 4; };
/** Recorte suave: tira b de a. */
const scut = (a, b, k) => -smax(-a, b, k);

/** Torso feminino estilizado (mm, altura 185, base em z = 0, frente para -Y). */
function bodySdf(p, curvy) {
  const c = curvy;
  let d = capsule(p, [-15, 1, -5], [-19 * c, 2, 40], 19 * c);
  d = smax(d, capsule(p, [15, 1, -5], [19 * c, 2, 40], 19 * c), 10);
  d = smax(d, ellip(p, [0, 3, 52], [39 * c, 31, 30]), 14);
  d = smax(d, ellip(p, [0, -6, 70], [26, 25 * c, 22]), 12);
  d = smax(d, ellip(p, [0, 0, 96], [27, 21, 26]), 14);
  d = smax(d, ellip(p, [0, 1, 123], [33, 23, 25]), 14);
  d = smax(d, ellip(p, [-14, -15, 119], [14 * c, 13 * c, 13.5 * c]), 5);
  d = smax(d, ellip(p, [14, -15, 119], [14 * c, 13 * c, 13.5 * c]), 5);
  d = smax(d, ellip(p, [0, 2, 146], [31, 20, 17]), 14);
  d = smax(d, capsule(p, [0, 1, 140], [0, 1, 230], 11.5), 12);
  d = scut(d, capsule(p, [0, -11, -5], [0, -21, 27], 2.8), 5);   // risquinho entre as pernas (só na frente)
  d = scut(d, ellip(p, [0, -30.5, 75], [2, 2.2, 3.4]), 1.5);       // umbigo
  return d;
}


export const HOME = [
  {
    col: 'home', noPhoto: true, key: 'body-vase', name: 'Female Body Vase', emoji: '🏺',
    desc: 'Sculptural female torso vase with soft curves, for dried flowers and pampas grass.',
    roles: [{ id: 'vase', label: 'Vase', color: '#e8dcc4' }],
    text: false,
    opts: [
      { id: 'mode', label: 'Model', choices: [['vase', 'For spiral vase mode'], ['hollow', 'Hollow (2.4 mm wall)']], def: 'vase' },
      { id: 'curvy', label: 'Curves', min: 85, max: 115, step: 5, def: 100, unit: '%' },
    ],
    printHint: '<b>For spiral vase mode</b>: in Bambu Studio turn on <i>Others → Spiral vase</i> and use a 0.6–0.8 mm line width; it prints as one wall with an open top. '
      + '<b>Hollow</b>: print normally, 3 walls, no supports. For dried flowers only (not watertight).',
    build({ s, o }) {
      const c = o.curvy / 100, top = 185, floor = 3, w = 2.4, edge = 1;
      const lo = [-55 * s, -48 * s, -6 * s], hi = [55 * s, 42 * s, (top + 6) * s];
      const solid = (inset) => levelSet((q) => (bodySdf([q[0] / s, q[1] / s, q[2] / s], c) - inset) * s, lo, hi, edge);
      // cortes retos (base e boca) com booleana: ficam lisos, sem o serrilhado da grade
      let m = intersect(solid(0), box(-60 * s, 60 * s, -50 * s, 50 * s, 0, top * s));
      if (o.mode === 'hollow') {
        // teto interno dos ombros limitado a 45° até a boca (imprime sem suporte por dentro)
        const rn = (11.5 - w) * s, zn = 158 * s, R = rn + zn + 20;
        const cone = revolve([[0, -10], [R, -10], [rn, zn], [rn, top * s + 10], [-rn, top * s + 10], [-rn, zn], [-R, -10]], 96);
        m = sub(m, intersect(intersect(solid(w), box(-60 * s, 60 * s, -50 * s, 50 * s, floor * s, top * s + 5)), cone));
      }
      return { parts: [{ m, role: 'vase' }], photos: [] };
    },
  },
  {
    col: 'home', noPhoto: true, key: 'word-block', name: 'Word Block Sign', emoji: '🙏',
    desc: 'Chunky block-letter word with a script phrase across the front, like "PRAY and trust". Line 1 = big word, line 2 = script phrase.',
    roles: [{ id: 'block', label: 'Block letters', color: '#f4f4f0' }, { id: 'script', label: 'Script phrase', color: '#1c1c1e' }],
    text: true, textShape: true, defFont: 'pacifico', blockFont: 'archivo', defText: ['PRAY', 'and trust'],
    opts: [
      { id: 'height', label: 'Letter height', min: 40, max: 100, step: 5, def: 60, unit: ' mm' },
      { id: 'depth', label: 'Depth', min: 12, max: 35, step: 1, def: 22, unit: ' mm' },
    ],
    printHint: 'Print <b>lying on its back</b> (script side up). Where the script crosses a gap between letters, use <b>tree supports on build plate only</b>.',
    build({ s, o, font, blockFont, lines }) {
      if (!font || !blockFont) throw new Error('font not loaded');
      const H = o.height * s, D = o.depth * s, R = 2.4;   // R = relevo da frase
      const word = (lines.length > 1 ? lines[0] : lines[0] || 'PRAY').toUpperCase();
      let block = wordSection(blockFont, word, H, 0.04);
      let bb = csBounds(block), W = bb.max[0] - bb.min[0];
      const maxW = 240 * s;   // cabe na mesa de 256 mm
      if (W > maxW) { block = csScale(block, maxW / W); bb = csBounds(block); W = maxW; }
      const Hb = bb.max[1] - bb.min[1];
      // frase cursiva atravessando a frente, um pouco abaixo do meio e puxada para a direita
      const phrase = lines.length > 1 ? lines[1] : '';
      const blockM = xz(block, 0, D);
      if (!phrase) return { parts: [{ m: blockM, role: 'block' }], photos: [] };
      let sc = csOffset(textSection(font, [phrase], W * 0.72, Hb * 0.4), 0.9);
      const sb = csBounds(sc);
      sc = csMove(sc, W * 0.6 - (sb.min[0] + sb.max[0]) / 2, Hb * 0.4 - (sb.min[1] + sb.max[1]) / 2);
      // frase só na superfície da frente (encaixa 0,4 mm na palavra para as cores grudarem)
      const scriptM = xz(sc, -R, 0.4);
      const parts = [{ m: sub(blockM, scriptM), role: 'block' }, { m: scriptM, role: 'script' }];
      return { parts, photos: [] };
    },
  },
];
