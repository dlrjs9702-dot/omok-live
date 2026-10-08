const { test, expect } = require('@playwright/test');
const { shopper, post, get, expectNoScriptError } = require('./skin-support');

test('열매 직접 수확: 실물 HighLow·PickFruit·원격·완료 대기·이동 재개·재생·취소', async ({browser,request}) => {
  test.setTimeout(180000);
  const {REGISTRY,wardrobeOf}=require('../../public/plaza/island-assets');
  const ids=['character.base','tree.harvest','tree.fruitLayer','prop.harvest.fruit',...wardrobeOf({}).parts,...wardrobeOf({gender:'female'}).parts];
  const registry={__only:true,...Object.fromEntries(ids.map(k=>[k,REGISTRY[k]]))};
  const a=await island(browser,request,'열매가',registry), b=await island(browser,request,'열매나',registry);
  for(const who of [a,b]) await expect.poll(()=>who.page.evaluate(()=>window.PlazaDebug()?.assets.shown?.['character.base']),{timeout:60000}).toBe('model');
  const tree=(await get(request,'/api/test/island/events',a.token)).data.events.find(e=>e.type==='berry' && e.state==='open');
  const key=`ev:berry:${tree.id}`;
  await b.page.evaluate(t=>window.PlazaDebug().teleport(t.x+5,t.z+5),tree);
  await a.page.evaluate(t=>window.PlazaDebug().teleport(t.x,t.z),tree);
  await expect(a.page.locator('#plazaHint')).toHaveText('SPACE · 나무 열매 · 따기',{timeout:15000});
  for(const who of [a,b]) await expect.poll(()=>who.page.evaluate(k=>window.PlazaDebug().resources().find(r=>r.key===k)?.fruit,key),{timeout:15000}).toBe(true);
  expect(await a.page.evaluate(t=>window.PlazaDebug().markers.some(m=>Math.hypot(m.x-t.x,m.z-t.z)<1),tree)).toBe(false);
  let release;const gate=new Promise(r=>{release=r;});
  await a.page.route('**/api/island/resource/finish',async route=>{await gate;await route.continue();});
  const startResponse=a.page.waitForResponse(r=>r.url().endsWith('/api/island/resource/start'));
  await a.page.keyboard.press('Space');
  const started=await startResponse; expect(await started.json()).toMatchObject({ok:true,anim:'pickFruit'});
  await expect.poll(()=>a.page.evaluate(()=>window.PlazaDebug().gait),{timeout:10000}).toBe('pickFruit');
  await expect.poll(()=>b.page.evaluate(()=>window.PlazaDebug().othersActs().some(o=>o.act==='pickFruit' && o.clip==='PickFruit')),{timeout:10000}).toBe(true);
  await expect.poll(()=>a.page.evaluate(()=>window.PlazaDebug().gather?.pending),{timeout:10000}).toBe(true);
  const at=await a.page.evaluate(()=>{const d=window.PlazaDebug();return {x:d.x,z:d.z,yaw:d.camYaw};});
  await a.page.keyboard.down('ArrowRight');await a.page.keyboard.down('KeyD');await a.page.waitForTimeout(250);await a.page.keyboard.up('KeyD');
  const held=await a.page.evaluate(()=>{const d=window.PlazaDebug();return {x:d.x,z:d.z,yaw:d.camYaw,gait:d.gait};});
  expect(Math.hypot(at.x-held.x,at.z-held.z)).toBeLessThan(.05);expect(held.gait).toBe('pickFruit');expect(Math.abs(held.yaw-at.yaw)).toBeGreaterThan(.05);
  release();
  await expect.poll(()=>a.page.evaluate(()=>window.PlazaDebug().gather),{timeout:10000}).toBe(null);
  await expect.poll(()=>a.page.evaluate(()=>window.PlazaDebug().gait),{timeout:5000}).toBe('walk');
  await expect.poll(()=>a.page.evaluate(p=>Math.hypot(window.PlazaDebug().x-p.x,window.PlazaDebug().z-p.z),at),{timeout:5000}).toBeGreaterThan(.2);await a.page.keyboard.up('ArrowRight');
  for(const who of [a,b]) await expect.poll(()=>who.page.evaluate(k=>window.PlazaDebug().resources().find(r=>r.key===k)?.fruit,key),{timeout:10000}).toBe(false);
  expect((await get(request,'/api/island/bag',a.token)).data.items.find(i=>i.itemId==='berry').qty).toBe(1);
  expect((await post(request,'/api/island/resource/start',a.token,{id:tree.id})).data.error).toBe('EVENT_GONE');
  await post(request,'/api/test/island/events',a.token,{grow:tree.id});
  // Drop the old removal guard only when a newer server generation is visible.
  await a.page.unroute('**/api/island/resource/finish');
  for(const who of [a,b]) await expect.poll(()=>who.page.evaluate(k=>window.PlazaDebug().resources().find(r=>r.key===k)?.fruit,key),{timeout:10000}).toBe(true);
  await a.page.evaluate(t=>window.PlazaDebug().teleport(t.x,t.z),tree);
  await expect(a.page.locator('#plazaHint')).toContainText('나무 열매');await a.page.keyboard.press('Space');
  await expect.poll(()=>a.page.evaluate(()=>window.PlazaDebug().gather?.kind)).toBe('resource');await a.page.keyboard.press('Escape');
  await expect.poll(()=>a.page.evaluate(()=>window.PlazaDebug().gather)).toBe(null);
  expect((await get(request,'/api/island/bag',a.token)).data.items.find(i=>i.itemId==='berry').qty).toBe(1);
  for(const who of [a,b]){await expectNoScriptError(who.page);await who.context.close();}
});

