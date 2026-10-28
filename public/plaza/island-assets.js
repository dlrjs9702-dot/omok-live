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
    // v1.10.30 the specialist shops (2026-10-05 shop candidates, built under their game ids; `avatar` is the clothes shop)
    faces: { scale: 1 }, hair: { scale: 1 }, accessories: { scale: 1 }, dye: { scale: 1, offset: [0, 0, 0.1] },
  };
  // v1.10.29 the 2026-10-05 gap assets (gaps-v1): ground layers, structure footings, yard and harbour props, the
  // seasonal falling flakes, the far scenery at sea and the whale. The ground's own seasonal colours are not files: they
  // are painted on the terrain (island.js setSeasonDay) in the palette of these sheets.
  const GAPS = '/assets/island/gaps-v1';
  const GC = '/assets/island/ground-cover-v1'; // v1.10.73
  const seasonalGaps = (file) => Object.fromEntries(['spring', 'summer', 'autumn', 'winter'].map((s) => [s, `${GAPS}/${s}/${file.replace(/\{s\}/g, s)}`]));
  const gapsProp = (name, extra = {}) => ({ url: `${GAPS}/props/${name}.glb`, low: { url: `${GAPS}/props/${name}_low.glb` }, ...extra });
  const sea = (name, scale) => ({ url: `${GAPS}/sea/${name}.glb`, low: { url: `${GAPS}/sea/${name}_low.glb` }, scale, haze: 0.55, near: 150, shadows: false });
  const REGISTRY = {
    'train.car': { url: '/assets/island/train-v1/train_carriage.glb', low: { url: '/assets/island/train-v1/train_carriage_low.glb' }, near: 45 },
    'train.platform': { url: '/assets/island/train-v1/train_platform.glb', low: { url: '/assets/island/train-v1/train_platform_low.glb' }, near: 45 },
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
    // v1.10.77: no `fruit` -- every tree that bears fruit is a harvest tree (tree.harvest); the plain fruit tree is gone
    ...Object.fromEntries([['pine', 0.95], ['sapling', 1]].map(([kind, scale]) => [`nature.tree.${kind}`, { seasons: seasonalAdd(`tree_${kind}_{s}.glb`), low: { seasons: seasonalAdd(`tree_${kind}_{s}_low.glb`) }, scale, near: 35 }])),
    'nature.bush.1': { seasons: seasonalAdd('bush_mounded_{s}.glb'), low: { seasons: seasonalAdd('bush_mounded_{s}_low.glb') }, scale: 1.05, near: 22, shadows: false },
    // flowers at every distance -- their colours make the island colourful from afar; the far file is the pipeline's
    // own simplification of the same flower (about 160-520 triangles), lighter than the artist's Low
    ...Object.fromEntries([0, 1, 2, 3, 4].map((c) => [`nature.flower.${c}`, { seasons: seasonalAdd(`flower_${c}_{s}.glb`), low: { seasons: seasonalAdd(`flower_${c}_{s}_low.glb`) }, scale: 0.75, near: 20, shadows: false }])),
    // v1.10.32 `snow`: in a winter zone the roof wears snow (asset-loader roofSnow: a snowcap laid over its own roof)
    ...Object.fromEntries([0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => [`cottage.${i}`, { url: `${ADD}/houses/cottage_${i}.glb`, low: { url: `${ADD}/houses/cottage_${i}_low.glb` }, scale: 1, rotationY: Math.PI, near: 45, snow: true }])),
    ...Object.fromEntries(Object.entries(FACILITY_FIT).map(([id, fit]) => [`facility.${id}`, { url: `${ADD}/facilities/${id}.glb`, low: { url: `${ADD}/facilities/${id}_low.glb` }, rotationY: Math.PI, near: 60, snow: true, ...fit }])),
    // v1.10.32 해안·강둑 (04 pack): the beach rocks' low clusters and the bends' bank stones (island.js, their own places)
    'nature.shoreStones': { url: `${GAPS}/props/shore_stone_cluster.glb`, low: { url: `${GAPS}/props/shore_stone_cluster_low.glb` }, scale: 0.75, near: 40 },
    'nature.riverBank': { url: `${GAPS}/props/river_bank.glb`, low: { url: `${GAPS}/props/river_bank_low.glb` }, scale: 0.6, offset: [0, -0.05, 0], near: 40 },
    ...Object.fromEntries(['flat', 'gable', 'round'].map((k) => [`struct.snowcap.${k}`, { url: `${GAPS}/structure/snowcap_${k}.glb`, shadows: false }])), // the made snowcaps (04 pack)
    'prop.lamp': { url: `${ADD}/props/lamp.glb`, low: { url: `${ADD}/props/lamp_low.glb` }, scale: 0.85, near: 30 },
    'prop.bridge': { seasons: seasonal('bridge_{s}_v1.glb'), scale: 1.3, rotationY: -Math.PI / 2 }, // fitted to each bridge's deck (island.js BRIDGE)
    'prop.fence': { seasons: seasonal('fence_{s}_v1.glb'), scale: 0.6 }, // a cottage's yard fence, segment by segment (plaza-scene FENCE_SEG)
    // ground layers in each zone's season (spring petals, summer clover, autumn leaves, winter snow), decoration only
    ...Object.fromEntries(['sparse', 'cluster', 'edge'].map((v) => [`deco.layer.${v}`, { seasons: seasonalGaps(`layer_{s}_${v}.glb`), low: { seasons: seasonalGaps(`layer_{s}_${v}_low.glb`) }, near: 25, shadows: false }])),
    'deco.foundation': { seasons: seasonalGaps('foundation_{s}.glb'), low: { seasons: seasonalGaps('foundation_{s}_low.glb') }, rotationY: Math.PI, near: 45, shadows: false }, // stones round a small building's plinth, the door side open
    'prop.mailbox.0': gapsProp('mailbox_blue', { scale: 0.92, rotationY: Math.PI, near: 30 }),
    'prop.mailbox.1': gapsProp('mailbox_red', { scale: 0.92, rotationY: Math.PI, near: 30 }),
    'prop.steppingStone': gapsProp('stepping_stone', { scale: 0.85, near: 25, shadows: false }),
    // v1.10.73 마을 환경정비사업 ① 길 3단계 (assets/24, Codex 2026-10-12): pieces laid along each walk's centre line by
    // island.js -- 마을 길 slabs, terrazzo and a continuous border, 산책로 edge bands, 오솔길 stepping stones, junction
    // discs and the planters where the town's walk meets the walks outside. 1 unit = 1 m, +x along the walk, origin on
    // the ground at the piece's centre (the files' node scale is their quantization: placed through a parent).
    // The pieces used (of the 24 made: the third slab, two terrazzi, two edge bands, the flagstones, the third stone,
    // the deck, the border cap and the pillar wait for a place -- IDEAS #future-path-tiers)
    ...Object.fromEntries(['town.slab.a', 'town.slab.b', 'town.terrazzo.a', 'town.border.straight', 'walk.edge.a', 'walk.edge.c', 'trail.step.a', 'trail.step.b',
      'junction.disc.town', 'junction.disc.walk', 'gate.planter']
      .map((id) => [`path.${id}`, { url: `/assets/island/path-tiers-v1/${id}.glb`, low: { url: `/assets/island/path-tiers-v1/${id}_low.glb` }, near: 30, shadows: false }])),
    // v1.10.73 마을 환경정비사업 ② 땅 다듬기 (assets/25): flat cover on open grass in each zone's season (spring petals,
    // summer clover, autumn leaves, winter snow), moss under the trees, and near the woods low ferns, shrubs and flower
    // clumps (a winter zone's clump is a bare shrub). island.js shows them by quality tier (1: flat, 2: + low).
    'ground.season': { seasons: { spring: `${GC}/flat.petals.a.glb`, summer: `${GC}/flat.clover.a.glb`, autumn: `${GC}/flat.leaves.a.glb`, winter: `${GC}/flat.snow.a.glb` },
      low: { seasons: { spring: `${GC}/flat.petals.a_low.glb`, summer: `${GC}/flat.clover.a_low.glb`, autumn: `${GC}/flat.leaves.a_low.glb`, winter: `${GC}/flat.snow.a_low.glb` } }, near: 25, shadows: false },
    'ground.moss': { url: `${GC}/flat.moss.a.glb`, low: { url: `${GC}/flat.moss.a_low.glb` }, near: 25, shadows: false },
    'ground.fern': { url: `${GC}/low.fern.a.glb`, low: { url: `${GC}/low.fern.a_low.glb` }, near: 25, shadows: false },
    'ground.shrub': { url: `${GC}/low.shrub.a.glb`, low: { url: `${GC}/low.shrub.a_low.glb` }, near: 25, shadows: false },
    'ground.flowers': { seasons: { spring: `${GC}/low.flowers.a.glb`, summer: `${GC}/low.flowers.a.glb`, autumn: `${GC}/low.flowers.a.glb`, winter: `${GC}/low.shrub.b.glb` },
      low: { seasons: { spring: `${GC}/low.flowers.a_low.glb`, summer: `${GC}/low.flowers.a_low.glb`, autumn: `${GC}/low.flowers.a_low.glb`, winter: `${GC}/low.shrub.b_low.glb` } }, near: 25, shadows: false },
    'prop.pierDeck': gapsProp('pier_deck', { near: 45 }), 'prop.pierPost': gapsProp('pier_post', { near: 45 }), // fitted to the pier (island.js)
    'fx.petal': { url: `${GAPS}/props/atmosphere_petal.glb` }, 'fx.leaf': { url: `${GAPS}/props/atmosphere_leaf.glb` }, 'fx.snow': { url: `${GAPS}/props/atmosphere_snowflake.glb` },
    'sea.coastLong': sea('distant_coast_long', 3), 'sea.coastCove': sea('distant_coast_cove', 3), 'sea.ridgeSoft': sea('mountain_ridge_soft', 2.2), 'sea.ridgeRugged': sea('mountain_ridge_rugged', 2.2),
    'sea.peak': sea('mountain_peak', 2.2), 'sea.glacier': sea('glacier', 2.5), 'sea.floe': sea('ice_floe', 2.5),
    // v1.10.32 해상 볼거리 (2026-10-06 finish pack: made with the skins pack's generator): a small boat, a gull, a dolphin
    'sea.boat': { url: '/assets/island/finish-v1/sea/boat.glb', low: { url: '/assets/island/finish-v1/sea/boat_low.glb' }, near: 90, shadows: false },
    'sea.gull': { url: '/assets/island/finish-v1/sea/gull.glb', shadows: false },
    'sea.dolphin': { url: '/assets/island/finish-v1/sea/dolphin.glb', low: { url: '/assets/island/finish-v1/sea/dolphin_low.glb' }, near: 40, shadows: false },
    'sea.whale': { url: `${GAPS}/sea/whale.glb`, scale: 1.2 }, 'sea.splash': { url: `${GAPS}/sea/splash.glb`, scale: 1.4 }, // played once (BreachOnce / SplashOnce)
  };

  // v1.10.30 공통 캐릭터 (2026-10-05 character + skins packs): one body (`character.base`, High and Low) with the
  // common 20-joint rig, the motions as clip files, and the wardrobe -- face, hair, top, bottom, shoes, hats -- as
  // parts rebound to that body's own skeleton (asset-loader `wear`). `wardrobeOf(look, role)` says which parts a
  // character wears: the base of its gender, the avatar items it wears that have a part, its face (성형) and the
  // colour of each dyed item (염색, the part's dye material only). A player wearing an item that has no part yet keeps
  // the procedural character (WARDROBE null): nobody's item is swapped for something else.
  const CH = '/assets/island/characters';
  const MOTIONS = ['FurnGrab', 'FurnPush', 'FurnPull', 'FurnTurn', 'BikeRide', 'BikeIdle', 'Idle', 'Walk', 'Run', 'Wave', 'Interact', 'Cheer', 'GatherWeed', 'Pickup', 'Give', 'Receive', 'PhotoPose', 'CarryIdle', 'SitDown', 'SitIdle', 'StandUp', 'GuardIdle', 'Bow', 'Usher', 'FishCast', 'FishWait', 'FishReel', 'FishCatch', 'FishBite', 'FishMiss', 'RideLookAround', 'Nod', 'Clap', 'PickFruit',
    'SlowWalk', 'IdleLookAround', 'NoticeNeighbor', 'GreetingSmall', // v1.10.79 assets 36
    'NetSwing', 'HitReact', 'Angry']; // (3회차 22, assets 66: the net swung; an islander struck by it)
  // v1.10.79 3인칭 동작·어깨 정비 (assets 36): the motions hold the arms where they belong (no runtime arm tuck any more);
  // the shoulders' skin weights were repaired on the bare body and on 운동복·후드 together with a body made for each
  // (`body`: worn with that outfit, `bare`: worn with no clothes) -- every other outfit keeps the original body.
  REGISTRY['character.base'] = { url: `${CH}/body_core.glb`, low: { url: `${CH}/body_core_low.glb` }, near: 22, rotationY: Math.PI,
    bare: { url: `${CH}/body_bare.glb`, lowUrl: `${CH}/body_bare_low.glb` },
    clips: Object.fromEntries(MOTIONS.map((clip) => [clip, `${CH}/motions/${clip}.glb`])),
    animations: { furnGrab: 'FurnGrab', furnPush: 'FurnPush', furnPull: 'FurnPull', furnTurn: 'FurnTurn', idle: 'Idle', walk: 'Walk', run: 'Run', wave: 'Wave', interact: 'Interact', cheer: 'Cheer', gather: 'GatherWeed', pickup: 'Pickup', give: 'Give', receive: 'Receive', photo: 'PhotoPose', carry: 'CarryIdle', sitDown: 'SitDown', sitIdle: 'SitIdle', bikeRide: 'BikeRide', bikeIdle: 'BikeIdle', rideLook: 'RideLookAround', standUp: 'StandUp', guard: 'GuardIdle', bow: 'Bow', usher: 'Usher', fishCast: 'FishCast', fishWait: 'FishWait', fishReel: 'FishReel', fishCatch: 'FishCatch', fishBite: 'FishBite', fishMiss: 'FishMiss', slow: 'SlowWalk', look: 'IdleLookAround', notice: 'NoticeNeighbor', greet: 'GreetingSmall', netSwing: 'NetSwing', hitReact: 'HitReact', angry: 'Angry' },
    speeds: { slow: 1, walk: 4.2, run: 6.2 }, rates: { slow: 1, walk: 1, run: 1 } }; // the ground speed each loop was made for, and its playback rate there (걸음 3판 2026-10-20 사용자 「추천대로」: made for 1, 4.2 and 6.2 m/s -- 2, 2.5 and 4 steps a second, the feet gliding a little as in 동물의 숲)
  // v1.10.32: every part says its `fit` (asset-pipeline fitWardrobe): its slot, what of the base it replaces, a hat's
  // `cover` (the line above which the hair is under its crown, where the crown is wider than the hair) and a part's own
  // pieces that give way to a worn slot (`hideWith`)
  const part = (file, slot, { low = true, dye = null, ...fit } = {}) => ({ url: `${CH}/wear/${file}.glb`, ...(low ? { low: { url: `${CH}/wear/${file}_low.glb` } } : {}), ...(dye ? { dye } : {}), fit: { slot, ...fit } });
  Object.assign(REGISTRY, {
    'wear.face_eyes_cheeks': part('face_eyes_cheeks', 'face', { low: false }), 'wear.hair_cap': part('hair_cap', 'hair', { low: false }), 'wear.hair_long': part('hair_long', 'hair', { low: false }),
    'wear.basic_shirt': part('basic_shirt', 'top'), 'wear.female_shirt': part('female_shirt', 'top'), // (F1: their Low files too)
    'wear.basic_pants': part('basic_pants', 'bottom'), 'wear.short_skirt': part('short_skirt', 'bottom'), 'wear.shoes': part('shoes', 'shoes', { low: false }),
    'wear.overalls': part('overalls', 'outfit', { dye: 'overalls' }), 'wear.cat_ears': part('cat_ears', 'hat', { low: false, dye: 'hair' }),
  });
  // hair (05 skins pack, and the two older looks remade on the common rig: 무지개 머리 in its five colours, 별빛 머리)
  for (const file of ['hair_twin_tail', 'hair_curly', 'hair_ponytail', 'hair_spiky', 'hair_crew', 'hair_side_part', 'hair_bob', 'hair_straight', 'hair_bun', 'hair_braid']) REGISTRY[`wear.${file}`] = part(file, 'hair', { dye: 'hair' });
  for (const file of ['hair_rainbow', 'hair_starlight']) REGISTRY[`wear.${file}`] = part(file, 'hair');
  // outfits: the whole set of clothes (the 05 outfits with the pelvis filled in, the older four remade)
  for (const file of ['casual', 'hoodie', 'sailor', 'apron', 'explorer', 'raincoat', 'knight', 'robe', 'dress', 'sports', 'stripes', 'hanbok', 'space']) REGISTRY[`wear.outfit_${file}`] = part(`outfit_${file}`, 'outfit', { dye: file === 'hanbok' ? ['main', 'chima'] : 'main', replaces: ['top', 'bottom'] });
  for (const file of ['sports', 'hoodie']) REGISTRY[`wear.outfit_${file}`].body = { url: `${CH}/body_${file}.glb`, lowUrl: `${CH}/body_${file}_low.glb` }; // v1.10.79 the body made for it
  REGISTRY['wear.outfit_royal'] = part('outfit_royal', 'outfit', { dye: 'main', replaces: ['top', 'bottom'], hideWith: { cape: ['cape_main', 'cape_trim'] } }); // its cape gives way to a worn one
  // v1.10.40 모자 쓰는 깊이: `seat` [sink, widen] -- the made hats sat on top of the head (their rim at the crown of it,
  // about 2.0, their crown narrower than the head); these come down to about the forehead line, as much wider as the
  // head needs to stay inside (measured from the 05 pack against body_core). Beanie, cap and flower already sat low.
  const SEAT = { straw: [0.12, 1.15], fedora: [0.12, 1.15], wizard: [0.12, 1.18], crown: [0.12, 1.05], bunny: [0.08, 1], beret: [0, 1.05] };
  for (const [file, dye, cover] of [['straw', 'trim', 2.04], ['flower', 'main', null], ['crown', 'accent', null], ['fedora', 'main', 2.04], ['beanie', 'main', 1.87], ['beret', 'main', 2.0],
    ['cap', 'main', 1.86], ['wizard', 'main', 2.04], ['bunny', 'trim', null], ['headphones', 'main', null]]) REGISTRY[`wear.hat_${file}`] = part(`hat_${file}`, 'hat', { dye, ...(cover ? { cover } : {}), ...(SEAT[file] ? { sink: SEAT[file][0], widen: SEAT[file][1] } : {}) });
  REGISTRY['wear.hat_halo'] = part('hat_halo', 'hat');
  REGISTRY['wear.outfit_suit'] = part('outfit_suit', 'outfit', { replaces: ['top', 'bottom'] }); // v1.10.41 the mayor's suit (NPC only)
  for (const file of ['short', 'long', 'hooded', 'split', 'scallop', 'leaf', 'royal', 'star', 'wing', 'poncho']) REGISTRY[`wear.cape_${file}`] = part(`cape_${file}`, 'cape', { dye: file === 'wing' ? 'trim' : 'main' });
  for (const [file, dye] of [['cat', 'main'], ['fox', 'main'], ['bunny', 'trim'], ['raccoon', 'main'], ['squirrel', 'main'], ['dragon', 'main'], ['lion', 'main'], ['dog', 'main'], ['devil', 'main'], ['ribbon', 'rose']]) REGISTRY[`wear.tail_${file}`] = part(`tail_${file}`, 'tail', { dye });
  for (const file of ['sneakers', 'boots', 'rain', 'sandals', 'loafers', 'ribbon', 'hiking', 'armor', 'fur', 'slippers']) REGISTRY[`wear.shoes_${file}`] = part(`shoes_${file}`, 'shoes', { dye: 'main', replaces: ['shoes'] });
  for (const [file, dye] of [['coin', 'accent'], ['star', 'accent'], ['heart', 'accent'], ['moon', 'accent'], ['gem', 'rose'], ['leaf', 'main'], ['shell', 'trim'], ['key', 'accent'], ['bell', 'accent'], ['lock', 'accent']]) REGISTRY[`wear.necklace_${file}`] = part(`necklace_${file}`, 'necklace', { dye });
  // v1.10.36 할로윈 (2026-10-06 Halloween pack): the same rig and fitting; each its own dye material (outfits never dyed)
  const HW = { hair: ['pumpkin_bob', 'moon_buns', 'witch_waves', 'vampire_sweep', 'ghost_curls'], outfit: ['pumpkin', 'witch', 'vampire', 'mummy', 'ghost'],
    hat: ['witch', 'pumpkin', 'bat', 'mummy', 'ghost'], cape: ['bat', 'moon', 'ghost'], tail: ['devil', 'wisp', 'vine'], shoes: ['witch', 'mummy', 'pumpkin'], necklace: ['pumpkin', 'bat', 'moon_key'] };
  const HW_FIT = { 'hair': { dye: 'hair' }, 'outfit': { dye: 'main', replaces: ['top', 'bottom'] }, 'hat_witch': { dye: 'main', cover: 2.04, sink: 0.12, widen: 1.18 }, 'hat_pumpkin': { dye: 'accent', cover: 1.98 }, 'hat_bat': { dye: 'main' },
    'hat_mummy': { dye: 'trim', cover: 1.87 }, 'hat_ghost': { dye: 'main', cover: 2.03 }, 'cape': { dye: 'main' }, 'tail_devil': { dye: 'rose' }, 'tail_wisp': { dye: 'main' }, 'tail_vine': { dye: 'leaf' },
    'shoes': { dye: 'main', replaces: ['shoes'] }, 'necklace_pumpkin': { dye: 'accent' }, 'necklace_bat': { dye: 'trim' }, 'necklace_moon_key': { dye: 'accent' } };
  for (const [slot, designs] of Object.entries(HW)) for (const d of designs) REGISTRY[`wear.${slot}_hw_${d}`] = part(`${slot}_hw_${d}`, slot, HW_FIT[`${slot}_${d}`] || HW_FIT[slot]);
  for (const [face, designs] of Object.entries({ eyes: ['oval', 'dot', 'wide', 'sleepy', 'smile', 'wink', 'almond', 'sparkle', 'heart', 'bold'], nose: ['button', 'tiny', 'round', 'triangle', 'bean', 'bridge', 'upturned', 'soft_square', 'animal', 'freckles'], mouth: ['smile', 'wide_smile', 'straight', 'open', 'cheer', 'cat', 'pout', 'tooth', 'tongue', 'dimples'] })) {
    for (const d of designs) REGISTRY[`wear.${face}_${d}`] = part(`${face}_${d}`, 'face');
  }
  // the avatar items (lib/skins.js, ids by position) -> the part that draws each; every item has one (v1.10.32)
  const items = (slot, files) => Object.fromEntries(files.map((file, i) => [`avatar_${slot}_${i + 1}`, `wear.${file}`]));
  const WARDROBE = {
    ...items('hair', ['hair_twin_tail', 'hair_curly', 'hair_ponytail', 'hair_spiky', 'hair_rainbow', 'hair_starlight', 'hair_crew', 'hair_side_part', 'hair_bob', 'hair_straight', 'hair_bun', 'hair_braid']),
    ...items('outfit', ['overalls', 'outfit_stripes', 'outfit_hanbok', 'outfit_space', 'outfit_royal', 'outfit_casual', 'outfit_hoodie', 'outfit_sailor', 'outfit_apron', 'outfit_explorer', 'outfit_raincoat',
      'outfit_knight', 'outfit_robe', 'outfit_dress', 'outfit_sports']),
    ...items('hat', ['hat_straw', 'cat_ears', 'hat_flower', 'hat_crown', 'hat_halo', 'hat_beanie', 'hat_beret', 'hat_cap', 'hat_fedora', 'hat_wizard', 'hat_bunny', 'hat_headphones']),
    ...items('cape', ['short', 'long', 'hooded', 'split', 'scallop', 'leaf', 'royal', 'star', 'wing', 'poncho'].map((d) => `cape_${d}`)),
    ...items('tail', ['cat', 'fox', 'bunny', 'raccoon', 'squirrel', 'dragon', 'lion', 'dog', 'devil', 'ribbon'].map((d) => `tail_${d}`)),
    ...items('shoes', ['sneakers', 'boots', 'rain', 'sandals', 'loafers', 'ribbon', 'hiking', 'armor', 'fur', 'slippers'].map((d) => `shoes_${d}`)),
    ...items('necklace', ['coin', 'star', 'heart', 'moon', 'gem', 'leaf', 'shell', 'key', 'bell', 'lock'].map((d) => `necklace_${d}`)),
  };
  // v1.10.36 할로윈: after each slot's items, in lib/skins.js HALLOWEEN_ITEMS order
  const counts = {};
  for (const id of Object.keys(WARDROBE)) { const slot = id.split('_')[1]; counts[slot] = Math.max(counts[slot] || 0, Number(id.split('_')[2])); }
  for (const [slot, designs] of Object.entries(HW)) designs.forEach((d, i) => { WARDROBE[`avatar_${slot}_${counts[slot] + i + 1}`] = `wear.${slot}_hw_${d}`; });
  WARDROBE.npc_outfit_suit = 'wear.outfit_suit'; // v1.10.41: the mayor's own (not an avatar item)
  const LOOK_SLOTS = ['hair', 'outfit', 'hat', 'cape', 'tail', 'shoes', 'necklace'];
  // look: { gender, hair, outfit, hat, cape, tail, shoes, necklace, face: { eyes, nose, mouth }, dye: { itemId: '#rrggbb' } };
  // tint: { materialName: colour } (keepers and islanders wear their own colours). -> { parts, colors, tint } | null
  const SKIN = '#ffe0c4';
  function wardrobeOf(look = {}, { tint = null, hat = null } = {}) {
    const female = look.gender === 'female';
    const parts = { face: 'wear.face_eyes_cheeks', hair: female ? 'wear.hair_long' : 'wear.hair_cap', top: female ? 'wear.female_shirt' : 'wear.basic_shirt',
      bottom: female ? 'wear.short_skirt' : 'wear.basic_pants', shoes: 'wear.shoes' };
    const colors = {}; // part id -> { material: colour }
    for (const slot of LOOK_SLOTS) {
      const item = look[slot]; if (!item) continue;
      if (!Object.prototype.hasOwnProperty.call(WARDROBE, item) || !REGISTRY[WARDROBE[item]]) return null; // no part for it: the procedural character
      const id = WARDROBE[item];
      for (const replaced of REGISTRY[id].fit?.replaces || []) delete parts[replaced];
      parts[slot] = id;
      const dye = look.dye?.[item]; if (dye && REGISTRY[id].dye) colors[id] = Object.fromEntries([].concat(REGISTRY[id].dye).map((name) => [name, dye]));
    }
    if (hat && !parts.hat) { parts.hat = 'wear.hat_fedora'; colors['wear.hat_fedora'] = { main: hat }; } // a keeper's hat
    for (const face of ['eyes', 'nose', 'mouth']) { const d = look.face?.[face]; if (d && REGISTRY[`wear.${face}_${d}`]) { parts[face] = `wear.${face}_${d}`; if (face === 'eyes') delete parts.face; } }
    // v1.10.35 염색 (머리·눈·피부): the base hair when no hair item is worn, the drawn colour of whichever eyes are on
    // (each design names it its own way), and the skin everywhere it shows
    if (look.hairColor && (parts.hair === 'wear.hair_cap' || parts.hair === 'wear.hair_long')) colors[parts.hair] = { hair: look.hairColor };
    const eyes = parts.eyes || parts.face;
    if (look.eyeColor && eyes) colors[eyes] = { ...colors[eyes], eyes: look.eyeColor, ink: look.eyeColor, rose: look.eyeColor, accent: look.eyeColor };
    // v1.10.86 체납자 (사용자 2026-10-17): the server puts the 줄무늬 outfit on, here in white with black stripes
    if (look.prisoner && parts.outfit === 'wear.outfit_stripes') colors['wear.outfit_stripes'] = { main: '#f4f4f4', stripe: '#161616', trim: '#d9d9d9' };
    // the island's own warm skin (the procedural characters'): the part's paler skin read olive under the island's light
    const transformation = look.prisoner ? null : TRANSFORMATIONS?.match(look);
    return { parts: Object.values(parts), colors, tint: { skin: look.skinColor || SKIN, ...(tint || {}) },
      ...(transformation ? { transformation: `character.transform.${transformation.id}.${TRANSFORMATIONS.modeOf(transformation, look)}` } : {}) };
  }

  // v1.10.36 10월 할로윈: the plaza's landmark in the fountain's place (pedestal, and the jack-o'-lantern on it at 1.05)
  const HWL = '/assets/island/halloween-v1';
  // v1.10.41 관공서 확장 (Codex 16 시장·관공서 v2): the marble town hall (front +Z, its 15 x 10 body on the 16.2 x 12.6
  // terrace), the yard's wall pieces (a 2 m panel from its left end along +x, posts, corners, the gate's pillars), planters
  // and the grand lamps; the mayor's suit (NPC only, never sold)
  const TH2 = '/assets/island/townhall-v2';
  const th2 = (file, extra = {}) => ({ url: `${TH2}/${file}.glb`, low: { url: `${TH2}/${file}_low.glb` }, ...extra });
  REGISTRY['facility.townhall'] = th2('townhall_marble', { near: 90, snow: true });
  Object.assign(REGISTRY, { 'townhall.wall': th2('marble_wall_2m', { near: 40 }), 'townhall.post': th2('marble_wall_post', { near: 40 }), 'townhall.corner': th2('marble_wall_corner', { near: 40 }),
    'townhall.gatePillar': th2('marble_gate_pillar', { near: 50 }), 'townhall.planter': th2('marble_planter', { near: 40 }), 'townhall.lampA': th2('lamp_grand_a', { near: 50 }), 'townhall.lampB': th2('lamp_grand_b', { near: 50 }) });
  // v1.10.42 낚시 (Codex 12): the rod (its tip at FISH_TIP in its own space, the line drawn by the game), the bobber
  // (the water line at y 0) and the eight fish (centred on their grip), held in the right hand
  const FISH = '/assets/island/fishing-v1';
  const fishFile = (file, extra = {}) => ({ url: `${FISH}/${file}.glb`, low: { url: `${FISH}/${file}_low.glb` }, shadows: false, ...extra });
  REGISTRY['fishing.rod'] = fishFile('quest_fishing_rod'); REGISTRY['fishing.bobber'] = fishFile('bobber');
  for (const s of ['anchovy', 'mackerel', 'goby', 'cutlassfish', 'pufferfish', 'octopus', 'stingray', 'giant_tuna']) REGISTRY[`fish.${s}`] = fishFile(`fish_${s}`);
  // v1.10.90 낚시 도감 21종 (assets 40): eight river fish and five sea fish, held the same way as the first eight
  for (const s of ['crucian_carp', 'carp', 'pale_chub', 'sweetfish', 'catfish', 'mandarin_fish', 'eel', 'smelt', 'mullet', 'flatfish', 'sea_bass', 'gizzard_shad', 'rockfish']) REGISTRY[`fish.${s}`] = fishFile(`fish_${s}`);
  REGISTRY['landmark.halloween.pedestal'] = { url: `${HWL}/pedestal.glb`, low: { url: `${HWL}/pedestal_low.glb` }, near: 70 };
  REGISTRY['landmark.halloween.lantern'] = { url: `${HWL}/jack_o_lantern.glb`, low: { url: `${HWL}/jack_o_lantern_low.glb` }, near: 70 };
  // v1.10.39 섬 전체 할로윈 꾸미기 (Codex decor pack 2026-10-07): the batches of island-halloween.js, at their stand-ins'
  // matrices (strings: left hook at the origin, 4 m along +x), the bat a looping Flap
  const HWD = '/assets/island/halloween-decor-v1';
  const hwd = (file, extra = {}) => ({ url: `${HWD}/${file}.glb`, low: { url: `${HWD}/${file}_low.glb` }, near: 35, ...extra });
  Object.assign(REGISTRY, {
    'halloween.pumpkinA': hwd('pumpkin_small_a', { scale: 1.45 }), 'halloween.pumpkinB': hwd('pumpkin_small_b', { scale: 1.45 }),
    'halloween.stack': hwd('pumpkin_stack', { scale: 1.2 }), 'halloween.hay': hwd('hay_bale'), 'halloween.scarecrow': hwd('scarecrow'),
    'halloween.cauldron': hwd('cauldron'), 'halloween.broom': hwd('broom_hay'),
    'halloween.bunting': hwd('bunting', { shadows: false }), 'halloween.lights': hwd('string_lights', { shadows: false }),
    'halloween.bat': hwd('bat', { scale: 1.3, shadows: false, near: 60 }),
    'halloween.candyBag': hwd('candy_bag', { scale: 1.3 }), 'halloween.candyBasket': hwd('candy_basket'),
  });

  // v1.10.31 잡초 채집·생활 소품: the weed (a light model that stands apart from the grass, the same in every season)
  // and the one pulled out with its roots (in the hand a moment); the finds of the island events as the 2026-10-05
  // interaction props (their kinds, rules and rewards unchanged -- only their look)
  REGISTRY['nature.grass'] = { url: '/assets/island/additions-v1/common/weed_standing.glb', near: 18, shadows: false };
  REGISTRY['prop.weedRooted'] = { url: '/assets/island/additions-v1/common/weed_rooted.glb', shadows: false };
  const prop = (name, extra = {}) => ({ url: `${CH}/props/${name}.glb`, shadows: false, ...extra });
  Object.assign(REGISTRY, {
    'prop.event.trash_can': prop('trash_can'), 'prop.event.trash_bottle': prop('trash_bottle'),
    'prop.event.paper_litter': { url: '/assets/island/gaps-v1/props/paper_litter.glb', low: { url: '/assets/island/gaps-v1/props/paper_litter_low.glb' }, shadows: false, near: 40 },
    'prop.event.herb': prop('herb'), 'prop.event.berry': prop('berries'), 'prop.event.mushroom': prop('mushrooms'),
    'prop.event.coin': prop('coin'), 'prop.event.wallet': prop('wallet'), 'prop.event.lost_item': prop('lost_teddy'), 'prop.event.camera': prop('camera'),
    // v1.10.32 생활 소품: a lost thing is a teddy or a pouch, a berry find a bush or fruit on the grass (each event's own,
    // the same everywhere), and a gatherer's basket in the hand while picking (the same events, rules and rewards)
    'prop.event.lost_pouch': { url: '/assets/island/gaps-v1/props/lost_pouch.glb', low: { url: '/assets/island/gaps-v1/props/lost_pouch_low.glb' }, shadows: false, near: 40 },
    'prop.event.fruit': { url: '/assets/island/gaps-v1/props/fruit_pickup.glb', low: { url: '/assets/island/gaps-v1/props/fruit_pickup_low.glb' }, shadows: false, near: 40 },
    'prop.event.basket': prop('collection_basket'),
  });

  // (변신 옷 정리 2026-10-21: the animal and character parts that came with the transformations are gone -- lib/skins.js
  // RETIRED_PART_IDS; the transformations themselves stay, below)
  // v1.10.74 스킨 2배 (Codex 27, plaza/skins-x2.js): the same rig and fitting; each part's own `primary` dye material
  // (only the original designs are dyeable, lib/skins.js DYEABLE)
  const X2 = typeof module === 'object' && module.exports ? require('./skins-x2.js') : globalThis.SkinsX2;
  const TRANSFORMATIONS = typeof module === 'object' && module.exports ? require('./character-transformations.js') : globalThis.CharacterTransformations;
  for (const c of TRANSFORMATIONS?.characters || []) {
    for (const [mode, variant] of Object.entries(c.variants)) REGISTRY[`character.transform.${c.id}.${mode}`] = {
      url: variant.url, low: { url: variant.lowUrl }, near: 22, rotationY: Math.PI,
      nativeRig: variant.rig, character: c.id, transformationMode: mode,
    };
    REGISTRY[`character.transform.${c.id}`] = REGISTRY[`character.transform.${c.id}.${c.defaultVariant}`];
  }
  const X2_FIT = (slot) => (slot === 'outfit' ? { dye: 'primary', replaces: ['top', 'bottom'] } : slot === 'hat' ? { dye: 'primary', cover: 1.95 } : slot === 'shoes' ? { dye: 'primary', replaces: ['shoes'] } : slot === 'necklace' ? {} : { dye: 'primary' });
  for (const [slot, items] of Object.entries(X2?.X2_ITEMS || {})) for (const [, , file] of items) {
    REGISTRY[`wear.x2_${slot}_${file}`] = part(`x2_${slot}_${file}`, slot, X2_FIT(slot)); WARDROBE[`avatar_x2_${slot}_${file}`] = `wear.x2_${slot}_${file}`;
  }
  // 옷 뚫림 B (2026-10-21): the long skirts and robes -- their wearers' arms turn out a little (asset-loader skirtArms)
  for (const id of ['wear.outfit_dress', 'wear.outfit_hw_ghost', 'wear.outfit_hw_witch', 'wear.outfit_robe', 'wear.outfit_raincoat', ...['kite_festival', 'rain_gauge', 'noodle_chef', 'bamboo_weaver', 'moon_courier', 'reef_chemist', 'solstice_coat', 'tea_master'].map((f) => `wear.x2_outfit_${f}`)]) if (REGISTRY[id]) REGISTRY[id].fit = { ...REGISTRY[id].fit, skirtArms: true };
  // B 46 겨울 축제 의상: on the common rig like the others; the 산타 옷 wears its own body under it (as 포차코's outfit)
  for (const [slot, , , file] of X2?.WINTER_ITEMS || []) {
    const { dye, ...fit } = X2_FIT(slot); const key = file.slice(5);
    REGISTRY[`wear.winter_${key}`] = { url: `${CH}/wear-winter/${file}.glb`, low: { url: `${CH}/wear-winter/${file}_low.glb` }, fit: { slot, ...fit } }; WARDROBE[`avatar_winter_${key}`] = `wear.winter_${key}`;
  }
  if (REGISTRY['wear.winter_hat_earmuffs']) delete REGISTRY['wear.winter_hat_earmuffs'].fit.cover; // (X1: an open band -- the hair stays, bun and all, assets 77)
  if (REGISTRY['wear.winter_outfit_santa']) REGISTRY['wear.winter_outfit_santa'].body ={ url: `${CH}/wear-winter/body_winter_fitted.glb`, lowUrl: `${CH}/wear-winter/body_winter_fitted_low.glb` };
  // v1.10.91 변신 의상실 (assets 42): the booth with its mirror, and its keeper (the common rig)
  REGISTRY['character.transformer'] = { url: `${CH}/npc_transformer.glb`, low: { url: `${CH}/npc_transformer_low.glb` }, rotationY: Math.PI, motions: true };
  Object.assign(REGISTRY['character.base'].animations, { nod: 'Nod', clap: 'Clap', pickFruit: 'PickFruit' });
  // v1.10.93 마을 주민·결과 소품 (assets 39, IDEAS #future-island-minigames): seven residents on the common rig (moved by the
  // common motions) and what their weeks of help change on the island -- the mural in four stages, the easel, the busking
  // stage and the guitar (Hand.R), the lamps, the stepping stones, the tables
  for (const n of ['painter', 'stationmaster', 'busker', 'electrician', 'builder', 'librarian', 'gazebo_grandpa']) REGISTRY[`character.${n}`] = { url: `${CH}/npc_${n}.glb`, low: { url: `${CH}/npc_${n}_low.glb` }, rotationY: Math.PI, motions: true };
  // F3 배회 주민 10명 고유 외형 (assets 51 v2, 2026-10-24): each walking islander their own model on the common rig (island-cast
  // WALKERS order), made at the body's own size (`baked`); 가람 the stone child at 0.75. headTop: the top of ears or hat in
  // game metres (the speech bubble over it); lean: the upper body forward, degrees (the README's -- drawn only)
  const WALKER_LOOKS = Object.freeze([['bomi', 2.75, 0], ['sea_grandpa', 2.18, 5], ['haram', 2.16, 1], ['duri', 2.25, 2], ['noeul_granny', 2.08, 8], ['detective_oh', 2.31, 2], ['daon', 2.54, 1], ['barami', 2.2, 3], ['isol', 2.17, 2], ['garam', 1.65, 1]]
    .map(([id, headTop, lean]) => Object.freeze({ id, headTop, lean, model: `character.walker.${id}` })));
  for (const w of WALKER_LOOKS) REGISTRY[w.model] = { url: `${CH}/npc_walker_${w.id}.glb`, low: { url: `${CH}/npc_walker_${w.id}_low.glb` }, rotationY: Math.PI, motions: true, baked: true, ...(w.id === 'garam' ? { scale: 0.75 } : {}) };
  const village = (file, extra = {}) => ({ url: `/assets/island/village-v1/${file}.glb`, low: { url: `/assets/island/village-v1/${file}_low.glb` }, near: 50, ...extra });
  for (const s of [0, 1, 2, 3]) { REGISTRY[`village.mural.${s}`] = village(`mural_stage${s}`); REGISTRY[`village.stepstones.${s}`] = village(`stepstones_stage${s}`); }
  for (const p of ['easel', 'busk_stage', 'lamp_broken', 'lamp_fixed', 'toolbox', 'bookcart', 'table_omok', 'table_cards']) REGISTRY[`village.${p}`] = village(p);
  REGISTRY['village.guitar'] = village('guitar', { shadows: false });
  for (const p of ['lamp_broken', 'lamp_fixed']) REGISTRY[`village.${p}`].scale = 0.85; // (the island lamp's own size, prop.lamp)
  // B 44 민원실 넓히기 (assets 44 townhall-v3): the 28 x 18 m room, the three desks, the marble seats and benches, the lobby
  // props, and the three clerks on the common rig
  const th3 = (file) => ({ url: `/assets/island/townhall-v3/${file}.glb`, low: { url: `/assets/island/townhall-v3/${file}_low.glb` } });
  for (const f of ['townhall_interior', 'desk_civil', 'desk_tax', 'desk_bank', 'chair_marble', 'bench_marble', 'ticket_machine', 'notice_board', 'plant_pot', 'mayor_door', 'flag_stand', 'water_cooler', 'counter_bell', 'rope_stand']) REGISTRY[`townhall3.${f}`] = th3(f);
  for (const n of ['civil', 'tax', 'bank']) REGISTRY[`character.clerk_${n}`] = { url: `${CH}/npc_clerk_${n}.glb`, low: { url: `${CH}/npc_clerk_${n}_low.glb` }, rotationY: Math.PI, motions: true };
  // B 45 꽃·나무 심기 (assets 45 planting-v1): the stages of a flower (five colours from the bud on) and of a tree, the
  // fertilizer's mark
  for (const f of ["flower_stage0","flower_stage1","flower_stage2_red","flower_stage3_red","flower_stage2_yellow","flower_stage3_yellow","flower_stage2_white","flower_stage3_white","flower_stage2_pink","flower_stage3_pink","flower_stage2_purple","flower_stage3_purple","tree_stage0","tree_stage1","tree_stage2","tree_stage3","fertilized_mark"]) REGISTRY[`plant.${f}`] = { url: `/assets/island/planting-v1/${f}.glb`, low: { url: `/assets/island/planting-v1/${f}_low.glb` }, near: 40 };
  // B 46 겨울 축제 (assets 46 winter-v1): the plaza's tree on the fountain's spot, the props, the snow laid over the plaza's
  // lamps and benches (overlays, in the props' own frame); the lamp's own 0.85 is the overlay's too
  const winter = (file, extra = {}) => ({ url: `/assets/island/winter-v1/${file}.glb`, low: { url: `/assets/island/winter-v1/${file}_low.glb` }, near: 60, ...extra });
  for (const f of ['landmark_winter_tree', 'landmark_winter_base', 'snowman_classic', 'snowman_little', 'gift_box_red', 'gift_box_green', 'gift_box_blue', 'wreath', 'garland', 'candy_cane', 'snow_pile_round', 'snow_pile_long', 'sleigh', 'lights_string', 'bench_snow', 'lamp_winter']) REGISTRY[`winter.${f}`] = winter(f);
  // B 47 함께하는 섬 (assets 47 together-v1): birthday decorations, the 우체통 and its letter and parcel, the guide's arrow, the
  // bug net and twelve insects, the museum, three pets -- each as together.<file>; the guide on the common rig
  for (const f of ["birthday_balloons","birthday_banner","birthday_cake","confetti_burst","mailbox","letter","parcel","guide_arrow","tool_bugnet","insect_butterfly_cabbage","insect_butterfly_swallowtail","insect_butterfly_blue","insect_dragonfly_red","insect_dragonfly_emperor","insect_cicada","insect_rhinoceros_beetle","insect_stag_beetle","insect_ladybird","insect_firefly","insect_grasshopper","insect_snail","museum_exterior","museum_case","museum_tank","museum_frame","pet_puppy","pet_kitten","pet_bird"]) REGISTRY[`together.${f}`] = { url: `/assets/island/together-v1/${f}.glb`, low: { url: `/assets/island/together-v1/${f}_low.glb` }, near: 40 };
  REGISTRY['good.bugnet'] = { ...REGISTRY['together.tool_bugnet'], scale: 0.55 }; // (on the store's table, laid small)
  REGISTRY['good.fishing_rod'] = { ...REGISTRY['fishing.rod'], scale: 0.55 }; // (the rod one fishes with, on the table)
  for (const p of ['puppy', 'kitten', 'bird']) REGISTRY[`good.pet_${p}`] = { ...REGISTRY[`together.pet_${p}`], scale: 0.55 }; // (on the table; walking with one it is full size)
  REGISTRY['character.guide'] = { url: `${CH}/npc_guide.glb`, low: { url: `${CH}/npc_guide_low.glb` }, rotationY: Math.PI, motions: true };
  // v1.10.93 체형 (사용자 2026-10-18, 시안 v2): the body and all it wears narrowed alike (asset-loader slimmedGeometry) --
  // trunk width 82%·depth 80%, arms 55%, legs 50% of their thickness; 1 everywhere is the body as made
  REGISTRY['character.base'].slim = { width: 0.82, depth: 0.8, arm: 0.55, leg: 0.5, hand: 0.82, foot: 0.85 }; // (hands 82%, shoes 85% across -- their soles stay down)
  const life = (file) => ({ url: `/assets/island/life-v1/${file}.glb`, low: { url: `/assets/island/life-v1/${file}_low.glb` }, near: 35 });
  for (const season of ['spring', 'summer', 'autumn', 'winter']) {
    REGISTRY[`tree.harvest.${season}`] = life(`tree_harvest_${season}`);
    REGISTRY[`tree.fruitLayer.${season}`] = life(`tree_fruit_layer_${season}`);
  }
  REGISTRY['prop.harvest.fruit'] = life('harvest_fruit_hand');
  for (const kind of ['harvest', 'fruitLayer']) REGISTRY[`tree.${kind}`] = { near: 35,
    seasons: Object.fromEntries(['spring','summer','autumn','winter'].map(s => [s, REGISTRY[`tree.${kind}.${s}`].url])),
    low: { seasons: Object.fromEntries(['spring','summer','autumn','winter'].map(s => [s, REGISTRY[`tree.${kind}.${s}`].low.url])) } };
  for (const name of ['flowerbed_empty', 'flowerbed_bloom', 'photo_frame', 'fishing_rod', 'watering_can', 'camera_bag']) REGISTRY[`quest.${name}`] = life(`quest_${name}`);
  // v1.10.80 농부 × 두더지 잡기 (assets 26 farmer-v1): the farmer (the common rig, moved by the common motion files:
  // `motions`), the field's four stages (the same floor, one shown -- the week's shared progress), the helpers' sign and
  // the farmer's mallet (its grip 0.13 m over its floor: plaza-scene holds it there)
  const farm = (file) => ({ url: `/assets/island/farmer-v1/${file}.glb`, low: { url: `/assets/island/farmer-v1/${file}_low.glb` }, near: 35 });
  for (const s of [0, 1, 2, 3]) REGISTRY[`farm.field.${s}`] = farm(`field_stage${s}`);
  REGISTRY['farm.sign'] = farm('sign_helpers');
  for (const f of ['shed', 'scarecrow']) REGISTRY[`farm.${f}`] = farm(`farm_${f}`); // (3회차 15 농장 마당, assets 68: the shed -- its door -Z -- and the scarecrow)
  REGISTRY['farm.mallet'] = { url: `${CH}/props/mallet.glb`, low: { url: `${CH}/props/mallet_low.glb` } };
  REGISTRY['character.farmer'] = { url: `${CH}/npc_farmer.glb`, low: { url: `${CH}/npc_farmer_low.glb` }, rotationY: Math.PI, motions: true };
  // v1.10.92 잡화점 (assets 41 store-v1): the building (front -Z, its door at local z -2.65), the room one walks into
  // (10 x 8 m, its door at local -Z; plaza-scene turns it half round), its keeper (the common rig) and the 23 goods on the shelves
  const ST = '/assets/island/store-v1';
  const st = (file, extra = {}) => ({ url: `${ST}/${file}.glb`, low: { url: `${ST}/${file}_low.glb` }, ...extra });
  REGISTRY['facility.store'] = { url: '/assets/island/mall-v1/mall_exterior.glb', low: { url: '/assets/island/mall-v1/mall_exterior_low.glb' }, near: 140, rotationY: Math.PI }; // v1.10.92 백화점 (assets 43)
  REGISTRY['mall.interior'] = { url: '/assets/island/mall-v1/mall_interior.glb', low: { url: '/assets/island/mall-v1/mall_interior_low.glb' } };
  REGISTRY['character.storekeeper'] = { url: `${CH}/npc_storekeeper.glb`, low: { url: `${CH}/npc_storekeeper_low.glb` }, rotationY: Math.PI, motions: true };
  for (const id of ['bait', 'bait_premium', 'seed_flower_red', 'seed_flower_yellow', 'seed_flower_white', 'seed_flower_pink', 'seed_flower_purple', 'sapling', 'fertilizer', 'firework', 'balloon', 'bubbles', 'gift_wrap', 'bread', 'milk', 'bouquet', 'letter_paper', 'bulb', 'paint', 'guitar_string', 'nail_box', 'frame', 'badge']) REGISTRY[`good.${id}`] = st(id, { shadows: false });
  // 달마루섬 2단계 (assets 55, Claude Code's Blender build): the structures that stand once -- front -Z in the files, turned
  // to the game's +Z; on the preview the 관공서 and 백화점 are their cliff fronts (the rooms inside are as now)
  const DAL = '/assets/island/dalmaru-v1';
  const dal = (file, extra = {}) => ({ url: `${DAL}/${file}.glb`, low: { url: `${DAL}/${file}_low.glb` }, rotationY: Math.PI, near: 90, ...extra });
  for (const f of ['bridge_yunseul', 'lighthouse_choseung', 'pier_dalkkeut', 'dock_boat', 'stairs_ridge', 'rail_waterfront', 'lamp_waterfront', 'bench_waterfront', 'niche_hero']) REGISTRY[`dalmaru.${f}`] = dal(f);
  REGISTRY['dalmaru.lighthouse_choseung'].keepNodes = true; // (S2: its lamp's `glow` its own -- the night beat)
  for (const f of ['facade_townhall', 'facade_mall']) REGISTRY[`dalmaru.${f}`] = dal(f, { near: 140 });
  // 묶음 1 대청마당 바닥 (assets 59): the disc (its crescent to the cliff: the file's -Z is north, not turned), ring, kerbs,
  // channels; the gardens in four seasons (each its zone's)
  const PV = '/assets/island/plaza-v1';
  for (const f of ['medallion', 'band_ring', 'curb', 'curb_corner', 'channel', 'channel_end']) REGISTRY[`plaza.${f}`] = { url: `${PV}/plaza_${f}.glb`, low: { url: `${PV}/plaza_${f}_low.glb` }, near: 90, shadows: false };
  const pvSeasons = (f) => Object.fromEntries(['spring', 'summer', 'autumn', 'winter'].map((s) => [s, `${PV}/plaza_${f.replace('{s}', s)}.glb`]));
  for (const f of ['garden_long', 'garden_round']) REGISTRY[`plaza.${f}`] = { seasons: pvSeasons(`${f}_{s}`), low: { seasons: pvSeasons(`${f}_{s}_low`) }, near: 90 };
  // 묶음 2 가구점 (assets 57 furniture-v1): every piece in each of its colours (furn.<shape>__<colour>, island-furniture.js),
  // the display's plinths, rugs, price stands and the counter, the 2nd floor, its lift and sign
  const FURN = typeof module === 'object' && module.exports ? require('./island-furniture.js') : globalThis.IslandFurniture;
  const FV = '/assets/island/furniture-v1';
  const fv = (file, extra = {}) => ({ url: `${FV}/${file}.glb`, low: { url: `${FV}/${file}_low.glb` }, near: 26, ...extra });
  // (2회차 9·10 「가구점 바닥이 갑자기 꺼졌어」: a floor one stands in keeps its High -- the Low of a 6 cm slab is squashed
  // to one face looking down, so from a camera far from the room's middle the floor was gone; FLAT_LOW_LOST in the test)
  const FLOOR = { low: null };
  for (const g of FURN?.GOODS || []) REGISTRY[g.model] = fv(`furn_${g.id}`);
  for (const f of ['plinth_l', 'plinth_s', 'price_stand', 'sold_sign', 'checkout']) REGISTRY[`shop.${f}`] = fv(`shop_${f}`, { shadows: false });
  for (const zone of ['living', 'bedroom', 'kitchen', 'garden']) REGISTRY[`shop.rug_zone__${zone}`] = fv(`shop_rug_zone__${zone}`, { shadows: false, ...FLOOR });
  for (const f of ['floor2', 'floor2_sign']) REGISTRY[`mall.${f}`] = fv(`mall_${f}`, { near: 60, ...(f === 'floor2' ? FLOOR : {}) });
  // 묶음 2-2 펫샵 (assets 60 petshop-v1): each pet in its four coats (pet.<kind>__<coat>, the same rig and motions as
  // together.pet_<kind>), the 3rd floor and what stands in it, and the lift that goes up to it (in place of assets 57's)
  const PS = '/assets/island/petshop-v1';
  const ps = (file, extra = {}) => ({ url: `${PS}/${file}.glb`, low: { url: `${PS}/${file}_low.glb` }, near: 40, ...extra });
  const PETS = { puppy: 'tan white black choco', kitten: 'grey cheese black white', bird: 'green yellow blue pink' };
  for (const [kind, coats] of Object.entries(PETS)) for (const coat of coats.split(' ')) REGISTRY[`pet.${kind}__${coat}`] = ps(`pet_${kind}__${coat}`);
  for (const f of ['floor3', 'playpen', 'cat_tower__beige', 'cat_tower__grey', 'bird_perch', 'pet_bed__pink', 'pet_bed__blue', 'pet_bed__brown', 'food_bowls', 'toys', 'counter', 'sign']) REGISTRY[`petshop.${f}`] = ps(`petshop_${f}`, { near: 60, ...(f === 'floor3' ? FLOOR : {}) });
  REGISTRY['mall.elevator'] = ps('petshop_elevator3', { near: 60 });
  REGISTRY['together.pet_ditto'] = ps('pet_ditto'); // (3회차 21 메타몽, assets 65: one coat, Idle·Walk·Sit like the others)
  // E1 계절 행사 (assets 72 season-v1): the festival stall, the harvest festival's goods (also its decor round 대청마당) and
  // the contests' trophies (furniture once won)
  const SV = '/assets/island/season-v1';
  const sv = (file, extra = {}) => ({ url: `${SV}/${file}.glb`, low: { url: `${SV}/${file}_low.glb` }, near: 50, ...extra });
  REGISTRY['event.stall'] = sv('event_stall');
  for (const k of ['fish', 'bug']) for (const m of ['gold', 'silver', 'bronze']) REGISTRY[`event.trophy_${k}_${m}`] = sv(`event_trophy_${k}_${m}`, { near: 26 });
  for (const f of ['basket', 'straw_sheaf', 'corn_string', 'persimmon_string', 'feast_table']) REGISTRY[`harvest.${f}`] = sv(`harvest_${f}`);
  // X1 크리스마스·연말 (assets 76 xmas-v1): the five house pieces, the stall's dress (laid over event.stall, same origin), the
  // gift sack, the snowball (scaled as it rolls) and the snowman's parts (origin = where each sticks), the countdown board and
  // the firework launcher -- placed by the festival (X2)
  const XV = '/assets/island/xmas-v1';
  const xv = (file, extra = {}) => ({ url: `${XV}/${file}.glb`, low: { url: `${XV}/${file}_low.glb` }, near: 50, ...extra });
  for (const f of ['tree_small', 'fireplace', 'snow_globe', 'stocking', 'gingerbread_house', 'stall_dress', 'gift_sack']) REGISTRY[`xmas.${f}`] = xv(`xmas_${f}`);
  REGISTRY['snow.ball'] = xv('snow_ball');
  for (const f of ['carrot', 'coal', 'twig', 'bucket', 'scarf']) REGISTRY[`snowman.part.${f}`] = xv(`snowman_part_${f}`, { near: 26 });
  for (const f of ['countdown_board', 'firework_launcher']) REGISTRY[`newyear.${f}`] = xv(`newyear_${f}`, { near: 60 });
  // S2 섬 이야기 (assets 80 story-v1): the little door under 초승등대 (with the lighthouse's origin and turn; its `door` turns on
  // its hinge), the small box at its foot, the 「초승 등불」 lamp (a house piece, given once)
  const STORY = '/assets/island/story-v1';
  REGISTRY['story.lighthouse_hatch'] = { url: `${STORY}/story_lighthouse_hatch.glb`, low: { url: `${STORY}/story_lighthouse_hatch_low.glb` }, rotationY: Math.PI, near: 60, keepNodes: true };
  REGISTRY['story.lantern_box'] = { url: `${STORY}/story_lantern_box.glb`, low: { url: `${STORY}/story_lantern_box_low.glb` }, near: 30 };
  REGISTRY['story.choseung_lantern'] = { url: `${STORY}/furniture_choseung_lantern.glb`, low: { url: `${STORY}/furniture_choseung_lantern_low.glb` }, near: 26 };
  // 간판 (assets 69 signs-v1, docs/signboards-design-20261025.md): the boards places' names are written on (plaza-scene signboard
  // -- the text on each one's FACE); no letters in the models
  const SG = '/assets/island/signs-v1';
  for (const k of ['stand', 'post', 'wall', 'station', 'plaque']) REGISTRY[`sign.${k}`] = { url: `${SG}/sign_${k}.glb`, low: { url: `${SG}/sign_${k}_low.glb` }, near: 45 };
  // 건물 생김새 보강 (assets 75 identity-v1, 간판 ④ 생김새 점검): the 게임관's roof piece, banners and door arch, the 백화점's
  // shop windows and awnings, and a new 기록관 in place of the small house (its size on its spot, dalmaru-island)
  const IV = '/assets/island/identity-v1';
  for (const f of ['games_roof', 'games_banner', 'games_marquee', 'store_window', 'store_awning']) REGISTRY[f.replace('_', '.')] = { url: `${IV}/${f}.glb`, low: { url: `${IV}/${f}_low.glb` }, near: 90 };
  // (winter roof snow: the hall's roof its own material, 'roof' -- roofSnow finds a roof by that name)
  REGISTRY['facility.records'] = { url: `${IV}/records_hall.glb`, low: { url: `${IV}/records_hall_low.glb` }, rotationY: Math.PI, near: 70, snow: true };
  // R4 구치소 (assets 67 jail-v1): the building by 관공서 (its sign the game's), the room, the cell and its door, the desk,
  // the benches, today's board; the warden on the named islanders' body, moved by the common motions
  const JV = '/assets/island/jail-v1';
  const jv = (file, extra = {}) => ({ url: `${JV}/${file}.glb`, low: { url: `${JV}/${file}_low.glb` }, near: 60, ...extra });
  REGISTRY['facility.jail'] = jv('jail_exterior', { rotationY: Math.PI }); // (its front -Z, as the 백화점's: turned to the spot's face)
  for (const f of ['room', 'cell', 'cell_door', 'desk', 'bench', 'board']) REGISTRY[`jail.${f}`] = jv(`jail_${f}`, f === 'room' ? FLOOR : {});
  REGISTRY['character.warden'] = { url: `${CH}/npc_warden.glb`, low: { url: `${CH}/npc_warden_low.glb` }, rotationY: Math.PI, motions: true };
  // 자전거 (assets 61 bike-v1): the frame in four colours, a wheel (front and back), the crank -- the game turns the last two;
  // in the 잡화점 a small one on the floor
  const BK = '/assets/island/bike-v1'; const bk = (file, extra = {}) => ({ url: `${BK}/${file}.glb`, low: { url: `${BK}/${file}_low.glb` }, near: 30, ...extra });
  for (const c of ['mint', 'red', 'sky', 'butter']) { REGISTRY[`bike.frame__${c}`] = bk(`bike_frame__${c}`); REGISTRY[`good.bike_${c}`] = bk(`bike_frame__${c}`, { scale: 0.55, shadows: false }); }
  REGISTRY['bike.wheel'] = bk('bike_wheel'); REGISTRY['bike.crank'] = bk('bike_crank');
  // 묶음 4 내 집 (assets 58 home-v1): the house in its four roofs (front -Z), the room, its floors and wallpapers (laid in
  // the room, one at a time), the nameplate, an empty lot's sign
  const HV = '/assets/island/home-v1'; const hv = (file, extra = {}) => ({ url: `${HV}/${file}.glb`, low: { url: `${HV}/${file}_low.glb` }, near: 60, ...extra });
  for (const r of ['red', 'blue', 'green', 'brown']) REGISTRY[`home.house__${r}`] = hv(`home_house__${r}`, { near: 90 });
  // (묶음 4-2 실내 크기, assets 58 2026-10-21: each room's own floor and wallpaper -- _s1 9 x 9, as named 12 x 12, _s3 16 x 13)
  for (const t of ['_s1', '', '_s3', '_s4']) { // (R8 _s4: the 2층's, its floor round the stair hole, walls 3.0 m)
    for (const [k, v] of ['boards__oak', 'boards__walnut', 'boards__birch', 'tiles__mint', 'tiles__pink'].map((f) => f.split('__'))) REGISTRY[`home.floor_${k}${t}__${v}`] = hv(`home_floor_${k}${t}__${v}`, { shadows: false, ...FLOOR });
    for (const w of ['cream', 'mint', 'pink', 'sky']) REGISTRY[`home.wallpaper${t}__${w}`] = hv(`home_wallpaper${t}__${w}`, { shadows: false });
  }
  // 묶음 5 각진 자연물 (assets 63 angular-v1 -- EmaceArt LumaGrove free pack made ours: vertex colours, our sizes, four
  // seasons; in the game only, never handed out apart): three trees and a bush in each season (mixed in with the round
  // ones, island.js), stones, the purple crystal heap, reeds by the water, cliff pieces at the island's edge
  const AV = '/assets/island/angular-v1';
  const av4 = (f, extra = {}) => ({ seasons: Object.fromEntries(['spring', 'summer', 'autumn', 'winter'].map((s) => [s, `${AV}/angular_${f}__${s}.glb`])), low: { seasons: Object.fromEntries(['spring', 'summer', 'autumn', 'winter'].map((s) => [s, `${AV}/angular_${f}__${s}_low.glb`])) }, near: 35, ...extra });
  for (const f of ['tree_block', 'tree_stack', 'tree_spire']) REGISTRY[`angular.${f}`] = av4(f, { scale: 0.75 }); // (4.8-5.4 m as made: our trees' height)
  REGISTRY['angular.bush'] = av4('bush', { near: 22, shadows: false });
  for (const f of ['rock_block', 'rock_lump', 'rock_small', 'rock_stack', 'cliff_a', 'cliff_b', 'grass_a', 'grass_b', 'grass_c', 'grass_d']) REGISTRY[`angular.${f}`] = { url: `${AV}/angular_${f}.glb`, low: { url: `${AV}/angular_${f}_low.glb` }, near: f.startsWith('grass') ? 22 : 40, ...(f.startsWith('grass') ? { shadows: false } : {}) };
  // 묶음 5 보이는 곤충 (assets 62 insects-v1): the twelve insects on a small rig with their clips (Fly, Rest, Crawl, Hop) --
  // out on the island (plaza-scene stepInsects); the still ones (together.insect_*) stay for the hand, the case and the museum
  // (3회차 1 곤충 크기, 사용자 2026-10-23: every one 0.3 m on its longest side -- about 1.5 fists; INSECT_LONG: as made, m)
  const INSECT_LONG = { butterfly_cabbage: 0.205, butterfly_swallowtail: 0.205, butterfly_blue: 0.205, dragonfly_red: 0.28, dragonfly_emperor: 0.28, cicada: 0.159, rhinoceros_beetle: 0.187, stag_beetle: 0.207, ladybird: 0.134, firefly: 0.147, grasshopper: 0.197, snail: 0.138 };
  for (const [sp, long] of Object.entries(INSECT_LONG)) REGISTRY[`insect.${sp}`] = { url: `/assets/island/insects-v1/insect_${sp}.glb`, low: { url: `/assets/island/insects-v1/insect_${sp}_low.glb` }, near: 25, shadows: false, scale: Math.round((0.3 / long) * 1000) / 1000 };
  for (const r of ['red', 'blue', 'green', 'brown']) REGISTRY[`home.hut__${r}`] = hv(`home_hut__${r}`, { near: 90 }); // (묶음 4-2: the 오두막, its room, the 공사 중 sign)
  for (const r of ['red', 'blue', 'green', 'brown']) REGISTRY[`home.manor__${r}`] = hv(`home_manor__${r}`, { near: 90 }); // (3단계 큰 집)
  // R8 4단계 큰 집 2층 (assets 58 2026-10-25): the two-storey house (the 큰 집's footing and door), the 2층 room (its stair hole
  // front left, seat stairs_down) and the 1층's stairs up (seat stairs_up at its foot)
  for (const r of ['red', 'blue', 'green', 'brown']) REGISTRY[`home.manor2__${r}`] = hv(`home_manor2__${r}`, { near: 90 });
  REGISTRY['home.upper_room'] = hv('home_upper_room__base'); for (const w of ['oak', 'walnut']) REGISTRY[`home.stairs_in__${w}`] = hv(`home_stairs_in__${w}`);
  REGISTRY['home.manor_room'] = hv('home_manor_room__base'); REGISTRY['home.hut_room'] = hv('home_hut_room__base'); REGISTRY['home.build_sign'] = hv('home_build_sign__base', { shadows: false });
  REGISTRY['home.room'] = hv('home_room__base'); REGISTRY['home.nameplate'] = hv('home_nameplate__base', { shadows: false }); REGISTRY['home.lot_sign'] = hv('home_lot_sign__base', { shadows: false });
  if ((typeof globalThis !== 'undefined' ? globalThis : {}).GC_ISLAND_MAP === 'dalmaru') { REGISTRY['facility.townhall'] = REGISTRY['dalmaru.facade_townhall']; REGISTRY['facility.store'] = REGISTRY['dalmaru.facade_mall']; }
  // F1·F2 (assets 49·50, 2026-10-20): the bodies and all worn below the head -- clothes, shoes, necklaces, capes, tails --
  // made on the slim body itself (`baked`: asset-loader does not narrow them again, or the hips swell back); the head's
  // parts (hair, hats, face) and the IP sets are narrowed at run time as before (the head is not narrowed anyway)
  const HEAD = /\/wear\/(hair|hat|eyes|nose|mouth|face_|cat_ears|x2_hair|x2_hat)|\/wear-winter\/wear_hat/;
  const body = REGISTRY['character.base']; body.baked = true; body.bare.baked = true;
  for (const e of Object.values(REGISTRY)) {
    if (typeof e.url === 'string' && /\/characters\/wear(-winter)?\//.test(e.url) && !HEAD.test(e.url)) e.baked = true;
    if (e.body && !HEAD.test(e.body.url)) e.body.baked = true;
  }
  return { REGISTRY, WARDROBE, LOOK_SLOTS, WALKER_LOOKS, wardrobeOf };
});
