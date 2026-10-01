'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../lib/games/pandemic');
const D = require('../lib/games/pandemic-data');

// 팬데믹 규칙 엔진: IDEAS.md 「팬데믹 기본 규칙」의 각 조항. 장면은 상태를 직접 만들어 결정적으로 확인한다.
const SEATS3 = ['1', '2', '3'];
function fresh(seats = SEATS3, difficulty = 'standard') {
  const g = P.create({ difficulty });
  assert.equal(P.start(g, seats).legal, true);
  // A deterministic table: nobody holds anything, the board is clean, every deck is a known order.
  for (const seat of g.seatOrder) { g.hands[seat] = []; g.pawns[seat] = 'atlanta'; g.stored[seat] = null; g.roles[seat] = 'none'; } // no role abilities unless a test gives one
  for (const id of D.CITY_IDS) for (const c of D.COLORS) g.cubes[id][c] = 0;
  for (const c of D.COLORS) g.supply[c] = 24;
  g.infectionDiscard = []; g.infectionDeck = [...D.CITY_IDS];
  g.playerDeck = D.CITY_IDS.slice(0, 30); g.playerDiscard = [];
  g.rateIndex = 0; g.outbreaks = 0; g.stations = ['atlanta'];
  g.turn = g.seatOrder[0]; g.actionsLeft = 4; g.phase = 'actions'; g.pending = null; g.resume = null;
  return g;
}
const roles = (g, map) => { for (const [seat, role] of Object.entries(map)) g.roles[seat] = role; };
const total = (g) => D.CITY_IDS.reduce((t, id) => t + D.COLORS.reduce((u, c) => u + g.cubes[id][c], 0), 0);

test('카드 획득 중 공중 수송 동의는 남은 카드 수를 보존한다', () => {
  const g = fresh();
  g.hands['1'] = ['atlanta', 'chicago', 'paris', 'london', 'madrid', 'essen', 'ev:airlift'];
  g.playerDeck = ['osaka', 'taipei', 'cairo', 'delhi'];
  P.act(g, '1', { type: 'pass' });
  assert.equal(g.resume.remaining, 1);
  P.act(g, '1', { type: 'event', event: 'airlift', pawn: '2', to: 'tokyo' });
  P.act(g, '2', { type: 'respond', accept: true });
  assert.deepEqual(g.playerDeck, ['cairo', 'delhi'], '두 장만 획득');
  assert.equal(g.hands['1'].length, 8);
  P.act(g, '1', { type: 'discard', card: 'osaka' });
  assert.equal(g.turn, '2');
  assert.equal(g.hands['1'].length, 7);
});

test('전염 감염 뒤 강화 전에는 회복력 있는 인구만 사용하고 원래 획득을 이어간다', () => {
  const g = fresh(); g.hands['2'] = ['ev:resilient', 'ev:quietnight'];
  g.playerDeck = ['epidemic', 'paris', 'london'];
  g.infectionDeck = ['tokyo', 'essen']; g.infectionDiscard = ['madrid'];
  P.act(g, '1', { type: 'pass' });
  assert.equal(g.pending?.next, 'intensify');
  assert.equal(g.cubes.essen.blue, 3);
  assert.ok(g.infectionDiscard.includes('essen'));
  assert.equal(P.act(g, '2', { type: 'event', event: 'quietnight' }).legal, false);
  assert.deepEqual(P.legal(g, '2').events.map(e => e.event), ['resilient']);
  assert.equal(P.act(g, '2', { type: 'event', event: 'resilient', city: 'essen' }).legal, true);
  assert.equal(g.pending?.next, 'intensify');
  P.act(g, '1', { type: 'continue' });
  assert.ok(g.removedInfection.includes('essen'));
  assert.ok(!g.infectionDeck.includes('essen') && !g.infectionDiscard.includes('essen'));
  P.act(g, '1', { type: 'continue' }); // event window after the completed epidemic
  assert.deepEqual(g.hands['1'], ['paris']);
});

test('두 장을 뽑을 수 없으면 첫 카드나 전염을 처리하지 않고 즉시 패배한다', () => {
  for (const card of ['epidemic', 'paris']) {
    const g = fresh(); g.playerDeck = [card];
    P.act(g, '1', { type: 'pass' });
    assert.equal(g.endReason, 'deck');
    assert.deepEqual(g.playerDeck, [card]);
    assert.equal(g.epidemicsDrawn, 0);
    assert.equal(total(g), 0);
    assert.deepEqual(g.hands['1'], []);
  }
});

test('감염 카드 사이 이벤트는 다음 감염만 막고 카드 획득을 재시작하지 않는다', () => {
  const g = fresh(); g.hands['2'] = ['ev:airlift']; g.roles['2'] = 'quarantine';
  g.pawns['2'] = 'sydney'; g.playerDeck = ['osaka', 'taipei', 'cairo'];
  g.infectionDeck = ['paris', 'essen', 'tokyo'];
  P.act(g, '1', { type: 'pass' });
  P.act(g, '1', { type: 'continue' });
  assert.equal(g.phase, 'infect');
  assert.equal(g.pending?.next, 'infect-card');
  assert.equal(g.cubes.paris.blue, 1);
  P.act(g, '2', { type: 'event', event: 'airlift', pawn: '2', to: 'paris' });
  P.act(g, '1', { type: 'continue' });
  assert.equal(g.cubes.essen.blue, 0);
  assert.equal(g.turn, '2');
  assert.deepEqual(g.playerDeck, ['cairo']);
});

