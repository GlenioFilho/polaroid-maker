// Fotos em formato Polaroid/Instax para imprimir em A4 (papel fotográfico) e cortar.
// Tudo acontece no navegador: as fotos do cliente não saem do computador/celular.

// ---- Formatos (mm). imgTop = borda de cima; a borda de baixo é o que sobra. -----------
const FORMATS = {
  polaroid: { label: 'Polaroid 600 / i-Type (88 × 107 mm)', w: 88, h: 107, imgW: 79, imgH: 79, imgTop: 6 },
  go: { label: 'Polaroid Go (54 × 67 mm)', w: 53.9, h: 66.6, imgW: 47, imgH: 46, imgTop: 4 },
  mini: { label: 'Instax Mini (54 × 86 mm)', w: 54, h: 86, imgW: 46, imgH: 62, imgTop: 7 },
  square: { label: 'Instax Square (72 × 86 mm)', w: 72, h: 86, imgW: 62, imgH: 62, imgTop: 7 },
  wide: { label: 'Instax Wide (108 × 86 mm)', w: 108, h: 86, imgW: 99, imgH: 62, imgTop: 7 },
};
const FS = 'https://cdn.jsdelivr.net/npm/@fontsource/';
const FONTS = {
  caveat: { label: 'Caveat', url: FS + 'caveat@5/files/caveat-latin-600-normal.woff' },
  indie: { label: 'Indie Flower', url: FS + 'indie-flower@5/files/indie-flower-latin-400-normal.woff' },
  marker: { label: 'Marker', url: FS + 'permanent-marker@5/files/permanent-marker-latin-400-normal.woff' },
  pacifico: { label: 'Pacifico', url: FS + 'pacifico@5/files/pacifico-latin-400-normal.woff' },
  fredoka: { label: 'Fredoka', url: FS + 'fredoka@5/files/fredoka-latin-600-normal.woff' },
};
const CAP_COLORS = [['Preto', '#1c1c1e'], ['Cinza', '#5d6168'], ['Azul', '#2f4f8f'], ['Vermelho', '#b8322a'], ['Marrom', '#7a4a2c'], ['Rosa', '#d4567f']];
const FILTER_HINT = {
  none: 'Cores da foto original.',
  vintage: 'Tons quentes e pretos um pouco lavados, como foto instantânea antiga.',
  pb: 'Preto e branco com um pouco mais de contraste.',
};
const CUT_HINT = {
  marks: 'Tracinhos finos nas margens da folha, alinhados com as bordas das fotos: corte com estilete e régua de ponta a ponta.',
  outline: 'Linha cinza bem clara em volta de cada foto, para cortar com tesoura.',
  none: 'Sem marcas.',
};
const PAGE_MARGIN = 7, GAP = 4;          // mm (as Canon não imprimem colado na borda)
const PPM_PRINT = 300 / 25.4;            // 300 dpi
const PPM_PREVIEW = 3.2;

// ---- Estado ------------------------------------------------------------------
const KEY = 'polaroid-maker-fotos-v1';
const st = Object.assign({ format: 'polaroid', font: 'caveat', capColor: '#1c1c1e', filter: 'none', cuts: 'marks' },
  (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } })());
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* sem armazenamento */ } };
let photos = [];   // { id, name, bmp, zoom, ox, oy, rot, caption, copies, thumb }
let nextId = 1;
const $ = (id) => document.getElementById(id);
const F = () => FORMATS[st.format] || FORMATS.polaroid;
const status = (t, err) => { $('status').textContent = t; $('status').classList.toggle('err', !!err); };

// ---- Fontes da legenda -----------------------------------------------------------
const fontReady = new Map();
function loadFont(k) {
  if (!fontReady.has(k)) {
    const ff = new FontFace('cap-' + k, `url(${FONTS[k].url})`);
    fontReady.set(k, ff.load().then((f) => { document.fonts.add(f); return true; }).catch(() => false));
  }
  return fontReady.get(k);
}
document.head.appendChild(Object.assign(document.createElement('style'), {
  textContent: Object.entries(FONTS).map(([k, f]) => `@font-face{font-family:'pm-cap-${k}';src:url('${f.url}') format('woff');font-display:swap}`).join(''),
}));

