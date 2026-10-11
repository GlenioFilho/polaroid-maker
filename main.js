import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { initGeo, freeAll, loadFont, textSection, csMove, csBounds, xz, xy, sub, union, meshOf,
  roundedRect, footprint, textureSolid } from './geo.js';
import { MODELS, COLLECTIONS } from './models.js';
import { stl, threeMF, threeMFBambu, zip, download } from './export.js';

// ---- Dados fixos -----------------------------------------------------------
const PHOTOS = {
  polaroid: { label: 'Polaroid 600 / i-Type / SX-70 (88 × 107)', w: 88, h: 107, t: 1, imgW: 79, imgH: 79, imgTop: 6 },
  go: { label: 'Polaroid Go (54 × 67)', w: 53.9, h: 66.6, t: 1, imgW: 47, imgH: 46, imgTop: 4 },
  mini: { label: 'Instax Mini (54 × 86)', w: 54, h: 86, t: 1, imgW: 46, imgH: 62, imgTop: 7 },
  square: { label: 'Instax Square (72 × 86)', w: 72, h: 86, t: 1, imgW: 62, imgH: 62, imgTop: 7 },
  wide: { label: 'Instax Wide (108 × 86)', w: 108, h: 86, t: 1, imgW: 99, imgH: 62, imgTop: 7 },
};
const FS = 'https://cdn.jsdelivr.net/npm/@fontsource/';
const FONTS = {
  fredoka: { label: 'Fredoka', url: FS + 'fredoka@5/files/fredoka-latin-600-normal.woff' },
  baloo: { label: 'Baloo', url: FS + 'baloo-2@5/files/baloo-2-latin-700-normal.woff' },
  pacifico: { label: 'Pacifico', url: FS + 'pacifico@5/files/pacifico-latin-400-normal.woff' },
  lobster: { label: 'Lobster', url: FS + 'lobster@5/files/lobster-latin-400-normal.woff' },
  bebas: { label: 'Bebas Neue', url: FS + 'bebas-neue@5/files/bebas-neue-latin-400-normal.woff' },
  marker: { label: 'Marker', url: FS + 'permanent-marker@5/files/permanent-marker-latin-400-normal.woff' },
  archivo: { label: 'Archivo Black', url: FS + 'archivo-black@5/files/archivo-black-latin-400-normal.woff' },
};
const PALETTE = [
  ['Branco', '#f4f4f0'], ['Preto', '#1c1c1e'], ['Cinza', '#7d8a99'], ['Prata', '#c0c4c8'], ['Bege', '#e8dcc4'],
  ['Madeira', '#b98a5e'], ['Marrom', '#8b5a3c'], ['Terracota', '#c0623e'], ['Vermelho', '#d23c3c'], ['Rosa', '#f19bb4'], ['Laranja', '#f08a24'],
  ['Amarelo', '#f5d33f'], ['Dourado', '#c9a54a'], ['Verde', '#2e7d4f'], ['Verde-claro', '#a8d5a2'], ['Azul', '#2f6fd0'],
  ['Azul-claro', '#cfe3f5'], ['Roxo', '#8f5bd1'], ['Lilás', '#c9a7e0'],
];
const MODE_HINT = {
  relevo: 'Letras saltadas 0,8 mm da superfície. Ficam lindas em outra cor.',
  embutido: 'Letras na mesma altura da superfície, em outra cor (precisa de multicor).',
  gravado: 'Letras afundadas 0,8 mm, na mesma cor do suporte.',
};
const TEX_HINT = {
  lisa: 'Frente lisa.',
  croche: 'Pontinhos em V em relevo (0,75 mm) na frente, como crochê. O nome e os detalhes ficam lisos.',
  trico: 'Colunas de V em relevo, como tricô (ponto meia). O nome e os detalhes ficam lisos.',
};
const colorName = (hex) => (PALETTE.find(([, h]) => h === hex) || [hex])[0];

