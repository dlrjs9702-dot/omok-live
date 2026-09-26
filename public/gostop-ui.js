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

  function cardEl(id, { size = 'normal', classes = '', button = false } = {}) {
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
    head.append(name, stats);
    if (g.status === 'playing' && info2.score > 0) {
      const estimate = document.createElement('small');
      estimate.className = 'gostopEstimate';
      estimate.textContent = `현재 ${info2.score + info2.goCount}점 · ×${info2.multiplier} · 현재 기준 ${fmt(info2.estimate)}`;
      head.append(estimate);
    }
    box.append(head);
    if (!mine) {
      const hand = document.createElement('div');
      hand.className = 'gostopBacks';
      for (let i = 0; i < info2.handCount; i += 1) hand.append(backEl('tiny'));
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
      for (const id of groups[kind]) row.append(cardEl(id, { size: 'mini', classes: recent.has(id) && g.lastEvent?.seat === seat ? ' recentActionTarget' : '' }));
      col.append(row);
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
        const el = cardEl(id, { button: Boolean(option), classes: `${recent.has(id) ? (recentApi?.classes(fresh) || '') : ''}${option ? ' actionableTarget' : ''}` });
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
        holder.append(cardEl(waiting, { classes: ' recentActionActor' }));
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
    const canPlay = myTurn && g.phase === 'play' && !busy;
    const actionable = window.GameActionable;
    for (const card of [...mine].sort((a, b) => (info(a.id).month || 99) - (info(b.id).month || 99))) {
      const el = cardEl(card.id, { size: 'hand', button: true, classes: actionable?.classes(canPlay) || '' });
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
      b.type = 'button'; b.className = primary ? 'primary' : 'secondary';
      b.textContent = text; b.disabled = busy;
      if (actionable) actionable.set(b, !busy, primary ? 'primary' : 'target');
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
      title.textContent = `나가리 · 포인트 이동 없음 · 다음 판 ×${r.nextMultiplier}`;
      box.append(title);
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
    const basis = document.createElement('p');
    const parts = [`기본 ${r.base}점`];
    if (r.items?.length && !['chongtong', 'samppeok'].includes(r.reason)) parts[0] += ` (${r.items.map(item => `${ITEM_LABEL[item.key] || item.key} ${item.points}`).join(', ')})`;
    if (r.goCount) parts.push(`${r.goCount}고 +${r.goCount}점`);
    parts.push(`점당 ${r.pointsPerScore}P`);
    basis.textContent = parts.join(' · ');
    box.append(basis);
    let total = 0;
    for (const loser of r.losers) {
      const line = document.createElement('p');
      const factors = loser.factors.map(item => `${item.key === 'go' ? `${item.count}고` : FACTOR_LABEL[item.key] || item.key}${item.count > 1 && item.key !== 'go' ? ` ${item.count}` : ''} ×${item.multiplier}`).join(' · ');
      const paid = paidOf(loser.seat, r.winner);
      const amount = paid ? paid.paid : loser.amount;
      total += amount;
      line.textContent = `${label(state, loser.seat)} → -${fmt(amount)} (${r.score}점${factors ? ` · ${factors}` : ''} × ${r.pointsPerScore}P = ${fmt(loser.amount)})${paid?.capped ? ' · 보유 포인트 한도 적용' : ''}`;
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
    lastState = state;
    if (!state || state.gameType !== 'gostop') return;
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

  window.GostopUI = { init, render, cardInfo: info };
})();
