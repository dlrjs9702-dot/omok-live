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
    ...Object.fromEntries([['pine', 0.95], ['fruit', 0.95], ['sapling', 1]].map(([kind, scale]) => [`nature.tree.${kind}`, { seasons: seasonalAdd(`tree_${kind}_{s}.glb`), low: { seasons: seasonalAdd(`tree_${kind}_{s}_low.glb`) }, scale, near: 35 }])),
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
  const MOTIONS = ['Idle', 'Walk', 'Run', 'Wave', 'Interact', 'Cheer', 'GatherWeed', 'Pickup', 'Give', 'Receive', 'PhotoPose', 'CarryIdle', 'SitDown', 'SitIdle', 'StandUp', 'GuardIdle', 'Bow', 'Usher', 'FishCast', 'FishWait', 'FishReel', 'FishCatch', 'FishBite', 'FishMiss', 'RideLookAround']; // v1.10.41 the mayor's three; v1.10.42 낚시
  REGISTRY['character.base'] = { url: `${CH}/body_core.glb`, low: { url: `${CH}/body_core_low.glb` }, near: 22, rotationY: Math.PI,
    clips: Object.fromEntries(MOTIONS.map((clip) => [clip, `${CH}/motions/${clip}.glb`])),
    animations: { idle: 'Idle', walk: 'Walk', run: 'Run', wave: 'Wave', interact: 'Interact', cheer: 'Cheer', gather: 'GatherWeed', pickup: 'Pickup', give: 'Give', receive: 'Receive', photo: 'PhotoPose', carry: 'CarryIdle', sitDown: 'SitDown', sitIdle: 'SitIdle', rideLook: 'RideLookAround', standUp: 'StandUp', guard: 'GuardIdle', bow: 'Bow', usher: 'Usher', fishCast: 'FishCast', fishWait: 'FishWait', fishReel: 'FishReel', fishCatch: 'FishCatch', fishBite: 'FishBite', fishMiss: 'FishMiss' },
    speeds: { walk: 5.2, run: 8.3 }, armTuck: 0.4 }; // radians the upper arms are brought in toward the body (asset-loader wear)
  // v1.10.32: every part says its `fit` (asset-pipeline fitWardrobe): its slot, what of the base it replaces, a hat's
  // `cover` (the line above which the hair is under its crown, where the crown is wider than the hair) and a part's own
  // pieces that give way to a worn slot (`hideWith`)
  const part = (file, slot, { low = true, dye = null, ...fit } = {}) => ({ url: `${CH}/wear/${file}.glb`, ...(low ? { low: { url: `${CH}/wear/${file}_low.glb` } } : {}), ...(dye ? { dye } : {}), fit: { slot, ...fit } });
  Object.assign(REGISTRY, {
    'wear.face_eyes_cheeks': part('face_eyes_cheeks', 'face', { low: false }), 'wear.hair_cap': part('hair_cap', 'hair', { low: false }), 'wear.hair_long': part('hair_long', 'hair', { low: false }),
    'wear.basic_shirt': part('basic_shirt', 'top', { low: false }), 'wear.female_shirt': part('female_shirt', 'top', { low: false }),
    'wear.basic_pants': part('basic_pants', 'bottom', { low: false }), 'wear.short_skirt': part('short_skirt', 'bottom', { low: false }), 'wear.shoes': part('shoes', 'shoes', { low: false }),
    'wear.overalls': part('overalls', 'outfit', { low: false }), 'wear.cat_ears': part('cat_ears', 'hat', { low: false, dye: 'hair' }),
  });
  // hair (05 skins pack, and the two older looks remade on the common rig: 무지개 머리 in its five colours, 별빛 머리)
  for (const file of ['hair_twin_tail', 'hair_curly', 'hair_ponytail', 'hair_spiky', 'hair_crew', 'hair_side_part', 'hair_bob', 'hair_straight', 'hair_bun', 'hair_braid']) REGISTRY[`wear.${file}`] = part(file, 'hair', { dye: 'hair' });
  for (const file of ['hair_rainbow', 'hair_starlight']) REGISTRY[`wear.${file}`] = part(file, 'hair');
  // outfits: the whole set of clothes (the 05 outfits with the pelvis filled in, the older four remade)
  for (const file of ['casual', 'hoodie', 'sailor', 'apron', 'explorer', 'raincoat', 'knight', 'robe', 'dress', 'sports', 'stripes', 'hanbok', 'space']) REGISTRY[`wear.outfit_${file}`] = part(`outfit_${file}`, 'outfit', { replaces: ['top', 'bottom'] });
  REGISTRY['wear.outfit_royal'] = part('outfit_royal', 'outfit', { replaces: ['top', 'bottom'], hideWith: { cape: ['cape_main', 'cape_trim'] } }); // its cape gives way to a worn one
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
  const HW_FIT = { 'hair': { dye: 'hair' }, 'outfit': { replaces: ['top', 'bottom'] }, 'hat_witch': { dye: 'main', cover: 2.04, sink: 0.12, widen: 1.18 }, 'hat_pumpkin': { dye: 'accent', cover: 1.98 }, 'hat_bat': { dye: 'main' },
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
      const dye = look.dye?.[item]; if (dye && REGISTRY[id].dye) colors[id] = { [REGISTRY[id].dye]: dye };
    }
    if (hat && !parts.hat) { parts.hat = 'wear.hat_fedora'; colors['wear.hat_fedora'] = { main: hat }; } // a keeper's hat
    for (const face of ['eyes', 'nose', 'mouth']) { const d = look.face?.[face]; if (d && REGISTRY[`wear.${face}_${d}`]) { parts[face] = `wear.${face}_${d}`; if (face === 'eyes') delete parts.face; } }
    // v1.10.35 염색 (머리·눈·피부): the base hair when no hair item is worn, the drawn colour of whichever eyes are on
    // (each design names it its own way), and the skin everywhere it shows
    if (look.hairColor && (parts.hair === 'wear.hair_cap' || parts.hair === 'wear.hair_long')) colors[parts.hair] = { hair: look.hairColor };
    const eyes = parts.eyes || parts.face;
    if (look.eyeColor && eyes) colors[eyes] = { ...colors[eyes], eyes: look.eyeColor, ink: look.eyeColor, rose: look.eyeColor, accent: look.eyeColor };
    // the island's own warm skin (the procedural characters'): the part's paler skin read olive under the island's light
    return { parts: Object.values(parts), colors, tint: { skin: look.skinColor || SKIN, ...(tint || {}) } };
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

  return { REGISTRY, WARDROBE, LOOK_SLOTS, wardrobeOf };
});
