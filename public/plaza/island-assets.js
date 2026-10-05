(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IslandAssets = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  'use strict';

  // v1.10.15 게임 아일랜드 에셋 등록부: which island targets use an external 3D model instead of their procedural one.
  // Every other target is procedural until a model is registered here (the format is in
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
  // v1.10.18 first models on the island (360 refinement v2; the files' own front is -z, origin on the ground at the
  // footprint's centre, 1 unit = 1 m). Sizes are matched to the procedural copies they replace -- a round tree about 3.5
  // tall, a bush about 1.6 wide, the plaza bench 1.7 wide -- whose place, turn and size every copy keeps.
  // v1.10.19: every model in four seasons (the island's season: asset-pipeline.js `seasonOf`), and more tree kinds --
  // tiered and blossom take the wide-crowned tree_v2, tall the upright tree_v3; pine, fruit and sapling stay procedural.
  // `near`: the full model within this of the player (thousands of triangles each). v1.10.26: farther copies show the
  // same design simplified (`low`, made by tools/assets/build-island-models.js from the same source, about a quarter of
  // the triangles), never the procedural look; rocks and the stump are light enough to stay full at every distance.
  const BASE = '/assets/island/seasonal-v2';
  const seasonal = (file) => Object.fromEntries(['spring', 'summer', 'autumn', 'winter'].map((s) => [s, `${BASE}/${s}/${file.replace(/\{s\}/g, s)}`]));
  const REGISTRY = {
    'nature.tree.round': { seasons: seasonal('nature/tree_v1_{s}.glb'), low: { seasons: seasonal('nature/tree_v1_{s}_low.glb') }, scale: 0.72, near: 35 },
    'nature.tree.tiered': { seasons: seasonal('nature/tree_v2_{s}.glb'), low: { seasons: seasonal('nature/tree_v2_{s}_low.glb') }, scale: 0.68, near: 35 },
    'nature.tree.blossom': { seasons: seasonal('nature/tree_v2_{s}.glb'), low: { seasons: seasonal('nature/tree_v2_{s}_low.glb') }, scale: 0.62, near: 35 },
    'nature.tree.tall': { seasons: seasonal('nature/tree_v3_{s}.glb'), low: { seasons: seasonal('nature/tree_v3_{s}_low.glb') }, scale: 0.8, near: 35 },
    'nature.bush': { seasons: seasonal('nature/shrub_{s}.glb'), low: { seasons: seasonal('nature/shrub_{s}_low.glb') }, scale: 0.9, near: 22, shadows: false },
    'prop.bench': { seasons: seasonal('bench_{s}_v1.glb'), scale: 0.85, rotationY: Math.PI }, // faces the fountain like the old one
    // v1.10.20 the rest of the environment set: rocks and the stump are the same in every season (common/); the gazebo
    // (the nature area's decor facility, its circle and sign unchanged) and the plaza flower beds follow the season.
    // Rocks sit 0.1 above the ground like the procedural ones did, so their models are lowered by that much.
    'nature.rock.0': { url: `${BASE}/common/rock_v1_round.glb`, scale: 1.1, offset: [0, -0.2, 0], near: 40 },
    'nature.rock.1': { url: `${BASE}/common/rock_v2_wide.glb`, scale: 0.95, offset: [0, -0.2, 0], near: 40 },
    'nature.rock.2': { url: `${BASE}/common/rock_v3_tall.glb`, scale: 0.9, offset: [0, -0.2, 0], near: 40 },
    'nature.tree.stump': { url: `${BASE}/common/stump_v1_short.glb`, scale: 1.0, near: 35 },
    'facility.chat': { seasons: seasonal('gazebo_{s}_v1.glb'), scale: 1.1, rotationY: Math.PI },
    'prop.planter': { seasons: seasonal('planter_{s}_v1.glb'), scale: 1.25 },
  };

  return { REGISTRY };
});