// ---- Layout na folha A4 ------------------------------------------------------------
function layout(f) {
  const fit = (W, H) => ({ cols: Math.floor((W - 2 * PAGE_MARGIN + GAP) / (f.w + GAP)), rows: Math.floor((H - 2 * PAGE_MARGIN + GAP) / (f.h + GAP)) });
  const p = fit(210, 297), l = fit(297, 210);
  const land = l.cols * l.rows > p.cols * p.rows;
  const o = land ? { W: 297, H: 210, ...l, land } : { W: 210, H: 297, ...p, land };
  const gw = o.cols * f.w + (o.cols - 1) * GAP, gh = o.rows * f.h + (o.rows - 1) * GAP;
  o.x0 = (o.W - gw) / 2; o.y0 = (o.H - gh) / 2; o.n = o.cols * o.rows;
  o.slot = (i) => ({ x: o.x0 + (i % o.cols) * (f.w + GAP), y: o.y0 + Math.floor(i / o.cols) * (f.h + GAP), c: i % o.cols, r: Math.floor(i / o.cols) });
  return o;
}

/** Marcas de corte (mm): só nas margens da folha, alinhadas com cada borda — corte com régua de ponta a ponta. */
function cutLines(f, L, count) {
  const segs = [];
  if (st.cuts !== 'marks' || !count) return segs;
  const off = 1, cols = Math.min(count, L.cols), rows = Math.ceil(count / L.cols);
  const top = L.y0, bottom = L.H - (L.y0 + rows * f.h + (rows - 1) * GAP);
  const left = L.x0, right = L.W - (L.x0 + cols * f.w + (cols - 1) * GAP);
  const len = (m) => Math.max(0, Math.min(5, m - off - 1.5));
  for (let c = 0; c < cols; c++) {
    for (const x of [L.x0 + c * (f.w + GAP), L.x0 + c * (f.w + GAP) + f.w]) {
      segs.push([x, top - off, x, top - off - len(top)]);
      segs.push([x, L.H - bottom + off, x, L.H - bottom + off + len(bottom)]);
    }
  }
  for (let r = 0; r < rows; r++) {
    for (const y of [L.y0 + r * (f.h + GAP), L.y0 + r * (f.h + GAP) + f.h]) {
      segs.push([left - off, y, left - off - len(left), y]);
      segs.push([L.W - right + off, y, L.W - right + off + len(right), y]);
    }
  }
  return segs.filter((q) => Math.hypot(q[2] - q[0], q[3] - q[1]) > 0.5);
}

// ---- Desenho de uma foto no formato ------------------------------------------------
function geom(p, f) {
  const rw = p.rot % 180 ? p.bmp.height : p.bmp.width, rh = p.rot % 180 ? p.bmp.width : p.bmp.height;
  const mmPerPx = Math.max(f.imgW / rw, f.imgH / rh) * p.zoom;
  return { rw, rh, mmPerPx, panX: Math.max(0, (rw * mmPerPx - f.imgW) / 2), panY: Math.max(0, (rh * mmPerPx - f.imgH) / 2), dpi: 25.4 / mmPerPx };
}

function applyFilter(ctx, x, y, w, h) {
  if (st.filter === 'none') return;
  const img = ctx.getImageData(x, y, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i + 1], b = d[i + 2];
    if (st.filter === 'pb') {
      const l = (0.299 * r + 0.587 * g + 0.114 * b - 128) * 1.08 + 128;
      r = g = b = l;
    } else {                                   // vintage: quente, pretos lavados, contraste menor
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      r = r * 0.85 + l * 0.1 + 26; g = g * 0.82 + l * 0.1 + 18; b = b * 0.72 + l * 0.1 + 14;
    }
    d[i] = r; d[i + 1] = g; d[i + 2] = b;
  }
  ctx.putImageData(img, x, y);
}