// ---- Estado (salvo no navegador) ------------------------------------------------
const KEY = 'polaroid-maker-v1';
const state = Object.assign({
  model: 'classico', photo: 'polaroid', gap: 1.6, scale: 100, opts: {}, colors: {},
  text: { l1: '', l2: '', font: 'fredoka', mode: 'relevo' }, textColors: {}, showPhoto: true, texture: 'lisa',
}, (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } })());
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* sem armazenamento */ } };

const $ = (id) => document.getElementById(id);
const model = () => MODELS.find((m) => m.key === state.model) || MODELS[0];
const optsOf = (m) => Object.fromEntries((m.opts || []).map((o) => [o.id, state.opts[m.key]?.[o.id] ?? o.def]));
const colorOf = (m, role) => role === 'text' ? state.textColors[m.key] ?? m.textColor ?? '#f4f4f0'
  : state.colors[m.key]?.[role] ?? m.roles.find((r) => r.id === role).color;
const textLines = (m = model()) => {
  const l = [state.text.l1, state.text.l2].map((s) => s.trim()).filter(Boolean);
  return l.length ? l : (m.defText || []);
};
const textOn = (m) => m.text && textLines(m).length > 0;
// Modelos com textShape: o próprio texto é a peça (letreiro). Fonte guardada por modelo, com padrão defFont.
const fontKey = (m = model()) => m.textShape ? state.shapeFonts?.[m.key] ?? m.defFont ?? state.text.font : state.text.font;

// ---- Cena 3D -------------------------------------------------------------------
const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
stage.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 1, 5000);
camera.up.set(0, 0, 1);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8070, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.7); sun.position.set(-120, -220, 260); scene.add(sun);
const fill = new THREE.DirectionalLight(0xffffff, 0.6); fill.position.set(200, 150, 80); scene.add(fill);
const grid = new THREE.GridHelper(400, 40, 0x999999, 0xbbbbbb);
grid.rotation.x = Math.PI / 2; grid.material.transparent = true; grid.material.opacity = 0.3;
scene.add(grid);

let world = new THREE.Group(); scene.add(world);
let photoTex = null;
let lastGroups = [];

function photoMesh(P, spec) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(P.w, P.t, P.h),
    new THREE.MeshStandardMaterial({ color: 0xf7f7f2, roughness: 0.5, transparent: true, opacity: 0.94 }));
  body.position.z = P.h / 2;
  const imgMat = new THREE.MeshStandardMaterial({ color: photoTex ? 0xffffff : 0x3d5a73, roughness: 0.35 });
  if (photoTex) {
    const t = photoTex.clone();
    const ia = t.image.width / t.image.height, aa = P.imgW / P.imgH;
    t.repeat.set(ia > aa ? aa / ia : 1, ia > aa ? 1 : ia / aa);
    t.offset.set((1 - t.repeat.x) / 2, (1 - t.repeat.y) / 2);
    t.needsUpdate = true;
    imgMat.map = t;
  }
  const img = new THREE.Mesh(new THREE.PlaneGeometry(P.imgW, P.imgH), imgMat);
  img.rotation.x = Math.PI / 2;
  img.position.set(0, -P.t / 2 - 0.06, P.h - P.imgTop - P.imgH / 2);
  g.add(body, img);
  g.rotation.set((spec.rx || 0) * Math.PI / 180, (spec.ry || 0) * Math.PI / 180, 0);
  g.position.set(spec.x, spec.y, spec.z);
  return g;
}

function show(groups, photos, P, refit) {
  scene.remove(world);
  world.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  world = new THREE.Group();
  const solid = new THREE.Group();
  for (const g of groups) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(g.mesh.pos, 3));
    geo.setIndex(new THREE.BufferAttribute(g.mesh.idx, 1));
    solid.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: g.color, roughness: 0.6, flatShading: true })));
  }
  const ph = new THREE.Group();
  photos.forEach((p) => ph.add(photoMesh(P, p)));
  ph.visible = state.showPhoto;
  ph.name = 'photos';
  world.add(solid, ph);
  const bb = new THREE.Box3().setFromObject(solid);
  const c = bb.getCenter(new THREE.Vector3());
  world.position.set(-c.x, -c.y, -bb.min.z);
  scene.add(world);
  const size = bb.getSize(new THREE.Vector3());
  $('dims').textContent = `${fmt(size.x)} × ${fmt(size.y)} × ${fmt(size.z)} mm`;
  if (refit) fit();
}
const fmt = (v) => v.toFixed(1).replace('.0', '').replace('.', ',');