test('동의/예측 선택 중에는 legal도 이벤트 사용을 허용하지 않는다', () => {
  const g = fresh(); g.hands['1'] = ['ev:forecast']; g.hands['2'] = ['ev:quietnight'];
  P.act(g, '1', { type: 'event', event: 'forecast' });
  assert.deepEqual(P.legal(g, '2').events, []);
  assert.equal(P.act(g, '2', { type: 'event', event: 'quietnight' }).legal, false);
});

test('공중 수송의 거절/취소, 보관 예측은 기존 버리기 상태와 카드 소유권을 보존한다', () => {
  for (const accept of [false, 'cancel']) {
    const g = fresh(); g.hands['1'] = ['atlanta', 'paris', 'london', 'madrid', 'essen', 'milan', 'ev:airlift'];
    g.playerDeck = ['osaka', 'taipei', 'cairo'];
    P.act(g, '1', { type: 'pass' });
    const resume = structuredClone(g.resume);
    P.act(g, '1', { type: 'event', event: 'airlift', pawn: '2', to: 'tokyo' });
    P.act(g, accept === 'cancel' ? '1' : '2', accept === 'cancel' ? { type: 'cancel' } : { type: 'respond', accept });
    assert.equal(g.pending.type, 'discard'); assert.deepEqual(g.resume, resume);
    assert.equal(g.pawns['2'], 'atlanta'); assert.ok(g.hands['1'].includes('ev:airlift'));
  }
  const g = fresh(); g.roles['2'] = 'contingency'; g.stored['2'] = 'forecast';
  g.hands['1'] = D.CITY_IDS.slice(0, 7); g.playerDeck = ['osaka', 'taipei', 'cairo'];
  P.act(g, '1', { type: 'pass' });
  P.act(g, '2', { type: 'event', event: 'forecast', fromStored: true });
  const order = P.privateFor(g, '2').forecast;
  assert.equal(P.act(g, '2', { type: 'forecast-order', order: order.slice(1) }).legal, false);
  P.act(g, '2', { type: 'forecast-order', order });
  assert.equal(g.pending.type, 'discard'); assert.equal(g.pending.seat, '1');
  assert.equal(g.stored['2'], null); assert.deepEqual(g.removedEvents, ['forecast']);
  assert.ok(!g.playerDiscard.includes('ev:forecast'));
});

test('운항관리자 직항/전세기 카드와 행동은 관리자에게서 소비되고 위생병 자동 치료가 적용된다', () => {
  const g = fresh(); roles(g, { 1: 'dispatcher', 2: 'medic' });
  g.hands['1'] = ['tokyo', 'atlanta']; g.hands['2'] = ['paris'];
  g.cures.red = 'cured'; g.cubes.tokyo.red = 3; g.supply.red = 21;
  P.act(g, '1', { type: 'dispatch', pawn: '2', mode: 'direct', to: 'tokyo' });
  P.act(g, '2', { type: 'respond', accept: true });
  assert.deepEqual(g.hands['1'], ['atlanta']); assert.deepEqual(g.hands['2'], ['paris']);
  assert.equal(g.actionsLeft, 3); assert.equal(g.cubes.tokyo.red, 0); assert.equal(g.cures.red, 'eradicated');
  g.hands['1'] = ['tokyo'];
  P.act(g, '1', { type: 'dispatch', pawn: '2', mode: 'charter', to: 'paris' });
  P.act(g, '2', { type: 'respond', accept: true });
  assert.deepEqual(g.playerDiscard, ['tokyo', 'tokyo']); assert.equal(g.actionsLeft, 2);
  assert.equal(P.act(g, '1', { type: 'dispatch', pawn: '2', mode: 'opsmove', to: 'sydney' }).legal, false);
});

test('치료제 발견 즉시 머무는 위생병 자동 치료, 마지막 행동의 네 번째 치료제는 획득 없이 승리한다', () => {
  const g = fresh(); roles(g, { 1: 'scientist', 2: 'medic' }); g.pawns['2'] = 'tokyo';
  g.cubes.tokyo.red = 3; g.supply.red = 21;
  g.cures = { blue: 'cured', yellow: 'cured', black: 'cured', red: null };
  g.hands['1'] = ['tokyo', 'seoul', 'beijing', 'osaka']; g.actionsLeft = 1; g.playerDeck = [];
  P.act(g, '1', { type: 'cure', color: 'red', cards: [...g.hands['1']] });
  assert.equal(g.cubes.tokyo.red, 0); assert.equal(g.cures.red, 'eradicated'); assert.equal(g.endReason, 'cures');
  assert.equal(g.resume, null); assert.equal(g.pending, null); assert.equal(g.turnNumber, 1);
  const ended = structuredClone(g);
  assert.equal(P.act(g, '2', { type: 'event', event: 'quietnight' }).legal, false);
  assert.deepEqual(g, ended);
});