function renderCard(p, f, ppm) {
  const W = Math.round(f.w * ppm), H = Math.round(f.h * ppm);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  const wx = Math.round((f.w - f.imgW) / 2 * ppm), wy = Math.round(f.imgTop * ppm);
  const ww = Math.round(f.imgW * ppm), wh = Math.round(f.imgH * ppm);
  const g = geom(p, f), s = g.mmPerPx * ppm;
  ctx.save();
  ctx.beginPath(); ctx.rect(wx, wy, ww, wh); ctx.clip();
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(wx + ww / 2 + p.ox * g.panX * ppm, wy + wh / 2 + p.oy * g.panY * ppm);
  ctx.rotate(p.rot * Math.PI / 180);
  ctx.drawImage(p.bmp, -p.bmp.width * s / 2, -p.bmp.height * s / 2, p.bmp.width * s, p.bmp.height * s);
  ctx.restore();
  applyFilter(ctx, wx, wy, ww, wh);
  const text = (p.caption || '').trim();
  if (text) {
    const band = H - (wy + wh), maxW = (f.w - 8) * ppm;
    let size = band * (st.font === 'pacifico' || st.font === 'marker' ? 0.36 : 0.46);
    const fam = `'cap-${st.font}', 'pm-cap-${st.font}', cursive`;
    ctx.font = `${size}px ${fam}`;
    const tw = ctx.measureText(text).width;
    if (tw > maxW) { size *= maxW / tw; ctx.font = `${size}px ${fam}`; }
    ctx.fillStyle = st.capColor; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, W / 2, wy + wh + band * 0.5);
  }
  cv.win = { x: wx, y: wy, w: ww, h: wh };
  return cv;
}

// ---- Folhas (pré-visualização) -----------------------------------------------------------
const slots = () => photos.flatMap((p) => Array.from({ length: Math.max(1, p.copies | 0) }, () => p));
function pagesOf() {
  const f = F(), L = layout(f), all = slots(), out = [];
  for (let i = 0; i < all.length; i += L.n) out.push(all.slice(i, i + L.n));
  return { f, L, pages: out };
}

function drawSheet(ctx, f, L, list, ppm, cardCache) {
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, L.W * ppm, L.H * ppm);
  list.forEach((p, i) => {
    const { x, y } = L.slot(i);
    const card = cardCache ? cardCache(p) : renderCard(p, f, ppm);
    ctx.drawImage(card, x * ppm, y * ppm, f.w * ppm, f.h * ppm);
    if (st.cuts === 'outline') {
      ctx.strokeStyle = '#c4c4c4'; ctx.lineWidth = Math.max(1, 0.15 * ppm);
      ctx.strokeRect(x * ppm, y * ppm, f.w * ppm, f.h * ppm);
    }
  });
  ctx.strokeStyle = '#555'; ctx.lineWidth = Math.max(1, 0.18 * ppm);
  ctx.beginPath();
  for (const [x1, y1, x2, y2] of cutLines(f, L, list.length)) { ctx.moveTo(x1 * ppm, y1 * ppm); ctx.lineTo(x2 * ppm, y2 * ppm); }
  ctx.stroke();
}

let sheetTimer = 0;
function scheduleSheets() { clearTimeout(sheetTimer); sheetTimer = setTimeout(renderSheets, 120); }
async function renderSheets() {
  await loadFont(st.font);
  const { f, L, pages } = pagesOf();
  const box = $('sheets');
  box.querySelectorAll('.sheet, .sheet-label').forEach((e) => e.remove());
  $('empty').hidden = photos.length > 0;
  const cache = new Map();
  const cardOf = (p) => { if (!cache.has(p.id)) cache.set(p.id, renderCard(p, f, PPM_PREVIEW)); return cache.get(p.id); };
  pages.forEach((list, k) => {
    const cv = document.createElement('canvas');
    cv.width = Math.round(L.W * PPM_PREVIEW); cv.height = Math.round(L.H * PPM_PREVIEW);
    drawSheet(cv.getContext('2d'), f, L, list, PPM_PREVIEW, cardOf);
    const div = Object.assign(document.createElement('div'), { className: 'sheet' + (L.land ? ' land' : '') });
    div.appendChild(cv);
    box.appendChild(div);
    box.appendChild(Object.assign(document.createElement('div'), { className: 'sheet-label', textContent: `Folha ${k + 1} de ${pages.length}` }));
  });
  const n = slots().length;
  $('count').textContent = photos.length ? `(${n})` : '';
  status(photos.length ? `${n} foto${n > 1 ? 's' : ''} · ${pages.length} folha${pages.length > 1 ? 's' : ''} A4` : 'Adicione fotos');
}

