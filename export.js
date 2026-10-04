// Exportação: STL binário, 3MF multicor (estilo PrusaSlicer/Orca) e ZIP.
// groups = [{ name, color: '#rrggbb', mesh: { pos: Float32Array, idx: Uint32Array } }]

export function stl(meshes, title = 'Suporte Polaroid') {
  const nTri = meshes.reduce((n, m) => n + m.idx.length / 3, 0);
  const buf = new ArrayBuffer(84 + 50 * nTri), dv = new DataView(buf);
  const head = new TextEncoder().encode(title.slice(0, 79));
  new Uint8Array(buf, 0, head.length).set(head);
  dv.setUint32(80, nTri, true);
  let o = 84;
  for (const { pos, idx } of meshes) {
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
      const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
      const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1;
      for (const v of [nx / l, ny / l, nz / l]) { dv.setFloat32(o, v, true); o += 4; }
      for (const i of [a, b, c]) {
        for (let k = 0; k < 3; k++) { dv.setFloat32(o, pos[i + k], true); o += 4; }
      }
      dv.setUint16(o, 0, true); o += 2;
    }
  }
  return new Uint8Array(buf);
}

const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
const f = (v) => +v.toFixed(4);

/**
 * 3MF com um objeto e uma "parte" (volume) por cor, cada uma já ligada ao
 * filamento 1, 2, 3… — PrusaSlicer/OrcaSlicer leem isso direto.
 */
export function threeMF(groups, title) {
  const verts = [], tris = [], volumes = [];
  let vOff = 0;
  groups.forEach((g, gi) => {
    const { pos, idx } = g.mesh;
    for (let i = 0; i < pos.length; i += 3) verts.push(`<vertex x="${f(pos[i])}" y="${f(pos[i + 1])}" z="${f(pos[i + 2])}"/>`);
    const first = tris.length;
    for (let t = 0; t < idx.length; t += 3) {
      tris.push(`<triangle v1="${idx[t] + vOff}" v2="${idx[t + 1] + vOff}" v3="${idx[t + 2] + vOff}" pid="2" p1="${gi}"/>`);
    }
    volumes.push({ first, last: tris.length - 1, name: g.name, extruder: gi + 1 });
    vOff += pos.length / 3;
  });
  const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="pt-BR" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:slic3rpe="http://schemas.slic3r.org/3mf/2017/06">
<metadata name="Title">${esc(title)}</metadata>
<metadata name="Application">Polaroid Maker</metadata>
<metadata name="slic3rpe:Version3mf">1</metadata>
<resources>
<basematerials id="2">
${groups.map((g) => `<base name="${esc(g.name)}" displaycolor="${g.color.toUpperCase()}FF"/>`).join('\n')}
</basematerials>
<object id="1" name="${esc(title)}" type="model" pid="2" pindex="0">
<mesh>
<vertices>
${verts.join('\n')}
</vertices>
<triangles>
${tris.join('\n')}
</triangles>
</mesh>
</object>
</resources>
<build><item objectid="1"/></build>
</model>`;
  const config = `<?xml version="1.0" encoding="UTF-8"?>
<config>
<object id="1" instances_count="1">
<metadata type="object" key="name" value="${esc(title)}"/>
${volumes.map((v) => `<volume firstid="${v.first}" lastid="${v.last}">
<metadata type="volume" key="name" value="${esc(v.name)}"/>
<metadata type="volume" key="volume_type" value="ModelPart"/>
<metadata type="volume" key="extruder" value="${v.extruder}"/>
</volume>`).join('\n')}
</object>
</config>`;
  return zip([
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
<Default Extension="config" ContentType="text/xml"/>
</Types>`],
    ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`],
    ['3D/3dmodel.model', model],
    ['Metadata/Slic3r_PE_model.config', config],
  ]);
}

/**
 * 3MF no formato do Bambu Studio (também abre no OrcaSlicer): um objeto montado
 * com uma "parte" por cor, cada parte já ligada ao filamento 1, 2, 3…
 * Segue a estrutura que o próprio Bambu Studio grava: malhas em
 * 3D/Objects/object_1.model (extensão Production) e as partes/filamentos em
 * Metadata/model_settings.config. O objeto vai para o centro da mesa (bed).
 */
export function threeMFBambu(groups, title, bed = 256) {
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16)));
  // centraliza em X/Y e apoia em Z = 0
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity;
  for (const g of groups) {
    const p = g.mesh.pos;
    for (let i = 0; i < p.length; i += 3) {
      if (p[i] < x0) x0 = p[i]; if (p[i] > x1) x1 = p[i];
      if (p[i + 1] < y0) y0 = p[i + 1]; if (p[i + 1] > y1) y1 = p[i + 1];
      if (p[i + 2] < z0) z0 = p[i + 2];
    }
  }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const NS = 'xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" '
    + 'xmlns:BambuStudio="http://schemas.bambulab.com/package/2021" '
    + 'xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" requiredextensions="p"';
  const n = groups.length, objId = n + 1;
  const meshes = groups.map((g, gi) => {
    const { pos, idx } = g.mesh, v = [], t = [];
    for (let i = 0; i < pos.length; i += 3) v.push(`<vertex x="${f(pos[i] - cx)}" y="${f(pos[i + 1] - cy)}" z="${f(pos[i + 2] - z0)}"/>`);
    for (let k = 0; k < idx.length; k += 3) t.push(`<triangle v1="${idx[k]}" v2="${idx[k + 1]}" v3="${idx[k + 2]}"/>`);
    return `<object id="${gi + 1}" p:UUID="${uuid()}" type="model">
