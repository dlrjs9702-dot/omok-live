// Go-Stop / Matgo room UI. Renders only what the server sent: public table state for everyone and
// the viewer's own hand (state.me.myGostopHand). Other players' hands are drawn as plain card
// backs from a count -- no card id or value of a hidden card is ever put in the DOM.
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const MONTHS = ['', '송학', '매조', '벚꽃', '흑싸리', '난초', '모란', '홍싸리', '공산', '국진', '단풍', '오동', '비'];
  const PLANTS = ['', '🌲', '🌼', '🌸', '🌿', '🪻', '🌺', '🍂', '⛰️', '🏵️', '🍁', '🍃', '🌧️'];
  const FIGURES = {
    'm01-gwang': '🕊️', 'm03-gwang': '🎪', 'm08-gwang': '🌕', 'm11-gwang': '🦚', 'm12-gwang': '☂️',
    'm02-animal': '🐦', 'm04-animal': '🐦', 'm08-animal': '🪿', 'm05-animal': '🌉', 'm06-animal': '🦋',
    'm07-animal': '🐗', 'm09-animal': '🍶', 'm10-animal': '🦌', 'm12-animal': '🐤',
  };
  const DAN = { hong: '홍단', cheong: '청단', cho: '초단' };
  const RIBBON_DAN = { 1: 'hong', 2: 'hong', 3: 'hong', 4: 'cho', 5: 'cho', 7: 'cho', 6: 'cheong', 9: 'cheong', 10: 'cheong' };
  const TAGS = {
    jjok: '쪽!', ttadak: '따닥!', sweep: '판쓸이!', ppeok: '뻑!', jappeok: '자뻑!', ppeokEat: '뻑 먹기!', shake: '흔들기!',
    bomb: '폭탄!', kong: '콩알탄!', bonus: '보너스피', go: '고!', stop: '스톱!', chongtong: '총통!', samppeok: '3뻑!',
    nagari: '나가리', bombFlip: '폭탄 뒤집기', gukjin: '국진 선택', deal: '패를 나눴습니다',
  };
  const ITEM_LABEL = {
    ogwang: '오광', sagwang: '사광', samgwang: '삼광', bisamgwang: '비광 삼광', animal: '열끗', godori: '고도리', ribbon: '띠',
    hongdan: '홍단', cheongdan: '청단', chodan: '초단', pi: '피',
  };
  const FACTOR_LABEL = { go: '고', shake: '흔들기', bomb: '폭탄', nagari: '나가리', pibak: '피박', gwangbak: '광박', meongbak: '멍박', gobak: '고박' };

  let submit = null;
  let busy = false;
  let pendingSpecial = null; // { cardId, options } while the play-style prompt is open
  let lastState = null;
  let elementsById = new Map(); // public card id -> its element in the current render (no DOM attribute)
  let anchors = { backs: new Map(), piles: new Map(), stats: new Map(), deck: null };

  function info(id) {
    if (id === 'bonus-2') return { id, month: 0, kind: 'pi', piValue: 2, bonus: true };
    if (id === 'bonus-3') return { id, month: 0, kind: 'pi', piValue: 3, bonus: true };
    const match = /^m(\d\d)-(gwang|animal|ribbon|ssangpi|pi\d)$/.exec(id);
    if (!match) return null;
    const month = Number(match[1]);
    const part = match[2];
    const kind = part.startsWith('pi') || part === 'ssangpi' ? 'pi' : part;
    return { id, month, kind, piValue: part === 'ssangpi' ? 2 : kind === 'pi' ? 1 : 0, dan: kind === 'ribbon' ? RIBBON_DAN[month] || null : null, gukjin: id === 'm09-animal', rain: id === 'm12-gwang' };
  }

  const fmt = value => `${Number(value || 0).toLocaleString('ko-KR')}P`;
  const label = (state, seat) => state.players?.[seat]?.label || `${seat}번`;

  function cardEl(id, { size = 'normal', classes = '', button = false, track = false } = {}) {
    const c = info(id);
    const el = document.createElement(button ? 'button' : 'div');
    if (button) el.type = 'button';
    el.className = `hwatu hwatu-${size} month-${c.month} kind-${c.kind}${c.bonus ? ' bonus' : ''}${classes}`;
    const badge = c.bonus ? `${c.piValue === 3 ? '쓰리피' : '쌍피'}` : c.kind === 'gwang' ? (c.rain ? '비광' : '광') : c.kind === 'animal' ? (c.gukjin ? '국진' : '열끗') : c.kind === 'ribbon' ? (c.dan ? DAN[c.dan] : '띠') : c.piValue === 2 ? '쌍피' : '피';
    const monthText = c.bonus ? '보너스' : `${c.month}월`;
    const figure = FIGURES[id] || (c.bonus ? (c.piValue === 3 ? '✦✦✦' : '✦✦') : '');
    el.innerHTML = '';
    const top = document.createElement('span'); top.className = 'hwatuMonth'; top.textContent = monthText;
    const art = document.createElement('span'); art.className = 'hwatuArt';
    art.textContent = c.bonus ? figure : `${PLANTS[c.month]}${figure ? figure : ''}`;
    const tag = document.createElement('span'); tag.className = `hwatuBadge badge-${c.kind}${c.dan ? ` dan-${c.dan}` : ''}`; tag.textContent = badge;
    el.append(top, art, tag);
    if (c.kind === 'ribbon') { const band = document.createElement('span'); band.className = `hwatuRibbon${c.dan ? ` dan-${c.dan}` : ''}`; el.append(band); }
    el.setAttribute('aria-label', `${monthText}${c.bonus ? '' : ` ${MONTHS[c.month]}`} ${badge}`);
    if (track) elementsById.set(id, el);
    return el;
  }

  function backEl(size = 'small') {
    const el = document.createElement('div');
    el.className = `hwatu hwatu-${size} hwatuBack`;
    el.setAttribute('aria-hidden', 'true');
    return el;
  }

  function groupCaptured(ids) {
    const groups = { gwang: [], animal: [], ribbon: [], pi: [] };
    for (const id of ids) { const c = info(id); if (c) groups[c.kind].push(id); }
    groups.pi.sort((a, b) => info(b).piValue - info(a).piValue);
    return groups;
  }

  function recentSet(g) {
    const ev = g.lastEvent;
    return new Set([...(ev?.captured || []), ...(ev?.played || []), ...(ev?.flipped ? [ev.flipped] : [])]);
  }

  function renderSeat(state, seat, { mine = false } = {}) {
    const g = state.game;
    const info2 = g.seats[seat];
    const box = document.createElement('div');
    box.className = `gostopSeat${mine ? ' mine' : ''}${g.turn === seat && g.status === 'playing' ? ' isTurn' : ''}`;
    const head = document.createElement('div');
    head.className = 'gostopSeatHead';
    const name = document.createElement('strong');
    name.textContent = `${label(state, seat)}${mine ? ' (나)' : ''}`;
    const stats = document.createElement('span');
    stats.className = 'gostopStats';
    const bits = [`${info2.score}점`];
    if (info2.goCount) bits.push(`${info2.goCount}고`);
    if (info2.shakes) bits.push(`흔들기 ${info2.shakes}`);
    if (info2.bombs) bits.push(`폭탄 ${info2.bombs}`);
    if (info2.ppeok) bits.push(`뻑 ${info2.ppeok}`);
    if (info2.multiplier > 1) bits.push(`×${info2.multiplier}`);
    stats.textContent = bits.join(' · ');
    anchors.stats.set(seat, stats);
    head.append(name, stats);
    if (g.status === 'playing' && info2.score > 0) {
      // Always-visible compact line: "8점 · 2고 · ×4 · 예상 3,200P" (박 is only known at the end).
      const estimate = document.createElement('small');
      estimate.className = 'gostopEstimate';
      estimate.textContent = `${info2.score + info2.goCount}점${info2.goCount ? ` · ${info2.goCount}고` : ''} · ×${info2.multiplier} · 예상 ${fmt(info2.estimate)}`;
      head.append(estimate);
    }
    box.append(head);
    if (!mine) {
      const hand = document.createElement('div');
      hand.className = 'gostopBacks';
      for (let i = 0; i < info2.handCount; i += 1) hand.append(backEl('tiny'));
      anchors.backs.set(seat, hand);
      const count = document.createElement('small'); count.textContent = `손패 ${info2.handCount}장${info2.bombFlips ? ` · 폭탄 뒤집기 ${info2.bombFlips}` : ''}`;
      hand.append(count);
      box.append(hand);
    }
    const recent = recentSet(g);
    const groups = groupCaptured(info2.captured);
    const pile = document.createElement('div');
    pile.className = 'gostopCaptured';
    for (const [kind, title] of [['gwang', '광'], ['animal', '열끗'], ['ribbon', '띠'], ['pi', '피']]) {
      const col = document.createElement('div');
      col.className = `gostopPile pile-${kind}`;
      const cap = document.createElement('small');
      const count = kind === 'pi' ? info2.counts.pi : groups[kind].length;
      cap.textContent = `${title} ${count}`;
      col.append(cap);
      const row = document.createElement('div'); row.className = 'gostopPileCards';
      for (const id of groups[kind]) row.append(cardEl(id, { size: 'mini', track: true, classes: recent.has(id) && g.lastEvent?.seat === seat ? ' recentActionTarget' : '' }));
      col.append(row);
      anchors.piles.set(`${seat}:${kind}`, col);
      pile.append(col);
    }
    box.append(pile);
    if (info2.items?.length) {
      const items = document.createElement('small');
      items.className = 'gostopItems';
      items.textContent = info2.items.map(item => `${ITEM_LABEL[item.key] || item.key} ${item.points}`).join(' · ');
      box.append(items);
    }
    return box;
  }

  function renderFloor(state, recentApi) {
    const g = state.game;
    const floor = $('gostopFloor');
    floor.replaceChildren();
    const recent = recentSet(g);
    const fresh = recentApi?.observe(g.lastEvent ? `gostop:${g.round}:${g.lastEvent.seq}` : null);
    const myChoice = g.choice && g.turn === state.me.seat && g.status === 'playing' ? g.choice : null;
    const byMonth = new Map();
    for (const id of g.floor) { const m = info(id).month; if (!byMonth.has(m)) byMonth.set(m, []); byMonth.get(m).push(id); }
    for (const [month, ids] of [...byMonth.entries()].sort((a, b) => a[0] - b[0])) {
      const group = document.createElement('div');
      group.className = `gostopFloorGroup${g.ppeokOwner?.[month] ? ' ppeokStack' : ''}`;
      for (const id of [...ids, ...(g.floorBonus?.[month] || [])]) {
        const option = myChoice?.options?.includes(id);
        const el = cardEl(id, { button: Boolean(option), track: true, classes: `${recent.has(id) ? (recentApi?.classes(fresh) || '') : ''}${option ? ' actionableTarget' : ''}` });
        if (option) el.addEventListener('click', () => act('gostop-choose', { cardId: id }));
        group.append(el);
      }
      if (g.ppeokOwner?.[month]) {
        const tag = document.createElement('small'); tag.className = 'ppeokTag'; tag.textContent = `${label(state, g.ppeokOwner[month])} 뻑`;
        group.append(tag);
      }
      floor.append(group);
    }
    if (g.choice) {
      // The card waiting on a capture choice is public (it was played or flipped face up).
      const waiting = g.choice.played || g.choice.flipped;
      if (waiting) {
        const holder = document.createElement('div');
        holder.className = 'gostopFloorGroup waitingCard';
        for (const id of g.choice.pending || []) holder.append(cardEl(id, { size: 'mini', track: true }));
        holder.append(cardEl(waiting, { track: true, classes: ' recentActionActor' }));
        const note = document.createElement('small'); note.textContent = g.choice.kind === 'floor' ? '낸 패' : '뒤집은 패';
        holder.append(note);
        floor.append(holder);
      }
    }
    const deck = $('gostopDeck');
    deck.replaceChildren();
    if (g.status === 'playing' || g.deckCount) {
      const pile = backEl('normal');
      pile.classList.add('deckPile');
      anchors.deck = pile;
      const n = document.createElement('small'); n.textContent = `산 ${g.deckCount}장`;
      deck.append(pile, n);
    }
  }

  function renderEvent(state) {
    const g = state.game;
    const box = $('gostopEvent');
    box.replaceChildren();
    const ev = g.lastEvent;
    if (!ev) return;
    const tags = (ev.tags || []).filter(tag => TAGS[tag] && !(tag === 'deal' && g.moveCount));
    if (!tags.length && !ev.stolen?.length) return;
    const text = document.createElement('strong');
    text.textContent = `${ev.seat ? label(state, ev.seat) : ''} · ${tags.map(tag => TAGS[tag]).join(' ')}${ev.stolen?.length ? ` · 피 ${ev.stolen.length}장 가져옴` : ''}${ev.goCount ? ` (${ev.goCount}고)` : ''}`;
    box.append(text);
    if (ev.revealed?.length) {
      const row = document.createElement('span'); row.className = 'gostopReveal';
      for (const id of ev.revealed) row.append(cardEl(id, { size: 'mini' }));
      box.append(row);
    }
  }

  function renderHand(state) {
    const g = state.game;
    const hand = $('gostopHand');
    const actions = $('gostopActions');
    hand.replaceChildren();
    actions.replaceChildren();
    const mine = state.me.myGostopHand;
    if (!mine) { hand.classList.add('hidden'); return; }
    hand.classList.remove('hidden');
    const seat = state.me.seat;
    const myTurn = g.status === 'playing' && !g.paused && g.turn === seat;
    // Input follows the visible table: while cards are still moving, the hand waits for them.
    const canPlay = myTurn && g.phase === 'play' && !busy && !fxRun;
    const actionable = window.GameActionable;
    for (const card of [...mine].sort((a, b) => (info(a.id).month || 99) - (info(b.id).month || 99))) {
      const el = cardEl(card.id, { size: 'hand', button: true, track: true, classes: actionable?.classes(canPlay) || '' });
      el.disabled = !canPlay;
      if (card.shake || card.bomb || card.kong) el.classList.add('hasSpecial');
      el.addEventListener('click', () => {
        if (!canPlay) return;
        if (card.shake || card.bomb || card.kong) { pendingSpecial = { cardId: card.id, options: card }; render(lastState); return; }
        act('gostop-play', { cardId: card.id });
      });
      hand.append(el);
    }
    const button = (text, onClick, primary = false) => {
      const b = document.createElement('button');
      const locked = busy || Boolean(fxRun);
      b.type = 'button'; b.className = primary ? 'primary' : 'secondary';
      b.textContent = text; b.disabled = locked;
      if (actionable) actionable.set(b, !locked, primary ? 'primary' : 'target');
      b.addEventListener('click', onClick);
      actions.append(b);
      return b;
    };
    if (canPlay && pendingSpecial && mine.some(card => card.id === pendingSpecial.cardId)) {
      const { cardId, options } = pendingSpecial;
      const note = document.createElement('small'); note.textContent = `${info(cardId).month}월 3장을 들고 있습니다.`;
      if (options.bomb) button('폭탄', () => { pendingSpecial = null; act('gostop-play', { cardId, bomb: true }); }, true);
      if (options.kong) button('콩알탄', () => { pendingSpecial = null; act('gostop-play', { cardId, kong: true }); }, true);
      if (options.shake) button('흔들고 내기', () => { pendingSpecial = null; act('gostop-play', { cardId, shake: true }); }, true);
      button('그냥 내기', () => { pendingSpecial = null; act('gostop-play', { cardId }); });
      button('취소', () => { pendingSpecial = null; render(lastState); });
      if (!options.kong) actions.prepend(note);
    } else pendingSpecial = null;
    if (canPlay && g.seats[seat]?.bombFlips > 0) button(`폭탄 뒤집기 (${g.seats[seat].bombFlips})`, () => act('gostop-flip', {}));
    if (myTurn && g.phase === 'go-stop') {
      const now = g.seats[seat];
      const note = document.createElement('small'); note.textContent = `${now.score}점${now.goCount ? ` · ${now.goCount}고` : ''} — 고 또는 스톱을 선택하세요.`;
      actions.append(note);
      button(`고 (${now.goCount + 1}고)`, () => act('gostop-decide', { choice: 'go' }), true);
      button('스톱', () => act('gostop-decide', { choice: 'stop' }), true);
    }
    if (myTurn && g.phase === 'gukjin') {
      const note = document.createElement('small'); note.textContent = '9월 국진을 어디에 쓸까요?';
      actions.append(note);
      button('열끗으로', () => act('gostop-gukjin', { asPi: false }), true);
      button('쌍피로', () => act('gostop-gukjin', { asPi: true }), true);
    }
    if (myTurn && (g.phase === 'choose-floor' || g.phase === 'choose-flip')) {
      const note = document.createElement('small'); note.textContent = '바닥에서 먹을 패를 고르세요.';
      actions.append(note);
    }
  }

  function renderResult(state) {
    const g = state.game;
    const box = $('gostopResult');
    box.replaceChildren();
    const r = g.result;
    if (!r || !['finished', 'draw'].includes(g.status)) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    const title = document.createElement('strong');
    const settled = g.settlement?.status === 'done';
    const paidOf = (from, to) => g.settlement?.transfers?.find(item => item.fromSeat === from && item.toSeat === to);
    if (r.kind === 'nagari') {
      title.textContent = `나가리 · 다음 판 ×${r.nextMultiplier}`;
      box.append(title);
      const note = document.createElement('p'); note.textContent = '포인트 이동 없음 · 참가자가 같으면 배수가 이어집니다.';
      box.append(note);
      return;
    }
    if (r.kind === 'forfeit') {
      title.textContent = `${r.forfeiting.map(seat => label(state, seat)).join(', ')} ${r.reason === 'resign' ? '기권' : '응답 없음'} · ${r.score}점 × 점당 ${r.pointsPerScore}P 기준`;
      box.append(title);
      for (const item of r.payments) {
        const line = document.createElement('p');
        const paid = paidOf(item.from, item.to);
        line.textContent = `${label(state, item.from)} → ${label(state, item.to)} ${fmt(paid ? paid.paid : item.amount)}${paid?.capped ? ` (보유 포인트 한도로 ${fmt(item.amount)} 중 지급)` : ''}`;
        box.append(line);
      }
      if (!settled) { const wait = document.createElement('small'); wait.textContent = '포인트 정산 처리 중…'; box.append(wait); }
      return;
    }
    const reasonText = r.reason === 'chongtong' ? '총통' : r.reason === 'samppeok' ? '3뻑' : '스톱';
    title.textContent = `${label(state, r.winner)} 승리 · ${reasonText}`;
    box.append(title);
    // Basis chips: 기본 점수 · 고 점수 · 점당 -- then one line per loser with only that loser's factors.
    const basis = document.createElement('div');
    basis.className = 'gostopCalc';
    const chip = (text, extra = '') => { const el = document.createElement('span'); el.className = `gostopChip${extra}`; el.textContent = text; basis.append(el); };
    chip(r.instant ? `${reasonText} ${r.base}점 고정` : `기본 ${r.base}점`);
    if (r.items?.length && !r.instant) chip(r.items.map(item => `${ITEM_LABEL[item.key] || item.key} ${item.points}`).join(' · '), ' muted');
    if (r.goCount) chip(`${r.goCount}고 +${r.goCount}점`);
    chip(`점당 ${r.pointsPerScore}P`);
    box.append(basis);
    let total = 0;
    for (const loser of r.losers) {
      const line = document.createElement('p');
      line.className = 'gostopLoserLine';
      const factors = loser.factors.map(item => `${item.key === 'go' ? `${item.count}고` : FACTOR_LABEL[item.key] || item.key}${item.count > 1 && item.key !== 'go' ? ` ${item.count}회` : ''} ×${item.multiplier}`).join(' · ');
      const paid = paidOf(loser.seat, r.winner);
      const amount = paid ? paid.paid : loser.amount;
      total += amount;
      line.textContent = `${label(state, loser.seat)} → -${fmt(amount)} · ${r.score}점${factors ? ` · ${factors}` : ''} × ${r.pointsPerScore}P = ${fmt(loser.amount)}`
        + (paid?.capped ? ` · 계산 ${fmt(loser.amount)} → 실제 ${fmt(paid.paid)} (보유 포인트 한도 적용)` : '');
      box.append(line);
    }
    const win = document.createElement('p');
    win.className = 'gostopWinLine';
    win.textContent = settled ? `${label(state, r.winner)} → +${fmt(total)}` : '포인트 정산 처리 중…';
    box.append(win);
  }

  function renderSetup(state) {
    const g = state.game;
    const setup = $('gostopSetup');
    const selecting = g.status === 'selecting';
    setup.classList.toggle('hidden', !selecting);
    if (!selecting) return;
    const host = Boolean(state.me.isHost);
    const select = $('gostopStakeSelect');
    select.value = String(g.pointsPerScore);
    select.disabled = !host || busy;
    const seated = ['1', '2', '3'].filter(seat => state.players?.[seat]).length;
    const start = $('gostopStartBtn');
    start.classList.toggle('hidden', !host);
    start.disabled = busy || seated < 2;
    start.textContent = seated === 3 ? '고스톱 시작 (3인)' : seated === 2 ? '맞고 시작 (2인)' : '2~3명 필요';
    window.GameActionable?.set(start, host && seated >= 2 && !busy, 'primary');
    $('gostopSetupNote').textContent = `2명 맞고 · 3명 고스톱 · 점당 ${g.pointsPerScore}P${g.nagariStreak ? ` · 나가리 ×${g.nagariMultiplier} 이월` : ''}`;
  }

  function render(state) {
    const before = lastState?.gameType === 'gostop' && state?.gameType === 'gostop' && elementsById.size ? snapshot() : null;
    lastState = state;
    if (!state || state.gameType !== 'gostop') { cancelFx(); seenEventKey = undefined; prevItems = null; return; }
    elementsById = new Map();
    anchors = { backs: new Map(), piles: new Map(), stats: new Map(), deck: null };
    const g = state.game;
    const seat = state.me?.seat || null;
    const modeText = g.status === 'selecting' ? '고스톱 · 맞고' : g.mode === 'matgo' ? '맞고' : '고스톱';
    $('gostopTitle').textContent = modeText;
    $('gostopMeta').textContent = g.status === 'selecting' ? '' : `점당 ${g.pointsPerScore}P${g.nagariStreak ? ` · 나가리 ×${g.nagariMultiplier}` : ''} · ${g.mode === 'matgo' ? '7점' : '3점'}부터 고/스톱`;
    $('gostopMyPoints').textContent = state.me?.pointBalance === null || state.me?.pointBalance === undefined ? '' : `내 포인트 ${fmt(state.me.pointBalance)}`;
    renderSetup(state);
    const others = $('gostopOpponents');
    others.replaceChildren();
    const mineBox = $('gostopMine');
    mineBox.replaceChildren();
    if (g.status !== 'selecting') {
      for (const s of g.seatOrder) if (s !== seat) others.append(renderSeat(state, s));
      if (seat && g.seats[seat]) mineBox.append(renderSeat(state, seat, { mine: true }));
    }
    renderFloor(state, window.GameRecentAction);
    renderEvent(state);
    renderHand(state);
    renderResult(state);
    afterRender(state, before);
  }


  // ---- v1.6.88: cosmetic card movement --------------------------------------------------------
  // The server state is already final when it arrives; these sprites only replay the public moves
  // listed in lastEvent.steps (every card there is face up for everyone) from where the cards were in
  // the previous render to where they are now. Final elements stay hidden until their card lands.
  // One run at a time (generation id); a newer event cancels an older run and snaps it to the end.
  const FX = { move: 380, flip: 440, capture: 420, gap: 90, look: 200, glow: 320 };
  const BASE_W = 46; const BASE_H = 68;
  const SPECIAL_TAGS = ['jjok', 'ttadak', 'sweep', 'ppeok', 'jappeok', 'ppeokEat', 'bomb', 'kong', 'shake', 'bonus'];
  let fxRun = null;
  let fxGen = 0;
  let seenEventKey; // undefined until the first table of this room is shown (that one never animates)
  let animatedTurn = { key: null, count: 0 };
  let prevItems = null;
  const fxLog = [];

  const reducedMotion = () => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const rectOf = el => (el?.isConnected ? el.getBoundingClientRect() : null);
  const plain = r => (r ? { left: r.left, top: r.top, width: r.width, height: r.height } : null);

  function snapshot() {
    const cards = new Map();
    for (const [id, el] of elementsById) { const r = rectOf(el); if (r?.width) cards.set(id, plain(r)); }
    if (fxRun) for (const [id, sprite] of fxRun.sprites) if (sprite._at) cards.set(id, sprite._at);
    return { cards, backs: new Map([...anchors.backs].map(([seat, el]) => [seat, plain(rectOf(el))])), deck: plain(rectOf(anchors.deck)), floor: plain(rectOf($('gostopFloor'))) };
  }

  function layer() {
    let el = document.getElementById('gostopFxLayer');
    if (!el) { el = document.createElement('div'); el.id = 'gostopFxLayer'; el.className = 'gostopFxLayer'; el.setAttribute('aria-hidden', 'true'); document.body.append(el); }
    return el;
  }

  const tf = r => `translate(${r.left}px, ${r.top}px) scale(${r.width / BASE_W}, ${r.height / BASE_H})`;
  const sized = (r, w = BASE_W, h = BASE_H) => ({ left: r.left + (r.width - w) / 2, top: r.top + (r.height - h) / 2, width: w, height: h });
  const near = (r, i = 0) => ({ left: r.left + 16 + i * 7, top: r.top + 7, width: r.width, height: r.height });

  function stepCards(step) { return step.cards || (step.card ? [step.card] : []); }

  function afterRender(state, before) {
    const g = state.game;
    const ev = g.lastEvent;
    const key = ev ? `${g.round}:${ev.seq}` : null;
    const items = Object.fromEntries(Object.entries(g.seats || {}).map(([seat, info2]) => [seat, Object.fromEntries((info2.items || []).map(item => [item.key, item.points]))]));
    const oldItems = prevItems;
    prevItems = items;
    if (fxRun && fxRun.key === key) { fxRun.rehide(); return; } // same event re-rendered (chat, presence…)
    const first = seenEventKey === undefined;
    if (!first && key === seenEventKey) return;
    seenEventKey = key;
    cancelFx();
    let steps = ev?.steps || [];
    const turnKey = ev && ev.turn != null ? `${g.round}:${ev.turn}` : null;
    if (turnKey && turnKey === animatedTurn.key) steps = steps.slice(animatedTurn.count);
    animatedTurn = { key: turnKey, count: (ev?.steps || []).length };
    // Entering, reconnecting and reduced motion show the final table directly.
    if (first || !before || !ev || reducedMotion() || g.status === 'selecting') return;
    runFx(state, key, steps, before, ev, oldItems, items);
  }

  function cancelFx() {
    const run = fxRun;
    if (!run) return;
    run.cancelled = true;
    fxRun = null;
    for (const sprite of run.sprites.values()) sprite.remove();
    for (const el of run.temps) el.remove();
    for (const el of document.querySelectorAll('.gostopFxHidden')) el.classList.remove('gostopFxHidden');
  }

  function runFx(state, key, steps, before, ev, oldItems, items) {
    const run = { key, gen: ++fxGen, sprites: new Map(), temps: new Set(), hidden: new Set(), cancelled: false };
    for (const step of steps) if (step.k !== 'reveal' && step.k !== 'match') for (const id of stepCards(step)) run.hidden.add(id);
    run.rehide = () => { for (const id of run.hidden) elementsById.get(id)?.classList.add('gostopFxHidden'); };
    run.rehide();
    fxRun = run;
    renderHand(state); // lock the hand while the cards move
    const me = state.me?.seat || null;
    (async () => {
      try {
        for (let i = 0; i < steps.length; i += 1) {
          if (run.cancelled) return;
          await doStep(run, steps[i], steps[i + 1] || null, me, before);
          await wait(FX.gap);
        }
        if (run.cancelled) return;
        const tags = (ev.tags || []).filter(tag => SPECIAL_TAGS.includes(tag));
        if (tags.length) badge(run, tags.map(tag => TAGS[tag]).join(' '), ev.seat);
        pulseScores(run, oldItems, items);
        if ((ev.tags || []).includes('go')) pulse(anchors.stats.get(ev.seat));
        if (tags.length) await wait(500);
      } finally {
        if (fxRun === run) { cancelFx(); if (lastState?.gameType === 'gostop') renderHand(lastState); }
      }
    })();
  }

  function log(run, k, id, from, to, seat) {
    fxLog.push({ run: run.gen, k, card: id, seat: seat || null, from: from && { x: Math.round(from.left), y: Math.round(from.top) }, to: to && { x: Math.round(to.left), y: Math.round(to.top) } });
    if (fxLog.length > 200) fxLog.splice(0, fxLog.length - 200);
  }

  function spriteFor(run, id, at, { back = false } = {}) {
    let el = run.sprites.get(id);
    if (el) return el;
    el = cardEl(id, { size: 'normal' });
    el.classList.add('gostopSprite');
    if (back) el.classList.add('fxBack');
    el._at = at;
    el.style.transform = tf(at);
    layer().append(el);
    run.sprites.set(id, el);
    return el;
  }

  function move(el, to, ms, { flipAt = null } = {}) {
    const from = el._at;
    el._at = to;
    el.style.transform = tf(to);
    if (flipAt !== null) setTimeout(() => el.classList.remove('fxBack'), ms * flipAt);
    if (!from) return Promise.resolve();
    return el.animate([{ transform: tf(from) }, { transform: tf(to) }], { duration: ms, easing: 'cubic-bezier(.2,.7,.2,1)' }).finished.catch(() => {});
  }

  function land(run, id) {
    const sprite = run.sprites.get(id);
    if (sprite) { sprite.remove(); run.sprites.delete(id); }
    run.hidden.delete(id);
    elementsById.get(id)?.classList.remove('gostopFxHidden');
  }

  const finalRect = id => plain(rectOf(elementsById.get(id)));
  function backsRect(before, seat, i) {
    const r = before.backs.get(seat) || plain(rectOf(anchors.backs.get(seat)));
    return r ? { left: r.left + i * 10, top: r.top - 20, width: BASE_W, height: BASE_H } : null;
  }

  async function doStep(run, step, next, me, before) {
    const pos = id => run.sprites.get(id)?._at || before.cards.get(id) || null;
    const partnerOf = cards => (next?.k === 'match' || next?.k === 'stack') ? next.cards.find(id => !cards.includes(id)) : null;
    if (step.k === 'reveal') {
      // 흔들기: the three cards of the month rise and fan out briefly (only these three are shown).
      const moves = step.cards.map((id, i) => {
        const start = (step.seat === me && before.cards.get(id)) || backsRect(before, step.seat, i);
        if (!start) return null;
        const el = spriteFor(run, id, start);
        el.classList.add('fxReveal');
        log(run, 'reveal', id, start, null, step.seat);
        return move(el, { ...start, left: start.left + (step.seat === me ? 0 : i * 26), top: start.top - 22 }, 260);
      });
      await Promise.all(moves);
      await wait(520);
      for (const id of step.cards) {
        if (next?.k === 'play' && next.cards.includes(id)) continue; // the played one keeps going
        const el = run.sprites.get(id);
        if (!el) continue;
        run.sprites.delete(id);
        run.temps.add(el);
        el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' }).finished.then(() => el.remove(), () => {});
      }
      return;
    }
    if (step.k === 'play') {
      const partner = partnerOf(step.cards);
      await Promise.all(step.cards.map((id, i) => {
        const known = run.sprites.has(id);
        const start = run.sprites.get(id)?._at || (step.seat === me ? before.cards.get(id) : null) || backsRect(before, step.seat, i);
        const partnerAt = partner ? (pos(partner) || finalRect(partner)) : null;
        const target = partnerAt ? near(partnerAt, i) : (finalRect(id) || (before.floor && sized(before.floor)));
        if (!start || !target) return null;
        const hidden = !known && step.seat !== me;
        const el = spriteFor(run, id, start, { back: hidden });
        log(run, 'play', id, start, target, step.seat);
        return move(el, target, FX.move, { flipAt: hidden ? 0.45 : null });
      }));
      return;
    }
    if (step.k === 'flip') {
      const start = before.deck || plain(rectOf(anchors.deck));
      if (!start) return;
      const partner = partnerOf([step.card]);
      const partnerAt = partner ? (pos(partner) || finalRect(partner)) : null;
      const target = partnerAt ? near(partnerAt) : step.bonus ? { ...start, left: start.left + 58 } : (finalRect(step.card) || start);
      const el = spriteFor(run, step.card, start, { back: true });
      log(run, 'flip', step.card, start, target);
      await move(el, target, FX.flip, { flipAt: 0.5 });
      await wait(FX.look); // let the month be read before anything else moves
      return;
    }
    if (step.k === 'place') {
      for (const id of step.cards) {
        const el = run.sprites.get(id);
        const target = finalRect(id);
        if (el && target) { log(run, 'place', id, el._at, target); await move(el, target, 220); }
        land(run, id);
      }
      return;
    }
    if (step.k === 'match') {
      // Floor cards taking part get a sprite where they lay, then everything in the match glows together.
      for (const id of step.cards) if (!run.sprites.has(id) && before.cards.get(id)) spriteFor(run, id, before.cards.get(id));
      for (const id of step.cards) run.sprites.get(id)?.classList.add('fxGlow');
      log(run, 'match', step.cards.join(','), null, null);
      await wait(FX.glow);
      return;
    }
    if (step.k === 'stack') {
      // 뻑: the cards settle on the floor as one stacked pile that stays there.
      for (const id of step.cards) if (!run.sprites.has(id) && before.cards.get(id)) spriteFor(run, id, before.cards.get(id));
      await Promise.all(step.cards.map((id) => {
        const el = run.sprites.get(id);
        const target = finalRect(id);
        if (!el || !target) return null;
        log(run, 'stack', id, el._at, target);
        return move(el, target, 300);
      }));
      for (const id of step.cards) land(run, id);
      pulse(elementsById.get(step.cards[0])?.closest('.gostopFloorGroup'));
      return;
    }
    if (step.k === 'capture' || step.k === 'steal') {
      const cards = stepCards(step);
      const seat = step.k === 'capture' ? step.seat : step.to;
      await Promise.all(cards.map(async (id, i) => {
        const start = pos(id);
        const target = finalRect(id) || plain(rectOf(anchors.piles.get(`${seat}:${info(id)?.kind}`)));
        if (!start || !target) { land(run, id); return; }
        const el = spriteFor(run, id, start);
        el.classList.remove('fxGlow');
        await wait(i * 45);
        log(run, step.k, id, start, target, seat);
        await move(el, target, step.k === 'steal' ? FX.move : FX.capture);
        land(run, id);
      }));
    }
  }

  function pulse(el) {
    if (!el) return;
    el.classList.remove('fxPulse');
    void el.offsetWidth; // restart the animation
    el.classList.add('fxPulse');
    setTimeout(() => el.classList.remove('fxPulse'), 950);
  }

  const ITEM_PILE = { ogwang: 'gwang', sagwang: 'gwang', samgwang: 'gwang', bisamgwang: 'gwang', animal: 'animal', godori: 'animal', ribbon: 'ribbon', hongdan: 'ribbon', cheongdan: 'ribbon', chodan: 'ribbon', pi: 'pi' };
  function pulseScores(run, oldItems, items) {
    if (!oldItems) return;
    for (const [seat, now] of Object.entries(items)) {
      for (const [itemKey, points] of Object.entries(now)) {
        const was = oldItems[seat]?.[itemKey] || 0;
        if (points <= was) continue;
        const pile = anchors.piles.get(`${seat}:${ITEM_PILE[itemKey]}`);
        if (!pile) continue;
        pulse(pile);
        const tag = document.createElement('span');
        tag.className = 'fxScoreTag';
        tag.textContent = `${ITEM_LABEL[itemKey] || itemKey} ${was ? `+${points - was}` : points}`;
        pile.querySelector('small')?.append(tag);
        setTimeout(() => tag.remove(), 1600);
      }
    }
  }

  function badge(run, text, seat) {
    const anchor = plain(rectOf($('gostopFloor')));
    if (!anchor) return;
    const el = document.createElement('div');
    el.className = 'fxBadge';
    el.textContent = text;
    el.style.left = `${anchor.left + anchor.width / 2}px`;
    el.style.top = `${anchor.top + 8}px`;
    layer().append(el);
    run.temps.add(el);
    el.animate([{ opacity: 0, transform: 'translate(-50%, 6px) scale(.9)' }, { opacity: 1, transform: 'translate(-50%, 0) scale(1)' }], { duration: 180, fill: 'forwards' });
    setTimeout(() => el.remove(), 1100);
  }

  async function act(action, payload) {
    if (busy || !submit) return;
    busy = true;
    render(lastState);
    try { await submit(action, payload); } finally {
      busy = false;
      if (lastState?.gameType === 'gostop') render(lastState);
    }
  }

  function init(roomAction) {
    submit = roomAction;
    $('gostopStakeSelect').addEventListener('change', event => act('set-gostop-stake', { pointsPerScore: Number(event.target.value) }));
    $('gostopStartBtn').addEventListener('click', () => act('start-gostop', {}));
  }

  // fxLog/fxBusy: read-only hooks for browser tests (public card ids and screen positions only).
  window.GostopUI = { init, render, cardInfo: info, fxLog, fxBusy: () => Boolean(fxRun) };
})();