function fit() {
  const box = new THREE.Box3().setFromObject(state.showPhoto ? world : world.children[0]);
  const sph = box.getBoundingSphere(new THREE.Sphere());
  const vf = THREE.MathUtils.degToRad(camera.fov), hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
  controls.target.copy(sph.center);
  camera.position.copy(sph.center).addScaledVector(new THREE.Vector3(0.5, -1, 0.45).normalize(),
    sph.radius * 1.1 / Math.sin(Math.min(vf, hf) / 2));
  controls.update();
}

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
(function loop() { controls.update(); renderer.render(scene, camera); requestAnimationFrame(loop); })();

// ---- Montagem do modelo ----------------------------------------------------------
function textSolid(sec, tb, d0, d1) {   // d0..d1 = distância para fora da face
  if (tb.face === 'front') return xz(csMove(sec, tb.cx, tb.cz), tb.y - d1, tb.y - d0);
  return xy(csMove(sec, tb.cx, tb.cy), tb.z + d0, tb.z + d1);
}

let building = false, again = false, needFit = true;
async function rebuild(refit = false) {
  needFit = needFit || refit;
  if (building) { again = true; return; }
  building = true;
  setStatus('Gerando…');
  try {
    const m = model(), P = PHOTOS[state.photo] || PHOTOS.polaroid;
    const font = textOn(m) ? await loadFont(FONTS[fontKey(m)].url) : null;
    const ctx = { P, gap: state.gap, s: state.scale / 100, hasText: !!font, o: optsOf(m), font, lines: textLines(m),
      blockFont: m.blockFont ? await loadFont(FONTS[m.blockFont].url) : null };
    freeAll();
    const out = m.build(ctx);
    let parts = out.parts;
    let sizeNote = '', plaque = null;
    if (font && out.textBox && !m.textShape) {
      const tb = out.textBox, lines = textLines(), sec = textSection(font, lines, tb.w, tb.h);
      if (sec) {
        const b = csBounds(sec), n = lines.length;
        const letter = (b.max[1] - b.min[1]) / (n + 0.25 * (n - 1));
        sizeNote = `Letras com cerca de ${fmt(letter)} mm de altura.`
          + (letter < 4 ? ' <b>Pequenas para imprimir bem</b>: use uma linha só, menos letras ou aumente o tamanho do suporte.' : '');
        if (tb.face === 'front') {   // área lisa em volta do nome quando há textura
          const p = 2.2;
          plaque = csMove(roundedRect(b.min[0] - p, b.min[1] - p, b.max[0] + p, b.max[1] + p, 2.5), tb.cx, tb.cz);
        }
        const mode = state.text.mode;
        if (mode === 'relevo') parts.push({ m: textSolid(sec, tb, 0, 0.8), role: 'text' });
        else {
          const depth = mode === 'gravado' ? 0.8 : 0.6;
          const cut = textSolid(sec, tb, -depth, 0.05);
          parts = parts.map((p) => ({ ...p, m: sub(p.m, cut) }));
          if (mode === 'embutido') parts.push({ m: textSolid(sec, tb, -depth, 0), role: 'text' });
        }
      }
    }
    if (state.texture !== 'lisa' && out.tex) {
      const prints = new Map();
      const fp = (p) => { if (!prints.has(p.m)) prints.set(p.m, footprint(p.m)); return prints.get(p.m); };
      const extra = [];
      for (const t of out.tex) {
        const excl = parts.filter((p) => p.role !== t.role).map(fp);
        if (plaque) excl.push(plaque);
        const m = textureSolid(t.sec, excl, state.texture, t.y ?? 0, t.margin ?? 1.2);
        if (m) extra.push({ m, role: t.role });
      }
      parts = parts.concat(extra);
    }
    const byColor = new Map();
    for (const p of parts) {
      const col = colorOf(m, p.role);
      const label = p.role === 'text' ? 'Texto' : m.roles.find((r) => r.id === p.role).label;
      if (!byColor.has(col)) byColor.set(col, { color: col, labels: [], ms: [] });
      const g = byColor.get(col);
      g.ms.push(p.m);
      if (!g.labels.includes(label)) g.labels.push(label);
    }
    lastGroups = [...byColor.values()].map((g) => ({
      color: g.color, name: g.labels.join(' + '),
      mesh: meshOf(g.ms.length > 1 ? union(g.ms) : g.ms[0]),
    }));
    freeAll();
    $('sizeHint').innerHTML = sizeNote;
    show(lastGroups, out.photos, P, needFit);
    needFit = false;
    renderFilaments();
    const tri = lastGroups.reduce((n, g) => n + g.mesh.idx.length / 3, 0);
    setStatus(`${tri.toLocaleString('pt-BR')} triângulos`);
  } catch (e) {
    console.error(e);
    freeAll();
    setStatus('Erro: ' + (e.message || e), true);
  } finally {
    building = false;
    if (again) { again = false; rebuild(); }
  }
}
let timer = 0;
const schedule = (refit = false) => { save(); clearTimeout(timer); needFit = needFit || refit; timer = setTimeout(() => rebuild(), 120); };
function setStatus(msg, err = false) { const s = $('status'); s.textContent = msg; s.classList.toggle('err', err); }

