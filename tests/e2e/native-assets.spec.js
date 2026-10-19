const { test, expect, devices } = require('@playwright/test');
const { shopper, post, get, buyAndEquip, twoPlayerRoom, expectNoScriptError } = require('./skin-support');
const { REGISTRY, wardrobeOf } = require('../../public/plaza/island-assets');
const { characters } = require('../../public/plaza/character-transformations');
const { IP_GAME } = require('../../public/plaza/skins-x2');

const native = id => characters.find(c => c.id === id);
// v1.10.91 (사용자 2026-10-18 A안): a set's parts and, apart, its transformation (bought and chosen at the 변신 의상실)
const tfOf = id => `avatar_tf_${id.replace(/-/g, '_')}`;
const withTf = id => [...Object.values(native(id).items), tfOf(id)];
const used=new Set(['character.base',...['male','female'].flatMap(gender=>wardrobeOf({gender}).parts),
  ...['kuromi','mymelody','animal-cat'].flatMap(id=>['character.transform.'+id,...['current','native'].map(mode=>`character.transform.${id}.${mode}`),...['male','female'].flatMap(gender=>wardrobeOf({gender,...native(id).items}).parts)])]);
const selected=Object.fromEntries(Object.entries(REGISTRY).map(([id,entry])=>[id,used.has(id)?entry:null]));
function screenBrowser(browser, isMobile) {
  return { newContext: options => browser.newContext({ ...options, ...(isMobile ? devices['Pixel 5'] : {}) }) };
}
async function nativeShopper(browser, request, label, isMobile) {
  return shopper(screenBrowser(browser, isMobile), request, label, 10000000, 'male', async context => {
    await context.addInitScript(registry => {
      if (!/^https?:$/.test(location.protocol)) return;
      if (!localStorage.getItem('gc.testNativePrepared')) {
        localStorage.setItem('gc.testClassic','1'); // purchase first; then enter the actual island with the saved set
        localStorage.setItem('gc.testNativePrepared','1');
      }
      localStorage.setItem('gc.testIslandAssets', JSON.stringify(registry));
      localStorage.setItem('gc.islandZoom', '5');
      localStorage.setItem('gc.testHalloween', 'off');
    }, selected);
  });
}
async function transformed(who, id, mode = 'native') {
  await expect.poll(() => who.page.evaluate(() => Boolean(window.PlazaDebug?.()?.running)).catch(() => false), { timeout: 60000 }).toBe(true); // (CI 2차: the island shown first, then its model)
  await expect.poll(() => who.page.evaluate(() => window.PlazaDebug?.()?.transformation), { timeout: 60000 }).toBe(id);
  await expect.poll(() => who.page.evaluate(id => window.PlazaDebug().assets.wearing.find(w=>w.transformation===id)?.transformationMode,id)).toBe(mode);
  expect(await who.page.evaluate(() => window.PlazaDebug().nativeRig)).toBe(native(id).variants[mode].rig.id);
}
async function startIsland(who,id,mode = 'native') {
  await who.page.evaluate(()=>localStorage.removeItem('gc.testClassic'));
  await who.page.reload();await transformed(who,id,mode);
}