test('연속 전염 두 번째도 강화 전 선택을 복구하고 패배는 추가 카드·강화를 멈춘다', () => {
  const g = fresh(); g.hands['2'] = ['ev:resilient']; g.playerDeck = ['epidemic', 'epidemic', 'paris'];
  g.infectionDeck = ['tokyo', 'paris', 'london', 'essen'];
  P.act(g, '1', { type: 'pass' }); assert.equal(g.pending.next, 'intensify');
  P.act(g, '1', { type: 'continue' }); assert.equal(g.pending.next, 'draw');
  P.act(g, '1', { type: 'continue' }); assert.equal(g.pending.next, 'intensify');
  assert.equal(g.epidemicsDrawn, 2);
  P.act(g, '2', { type: 'event', event: 'resilient', city: 'london' });
  P.act(g, '1', { type: 'continue' });
  assert.equal(g.turn, '2'); assert.deepEqual(g.playerDeck, ['paris']);
  assert.ok(!g.infectionDeck.includes('london') && !g.infectionDiscard.includes('london'));
  const lost = fresh(); lost.playerDeck = ['epidemic', 'paris']; lost.infectionDeck = ['tokyo']; lost.outbreaks = 7;
  lost.cubes.tokyo.red = 3; lost.supply.red = 21;
  P.act(lost, '1', { type: 'pass' });
  assert.equal(lost.endReason, 'outbreaks'); assert.deepEqual(lost.playerDeck, ['paris']);
  assert.equal(lost.resume, null); assert.equal(lost.pending, null); assert.equal(lost.turnNumber, 1);
});

test('데이터: 도시 48개(색 4×12), 연결선은 양방향이고 지도는 하나로 이어져 있다', () => {
  assert.equal(D.CITY_IDS.length, 48);
  for (const color of D.COLORS) assert.equal(D.CITY_IDS.filter((id) => D.CITIES[id].color === color).length, 12);
  for (const id of D.CITY_IDS) for (const other of D.CITIES[id].links) assert.ok(D.CITIES[other].links.includes(id), `${id}-${other}`);
  const seen = new Set(['atlanta']); const stack = ['atlanta'];
  while (stack.length) for (const next of D.CITIES[stack.pop()].links) if (!seen.has(next)) { seen.add(next); stack.push(next); }
  assert.equal(seen.size, 48);
  assert.equal(D.ROLE_IDS.length, 7); assert.equal(D.EVENT_IDS.length, 5);
  assert.deepEqual(D.INFECTION_RATES, [2, 2, 2, 3, 3, 4, 4]);
});

test('준비: 애틀랜타 연구소·말, 초기 감염 9도시 18큐브(3·3·3·2·2·2·1·1·1), 인원별 시작 손패, 난이도별 전염 카드와 묶음', () => {
  for (const [players, hand] of [[2, 4], [3, 3], [4, 2]]) {
    const g = P.create({ difficulty: 'standard' });
    assert.equal(P.start(g, SEATS3.concat('4').slice(0, players)).legal, true);
    assert.deepEqual(g.stations, ['atlanta']);
    for (const seat of g.seatOrder) { assert.equal(g.pawns[seat], 'atlanta'); assert.equal(g.hands[seat].length, hand); }
    assert.equal(new Set(Object.values(g.roles)).size, players, '직업은 서로 다르다');
    assert.equal(total(g), 18);
    assert.equal(g.infectionDiscard.length, 9);
    const counts = g.infectionDiscard.map((id) => Math.max(...D.COLORS.map((c) => g.cubes[id][c])));
    assert.deepEqual(counts, [3, 3, 3, 2, 2, 2, 1, 1, 1]);
    assert.equal(g.infectionDeck.length, 39);
    // 첫 차례: 가진 도시 카드 중 인구가 가장 많은 사람
    const best = Math.max(...g.seatOrder.flatMap((s) => g.hands[s].filter((c) => !P.isEvent(c)).map((c) => D.CITIES[c].population)));
    assert.ok(g.hands[g.turn].some((c) => !P.isEvent(c) && D.CITIES[c].population === best));
  }
  for (const [difficulty, n] of [['intro', 4], ['standard', 5], ['heroic', 6]]) {
    const g = P.create({ difficulty }); P.start(g, SEATS3);
    assert.equal(g.playerDeck.filter((c) => c === 'epidemic').length, n);
    // 묶음마다 전염 카드가 정확히 하나: 묶음 경계(맨 위부터)를 찾아 확인한다.
    const rest = g.playerDeck.length - n; const base = Math.floor(rest / n); const extra = rest % n; let at = 0;
    for (let i = 0; i < n; i += 1) { const size = base + (i < extra ? 1 : 0) + 1; assert.equal(g.playerDeck.slice(at, at + size).filter((c) => c === 'epidemic').length, 1); at += size; }
  }
  assert.equal(P.start(P.create(), ['1']).legal, false, '1명은 시작할 수 없다');
});

test('공개 상태에는 두 카드 더미의 순서·내용이 없고 장수만 있다', () => {
  const g = P.create(); P.start(g, SEATS3);
  const view = P.publicState(g);
  assert.equal('playerDeck' in view, false); assert.equal('infectionDeck' in view, false);
  assert.equal(view.playerDeckCount, g.playerDeck.length); assert.equal(view.infectionDeckCount, g.infectionDeck.length);
  g.infectionDeck[0] = 'SECRET-INFECTION'; g.playerDeck[0] = 'SECRET-PLAYER';
  const text = JSON.stringify(P.publicState(g));
  assert.equal(text.includes('SECRET-INFECTION'), false, '감염 더미 내용이 새면 안 된다');
  assert.equal(text.includes('SECRET-PLAYER'), false, '플레이어 더미 내용이 새면 안 된다');
  assert.equal(P.publicState(g).hands['1'].length, g.hands['1'].length, '손패는 공개');
});