// ---- Painel ------------------------------------------------------------------------
function renderModels() {
  const col = model().col;
  $('cols').innerHTML = COLLECTIONS.map((c) =>
    `<button data-c="${c.key}" class="${c.key === col ? 'on' : ''}" ${c.soon ? 'disabled title="Em breve"' : ''}>${c.label}${c.soon ? ' <small>em breve</small>' : ''}</button>`).join('');
  $('models').innerHTML = MODELS.filter((m) => m.col === col).map((m) =>
    `<button data-k="${m.key}" class="${m.key === state.model ? 'on' : ''}"><span class="e">${m.emoji}</span>${m.name}</button>`).join('');
  $('modelDesc').textContent = model().desc;
}
$('cols').onclick = (e) => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  const c = b.dataset.c; if (c === model().col) return;
  (state.lastByCol ||= {})[model().col] = state.model;
  state.model = state.lastByCol[c] || MODELS.find((m) => m.col === c).key;
  renderAll();
  schedule(true);
};
$('models').onclick = (e) => {
  const b = e.target.closest('button'); if (!b) return;
  state.model = b.dataset.k;
  renderAll();
  schedule(true);
};

function renderOpts() {
  const m = model(), o = optsOf(m);
  $('modelOpts').innerHTML = (m.opts || []).map((d) => d.choices
    ? `<div class="row">${d.label}</div><div class="seg opt-seg">${d.choices.map(([v, l]) =>
      `<button data-opt="${d.id}" data-v="${v}" class="${o[d.id] === v ? 'on' : ''}">${l}</button>`).join('')}</div>`
    : `<label class="row">${d.label} <output>${o[d.id]}${d.unit}</output>
      <input type="range" data-opt="${d.id}" min="${d.min}" max="${d.max}" step="${d.step}" value="${o[d.id]}"></label>`).join('');
}
$('modelOpts').onclick = (e) => {
  const b = e.target.closest('button[data-v]'); if (!b) return;
  const m = model();
  (state.opts[m.key] ||= {})[b.dataset.opt] = b.dataset.v;
  renderOpts();
  schedule();
};
$('modelOpts').oninput = (e) => {
  const id = e.target.dataset.opt; if (!id) return;
  const m = model(), d = m.opts.find((x) => x.id === id);
  (state.opts[m.key] ||= {})[id] = +e.target.value;
  e.target.previousElementSibling.textContent = e.target.value + d.unit;
  schedule(id === 'n');
};

