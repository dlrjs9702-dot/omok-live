const { test, expect, devices } = require('@playwright/test');
const { shopper, post, get, buyAndEquip, twoPlayerRoom, expectNoScriptError } = require('./skin-support');
const { REGISTRY, wardrobeOf } = require('../../public/plaza/island-assets');
const { characters } = require('../../public/plaza/character-transformations');
const { IP_GAME } = require('../../public/plaza/skins-x2');

const native = id => characters.find(c => c.id === id);
const used=new Set(['character.base',...['male','female'].flatMap(gender=>wardrobeOf({gender}).parts),
  ...['kuromi','mymelody','animal-cat'].flatMap(id=>['character.transform.'+id,...['male','female'].flatMap(gender=>wardrobeOf({gender,...native(id).items}).parts)])]);
const selected=Object.fromEntries(Object.entries(REGISTRY).map(([id,entry])=>[id,used.has(id)?entry:null]));
function screenBrowser(browser, isMobile) {
  return { newContext: options => browser.newContext({ ...options, ...(isMobile ? devices['Pixel 5'] : {}) }) };
}
async function enterIsland(browser, request, label, isMobile) {
  return shopper(screenBrowser(browser, isMobile), request, label, 10000000, 'male', async context => {
    await context.addInitScript(registry => {
      if (!/^https?:$/.test(location.protocol)) return;
      localStorage.removeItem('gc.testClassic');
      localStorage.setItem('gc.testIslandAssets', JSON.stringify(registry));
      localStorage.setItem('gc.islandZoom', '5');
      localStorage.setItem('gc.testHalloween', 'off');
    }, selected);
  });
}
async function transformed(who, id) {
  await expect.poll(() => who.page.evaluate(() => window.PlazaDebug?.()?.transformation), { timeout: 60000 }).toBe(id);
  expect(await who.page.evaluate(() => window.PlazaDebug().nativeRig)).toBe(native(id).rig.id);
}
async function wearSet(request, who, id) {
  for (const [slot,item] of Object.entries(native(id).items)) {
    const place=slot==='outfit'?'avatar':slot==='hair'?'hair':'accessories';
    const door=await who.page.evaluate(async place => { const door=window.PlazaDebug().doors[place];await window.PlazaWarp(door.x,door.z);return door; },place);
    await expect.poll(async()=>{const p=(await get(request,'/api/plaza/spot',who.token)).data.spot;return p?Math.hypot(p.x-door.x,p.z-door.z):Infinity;},{timeout:10000}).toBeLessThan(2.4);
    await buyAndEquip(request,who,[item]);
  }
}

test('전신 변신: 얼굴·자체 관절, 원격 Low, 이동·앉기, 부분 해제·동물 변신 복원', async ({ browser, request, isMobile }, testInfo) => {
  test.setTimeout(240000);
  const a = await enterIsland(browser, request, '변신쿠로미', isMobile);
  const b = await enterIsland(browser, request, '변신멜로디', isMobile);
  const errors = [];
  for (const who of [a,b]) who.page.on('pageerror', error => errors.push(error.message));
  await post(request, '/api/avatar/gender', b.token, { gender: 'female' });
  for (const [who,id] of [[a,'kuromi'],[b,'mymelody']]) {
    await wearSet(request, who, id); await who.page.reload(); await transformed(who,id);
    await who.page.evaluate(async id => { const d=window.PlazaDebug();d.halloween.set(false);d.setCamYaw(0);await window.PlazaWarp(id==='kuromi'?-10:-4,0); },id);
    await expect.poll(()=>who.page.evaluate(()=>window.PlazaDebug().halloween.on())).toBe(false);
    await who.page.screenshot({ path: testInfo.outputPath(`${id}.png`) });
  }
  await expect.poll(() => a.page.evaluate(() => window.PlazaDebug().assets.wearing.some(w => w.transformation === 'mymelody')), { timeout: 30000 }).toBe(true);
  const start = await a.page.evaluate(() => window.PlazaDebug().z);
  await a.page.keyboard.down('ArrowUp');
  await expect.poll(() => a.page.evaluate(() => window.PlazaDebug().gait)).toBe('walk');
  await a.page.keyboard.up('ArrowUp');
  expect(await a.page.evaluate(() => window.PlazaDebug().z)).toBeLessThan(start);
  await a.page.evaluate(() => window.PlazaDebug().holdQuality(0));
  await b.page.evaluate(async () => { await window.PlazaWarp(65,65); });
  await expect.poll(() => a.page.evaluate(() => window.PlazaDebug().assets.wearing.some(w => w.transformation === 'mymelody' && !w.high)), { timeout: 30000 }).toBe(true);
  await b.context.close(); // remote LOD is verified; release its 3D renderer before the remaining local interactions
  const seat = await a.page.evaluate(() => {
    const d=window.PlazaDebug(); const seat=d.seats.find(s => !d.takenSeats()[s.id]); d.teleport(seat.x,seat.z); return seat;
  });
  await expect(a.page.locator('#plazaHint')).toContainText('앉');
  if (isMobile) await a.page.locator('#plazaHint').tap();
  else await a.page.keyboard.press('Space');
  await expect.poll(() => a.page.evaluate(() => window.PlazaDebug().act().sitting)).toBe(true);
  await expect.poll(() => a.page.evaluate(() => window.PlazaDebug().act().clip), {timeout:15000}).toMatch(/SitIdle/);
  await a.page.screenshot({ path: testInfo.outputPath('kuromi-seated.png') });
  await a.page.keyboard.down('ArrowUp');
  await expect.poll(() => a.page.evaluate(() => window.PlazaDebug().act().sitting)).toBe(false);
  await a.page.keyboard.up('ArrowUp');
  expect(seat.id).toBeTruthy();
  expect((await post(request, '/api/skins/equip', a.token, { game:'avatar', slot:'hat', skinId:null })).status).toBe(200);
  await a.page.reload();
  await expect.poll(() => a.page.evaluate(() => window.PlazaDebug?.()?.wardrobe), { timeout:60000 }).toEqual(expect.arrayContaining(['wear.ip_kuromi_outfit']));
  expect(await a.page.evaluate(() => window.PlazaDebug().transformation)).toBeNull();
  await wearSet(request,a,'animal-cat');
  await post(request,'/api/avatar/gender',a.token,{gender:'female'});
  await a.page.reload(); await transformed(a,'animal-cat');
  await a.page.screenshot({path:testInfo.outputPath('cat.png')});
  for (const who of [a,b]) if(!who.page.isClosed()) { await expectNoScriptError(who.page); await who.context.close(); }
  expect(errors).toEqual([]);
});

