// v1.10.320 섬 증권거래소 안 (gamecenter-notes docs/island-stocks-20261114.md; assets 118b stock_exchange_room, 119 테드 창): its own
// room far off the island like the 구치소's -- one board (SPACE before it: the trade window), the small counter beside it and
// 테드 창 behind it, at work only, a short dry line when spoken to (no story, no favours). Room-local metres from assets 118b
// (the door at local -Z, the board at +Z), the room turned half round in the world like the others. Browser and server.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IslandExchange = api;
}(typeof self !== 'undefined' ? self : this, () => {
  // (the walkable floor: assets 118b `walls` outline, x ±4.65, z ±3.65; in at its `door_in` (0, -3.0))
  const ROOM = Object.freeze({ x: 270, z: -330, y: 0.4, w: 9.3, d: 7.3, entry: Object.freeze({ lx: 0, lz: -2.6 }), exit: Object.freeze({ lx: 0, lz: -3.0 }) });
  const world = (lx, lz) => ({ x: Math.round((ROOM.x - lx) * 100) / 100, z: Math.round((ROOM.z - lz) * 100) / 100 });
  const local = (x, z) => ({ lx: ROOM.x - x, lz: ROOM.z - z });
  const inRoom = (x, z, pad = 0) => Math.abs(x - ROOM.x) <= ROOM.w / 2 + pad && Math.abs(z - ROOM.z) <= ROOM.d / 2 + pad;
  const BOARD = Object.freeze({ lx: 0, lz: 2.2, reach: 1.8 }); // (`board_spot`, on the rug: SPACE there opens the trade window)
  const CLERK = Object.freeze({ lx: -3.95, lz: 2.95, yaw: Math.PI }); // (behind the counter, facing the door -- local -Z)
  const TALK = Object.freeze({ lx: -3.95, lz: 1.65 }); // (before the counter)
  const FIXTURES = Object.freeze([ // what one walks round: x, z centre, w, d (118b `walls.blocks`, and 테드 himself)
    { x: 0, z: 3.55, w: 6.6, d: 0.5 } /* the board's stand */, { x: 2.3, z: -0.52, w: 2.2, d: 0.56 }, { x: -2.3, z: -0.52, w: 2.2, d: 0.56 } /* benches */,
    { x: -3.95, z: 2.2, w: 1.22, d: 0.64 } /* the counter */, { x: 4.1, z: 3.2, w: 0.7, d: 0.7 }, { x: 4.2, z: -3.2, w: 0.7, d: 0.7 }, { x: -4.2, z: -3.2, w: 0.7, d: 0.7 } /* planters */,
    { x: -3.95, z: 2.95, w: 0.6, d: 0.6 } /* 테드 */, { x: 4.48, z: 1.9, w: 0.44, d: 1.40 } /* (1.10.341 assets 147: the bookcase door, shut -- 361: by the back planter, IslandDen DOOR) */,
  ].map((f) => Object.freeze(f)));
  function clamp(x, z) {
    const fin = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
    const e = world(ROOM.entry.lx, ROOM.entry.lz); let { lx, lz } = local(fin(x, e.x), fin(z, e.z));
    lx = Math.max(-ROOM.w / 2 + 0.3, Math.min(ROOM.w / 2 - 0.3, lx)); lz = Math.max(-ROOM.d / 2 + 0.3, Math.min(ROOM.d / 2 - 0.3, lz));
    const hit = (x, z) => FIXTURES.find((f) => Math.abs(x - f.x) < f.w / 2 + 0.3 - 1e-6 && Math.abs(z - f.z) < f.d / 2 + 0.3 - 1e-6);
    for (let pass = 0, f = hit(lx, lz); f && pass < 4; pass += 1, f = hit(lx, lz)) {
      const hx = f.w / 2 + 0.3; const hz = f.d / 2 + 0.3;
      const ways = [[f.x - hx, lz], [f.x + hx, lz], [lx, f.z - hz], [lx, f.z + hz]].sort((p, q) => Math.hypot(p[0] - lx, p[1] - lz) - Math.hypot(q[0] - lx, q[1] - lz));
      [lx, lz] = ways.find(([x, z]) => !hit(x, z) && Math.abs(x) <= ROOM.w / 2 - 0.3 && Math.abs(z) <= ROOM.d / 2 - 0.3) || ways[0];
    }
    return world(lx, lz);
  }
  const atBoard = (x, z) => { const { lx, lz } = local(x, z); return Math.hypot(lx - BOARD.lx, lz - BOARD.lz) <= BOARD.reach; };
  // 테드 창's lines (사용자 「근무만 서면서 좀 시크한 반응」): which by the market -- closed, a day mostly down, mostly up, or plain
  const LINES = Object.freeze({
    open: ['장 열려 있어요. 보드 쓰세요.', '주문은 보드에서 하시면 돼요.', '보드는 저쪽이에요.', '…네. 장 열려 있어요.'],
    closed: ['오늘 장 끝났어요.', '아홉 시에 열어요.', '지금은 보기만 되세요.'],
    down: ['…버티시던가요.', '오늘은 파란 날이네요.'],
    up: ['오늘은 다들 웃네요.', '빨간 날이에요. 들뜨진 마시고요.'],
  });
  function lineOf(view, pick = 0) { // view: the board's (open, companies); pick: which of the lines
    const live = (view?.companies || []).filter((c) => c.status && c.status !== 'gone' && c.prevClose);
    const mood = !view?.open ? 'closed' : live.length ? (() => { const up = live.filter((c) => c.price > c.prevClose).length; const down = live.filter((c) => c.price < c.prevClose).length; return down >= live.length * 0.7 ? 'down' : up >= live.length * 0.7 ? 'up' : 'open'; })() : 'open';
    const list = LINES[mood]; return list[((Math.floor(pick) % list.length) + list.length) % list.length];
  }
  return { ROOM, BOARD, CLERK, TALK, FIXTURES, world, local, inRoom, clamp, atBoard, LINES, lineOf };
}));