test('동물 의상: 남녀 구매·중복 미차감·5부위 착용, 원격 High/Low, 재접속·해제', async ({ browser, request }) => {
  test.setTimeout(180000);
  const a = await shopper(browser, request, '동물고양이', 1000000, 'male');
  const b = await shopper(browser, request, '동물여우', 1000000, 'female');
  for (const [who, animal] of [[a, 'cat'], [b, 'fox']]) {
    let lastBalance;
    for (const slot of ['outfit', 'hat', 'tail', 'shoes', 'necklace']) {
      const id = `avatar_animal_${animal}_${slot}`;
      const bought = await post(request, '/api/skins/buy', who.token, { skinId: id });
      expect(bought.status).toBe(200); lastBalance = bought.data.balance;
      expect((await post(request, '/api/skins/equip', who.token, { skinId: id })).status).toBe(200);
    }
    const duplicate = await post(request, '/api/skins/buy', who.token, { skinId: `avatar_animal_${animal}_outfit` });
    expect(duplicate.status).toBe(200); expect(duplicate.data.purchased).toBe(false); expect(duplicate.data.balance).toBe(lastBalance);
    await who.page.evaluate(() => { localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.testHalloween', 'off'); });
    await who.page.reload();
    const worn = ['outfit', 'hat', 'tail', 'shoes', 'necklace'].map((s) => `wear.animal_${animal}_${s}`);
    await expect.poll(() => who.page.evaluate(() => window.PlazaDebug?.()?.wardrobe), { timeout: 90000 }).toEqual(expect.arrayContaining(worn));
    const asset = await who.page.evaluate((part) => window.PlazaDebug().assets.wearing.find((w) => w.parts.includes(part)), worn[0]);
    expect(asset.meshes.low).toBe(asset.meshes.high);
  }
  await expect.poll(() => a.page.evaluate(() => window.PlazaDebug().assets.wearing.some((w) => w.parts.includes('wear.animal_fox_outfit'))), { timeout: 30000 }).toBe(true);
  await a.page.evaluate(() => window.PlazaDebug().holdQuality(0));
  const far = await b.page.evaluate(() => { const p = window.PlazaDebug(); const at = p.doors.climb; p.teleport(at.x, at.z); return at; }); // place() observes player collision; two shoppers start close together.
  await expect.poll(() => a.page.evaluate((at) => { const o = window.PlazaDebug().others.find((p) => p.look.outfit === 'avatar_animal_fox_outfit'); return o ? Math.hypot(o.x - at.x, o.z - at.z) : Infinity; }, far), { timeout: 30000 }).toBeLessThan(2);
  await expect.poll(() => a.page.evaluate(() => window.PlazaDebug().assets.wearing.some((w) => w.parts.includes('wear.animal_fox_outfit') && !w.high)), { timeout: 30000 }).toBe(true);
  await a.page.reload();
  await expect.poll(() => a.page.evaluate(() => window.PlazaDebug?.()?.wardrobe), { timeout: 90000 }).toEqual(expect.arrayContaining(['wear.animal_cat_outfit', 'wear.animal_cat_hat']));
  expect((await post(request, '/api/skins/equip', a.token, { game: 'avatar', slot: 'hat', skinId: null })).status).toBe(200);
  await a.page.reload(); // API setup bypasses the shop handler's refreshPlazaAvatar.
  await expect.poll(() => a.page.evaluate(() => window.PlazaDebug?.()?.wardrobe), { timeout: 90000 }).toEqual(expect.arrayContaining(['wear.animal_cat_outfit']));
  expect(await a.page.evaluate(() => window.PlazaDebug().wardrobe)).not.toContain('wear.animal_cat_hat');
  for (const who of [a, b]) { await expectNoScriptError(who.page); await who.context.close(); }
});
const { staticGlb, riggedGlb } = require('../../test-support/gltf-fixture.js');

// v1.10.15 고품질 에셋 파이프라인 in the real island: with nothing registered nothing extra is loaded and everything
// stays procedural; a registered model is fetched once however many targets use it and swapped in (structures keep
// their doors and collision, characters play Idle/Walk/Run); a missing or broken model, a disabled entry or a loader
// that cannot load leaves only that target procedural and the island playable. Test entries come from localStorage
// gc.testIslandAssets (automated browsers only); the model files are generated and served by the route below.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');
test.describe.configure({ mode: 'default' }); // 3D pages one after another, like plaza.spec

const BOX = '/assets/island/__e2e/box.glb';
const RIG = '/assets/island/__e2e/rig.glb';
const BOX2 = '/assets/island/__e2e/box-winter.glb';
const debug = (page) => page.evaluate(() => { const d = window.PlazaDebug(); return d && { running: d.running, assets: d.assets, doors: d.doors, x: d.x, z: d.z, near: d.near }; });

async function island(browser, request, label, registry, { failLoader = false } = {}) {
  const who = await shopper(browser, request, label);
  const { page, context } = who;
  const hits = {};
  await context.route('**/assets/island/__e2e/**', (route) => {
    const url = new URL(route.request().url()).pathname; hits[url] = (hits[url] || 0) + 1;
    if (url === BOX) return route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: staticGlb() });
    if (url === RIG) return route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: riggedGlb() });
    if (url === BOX2) return route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: staticGlb() });
    if (url.endsWith('broken.glb')) return route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: Buffer.from('glTF but not really') });
    return route.fulfill({ status: 404, body: 'not found' });
  });
  const code = [];
  page.on('request', (r) => { if (/asset-loader\.js|\/vendor\/three\/addons\//.test(r.url())) code.push(new URL(r.url()).pathname); });
  if (failLoader) await context.route('**/plaza/asset-loader.js*', (route) => route.fulfill({ status: 500, body: 'no' }));
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  // 'none': as if nothing were registered (the registered entries are set to null); otherwise added to the registry;
  // v1.10.29 `__only`: only these entries (every registered one off) -- a test of the general ids (`cottage`,
  // `nature.flower`) that the real, more specific ones (`cottage.3`, `nature.flower.2`) would otherwise take over
  await page.evaluate((r) => {
    localStorage.removeItem('gc.testClassic');
    const nulls = Object.fromEntries(Object.keys(window.IslandAssets.REGISTRY).map((id) => [id, null]));
    const own = r === 'none' ? nulls : r?.__only ? (({ __only, ...rest }) => ({ ...nulls, ...rest }))(r) : r;
    if (own) localStorage.setItem('gc.testIslandAssets', JSON.stringify(own));
  }, registry);
  await page.reload();
  await expect(page.locator('#plazaStage canvas.plazaCanvas')).toBeVisible({ timeout: 15000 });
  await expect.poll(() => debug(page).then((d) => d?.running), { timeout: 10000 }).toBe(true);
  return { ...who, hits, code, errors };
}

// the island still plays: walking, a facility hint, Space opens its window
async function stillPlays(page) {
  const before = await debug(page);
  await page.keyboard.down('ArrowUp');
  await expect.poll(async () => before.z - (await debug(page)).z, { timeout: 10000 }).toBeGreaterThan(0.3);
  await page.keyboard.up('ArrowUp');
  await page.evaluate(() => window.PlazaDebug().place('shop'));
  await expect(page.locator('#plazaHint')).toHaveText('SPACE · 게임 스킨 상점');
  await page.keyboard.press('Space');
  await expect(page.locator('#skinShopDialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#skinShopDialog')).toBeHidden();
}

let proceduralDoors = null;

test('등록 없음: 로더를 받지 않고 모든 대상이 코드 생성형, 섬은 그대로 동작한다', async ({ browser, request }) => {
  const a = await island(browser, request, '에셋없음', 'none');
  const d = await debug(a.page);
  expect(d.assets).toMatchObject({ registered: [], loader: 'none' });
  expect(a.code).toEqual([]); // neither the loader module nor GLTFLoader was fetched
  proceduralDoors = d.doors;
  await stillPlays(a.page);
  expect(a.errors).toEqual([]);
  await expectNoScriptError(a.page);
  await a.context.close();
});

test('등록 + 성공: 같은 모델은 여러 대상이 써도 한 번만 받고, 구조물은 문·충돌을 그대로 두고, 캐릭터는 Idle/Walk/Run을 재생한다', async ({ browser, request }) => {
  const a = await island(browser, request, '에셋성공', {
    __only: true,
    'facility.townhall': { url: BOX, scale: 2 },
    'cottage': { url: BOX, lod: [{ url: BOX, distance: 40 }] },
    'character.player': { url: RIG, animations: { idle: 'Idle', walk: 'Walk', run: 'Run' } },
  });
  const { page } = a;
  await expect.poll(async () => (await debug(page)).assets.shown, { timeout: 10000 })
    .toMatchObject({ 'facility.townhall': 'model', cottage: 'model', 'character.player': 'model' });
  const d = await debug(page);
  expect(d.assets.loader).toBe('ready');
  expect(d.assets.files).toMatchObject({ [BOX]: 'loaded', [RIG]: 'loaded' });
  expect(a.hits).toEqual({ [BOX]: 1, [RIG]: 1 }); // one download each: the town hall, nine cottages (two LOD levels) and me
  expect(d.assets.lods).toBe(9);
  expect(a.code).toEqual(expect.arrayContaining(['/plaza/asset-loader.js', '/vendor/three/addons/loaders/GLTFLoader.js', '/vendor/three/addons/utils/SkeletonUtils.js']));
  if (proceduralDoors) expect(d.doors).toEqual(proceduralDoors); // doors (and with them interaction) are the game's, not the model's

  // my character: Idle standing, Walk while the arrow is held, back to Idle -- through the mixer, cross-faded
  const gait = () => page.evaluate(() => window.PlazaDebug().gait);
  await expect.poll(gait).toBe('idle');
  await page.keyboard.down('ArrowUp');
  await expect.poll(gait).toBe('walk');
  await page.keyboard.up('ArrowUp');
  await expect.poll(gait).toBe('idle');
  await stillPlays(page);
  expect(a.errors).toEqual([]);
  await expectNoScriptError(page);
  await a.context.close();
});

test('실패·비활성화: 없는 파일·손상된 파일·꺼진 등록은 그 대상만 코드 생성형으로 남고 섬은 계속 동작한다', async ({ browser, request }) => {
  const a = await island(browser, request, '에셋실패', {
    __only: true,
    'facility.townhall': { url: '/assets/island/__e2e/missing.glb' },
    'facility.shop': { url: '/assets/island/__e2e/broken.glb' },
    'facility.records': { url: BOX, enabled: false },
    'cottage': { url: BOX },
  });
  const { page } = a;
  await expect.poll(async () => (await debug(page)).assets.shown, { timeout: 10000 })
    .toMatchObject({ 'facility.townhall': 'procedural', 'facility.shop': 'procedural', cottage: 'model' });
  const files = (await debug(page)).assets.files;
  expect(files[BOX]).toBe('loaded');
  expect(files['/assets/island/__e2e/missing.glb']).toMatch(/^failed/);
  expect(files['/assets/island/__e2e/broken.glb']).toMatch(/^failed/);
  expect(a.hits['/assets/island/__e2e/missing.glb']).toBe(1); // tried once, not again and again
  await stillPlays(page);
  expect(a.errors).toEqual([]);
  await a.context.close();
});

test('로더 자체를 받지 못해도 모든 대상이 코드 생성형으로 남고 섬은 계속 동작한다', async ({ browser, request }) => {
  const a = await island(browser, request, '로더실패', { 'facility.townhall': { url: BOX } }, { failLoader: true });
  await expect.poll(async () => (await debug(a.page)).assets.loader, { timeout: 10000 }).toBe('failed');
  expect(a.hits).toEqual({});
  await stillPlays(a.page);
  await a.context.close();
});

// v1.10.17 nature and plaza props
// v1.10.28: with a model, every copy at every distance is the model (no procedural copies left); without a Low file
// (here it is missing) the full model is used far away too
test('자연물 묶음: 같은 모델 1회 다운로드로 수십 그루를 기존 자리·회전·크기에 배치하고, 모든 거리에서 모델(Low 없으면 High), 실패한 종류는 코드 생성형, 소품도 교체된다', async ({ browser, request }) => {
  const a = await island(browser, request, '자연물', {
    __only: true,
    'nature.tree.round': { url: BOX, scale: 1.5, low: { url: '/assets/island/__e2e/missing-low.glb' } },
    'nature.flower': { url: BOX, scale: 0.2 },
    'nature.bush': { url: '/assets/island/__e2e/missing-bush.glb' },
    'prop.bench': { url: BOX },
  });
  const { page } = a;
  const batches = async () => (await debug(page)).assets.batches || [];
  await expect.poll(async () => (await batches()).filter((b) => b.placed).length, { timeout: 15000 }).toBeGreaterThanOrEqual(2);
  const list = await batches();
  const tree = list.find((b) => b.ids[0] === 'nature.tree.round');
  expect(tree.placed).toBe(true);
  expect(tree.copies).toBeGreaterThan(20); // every round tree on the island
  expect(tree.parts).toBe(1); // a plain-coloured model: flattened into one part, one draw call per square
  expect(tree.procedural).toBe(0); // no copy is drawn procedural, near or far
  expect(tree.low).toBe(null); // the Low file failed: High everywhere
  // next to one of them (the model distance shrinks on a slow machine's lower quality tiers)
  await page.evaluate(([x, z]) => window.PlazaDebug().teleport(x + 1.5, z + 1.5), tree.at);
  await expect.poll(async () => (await batches()).find((b) => b.ids[0] === 'nature.tree.round').near).toBeGreaterThan(0);
  const flowers = list.filter((b) => b.ids.includes('nature.flower')); // v1.10.29: one list per colour, all on the general entry here
  expect(flowers.length).toBe(5);
  for (const f of flowers) expect(f.placed).toBe(true);
  for (const bush of list.filter((b) => b.ids[0].startsWith('nature.bush'))) expect(bush.placed).toBe(false); // missing file: procedural
  const shown = (await debug(page)).assets.shown;
  expect(shown['nature.bush']).toBe('procedural');
  expect(shown['prop.bench']).toBe('model');
  expect(a.hits[BOX]).toBe(1); // trees, flowers and the four benches share one download
  if (proceduralDoors) expect((await debug(page)).doors).toEqual(proceduralDoors);
  await stillPlays(page);
  expect(a.errors).toEqual([]);
  await a.context.close();
});

// v1.10.27 게임 아일랜드 4계절 동시 존재·일일 회전: every copy shows its zone's season today; the next day every season
// is one zone further clockwise (the files stay the same, each fetched once); a season without a file leaves that
// zone's copies procedural; back to automatic, the day is the server clock's
test('계절 구역: 구역마다 그날의 계절 파일, 다음 날은 시계방향으로 한 구역씩 이동, 파일 없는 계절은 코드 생성형', async ({ browser, request }) => {
  test.setTimeout(60000);
  const a = await island(browser, request, '계절', { __only: true, 'nature.rock.0': { seasons: { spring: BOX, winter: BOX2 }, scale: 0.6 } }); // the round-rock model alone (the whole registry is the next test's)
  const { page } = a;
  await page.evaluate(() => window.PlazaDebug().halloween.set(false)); // v1.10.41: rocks only -- October's decor would slow a software-rendered runner
  const rock = async () => ((await debug(page)).assets.batches || []).find((b) => b.ids[0] === 'nature.rock.0');
  await expect.poll(async () => (await debug(page)).assets.loader, { timeout: 15000 }).toBe('ready');
  const expectDay = async (day) => {
    await page.evaluate((d) => window.PlazaDebug().setSeasonDay(d), day);
    await expect.poll(async () => (await debug(page)).assets.day).toBe(day);
    await expect.poll(async () => (await rock())?.placed).toBe(true);
    const zones = (await rock()).zones;
    const looks = await page.evaluate((d) => [-1, 0, 1, 2, 3].map((zone) => window.IslandTerrain.zoneSeason(zone, d) || window.AssetPipeline.NEUTRAL_LOOK), day);
    expect(Object.keys(zones).length).toBeGreaterThanOrEqual(3); // rocks all round the island
    for (const [zone, z] of Object.entries(zones)) {
      expect(z.look).toBe(looks[Number(zone) + 1]);
      expect(z.url).toBe(z.look === 'spring' ? BOX : z.look === 'winter' ? BOX2 : null); // no file: procedural
    }
    return zones;
  };
  const day0 = 20736; // any day: 20736 % 4 === 0, zone k shows season k (north spring, east summer, south autumn, west winter)
  const first = await expectDay(day0);
  if (first[0]) expect(first[0].look).toBe('spring');
  const next = await expectDay(day0 + 1);
  for (const zone of [0, 1, 2, 3]) if (first[zone] && next[(zone + 1) % 4]) expect(next[(zone + 1) % 4].look).toBe(first[zone].look); // one zone clockwise
  const cycle = await expectDay(day0 + 4); // back where it started
  for (const zone of Object.keys(first)) expect(cycle[zone].look).toBe(first[zone].look);
  expect(a.hits[BOX]).toBe(1); expect(a.hits[BOX2]).toBe(1); // each file once, however often the day changes
  // back to the automatic day: the server clock's Seoul date
  await page.evaluate(() => window.PlazaDebug().setSeasonDay(null));
  const today = await page.evaluate(() => window.PlazaDebug().seasonDay());
  await expect.poll(async () => (await debug(page)).assets.day).toBe(today);
  await stillPlays(page);
  expect(a.errors).toEqual([]);
  await a.context.close();
});

// v1.10.32 해상 볼거리: a boat crossing out at sea, gulls wheeling over the water, dolphins leaping -- all past the
// coast (never on the island), placed where the default camera shows them
test('해상 볼거리: 바다의 배, 바다 위 갈매기 떼, 돌고래 — 섬과 플레이 영역 밖, 기본 시점 화면 안', async ({ browser, request }) => {
  test.setTimeout(240000);
  const a = await island(browser, request, '바다구경', { __only: true, 'sea.boat': { url: BOX }, 'sea.gull': { url: BOX }, 'sea.dolphin': { url: BOX }, 'sea.splash': { url: BOX } });
  const { page } = a;
  await expect.poll(async () => (await debug(page)).assets.loader, { timeout: 30000 }).toBe('ready');
  await page.evaluate(() => window.PlazaWarp(98, 0)); // on the east beach, the open sea before it (the harbour is south)
  const sights = () => page.evaluate(() => ({ at: window.PlazaDebug().sea.at(), me: { x: window.PlazaDebug().x, z: window.PlazaDebug().z } }));
  const out = (p) => page.evaluate(([x, z]) => window.IslandTerrain.coastDist(x, z), [p.x, p.z]);
  for (const kind of ['boat', 'gulls', 'dolphins']) {
    await expect.poll(() => page.evaluate((k) => window.PlazaDebug().sea.show(k) || window.PlazaDebug().sea.active().includes(k), kind), { timeout: 20000 }).toBe(true);
  }
  await expect.poll(async () => { const s = await sights(); return ['boat', 'gulls', 'dolphins'].every((k) => (s.at[k] || []).length > 0); }, { timeout: 20000 }).toBe(true);
  const { at, me } = await sights();
  for (const p of at.boat) { expect(Math.hypot(p.x - me.x, p.z - me.z)).toBeGreaterThan(15); expect(await out(p)).toBeLessThan(-4); }
  for (const p of at.gulls) { expect(p.y).toBeGreaterThan(2); expect(await out(p)).toBeLessThan(0); }
  for (const p of at.dolphins) { expect(Math.hypot(p.x - me.x, p.z - me.z)).toBeGreaterThan(14); expect(await out(p)).toBeLessThan(-5); }
  const inPicture = await page.evaluate((list) => list.map(([x, y, z]) => window.PlazaDebug().sea.inPicture(x, y, z)), [...at.boat, ...at.gulls, ...at.dolphins].map((p) => [p.x, p.y, p.z]));
  expect(inPicture.filter(Boolean).length).toBeGreaterThan(0); // chosen where the default picture shows the sea (the gulls wheel in and out of it)
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/sea.png` });
  await stillPlays(page);
  expect(a.errors).toEqual([]);
  await a.context.close();
});

// v1.10.32 겨울 지붕 눈: the houses and facilities standing in today's winter zone wear snow on their roofs (the made
// snowcap of their roof's kind, laid over that roof), the others none; the next day winter is one zone further and the
// snow goes with it
test('겨울 지붕 눈: 그날 겨울 구역의 집·시설만 지붕 모양에 맞춘 눈, 다음 날 구역 회전에 따라 이동', async ({ browser, request }) => {
  test.setTimeout(240000);
  const a = await island(browser, request, '지붕눈', null);
  const { page } = a;
  await expect.poll(async () => (await debug(page)).assets.loader, { timeout: 30000 }).toBe('ready');
  const roofs = async () => (await debug(page)).assets.attaches.filter((x) => x.snow !== undefined);
  const check = async (day) => {
    await page.evaluate((d) => window.PlazaDebug().setSeasonDay(d), day);
    await expect.poll(async () => { const w = (await roofs()).filter((r) => r.look === 'winter'); return w.length > 0 && w.every((r) => ['flat', 'gable', 'round'].includes(r.snow)); }, { timeout: 90000 }).toBe(true); // the buildings in first
    const list = await roofs();
    expect(list.filter((r) => r.look === 'winter').length).toBeGreaterThan(0);
    for (const r of list.filter((x) => x.look !== 'winter')) expect(['none', 'hidden']).toContain(r.snow);
    return list;
  };
  const day0 = 20736;
  const first = await check(day0);
  const kinds = new Set(first.filter((r) => r.look === 'winter').map((r) => r.snow));
  const next = await check(day0 + 1);
  const winterOf = (list) => new Set(list.filter((r) => r.look === 'winter').map((r) => r.zone));
  expect([...winterOf(next)]).toEqual([...winterOf(first)].map((z) => (z + 1) % 4)); // one zone clockwise
  expect(next.some((r) => r.snow === 'hidden')).toBe(true); // yesterday's winter roofs let go of theirs
  void kinds;
  if (process.env.SHOT_DIR) { // the village in its winter, for whoever runs this locally
    const shot = await page.evaluate((d0) => { const t = window.IslandTerrain; const c = t.COTTAGES[2]; for (let d = d0; d < d0 + 4; d += 1) if (t.zoneSeason(t.seasonZoneAt(c.x, c.z), d) === 'winter') return { d, x: c.x, z: c.z }; return null; }, day0);
    await page.evaluate((d) => window.PlazaDebug().setSeasonDay(d), shot.d);
    await page.evaluate(([x, z]) => window.PlazaWarp(x - 2, z - 9), [shot.x, shot.z]); await page.waitForTimeout(6000);
    await page.screenshot({ path: `${process.env.SHOT_DIR}/roof-snow.png` });
  }
  await stillPlays(page);
  expect(a.errors).toEqual([]);
  await a.context.close();
});

// v1.10.18/19 the registered models, as players get them, from the game resource pack (Cache Storage), once each.
// v1.10.27: all four seasons are on the island at once -- the trees and shrubs of every season are loaded, the gazebo
// shows its zone's season, the plaza's benches and flower beds (neutral) the plain summer files
test('운영 등록부: 사계절 나무·관목이 모두 쓰이고, 정자는 그 구역의 계절, 광장 소품은 중립(여름) 파일, 섬은 그대로 동작한다', async ({ browser, request }) => {
  test.setTimeout(240000); // every island model (all four seasons, High and Low) on a software renderer, then a whale's breach
  const a = await island(browser, request, '운영모델', null);
  const { page } = a;
  // 관리실: admins only; the whale only now and then (below); a wardrobe part only on whoever wears it, a find's prop only
  // where that find is, the pulled weed only in a hand
  const ids = (await page.evaluate(() => Object.keys(window.IslandAssets.REGISTRY))).filter((id) => id !== 'facility.admin' && !['sea.whale', 'sea.splash', 'prop.weedRooted', 'sea.boat', 'sea.gull', 'sea.dolphin', 'halloween.candyBag', 'halloween.candyBasket', 'quest.fishing_rod', 'quest.watering_can', 'quest.camera_bag'].includes(id) && !id.startsWith('tree.harvest.') && !id.startsWith('tree.fruitLayer.') && !id.startsWith('prop.harvest.') && !id.startsWith('wear.') && !id.startsWith('prop.event.') && !id.startsWith('struct.') && !id.startsWith('fish')); // Harvest is preregistered; held quest tools use the character socket, not an environmental attach.
  await expect.poll(async () => { const s = (await debug(page)).assets.shown; return ids.map((id) => s[id]); }, { timeout: 60000 }).toEqual(ids.map(() => 'model'));
  const d = await debug(page);
  expect(d.assets.day).toBe(await page.evaluate(() => window.PlazaDebug().seasonDay()));
  const files = Object.entries(d.assets.files).filter(([url]) => url.startsWith('/assets/island/'));
  await expect.poll(async () => Object.entries((await debug(page)).assets.files).filter(([url, state]) => url.startsWith('/assets/island/') && state !== 'loaded').length, { timeout: 60000 }).toBe(0); // v1.10.32: some come later (a winter roof's snowcap)
  for (const id of ['quest.watering_can', 'quest.fishing_rod']) {
    const url = await page.evaluate((key) => window.IslandAssets.REGISTRY[key].url, id);
    await expect.poll(async () => (await debug(page)).assets.files[url], { timeout: 30000, message: id + ' NPC hand prop' }).toBe('loaded');
  }
  for (const season of ['spring', 'summer', 'autumn', 'winter']) {
    for (const kind of ['tree_v1', 'tree_v2', 'tree_v3', 'shrub']) {
      expect(files.some(([url]) => url.includes(`/${season}/nature/${kind}_${season}.glb`)), `${season} ${kind}`).toBe(true);
      expect(files.some(([url]) => url.includes(`/${season}/nature/${kind}_${season}_low.glb`)), `${season} ${kind} low`).toBe(true); // v1.10.28
    }
  }
  const gazebo = d.assets.attaches.find((x) => x.ids.includes('facility.chat'));
  expect(gazebo.zone).toBeGreaterThanOrEqual(0);
  expect(gazebo.url).toContain(`/${gazebo.look}/gazebo_${gazebo.look}_v1.glb`);
  for (const prop of d.assets.attaches.filter((x) => x.ids.includes('prop.bench') || x.ids.includes('prop.planter'))) {
    expect(prop.zone).toBe(-1); expect(prop.look).toBe('summer'); // the neutral plaza
  }
  // v1.10.29: each flower colour its own model in every season; the bridges and yard fences take their zone's season
  // Terrain changes can leave a colour absent in one zone. Check every placed colour's actual seasonal H/L pair.
  const flowers = d.assets.batches.filter((batch) => batch.ids[0].startsWith('nature.flower.'));
  expect(flowers.length).toBe(5);
  for (const batch of flowers) for (const zone of Object.values(batch.zones)) {
    const colour = batch.ids[0].split('.').pop();
    expect(zone.url.endsWith('/' + zone.look + '/flower_' + colour + '_' + zone.look + '.glb')).toBe(true);
    expect(zone.low.endsWith('/' + zone.look + '/flower_' + colour + '_' + zone.look + '_low.glb')).toBe(true);
    expect(files.some(([url, state]) => url === zone.url && state === 'loaded')).toBe(true);
    expect(files.some(([url, state]) => url === zone.low && state === 'loaded')).toBe(true);
  }
  const bridges = d.assets.attaches.filter((x) => x.ids.includes('prop.bridge'));
  expect(bridges.length).toBe(4);
  for (const b of bridges) expect(b.url).toContain(`/${b.look}/bridge_${b.look}_v1.glb`);
  expect(d.assets.attaches.filter((x) => x.ids.includes('prop.fence')).length).toBeGreaterThanOrEqual(18); // two runs per cottage
  // every model file of every season is in the active pack of the resource cache
  const cached = await page.evaluate(async () => {
    const pointer = await caches.match('/active', { cacheName: 'gc-res:meta' }); const { cache } = await pointer.json();
    return (await (await caches.open(cache)).keys()).map((r) => new URL(r.url).pathname).filter((p) => p.startsWith('/assets/island/'));
  });
  // All four seasons/colours remain available offline, including files not used by today's placement.
  for (const season of ['spring', 'summer', 'autumn', 'winter']) for (const c of [0, 1, 2, 3, 4]) {
    expect(cached).toContain('/assets/island/additions-v1/' + season + '/flower_' + c + '_' + season + '.glb');
    expect(cached).toContain('/assets/island/additions-v1/' + season + '/flower_' + c + '_' + season + '_low.glb');
  }
  const config = require('../../tools/assets/island-models.json');
  expect(cached.length).toBe(config.files.length + config.files.filter((f) => f.low || f.lowSrc).length); // v1.10.29: every island model (High and Low, all four seasons) is in the pack before entry
  for (const [url] of files) expect(cached).toContain(url);
  for (const b of d.assets.batches) {
    expect(b.placed).toBe(true); expect(b.parts).toBe(b.ids[0].startsWith('halloween.') ? b.parts : 1); // v1.10.39: the Halloween decor keeps its glowing material apart (not flattened)
    expect(b.procedural).toBe(0); // the island never turns procedural with distance
    expect(b.near + b.far).toBe(b.copies); // every copy drawn exactly once (High or Low), no doubles
  }
  if (proceduralDoors) expect(d.doors).toEqual(proceduralDoors);
  // v1.10.29: the falling flakes are ready for every season that has them, and a whale breaches once (LoopOnce) with a
  // splash where it breaks the surface and where it falls back, then is gone
  expect(d.assets.ambient.kinds.sort()).toEqual(['autumn', 'spring', 'winter']);
  await page.evaluate(() => { const p = window.PlazaDebug(); p.teleport(-70, 75); p.setCamYaw(Math.PI * 0.75); });
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().whale()), { timeout: 5000 }).toBe(true);
  // the clip runs on the scene's clock (a frame counts at most 0.05 s), so on a slow software-rendered runner its 6 s take longer
  await expect.poll(async () => (await debug(page)).assets.played, { timeout: 90000 }).toEqual({ 'sea.whale': 1, 'sea.splash': 2 });
  await expect.poll(async () => (await debug(page)).assets.playing, { timeout: 30000 }).toBe(0);
  await page.evaluate(() => window.PlazaDebug().setCamYaw(0)); // the arrows walk screen-relative
  await stillPlays(page);
  expect(a.errors).toEqual([]);
  await a.context.close();
});

// v1.10.28 섬 전체 High/Low LOD (사용자 결정 2026-10-05): the registered models as players get them -- near the player a
// tree is the full model, far away the same design simplified (never the procedural look), and the switch has a band
test('High/Low LOD: 가까운 나무는 High, 먼 나무는 같은 디자인의 Low, 경계에는 히스테리시스, 생성형으로 돌아가지 않는다', async ({ browser, request }) => {
  test.setTimeout(60000);
  const a = await island(browser, request, 'LOD', null);
  const { page } = a;
  await page.evaluate(() => window.PlazaDebug().halloween.set(false)); // v1.10.39: trees only -- October's decor and bats would slow a software-rendered runner
  const tree = async () => ((await debug(page)).assets.batches || []).find((b) => b.ids[0] === 'nature.tree.round');
  await expect.poll(async () => (await tree())?.placed, { timeout: 30000 }).toBe(true);
  const t = await tree();
  expect(t.low).toMatch(/tree_v1_[a-z]+_low\.glb$/);
  await page.evaluate(() => window.PlazaDebug().holdQuality(2)); // a slow test machine must not change the distances mid-way
  const near = async () => page.evaluate(() => { const d = window.PlazaDebug(); return 35 * window.AssetPipeline.LOD_SCALE[d.quality]; });
  // the player stands `dist` east of the first round tree
  const standAt = async (dist) => { await page.evaluate(([x, z, dd]) => window.PlazaDebug().teleport(x + dd, z), [...t.at, dist]); await page.waitForTimeout(250); };
  await standAt(2);
  await expect.poll(async () => (await tree()).first).toBe('high');
  await standAt((await near()) + 1.5); // past `near` but inside the band: stays High
  await expect.poll(async () => (await tree()).first).toBe('high');
  await standAt((await near()) * 1.1 + 3); // past the band: Low
  await expect.poll(async () => (await tree()).first).toBe('low');
  await standAt((await near()) + 1.5); // back inside the band from far: stays Low
  await expect.poll(async () => (await tree()).first).toBe('low');
  await standAt((await near()) - 2); // inside `near`: High again
  await expect.poll(async () => (await tree()).first).toBe('high');
  // across the island everything stays the model (High near, Low far), never procedural, never drawn twice
  for (const b of (await debug(page)).assets.batches) {
    expect(b.procedural).toBe(0);
    expect(b.near + b.far).toBe(b.copies);
  }
  const all = await tree();
  expect(all.far).toBeGreaterThan(0); expect(all.near).toBeGreaterThan(0);
  expect(a.errors).toEqual([]);
  await a.context.close();
});

// v1.10.30 공통 캐릭터: the common-rig body with its gender's clothes; an avatar item with a part is worn on the same
// skeleton, the face (성형) and a dyed item (염색) change what is worn, the island goes on; an item without a part yet keeps
// the procedural character (never swapped for something else)
test('공통 캐릭터: 성별 기본형 조립, 헤어·성형·염색 반영, 대응 모듈 없는 상품은 생성형 유지', async ({ browser, request }) => {
  test.setTimeout(180000);
  const who = await shopper(browser, request, '공통캐릭', 2_000_000, 'female');
  const { page, token } = who;
  const ready = async () => {
    await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload();
    await expect.poll(() => page.evaluate(() => window.PlazaDebug?.()?.running), { timeout: 30000 }).toBe(true);
  };
  await ready();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().wardrobe), { timeout: 90000 }).toEqual(['wear.face_eyes_cheeks', 'wear.hair_long', 'wear.female_shirt', 'wear.short_skirt', 'wear.shoes']);
  // v1.10.35: the name tag stands just over the worn model's head (it was a fixed 2.53 over the feet)
  const tag = await page.evaluate(() => window.PlazaDebug().tagLayout);
  expect(tag.headTop).toBeGreaterThan(1.4); expect(tag.headTop).toBeLessThan(2.4);
  expect(tag.bottom - tag.headTop).toBeGreaterThan(0.05); expect(tag.bottom - tag.headTop).toBeLessThan(0.25);
  // v1.10.35 염색: the base hair, the eyes and the skin (nothing to own)
  for (const [itemId, color] of [['base_hair', 'c05'], ['eyes', 'c22'], ['skin', 's09']]) expect((await post(request, '/api/avatar/dye', token, { itemId, color, requestId: `e2e-body-${color}-1` })).status).toBe(200);
  await ready();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().look), { timeout: 30000 }).toMatchObject({ hairColor: '#e2c27a', eyeColor: '#34507e', skinColor: '#b07a4d' });
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().wornColors), { timeout: 90000 }).toMatchObject({ hair: '#e2c27a', eyes: '#34507e', skin: '#b07a4d' });
  for (const id of ['avatar_hair_1', 'avatar_hair_5']) expect((await post(request, '/api/skins/buy', token, { skinId: id })).status).toBe(200);
  expect((await post(request, '/api/skins/equip', token, { skinId: 'avatar_hair_1' })).status).toBe(200);
  expect((await post(request, '/api/avatar/surgery', token, { part: 'eyes', design: 'heart', requestId: 'e2e-look-eyes-1' })).status).toBe(200);
  expect((await post(request, '/api/avatar/dye', token, { itemId: 'avatar_hair_1', color: 'c12', requestId: 'e2e-look-dye-1' })).status).toBe(200);
  await ready();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().wardrobe), { timeout: 90000 }).toEqual(['wear.hair_twin_tail', 'wear.female_shirt', 'wear.short_skirt', 'wear.shoes', 'wear.eyes_heart']);
  expect(await page.evaluate(() => window.PlazaDebug().look.dye)).toEqual({ avatar_hair_1: '#eda3b8' });
  // v1.10.32: an older item without a part until now (무지개 머리) is the common character too, its own remade part
  expect((await post(request, '/api/skins/equip', token, { skinId: 'avatar_hair_5' })).status).toBe(200);
  await ready();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().wardrobe), { timeout: 90000 }).toEqual(['wear.hair_rainbow', 'wear.female_shirt', 'wear.short_skirt', 'wear.shoes', 'wear.eyes_heart']);
  await expectNoScriptError(page);
  await who.context.close();
});

// v1.10.32 캐릭터 조합 맞춤: the parts that meet where they are worn give way, from their own shapes -- the beanie's crown
// over the curls (cover), the moon pendant out over the robe's front, the long cape draped over the robe's skirt (shift),
// the ribbon tail out of the cape's cloth (slab); the boots replace the plain shoes and the robe the shirt and skirt; every
// High mesh has its Low one (a far character changes model, never loses a part); the five accessory slots at once
test('조합 맞춤: 모자-헤어 덮기, 목걸이·망토 밀어내기, 꼬리-망토, 액세서리 5칸 동시 장착, High/Low 짝', async ({ browser, request }) => {
  test.setTimeout(180000);
  const who = await shopper(browser, request, '조합맞춤', 5_000_000, 'female');
  const { page, token } = who;
  const items = ['avatar_hair_2', 'avatar_outfit_13', 'avatar_hat_6', 'avatar_cape_2', 'avatar_tail_10', 'avatar_shoes_2', 'avatar_necklace_4'];
  for (const id of items) {
    expect((await post(request, '/api/skins/buy', token, { skinId: id })).status).toBe(200);
    expect((await post(request, '/api/skins/equip', token, { skinId: id })).status).toBe(200);
  }
  await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug?.()?.running), { timeout: 30000 }).toBe(true);
  const worn = ['wear.face_eyes_cheeks', 'wear.hair_curly', 'wear.outfit_robe', 'wear.hat_beanie', 'wear.cape_long', 'wear.tail_ribbon', 'wear.shoes_boots', 'wear.necklace_moon'];
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().wardrobe), { timeout: 90000 }).toEqual(worn);
  const mine = await page.evaluate((list) => window.PlazaDebug().assets.wearing.find((w) => JSON.stringify(w.parts) === JSON.stringify(list)), worn);
  expect(mine.fitted).toEqual({ 'wear.hair_curly': ['cover'], 'wear.cape_long': ['shift'], 'wear.tail_ribbon': ['slab'], 'wear.necklace_moon': ['shift'] });
  expect(mine.meshes.low).toBe(mine.meshes.high);
  expect(await page.evaluate(() => Object.keys(window.PlazaDebug().look).filter((k) => ['hat', 'cape', 'tail', 'shoes', 'necklace'].includes(k)).sort())).toEqual(['cape', 'hat', 'necklace', 'shoes', 'tail']);
  if (process.env.SHOT_DIR) { // a look for whoever runs this locally (front, then from behind)
    const box = await page.locator('#plazaStage canvas.plazaCanvas').boundingBox();
    const clip = { x: box.x + box.width / 2 - 110, y: box.y + box.height / 2 - 40, width: 220, height: 260 };
    await page.screenshot({ path: `${process.env.SHOT_DIR}/combo-back.png`, clip });
    await page.keyboard.down('KeyA'); await page.waitForTimeout(1650); await page.keyboard.up('KeyA'); await page.waitForTimeout(400);
    await page.screenshot({ path: `${process.env.SHOT_DIR}/combo-front.png`, clip });
  }
  // v1.10.32 운반 on the common character: the lost thing's model on the chest joint, the arms laid over
  const lost = (await post(request, '/api/test/island/lost', token, {})).data.event;
  await page.evaluate(([x, z]) => window.PlazaWarp(x + 0.25, z), [lost.x, lost.z]);
  await expect(page.locator('#plazaHint')).toHaveText('SPACE · 줍기', { timeout: 15000 });
  await page.locator('#plazaStage').focus(); await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().carry), { timeout: 60000 }).toMatchObject({ mine: lost.id, arms: true, held: true, on: 'Chest' }); // its model may still be coming on a slow runner
  if (process.env.SHOT_DIR) {
    const box = await page.locator('#plazaStage canvas.plazaCanvas').boundingBox();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${process.env.SHOT_DIR}/carry.png`, clip: { x: box.x + box.width / 2 - 110, y: box.y + box.height / 2 - 40, width: 220, height: 260 } });
  }
  // taking a slot off puts the base back (no shoes bought: the plain ones)
  expect((await post(request, '/api/skins/equip', token, { game: 'avatar', slot: 'shoes', skinId: null })).status).toBe(200);
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug()?.wardrobe), { timeout: 90000 })
    .toEqual(['wear.face_eyes_cheeks', 'wear.hair_curly', 'wear.shoes', 'wear.outfit_robe', 'wear.hat_beanie', 'wear.cape_long', 'wear.tail_ribbon', 'wear.necklace_moon']);
  await expectNoScriptError(page);
  await who.context.close();
});