<mesh>
<vertices>
${v.join('\n')}
</vertices>
<triangles>
${t.join('\n')}
</triangles>
</mesh>
</object>`;
  });
  const objects = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" ${NS}>
<metadata name="BambuStudio:3mfVersion">1</metadata>
<resources>
${meshes.join('\n')}
</resources>
<build/>
</model>`;
  const I = '1 0 0 0 1 0 0 0 1 0 0 0';
  const main = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" ${NS}>
<metadata name="Application">BambuStudio-01.09.00.00</metadata>
<metadata name="BambuStudio:3mfVersion">1</metadata>
<metadata name="Title">${esc(title)}</metadata>
<metadata name="Designer">Polaroid Maker</metadata>
<resources>
<object id="${objId}" p:UUID="${uuid()}" type="model">
<components>
${groups.map((g, gi) => `<component p:path="/3D/Objects/object_1.model" objectid="${gi + 1}" p:UUID="${uuid()}" transform="${I}"/>`).join('\n')}
</components>
</object>
</resources>
<build p:UUID="${uuid()}">
<item objectid="${objId}" p:UUID="${uuid()}" transform="1 0 0 0 1 0 0 0 1 ${bed / 2} ${bed / 2} 0" printable="1"/>
</build>
</model>`;
  const M4 = '1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1';
  const settings = `<?xml version="1.0" encoding="UTF-8"?>
<config>
<object id="${objId}">
<metadata key="name" value="${esc(title)}"/>
<metadata key="extruder" value="1"/>
${groups.map((g, gi) => `<part id="${gi + 1}" subtype="normal_part">
<metadata key="name" value="${esc(g.name)}"/>
<metadata key="matrix" value="${M4}"/>
<metadata key="source_object_id" value="0"/>
<metadata key="source_volume_id" value="${gi}"/>
<metadata key="extruder" value="${gi + 1}"/>
</part>`).join('\n')}
</object>
<plate>
<metadata key="plater_id" value="1"/>
<metadata key="plater_name" value=""/>
<metadata key="locked" value="false"/>
<model_instance>
<metadata key="object_id" value="${objId}"/>
<metadata key="instance_id" value="0"/>
<metadata key="identify_id" value="${objId * 100}"/>
</model_instance>
</plate>
<assemble>
<assemble_item object_id="${objId}" instance_id="0" transform="1 0 0 0 1 0 0 0 1 ${bed / 2} ${bed / 2} 0" offset="0 0 0"/>
</assemble>
</config>`;
  const REL = 'http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel';
  return zip([
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
<Default Extension="config" ContentType="text/xml"/>
</Types>`],
    ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="${REL}"/>
</Relationships>`],
    ['3D/3dmodel.model', main],
    ['3D/_rels/3dmodel.model.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Target="/3D/Objects/object_1.model" Id="rel-1" Type="${REL}"/>
</Relationships>`],
    ['3D/Objects/object_1.model', objects],
    ['Metadata/model_settings.config', settings],
  ]);
}

// ---- ZIP sem compressão ---------------------------------------------------
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(u8) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/** files = [[nome, string | Uint8Array], ...] -> Uint8Array */
export function zip(files) {
  const enc = new TextEncoder(), chunks = [], central = [];
  let off = 0;
  const d = new Date();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  for (const [name, content] of files) {
    const data = typeof content === 'string' ? enc.encode(content) : content;
    const nm = enc.encode(name), crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true);
    h.setUint16(8, 0, true); h.setUint16(10, time, true); h.setUint16(12, date, true);
    h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true);
    h.setUint16(26, nm.length, true); h.setUint16(28, 0, true);
    chunks.push(new Uint8Array(h.buffer), nm, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true); c.setUint16(12, time, true); c.setUint16(14, date, true);
    c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
    c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), nm);
    off += 30 + nm.length + data.length;
  }
  const cdSize = central.reduce((n, a) => n + a.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
  e.setUint32(12, cdSize, true); e.setUint32(16, off, true);
  const parts = [...chunks, ...central, new Uint8Array(e.buffer)];
  const out = new Uint8Array(parts.reduce((n, a) => n + a.length, 0));
  let p = 0;
  for (const a of parts) { out.set(a, p); p += a.length; }
  return out;
}

export function download(bytes, name, type = 'application/octet-stream') {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