test('이동 4종: 자동차/배·직항기·전세기·정기 항공편(규칙과 카드 소모)', () => {
  const g = fresh(); g.hands['1'] = ['chicago', 'tokyo', 'atlanta'];
  assert.equal(P.act(g, '1', { type: 'drive', to: 'tokyo' }).legal, false, '연결되지 않은 도시');
  assert.equal(P.act(g, '1', { type: 'drive', to: 'chicago' }).legal, true); assert.equal(g.pawns['1'], 'chicago'); assert.equal(g.actionsLeft, 3);
  assert.equal(P.act(g, '1', { type: 'direct', to: 'tokyo' }).legal, true); assert.equal(g.pawns['1'], 'tokyo'); assert.ok(!g.hands['1'].includes('tokyo') && g.playerDiscard.includes('tokyo'));
  assert.equal(P.act(g, '1', { type: 'charter', to: 'paris' }).legal, false, '현재 도시(도쿄) 카드가 없다');
  g.hands['1'].push('tokyo');
  assert.equal(P.act(g, '1', { type: 'charter', to: 'paris' }).legal, true); assert.equal(g.pawns['1'], 'paris');
  g.stations.push('paris');
  g.pawns['1'] = 'atlanta';
  assert.equal(P.act(g, '1', { type: 'shuttle', to: 'paris' }).legal, true); assert.equal(g.pawns['1'], 'paris');
  assert.equal(g.turn, '2', '행동 4번을 쓰면 차례가 넘어간다');
  assert.equal(P.act(g, '1', { type: 'drive', to: 'chicago' }).legal, false, '내 차례가 아니다');
});

test('연구소 건설: 도시 카드 소모, 건축 전문가는 무료, 6개를 넘으면 기존 연구소를 옮긴다', () => {
  const g = fresh(); g.hands['1'] = ['paris']; g.pawns['1'] = 'paris';
  assert.equal(P.act(g, '1', { type: 'build' }).legal, true); assert.ok(g.stations.includes('paris') && g.playerDiscard.includes('paris'));
  const o = fresh(); roles(o, { 1: 'operations' }); o.pawns['1'] = 'london';
  assert.equal(P.act(o, '1', { type: 'build' }).legal, true); assert.ok(o.stations.includes('london')); assert.equal(o.playerDiscard.length, 0);
  const full = fresh(); roles(full, { 1: 'operations' }); full.stations = ['atlanta', 'chicago', 'paris', 'london', 'madrid', 'tokyo']; full.pawns['1'] = 'essen';
  assert.equal(P.act(full, '1', { type: 'build' }).legal, false, '옮길 연구소를 골라야 한다');
  assert.equal(P.act(full, '1', { type: 'build', remove: 'tokyo' }).legal, true); assert.equal(full.stations.length, 6); assert.ok(!full.stations.includes('tokyo') && full.stations.includes('essen'));
});

test('질병 치료: 큐브 1개, 치료제가 있으면 전부, 위생병은 항상 전부, 위생병은 치료된 색을 행동 없이 지운다', () => {
  const g = fresh(); g.cubes.atlanta.blue = 3; g.supply.blue = 21;
  assert.equal(P.act(g, '1', { type: 'treat', color: 'blue' }).legal, true); assert.equal(g.cubes.atlanta.blue, 2); assert.equal(g.supply.blue, 22);
  assert.equal(P.act(g, '1', { type: 'treat', color: 'red' }).legal, false);
  g.cures.blue = 'cured';
  assert.equal(P.act(g, '1', { type: 'treat', color: 'blue' }).legal, true); assert.equal(g.cubes.atlanta.blue, 0);
  const m = fresh(); roles(m, { 1: 'medic' }); m.cubes.atlanta.red = 3; m.supply.red = 21;
  assert.equal(P.act(m, '1', { type: 'treat', color: 'red' }).legal, true); assert.equal(m.cubes.atlanta.red, 0);
  const auto = fresh(); roles(auto, { 1: 'medic' }); auto.cures.black = 'cured'; auto.cubes.chicago.black = 2; auto.supply.black = 22;
  assert.equal(P.act(auto, '1', { type: 'drive', to: 'chicago' }).legal, true); assert.equal(auto.cubes.chicago.black, 0, '위생병이 들어가면 치료된 색은 자동 제거');
});

test('치료제 개발: 연구소에서 같은 색 5장(과학자 4장), 근절은 치료제 후 큐브가 모두 사라질 때', () => {
  const g = fresh(); g.hands['1'] = ['atlanta', 'chicago', 'paris', 'london', 'madrid', 'essen'];
  assert.equal(P.act(g, '1', { type: 'cure', color: 'blue', cards: ['atlanta', 'chicago', 'paris', 'london'] }).legal, false, '4장은 모자란다');
  assert.equal(P.act(g, '1', { type: 'cure', color: 'blue', cards: ['atlanta', 'chicago', 'paris', 'london', 'madrid'] }).legal, true);
  assert.equal(g.cures.blue, 'eradicated', '파랑 큐브가 보드에 없으면 바로 근절');
  const s = fresh(); roles(s, { 1: 'scientist' }); s.hands['1'] = ['tokyo', 'seoul', 'beijing', 'osaka']; s.cubes.manila.red = 1; s.supply.red = 23;
  assert.equal(P.act(s, '1', { type: 'cure', color: 'red', cards: ['tokyo', 'seoul', 'beijing', 'osaka'] }).legal, true);
  assert.equal(s.cures.red, 'cured', '큐브가 남아 있으면 근절이 아니다');
  s.cubes.manila.red = 0; s.supply.red = 24; s.pawns['1'] = 'manila'; s.cubes.manila.red = 1; s.supply.red = 23;
  P.act(s, '1', { type: 'treat', color: 'red' });
  assert.equal(s.cures.red, 'eradicated');
  const away = fresh(); away.hands['1'] = ['chicago', 'paris', 'london', 'madrid', 'essen']; away.pawns['1'] = 'chicago';
  assert.equal(P.act(away, '1', { type: 'cure', color: 'blue', cards: away.hands['1'] }).legal, false, '연구소가 없는 도시');
});

