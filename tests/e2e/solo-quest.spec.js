const { test, expect } = require('@playwright/test');
const { post, get, shopper, expectNoScriptError, spaceOn } = require('./skin-support');

// v1.10.37 혼자 하는 게임 · 연계 퀘스트 · 원거리 플레이어 (사용자 확정 2026-10-06/07). PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

async function islandPage(page, keep = []) { // keep: the models this test needs (the others off)
  await page.setViewportSize({ width: 960, height: 680 });
  await page.evaluate((keep) => {
    localStorage.removeItem('gc.testClassic');
    // Story/dialogue/account-state checks do not need October's decorative night scene.
    // Its real models and lighting remain covered by island-assets.spec.js.
    localStorage.setItem('gc.testHalloween', 'off');
    localStorage.setItem('gc.testIslandAssets', JSON.stringify(Object.fromEntries(Object.keys(window.IslandAssets.REGISTRY).filter((id) => !keep.includes(id)).map((id) => [id, null]))));
  }, keep);
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.PlazaDebug?.()?.running), { timeout: 60000 }).toBe(true);
}

// (v1.10.249 G4: the round on the 한판마당 puzzle screen -- HUD 시간 · 「남은 지뢰」, 열기/깃발, the board drawn; the cells read
// from the game's own view and pressed at their place on the canvas)
test('지뢰찾기: 로비 「지뢰찾기」 → 한판마당 퍼즐 화면, 오른쪽 클릭 깃발, 다 열면 클리어·최고 기록', async ({ browser, request }) => {
  test.setTimeout(150000);
  const a = await shopper(browser, request, '지뢰손님');
  const { page, token } = a;
  await page.evaluate(() => { try { localStorage.setItem('gc.reflexLevels', JSON.stringify({ mines: 'beginner' })); } catch {} });
  await page.locator('[data-game-mode="single"]').click(); // v1.10.63: 지뢰찾기 is under 싱글게임
  await page.locator('#soloMinesBtn').click();
  await expect(page.locator('#reflexView .reflexFrame.playing')).toBeVisible({ timeout: 30000 });
  const view = () => page.evaluate(async () => { const { E } = await import('/reflex/js/engine.js'); return E.game?.id === 'mines' ? E.game.view() : null; });
  await expect.poll(async () => (await view())?.cells.length, { timeout: 30000 }).toBe(81);
  await expect(page.locator('#hudRight')).toHaveText('남은 지뢰 10');
  const press = async (i, opts = {}) => { const p = await page.evaluate(async (i) => { const { E } = await import('/reflex/js/engine.js'); return E.game.cellPoint(i); }, i); await page.locator('.reflexFrame > canvas').click({ position: p, ...opts }); };
  await press(40);
  await expect.poll(async () => (await view()).cells[40]).toBeGreaterThanOrEqual(0);
  const mines = new Set((await post(request, '/api/test/solo/peek', token, { ageMs: 60000 })).data.mines);
  const mine = [...mines][0];
  await press(mine, { button: 'right' });
  await expect.poll(async () => (await view()).cells[mine]).toBe(-2);
  await expect(page.locator('#hudRight')).toHaveText('남은 지뢰 9');
  const before = (await get(request, '/api/points', token)).data.balance;
  for (let i = 0; i < 81; i += 1) {
    const v = await view(); if (!v || v.status === 'won') break;
    if (mines.has(i) || v.cells[i] >= 0) continue;
    await press(i);
    await expect.poll(async () => { const w = await view(); return !w || w.status === 'won' || w.cells[i] >= 0; }).toBe(true);
  }
  await expect(page.locator('#reflexResult')).toContainText('클리어', { timeout: 10000 });
  await expect(page.locator('#reflexResult .reflexPaid')).toHaveText(/최고/);
  await expect(page.locator('#reflexResult .reflexPaid')).toHaveText(/이번 주 \d+위$/); // (v1.10.250 기록의 탑: the week's place)
  expect((await get(request, '/api/points', token)).data.balance).toBe(before); // (G-포인트: no points)
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/g4-mines-pc-result.png` });
  await page.locator('#reflexResult .hpBtn', { hasText: '게임관으로' }).click();
  await expect(page.locator('#lobbyView')).toBeVisible();
  await expectNoScriptError(page);
  await a.context.close();
});

// v1.10.250 기록의 탑 (gamecenter-notes docs/gamehall-ranking-board-20261103.md §1): before the 게임관 -- the model with its 32 bulbs,
// two flags and three written faces (the board's games turning); SPACE at its front opens the window: the week's ranking with my
// clear and my place, the all-time tab; 도전하기 opens that game's round at once
test('기록의 탑: 게임관 앞 탑(전구 32·깃발·글 면 셋), SPACE 창의 이번 주 순위·내 순위·역대, 도전하기', async ({ browser, request }) => {
  test.setTimeout(180000);
  const a = await shopper(browser, request, '탑손님'); const { page, token } = a;
  { // a clear this week first: 지뢰찾기 초급 by the API (the server's own board)
    const g = (await post(request, '/api/solo/minesweeper/new', token, { level: 'beginner' })).data;
    await post(request, '/api/solo/minesweeper/act', token, { id: g.id, action: 'open', x: 4, y: 4 });
    const mines = new Set((await post(request, '/api/test/solo/peek', token, { ageMs: 70000 })).data.mines);
    for (let i = 0; i < 81; i += 1) if (!mines.has(i)) { const r = (await post(request, '/api/solo/minesweeper/act', token, { id: g.id, action: 'open', x: i % 9, y: Math.floor(i / 9) })).data; if (r.view.status === 'won') break; }
  }
  await islandPage(page, ['gamehall.record_tower']);
  await expect.poll(() => page.evaluate(() => { const t = window.PlazaDebug().recordTower(); return [t.bulbs, t.flags >= 2, t.faces >= 3, t.backs === t.faces, t.backBulbs >= 32]; }), { timeout: 90000 }).toEqual([32, true, true, true, true]); /* (High and Low both carry the parts; v1.10.251 양면: each face on the back too) */
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().recordTower().game), { timeout: 30000 }).not.toBeNull();
  const at = await page.evaluate(() => window.PlazaDebug().recordTower().at);
  // (v1.10.251 Codex 10판 ②) all 14 firsts on the strip: the line runs past it, its letters unsqueezed (1536 × 128 shown)
  expect(await page.evaluate(() => { const D = window.PlazaDebug(); const G = window.SoloRanking.GAMES; D.setRecordBoard({ week: '2026-11-02', endsAt: Date.now() + 86400000, lastWeek: [], games: G.map((g) => ({ game: g.id, name: g.name, level: g.board, top: [{ rank: 1, name: '아주긴이름의손님', best: 123456 }] })) }); return D.recordTower().ticker; })).toEqual([1536, 128, true]);
  if (process.env.SHOT_DIR) for (const [name, time, dx, dz, yaw] of [['back', 'day', -14, 4, -Math.PI / 2 - 0.2]]) { /* (its front: a first-person photo -- the third person's camera stands in the 게임관 there) */
    await page.evaluate(([x, z, t, yaw]) => { const D = window.PlazaDebug(); D.setTime(t); D.setWeather?.('clear'); D.teleport(x, z); D.setCamYaw(yaw); D.setCamPitch?.(0.06); }, [at.x + dx, at.z + dz, time, yaw]);
    await page.waitForTimeout(2500); await page.screenshot({ path: `${process.env.SHOT_DIR}/rt-tower-${name}-pc.png` });
  }
  await page.evaluate(() => window.PlazaDebug().setTime('day'));
  { // (v1.10.251 양면) from the plaza side too: SPACE there opens the same window
    await page.evaluate(async ([x, z]) => { await window.PlazaWarp(x - 2.2, z); }, [at.x, at.z]);
    await expect.poll(() => spaceOn(page, 'board:records:back', false), { timeout: 15000 }).toBe(true);
    await expect(page.locator('#recordTowerDialog')).toBeVisible(); await page.locator('#recordTowerCloseBtn').click(); await expect(page.locator('#recordTowerDialog')).toBeHidden();
  }
  await page.evaluate(async ([x, z]) => { await window.PlazaWarp(x + 2.6, z); }, [at.x, at.z]);
  await expect.poll(() => spaceOn(page, 'board:records', false), { timeout: 15000 }).toBe(true); /* (it presses SPACE itself) */
  const dlg = page.locator('#recordTowerDialog'); await expect(dlg).toBeVisible();
  await expect(dlg.locator('#recordTowerGames .recordTowerChip')).toHaveCount(14);
  await dlg.locator('#recordTowerGames .recordTowerChip', { hasText: '지뢰찾기' }).click();
  await dlg.locator('#recordTowerLevels .recordTowerChip', { hasText: '초급' }).click();
  await expect(dlg.locator('.recordTowerRowItem.me')).toContainText('탑손님');
  await expect(dlg.locator('#recordTowerMe')).toContainText(/내 순위 \d+위/);
  await dlg.locator('#recordTowerPeriod .recordTowerChip', { hasText: '역대 최고' }).click();
  await expect(dlg.locator('.recordTowerRowItem.me')).toContainText('탑손님');
  await dlg.locator('#recordTowerPeriod .recordTowerChip', { hasText: '내 업적' }).click(); /* (v1.10.251 §3-2) */
  await expect(dlg.locator('.recordTowerTotal')).toContainText('트로피 모두'); await expect(dlg.locator('.recordTowerAward', { hasText: '지뢰찾기' })).toContainText('🥇');
  await dlg.locator('#recordTowerPeriod .recordTowerChip', { hasText: '역대 최고' }).click();
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/rt-window-pc.png` });
  await dlg.locator('#recordTowerGo').click();
  await expect(page.locator('#reflexView .reflexFrame.playing')).toBeVisible({ timeout: 30000 });
  await expect.poll(() => page.evaluate(async () => { const { E } = await import('/reflex/js/engine.js'); return E.game?.id; })).toBe('mines');
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
    expect(page.locator('#plazaDialog')).toContainText('꽃님'),
    expect(page.locator('#plazaDialog')).toContainText('잡초 20포기'),
  ]);
  // A previous close task can arrive after the next dialogue has already opened.
  await page.evaluate(() => document.getElementById('plazaDialog').dispatchEvent(new Event('close')));
  await expect(page.locator('#plazaDialog .lostRequest')).toBeVisible();
  await expect(page.locator('#plazaDialog')).toContainText('잡초 20포기');
  // (Q 부탁 받기: the ask's note and 「할게요!」 -- then it is on the task card)
  await expect(page.locator('#plazaDialog .questNote')).toContainText('할 일 · 잡초 20개');
  await page.locator('#plazaDialog').getByRole('button', { name: '할게요!' }).click();
  await expect(page.locator('#questTracker .questLine')).toHaveText(/꽃님.*잡초.*0\/20/, { timeout: 10000 });
  await page.locator('#plazaDialog').getByRole('button', { name: '확인' }).click();
  await post(request, '/api/test/quest/note', token, { what: 'weed', qty: 20 });
  await expect(page.locator('#questTracker')).toContainText('돌아가 말해요', { timeout: 15000 });
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().quests().find((q) => q.id === 'questgranny').mark), { timeout: 10000 }).toBe('ready');
  await talk();
  await Promise.all([expect(page.locator('.questDone')).toContainText('+2,000P'),expect(page.locator('#plazaDialog')).toContainText('열매 5개')]); // (the pay on the done card, their words in the bubble)
  await expect(page.locator('#plazaDialog')).not.toContainText('+2,000P');
  // v1.10.49: only the account whose server story is done sees the flowerbed bloom.
  await page.keyboard.press('Escape');
  expect((await post(request, '/api/test/island/give', token, { itemId: 'berry', qty: 5 })).status).toBe(200);
  await talk();
  await expect(page.locator('#plazaDialog')).toContainText(/강가에 \S+ 꽃이 피었다/); // (206: the colour asked)
  await page.keyboard.press('Escape');
  for (const p of require('../../lib/island-quests').TASK.flowers.spots) { // (206 구경 C안: the colour asked, smelt -- not walking in)
    await move(a,{...p}); await expect(page.locator('#plazaHint')).toContainText('꽃 · 냄새', { timeout: 10000 });
    await page.locator('#plazaStage').focus(); await page.keyboard.press('Space'); await page.waitForTimeout(1200);
    if ((await page.locator('#questTracker').textContent()).includes('돌아가 말해요')) break;
  }
  await expect(page.locator('#questTracker')).toContainText('돌아가 말해요', { timeout: 15000 });
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
  const report=async()=>{const r=await post(request,'/api/island/event',token,{id:'questgranny',accept:true});expect(r.status).toBe(200);return r.data;};
  await place(story.at);await report();
  expect((await post(request,'/api/test/quest/note',token,{what:'weed',qty:20})).status).toBe(200);await report();
  expect((await post(request,'/api/test/island/give',token,{itemId:'berry',qty:5})).status).toBe(200);await report();
  for (const [i,p] of require('../../lib/island-quests').TASK.flowers.spots.entries()) { await place(p); if ((await post(request,'/api/island/visit',token,{story:'granny',act:'choose',choice:i})).data.done) break; } // (206: the asked colour)
  await place(story.at);expect(await report()).toMatchObject({story:'granny',done:true});
  await islandPage(page);
  await expect.poll(()=>page.evaluate(()=>window.PlazaDebug().questScenes()),{timeout:15000}).toMatchObject({flower:'bloom',frame:true});
  await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug?.()?.running), { timeout: 60000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => window.PlazaDebug?.()?.questScenes()), { timeout: 30000 }).toMatchObject({ flower: 'bloom', frame: true });
  const b = await shopper(browser, request, '멀리손님');
  await islandPage(b.page);
  const far=(await get(request,'/api/test/island/events',b.token)).data.events.find(e=>e.type==='berry' && Math.hypot(e.x,e.z)>50);
  await b.page.evaluate(at=>window.PlazaWarp(at.x,at.z),far);
  const placed=await post(request,'/api/plaza/state',b.token,{...far,yaw:0,moving:false});expect(placed.status).toBe(200);
  await b.page.evaluate(at=>window.PlazaDebug().teleport(at.x,at.z),placed.data);
  await expect.poll(() => b.page.evaluate(() => window.PlazaDebug().questScenes()), { timeout: 15000 }).toMatchObject({ flower: 'empty', frame: false });
  // someone far off: the name tag is drawn out of the fog, the chat bubble only near
  // (CI 3차: b's own entry -- another test's player still on the island made the list two long, run 39695746869)
  const bId = await b.page.evaluate(() => window.PlazaDebug().myId);
  await expect.poll(() => page.evaluate((id) => window.PlazaDebug().farSight().find((o) => o.id === id) || null, bId), { timeout: 30000 }).toMatchObject({ tag: true });
  await expectNoScriptError(page);
  await a.context.close(); await b.context.close();
});