test('전신 변신: 두 체형·얼굴·관절, 원격 Low, 이동·앉기', async ({ browser, request, isMobile }, testInfo) => {
  test.setTimeout(180000);
  const a = await nativeShopper(browser, request, '변신쿠로미', isMobile);
  const b = await nativeShopper(browser, request, '변신멜로디', isMobile);
  const errors = [];
  for (const who of [a,b]) who.page.on('pageerror', error => errors.push(error.message));
  await post(request, '/api/avatar/gender', b.token, { gender: 'female' });
  for (const [who,id] of [[a,'kuromi'],[b,'mymelody']]) {
    await buyAndEquip(request,who,withTf(id));
    const mode = who === a ? 'current' : 'native';
    expect((await post(request,'/api/avatar/transformation',who.token,{characterId:id,mode})).status).toBe(200);
    await startIsland(who,id,mode);
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
  expect(await a.page.evaluate(() => window.PlazaDebug().act().clip)).toMatch(/SitDown|SitIdle/); // both are valid phases of the seated animation
  await a.page.screenshot({ path: testInfo.outputPath('kuromi-seated.png') });
  await a.page.keyboard.down('ArrowUp');
  await expect.poll(() => a.page.evaluate(() => window.PlazaDebug().act().sitting)).toBe(false);
  await a.page.keyboard.up('ArrowUp');
  expect(seat.id).toBeTruthy();
  await expectNoScriptError(a.page);await a.context.close();expect(errors).toEqual([]);
});

test('전신 변신 복원: 부분 해제와 고양이 세트·여성 외형·재접속', async ({browser,request,isMobile},testInfo)=>{
  test.setTimeout(150000);
  const a=await nativeShopper(browser,request,'변신복원',isMobile),errors=[];
  a.page.on('pageerror',error=>errors.push(error.message));
  await buyAndEquip(request,a,withTf('kuromi'));
  for(const skinId of withTf('animal-cat'))expect((await post(request,'/api/skins/buy',a.token,{skinId})).status).toBe(200);
  await startIsland(a,'kuromi');
  expect((await post(request, '/api/skins/equip', a.token, { game:'avatar', slot:'transform', skinId:null })).status).toBe(200); // the transformation off (the parts stay)
  await a.page.reload();
  await expect.poll(() => a.page.evaluate(() => window.PlazaDebug?.()?.wardrobe), { timeout:60000 }).toEqual(expect.arrayContaining(['wear.ip_kuromi_outfit']));
  expect(await a.page.evaluate(() => window.PlazaDebug().transformation)).toBeNull();
  for(const skinId of withTf('animal-cat'))expect((await post(request,'/api/skins/equip',a.token,{skinId})).status).toBe(200);
  await post(request,'/api/avatar/gender',a.token,{gender:'female'});
  await a.page.reload(); await transformed(a,'animal-cat');
  await a.page.screenshot({path:testInfo.outputPath('cat.png')});
  await expectNoScriptError(a.page);await a.context.close();
  expect(errors).toEqual([]);
});

test('변신 체형 선택: 상점·내 정보, 저장·무료 변경·부분 해제·사람형 제한', async ({browser,request,isMobile},testInfo)=>{
  test.setTimeout(180000);
  const classic = context=>context.addInitScript(()=>{if(/^https?:$/.test(location.protocol))localStorage.setItem('gc.testClassic','1');});
  const a=await shopper(screenBrowser(browser,isMobile),request,'체형선택',10000000,'female',classic);
  const errors=[];a.page.on('pageerror',error=>errors.push(error.message));
  await buyAndEquip(request,a,withTf('kuromi'));
  const before=(await get(request,'/api/skins',a.token)).data;
  const openShop=async()=>{
    await a.page.locator('#skinShopBtn').click();
    await a.page.locator('#skinShopDialog .skinTab[data-family="avatar"]').click();
    return a.page.getByRole('group',{name:'쿠로미 체형'});
  };
  const choose=async (group,label)=>{const button=group.getByRole('button',{name:label,exact:true});if(isMobile)await button.tap();else await button.click();};
  let group=await openShop();
  await expect(group.getByRole('button',{name:'고유 체형',exact:true})).toHaveAttribute('aria-pressed','true');
  let release;
  const gate=new Promise(resolve=>{release=resolve;});
  await a.page.route('**/api/avatar/transformation',async route=>{await gate;await route.continue();});
  await choose(group,'우리 체형');
  await expect(group.getByRole('button',{name:'우리 체형',exact:true})).toBeDisabled();
  await expect(group.getByRole('button',{name:'고유 체형',exact:true})).toBeDisabled();
  release();
  await expect(group.getByRole('button',{name:'우리 체형',exact:true})).toHaveAttribute('aria-pressed','true');
  await a.page.unroute('**/api/avatar/transformation');
  const after=(await get(request,'/api/skins',a.token)).data;
  expect(after.balance).toBe(before.balance);
  expect(after.avatar.look.transformationModes.kuromi).toBe('current');
  const preferences=look=>Object.fromEntries(Object.entries(look).filter(([key])=>key!=='transformationModes'));
  expect(preferences(after.avatar.look)).toEqual(preferences(before.avatar.look));
  for(const theme of ['dark','light']){
    await a.page.evaluate(theme=>{document.documentElement.dataset.theme=theme;},theme);
    const layout=await group.evaluate(el=>({buttons:[...el.querySelectorAll('button')].map(b=>({width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height,left:b.getBoundingClientRect().left,right:b.getBoundingClientRect().right})),viewport:innerWidth}));
    expect(layout.buttons).toHaveLength(2);
    for(const button of layout.buttons){expect(button.width).toBeGreaterThanOrEqual(44);expect(button.height).toBeGreaterThanOrEqual(44);expect(button.left).toBeGreaterThanOrEqual(0);expect(button.right).toBeLessThanOrEqual(layout.viewport);}
    await a.page.screenshot({path:testInfo.outputPath(`transformation-choice-${theme}.png`)});
  }
  await a.page.reload();group=await openShop();
  await expect(group.getByRole('button',{name:'우리 체형',exact:true})).toHaveAttribute('aria-pressed','true');
  await a.page.locator('#skinShopCloseBtn').click();
  await a.page.keyboard.press('Escape');await a.page.locator('#myInfoBtn').click();
  group=a.page.locator('#myInfoDialog').getByRole('group',{name:'쿠로미 체형'});
  await choose(group,'고유 체형');
  await expect(group.getByRole('button',{name:'고유 체형',exact:true})).toHaveAttribute('aria-pressed','true');
  const hat=a.page.locator(`#myInfoSkinBody button[data-skin="${native('kuromi').items.hat}"]`);
  await hat.click();await expect(group.getByRole('button',{name:'고유 체형',exact:true})).toHaveAttribute('aria-pressed','true'); // a part off: still transformed (v1.10.91)
  await hat.click();
  expect((await post(request,'/api/skins/equip',a.token,{game:'avatar',slot:'transform',skinId:null})).status).toBe(200); // the transformation off, then on again: its body kept
  expect((await get(request,'/api/skins',a.token)).data.avatar.look.transform).toBeUndefined();
  expect((await post(request,'/api/skins/equip',a.token,{skinId:tfOf('kuromi')})).status).toBe(200);
  const back=(await get(request,'/api/skins',a.token)).data.avatar.look; expect([back.transform,back.transformationModes.kuromi]).toEqual(['kuromi','native']);
  expect((await get(request,'/api/skins',a.token)).data.balance).toBe(before.balance);
  await a.page.locator('#myInfoCloseBtn').click();
  await buyAndEquip(request,a,withTf('ironman'));
  await a.page.reload();await openShop();
  await expect(a.page.locator('#skinShopBody .skinTransformation')).toHaveCount(0);
  await expectNoScriptError(a.page);expect(errors).toEqual([]);await a.context.close();
});

test('캐릭터 짝 역할 안내: 흑·백과 기본 색의 대기 문구 일치', async ({browser,request,isMobile})=>{
  test.setTimeout(120000);
  const classic=context=>context.addInitScript(()=>{if(/^https?:$/.test(location.protocol))localStorage.setItem('gc.testClassic','1');});
  const a=await shopper(screenBrowser(browser,isMobile),request,'역할짝방장',2000000,'male',classic);
  const b=await shopper(screenBrowser(browser,isMobile),request,'역할짝손님',0,'male',classic);
  await buyAndEquip(request,a,['yut_ip_kuromi','dots_ip_cinnamoroll','connect4_ip_mymelody']);
  for(const game of ['yut','dots','connect4'])for(const paired of [true,false]){
    if(!paired)expect((await post(request,'/api/skins/equip',a.token,{game,slot:'piece',skinId:null})).status).toBe(200);
    const created=await post(request,'/api/rooms',a.token,{gameType:game});expect(created.status).toBe(201);
    expect((await post(request,'/api/rooms/join',b.token,{code:created.data.state.me.roomCode})).status).toBe(200);
    expect((await post(request,'/api/room/choose-role',a.token,{choice:'black'})).status).toBe(200);
    await b.page.reload();await expect(b.page.locator('#roomView')).toBeVisible();
    const [first,second]=paired?['흑','백']:game==='connect4'?['빨강','노랑']:['파랑','빨강'];
    await expect(b.page.locator('#boardOverlay')).toHaveText(`${first} · ${second} · 관전 중 역할을 선택하세요`);
    await expect(b.page.locator('#chooseBlackBtn')).toContainText(`${first} 선택`);
    await expect(b.page.locator('#chooseWhiteBtn')).toContainText(`${second} 선택`);
    if(game==='yut')await expect(b.page.locator('#yutHint')).toHaveText(`${first}과 ${second}이 정해지면 ${first}부터 시작합니다.`);
    await expectNoScriptError(b.page);
    expect((await post(request,'/api/room/leave',b.token,{})).status).toBe(200);
    expect((await post(request,'/api/room/leave',a.token,{})).status).toBe(200);
  }
  await a.context.close();await b.context.close();
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
