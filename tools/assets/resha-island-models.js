'use strict';
// After a deliberate edit of finished sources (옷 뚫림 2026-10-21): record their new SHA-256 in island-models.json for the
// entries whose output path contains one of the given words, keeping the file's own layout.
// Usage: node tools/assets/resha-island-models.js --src "<asset folder>" <word> [<word> ...]
const fs = require('node:fs'); const path = require('node:path'); const crypto = require('node:crypto');
const file = path.join(__dirname, 'island-models.json'); const raw = fs.readFileSync(file, 'utf8'); const config = JSON.parse(raw);
const at = process.argv.indexOf('--src'); const src = process.argv[at + 1]; const words = process.argv.slice(2).filter((w, i) => i !== at - 2 && i !== at - 1);
if (at < 0 || !src || !words.length) { console.error('usage: --src "<asset folder>" <word> ...'); process.exit(2); }
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); const first = Object.keys(config.sources)[0];
const where = (ref) => { const [name, rel] = ref.includes(':') ? ref.split(/:(.*)/s) : [first, ref]; return path.join(src, config.sources[name], rel); }; // (as build-island-models.js)
let changed = 0;
for (const f of config.files) {
  if (!words.some((w) => f.out.includes(w))) continue;
  const h = sha(where(f.src)); if (h !== f.sha256) { f.sha256 = h; changed++; }
  if (f.lowSrc) { const l = sha(where(f.lowSrc)); if (l !== f.lowSha256) { f.lowSha256 = l; changed++; } }
  console.log(f.out);
}
const nl = raw.includes('\r\n') ? '\r\n' : '\n';
fs.writeFileSync(file, (JSON.stringify(config, null, 2) + '\n').replace(/\n/g, nl)); console.log('changed', changed);