// ---- Lista de fotos (painel) ---------------------------------------------------------------
function itemPreview(p) {
  const cv = renderCard(p, F(), 2.4);
  const el = document.querySelector(`.item[data-id="${p.id}"] canvas`);
  if (el) { el.width = cv.width; el.height = cv.height; el.getContext('2d').drawImage(cv, 0, 0); }
  const w = document.querySelector(`.item[data-id="${p.id}"] .warn`);
  if (w) {
    const dpi = geom(p, F()).dpi;
    w.textContent = dpi < 150 ? `Resolução baixa (${Math.round(dpi)} dpi): pode sair borrada. Peça a foto original.` : '';
  }
}
function renderList() {
  $('list').innerHTML = photos.map((p) => `
    <div class="item" data-id="${p.id}">
      <canvas title="Arraste para enquadrar"></canvas>
      <div class="ctl">
        <input type="text" data-k="caption" maxlength="40" placeholder="Legenda (opcional)" value="${p.caption.replace(/"/g, '&quot;')}">
        <div class="line">🔍<input type="range" data-k="zoom" min="1" max="3" step="0.01" value="${p.zoom}"></div>
        <div class="btns">
          <button data-a="rot" title="Girar 90°">⟳</button>
          <button data-a="reset" title="Centralizar">⌖</button>
          <button data-a="del" title="Remover">✕</button>
          <label class="copies">Cópias <input type="number" data-k="copies" min="1" max="20" value="${p.copies}"></label>
        </div>
        <div class="warn"></div>
      </div>
    </div>`).join('');
  photos.forEach(itemPreview);
}
const byId = (el) => photos.find((p) => p.id === +el.closest('.item')?.dataset.id);
$('list').addEventListener('input', (e) => {
  const p = byId(e.target), k = e.target.dataset.k; if (!p || !k) return;
  if (k === 'caption') p.caption = e.target.value;
  if (k === 'zoom') p.zoom = +e.target.value;
  if (k === 'copies') p.copies = Math.min(20, Math.max(1, +e.target.value || 1));
  if (k !== 'copies') itemPreview(p);
  scheduleSheets();
});
$('list').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-a]'); if (!b) return;
  const p = byId(b);
  if (b.dataset.a === 'del') { photos = photos.filter((x) => x !== p); p.bmp.close?.(); renderList(); }
  else {
    if (b.dataset.a === 'rot') { p.rot = (p.rot + 90) % 360; p.ox = p.oy = 0; }
    if (b.dataset.a === 'reset') { p.ox = p.oy = 0; p.zoom = 1; b.closest('.item').querySelector('[data-k=zoom]').value = 1; }
    itemPreview(p);
  }
  scheduleSheets();
});
// arrastar para enquadrar / roda do mouse para zoom
let drag = null;
$('list').addEventListener('pointerdown', (e) => {
  if (e.target.tagName !== 'CANVAS') return;
  const p = byId(e.target); drag = { p, x: e.clientX, y: e.clientY, cv: e.target };
  e.target.setPointerCapture(e.pointerId);
});
$('list').addEventListener('pointermove', (e) => {
  if (!drag) return;
  const { p, cv } = drag, f = F(), g = geom(p, f), dppm = cv.clientWidth / f.w;
  if (g.panX > 0) p.ox = Math.max(-1, Math.min(1, p.ox + (e.clientX - drag.x) / (g.panX * dppm)));
  if (g.panY > 0) p.oy = Math.max(-1, Math.min(1, p.oy + (e.clientY - drag.y) / (g.panY * dppm)));
  drag.x = e.clientX; drag.y = e.clientY;
  itemPreview(p);
});
const endDrag = () => { if (drag) { drag = null; scheduleSheets(); } };
$('list').addEventListener('pointerup', endDrag);
$('list').addEventListener('pointercancel', endDrag);
$('list').addEventListener('wheel', (e) => {
  if (e.target.tagName !== 'CANVAS') return;
  e.preventDefault();
  const p = byId(e.target);
  p.zoom = Math.max(1, Math.min(3, p.zoom * (e.deltaY < 0 ? 1.06 : 1 / 1.06)));
  e.target.closest('.item').querySelector('[data-k=zoom]').value = p.zoom;
  itemPreview(p); scheduleSheets();
}, { passive: false });

