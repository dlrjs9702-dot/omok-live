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

// `servable(ext)` says whether the static server has a content type for the extension; others are not assets.
function buildAssetManifest(publicDir, servable) {
  const assets = [];
  for (const dir of PACK_DIRS) {
    const root = path.join(publicDir, dir);
    if (!fs.existsSync(root)) continue;
    for (const name of fs.readdirSync(root, { recursive: true })) {
      const file = path.join(root, name);
      const ext = path.extname(file).toLowerCase();
      if (CODE_EXT.has(ext) || !servable(ext)) continue;
      let body;
      try {
        if (!fs.statSync(file).isFile()) continue;
        body = fs.readFileSync(file);
      } catch (error) {
        // A temporary asset can disappear after directory enumeration (parallel test-server startup/cleanup).
        // Omit that vanished file; permission and corruption errors still stop startup.
        if (error.code === 'ENOENT') continue;
        throw error;
      }
      const url = `/${dir}/${String(name).split(path.sep).join('/')}`;
      assets.push({ url, rev: revisionOf(body), size: body.length, group: groupOf(url) });
    }
  }
  assets.sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));
  return { version: revisionOf(assets.map(a => `${a.url} ${a.rev}`).join('\n')), required: REQUIRED_GROUPS, assets };
}

module.exports = { buildAssetManifest, revisionOf, groupOf, REQUIRED_GROUPS };