test('캐릭터 게임 33종: 원색 유지·짝 구분·미리보기, 실제 윷방 착용·선택', async ({ browser, request, isMobile }, testInfo) => {
  test.setTimeout(150000);
  const classic=async context=>context.addInitScript(()=>{if(/^https?:$/.test(location.protocol))localStorage.setItem('gc.testClassic','1');});
  const a=await shopper(screenBrowser(browser,isMobile),request,'윷쿠로미',1000000,'male',classic);
  const b=await shopper(screenBrowser(browser,isMobile),request,'윷멜로디',1000000,'male',classic);
  const result=await a.page.evaluate(rows => {
    const result=[]; const grid=document.createElement('div'); grid.id='native-art-review';
    Object.assign(grid.style,{position:'fixed',inset:'0',background:'#eee7dc',zIndex:'99999',overflow:'auto',display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'8px',padding:'12px'});
    for(const [game,char,tier] of rows) {
      const id=game+(tier==='theme'?'_ipt_':'_ip_')+char;const d=SkinLooks.def(id);
      if(!d)throw new Error('missing game art: '+id);
      const c=document.createElement('canvas');c.width=180;c.height=140;
      const ctx=c.getContext('2d');d.preview(ctx,180,110);ctx.fillStyle='#222';ctx.font='12px sans-serif';ctx.fillText(id,3,130);grid.append(c);
      if(game==='davinci'&&tier!=='theme')for(const color of ['black','white'])for(const revealed of [false,true]){const style=d.tile(color,revealed);if(!style.backgroundImage||!style.color)throw new Error('invalid tile style: '+id);}
      if(game==='pictionary'&&tier!=='theme'){d.cursor(ctx,32);d.preview(ctx,180,110);}
      const pixels=ctx.getImageData(0,0,180,100).data;let painted=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i])painted++;
      let distinct=true;
      if(d.stone){const keys=[];for(const color of ['black','white']){ctx.clearRect(0,0,180,140);ctx.save();ctx.translate(90,70);d.stone(ctx,40,color,'1');ctx.restore();keys.push(Array.from(ctx.getImageData(0,0,180,140).data).join(','));}distinct=keys[0]!==keys[1];d.preview(ctx,180,110);}
      result.push({id,painted,distinct});
    }
    document.body.append(grid);return result;
  },IP_GAME);
  expect(result).toHaveLength(33);
  for(const item of result){expect(item.painted,item.id).toBeGreaterThan(100);expect(item.distinct,item.id).toBe(true);}
  await a.page.screenshot({path:testInfo.outputPath('game-art.png')});
  await a.page.evaluate(()=>document.getElementById('native-art-review').remove());
  await buyAndEquip(request,a,['yut_ip_kuromi','yut_ipt_kuromi']);
  await buyAndEquip(request,b,['yut_ip_kuromi']);
  await twoPlayerRoom(request,a,b,'yut');
  for(const who of [a,b]) {
    await expect(who.page.locator('#board')).toBeVisible();
    await expect(who.page.locator('#chooseBlackBtn')).toContainText('흑 선택');
    await expect(who.page.locator('#chooseWhiteBtn')).toContainText('백 선택');
    await expect(who.page.locator('#gameScoreText')).toContainText('흑 완주');
    expect(await who.page.evaluate(()=>SkinLooks.def('yut_ip_kuromi').characterSides)).toEqual({black:'kuromi',white:'mymelody'});
    await expectNoScriptError(who.page);
    await who.page.screenshot({path:testInfo.outputPath(`yut-${who===a?'black':'white'}.png`)});
    await who.context.close();
  }
});
