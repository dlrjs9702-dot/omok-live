'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const assets = require('../public/plaza/island-assets');

// 옷 뚫림 B (2026-10-21, gamecenter-notes docs/outfit-clipping-20261021.md): in a long skirt or robe the upper arms turn out
// a little (asset-loader, fit.skirtArms) -- seated the hands sit outside the skirt, walking a swinging hand passes it by.
test('치마 옷: 앉기·걷기에서 팔을 조금 더 벌린다 (다른 옷은 그대로)', async () => {
  const THREE = await import('three');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js');
  const parser = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder); const original = GLTFLoader.prototype.loadAsync;
  GLTFLoader.prototype.loadAsync = async function (url) { const b = fs.readFileSync(path.join(__dirname, '../public', url)); return parser.parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), ''); };
  globalThis.AssetPipeline = require('../public/plaza/asset-pipeline'); globalThis.CharacterTransformations = require('../public/plaza/character-transformations');
  let code = fs.readFileSync(path.join(__dirname, '../public/plaza/asset-loader.js'), 'utf8');
  code = code.replace(/from '(\/vendor\/three\/[^']+)'/g, (_, url) => 'from ' + JSON.stringify(pathToFileURL(url.includes('addons/') ? require.resolve('three/' + url.split('/vendor/three/')[1]) : path.join(path.dirname(require.resolve('three')), 'three.module.js')).href))
    .replace(/import \{ preparePlatformSurfaces, prepareTownhallSurfaces \} from '\.\/platform-surfaces.js';/, 'const preparePlatformSurfaces=g=>g,prepareTownhallSurfaces=g=>g;');
  const { createIslandAssets } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
  const layer = createIslandAssets({ registry: assets.REGISTRY });
  const dressed = async (look) => {
    const root = new THREE.Group(); const body = new THREE.Group(); root.add(body); new THREE.Scene().add(root); root.rotation.y = 0.7; // (turned: the spread follows the body)
    const c = { root, body, player: true }; layer.wear(c, assets.wardrobeOf(look));
    for (let n = 0; n < 300 && !c.assetRoot; n++) await new Promise((r) => setTimeout(r, 10)); assert.ok(c.assetRoot, 'model installed'); return c;
  };
  const handsApart = (c) => { c.root.updateMatrixWorld(true); const at = (n) => c.assetRoot.getObjectByName(n).getWorldPosition(new THREE.Vector3()); return at('HandL').distanceTo(at('HandR')); };
  try {
    assert.ok(assets.REGISTRY['wear.outfit_dress'].fit.skirtArms); assert.ok(!assets.REGISTRY['wear.outfit_casual'].fit?.skirtArms);
    const skirt = await dressed({ gender: 'female', outfit: 'avatar_outfit_14' }); const plain = await dressed({ gender: 'female', outfit: 'avatar_outfit_6' });
    assert.ok(skirt.wardrobe.includes('wear.outfit_dress') && plain.wardrobe.includes('wear.outfit_casual'), JSON.stringify([skirt.wardrobe, plain.wardrobe]));
    for (const [state, play, extra] of [['sitIdle', (c) => { c.anim.loop('sitIdle'); c.anim.update(0.4, 0); }, 0.05], ['walk', (c) => { c.anim.release(); for (let i = 0; i < 12; i++) c.anim.update(0.1, 1.5); }, 0.012]]) {
      play(skirt); play(plain); assert.equal(skirt.anim.clip, plain.anim.clip, state);
      assert.ok(handsApart(skirt) > handsApart(plain) + extra, `${state}: ${handsApart(skirt).toFixed(3)} vs ${handsApart(plain).toFixed(3)}`);
      skirt.anim.update(0, 0); plain.anim.update(0, 0); // (each frame starts from the clip's own pose again)
      assert.ok(handsApart(skirt) - handsApart(plain) < extra * 4, `${state}: not added frame on frame ${skirt.anim.clip} ${handsApart(skirt).toFixed(3)} vs ${handsApart(plain).toFixed(3)}`);
    }
    layer.release(skirt); layer.release(plain);
  } finally { layer.dispose(); GLTFLoader.prototype.loadAsync = original; }
});
