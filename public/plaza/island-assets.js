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
  // v1.10.19: every model in four seasons (v1.10.27: each copy shows its zone's season today -- island-terrain.js seasonZoneAt / zoneSeason), and more tree kinds --
  // tiered and blossom take the wide-crowned tree_v2, tall the upright tree_v3; pine, fruit and sapling stay procedural.
  // `near`: the full model within this of the player (thousands of triangles each). v1.10.28: farther copies show the
  // same design simplified (`low`, made by tools/assets/build-island-models.js from the same source, about a quarter of
  // the triangles), never the procedural look; rocks and the stump are light enough to stay full at every distance.
  const BASE = '/assets/island/seasonal-v2';
  const seasonal = (file) => Object.fromEntries(['spring', 'summer', 'autumn', 'winter'].map((s) => [s, `${BASE}/${s}/${file.replace(/\{s\}/g, s)}`]));
  const ADD = '/assets/island/additions-v1';
  const seasonalAdd = (file) => Object.fromEntries(['spring', 'summer', 'autumn', 'winter'].map((s) => [s, `${ADD}/${s}/${file.replace(/\{s\}/g, s)}`]));
  // v1.10.29 each facility model's fit to its procedural look (plaza-scene; footprint, door and keeper stay the game's)
  const FACILITY_FIT = {
    games: { scale: 1.05, offset: [0, 0.5, 0.9] }, // on the hall's terrace (kept), its columns on the procedural colonnade's line
    climb: { scale: 1 }, shop: { scale: 1 }, avatar: { scale: 1 }, records: { scale: 1 }, admin: { scale: 1 }, townhall: { scale: 1 },
    board: { scale: 1.1 }, missions: { scale: 1.1 }, map: { scale: 1.25 }, donate: { scale: 1.1 },
    attendance: { scale: 1, offset: [0.7, 0, 0] }, // the stamp stand beside its keeper (keeper at x -0.7)
    trader: { scale: 1, offset: [0, 0, 0.1] }, naming: { scale: 1, offset: [0, 0, 0.1] }, // in front of the keeper
  };
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
    'nature.tree.stump.1': { url: `${BASE}/common/stump_v2_tall.glb`, scale: 0.85, near: 35 },
    // v1.10.29 the 2026-10-05 additions (additions-v1; same palette and rules as v2, the artist's own Low files): the
    // last tree kinds, the second bush, a flower model per colour, the islanders' houses, every facility building and
    // the lamp. Houses and facilities face -z like the others (rotationY: Math.PI) and keep the game's sign, door,
    // keeper, collision and interaction; the far level (`low`) shows past `near`.
    ...Object.fromEntries([['pine', 0.95], ['fruit', 0.95], ['sapling', 1]].map(([kind, scale]) => [`nature.tree.${kind}`, { seasons: seasonalAdd(`tree_${kind}_{s}.glb`), low: { seasons: seasonalAdd(`tree_${kind}_{s}_low.glb`) }, scale, near: 35 }])),
    'nature.bush.1': { seasons: seasonalAdd('bush_mounded_{s}.glb'), low: { seasons: seasonalAdd('bush_mounded_{s}_low.glb') }, scale: 1.05, near: 22, shadows: false },
    // flowers at every distance -- their colours make the island colourful from afar; the far file is the pipeline's
    // own simplification of the same flower (about 160-520 triangles), lighter than the artist's Low
    ...Object.fromEntries([0, 1, 2, 3, 4].map((c) => [`nature.flower.${c}`, { seasons: seasonalAdd(`flower_${c}_{s}.glb`), low: { seasons: seasonalAdd(`flower_${c}_{s}_low.glb`) }, scale: 0.75, near: 20, shadows: false }])),
    ...Object.fromEntries([0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => [`cottage.${i}`, { url: `${ADD}/houses/cottage_${i}.glb`, low: { url: `${ADD}/houses/cottage_${i}_low.glb` }, scale: 1, rotationY: Math.PI, near: 45 }])),
    ...Object.fromEntries(Object.entries(FACILITY_FIT).map(([id, fit]) => [`facility.${id}`, { url: `${ADD}/facilities/${id}.glb`, low: { url: `${ADD}/facilities/${id}_low.glb` }, rotationY: Math.PI, near: 60, ...fit }])),
    'prop.lamp': { url: `${ADD}/props/lamp.glb`, low: { url: `${ADD}/props/lamp_low.glb` }, scale: 0.85, near: 30 },
    'prop.bridge': { seasons: seasonal('bridge_{s}_v1.glb'), scale: 1.3, rotationY: -Math.PI / 2 }, // fitted to each bridge's deck (island.js BRIDGE)
    'prop.fence': { seasons: seasonal('fence_{s}_v1.glb'), scale: 0.6 }, // a cottage's yard fence, segment by segment (plaza-scene FENCE_SEG)
  };

  return { REGISTRY };
});
