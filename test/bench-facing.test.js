'use strict';
// 313 A2 「의자랑 반대 방향으로 앉아」: a bench's back stands behind whoever sits on it -- read from the models themselves (their top
// quarter's mean z: the back), turned by their registry entry. 대청마당's benches (prop.bench): a seat 0.18 m to the bench's
// own +z, facing +z, so the back at -z. A yard's (yard.bench): its seats at its own -0.18, facing -z (island-yard seatsOf),
// so the back at +z. 111 swapped both models' backs and kept the old turn -- this asks again for every season.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const ROOT = path.resolve(__dirname, '..');
globalThis.self = globalThis.self || globalThis;
const A = require('../public/plaza/island-assets.js');
const REGISTRY = A.REGISTRY || globalThis.IslandAssets?.REGISTRY;

async function backZ(file, decoder) {
  const b = fs.readFileSync(file); const l = b.readUInt32LE(12); const j = JSON.parse(b.slice(20, 20 + l).toString('utf8')); const bin = b.slice(20 + l + 8);
  const view = (i) => { const v = j.bufferViews[i]; const e = v.extensions?.EXT_meshopt_compression; if (!e) return { buf: bin.slice(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength), stride: v.byteStride };
    const out = new Uint8Array(e.count * e.byteStride); decoder.decodeGltfBuffer(out, e.count, e.byteStride, new Uint8Array(bin.slice(e.byteOffset || 0, (e.byteOffset || 0) + e.byteLength)), e.mode, e.filter); return { buf: Buffer.from(out), stride: e.byteStride }; };
  const pts = [];
  const walk = (i, T = [0, 0, 0], S = [1, 1, 1]) => {
    const n = j.nodes[i]; const m = n.matrix; /* (316 assets 122: the dequantizing scale and offset as a node matrix -- scale and move only) */
    if (m) assert.ok([1, 2, 3, 4, 6, 7, 8, 9, 11].every((k) => Math.abs(m[k]) < 1e-9), `${file}: a turned node matrix`);
    const t = m ? [m[12], m[13], m[14]] : n.translation || [0, 0, 0]; const s = m ? [m[0], m[5], m[10]] : n.scale || [1, 1, 1]; const T2 = T.map((v, k) => v + t[k] * S[k]); const S2 = S.map((v, k) => v * s[k]);
    assert.ok(!n.rotation || Math.abs(n.rotation[3]) > 0.999, `${file}: a turned node`);
    if (n.mesh != null) for (const p of j.meshes[n.mesh].primitives) {
      const a = j.accessors[p.attributes.POSITION]; const { buf, stride } = view(a.bufferView); const size = { 5126: 4, 5123: 2, 5122: 2, 5121: 1, 5120: 1 }[a.componentType]; const st = stride || size * 3;
      const rd = (o) => (a.componentType === 5126 ? buf.readFloatLE(o) : a.componentType === 5123 ? buf.readUInt16LE(o) : a.componentType === 5122 ? buf.readInt16LE(o) : a.componentType === 5121 ? buf.readUInt8(o) : buf.readInt8(o));
      for (let k = 0; k < a.count; k += 1) { const o = (a.byteOffset || 0) + k * st; pts.push([0, 1, 2].map((q) => rd(o + q * size) * S2[q] + T2[q])); }
    }
    for (const c of n.children || []) walk(c, T2, S2);
  };
  for (const r of j.scenes[0].nodes) walk(r);
  const ys = pts.map((p) => p[1]); const y0 = Math.min(...ys); const y1 = Math.max(...ys);
  const top = pts.filter((p) => p[1] > y0 + (y1 - y0) * 0.75); return top.reduce((s, p) => s + p[2], 0) / top.length;
}

test('벤치 방향: 대청마당·마당 벤치 모두 등받이가 앉은 사람 뒤 (네 계절 모델)', async () => {
  const { MeshoptDecoder } = await import(pathToFileURL(path.join(ROOT, 'node_modules/three/examples/jsm/libs/meshopt_decoder.module.js')).href);
  await MeshoptDecoder.ready;
  for (const [id, backSign] of [['prop.bench', -1], ['yard.bench', 1]]) {
    const e = REGISTRY[id]; assert.ok(e?.seasons, id);
    for (const [season, url] of Object.entries(e.seasons)) {
      const z = await backZ(path.join(ROOT, 'public', url), MeshoptDecoder); const turned = z * Math.cos(e.rotationY || 0); // (a half turn: z the other way)
      assert.equal(Math.sign(turned), backSign, `${id} ${season}: 등받이 z ${turned.toFixed(2)}`);
    }
  }
});