test('감염 단계: 큐브 1개씩, 4번째는 확산, 연쇄에서 같은 도시는 한 번만 확산한다', () => {
  const g = fresh();
  g.cubes.chicago.blue = 3; g.cubes.atlanta.blue = 3; g.supply.blue = 18;
  g.infectionDeck = ['chicago', 'paris'];
  g.resume = { step: 'infect', remaining: 1 };
  P.act(g, '1', { type: 'pass' });
  // pass → 카드 2장 뽑기 → 감염 단계에서 시카고(맨 위)가 확산: 이웃 5곳에 1개씩, 애틀랜타(이미 3개)도 확산하지만 시카고는 다시 확산하지 않는다
  assert.ok(g.outbreaks >= 2);
  assert.equal(g.cubes.chicago.blue, 3, '확산한 도시의 큐브는 늘지 않는다');
  const chain = fresh(); chain.cubes.chicago.blue = 3; chain.cubes.atlanta.blue = 3; chain.supply.blue = 18; chain.infectionDeck = ['chicago', 'tokyo'];
  chain.playerDeck = ['paris', 'london', 'madrid']; chain.hands['1'] = [];
  chain.turn = '1'; chain.actionsLeft = 0; chain.phase = 'actions';
  P.act(chain, '1', { type: 'pass' });
  assert.equal(chain.outbreaks, 2, '시카고→애틀랜타 연쇄에서 시카고는 두 번 세지 않는다');
});

test('전염 카드: 감염률 증가 → 맨 아래 카드에 큐브 3개 → 감염 버림 더미를 섞어 맨 위에 올림, 카드는 손패에 들어가지 않는다', () => {
  const g = fresh(); g.turn = '1'; g.actionsLeft = 0;
  g.playerDeck = ['epidemic', 'paris', 'london'];
  g.infectionDeck = ['tokyo', 'chicago', 'london', 'essen']; g.infectionDiscard = ['madrid', 'milan'];
  P.act(g, '1', { type: 'pass' });
  assert.equal(g.rateIndex, 1);
  assert.equal(g.cubes.essen.blue, 3, '맨 아래(essen) 도시에 3개');
  assert.ok(!g.hands['1'].includes('epidemic'));
  // 강화: 버림 더미(madrid, milan, essen)가 섞여 감염 더미 맨 위로 올라갔고, 감염 단계(감염률 2)가 그 중 2장을 뽑았다.
  // 아래쪽은 원래 순서 그대로다.
  assert.deepEqual(g.infectionDeck.slice(-3), ['tokyo', 'chicago', 'london']);
  assert.equal(g.infectionDiscard.length, 2);
  assert.ok([...g.infectionDeck.slice(0, 1), ...g.infectionDiscard].every((c) => ['madrid', 'milan', 'essen'].includes(c)));
  assert.equal(P.infectionRate(g), 2);
});

test('이미 큐브가 있는 도시의 전염은 3개가 되도록만 놓고 확산한다', () => {
  const g = fresh(); g.cubes.essen.blue = 1; g.supply.blue = 23; g.turn = '1'; g.actionsLeft = 0; g.quietNight = true; // 감염 단계는 건너뛰고 전염만 본다
  g.playerDeck = ['epidemic', 'paris', 'london']; g.infectionDeck = ['tokyo', 'essen']; g.infectionDiscard = [];
  P.act(g, '1', { type: 'pass' });
  assert.equal(g.cubes.essen.blue, 3);
  assert.equal(g.outbreaks, 1);
  assert.ok(g.cubes.london.blue >= 1 && g.cubes.paris.blue >= 1 && g.cubes.milan.blue >= 1 && g.cubes.stpetersburg.blue >= 1);
});

test('검역 전문가: 자기 도시와 연결 도시에는 큐브가 놓이지 않는다. 위생병은 치료된 색을 막는다', () => {
  const g = fresh(); roles(g, { 1: 'quarantine' }); g.pawns['1'] = 'paris';
  g.cubes.london.blue = 3; g.supply.blue = 21; g.turn = '2'; g.actionsLeft = 0; g.playerDeck = ['milan', 'tokyo', 'osaka'];
  g.infectionDeck = ['essen']; // essen은 paris와 연결
  P.act(g, '2', { type: 'pass' });
  assert.equal(g.cubes.essen.blue, 0, '연결 도시라 감염 안 됨');
  const m = fresh(); roles(m, { 1: 'medic' }); m.pawns['1'] = 'tokyo'; m.cures.red = 'cured'; m.turn = '2'; m.actionsLeft = 0; m.playerDeck = ['milan', 'paris', 'osaka']; m.infectionDeck = ['tokyo'];
  P.act(m, '2', { type: 'pass' });
  assert.equal(m.cubes.tokyo.red, 0, '위생병 도시에는 치료된 색이 놓이지 않는다');
});