// v1.10.36 10월 할로윈 (사용자 확정 2026-10-06): October (Asia/Seoul) is night on the island -- the sky, the fog, the light,
// the windows' glass lit -- and the fountain gives its place to the pedestal and the jack-o'-lantern (the 2026-10-06 pack's
// models, glowing inside, an orange light on what is near); the rest of the year the day and the fountain come back. The
// Halloween clothes are worn like any character skin.
test('10월 할로윈: 밤 조명·창문 불빛, 분수 자리에 단상과 잭오랜턴(빛), 할로윈 옷 착용, 10월이 아니면 원래대로', async ({ browser, request }) => {
  test.setTimeout(180000);
  const who = await shopper(browser, request, '할로윈', 2_000_000, 'female');
  const { page, token } = who;
  for (const id of ['avatar_outfit_17', 'avatar_hat_13', 'avatar_cape_12']) {
    expect((await post(request, '/api/skins/buy', token, { skinId: id })).status).toBe(200);
    expect((await post(request, '/api/skins/equip', token, { skinId: id })).status).toBe(200);
  }
  await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug?.()?.running), { timeout: 30000 }).toBe(true);
  await page.evaluate(() => window.PlazaDebug().halloween.set(true));
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().halloween.on()), { timeout: 15000 }).toBe(true);
  expect(await page.evaluate(() => window.PlazaDebug().halloween.background())).toBe(0x0d1630);
  expect(await page.evaluate(() => window.PlazaDebug().halloween.fountain())).toBe(false);
  await expect.poll(() => page.evaluate(() => { const s = window.PlazaDebug().assets.shown; return [s['landmark.halloween.pedestal'], s['landmark.halloween.lantern']]; }), { timeout: 90000 }).toEqual(['model', 'model']);
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().halloween.glows()), { timeout: 30000 }).toBeGreaterThan(1); // the model's own glow joined
  expect(await page.evaluate(() => window.PlazaDebug().halloween.candle())).toBeGreaterThan(20);
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().halloween.glass().lit), { timeout: 60000 }).toBeGreaterThan(0);
  // v1.10.38 섬 전체 할로윈: jack-o'-lanterns along the walks and at the doors, scarecrows, strings, lamps orange, the sky
  const decor = await page.evaluate(() => window.PlazaDebug().halloween.decor());
  expect(decor.shown).toBe(true);
  expect(decor.kinds.pumpkinA + decor.kinds.pumpkinB).toBeGreaterThan(40);
  expect([decor.kinds.stack > 9, decor.kinds.scarecrow > 3, decor.kinds.hay > 3, decor.kinds.cauldron > 1, decor.kinds.bunting > 10, decor.kinds.lights > 2]).toEqual([true, true, true, true, true, true]);
  expect([decor.wisps > 10, decor.bats > 10, decor.moon]).toEqual([true, true, true]);
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().halloween.decor().shades), { timeout: 60000 }).toBe(true); // over the lamp models
  // v1.10.39: the Codex decor pack in place of the stand-ins, the bats beating their wings
  await expect.poll(() => page.evaluate(() => { const s = window.PlazaDebug().assets.shown; return ['pumpkinA', 'pumpkinB', 'stack', 'hay', 'scarecrow', 'cauldron', 'broom', 'bunting', 'lights'].map((k) => s[`halloween.${k}`]); }), { timeout: 90000 }).toEqual(Array(9).fill('model'));
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().halloween.decor().batsFlapping), { timeout: 60000 }).toBe(15);
  // v1.10.46: drawn instanced (body, two wings), flying a straight way across and on -- never hanging in one place
  expect((await page.evaluate(() => window.PlazaDebug().halloween.decor())).batInstanced).toBeGreaterThanOrEqual(2);
  await page.evaluate(() => window.PlazaDebug().halloween.launchBats());
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().halloween.decor().batsFlying), { timeout: 15000 }).toBe(15);
  const ways = (await page.evaluate(() => window.PlazaDebug().halloween.decor().flights)).filter((f) => f.on);
  expect(ways.length).toBe(3);
  for (const f of ways) expect(Math.hypot(f.dir.x, f.dir.z)).toBeCloseTo(1, 3);
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().quests().map((q) => q.id)), { timeout: 30000 }).toContain('questkid'); // the costumed kid's request (October)
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().wardrobe), { timeout: 90000 }).toEqual(expect.arrayContaining(['wear.outfit_hw_witch', 'wear.hat_hw_witch', 'wear.cape_hw_moon']));
  // the rest of the year: the day and the fountain back
  await page.evaluate(() => window.PlazaDebug().halloween.set(false));
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().halloween.on()), { timeout: 15000 }).toBe(false);
  expect(await page.evaluate(() => [window.PlazaDebug().halloween.fountain(), window.PlazaDebug().halloween.background(), window.PlazaDebug().halloween.glass().lit, window.PlazaDebug().halloween.decor().shown])).toEqual([true, 0xbfe6ff, 0, false]);
  await expectNoScriptError(page);
  await who.context.close();
});