// ---- Adicionar fotos ------------------------------------------------------------------------
async function addFiles(files) {
  const imgs = [...files].filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name));
  if (!imgs.length) return;
  let bad = 0;
  status('Carregando fotos…');
  for (const file of imgs) {
    try {
      let bmp = await createImageBitmap(file);          // já corrige a rotação do celular (EXIF)
      const big = Math.max(bmp.width, bmp.height);
      if (big > 3600) {                                  // 3600 px já dá mais de 300 dpi na Polaroid
        try {
          const k = 3600 / big;
          const small = await createImageBitmap(bmp, { resizeWidth: Math.round(bmp.width * k), resizeHeight: Math.round(bmp.height * k), resizeQuality: 'high' });
          bmp.close(); bmp = small;
        } catch (e) { /* navegador sem redimensionamento: usa a original */ }
      }
      photos.push({ id: nextId++, name: file.name, bmp, zoom: 1, ox: 0, oy: 0, rot: 0, caption: $('capAll').value.trim(), copies: 1 });
    } catch (e) { bad++; }
  }
  renderList();
  await renderSheets();
  if (bad) status(`${bad} arquivo(s) não abriram. Fotos HEIC do iPhone: peça em JPG (pelo WhatsApp já vem em JPG).`, true);
}
for (const id of ['files', 'files2']) $(id).onchange = (e) => { addFiles(e.target.files); e.target.value = ''; };
const dropZone = document.body;
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); $('drop').classList.add('drop-on'); });
dropZone.addEventListener('dragleave', (e) => { if (!e.relatedTarget) $('drop').classList.remove('drop-on'); });
dropZone.addEventListener('drop', (e) => { e.preventDefault(); $('drop').classList.remove('drop-on'); addFiles(e.dataTransfer.files); });
window.addEventListener('paste', (e) => {
  const files = [...(e.clipboardData?.items || [])].filter((i) => i.kind === 'file').map((i) => i.getAsFile());
  if (files.length) addFiles(files);
});

// ---- Opções ----------------------------------------------------------------------------------
$('format').innerHTML = Object.entries(FORMATS).map(([k, f]) => `<option value="${k}">${f.label}</option>`).join('');
$('format').value = st.format;
function perPage() {
  const L = layout(F());
  $('perPage').textContent = `${L.n} por folha A4 (${L.land ? 'deitada' : 'em pé'}). Tamanho real, igual ao das fotos instantâneas, para caber nos suportes.`;
}
$('format').onchange = (e) => { st.format = e.target.value; save(); perPage(); photos.forEach((p) => { p.ox = p.oy = 0; }); renderList(); scheduleSheets(); };

function renderFonts() {
  $('fonts').innerHTML = Object.entries(FONTS).map(([k, f]) =>
    `<button data-f="${k}" class="${k === st.font ? 'on' : ''}" style="font-family:'pm-cap-${k}'">${f.label}</button>`).join('');
  $('capColors').innerHTML = CAP_COLORS.map(([n, h]) =>
    `<button class="sw ${h === st.capColor ? 'on' : ''}" title="${n}" style="background:${h}" data-c="${h}"></button>`).join('');
}
$('fonts').onclick = async (e) => {
  const b = e.target.closest('button'); if (!b) return;
  st.font = b.dataset.f; save(); renderFonts();
  await loadFont(st.font); photos.forEach(itemPreview); scheduleSheets();
};
$('capColors').onclick = (e) => {
  const b = e.target.closest('button'); if (!b) return;
  st.capColor = b.dataset.c; save(); renderFonts(); photos.forEach(itemPreview); scheduleSheets();
};
$('capApply').onclick = () => {
  const t = $('capAll').value.trim();
  photos.forEach((p) => { p.caption = t; });
  renderList(); scheduleSheets();
};