test('손패 제한 7장: 8장이 되면 바로 버려야 하고, 이벤트로도 줄일 수 있다', () => {
  const g = fresh(); g.hands['1'] = ['paris', 'london', 'madrid', 'essen', 'milan', 'tokyo', 'seoul']; g.turn = '1'; g.actionsLeft = 0;
  g.playerDeck = ['osaka', 'taipei', 'cairo'];
  P.act(g, '1', { type: 'pass' });
  assert.equal(g.pending.type, 'discard'); assert.equal(g.hands['1'].length, 8);
  assert.equal(P.act(g, '2', { type: 'drive', to: 'chicago' }).legal, false);
  assert.equal(P.act(g, '1', { type: 'discard', card: 'osaka' }).legal, true);
  assert.equal(g.pending.type, 'discard', '두 번째 카드를 뽑으면 다시 8장');
  assert.equal(P.act(g, '1', { type: 'discard', card: 'taipei' }).legal, true);
  assert.equal(g.hands['1'].length, 7); assert.equal(g.pending, null);
  assert.equal(g.turn, '2', '버린 뒤에 나머지 카드 획득·감염 단계가 이어져 다음 차례가 된다');
  const ev = fresh(); ev.hands['1'] = ['paris', 'london', 'madrid', 'essen', 'milan', 'tokyo', 'ev:grant']; ev.turn = '1'; ev.actionsLeft = 0; ev.playerDeck = ['osaka', 'epidemic', 'delhi']; ev.infectionDeck = ['tokyo', 'paris', 'london', 'milan'];
  P.act(ev, '1', { type: 'pass' });
  assert.equal(P.act(ev, '1', { type: 'event', event: 'grant', city: 'tokyo' }).legal, true, '이벤트로 손패를 줄일 수 있다');
  assert.equal(ev.hands['1'].length, 7); assert.equal(ev.turn, '2');
});

test('패배 3종: 확산 8회, 큐브 부족, 플레이어 카드 부족', () => {
  const o = fresh(); o.outbreaks = 7; o.cubes.essen.blue = 3; o.supply.blue = 21; o.turn = '1'; o.actionsLeft = 0; o.playerDeck = ['milan', 'tokyo', 'osaka']; o.infectionDeck = ['essen'];
  P.act(o, '1', { type: 'pass' }); assert.equal(o.status, 'finished'); assert.equal(o.endReason, 'outbreaks'); assert.deepEqual(o.winner, []);
  const c = fresh(); c.supply.red = 0; c.turn = '1'; c.actionsLeft = 0; c.playerDeck = ['milan', 'london', 'osaka']; c.infectionDeck = ['tokyo'];
  P.act(c, '1', { type: 'pass' }); assert.equal(c.endReason, 'cubes');
  const d = fresh(); d.turn = '1'; d.actionsLeft = 0; d.playerDeck = ['milan'];
  P.act(d, '1', { type: 'pass' }); assert.equal(d.status, 'finished'); assert.equal(d.endReason, 'deck');
});

test('승리: 네 가지 치료제를 모두 개발하면 즉시 모두 승리한다', () => {
  const g = fresh(); g.cures = { blue: 'cured', yellow: 'cured', black: 'cured', red: null };
  g.hands['1'] = ['tokyo', 'seoul', 'beijing', 'osaka', 'taipei'];
  assert.equal(P.act(g, '1', { type: 'cure', color: 'red', cards: g.hands['1'] }).legal, true);
  assert.equal(g.status, 'finished'); assert.deepEqual(g.winner, ['1', '2', '3']); assert.equal(g.endReason, 'cures');
});

test('정보 공유: 같은 도시의 현재 도시 카드 1장, 양쪽 동의, 연구자는 어떤 도시 카드든 줄 수 있다, 손패 7장 초과는 즉시 버림', () => {
  const g = fresh(); g.hands['1'] = ['atlanta', 'paris']; g.hands['2'] = []; g.pawns['2'] = 'atlanta';
  assert.equal(P.act(g, '1', { type: 'share', with: '2', dir: 'give', card: 'paris' }).legal, false, '현재 도시 카드만');
  assert.equal(P.act(g, '1', { type: 'share', with: '2', dir: 'give', card: 'atlanta' }).legal, true);
  assert.equal(g.pending.type, 'share'); assert.equal(g.actionsLeft, 4, '동의 전에는 행동 소모 없음');
  assert.equal(P.act(g, '3', { type: 'respond', accept: true }).legal, false, '상대만 답한다');
  assert.equal(P.act(g, '2', { type: 'respond', accept: true }).legal, true);
  assert.deepEqual(g.hands['2'], ['atlanta']); assert.equal(g.actionsLeft, 3);
  const r = fresh(); roles(r, { 1: 'researcher' }); r.hands['1'] = ['paris']; r.pawns['2'] = 'atlanta';
  assert.equal(P.act(r, '1', { type: 'share', with: '2', dir: 'give', card: 'paris' }).legal, true);
  P.act(r, '2', { type: 'respond', accept: true }); assert.deepEqual(r.hands['2'], ['paris']);
  const t = fresh(); roles(t, { 2: 'researcher' }); t.hands['2'] = ['tokyo']; t.pawns['2'] = 'atlanta';
  assert.equal(P.act(t, '1', { type: 'share', with: '2', dir: 'take', card: 'tokyo' }).legal, true, '연구자의 카드는 내 차례에 가져갈 수 있다');
  const over = fresh(); over.hands['1'] = ['atlanta']; over.hands['2'] = ['paris', 'london', 'madrid', 'essen', 'milan', 'tokyo', 'seoul']; over.pawns['2'] = 'atlanta';
  P.act(over, '1', { type: 'share', with: '2', dir: 'give', card: 'atlanta' }); P.act(over, '2', { type: 'respond', accept: true });
  assert.equal(over.pending.type, 'discard'); assert.equal(over.pending.seat, '2');
  const no = fresh(); no.hands['1'] = ['atlanta']; no.pawns['2'] = 'atlanta';
  P.act(no, '1', { type: 'share', with: '2', dir: 'give', card: 'atlanta' }); P.act(no, '2', { type: 'respond', accept: false });
  assert.deepEqual(no.hands['1'], ['atlanta']); assert.equal(no.actionsLeft, 4);
});

