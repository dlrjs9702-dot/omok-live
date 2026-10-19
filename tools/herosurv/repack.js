#!/usr/bin/env node
// 두 세계 영웅전 게임센터용 빌드 (사용자 2026-10-19 빌드 수정 허락): the original Godot pack with one script added as an
// autoload (gc_patch.gd: hides the game's own name/mail join buttons and texts). Nothing of the original is changed: its
// files stay byte for byte, the new script and the project settings with one more autoload are appended, and the pack's
// directory points at them.
//   node tools/herosurv/repack.js <original index.pck> <out index.pck>
// Pack format (Godot 4.7, pack format 4): "GDPC", format, engine major/minor/patch, flags (2: offsets from the file base),
// file base (u64), directory offset (u64), reserved; the directory: count, then per file: path (u32 length, bytes padded
// to 4), offset (u64, from the file base), size (u64), md5 (16), flags (u32). project.binary: "ECFG", count, then per
// setting: key (u32 length, bytes), value (u32 length, Variant -- a String: type 4, u32 length, bytes padded to 4).
'use strict';
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');

const ORIGINAL_SHA = '132a93c0ea50dd1b7a04281aa148c257ad74ed13239ba1a5fcfc1bfaede4fed0';
const PATCH = 'res://gc_patch.gd'; const AUTOLOAD = 'autoload/GameCenterPatch';
const ALIGN = 16;
const pad4 = (n) => (4 - (n % 4)) % 4;

function readDir(buf) {
  if (buf.slice(0, 4).toString() !== 'GDPC' || buf.readUInt32LE(4) !== 4) throw new Error('not a Godot pack (format 4)');
  const base = Number(buf.readBigUInt64LE(24)); let p = Number(buf.readBigUInt64LE(32));
  const n = buf.readUInt32LE(p); p += 4; const files = [];
  for (let i = 0; i < n; i += 1) {
    const l = buf.readUInt32LE(p); p += 4; const name = buf.slice(p, p + l).toString().replace(/\0+$/, ''); p += l;
    const ofs = Number(buf.readBigUInt64LE(p)); p += 8; const size = Number(buf.readBigUInt64LE(p)); p += 8;
    const md5 = buf.slice(p, p + 16); p += 16; const flags = buf.readUInt32LE(p); p += 4;
    files.push({ name, ofs, size, md5, flags });
  }
  if (p !== buf.length) throw new Error('unexpected bytes after the directory');
  return { base, dirAt: Number(buf.readBigUInt64LE(32)), files };
}
function stringVariant(text) {
  const s = Buffer.from(text, 'utf8'); const v = Buffer.alloc(8 + s.length + pad4(s.length));
  v.writeUInt32LE(4, 0); v.writeUInt32LE(s.length, 4); s.copy(v, 8); return v;
}
function withAutoload(project) {
  if (project.slice(0, 4).toString() !== 'ECFG') throw new Error('project.binary: not ECFG');
  const n = project.readUInt32LE(4); let p = 8;
  for (let i = 0; i < n; i += 1) { const kl = project.readUInt32LE(p); const key = project.slice(p + 4, p + 4 + kl).toString(); p += 4 + kl; const vl = project.readUInt32LE(p); p += 4 + vl; if (key === AUTOLOAD) throw new Error('already patched'); }
  const key = Buffer.from(AUTOLOAD, 'utf8'); const value = stringVariant(`*${PATCH}`);
  const entry = Buffer.alloc(4 + key.length + 4 + value.length);
  entry.writeUInt32LE(key.length, 0); key.copy(entry, 4); entry.writeUInt32LE(value.length, 4 + key.length); value.copy(entry, 8 + key.length);
  const out = Buffer.concat([project, entry]); out.writeUInt32LE(n + 1, 4); return out;
}
function repack(original, patchSource) {
  const { base, dirAt, files } = readDir(original);
  const project = files.find((f) => f.name === 'project.binary'); if (!project) throw new Error('no project.binary');
  const added = [
    { name: 'project.binary', data: withAutoload(original.slice(base + project.ofs, base + project.ofs + project.size)) },
    { name: PATCH.slice('res://'.length), data: Buffer.from(patchSource, 'utf8') },
  ];
  const parts = [original.slice(0, dirAt)]; let at = dirAt;
  const table = files.filter((f) => f.name !== 'project.binary').map((f) => ({ ...f }));
  for (const a of added) {
    const gap = (ALIGN - ((at - base) % ALIGN)) % ALIGN; if (gap) { parts.push(Buffer.alloc(gap)); at += gap; }
    table.push({ name: a.name, ofs: at - base, size: a.data.length, md5: crypto.createHash('md5').update(a.data).digest(), flags: 0 });
    parts.push(a.data); at += a.data.length;
  }
  const dir = [Buffer.alloc(4)]; dir[0].writeUInt32LE(table.length, 0);
  for (const f of table) {
    const name = Buffer.from(f.name, 'utf8'); const pl = name.length + pad4(name.length); const e = Buffer.alloc(4 + pl + 8 + 8 + 16 + 4);
    e.writeUInt32LE(pl, 0); name.copy(e, 4); let q = 4 + pl; e.writeBigUInt64LE(BigInt(f.ofs), q); q += 8; e.writeBigUInt64LE(BigInt(f.size), q); q += 8; f.md5.copy(e, q); q += 16; e.writeUInt32LE(f.flags, q);
    dir.push(e);
  }
  const out = Buffer.concat([...parts, ...dir]); out.writeBigUInt64LE(BigInt(at), 32); // the directory's new place
  return out;
}

if (require.main === module) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) { console.error('usage: node tools/herosurv/repack.js <original index.pck> <out index.pck>'); process.exit(2); }
  const original = fs.readFileSync(input);
  const sha = crypto.createHash('sha256').update(original).digest('hex');
  if (sha !== ORIGINAL_SHA) { console.error(`not the original build (sha256 ${sha})`); process.exit(1); }
  const out = repack(original, fs.readFileSync(path.join(__dirname, 'gc_patch.gd'), 'utf8'));
  // self-check: the new pack reads back, every original file is where it was, the two new ones are there
  const back = readDir(out); const before = readDir(original);
  for (const f of before.files) if (f.name !== 'project.binary') { const g = back.files.find((x) => x.name === f.name); if (!g || !out.slice(back.base + g.ofs, back.base + g.ofs + g.size).equals(original.slice(before.base + f.ofs, before.base + f.ofs + f.size))) throw new Error(`moved: ${f.name}`); }
  for (const name of ['project.binary', 'gc_patch.gd']) if (!back.files.some((x) => x.name === name)) throw new Error(`missing ${name}`);
  fs.writeFileSync(output, out);
  console.log(`${output}: ${out.length} bytes, sha256 ${crypto.createHash('sha256').update(out).digest('hex')}`);
}
module.exports = { readDir, repack, withAutoload };
