const { test, expect } = require('@playwright/test');
const { post, get, shopper, expectNoScriptError } = require('./skin-support');

// v1.10.37 혼자 하는 게임 · 연계 퀘스트 · 원거리 플레이어 (사용자 확정 2026-10-06/07). PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

async function islandPage(page) {
  await page.setViewportSize({ width: 960, height: 680 });
  await page.evaluate(() => {
    localStorage.removeItem('gc.testClassic');
    // Story/dialogue/account-state checks do not need October's decorative night scene.
    // Its real models and lighting remain covered by island-assets.spec.js.
    localStorage.setItem('gc.testHalloween', 'off');
    localStorage.setItem('gc.testIslandAssets', JSON.stringify(Object.fromEntries(Object.keys(window.IslandAssets.REGISTRY).map((id) => [id, null]))));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug?.()?.running), { timeout: 30000 }).toBe(true);
}

test('지뢰찾기: 로비 「지뢰찾기」 → 난이도·판, 오른쪽 클릭 깃발, 다 열면 클리어·보상·최고 기록', async ({ browser, request }) => {
  test.setTimeout(150000);
  const a = await shopper(browser, request, '지뢰손님');
  const { page, token } = a;
  await page.locator('#soloMinesBtn').click();
  await expect(page.locator('#minesDialog')).toBeVisible();
  await expect(page.locator('#minesLevels button')).toHaveText(['초급 2,000P', '중급 4,000P', '고급 8,000P']);
  await expect(page.locator('#minesBoard .minesCell')).toHaveCount(81);
  const cell = (i) => page.locator(`#minesBoard .minesCell[data-i="${i}"]`);
  await cell(40).click();
  await expect(cell(40)).toHaveClass(/open/);
  const mines = new Set((await post(request, '/api/test/solo/peek', token, { ageMs: 60000 })).data.mines);
  const mine = [...mines][0];
  await cell(mine).click({ button: 'right' });
  await expect(cell(mine)).toHaveClass(/flag/);
  await expect(page.locator('#minesLeft')).toHaveText('💣 9');
  const before = (await get(request, '/api/points', token)).data.balance;
  for (let i = 0; i < 81; i += 1) {
    if (mines.has(i) || /open/.test(await cell(i).getAttribute('class'))) continue;
    await cell(i).click();
    await expect(cell(i)).toHaveClass(/open/);
    if (/클리어/.test(await page.locator('#minesStatus').textContent())) break;
  }
  await expect(page.locator('#minesStatus')).toContainText('클리어');
  await expect(page.locator('#minesStatus')).toContainText('+2,000P');
  await expect(page.locator('#minesBest')).toContainText('최고');
  expect((await get(request, '/api/points', token)).data.balance).toBe(before + 2000);
  await page.locator('#minesCloseBtn').click();
  await expectNoScriptError(page);
  await a.context.close();
});