function renderText() {
  const m = model();
  $('textSec').hidden = !m.text;
  $('noTextSec').hidden = m.text;
  $('fonts').innerHTML = Object.entries(FONTS).map(([k, f]) =>
    `<button data-f="${k}" class="${k === fontKey(m) ? 'on' : ''}" style="font-family:'pm-${k}'">${f.label}</button>`).join('');
  document.querySelectorAll('#textMode button').forEach((b) => b.classList.toggle('on', b.dataset.mode === state.text.mode));
  $('modeHint').textContent = MODE_HINT[state.text.mode];
  $('textMode').hidden = $('modeHint').hidden = !!m.textShape;
}
$('line1').oninput = (e) => { state.text.l1 = e.target.value; renderColors(); schedule(); };
$('line2').oninput = (e) => { state.text.l2 = e.target.value; renderColors(); schedule(); };
$('fonts').onclick = (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (model().textShape) state.shapeFonts = { ...state.shapeFonts, [model().key]: b.dataset.f };
  else state.text.font = b.dataset.f;
  renderText(); schedule();
};
$('textMode').onclick = (e) => {
  const b = e.target.closest('button'); if (!b) return;
  state.text.mode = b.dataset.mode; renderText(); renderColors(); schedule();
};

function swatchRow(role, current) {
  const custom = !PALETTE.some(([, h]) => h === current);
  return `<div class="swatches">${PALETTE.map(([n, h]) =>
    `<button class="sw ${h === current ? 'on' : ''}" title="${n}" style="background:${h}" data-role="${role}" data-c="${h}"></button>`).join('')}
    <label class="sw custom ${custom ? 'on' : ''}" title="Outra cor"><input type="color" data-role="${role}" value="${current}"></label></div>`;
}
function renderColors() {
  const m = model();
  const roles = m.roles.map((r) => ({ id: r.id, label: r.label }));
  if (textOn(m) && !m.textShape && state.text.mode !== 'gravado') roles.push({ id: 'text', label: 'Texto' });
  $('colors').innerHTML = roles.map((r) => {
    const c = colorOf(m, r.id);
    return `<div class="role"><div class="role-name">${r.label}<span>${colorName(c)}</span></div>${swatchRow(r.id, c)}</div>`;
  }).join('');
}
function setColor(role, hex) {
  const m = model();
  if (role === 'text') state.textColors[m.key] = hex;
  else (state.colors[m.key] ||= {})[role] = hex;
  renderColors();
  schedule();
}
$('colors').onclick = (e) => { const b = e.target.closest('button.sw'); if (b) setColor(b.dataset.role, b.dataset.c); };
$('colors').onchange = (e) => { if (e.target.type === 'color') setColor(e.target.dataset.role, e.target.value); };

function renderFilaments() {
  const n = lastGroups.length;
  $('filaments').innerHTML = lastGroups.map((g, i) =>
    `<div><b>${i + 1}</b><i style="background:${g.color}"></i>${colorName(g.color)} <span class="hint" style="margin:0">— ${g.name}</span></div>`).join('')
    + (n > 4 ? '<div class="warn">Mais de 4 cores: o AMS comum tem 4 slots.</div>' : '');
  const flat = model().key === 'moldura';
  $('printHint').innerHTML = (model().printHint || (flat ? 'Imprima <b>deitada</b>, como aparece aqui.' : 'Imprima <b>em pé</b>, como aparece aqui. Não precisa de suporte.'))
    + (n > 1 ? ` No fatiador, o filamento ${lastGroups.map((g, i) => `${i + 1} = ${colorName(g.color)}`).join(', ')}.` : '')
    + ' O 3MF abre no Bambu Studio já com uma parte por cor, ligada ao filamento certo — só escolha as cores dos filamentos 1, 2, 3… na lista à esquerda.'
    + ' Se não separar, use “STL por cor”: abra todos juntos e responda <b>Sim</b> quando ele perguntar se é um objeto com várias partes.';
}