test('직업: 운항관리자(동의 후 다른 말 이동), 건축 전문가(차례당 1번 특수 이동), 비상 대책 설계자(이벤트 보관·사용 시 게임에서 제거)', () => {
  const d = fresh(); roles(d, { 1: 'dispatcher' }); d.hands['1'] = ['chicago'];
  assert.equal(P.act(d, '1', { type: 'dispatch', pawn: '2', mode: 'drive', to: 'chicago' }).legal, true);
  assert.equal(d.pending.type, 'consent'); P.act(d, '2', { type: 'respond', accept: true });
  assert.equal(d.pawns['2'], 'chicago'); assert.equal(d.actionsLeft, 3);
  d.pawns['3'] = 'paris';
  assert.equal(P.act(d, '1', { type: 'dispatch', pawn: '2', mode: 'join', to: 'paris' }).legal, true); P.act(d, '2', { type: 'respond', accept: true });
  assert.equal(d.pawns['2'], 'paris');
  const o = fresh(); roles(o, { 1: 'operations' }); o.hands['1'] = ['tokyo'];
  assert.equal(P.act(o, '1', { type: 'opsmove', card: 'tokyo', to: 'sydney' }).legal, true); assert.equal(o.pawns['1'], 'sydney');
  o.hands['1'] = ['paris']; o.stations.push('sydney');
  assert.equal(P.act(o, '1', { type: 'opsmove', card: 'paris', to: 'london' }).legal, false, '차례당 한 번');
  const c = fresh(); roles(c, { 1: 'contingency' }); c.playerDiscard = ['ev:forecast', 'paris'];
  assert.equal(P.act(c, '1', { type: 'store', event: 'forecast' }).legal, true); assert.equal(c.stored['1'], 'forecast'); assert.ok(!c.playerDiscard.includes('ev:forecast'));
  assert.equal(P.act(c, '1', { type: 'event', event: 'quietnight' }).legal, false);
  c.stored['1'] = 'quietnight';
  assert.equal(P.act(c, '1', { type: 'event', event: 'quietnight', fromStored: true }).legal, true); assert.equal(c.stored['1'], null); assert.ok(c.removedEvents.includes('quietnight'));
});

test('이벤트 카드 5종: 공중 수송(동의)·정부 보조금·조용한 하룻밤·예측(상위 6장 재배열, 비공개)·회복력 있는 인구', () => {
  const g = fresh(); g.hands['1'] = ['ev:airlift', 'ev:grant']; g.hands['2'] = ['ev:quietnight']; g.hands['3'] = ['ev:forecast', 'ev:resilient'];
  assert.equal(P.act(g, '1', { type: 'event', event: 'airlift', pawn: '2', to: 'tokyo' }).legal, true);
  assert.equal(g.pawns['2'], 'atlanta'); P.act(g, '2', { type: 'respond', accept: true }); assert.equal(g.pawns['2'], 'tokyo'); assert.ok(g.playerDiscard.includes('ev:airlift'));
  assert.equal(P.act(g, '1', { type: 'event', event: 'grant', city: 'tokyo' }).legal, true); assert.ok(g.stations.includes('tokyo'));
  assert.equal(P.act(g, '2', { type: 'event', event: 'quietnight' }).legal, true); assert.equal(g.quietNight, true);
  g.infectionDiscard = ['paris', 'london'];
  assert.equal(P.act(g, '3', { type: 'event', event: 'resilient', city: 'paris' }).legal, true); assert.ok(!g.infectionDiscard.includes('paris') && g.removedInfection.includes('paris'));
  g.infectionDeck = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'].map((_, i) => D.CITY_IDS[i + 10]);
  const top = g.infectionDeck.slice(0, 6);
  assert.equal(P.act(g, '3', { type: 'event', event: 'forecast' }).legal, true);
  assert.equal(g.pending.type, 'forecast');
  assert.deepEqual(P.privateFor(g, '3').forecast, top); assert.equal(P.privateFor(g, '1').forecast, null);
  g.pending.cards.length; // 예측 카드는 엔진 안에만 있고 공개 상태의 pending에는 cards가 없다
  assert.equal(P.publicState(g).pending.cards, undefined);
  assert.equal(P.act(g, '1', { type: 'drive', to: 'chicago' }).legal, false, '예측이 끝나기 전에는 다른 행동 불가');
  assert.equal(P.act(g, '3', { type: 'forecast-order', order: [...top].reverse() }).legal, true);
  assert.deepEqual(g.infectionDeck.slice(0, 6), [...top].reverse()); assert.equal(g.pending, null);
  // 조용한 하룻밤: 다음 감염 단계를 건너뛴다
  g.turn = '1'; g.actionsLeft = 0; g.playerDeck = ['milan', 'osaka', 'cairo']; const before = total(g);
  P.act(g, '1', { type: 'pass' });
  assert.equal(total(g), before, '감염 단계를 건너뜀'); assert.equal(g.quietNight, false); assert.equal(g.turn, '2');
});