test('연계 퀘스트: 할머니 노란 별 → 말 걸기 부탁·추적 줄 → 다 하면 초록 ✓ → 보고 보상', async ({ browser, request }) => {
  test.setTimeout(150000);
  const a = await shopper(browser, request, '부탁손님');
  await islandPage(a.page);
  // This story fixture warps between objectives. Keep periodic poses at the fixture position so an old
  // pre-warp response cannot put either person back beside the other and select the greeting instead.
  const pin = who => who.page.route('**/api/plaza/state', route => {
    const pose=route.request().postDataJSON();
    return route.continue({postData:JSON.stringify(who.testAt ? {...pose,...who.testAt} : pose)});
  });
  await pin(a);
  const move = async (who,at) => {
    who.testAt={x:at.x,z:at.z}; // pin periodic requests before awaiting the authoritative warp response
    // One browser round trip still performs the real leave, authoritative placement and local correction in order.
    const placed=await who.page.evaluate(async ({x,z,token})=>{
      await window.PlazaWarp(x,z);
      const response=await fetch('/api/plaza/state',{method:'POST',headers:{'Content-Type':'application/json','X-Session-Token':token},body:JSON.stringify({x,z,yaw:0,moving:false})});
      const data=await response.json();
      if(response.ok) window.PlazaDebug().teleport(data.x,data.z);
      return {status:response.status,x:data.x,z:data.z};
    },{...who.testAt,token:who.token});
    expect(placed.status).toBe(200);who.testAt={x:placed.x,z:placed.z};
  };
  const talkSpot=require('../../lib/island-quests').STORIES.granny.at;
  const standBy=async()=>{await move(a,{x:talkSpot.x-1,z:talkSpot.z});await expect.poll(()=>a.page.evaluate(()=>window.PlazaDebug().near),{timeout:10000}).toBe('ev:quest_npc:questgranny');};
  const { page, token } = a;
  const talk=async(alreadyPlaced=false)=>{
    await expect(page.locator('#plazaDialog')).toBeHidden();
    if(!alreadyPlaced) await standBy();
    else await expect.poll(()=>page.evaluate(()=>window.PlazaDebug().near),{timeout:10000}).toBe('ev:quest_npc:questgranny');
    expect(await page.evaluate(()=>{const stage=document.getElementById('plazaStage');stage.focus();return document.activeElement===stage;})).toBe(true);
    const reply=page.waitForResponse(r=>r.url().endsWith('/api/island/event') && r.request().method()==='POST');
    await page.keyboard.press('Space');
    const response=await reply; expect(response.status()).toBe(200);
    expect((await response.json()).story).toBe('granny');
    await expect(page.locator('#plazaDialog')).toBeVisible();
  };
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().quests()), { timeout: 20000 }).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'questgranny', mark: 'new' })]));
  await standBy();
  await expect(page.locator('#plazaHint')).toHaveText('SPACE · 말 걸기', { timeout: 10000 });
  await talk(true); // already standing here: still verify the selected NPC, focused stage and actual server reply
  await Promise.all([
    expect(page.locator('#plazaDialog')).toBeVisible({ timeout: 10000 }),
    expect(page.locator('#plazaDialog')).toContainText('정원사 할머니'),
    expect(page.locator('#plazaDialog')).toContainText('잡초 20포기'),
  ]);
  // A previous close task can arrive after the next dialogue has already opened.
  await page.evaluate(() => document.getElementById('plazaDialog').dispatchEvent(new Event('close')));
  await expect(page.locator('#plazaDialog .lostRequest')).toBeVisible();
  await expect(page.locator('#plazaDialog')).toContainText('잡초 20포기');
  await page.locator('#plazaDialog .lostRequest button, #plazaDialog button.primary').first().click();
  await expect(page.locator('#questTracker')).toHaveText('정원사 할머니 · 잡초 0/20', { timeout: 10000 });
  await post(request, '/api/test/quest/note', token, { what: 'weed', qty: 20 });
  await expect(page.locator('#questTracker')).toContainText('완료 ✓', { timeout: 15000 });
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().quests().find((q) => q.id === 'questgranny').mark), { timeout: 10000 }).toBe('ready');
  await talk();
  await Promise.all([expect(page.locator('#plazaDialog')).toContainText('+2,000P'),expect(page.locator('#plazaDialog')).toContainText('열매 5개')]);
  // v1.10.49: only the account whose server story is done sees the flowerbed bloom.
  await page.keyboard.press('Escape');
  expect((await post(request, '/api/test/island/give', token, { itemId: 'berry', qty: 5 })).status).toBe(200);
  await talk();
  await expect(page.locator('#plazaDialog')).toContainText('강가에 꽃');
  await page.keyboard.press('Escape');
  await move(a,{x:47,z:38.3});
  await expect(page.locator('#questTracker')).toContainText('완료 ✓', { timeout: 15000 });
  await talk();
  await expect(page.locator('#plazaDialog')).toContainText('정원이 환해졌');
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().questScenes()), { timeout: 15000 }).toMatchObject({ flower: 'bloom', frame: true });
  await page.keyboard.press('Escape');
  await expectNoScriptError(page);await a.context.close();
});