// Real train models: both LOD door mixers, shared carriage files, platform swap and the riding clip contract.
test('관광열차 실물: 4객차·2승강장 High/Low 로드와 문 열기·닫기', async ({ browser, request }) => {
  test.setTimeout(120000);
  const { REGISTRY } = require('../../public/plaza/island-assets.js');
  const a = await island(browser, request, '열차모델', { __only: true, 'train.car': REGISTRY['train.car'], 'train.platform': REGISTRY['train.platform'] });
  await a.page.evaluate(() => window.PlazaDebug().halloween.set(false));
  await expect.poll(() => a.page.evaluate(() => window.PlazaDebug().train().cars.every((c) => c.model)), { timeout: 30000 }).toBe(true);
  expect(await a.page.evaluate(() => window.PlazaDebug().train().cars.map((c) => ({ mixers: c.mixers, wheels: c.wheels })))).toEqual([{ mixers: 2, wheels: 8 }, { mixers: 2, wheels: 8 }, { mixers: 2, wheels: 8 }, { mixers: 2, wheels: 8 }]);
  const d = await debug(a.page); expect(d.assets.shown).toMatchObject({ 'train.car': 'model', 'train.platform': 'model' });
  expect(d.assets.files).toMatchObject({ '/assets/island/train-v1/train_carriage.glb': 'loaded', '/assets/island/train-v1/train_carriage_low.glb': 'loaded', '/assets/island/train-v1/train_platform.glb': 'loaded', '/assets/island/train-v1/train_platform_low.glb': 'loaded' });
  const shift = async (sec) => { const now = Date.now(); await post(request, '/api/test/train-shift', a.token, { ms: Math.ceil(now / 240000) * 240000 + sec * 1000 - now }); };
  await shift(235);
  await expect.poll(() => a.page.evaluate(() => window.PlazaDebug().train().cars.find((c) => c.id === 1).opened), { timeout: 12000 }).toBe(true);
  const st = await a.page.evaluate(() => window.IslandTrain.stationOf('B').spot);
  await a.page.evaluate(([x, z]) => window.PlazaWarp(x, z), [st.x, st.z]);
  await a.page.evaluate(() => { const p=window.IslandTrain.stationOf('B').spot,l=window.IslandTrain.liftOf('B');window.PlazaDebug().setCamYaw(Math.atan2(p.x-l.x,p.z-l.z)); });
  await a.page.screenshot({ path: require('node:path').join(test.info().outputDir, 'train-station.png') });
  await a.page.evaluate(() => window.PlazaDebug().overview(true));
  await a.page.screenshot({ path: require('node:path').join(test.info().outputDir, 'train-route-overview.png') });
  await shift(355);
  const south = await a.page.evaluate(() => window.IslandTrain.stationOf('D').spot);
  await a.page.evaluate(([x,z]) => { window.PlazaDebug().overview(false); window.PlazaWarp(x,z); }, [south.x,south.z]);
  await a.page.evaluate(() => { const p=window.IslandTrain.stationOf('D').spot,l=window.IslandTrain.liftOf('D');window.PlazaDebug().setCamYaw(Math.atan2(p.x-l.x,p.z-l.z)); });
  await a.page.screenshot({ path: require('node:path').join(test.info().outputDir, 'train-south-station.png') });
  await shift(280);
  await expect.poll(() => a.page.evaluate(() => window.PlazaDebug().train().cars.find((c) => c.id === 1).opened), { timeout: 12000 }).toBe(false);
  await post(request, '/api/test/train-shift', a.token, { ms: 0 }); expect(a.errors).toEqual([]); await expectNoScriptError(a.page); await a.context.close();
});