function renderTexture() {
  const has = !!model().texture;
  $('texSec').hidden = !has;
  document.querySelectorAll('#texMode button').forEach((b) => b.classList.toggle('on', b.dataset.tex === state.texture));
  $('texHint').textContent = TEX_HINT[state.texture] || '';
}
$('texMode').onclick = (e) => {
  const b = e.target.closest('button'); if (!b) return;
  state.texture = b.dataset.tex; renderTexture(); schedule();
};

function renderPhotoUI() {
  const np = !!model().noPhoto;
  $('photoRows').hidden = np;
  $('photoChips').hidden = np;
  $('fitTitle').textContent = np ? 'Tamanho e formato' : 'Foto e encaixe';
  $('line1').placeholder = model().defText ? `Nome (ex.: ${model().defText[0]})` : 'Nome (ex.: Ana & Leo)';
}
function renderAll() {
  renderPhotoUI(); renderModels(); renderOpts(); renderText(); renderTexture(); renderColors();
}

// Campos fixos
$('photoSize').innerHTML = Object.entries(PHOTOS).map(([k, p]) => `<option value="${k}">${p.label}</option>`).join('');
$('photoSize').value = state.photo;
$('photoSize').onchange = (e) => { state.photo = e.target.value; schedule(true); };
const gapOut = () => { $('gapOut').textContent = state.gap.toFixed(1).replace('.', ',') + ' mm'; };
$('gap').value = state.gap; gapOut();
$('gap').oninput = (e) => { state.gap = +e.target.value; gapOut(); schedule(); };
const scaleOut = () => { $('scaleOut').textContent = state.scale + '%'; };
$('scale').value = state.scale; scaleOut();
$('scale').oninput = (e) => { state.scale = +e.target.value; scaleOut(); schedule(); };
$('line1').value = state.text.l1; $('line2').value = state.text.l2;
$('showPhoto').checked = state.showPhoto;
$('showPhoto').onchange = (e) => {
  state.showPhoto = e.target.checked; save();
  const ph = world.getObjectByName('photos'); if (ph) ph.visible = state.showPhoto;
  fit();
};
$('myPhoto').onchange = (e) => {
  const file = e.target.files[0]; if (!file) return;
  new THREE.TextureLoader().load(URL.createObjectURL(file), (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    photoTex = t;
    state.showPhoto = true; $('showPhoto').checked = true;
    rebuild();
  });
};

// Fontes também na tela (para os botões mostrarem o estilo)
const css = Object.entries(FONTS).map(([k, f]) => `@font-face{font-family:'pm-${k}';src:url('${f.url}') format('woff');font-display:swap}`).join('');
document.head.appendChild(Object.assign(document.createElement('style'), { textContent: css }));

// Downloads
const fileBase = () => {
  const t = textLines()[0];
  return (model().col === 'polaroid' ? 'suporte-' : '') + model().key + (t ? '-' + t.normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() : '');
};
$('dl3mf').onclick = () => {
  if (!lastGroups.length) return;
  download(threeMFBambu(lastGroups, fileBase()), fileBase() + '.3mf', 'model/3mf');
};
$('dl3mfPrusa').onclick = () => {
  if (!lastGroups.length) return;
  download(threeMF(lastGroups, fileBase()), fileBase() + '-prusa.3mf', 'model/3mf');
};
$('dlStl').onclick = () => {
  if (!lastGroups.length) return;
  download(stl(lastGroups.map((g) => g.mesh), fileBase()), fileBase() + '.stl', 'model/stl');
};
$('dlZip').onclick = () => {
  if (!lastGroups.length) return;
  const files = lastGroups.map((g, i) => [`${fileBase()}-${i + 1}-${colorName(g.color).toLowerCase().replace(/[^\w]+/g, '')}.stl`, stl([g.mesh], g.name)]);
  download(zip(files), fileBase() + '-por-cor.zip', 'application/zip');
};

// Início
renderAll();
setStatus('Carregando o motor 3D…');
initGeo().then(() => rebuild(true)).catch((e) => setStatus('Não carregou o motor 3D: ' + e.message, true));