test('연계 퀘스트: 할머니 결과는 계정별·재접속 유지, 멀리 있는 사람 이름표는 보인다', async ({ browser, request }) => {
  test.setTimeout(150000);
  const a=await shopper(browser,request,'정원결과');const {page,token}=a;
  const story=require('../../lib/island-quests').STORIES.granny;
  // Prepare an independent account through the existing server engine; the previous test covers every dialogue.
  const place=async at=>{
    expect((await post(request,'/api/plaza/leave',token,{})).status).toBe(200);
    expect((await post(request,'/api/plaza/state',token,{...at,yaw:0,moving:false})).status).toBe(200);
  };
  const report=async()=>{const r=await post(request,'/api/island/event',token,{id:'questgranny'});expect(r.status).toBe(200);return r.data;};
  await place(story.at);await report();
  expect((await post(request,'/api/test/quest/note',token,{what:'weed',qty:20})).status).toBe(200);await report();
  expect((await post(request,'/api/test/island/give',token,{itemId:'berry',qty:5})).status).toBe(200);await report();
  await place(story.steps[2].spot);await place(story.at);expect(await report()).toMatchObject({story:'granny',done:true});
  await islandPage(page);
  await expect.poll(()=>page.evaluate(()=>window.PlazaDebug().questScenes()),{timeout:15000}).toMatchObject({flower:'bloom',frame:true});
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug?.()?.questScenes()), { timeout: 30000 }).toMatchObject({ flower: 'bloom', frame: true });
  const b = await shopper(browser, request, '멀리손님');
  await islandPage(b.page);
  const far=(await get(request,'/api/test/island/events',b.token)).data.events.find(e=>e.type==='berry' && Math.hypot(e.x,e.z)>50);
  await b.page.evaluate(at=>window.PlazaWarp(at.x,at.z),far);
  const placed=await post(request,'/api/plaza/state',b.token,{...far,yaw:0,moving:false});expect(placed.status).toBe(200);
  await b.page.evaluate(at=>window.PlazaDebug().teleport(at.x,at.z),placed.data);
  await expect.poll(() => b.page.evaluate(() => window.PlazaDebug().questScenes()), { timeout: 15000 }).toMatchObject({ flower: 'empty', frame: false });
  // someone far off: the name tag is drawn out of the fog, the chat bubble only near
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().farSight()), { timeout: 20000 }).toEqual([expect.objectContaining({ tag: true })]);
  await expectNoScriptError(page);
  await a.context.close(); await b.context.close();
});

test('어부 결과 장면: 기존 주간 이야기 완료 직후 출항, 재접속에는 반복하지 않는다', async ({ browser, request }) => {
  test.setTimeout(150000);
  const a = await shopper(browser, request, '출항손님');
  await islandPage(a.page);
  const { page, token } = a;
  // The fisher's existing final step departs once; reconnect keeps the completed state.
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().quests().some((q) => q.id === 'questfisher')), { timeout: 20000 }).toBe(true);
  await page.evaluate(() => window.PlazaDebug().place('ev:quest_npc:questfisher'));
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().near), { timeout: 10000 }).toBe('ev:quest_npc:questfisher');
  await page.locator('#plazaStage').focus(); await page.keyboard.press('Space');
  await expect(page.locator('#plazaDialog')).toContainText('해안 쓰레기 5개');
  await page.locator('#plazaDialog .lostRequest button, #plazaDialog button.primary').first().click();
  await page.keyboard.press('Escape');
  await post(request, '/api/test/quest/note', token, { what: 'beach_trash', qty: 5 });
  await expect(page.locator('#questTracker')).toContainText('완료 ✓', { timeout: 15000 });
  await page.locator('#plazaStage').focus(); await page.keyboard.press('Space');
  await expect(page.locator('#plazaDialog')).toContainText('버섯 3개');
  await page.keyboard.press('Escape');
  await post(request, '/api/test/island/give', token, { itemId: 'mushroom', qty: 3 });
  await expect(page.locator('#questTracker')).toContainText('완료 ✓', { timeout: 15000 });
  await page.locator('#plazaStage').focus(); await page.keyboard.press('Space');
  await expect(page.locator('#plazaDialog')).toContainText('출항');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.PlazaDebug().teleport(5, 92));
  await expect(page.locator('#questTracker')).toContainText('완료 ✓', { timeout: 15000 });
  await page.evaluate(() => window.PlazaDebug().place('ev:quest_npc:questfisher'));
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().near), { timeout: 10000 }).toBe('ev:quest_npc:questfisher');
  await page.locator('#plazaStage').focus(); await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().questScenes()), { timeout: 10000 }).toMatchObject({ boat: true, departing: true });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug?.()?.questScenes()), { timeout: 30000 }).toMatchObject({ boat: false, departing: false });
  await expectNoScriptError(page);
  await a.context.close();
});
