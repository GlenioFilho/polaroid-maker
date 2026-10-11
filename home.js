// Coleção Home: decoração para o ano todo, vendida na loja da Europa (textos em inglês).
// Mesmas convenções de models.js: mm, Z para cima, frente olha para -Y.
import { csMove, csScale, csOffset, csBounds, textSection, wordSection, xz, sub } from './geo.js';

export const HOME = [
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
