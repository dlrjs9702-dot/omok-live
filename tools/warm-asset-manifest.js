'use strict';
// 364 켜짐 시간: run by `npm install` (postinstall -- on Render that is the build, before the server starts): every pack file's
// size, mtime and revision into .cache/asset-manifest.json, so the server's start reads them instead of hashing ~470 MB.
// Never fails the install: any error only means the server hashes at its start, as it always did.
const path = require('node:path');
try {
  const { buildAssetManifest } = require('../lib/asset-manifest');
  const root = path.join(__dirname, '..'); const stats = {}; const t0 = Date.now();
  buildAssetManifest(path.join(root, 'public'), () => true, { cacheFile: path.join(root, '.cache', 'asset-manifest.json'), stats });
  console.log(`[warm-asset-manifest] ${stats.hashed} hashed, ${stats.reused} kept, ${Date.now() - t0} ms`);
} catch (error) {
  console.log(`[warm-asset-manifest] skipped: ${error.message}`);
}