test('차례 진행: 행동 4번 → 카드 2장 → 감염률만큼 감염 → 다음 사람, 전염 카드 둘 사이에 이벤트를 쓸 수 있다', () => {
  const g = fresh(); g.hands['1'] = []; g.playerDeck = ['milan', 'osaka', 'cairo', 'tokyo']; g.infectionDeck = ['paris', 'london', 'essen'];
  for (let i = 0; i < 4; i += 1) assert.equal(P.act(g, '1', { type: 'drive', to: i % 2 ? 'atlanta' : 'chicago' }).legal, true);
  assert.equal(g.hands['1'].length, 2, '카드 2장');
  assert.equal(total(g), 2, '감염률 2');
  assert.equal(g.turn, '2'); assert.equal(g.actionsLeft, 4); assert.equal(g.opsMoveUsed, false);
  const e = fresh(); e.turn = '1'; e.actionsLeft = 0; e.hands['3'] = ['ev:quietnight'];
  e.playerDeck = ['epidemic', 'epidemic', 'cairo']; e.infectionDeck = ['tokyo', 'paris', 'london', 'essen'];
  P.act(e, '1', { type: 'pass' });
  assert.equal(e.pending?.type, 'window', '첫 전염을 해결한 뒤 두 번째 전염 전에 이벤트 창');
  assert.equal(e.epidemicsDrawn, 1);
  assert.equal(P.act(e, '3', { type: 'event', event: 'quietnight' }).legal, true);
  assert.equal(P.act(e, '1', { type: 'continue' }).legal, true);
  assert.equal(e.epidemicsDrawn, 2);
});

test('무작위 대국 300판: 규칙이 깨지지 않고(큐브 보존·음수 없음·손패 한도), 항상 끝나거나 멈추지 않는다', () => {
  const rnd = (list) => list[Math.floor(Math.random() * list.length)];
  for (let n = 0; n < 300; n += 1) {
    const players = 2 + (n % 3);
    const g = P.create({ difficulty: ['intro', 'standard', 'heroic'][n % 3] });
    P.start(g, ['1', '2', '3', '4'].slice(0, players));
    for (let step = 0; step < 2500 && g.status === 'playing'; step += 1) {
      const seat = g.pending ? (g.pending.seat || g.pending.owner || g.pending.other || g.turn) : g.turn;
      const lg = P.legal(g, g.turn);
      const options = [];
      if (g.pending) {
        const p = g.pending;
        if (p.type === 'discard') options.push([p.seat, { type: 'discard', card: rnd(g.hands[p.seat]) }]);
        else if (p.type === 'window') options.push([g.turn, { type: 'continue' }]);
        else if (p.type === 'consent') options.push([p.owner, { type: 'respond', accept: Math.random() < .8 }]);
        else if (p.type === 'share') options.push([p.other, { type: 'respond', accept: Math.random() < .8 }]);
        else if (p.type === 'forecast') options.push([p.seat, { type: 'forecast-order', order: [...p.cards].reverse() }]);
      } else {
        for (const to of lg.drive) options.push([g.turn, { type: 'drive', to }]);
        for (const to of lg.direct) options.push([g.turn, { type: 'direct', to }]);
        for (const to of lg.shuttle) options.push([g.turn, { type: 'shuttle', to }]);
        if (lg.charter.length) options.push([g.turn, { type: 'charter', to: rnd(lg.charter) }]);
        if (lg.build) options.push([g.turn, { type: 'build', remove: lg.buildRemove ? rnd(g.stations) : undefined }]);
        for (const color of lg.treat) options.push([g.turn, { type: 'treat', color }, 3]);
        for (const c of lg.cure) options.push([g.turn, { type: 'cure', color: c.color, cards: g.hands[g.turn].filter((x) => !P.isEvent(x) && D.CITIES[x].color === c.color).slice(0, c.need) }, 5]);
        for (const s of lg.share) { const pick = rnd(s.cards); options.push([g.turn, { type: 'share', with: s.with, dir: pick.giver === g.turn ? 'give' : 'take', card: pick.card }]); }
        if (lg.store.length) options.push([g.turn, { type: 'store', event: rnd(lg.store) }]);
        options.push([g.turn, { type: 'pass' }, g.actionsLeft <= 1 ? 6 : 1]);
      }
      if (!options.length) options.push([seat, { type: 'pass' }]);
      const weighted = options.flatMap((o) => Array(o[2] || 1).fill(o));
      const [who, action] = rnd(weighted);
      const result = P.act(g, who, action);
      for (const color of D.COLORS) {
        const onBoard = D.CITY_IDS.reduce((t, id) => t + g.cubes[id][color], 0);
        assert.equal(onBoard + g.supply[color], 24, `${color} 큐브 보존`);
        assert.ok(g.supply[color] >= 0);
      }
      for (const id of D.CITY_IDS) for (const color of D.COLORS) assert.ok(g.cubes[id][color] >= 0 && g.cubes[id][color] <= 3);
      assert.ok(g.stations.length <= 6 && new Set(g.stations).size === g.stations.length);
      for (const s of g.seatOrder) assert.ok(g.hands[s].length <= P.HAND_LIMIT + 1);
      if (!result.legal && !g.pending && g.status === 'playing' && action.type === 'pass') assert.fail(`pass가 거부됨: ${JSON.stringify(result)}`);
    }
  }
});
