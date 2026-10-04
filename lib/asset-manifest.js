'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

// v1.10.14 game resource pack: every static game asset under these public folders, each with a revision taken from
// its content. Built once when the server starts, so code and manifest always come from the same deploy. Files stay
// plain static files (never stored in the database); the manifest holds only path, revision and size.
const PACK_DIRS = ['assets', 'hwatu'];
const CODE_EXT = new Set(['.js', '.css', '.html']);

function revisionOf(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16);
}

// `servable(ext)` says whether the static server has a content type for the extension; others are not assets.
function buildAssetManifest(publicDir, servable) {
  const assets = [];
  for (const dir of PACK_DIRS) {
    const root = path.join(publicDir, dir);
    if (!fs.existsSync(root)) continue;
    for (const name of fs.readdirSync(root, { recursive: true })) {
      const file = path.join(root, name);
      const ext = path.extname(file).toLowerCase();
      if (CODE_EXT.has(ext) || !servable(ext) || !fs.statSync(file).isFile()) continue;
      const body = fs.readFileSync(file);
      assets.push({ url: `/${dir}/${String(name).split(path.sep).join('/')}`, rev: revisionOf(body), size: body.length });
    }
  }
  assets.sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));
  return { version: revisionOf(assets.map(a => `${a.url} ${a.rev}`).join('\n')), assets };
}

module.exports = { buildAssetManifest, revisionOf };
