'use strict';

// v1.10.15 test-only glTF 2.0 binaries, built on the fly so no model file is kept in the repository:
//   staticGlb()  one triangle mesh ("Box")
//   riggedGlb()  one triangle skinned to one joint, with clips named after `clips` (default Idle, Walk, Run)
const FLOAT = 5126; const UNSIGNED_BYTE = 5121;

function pack(parts) {
  let offset = 0; const chunks = []; const bufferViews = []; const accessors = [];
  for (const p of parts) {
    const bytes = Buffer.from(p.array.buffer, p.array.byteOffset, p.array.byteLength);
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length });
    accessors.push({ bufferView: bufferViews.length - 1, componentType: p.componentType, count: p.count, type: p.type, ...(p.min ? { min: p.min, max: p.max } : {}) });
    const padded = Buffer.concat([bytes, Buffer.alloc((4 - (bytes.length % 4)) % 4)]);
    chunks.push(padded); offset += padded.length;
  }
  return { bin: Buffer.concat(chunks), bufferViews, accessors };
}

function glb(json, bin) {
  const pad = (buf, byte) => Buffer.concat([buf, Buffer.alloc((4 - (buf.length % 4)) % 4, byte)]);
  const jsonBuf = pad(Buffer.from(JSON.stringify({ ...json, buffers: [{ byteLength: bin.length }] })), 0x20);
  const binBuf = pad(bin, 0);
  const chunk = (buf, type) => { const head = Buffer.alloc(8); head.writeUInt32LE(buf.length, 0); head.write(type, 4, 'latin1'); return Buffer.concat([head, buf]); };
  const header = Buffer.alloc(12); header.write('glTF', 0, 'latin1'); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + binBuf.length, 8);
  return Buffer.concat([header, chunk(jsonBuf, 'JSON'), chunk(binBuf, 'BIN\0')]);
}

const TRIANGLE = { array: new Float32Array([-0.5, 0, 0, 0.5, 0, 0, 0, 1.8, 0]), componentType: FLOAT, count: 3, type: 'VEC3', min: [-0.5, 0, 0], max: [0.5, 1.8, 0] };

function staticGlb() {
  const { bin, bufferViews, accessors } = pack([TRIANGLE]);
  return glb({ asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name: 'Box', mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], bufferViews, accessors }, bin);
}

function riggedGlb(clips = ['Idle', 'Walk', 'Run']) {
  const parts = [
    TRIANGLE,
    { array: new Uint8Array(12), componentType: UNSIGNED_BYTE, count: 3, type: 'VEC4' }, // JOINTS_0: all on joint 0
    { array: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]), componentType: FLOAT, count: 3, type: 'VEC4' }, // WEIGHTS_0
    { array: new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]), componentType: FLOAT, count: 1, type: 'MAT4' }, // inverse bind
    { array: new Float32Array([0, 1]), componentType: FLOAT, count: 2, type: 'SCALAR', min: [0], max: [1] }, // key times
  ];
  clips.forEach((_, i) => parts.push({ array: new Float32Array([0, 0, 0, 0, 0.1 * (i + 1), 0]), componentType: FLOAT, count: 2, type: 'VEC3' }));
  const { bin, bufferViews, accessors } = pack(parts);
  return glb({ asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }],
    nodes: [{ name: 'Character', children: [1, 2] }, { name: 'Body', mesh: 0, skin: 0 }, { name: 'Hip' }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, JOINTS_0: 1, WEIGHTS_0: 2 } }] }],
    skins: [{ joints: [2], inverseBindMatrices: 3 }],
    animations: clips.map((name, i) => ({ name, samplers: [{ input: 4, output: 5 + i, interpolation: 'LINEAR' }], channels: [{ sampler: 0, target: { node: 2, path: 'translation' } }] })),
    bufferViews, accessors }, bin);
}

module.exports = { staticGlb, riggedGlb };
