'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { revisionOf } = require('./asset-manifest');

// v1.10.24 코드 해시 전달: the game's code (public JS/CSS and the Three.js vendor modules) is NOT in the resource cache;
// it rides the browser's HTTP cache under content-hash URLs. Built once when the server starts, so the hashes always
// match the files this deploy serves:
//  - the page's <script src> / <link href> get `?h=<hash>` (any old `?v=` is dropped),
//  - an import map (inline, allowed by its own CSP hash) maps every module path, and the bare name 'three', to its hash
//    URL, so modules import plain paths ('./island.js', '/vendor/three/three.module.js', 'three') and dynamic imports
//    work the same way -- no version strings in the code, no rewriting of the vendor files,
//  - a request whose `h` is the file's current hash is answered immutable for a year; anything else (no hash, an old
//    hash) is answered with the current file, `no-cache` and an ETag, so a stale URL is never cached as if current.
// The resource packs (public/assets, public/hwatu) keep their own manifest (asset-manifest.js) and are not code.
const CODE_EXT = new Set(['.js', '.css']);
const PACK_DIRS = new Set(['assets', 'hwatu']);
const IMMUTABLE = 'public, max-age=31536000, immutable';

function buildCodeManifest(publicDir, vendorFiles = {}) {
  const revs = new Map();
  for (const name of fs.readdirSync(publicDir, { recursive: true })) {
    const rel = String(name).split(path.sep).join('/');
    if (PACK_DIRS.has(rel.split('/')[0]) || !CODE_EXT.has(path.extname(rel).toLowerCase())) continue;
    const file = path.join(publicDir, name);
    if (fs.statSync(file).isFile()) revs.set(`/${rel}`, revisionOf(fs.readFileSync(file)));
  }
  for (const [url, file] of Object.entries(vendorFiles)) revs.set(url, revisionOf(fs.readFileSync(file)));
  return revs;
}

const hashedUrl = (revs, url) => (revs.has(url) ? `${url}?h=${revs.get(url)}` : url);

function importMap(revs) {
  const imports = { three: hashedUrl(revs, '/vendor/three/three.module.js') };
  for (const url of [...revs.keys()].sort()) if (url.endsWith('.js')) imports[url] = hashedUrl(revs, url);
  return JSON.stringify({ imports });
}

// The page with hashed script/stylesheet URLs and the import map before its first script; `csp` is the map's
// script-src hash source.
function prepareIndex(html, revs) {
  const page = html.replace(/(src|href)="(\/[^"?#]+\.(?:js|css))(?:\?[^"]*)?"/g, (_, attr, url) => `${attr}="${hashedUrl(revs, url)}"`);
  const map = importMap(revs);
  const at = page.indexOf('<script');
  if (at < 0) throw new Error('index.html has no <script>');
  const csp = `'sha256-${crypto.createHash('sha256').update(map).digest('base64')}'`;
  return { html: `${page.slice(0, at)}<script type="importmap">${map}</script>\n  ${page.slice(at)}`, csp, map };
}

// Cache headers for a code file request: immutable only for its current hash.
function codeCacheHeaders(revs, pathname, search) {
  const rev = revs.get(pathname);
  if (!rev) return null;
  const h = new URLSearchParams(search || '').get('h');
  return h === rev ? { 'Cache-Control': IMMUTABLE } : { 'Cache-Control': 'no-cache', ETag: `"${rev}"` };
}

module.exports = { buildCodeManifest, hashedUrl, importMap, prepareIndex, codeCacheHeaders, IMMUTABLE };