function renderSegs() {
  document.querySelectorAll('#filter button').forEach((b) => b.classList.toggle('on', b.dataset.f === st.filter));
  document.querySelectorAll('#cuts button').forEach((b) => b.classList.toggle('on', b.dataset.c === st.cuts));
  $('filterHint').textContent = FILTER_HINT[st.filter];
  $('cutHint').textContent = CUT_HINT[st.cuts];
}
$('filter').onclick = (e) => {
  const b = e.target.closest('button'); if (!b) return;
  st.filter = b.dataset.f; save(); renderSegs(); photos.forEach(itemPreview); scheduleSheets();
};
$('cuts').onclick = (e) => {
  const b = e.target.closest('button'); if (!b) return;
  st.cuts = b.dataset.c; save(); renderSegs(); scheduleSheets();
};
$('clear').onclick = () => {
  if (!photos.length) return;
  photos.forEach((p) => p.bmp.close?.()); photos = [];
  renderList(); renderSheets();
};

// ---- PDF (escrito à mão: JPEG por foto + linhas vetoriais) ----------------------------------
const blobOf = (cv, q = 0.92) => new Promise((r) => cv.toBlob(r, 'image/jpeg', q));
async function makePDF() {
  await loadFont(st.font);
  const { f, L, pages } = pagesOf();
  const pt = 72 / 25.4, enc = new TextEncoder();
  // Por foto: a janela da imagem em JPEG e a faixa da legenda sem perdas (Flate). A moldura não é impressa:
  // é o branco do próprio papel (JPEG deixaria um "quase branco" 254 que algumas impressoras sujam).
  const crop = (cv, x, y, w, h) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(cv, x, y, w, h, 0, 0, w, h); return c;
  };
  const imgs = new Map();                     // uma vez por foto (as cópias reutilizam)
  for (const p of photos) {
    const cv = renderCard(p, f, PPM_PRINT), w = cv.win;
    const win = crop(cv, w.x, w.y, w.w, w.h);
    const e = { win: { w: w.w, h: w.h, jpeg: new Uint8Array(await (await blobOf(win, 0.93)).arrayBuffer()),
      mm: [w.x / PPM_PRINT, w.y / PPM_PRINT, w.w / PPM_PRINT, w.h / PPM_PRINT] } };
    if ((p.caption || '').trim()) {
      const by = w.y + w.h, bh = cv.height - by;
      const band = crop(cv, 0, by, cv.width, bh), px = band.getContext('2d').getImageData(0, 0, cv.width, bh).data;
      const rgb = new Uint8Array(cv.width * bh * 3);
      for (let i = 0, k = 0; i < px.length; i += 4) { rgb[k++] = px[i]; rgb[k++] = px[i + 1]; rgb[k++] = px[i + 2]; }
      const z = new Uint8Array(await new Response(new Blob([rgb]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
      e.cap = { w: cv.width, h: bh, flate: z, mm: [0, by / PPM_PRINT, cv.width / PPM_PRINT, bh / PPM_PRINT] };
    }
    imgs.set(p.id, e);
  }
  const objs = [];                            // conteúdo de cada objeto (Uint8Array)
  const add = (parts) => { objs.push(parts); return objs.length; };
  const catalogId = add(null), pagesId = add(null);
  const xobj = (w, h, filter, data) => add([enc.encode(`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /${filter} /Length ${data.length} >>\nstream\n`), data, enc.encode('\nendstream')]);
  const imgId = new Map();
  for (const [id, e] of imgs) {
    imgId.set('W' + id, xobj(e.win.w, e.win.h, 'DCTDecode', e.win.jpeg));
    if (e.cap) imgId.set('C' + id, xobj(e.cap.w, e.cap.h, 'FlateDecode', e.cap.flate));
  }
  const n = (v) => (+v.toFixed(3)).toString();
  const kids = [];
  for (const list of pages) {
    const PH = L.H * pt;
    let c = '';
    list.forEach((p, i) => {
      const { x, y } = L.slot(i);
      const e = imgs.get(p.id);
      for (const [key, im] of [['W', e.win], ['C', e.cap]]) {
        if (!im) continue;
        const [ix, iy, iw, ih] = im.mm;
        c += `q ${n(iw * pt)} 0 0 ${n(ih * pt)} ${n((x + ix) * pt)} ${n(PH - (y + iy + ih) * pt)} cm /${key}${p.id} Do Q\n`;
      }
      if (st.cuts === 'outline') c += `q 0.77 G ${n(0.15 * pt)} w ${n(x * pt)} ${n(PH - (y + f.h) * pt)} ${n(f.w * pt)} ${n(f.h * pt)} re S Q\n`;
    });
    const segs = cutLines(f, L, list.length);
    if (segs.length) {
      c += `q 0.33 G ${n(0.18 * pt)} w\n`;
      for (const [x1, y1, x2, y2] of segs) c += `${n(x1 * pt)} ${n(PH - y1 * pt)} m ${n(x2 * pt)} ${n(PH - y2 * pt)} l S\n`;
      c += 'Q\n';
    }
    const cb = enc.encode(c);
    const contentId = add([enc.encode(`<< /Length ${cb.length} >>\nstream\n`), cb, enc.encode('\nendstream')]);
    const used = [...new Set(list.flatMap((p) => ['W' + p.id, 'C' + p.id]))].filter((k) => imgId.has(k));
    const xo = used.map((k) => `/${k} ${imgId.get(k)} 0 R`).join(' ');
    kids.push(add([enc.encode(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${n(L.W * pt)} ${n(PH)}] /Resources << /XObject << ${xo} >> >> /Contents ${contentId} 0 R >>`)]));
  }
  objs[catalogId - 1] = [enc.encode(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`)];
  objs[pagesId - 1] = [enc.encode(`<< /Type /Pages /Kids [${kids.map((k) => k + ' 0 R').join(' ')}] /Count ${kids.length} >>`)];
  const chunks = [new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, 10, 37, 226, 227, 207, 211, 10])];   // %PDF-1.4 + bytes binários
  let off = chunks[0].length;
  const xref = [];
  objs.forEach((parts, i) => {
    xref.push(off);
    const all = [enc.encode(`${i + 1} 0 obj\n`), ...parts, enc.encode('\nendobj\n')];
    for (const a of all) { chunks.push(a); off += a.length; }
  });
  const tail = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${xref.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('')}`
    + `trailer\n<< /Size ${objs.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${off}\n%%EOF\n`;
  chunks.push(enc.encode(tail));
  return new Blob(chunks, { type: 'application/pdf' });
}

$('pdf').onclick = async () => {
  if (!photos.length) { status('Adicione fotos primeiro', true); return; }
  const b = $('pdf'); b.disabled = true; status('Gerando PDF em 300 dpi…');
  try {
    const blob = await makePDF();
    const url = URL.createObjectURL(blob);
    const d = new Date(), stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const a = Object.assign(document.createElement('a'), { href: url, download: `fotos-${st.format}-${stamp}.pdf` });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    await renderSheets();
  } catch (e) { console.error(e); status('Erro ao gerar o PDF: ' + e.message, true); }
  b.disabled = false;
};

$('print').onclick = async () => {
  if (!photos.length) { status('Adicione fotos primeiro', true); return; }
  status('Preparando impressão…');
  await loadFont(st.font);
  const { f, L, pages } = pagesOf();
  const cache = new Map();
  const cardOf = (p) => { if (!cache.has(p.id)) cache.set(p.id, renderCard(p, f, PPM_PRINT)); return cache.get(p.id); };
  const area = $('printArea'); area.innerHTML = '';
  for (const list of pages) {
    const cv = document.createElement('canvas');
    cv.width = Math.round(L.W * PPM_PRINT); cv.height = Math.round(L.H * PPM_PRINT);
    drawSheet(cv.getContext('2d'), f, L, list, PPM_PRINT, cardOf);
    const img = new Image(); img.src = URL.createObjectURL(await new Promise((r) => cv.toBlob(r, 'image/png')));
    if (L.land) img.className = 'land';
    await img.decode();
    area.appendChild(img);
  }
  const css = document.getElementById('pageSize') || document.head.appendChild(Object.assign(document.createElement('style'), { id: 'pageSize' }));
  css.textContent = `@media print { @page { size: A4 ${L.land ? 'landscape' : 'portrait'}; margin: 0; } }`;
  await renderSheets();
  window.print();
};

// ---- Início ----------------------------------------------------------------------------------
renderFonts(); renderSegs(); perPage(); renderSheets();
loadFont(st.font).then(() => photos.forEach(itemPreview));
