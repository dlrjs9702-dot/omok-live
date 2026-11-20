'use strict';
// 385 부팅 무게 2 (총괄 2026-11-20: 「입력의 해시를 키로 결과를 파일로 미리 만들어 두고, 해시가 같으면 읽기만」): what the server's start
// worked out every time from the island's own code -- the trees, bushes, rocks and the rest (IslandTerrain.nature, ~1.5 s here, ~25 s on
// Render) and the islanders' walk grid (IslandNpcs, ~1.9 s here, ~30 s there) -- kept in .cache/boot-cache.json with the hash of every
// source it can come from (public/plaza, lib, server.js). `npm install`'s postinstall (Render's build) makes it by starting the server
// in BOOT_CACHE_ONLY mode up to the point both are made; the start then reads them when the hash is the same. A missing, old or broken
// file only means the start works them out as before -- and writes the file for the next one.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');
const FILE = process.env.BOOT_CACHE_FILE || path.join(ROOT, '.cache', 'boot-cache.json');
const VERSION = 1;

// every .js and .json under public/plaza and lib, and server.js, by name and contents (a fixed order)
function sourceHash(root = ROOT) {
  const h = crypto.createHash('sha256'); h.update(`boot-cache v${VERSION}\n`);
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      const f = path.join(dir, e.name);
      if (e.isDirectory()) walk(f);
      else if (/\.(js|json)$/.test(e.name)) { h.update(path.relative(root, f).split(path.sep).join('/')); h.update('\0'); h.update(fs.readFileSync(f)); h.update('\0'); }
    }
  };
  walk(path.join(root, 'public', 'plaza')); walk(path.join(root, 'lib'));
  h.update('server.js\0'); h.update(fs.readFileSync(path.join(root, 'server.js')));
  return h.digest('hex');
}

let hash = null;
const keyOf = () => (hash ||= sourceHash());

// -> { nature, natureBlocks, grid (Uint8Array) } when the file is this code's, else null; `why` (the [boot] line): none (no file -- the
// build's not here) | other (another code's) | broken
let why = 'off';
function read() {
  let raw; try { raw = fs.readFileSync(FILE, 'utf8'); } catch { why = 'none'; return null; }
  try {
    const doc = JSON.parse(raw);
    if (doc?.v !== VERSION || doc.key !== keyOf()) { why = 'other'; return null; }
    if (!doc.nature || typeof doc.grid !== 'string') { why = 'broken'; return null; }
    why = 'read'; return { nature: doc.nature, natureBlocks: doc.natureBlocks, grid: new Uint8Array(Buffer.from(doc.grid, 'base64')) };
  } catch { why = 'broken'; return null; }
}
const readWhy = () => why;

function write({ nature, natureBlocks, grid }, file = FILE) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ v: VERSION, key: keyOf(), natureBlocks, nature, grid: Buffer.from(grid).toString('base64') }));
    fs.renameSync(tmp, file); return true;
  } catch (error) { console.warn(`[boot-cache] not written: ${error.message}`); return false; }
}

module.exports = { FILE, VERSION, sourceHash, keyOf, read, readWhy, write };