test('어부 결과 장면: 기존 주간 이야기 완료 대화를 닫은 후 출항, 재접속에는 반복하지 않는다', async ({ browser, request }) => {
  test.setTimeout(150000);
  const a = await shopper(browser, request, '출항손님');
  await islandPage(a.page);
  const { page, token } = a;
  // The fisher's existing final step departs once; reconnect keeps the completed state.
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().quests().some((q) => q.id === 'questfisher')), { timeout: 20000 }).toBe(true);
  await page.evaluate(() => window.PlazaDebug().place('ev:quest_npc:questfisher'));
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().near), { timeout: 10000 }).toBe('ev:quest_npc:questfisher');
  // (an earlier test's player by the fisher would take the SPACE -- the server lets them go in 15 s)
  await expect.poll(() => page.evaluate(() => { const d = window.PlazaDebug(); return d.others.filter((o) => Math.hypot(o.x - d.x, o.z - d.z) < 3).length; }), { timeout: 30000 }).toBe(0);
  await page.locator('#plazaStage').focus(); await page.keyboard.press('Space');
  await expect(page.locator('#plazaDialog')).toContainText('해안 쓰레기 5개');
  await page.locator('#plazaDialog').getByRole('button', { name: '할게요!' }).click(); // (Q: taken on)
  await page.locator('#plazaDialog').getByRole('button', { name: '확인' }).click(); // closes the talk
  await expect(page.locator('#plazaDialog')).toBeHidden(); // (an Esc now would open the menu, v1.10.63)
  await post(request, '/api/test/quest/note', token, { what: 'beach_trash', qty: 5 });
  await expect(page.locator('#questTracker')).toContainText('돌아가 말해요', { timeout: 15000 });
  await page.locator('#plazaStage').focus(); await page.keyboard.press('Space');
  await expect(page.locator('#plazaDialog')).toContainText('버섯 3개');
  await page.keyboard.press('Escape');
  await post(request, '/api/test/island/give', token, { itemId: 'mushroom', qty: 3 });
  await expect(page.locator('#questTracker')).toContainText('돌아가 말해요', { timeout: 15000 });
  await page.locator('#plazaStage').focus(); await page.keyboard.press('Space');
  await expect(page.locator('#plazaDialog')).toContainText('출항');
  await page.keyboard.press('Escape');
  await page.evaluate((p) => window.PlazaDebug().teleport(p.x, p.z), require('../../lib/island-quests').STORIES.fisher.steps.find((st) => st.kind === 'visit').spot); // (the pier's end, either island)
  await expect(page.locator('#plazaHint')).toContainText('배웅하기', { timeout: 10000 }); // (206 구경 C안: the wave till the boat is out, not standing there)
  await page.locator('#plazaStage').focus(); await page.keyboard.press('Space');
  await expect(page.locator('#questTracker')).toContainText('돌아가 말해요', { timeout: 15000 });
  await page.evaluate(() => window.PlazaDebug().place('ev:quest_npc:questfisher'));
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().near), { timeout: 10000 }).toBe('ev:quest_npc:questfisher');
  await page.locator('#plazaStage').focus(); await page.keyboard.press('Space');
  await expect(page.locator('#plazaDialog')).toContainText('이번 주 이야기 끝');
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().questScenes()), { timeout: 10000 }).toMatchObject({ boat: true, departing: false });
  await page.waitForTimeout(9000); // longer than the eight-second departure: reading cannot spend the scene
  await expect(page.locator('#plazaDialog')).toBeVisible();
  expect(await page.evaluate(() => window.PlazaDebug().questScenes())).toMatchObject({ boat: true, departing: false });
  // A queued close from an earlier dialog cannot start departure under the current one.
  await page.evaluate(()=>document.getElementById('plazaDialog').dispatchEvent(new Event('close')));
  expect(await page.evaluate(() => window.PlazaDebug().questScenes())).toMatchObject({ boat: true, departing: false });
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.PlazaDebug().questScenes())).toMatchObject({ boat: true, departing: true });
  await page.reload(); await expect.poll(() => page.evaluate(() => window.PlazaDebug?.()?.running), { timeout: 60000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => window.PlazaDebug?.()?.questScenes()), { timeout: 30000 }).toMatchObject({ boat: false, departing: false });
  await expectNoScriptError(page);
  await a.context.close();
});
