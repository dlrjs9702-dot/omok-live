// 팬데믹 화면: 세계지도 한 장(SVG, 휠 확대·드래그 이동), 오른쪽 아래 미니맵, 행동 도구줄, 하단 접이식 카드 패널.
// 규칙은 모두 서버 엔진(lib/games/pandemic.js)이 정한다. 이 파일은 공개 상태와 서버가 계산해 준 legal 목록을 그리고,
// 사용자가 고른 행동을 `pandemic-act`로 보낼 뿐이다.
(function () {
  'use strict';
  const M = window.PandemicMap;
  if (!M) return;
  const NS = 'http://www.w3.org/2000/svg';
  const $ = (id) => document.getElementById(id);
  const COLOR = { blue: '#3b82f6', yellow: '#facc15', black: '#475569', red: '#ef4444' };
  const COLOR_KO = { blue: '파랑', yellow: '노랑', black: '검정', red: '빨강' };
  const SEAT_COLOR = { 1: '#f97316', 2: '#22d3ee', 3: '#a3e635', 4: '#f472b6' };
  const ROLE_KO = { contingency: '비상 대책 설계자', dispatcher: '운항관리자', medic: '위생병', operations: '건축 전문가', quarantine: '검역 전문가', researcher: '연구자', scientist: '과학자' };
  const ROLE_TEXT = {
    contingency: '행동 1회로 버림 더미의 이벤트 1장을 보관(손패 제한 밖)', dispatcher: '동의를 받아 다른 말을 내 말처럼 이동, 행동 1회로 다른 말이 있는 도시로 이동',
    medic: '치료 1회에 한 색 큐브 전부 제거, 치료된 색은 들어가면 자동 제거·방지', operations: '연구소 무료 건설, 차례마다 한 번 도시 카드로 연구소에서 어디든 이동',
    quarantine: '내 도시와 인접 도시에는 큐브가 놓이지 않음', researcher: '정보 공유에서 어떤 도시 카드든 줄 수 있음', scientist: '치료제 개발에 같은 색 4장이면 충분',
  };
  const EVENT = { airlift: ['공중 수송', '말 하나를 원하는 도시로 이동(주인 동의)'], grant: ['정부 보조금', '원하는 도시에 연구소 건설'], quietnight: ['조용한 하룻밤', '다음 도시 감염 단계를 건너뜀'], forecast: ['예측', '감염 더미 위 6장을 보고 순서 정하기'], resilient: ['회복력 있는 인구', '감염 버림 더미 카드 1장 제거'] };
  const CITY = Object.fromEntries(M.cities.map((c) => [c.id, c]));
  const isEvent = (card) => String(card).startsWith('ev:');
  const evId = (card) => String(card).slice(3);
  const fmt = (n) => Number(n).toLocaleString('ko-KR');

  let submit = null;
  let state = null;
  let busy = false;
  let mode = null; // { kind, ... } what the next map click means
  let dockOpen = false;
  let dockSeat = null;
  let selection = null; // cards chosen for a cure / discard
  let seenSeq = null;
  let view = { cx: M.width / 2, cy: M.height / 2 + 10, k: 1 };
  let cityEls = null;
  let pawnEls = new Map();
  let hot = []; // [{ city, until }] places something just happened (for the minimap)
  let lastRoom = null;

  const el = (tag, attrs = {}, ...kids) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); for (const k of kids) if (k) e.append(k); return e; };
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const label = (seat) => state?.players?.[seat]?.label || `${seat}번`;
  const mySeat = () => state?.me?.seat || null;
  const cityName = (id) => CITY[id]?.name || id;
  const cardName = (card) => (isEvent(card) ? EVENT[evId(card)]?.[0] || card : cityName(card));

  // ---- map ---------------------------------------------------------------------------------------------------
  function buildMap() {
    const svg = $('pandemicMap'); svg.replaceChildren();
    svg.append(el('rect', { x: 0, y: 0, width: M.width, height: M.height, class: 'pdOcean' }));
    const land = el('g', { class: 'pdLand' });
    for (const d of Object.values(M.outlines)) land.append(el('path', { d, class: 'pdContinent' }));
    svg.append(land);
    const links = el('g', { class: 'pdLinks' }); const seen = new Set();
    for (const c of M.cities) for (const o of c.links) {
      const key = [c.id, o].sort().join('|'); if (seen.has(key)) continue; seen.add(key);
      const a = c; const b = CITY[o];
      if (Math.abs(a.x - b.x) > 600) { // an ocean crossing: leave through one edge and come back through the other
        const [west, east] = a.x < b.x ? [a, b] : [b, a];
        const midY = (west.y + east.y) / 2;
        links.append(el('line', { x1: west.x, y1: west.y, x2: 0, y2: midY, class: 'pdLink wrap' }), el('line', { x1: east.x, y1: east.y, x2: M.width, y2: midY, class: 'pdLink wrap' }));
      } else links.append(el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: 'pdLink', 'data-a': a.id, 'data-b': b.id }));
    }
    svg.append(links);
    svg.append(el('g', { id: 'pdStations' }), el('g', { id: 'pdCities' }), el('g', { id: 'pdCubes' }), el('g', { id: 'pdPawns' }), el('g', { id: 'pdFx' }));
    cityEls = new Map();
    for (const c of M.cities) {
      const g = el('g', { class: 'pdCity', 'data-city': c.id, transform: `translate(${c.x},${c.y})`, tabindex: '0', role: 'button', 'aria-label': c.name });
      g.append(el('title', {}), el('circle', { r: 17, class: 'pdHit' }), el('circle', { r: 10, class: 'pdDot', fill: COLOR[c.color] }), el('circle', { r: 15, class: 'pdRing' }));
      const t = el('text', { class: 'pdName', y: 26, 'text-anchor': 'middle' }); t.textContent = c.name; g.append(t);
      $('pdCities').append(g); cityEls.set(c.id, g);
      g.addEventListener('click', (ev) => { ev.stopPropagation(); onCity(c.id, ev); });
      g.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onCity(c.id, ev); } });
    }
    buildMini();
    attachPanZoom(svg);
    applyView();
  }
  function buildMini() {
    const mini = $('pandemicMini'); mini.replaceChildren();
    mini.append(el('rect', { x: 0, y: 0, width: M.width, height: M.height, class: 'pdMiniBg' }));
    for (const d of Object.values(M.outlines)) mini.append(el('path', { d, class: 'pdMiniLand' }));
    mini.append(el('g', { id: 'pdMiniDots' }), el('rect', { id: 'pdMiniView', class: 'pdMiniView' }));
    const move = (ev) => { const r = mini.getBoundingClientRect(); view.cx = ((ev.clientX - r.left) / r.width) * M.width; view.cy = ((ev.clientY - r.top) / r.height) * M.height; applyView(); };
    mini.onpointerdown = (ev) => { mini.setPointerCapture(ev.pointerId); move(ev); mini.onpointermove = move; };
    mini.onpointerup = mini.onpointercancel = () => { mini.onpointermove = null; };
  }
  function applyView() {
    const w = M.width / view.k; const h2 = M.height / view.k;
    view.cx = Math.max(w / 2, Math.min(M.width - w / 2, view.cx)); view.cy = Math.max(h2 / 2, Math.min(M.height - h2 / 2, view.cy));
    const x = view.cx - w / 2; const y = view.cy - h2 / 2;
    $('pandemicMap').setAttribute('viewBox', `${x} ${y} ${w} ${h2}`);
    const r = $('pdMiniView'); if (r) { r.setAttribute('x', x); r.setAttribute('y', y); r.setAttribute('width', w); r.setAttribute('height', h2); }
    $('pandemicMap').dataset.zoom = String(Math.round(view.k * 100) / 100);
  }
  function attachPanZoom(svg) {
    svg.onwheel = (ev) => {
      ev.preventDefault();
      const r = svg.getBoundingClientRect(); const fx = (ev.clientX - r.left) / r.width; const fy = (ev.clientY - r.top) / r.height;
      const w = M.width / view.k; const h2 = M.height / view.k;
      const px = view.cx - w / 2 + fx * w; const py = view.cy - h2 / 2 + fy * h2;
      view.k = Math.max(1, Math.min(6, view.k * (ev.deltaY < 0 ? 1.18 : 1 / 1.18)));
      const nw = M.width / view.k; const nh = M.height / view.k;
      view.cx = px - fx * nw + nw / 2; view.cy = py - fy * nh + nh / 2; applyView();
    };
    let drag = null;
    svg.onpointerdown = (ev) => { if (ev.target.closest('.pdCity')) return; drag = { x: ev.clientX, y: ev.clientY, cx: view.cx, cy: view.cy }; svg.setPointerCapture(ev.pointerId); svg.classList.add('dragging'); };
    svg.onpointermove = (ev) => {
      if (!drag) return; const r = svg.getBoundingClientRect();
      view.cx = drag.cx - ((ev.clientX - drag.x) / r.width) * (M.width / view.k); view.cy = drag.cy - ((ev.clientY - drag.y) / r.height) * (M.height / view.k); applyView();
    };
    svg.onpointerup = svg.onpointercancel = () => { drag = null; svg.classList.remove('dragging'); };
  }

  // ---- drawing the table ---------------------------------------------------------------------------------------
  function drawBoard() {
    const g = state.game; const playing = g.status === 'playing' || g.status === 'finished';
    for (const c of M.cities) {
      const node = cityEls.get(c.id); const cubes = g.cubes?.[c.id] || {};
      const total = Object.values(cubes).reduce((a, b) => a + b, 0);
      node.classList.toggle('infected', total > 0);
      node.querySelector('title').textContent = `${c.name} · 인구 ${fmt(c.pop)} · ${COLOR_KO[c.color]} 도시${total ? ` · 큐브 ${Object.entries(cubes).filter(([, n]) => n).map(([k, n]) => `${COLOR_KO[k]} ${n}`).join(' ')}` : ''}`;
    }
    const cubesLayer = $('pdCubes'); cubesLayer.replaceChildren();
    const slots = { blue: [-17, -19], yellow: [5, -19], black: [-17, 9], red: [5, 9] };
    for (const c of M.cities) for (const [color, [dx, dy]] of Object.entries(slots)) {
      const n = g.cubes?.[c.id]?.[color] || 0;
      for (let i = 0; i < n; i += 1) cubesLayer.append(el('rect', { x: c.x + dx + i * 6, y: c.y + dy, width: 5, height: 9, rx: 1, class: `pdCube pd-${color}`, fill: COLOR[color] }));
    }
    const st = $('pdStations'); st.replaceChildren();
    for (const id of g.stations || []) { const c = CITY[id]; st.append(el('path', { d: `M${c.x - 7},${c.y - 14} L${c.x},${c.y - 22} L${c.x + 7},${c.y - 14} L${c.x + 7},${c.y - 7} L${c.x - 7},${c.y - 7} Z`, class: 'pdStation' })); }
    // pawns keep their element so a move slides instead of jumping
    const seats = g.seatOrder || []; const byCity = new Map();
    for (const seat of seats) { const at = g.pawns?.[seat]; if (!byCity.has(at)) byCity.set(at, []); byCity.get(at).push(seat); }
    for (const [seat, node] of [...pawnEls]) if (!seats.includes(seat)) { node.remove(); pawnEls.delete(seat); }
    for (const [at, list] of byCity) list.forEach((seat, i) => {
      const c = CITY[at]; let node = pawnEls.get(seat);
      if (!node) {
        node = el('g', { class: 'pdPawn', 'data-seat': seat });
        node.append(el('circle', { r: 8, fill: SEAT_COLOR[seat] || '#fff', class: 'pdPawnBody' }));
        const t = el('text', { 'text-anchor': 'middle', y: 4, class: 'pdPawnText' }); t.textContent = seat; node.append(t);
        $('pdPawns').append(node); pawnEls.set(seat, node);
      }
      node.style.transform = `translate(${c.x + (i - (list.length - 1) / 2) * 15}px, ${c.y + 1}px)`;
      node.classList.toggle('turn', g.turn === seat && g.status === 'playing');
      node.classList.toggle('mine', mySeat() === seat);
    });
    // minimap: every city as a dot, bigger and redder with more cubes, plus the recent hot spots
    const dots = $('pdMiniDots'); dots.replaceChildren();
    for (const c of M.cities) {
      const n = Object.values(g.cubes?.[c.id] || {}).reduce((a, b) => a + b, 0);
      dots.append(el('circle', { cx: c.x, cy: c.y, r: 6 + n * 2, fill: n ? '#ef4444' : COLOR[c.color], opacity: n ? 0.95 : 0.55 }));
    }
    const now = Date.now(); hot = hot.filter((x) => x.until > now);
    for (const x of hot) { const c = CITY[x.city]; if (c) dots.append(el('circle', { cx: c.x, cy: c.y, r: 18, class: 'pdMiniHot' })); }
    if (hot.length) setTimeout(() => state && drawBoard(), 600);
    void playing;
  }

  // ---- the table around the map ------------------------------------------------------------------------------
  function renderHud() {
    const g = state.game; const box = $('pandemicHud'); box.replaceChildren();
    const chip = (cls, text, title) => { const c = h('span', `pdChip ${cls || ''}`, text); if (title) c.title = title; return c; };
    box.append(chip('turn', g.status === 'playing' ? (g.turn === mySeat() ? `내 차례 · 행동 ${g.actionsLeft}번` : `${label(g.turn)}님 차례 · 행동 ${g.actionsLeft}번`) : g.status === 'finished' ? (g.winner?.length ? '모두 승리' : '함께 패배') : '시작 대기'));
    const out = h('span', 'pdTrack'); out.append(h('b', '', '확산'));
    for (let i = 1; i <= 8; i += 1) out.append(h('i', `pdPip${i <= g.outbreaks ? ' on' : ''}${i === 8 ? ' last' : ''}`));
    out.title = `확산 ${g.outbreaks}/8 (8번째가 일어나면 패배)`; box.append(out);
    const rate = h('span', 'pdTrack'); rate.append(h('b', '', '감염률'));
    [2, 2, 2, 3, 3, 4, 4].forEach((r, i) => rate.append(h('i', `pdPip rate${i === g.rateIndex ? ' on' : ''}`, String(r))));
    box.append(rate);
    const cures = h('span', 'pdTrack'); cures.append(h('b', '', '치료제'));
    for (const color of ['blue', 'yellow', 'black', 'red']) { const s = g.cures?.[color]; const c = h('i', `pdCure ${s || ''}`, s === 'eradicated' ? '근절' : s ? '개발' : '—'); c.style.setProperty('--c', COLOR[color]); c.title = `${COLOR_KO[color]}: ${s === 'eradicated' ? '근절됨' : s ? '치료제 개발' : '아직'} · 남은 큐브 ${g.supply?.[color]}`; cures.append(c); }
    box.append(cures);
    box.append(chip('', `플레이어 더미 ${g.playerDeckCount}장 · 전염 ${g.epidemicsTotal - g.epidemicsDrawn}장 남음`, '카드 순서는 아무도 모릅니다'), chip('', `감염 더미 ${g.infectionDeckCount}장`));
    const piles = h('button', 'pdChip link', `감염 버림 ${g.infectionDiscard?.length || 0}`); piles.type = 'button'; piles.onclick = () => showPile('감염 카드 버림 더미', (state.game.infectionDiscard || []).map(cityName));
    const pp = h('button', 'pdChip link', `플레이어 버림 ${g.playerDiscard?.length || 0}`); pp.type = 'button'; pp.onclick = () => showPile('플레이어 카드 버림 더미', (state.game.playerDiscard || []).map(cardName));
    box.append(piles, pp);
    if (g.quietNight) box.append(chip('quiet', '조용한 하룻밤 예약'));
    for (const [id, n] of Object.entries({})) void id, n;
  }
  function showPile(title, names) {
    const menu = $('pandemicMenu'); menu.replaceChildren(h('strong', '', title), h('p', 'pdSmall', names.length ? names.join(', ') : '비어 있습니다.'));
    const close = h('button', 'ghost tiny', '닫기'); close.type = 'button'; close.onclick = () => menu.classList.add('hidden'); menu.append(close); menu.classList.remove('hidden');
  }

  // ---- actions -------------------------------------------------------------------------------------------------
  async function send(action) {
    if (busy || !state) return;
    busy = true; render(state);
    try { const r = await submit('pandemic-act', { action, expectedRevision: state.game.revision }); if (r?.ok !== false) { mode = null; selection = null; closeMenu(); } } finally { busy = false; if (state) render(state); }
  }
  const closeMenu = () => $('pandemicMenu').classList.add('hidden');
  function legal() { return state?.me?.myPandemic?.legal || null; }
  function popup(title, buttons, note) {
    const menu = $('pandemicMenu'); menu.replaceChildren(h('strong', '', title));
    if (note) menu.append(h('p', 'pdSmall', note));
    const row = h('div', 'pdMenuRow');
    for (const [text, fn] of buttons) { const b = h('button', 'secondary tiny', text); b.type = 'button'; b.onclick = fn; row.append(b); }
    const cancel = h('button', 'ghost tiny', '닫기'); cancel.type = 'button'; cancel.onclick = () => { mode = null; closeMenu(); drawHighlights(); }; row.append(cancel);
    menu.append(row); menu.classList.remove('hidden');
  }

  // Where a click may go for the current mode: city -> [{ text, act }]
  function targets() {
    const lg = legal(); const t = new Map(); if (!mode || !lg) return t;
    const add = (city, text, act) => { if (!t.has(city)) t.set(city, []); t.get(city).push({ text, act }); };
    if (mode.kind === 'move') {
      for (const to of lg.drive) add(to, '자동차/배', { type: 'drive', to });
      for (const to of lg.direct) add(to, '직항기 (그 도시 카드 버림)', { type: 'direct', to });
      for (const to of lg.charter) add(to, '전세기 (현재 도시 카드 버림)', { type: 'charter', to });
      for (const to of lg.shuttle) add(to, '정기 항공편', { type: 'shuttle', to });
    } else if (mode.kind === 'ops') { for (const c of M.cities) if (c.id !== state.game.pawns[mySeat()]) add(c.id, '특수 이동', { type: 'opsmove', card: mode.card, to: c.id }); }
    else if (mode.kind === 'grant') { for (const c of M.cities) if (!state.game.stations.includes(c.id)) add(c.id, '연구소 건설', { type: 'event', event: 'grant', city: c.id, fromStored: mode.fromStored }); }
    else if (mode.kind === 'grant-remove') { for (const id of state.game.stations) add(id, '이 연구소를 옮기기', { type: 'event', event: 'grant', city: mode.city, remove: id, fromStored: mode.fromStored }); }
    else if (mode.kind === 'build-remove') { for (const id of state.game.stations) add(id, '이 연구소를 옮기기', { type: 'build', remove: id }); }
    else if (mode.kind === 'airlift') { for (const c of M.cities) if (c.id !== state.game.pawns[mode.pawn]) add(c.id, '공중 수송', { type: 'event', event: 'airlift', pawn: mode.pawn, to: c.id, fromStored: mode.fromStored }); }
    else if (mode.kind === 'dispatch') {
      const g = state.game; const me = mySeat(); const at = g.pawns[mode.pawn]; const hand = g.hands[me] || [];
      for (const to of CITY[at].links) add(to, '자동차/배', { type: 'dispatch', pawn: mode.pawn, mode: 'drive', to });
      for (const to of hand.filter((x) => !isEvent(x) && x !== at)) add(to, '직항기 (내 카드)', { type: 'dispatch', pawn: mode.pawn, mode: 'direct', to });
      if (hand.includes(at)) for (const c of M.cities) if (c.id !== at) add(c.id, '전세기 (내 카드)', { type: 'dispatch', pawn: mode.pawn, mode: 'charter', to: c.id });
      if (g.stations.includes(at)) for (const to of g.stations) if (to !== at) add(to, '정기 항공편', { type: 'dispatch', pawn: mode.pawn, mode: 'shuttle', to });
      for (const s of g.seatOrder) if (s !== mode.pawn) add(g.pawns[s], `${label(s)}님 말이 있는 도시로`, { type: 'dispatch', pawn: mode.pawn, mode: 'join', to: g.pawns[s] });
      t.forEach((list, key) => { if (key === at) t.delete(key); });
    }
    return t;
  }
  function drawHighlights() {
    const t = targets();
    for (const [id, node] of cityEls) { node.classList.toggle('target', t.has(id)); node.classList.toggle('dim', Boolean(mode) && !t.has(id)); }
  }
  function onCity(id, ev) {
    const t = targets();
    if (!mode) { focusCity(id); return; }
    const options = t.get(id);
    if (!options) return;
    if (options.length === 1) { send(options[0].act); return; }
    popup(`${cityName(id)}로 어떻게 갈까요?`, options.map((o) => [o.text, () => send(o.act)]));
    void ev;
  }
  function focusCity(id) { const c = CITY[id]; view.cx = c.x; view.cy = c.y; if (view.k < 2) view.k = 2; applyView(); }
  function setMode(next) { mode = next; closeMenu(); drawHighlights(); renderActions(); }

  function renderActions() {
    const g = state.game; const box = $('pandemicActions'); box.replaceChildren();
    const me = mySeat(); const lg = legal(); const p = g.pending;
    const btn = (text, fn, cls = 'secondary', title) => { const b = h('button', `${cls} pdBtn`, text); b.type = 'button'; if (title) b.title = title; b.onclick = fn; b.disabled = busy; box.append(b); return b; };
    const note = (text) => box.append(h('span', 'pdNote', text));
    if (g.status !== 'playing') return;
    if (!me) { note('관전 중입니다. 손패와 직업은 모두에게 공개됩니다.'); return; }
    // things somebody has to answer first
    if (p?.type === 'discard') {
      if (p.seat === me) note(`손패가 7장을 넘었습니다. 카드 패널에서 버릴 카드를 고르세요(또는 이벤트를 쓰세요).`); else note(`${label(p.seat)}님이 카드를 버리는 중입니다.`);
    } else if (p?.type === 'window') {
      if (g.turn === me) btn(`계속 (${p.next === 'draw' ? '다음 전염 카드' : '도시 감염 단계'})`, () => send({ type: 'continue' }), 'primary', '이벤트 카드를 쓸 수 있는 시점입니다');
      else note(`${label(g.turn)}님이 진행 대기 중 · 이벤트 카드는 지금 쓸 수 있습니다.`);
    } else if (p?.type === 'forecast') {
      note(p.seat === me ? '예측: 위 6장의 순서를 정하세요.' : `${label(p.seat)}님이 예측을 하는 중입니다.`);
    } else if (p?.type === 'consent' || p?.type === 'share') {
      const asker = p.requester || p.proposer; const answerer = p.owner || p.other;
      const what = p.type === 'share' ? `${label(p.giver)}님이 ${label(p.taker)}님에게 ${cityName(p.card)} 카드를 줍니다` : p.kind === 'airlift' ? `공중 수송: ${label(p.owner)}님의 말을 ${cityName(p.to)}(으)로 옮깁니다` : `운항관리자가 ${label(p.owner)}님의 말을 ${cityName(p.to)}(으)로 옮깁니다`;
      if (me === answerer) { note(`${what}. 동의하시겠습니까?`); btn('동의', () => send({ type: 'respond', accept: true }), 'primary'); btn('거절', () => send({ type: 'respond', accept: false }), 'ghost'); }
      else if (me === asker) { note(`${what} · ${label(answerer)}님의 답을 기다립니다.`); btn('요청 취소', () => send({ type: 'cancel' }), 'ghost'); }
      else note(`${what} · 동의 대기 중`);
    }
    // my turn: the action row
    if (!p && g.phase === 'actions' && g.turn === me && lg) {
      const here = g.pawns[me];
      btn('이동', () => setMode(mode?.kind === 'move' ? null : { kind: 'move' }), mode?.kind === 'move' ? 'primary' : 'secondary', '갈 수 있는 도시가 지도에 표시됩니다');
      btn('연구소 건설', () => (lg.buildRemove ? (setMode({ kind: 'build-remove' }), popup('연구소가 6개입니다', [], '옮길 기존 연구소를 지도에서 고르세요.')) : send({ type: 'build' })), 'secondary').disabled = busy || !lg.build;
      for (const color of ['blue', 'yellow', 'black', 'red']) if (g.cubes[here]?.[color] > 0) btn(`${COLOR_KO[color]} 치료 (${g.cubes[here][color]})`, () => send({ type: 'treat', color }), 'secondary', `${cityName(here)}의 ${COLOR_KO[color]} 큐브 제거`).style.borderColor = COLOR[color];
      btn('정보 공유', () => openShare(), 'secondary').disabled = busy || !lg.share.length;
      btn('치료제 개발', () => openCure(), 'secondary').disabled = busy || !lg.cure.length;
      const role = g.roles[me];
      if (role === 'dispatcher') btn('다른 말 이동', () => popup('어느 말을 옮길까요?', g.seatOrder.map((s) => [`${label(s)}${s === me ? ' (나)' : ''} · ${cityName(g.pawns[s])}`, () => setMode({ kind: 'dispatch', pawn: s })]), '내 카드로 이동하고, 다른 사람의 말이면 동의가 필요합니다.'), 'secondary');
      if (role === 'operations' && lg.opsmove) { const b = btn('특수 이동', () => { dockOpen = true; dockSeat = me; selection = { kind: 'ops' }; renderDock(); }, 'secondary', '연구소에서 도시 카드 1장을 버리고 어디든 이동(차례당 1번)'); b.disabled = busy || !lg.opsmove.length; }
      if (role === 'contingency' && !g.stored[me]) { const b = btn('이벤트 보관', () => popup('보관할 이벤트', lg.store.map((e) => [EVENT[e]?.[0] || e, () => send({ type: 'store', event: e })])), 'secondary'); b.disabled = busy || !lg.store.length; }
      btn('차례 넘기기', () => send({ type: 'pass' }), 'ghost', '남은 행동을 쓰지 않고 카드 획득·감염 단계로');
    } else if (!p && g.phase === 'actions') note(`${label(g.turn)}님이 행동하는 중입니다.`);
    // events: any time
    if (lg) for (const e of lg.events) btn(`⚡ ${EVENT[e.event][0]}${e.stored ? ' (보관)' : ''}`, () => useEvent(e), 'event', EVENT[e.event][1]);
    if (mode) { const c = h('button', 'ghost pdBtn', '선택 취소'); c.type = 'button'; c.onclick = () => setMode(null); box.append(c); note(mode.kind === 'move' ? '지도에서 갈 도시를 누르세요.' : '지도에서 도시를 누르세요.'); }
  }
  function openShare() {
    const lg = legal(); const g = state.game; const me = mySeat(); const buttons = [];
    for (const s of lg.share) for (const c of s.cards) buttons.push([c.giver === me ? `${label(s.with)}님에게 ${cityName(c.card)} 주기` : `${label(s.with)}님의 ${cityName(c.card)} 받기`, () => { closeMenu(); send({ type: 'share', with: s.with, dir: c.giver === me ? 'give' : 'take', card: c.card }); }]);
    popup('정보 공유', buttons, `${cityName(g.pawns[me])}에서 같은 도시의 카드를 서로 주고받습니다. 상대가 동의해야 합니다.`);
  }
  function openCure() {
    const lg = legal(); const g = state.game; const me = mySeat();
    const start = (c) => { const have = g.hands[me].filter((x) => !isEvent(x) && CITY[x].color === c.color); selection = { kind: 'cure', color: c.color, need: c.need, picked: have.length === c.need ? [...have] : [] }; dockOpen = true; dockSeat = me; closeMenu(); renderDock(); };
    if (lg.cure.length === 1) start(lg.cure[0]); else popup('어느 색 치료제를 개발할까요?', lg.cure.map((c) => [`${COLOR_KO[c.color]} (${c.need}장)`, () => start(c)]));
  }
  function useEvent(e) {
    const g = state.game; const me = mySeat(); const fromStored = e.stored;
    const base = { type: 'event', event: e.event, fromStored };
    if (e.event === 'quietnight') return send(base);
    if (e.event === 'forecast') return send(base);
    if (e.event === 'grant') return setMode({ kind: 'grant', fromStored });
    if (e.event === 'airlift') return popup('어느 말을 옮길까요?', g.seatOrder.map((s) => [`${label(s)}${s === me ? ' (나)' : ''} · ${cityName(g.pawns[s])}`, () => setMode({ kind: 'airlift', pawn: s, fromStored })]));
    if (e.event === 'resilient') return popup('제거할 감염 카드', (g.infectionDiscard || []).map((c) => [cityName(c), () => send({ ...base, city: c })]), '게임에서 영구 제거됩니다.');
  }

  // ---- card panel --------------------------------------------------------------------------------------------
  function cardEl(card, opts = {}) {
    const b = h('button', `pdCard ${isEvent(card) ? 'event' : CITY[card].color}${opts.picked ? ' picked' : ''}${opts.dim ? ' dim' : ''}`, '');
    b.type = 'button';
    if (isEvent(card)) { b.append(h('b', '', `⚡ ${EVENT[evId(card)]?.[0] || card}`)); b.title = EVENT[evId(card)]?.[1] || ''; }
    else { b.append(h('b', '', CITY[card].name), h('small', '', `${(CITY[card].pop / 1e6).toFixed(1)}M`)); b.style.setProperty('--c', COLOR[CITY[card].color]); b.title = `${CITY[card].name} · ${COLOR_KO[CITY[card].color]} · 인구 ${fmt(CITY[card].pop)}`; }
    if (opts.onClick) b.onclick = opts.onClick; else b.disabled = true;
    return b;
  }
  function renderDock() {
    const g = state.game; const dock = $('pandemicCardDock'); dock.replaceChildren();
    const me = mySeat(); const seats = g.seatOrder || [];
    if (g.status === 'selecting' || !seats.length) { dock.classList.add('hidden'); return; }
    dock.classList.remove('hidden'); dock.classList.toggle('open', dockOpen);
    if (!dockSeat || !seats.includes(dockSeat)) dockSeat = me && seats.includes(me) ? me : seats[0];
    const head = h('button', 'pdDockHead'); head.type = 'button'; head.onclick = () => { dockOpen = !dockOpen; renderDock(); };
    head.append(h('span', 'pdDockToggle', dockOpen ? '▼ 카드 접기' : '▲ 카드 펼치기'));
    for (const s of seats) { const chip = h('span', `pdDockSeat${s === me ? ' me' : ''}${g.turn === s ? ' turn' : ''}`, `${label(s)} ${g.hands[s].length}장`); chip.style.borderColor = SEAT_COLOR[s]; head.append(chip); }
    dock.append(head);
    if (!dockOpen) return;
    const p = g.pending; const mustDiscard = p?.type === 'discard' && p.seat === me;
    const tabs = h('div', 'pdDockTabs');
    for (const s of seats) { const t = h('button', `pdDockTab${s === dockSeat ? ' on' : ''}`, `${label(s)} · ${ROLE_KO[g.roles[s]]}`); t.type = 'button'; t.style.borderColor = SEAT_COLOR[s]; t.onclick = () => { dockSeat = s; renderDock(); }; tabs.append(t); }
    dock.append(tabs);
    const body = h('div', 'pdDockBody');
    body.append(h('p', 'pdSmall', `${ROLE_KO[g.roles[dockSeat]]} — ${ROLE_TEXT[g.roles[dockSeat]]} · 위치 ${cityName(g.pawns[dockSeat])}${g.stored[dockSeat] ? ` · 보관 이벤트: ${EVENT[g.stored[dockSeat]]?.[0]}` : ''}`));
    const row = h('div', 'pdCardRow');
    const mine = dockSeat === me;
    for (const card of g.hands[dockSeat]) {
      let onClick = null; let picked = false; let dim = false;
      if (mine && mustDiscard) onClick = () => send({ type: 'discard', card });
      else if (mine && selection?.kind === 'cure') { const ok = !isEvent(card) && CITY[card].color === selection.color; picked = selection.picked.includes(card); dim = !ok; if (ok) onClick = () => { selection.picked = picked ? selection.picked.filter((x) => x !== card) : [...selection.picked, card].slice(0, selection.need); renderDock(); }; }
      else if (mine && selection?.kind === 'ops') { const ok = !isEvent(card) && legal()?.opsmove?.includes(card); dim = !ok; if (ok) onClick = () => { selection = null; setMode({ kind: 'ops', card }); renderDock(); }; }
      else if (mine && isEvent(card)) onClick = () => useEvent({ event: evId(card), stored: false });
      row.append(cardEl(card, { onClick, picked, dim }));
    }
    if (!g.hands[dockSeat].length) row.append(h('span', 'pdSmall', '손패가 없습니다.'));
    body.append(row);
    if (mine && selection?.kind === 'cure') {
      const go = h('button', 'primary tiny', `${COLOR_KO[selection.color]} 치료제 개발 (${selection.picked.length}/${selection.need})`); go.type = 'button'; go.disabled = selection.picked.length !== selection.need || busy;
      go.onclick = () => send({ type: 'cure', color: selection.color, cards: selection.picked });
      const cancel = h('button', 'ghost tiny', '취소'); cancel.type = 'button'; cancel.onclick = () => { selection = null; renderDock(); };
      body.append(h('div', 'pdMenuRow', '')); body.lastChild.append(go, cancel);
    }
    if (mustDiscard) body.append(h('p', 'pdWarn', '버릴 카드를 누르세요.'));
    dock.append(body);
  }

  // ---- forecast, log, effects --------------------------------------------------------------------------------
  function renderForecast() {
    const g = state.game; const p = g.pending; const box = $('pandemicMenu');
    const cards = state.me?.myPandemic?.forecast;
    if (!(p?.type === 'forecast' && p.seat === mySeat() && cards)) return false;
    let order = box.dataset.forecast ? JSON.parse(box.dataset.forecast) : cards.slice();
    if (order.join() !== cards.join() && !order.every((c) => cards.includes(c))) order = cards.slice();
    box.dataset.forecast = JSON.stringify(order);
    box.replaceChildren(h('strong', '', '예측: 맨 위가 가장 먼저 뽑힙니다'));
    order.forEach((c, i) => {
      const row = h('div', 'pdForecastRow'); const t = h('span', '', `${i + 1}. ${cityName(c)}`); t.style.color = COLOR[CITY[c]?.color] || '#fff';
      const up = h('button', 'ghost tiny', '▲'); up.type = 'button'; up.disabled = i === 0; up.onclick = () => { [order[i - 1], order[i]] = [order[i], order[i - 1]]; box.dataset.forecast = JSON.stringify(order); renderForecast(); };
      const down = h('button', 'ghost tiny', '▼'); down.type = 'button'; down.disabled = i === order.length - 1; down.onclick = () => { [order[i + 1], order[i]] = [order[i], order[i + 1]]; box.dataset.forecast = JSON.stringify(order); renderForecast(); };
      row.append(t, up, down); box.append(row);
    });
    const ok = h('button', 'primary tiny', '이 순서로 되돌리기'); ok.type = 'button'; ok.onclick = () => { delete box.dataset.forecast; send({ type: 'forecast-order', order }); }; box.append(ok);
    box.classList.remove('hidden'); return true;
  }
  const LOG = {
    start: () => '팬데믹을 시작했습니다.', turn: (e) => `${label(e.seat)}님 차례`, move: (e) => `${label(e.seat)}님 이동 → ${cityName(e.to)}`, build: (e) => `${cityName(e.city)}에 연구소${e.event ? ' (정부 보조금)' : ''}`,
    treat: (e) => `${label(e.seat)}님이 ${cityName(e.city)}의 ${COLOR_KO[e.color]} 큐브 ${e.all ? '모두 ' : ''}제거`, cure: (e) => `🧪 ${COLOR_KO[e.color]} 치료제 개발!`, eradicate: (e) => `✨ ${COLOR_KO[e.color]} 질병 근절!`,
    share: (e) => `${label(e.from)}님 → ${label(e.to)}님: ${cityName(e.card)} 카드`, refuse: (e) => `${label(e.seat)}님이 거절했습니다`, draw: (e) => `${label(e.seat)}님이 ${cardName(e.card)} 카드를 뽑음`, discard: (e) => `${label(e.seat)}님이 ${cardName(e.card)} 버림`,
    epidemic: (e) => `☣ 전염! 감염률 ${e.rate}`, infect: (e) => `${cityName(e.city)} 감염${e.blocked ? ' (막힘)' : ''}`, cube: () => null, outbreak: (e) => `💥 ${cityName(e.city)} 확산! (${e.count}/8)`,
    event: (e) => `⚡ ${label(e.seat)}님이 ${EVENT[e.event]?.[0] || e.event} 사용`, store: (e) => `${label(e.seat)}님이 ${EVENT[e.event]?.[0]} 보관`, quiet: () => '조용한 하룻밤: 감염 단계를 건너뜀',
    win: () => '🎉 네 가지 치료제를 모두 개발했습니다! 모두 승리!', lose: (e) => `💀 패배: ${{ outbreaks: '확산 8번', cubes: '질병 큐브 부족', deck: '플레이어 카드 부족' }[e.reason] || e.reason}`,
  };
  function renderLog() {
    const box = $('pandemicLog'); box.replaceChildren();
    const lines = (state.game.log || []).slice(-40).map((e) => (LOG[e.kind] ? LOG[e.kind](e) : null)).filter(Boolean).slice(-12).reverse();
    for (const text of lines) box.append(h('div', 'pdLogLine', text));
  }
  function fxAt(cityId, cls, ms = 900) {
    const c = CITY[cityId]; if (!c) return; const layer = $('pdFx');
    const ring = el('circle', { cx: c.x, cy: c.y, r: 12, class: `pdFxRing ${cls}` }); layer.append(ring); setTimeout(() => ring.remove(), ms);
    hot.push({ city: cityId, until: Date.now() + 4000 });
  }
  function banner(text, cls) {
    const wrap = $('pandemicMapWrap'); const b = h('div', `pdBanner ${cls || ''}`, text); wrap.append(b); setTimeout(() => b.remove(), 1700);
  }
  function playEvents() {
    const log = state.game.log || []; const last = log.at(-1)?.seq ?? 0;
    if (seenSeq === null || last < seenSeq) { seenSeq = last; return; }
    const fresh = log.filter((e) => e.seq > seenSeq); seenSeq = last;
    for (const e of fresh.slice(-30)) {
      if (e.kind === 'outbreak') { fxAt(e.city, 'outbreak', 1300); for (const n of CITY[e.city].links) fxAt(n, 'spread', 900); }
      else if (e.kind === 'cube' || e.kind === 'infect') fxAt(e.city, `cube pd-${e.color}`);
      else if (e.kind === 'treat') fxAt(e.city, 'treat');
      else if (e.kind === 'build') fxAt(e.city, 'build');
      else if (e.kind === 'move') fxAt(e.to, 'move', 600);
      else if (e.kind === 'epidemic') banner('☣ 전염!', 'epidemic');
      else if (e.kind === 'cure') banner(`🧪 ${COLOR_KO[e.color]} 치료제 개발!`, 'cure');
      else if (e.kind === 'eradicate') banner(`✨ ${COLOR_KO[e.color]} 질병 근절`, 'cure');
      else if (e.kind === 'win') banner('🎉 모두 승리!', 'win');
      else if (e.kind === 'lose') banner('💀 패배', 'lose');
    }
  }

  // ---- entry points ------------------------------------------------------------------------------------------
  function renderSetup() {
    const g = state.game; const host = Boolean(state.me?.isHost); const box = $('pandemicSetup');
    const show = g.status === 'selecting';
    box.classList.toggle('hidden', !show);
    if (!show) return;
    const seatCount = Object.values(state.players || {}).filter(Boolean).length;
    $('pandemicDifficulty').value = g.difficulty; $('pandemicDifficulty').disabled = !host;
    $('pandemicStartBtn').classList.toggle('hidden', !host); $('pandemicStartBtn').disabled = busy || seatCount < 2;
    $('pandemicSetupNote').textContent = seatCount < 2 ? '2명 이상이 자리를 고르면 방장이 시작합니다.' : `${seatCount}명 · 방장이 시작하면 직업을 무작위로 받습니다.`;
  }
  function render(next) {
    if (!next || next.gameType !== 'pandemic') return;
    const room = next.me?.roomCode || next.title || next.id;
    if (lastRoom !== room) { lastRoom = room; seenSeq = null; mode = null; selection = null; dockOpen = false; delete $('pandemicMenu').dataset.forecast; }
    state = next;
    if (!cityEls || !$('pdCities')?.children.length) buildMap();
    renderSetup();
    const g = state.game; const started = g.status !== 'selecting';
    $('pandemicHud').classList.toggle('hidden', !started); $('pandemicMapWrap').classList.toggle('pdIdle', !started);
    if (started) { renderHud(); drawBoard(); }
    if (!$('pandemicActions')) { const a = h('div', 'pandemicActions'); a.id = 'pandemicActions'; $('pandemicMapWrap').after(a); }
    if (started) { if (!mySeat() || g.pending?.type !== 'discard') {} renderActions(); renderDock(); renderLog(); playEvents(); }
    else { $('pandemicActions').replaceChildren(); $('pandemicCardDock').replaceChildren(); $('pandemicLog').replaceChildren(); }
    if (g.pending?.type === 'discard' && g.pending.seat === mySeat() && !dockOpen) { dockOpen = true; renderDock(); }
    if (!renderForecast() && $('pandemicMenu').dataset.forecast) { delete $('pandemicMenu').dataset.forecast; closeMenu(); }
    drawHighlights();
    window.PandemicUI.state = state;
  }
  function init(roomAction) {
    if (submit) return;
    submit = roomAction;
    $('pandemicStartBtn').addEventListener('click', async () => { if (busy) return; busy = true; try { await submit('start-pandemic', {}); } finally { busy = false; if (state) render(state); } });
    $('pandemicDifficulty').addEventListener('change', () => submit('set-pandemic', { difficulty: $('pandemicDifficulty').value }));
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && mode) { mode = null; closeMenu(); if (state) { drawHighlights(); renderActions(); } } });
  }
  window.PandemicUI = { init, render, state: null };
}());
