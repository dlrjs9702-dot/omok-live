(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IslandAssets = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  'use strict';

  // v1.10.15 게임 아일랜드 에셋 등록부: which island targets use an external 3D model instead of their procedural one.
  // Empty on purpose -- every target is procedural until a model is registered here (the format is in
  // public/plaza/asset-pipeline.js `entryOf`). Model files go under public/assets/island/, which puts them in the game
  // resource pack (v1.10.14 manifest, content hash, Cache Storage, rollback) without any further step.
  //
  // Target ids the scene asks for (most specific first, then the general one):
  //   facility.<id>                    a facility building (the facility ids of app.js PLAZA_FACILITIES; the gazebo is
  //                                    facility.chat). The model stands in the facility's own frame: origin on the
  //                                    ground at its centre, front (door side) toward +z. Its sign, door point,
  //                                    collision and interaction stay the game's, not the model's.
  //   cottage.<style>, cottage         an islander's house (style 0-8)
  //   character.player                 me and other players
  //   character.<facility id>, character.npc   a facility keeper (attendance, stall, desk)
  //   character.islander               the walking islanders
  //   v1.10.17 nature, placed many times (island.js; each copy keeps the procedural one's place, turn and size, which
  //   the model's own scale/rotationY/offset come on top of; near squares of the island show the model, `near` units):
  //   nature.tree.<kind>, nature.tree  kind: round, tiered, pine, tall, blossom, fruit, sapling, stump
  //   nature.bush.<0|1>, nature.bush   the two bush shapes
  //   nature.rock, nature.flower, nature.grass
  //   v1.10.17 plaza props (one model each, like a facility): prop.bench, prop.lamp, prop.planter
  // A character model faces +z, feet at the origin, about 2 units tall; its clips are named in `animations`.
  // Seasonal files: `seasons: { spring, summer, autumn, winter }` instead of (or besides) `url` -- the island's season
  // picks the file, a season without one uses `url`, and with neither the target stays procedural.
  //
  // Example (next patch):
  //   'facility.townhall': { url: '/assets/island/townhall.glb', scale: 1 },
  //   'character.player': { url: '/assets/island/player.glb', animations: { idle: 'Idle', walk: 'Walk', run: 'Run' } },
  const REGISTRY = {};

  return { REGISTRY };
});
