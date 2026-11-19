'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

// v1.10.14 game resource pack: every static game asset under these public folders, each with a revision taken from
// its content. Built once when the server starts, so code and manifest always come from the same deploy. Files stay
// plain static files (never stored in the database); the manifest holds only path, revision and size.
const PACK_DIRS = ['assets', 'hwatu'];
// v1.10.25 manifest groups: logical groups inside the one file cache (not separate caches). REQUIRED groups are
// prepared before the game starts -- the island is the space everyone lands in after login and its season changes
// within the month, so ALL of it (four seasons, common files) is required. The others are only some players' and come
// when used: the worker stores a file of theirs the first time it is asked for, and a game's room prepares its group.
// The first matching rule wins; anything else is `core` (required).
const GROUP_RULES = [
  // Complete character exteriors are large and only needed by their wearer. Keep old default URLs in this rule
  // as well, so an upgrade does not prefetch every character before someone can enter the island.
  [/^\/assets\/island\/characters\/(?:ip-characters|native)\/[^/]+\.glb$/, 'island.transformations'],
  // B 44·46·47: the town hall's room (only inside it), the December festival with its wear, and the together pack (but
  // the 우체통, the birthday corner, the museum's outside and the guide's arrow, set up with the island) come when first used
  [/^\/assets\/island\/(?:winter-v1|townhall-v3|characters\/wear-winter|together-v1\/(?!mailbox|birthday_|museum_exterior|guide_arrow))/, 'island.later'],
  // 1.10.376 N2a-2: 별마루섬's two tigers (2.8 MB with their pictures) come once someone nears that island
  [/^\/assets\/island\/byeolmaru-v1\/tiger(?:_angae)?(?:_low)?\.glb$/, 'island.later'],
  [/^\/assets\/island\//, 'island'],
  [/^\/hwatu\//, 'game.gostop'],
  [/^\/assets\/halli\//, 'game.halligalli'],
  [/^\/assets\/davinci\//, 'game.davinci'],
];
const REQUIRED_GROUPS = ['core', 'island'];
const groupOf = url => (GROUP_RULES.find(([pattern]) => pattern.test(url)) || [null, 'core'])[1];
const CODE_EXT = new Set(['.js', '.css', '.html']);

function revisionOf(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16);
}

// 364 켜짐 시간: every start read and hashed every pack file (public/ is ~470 MB; on Render's disk and CPU a large share of its
// ~80 s start). `cacheFile` keeps each file's size, mtime and revision: a file whose size and mtime match takes its kept
// revision, any other is read and hashed as before (so a cache from another checkout, or none, only costs the old time).
// tools/warm-asset-manifest.js fills it at `npm install` (Render's build); the server writes it back after building.
function readCache(cacheFile) {
  if (!cacheFile) return null;
  try { const c = JSON.parse(fs.readFileSync(cacheFile, 'utf8')); return c && c.v === 1 && c.files && typeof c.files === 'object' ? c.files : null; } catch { return null; }
}
function writeCache(cacheFile, files) {
  if (!cacheFile) return;
  try { fs.mkdirSync(path.dirname(cacheFile), { recursive: true }); const tmp = `${cacheFile}.${process.pid}.tmp`; fs.writeFileSync(tmp, JSON.stringify({ v: 1, files })); fs.renameSync(tmp, cacheFile); } catch { /* (a read-only disk: next start hashes again) */ }
}

// `servable(ext)` says whether the static server has a content type for the extension; others are not assets.
function buildAssetManifest(publicDir, servable, { cacheFile = null, stats = null } = {}) {
  const assets = []; const kept = readCache(cacheFile) || {}; const fresh = {}; let hashed = 0; let reused = 0;
  for (const dir of PACK_DIRS) {
    const root = path.join(publicDir, dir);
    if (!fs.existsSync(root)) continue;
    for (const name of fs.readdirSync(root, { recursive: true })) {
      const file = path.join(root, name);
      const ext = path.extname(file).toLowerCase();
      if (CODE_EXT.has(ext) || !servable(ext)) continue;
      const url = `/${dir}/${String(name).split(path.sep).join('/')}`;
      let rev; let size;
      try {
        const st = fs.statSync(file);
        if (!st.isFile()) continue;
        const k = kept[url];
        if (k && k.size === st.size && k.mtimeMs === st.mtimeMs && typeof k.rev === 'string') { rev = k.rev; size = st.size; reused += 1; }
        else { const body = fs.readFileSync(file); rev = revisionOf(body); size = body.length; hashed += 1; }
        fresh[url] = { size, mtimeMs: st.mtimeMs, rev };
      } catch (error) {
        // A temporary asset can disappear after directory enumeration (parallel test-server startup/cleanup).
        // Omit that vanished file; permission and corruption errors still stop startup.
        if (error.code === 'ENOENT') continue;
        throw error;
      }
      assets.push({ url, rev, size, group: groupOf(url) });
    }
  }
  if (cacheFile && hashed) writeCache(cacheFile, fresh);
  if (stats) Object.assign(stats, { hashed, reused });
  assets.sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));
  return { version: revisionOf(assets.map(a => `${a.url} ${a.rev}`).join('\n')), required: REQUIRED_GROUPS, assets };
}

module.exports = { buildAssetManifest, revisionOf, groupOf, REQUIRED_GROUPS };
