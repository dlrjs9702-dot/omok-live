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
    firstPpeok: '첫뻑 보너스!', secondPpeok: '2연뻑 보너스!',
    nagari: '나가리', bombFlip: '폭탄 뒤집기', gukjin: '국진 선택', deal: '패를 나눴습니다',
  };
  const ITEM_LABEL = {
    ogwang: '오광', sagwang: '사광', samgwang: '삼광', bisamgwang: '비광 삼광', animal: '열끗', godori: '고도리', ribbon: '띠',
    hongdan: '홍단', cheongdan: '청단', chodan: '초단', pi: '피',
  };
  const FACTOR_LABEL = { go: '고', shake: '흔들기', bomb: '폭탄', nagari: '나가리', pibak: '피박', gwangbak: '광박', meongbak: '멍박', gobak: '고박' };

  let submit = null;
  let busy = false;
  let pointAccount = null;
  let pendingSpecial = null; // { cardId, options } while the play-style prompt is open
  let lastState = null;
  let stagedResultKey = null;
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
  const BAK_KEYS = new Set(['pibak', 'gwangbak', 'meongbak', 'gobak']);
  const factorOrder = key => ({ go: 1, shake: 2, bomb: 3, pibak: 4, gwangbak: 4, meongbak: 4, gobak: 4, nagari: 5 }[key] || 9);
  function factorText(item) {
    const name = item.key === 'go' ? `${item.count}고` : (FACTOR_LABEL[item.key] || item.key);
    const repeat = item.count > 1 && item.key !== 'go' ? ` ${item.count}회` : '';
    return `${name}${repeat} ×${item.multiplier}`;
  }
  const orderedFactors = factors => [...(factors || [])].sort((a, b) => factorOrder(a.key) - factorOrder(b.key));

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
    // v1.7.4: the game center's own vector hwatu (public/hwatu-art.js); emoji only as a fallback.
    const vector = window.HwatuArt?.svg(id);
    if (vector) { art.innerHTML = vector; el.classList.add('hasArt'); }
    else art.textContent = c.bonus ? figure : `${PLANTS[c.month]}${figure ? figure : ''}`;
    const tag = document.createElement('span'); tag.className = `hwatuBadge badge-${c.kind}${c.dan ? ` dan-${c.dan}` : ''}`; tag.textContent = badge;
    el.append(art, top, tag);
    if (c.kind === 'ribbon' && !vector) { const band = document.createElement('span'); band.className = `hwatuRibbon${c.dan ? ` dan-${c.dan}` : ''}`; el.append(band); }
    el.setAttribute('aria-label', `${monthText}${c.bonus ? '' : ` ${MONTHS[c.month]}`} ${badge}`);
    if (track) elementsById.set(id, el);
    return el;
  }

  // v1.7.42 skins: the hwatu faces are shared and never redrawn; a skin changes backs, frames, areas and effects.
  const SKN = () => window.SkinLooks;
  const skinOf = (state, seat) => SKN()?.def(state?.players?.[seat]?.skin) || null;
  // The deck has no owner: it shows the back of the first seated player who has a skin (stable for the whole table).
  const deckSkin = (state) => { for (const seat of state?.game?.seatOrder || []) { const d = skinOf(state, seat); if (d?.back) return d; } return null; };
  let trayApplied = null;
  let panelApplied = null;
  let winPlayed = null;

  function backEl(size = 'small', skin = null) {
    const el = document.createElement('div');
    el.className = `hwatu hwatu-${size} hwatuBack`;
    el.setAttribute('aria-hidden', 'true');
    if (skin?.back) SKN().h.style(el, skin.back);
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
    const seatSkin = skinOf(state, seat);
    if (seatSkin?.seat) SKN().h.style(box, seatSkin.seat);
    const head = document.createElement('div');
    head.className = 'gostopSeatHead';
    const name = document.createElement('strong');
    name.textContent = `${label(state, seat)}${mine ? ' (나)' : ''}`;
    const stats = document.createElement('span');
    stats.className = 'gostopStats';
    const bits = [`${info2.scoreWithGo ?? info2.score}점`];
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
      estimate.textContent = `${info2.scoreWithGo ?? info2.score}점${info2.goCount ? ` · ${info2.goCount}고` : ''} · ×${info2.multiplier} · 예상 ${fmt(info2.estimate)}`;
      head.append(estimate);
    }
    box.append(head);
    if (!mine) {
      const hand = document.createElement('div');
      hand.className = 'gostopBacks';
      for (let i = 0; i < info2.handCount; i += 1) hand.append(backEl('tiny', seatSkin));
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
      if (seatSkin?.pile) SKN().h.style(col, seatSkin.pile);
      const cap = document.createElement('small');
      const actualCards = groups[kind].length;
      const count = kind === 'pi' ? info2.counts.pi : actualCards;
      cap.textContent = kind === 'pi' && count !== actualCards ? `${title} ${count} · 카드 ${actualCards}장` : `${title} ${count}`;
      if (kind === 'pi') cap.title = '피 숫자는 점수 계산상 개수입니다. 쌍피·쓰리피는 2피·3피로 계산됩니다.';
      col.append(cap);
      const row = document.createElement('div'); row.className = 'gostopPileCards';
      for (const id of groups[kind]) row.append(cardEl(id, { size: 'mini', track: true, classes: recent.has(id) && g.lastEvent?.seat === seat ? ' recentActionTarget' : '' }));
      col.append(row);
      anchors.piles.set(`${seat}:${kind}`, col);
      pile.append(col);
    }
    box.append(pile);
    if (info2.items?.length || info2.goCount || info2.factors?.length) {
      const detail = document.createElement('details');
      detail.className = 'gostopScoreDetails';
      const summary = document.createElement('summary');
      summary.textContent = `${info2.scoreWithGo ?? info2.score}점 구성`;
      detail.append(summary);
      const body = document.createElement('div');
      body.className = 'gostopScoreDetailBody';
      for (const item of info2.items || []) {
        const part = document.createElement('span');
        part.textContent = `${ITEM_LABEL[item.key] || item.key} ${item.points}점`;
        body.append(part);
      }
      if (info2.goCount) {
        const part = document.createElement('span');
        part.textContent = `${info2.goCount}고 +${info2.goCount}점`;
        body.append(part);
      }
      if (info2.factors?.length) {
        const factors = document.createElement('span');
        factors.className = 'gostopFactorLine';
        factors.textContent = orderedFactors(info2.factors).map(factorText).join(' · ');
        body.append(factors);
      }
      detail.append(body);
      box.append(detail);
    }
    return box;
  }

  function renderFloor(state, recentApi) {
    const g = state.game;
    const floor = $('gostopFloor');
    floor.replaceChildren();
    const recent = recentSet(g);
    const fresh = recentApi?.observe(g.lastEvent ? `gostop:${g.round}:${g.lastEvent.seq}` : null);
    const publicChoice = g.choice && g.status === 'playing' ? g.choice : null;
    const myChoice = publicChoice && g.turn === state.me.seat ? publicChoice : null;
    const choiceOptions = new Set(publicChoice?.options || []);
    const byMonth = new Map();
    for (const id of g.floor) { const m = info(id).month; if (!byMonth.has(m)) byMonth.set(m, []); byMonth.get(m).push(id); }
    for (const [month, ids] of [...byMonth.entries()].sort((a, b) => a[0] - b[0])) {
      const group = document.createElement('div');
      group.className = `gostopFloorGroup${g.ppeokOwner?.[month] ? ' ppeokStack' : ''}`;
      for (const id of [...ids, ...(g.floorBonus?.[month] || [])]) {
        const publicOption = choiceOptions.has(id);
        const option = Boolean(myChoice && publicOption);
        const choiceClass = publicChoice ? (publicOption ? ' gostopChoiceTarget' : ' gostopChoiceMuted') : '';
        const actionClass = option ? ' actionableTarget' : '';
        const el = cardEl(id, { button: option, track: true, classes: `${recent.has(id) ? (recentApi?.classes(fresh) || '') : ''}${choiceClass}${actionClass}` });
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
      const pile = backEl('normal', deckSkin(state));
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
    SKN().h.unstyle(hand, trayApplied);
    trayApplied = state.me?.seat ? (skinOf(state, state.me.seat)?.tray || null) : null;
    if (trayApplied) SKN().h.style(hand, trayApplied);
    const mine = state.me.myGostopHand;
    if (!mine) { hand.classList.add('hidden'); return; }
    hand.classList.remove('hidden');
    const seat = state.me.seat;
    const myTurn = g.status === 'playing' && !g.paused && g.turn === seat;
    // Input follows the visible table: while cards are still moving, the hand waits for them.
    const canPlay = myTurn && g.phase === 'play' && !busy && !fxRun;
    const actionable = window.GameActionable;
    for (const card of [...mine].sort((a, b) => (info(a.id).month || 99) - (info(b.id).month || 99))) {
      const legal = canPlay && card.legal !== false;
      const unavailable = myTurn && !legal;
      const el = cardEl(card.id, { size: 'hand', button: true, track: true, classes: `${actionable?.classes(legal) || ''}${unavailable ? ' gostopCardUnavailable' : ''}` });
      el.disabled = !legal;
      if (card.shake || card.bomb || card.kong) el.classList.add('hasSpecial');
      el.addEventListener('click', () => {
        if (!legal) return;
        if (card.shake || card.bomb || card.kong) { pendingSpecial = { cardId: card.id, options: card }; render(lastState); return; }
        act('gostop-play', { cardId: card.id });
      });
      hand.append(el);
    }
    const button = (text, onClick, primary = false, parent = actions) => {
      const b = document.createElement('button');
      const locked = busy || Boolean(fxRun);
      b.type = 'button'; b.className = primary ? 'primary' : 'secondary';
      b.textContent = text; b.disabled = locked;
      if (actionable) actionable.set(b, !locked, primary ? 'primary' : 'target');
      b.addEventListener('click', onClick);
      parent.append(b);
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
      const preview = g.stopPreview;
      const panel = document.createElement('section');
      panel.className = 'gostopDecisionPanel';
      const head = document.createElement('div');
      head.className = 'gostopDecisionHead';
      const title = document.createElement('strong');
      title.textContent = `현재 ${preview?.score ?? now.scoreWithGo ?? now.score}점${now.goCount ? ` · ${now.goCount}고` : ''}`;
      const sub = document.createElement('small');
      sub.textContent = '지금 스톱 시 현재 기준 정산';
      head.append(title, sub);
      panel.append(head);

      if (preview?.losers?.length) {
        const rows = document.createElement('div');
        rows.className = 'gostopDecisionRows';
        for (const loser of preview.losers) {
          const row = document.createElement('div');
          const factors = orderedFactors(loser.factors).map(factorText).join(' · ');
          row.textContent = `${label(state, loser.seat)} · ${factors || '추가 배수 없음'} · ${fmt(loser.amount)}`;
          rows.append(row);
        }
        panel.append(rows);
      }
      const caution = document.createElement('small');
      caution.className = 'gostopDecisionCaution';
      caution.textContent = '고를 선택하면 이후 점수·배수는 다음 진행에 따라 달라질 수 있습니다.';
      panel.append(caution);
      const choices = document.createElement('div');
      choices.className = 'gostopDecisionButtons';
      const go = button('고 · 계속하기', () => act('gostop-decide', { choice: 'go' }), false, choices);
      go.classList.add('gostopGoButton');
      const stop = button('스톱 · 현재 정산', () => act('gostop-decide', { choice: 'stop' }), true, choices);
      stop.classList.add('gostopStopButton');
      panel.append(choices);
      actions.append(panel);
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
    box.classList.remove('staged');
    if (!r || !['finished', 'draw'].includes(g.status)) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    // v1.7.4: the first time this result is shown (and once it is settled), its lines appear in order.
    const stageKey = `${g.round}:${r.kind}:${g.settlement?.status || ''}`;
    if (stageKey !== stagedResultKey && g.settlement?.status === 'done') {
      const winSkin = r.kind === 'win' ? skinOf(state, r.winner) : null;
      if (winSkin?.win && stageKey !== winPlayed) requestAnimationFrame(() => SKN().h.playFx($('gostopPanel'), winSkin.win, 1800, 10));
      winPlayed = stageKey;
      stagedResultKey = stageKey;
      if (!reducedMotion()) box.classList.add('staged');
    }
    const title = document.createElement('strong');
    const settled = g.settlement?.status === 'done';
    const paidOf = (from, to) => g.settlement?.transfers?.find(item => item.fromSeat === from && item.toSeat === to);
    const balanceNote = (seat) => {
      const before = g.settlement?.balancesBefore?.[seat];
      const after = g.settlement?.balances?.[seat];
      return before === null || before === undefined || after === null || after === undefined ? '' : ` · 잔액 ${fmt(before)} → ${fmt(after)}`;
    };
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
        line.textContent = `${label(state, item.from)} → ${label(state, item.to)} ${fmt(paid ? paid.paid : item.amount)}${paid?.capped ? ` (보유 포인트 한도로 ${fmt(item.amount)} 중 지급)` : ''}`
          + (paid?.burned ? ` · 수령 ${fmt(paid.credited)} · ${fmt(paid.burned)} 소각` : '') + balanceNote(item.from);
        box.append(line);
      }
      if (!settled) { const wait = document.createElement('small'); wait.textContent = '포인트 정산 처리 중…'; box.append(wait); }
      return;
    }
    const reasonText = r.reason === 'chongtong' ? '총통' : r.reason === 'samppeok' ? '3뻑' : '스톱';
    title.textContent = `${label(state, r.winner)} 승리 · ${reasonText}`;
    box.append(title);

    const flow = document.createElement('div');
    flow.className = 'gostopCalc gostopSettlementFlow';
    const chip = (text, extra = '') => {
      const el = document.createElement('span');
      el.className = `gostopChip${extra}`;
      el.textContent = text;
      flow.append(el);
    };
    chip(r.instant ? `${reasonText} ${r.base}점 고정` : `기본 ${r.base}점`);
    if (r.items?.length && !r.instant) chip(r.items.map(item => `${ITEM_LABEL[item.key] || item.key} ${item.points}점`).join(' · '), ' muted');
    if (r.goCount) chip(`${r.goCount}고 +${r.goCount}점`);
    const commonFactors = orderedFactors(r.losers?.[0]?.factors).filter(item => !BAK_KEYS.has(item.key));
    for (const item of commonFactors) chip(factorText(item));
    chip(`점당 ${r.pointsPerScore}P`);
    box.append(flow);

    let total = 0;
    let credited = 0;
    let burned = 0;
    for (const loser of r.losers) {
      const line = document.createElement('p');
      line.className = 'gostopLoserLine';
      const factors = orderedFactors(loser.factors).map(factorText).join(' · ');
      const paid = paidOf(loser.seat, r.winner);
      const amount = paid ? paid.paid : loser.amount;
      total += amount;
      credited += paid ? (paid.credited ?? paid.paid) : amount;
      burned += paid?.burned || 0;
      line.textContent = `${label(state, loser.seat)} → -${fmt(amount)} · ${r.score}점${factors ? ` · ${factors}` : ''} × ${r.pointsPerScore}P = ${fmt(loser.amount)}`
        + (paid?.capped ? ` · 계산 ${fmt(loser.amount)} → 실제 ${fmt(paid.paid)} (보유 포인트 한도 적용)` : '')
        + balanceNote(loser.seat);
      box.append(line);
    }
    let stage = 0;
    for (const el of [...flow.children, ...box.querySelectorAll('.gostopLoserLine')]) el.style.setProperty('--stage', String(stage++));
    const win = document.createElement('p');
    win.className = 'gostopWinLine';
    win.style.setProperty('--stage', String(stage));
    // v1.7.3: the winner receives the real transfer minus the burned share (10%, rounded down).
    win.textContent = settled
      ? `${label(state, r.winner)} → +${fmt(credited)}${burned ? ` (이동 ${fmt(total)} 중 ${g.settlement.burnPercent || 10}% ${fmt(burned)} 소각)` : ''}${balanceNote(r.winner)}`
      : '포인트 정산 처리 중…';
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
    const seats = ['1', '2', '3'].filter(seat => state.players?.[seat]);
    const seated = seats.length;
    const lobbyPoints = g.lobbyPoints || {};
    const blocked = seats.some(seat => lobbyPoints[seat]?.eligible === false);
    const start = $('gostopStartBtn');
    start.classList.toggle('hidden', !host);
    start.disabled = busy || seated < 2 || blocked;
    start.textContent = seated === 3 ? '고스톱 시작 (3인)' : seated === 2 ? '맞고 시작 (2인)' : '2~3명 필요';
    window.GameActionable?.set(start, host && seated >= 2 && !blocked && !busy, 'primary');
    const mode = seated === 3 ? '고스톱' : seated === 2 ? '맞고' : '2명 맞고 · 3명 고스톱';
    $('gostopSetupNote').textContent = `${mode} · 점당 ${g.pointsPerScore}P${g.nagariStreak ? ` · 나가리 ×${g.nagariMultiplier} 이월` : ''} · 실제 손실은 보유 포인트 한도 내에서 정산`;
    const players = $('gostopSetupPlayers');
    players.replaceChildren();
    for (const seat of seats) {
      const point = lobbyPoints[seat];
      const row = document.createElement('div');
      row.className = `gostopSetupPlayer${point?.eligible === false ? ' blocked' : ''}`;
      const balance = point?.balance === null || point?.balance === undefined ? '보유 포인트 확인 중' : `보유 ${fmt(point.balance)}`;
      const eligibility = point?.eligible === false ? '참가 불가 · 0P' : point?.eligible === true ? '참가 가능' : '참가 여부 확인 중';
      row.textContent = `${seat}번 · ${label(state, seat)} · ${balance} · ${eligibility}`;
      players.append(row);
    }
  }

  function renderPointHistory() {
    const list = $('gostopPointHistoryList');
    if (!list) return;
    list.replaceChildren();
    const entries = pointAccount?.recentGostopSettlements || [];
    if (!pointAccount) {
      list.textContent = '포인트 정산 내역을 불러오는 중입니다.';
      return;
    }
    if (!entries.length) {
      list.textContent = '최근 고스톱·맞고 정산 내역이 없습니다.';
      return;
    }
    for (const entry of entries) {
      const row = document.createElement('div');
      row.className = `gostopPointHistoryRow ${entry.delta >= 0 ? 'gain' : 'loss'}`;
      const mode = entry.mode === 'matgo' ? '맞고' : entry.mode === 'gostop' ? '고스톱' : '고스톱·맞고';
      const sign = entry.delta > 0 ? '+' : '';
      const at = entry.at ? new Date(entry.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
      row.textContent = `${mode} · ${sign}${fmt(entry.delta)} · 잔액 ${fmt(entry.balanceAfter)}${at ? ` · ${at}` : ''}`;
      list.append(row);
    }
  }

  // v1.7.23: entering a room starts from a clean table. Nothing from the room the player just left may be compared
  // against, replayed or treated as already staged (the first snapshot of the new room is only a baseline).
  function reset() {
    cancelFx();
    lastState = null;
    seenEventKey = undefined;
    prevItems = null;
    animatedTurn = { key: null, count: 0 };
    stagedResultKey = null;
    viewedRound = null;
    elementsById = new Map();
    anchors = { backs: new Map(), piles: new Map(), stats: new Map(), deck: null };
  }

  function render(state) {
    const before = lastState?.gameType === 'gostop' && state?.gameType === 'gostop' && elementsById.size ? snapshot() : null;
    lastState = state;
    if (!state || state.gameType !== 'gostop') { cancelFx(); seenEventKey = undefined; prevItems = null; return; }
    // v1.8.5: the room theme dresses the table itself (the felt), which is now the main stage of the screen.
    SKN().h.unstyle($('gostopFelt'), panelApplied);
    panelApplied = null;
    const themeDef = SKN().def(state.skinTheme);
    if (themeDef?.panel) { panelApplied = { backgroundImage: SKN().h.img(`gs-panel:${state.skinTheme}`, 960, 640, themeDef.panel), backgroundSize: 'cover', ...themeDef.frame }; SKN().h.style($('gostopFelt'), panelApplied); }
    elementsById = new Map();
    anchors = { backs: new Map(), piles: new Map(), stats: new Map(), deck: null };
    const g = state.game;
    // seat count drives the table layout: 2 = 맞고 (one opponent on top), 3 = 고스톱 (two opponents, top-left and top-right)
    $('gostopFelt').classList.toggle('threeSeats', g.status !== 'selecting' && (g.seatOrder || []).length === 3);
    const seat = state.me?.seat || null;
    const modeText = g.status === 'selecting' ? '고스톱 · 맞고' : g.mode === 'matgo' ? '맞고' : '고스톱';
    $('gostopTitle').textContent = modeText;
    $('gostopMeta').textContent = g.status === 'selecting' ? '' : `점당 ${g.pointsPerScore}P${g.nagariStreak ? ` · 나가리 ×${g.nagariMultiplier}` : ''} · ${g.mode === 'matgo' ? '7점' : '3점'}부터 고/스톱`;
    $('gostopMyPoints').textContent = state.me?.pointBalance === null || state.me?.pointBalance === undefined ? '' : `내 포인트 ${fmt(state.me.pointBalance)}`;
    renderSetup(state);
    renderPointHistory();
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
    bringTableIntoView(g);
    afterRender(state, before);
  }

  // v1.8.5: when a hand starts (or this room is first shown mid-hand) the whole table is scrolled into view once,
  // so my hand is not below the fold. Later renders never move the page. The jump is instant and happens before the
  // card movement measures where cards are, so the animation never starts from a position the page scrolled away from.
  let viewedRound = null;
  function bringTableIntoView(g) {
    if (g.status !== 'playing' || viewedRound === g.round) return;
    viewedRound = g.round;
    const felt = $('gostopFelt');
    const r = felt.getBoundingClientRect();
    if (r.bottom > window.innerHeight || r.top < 0) felt.scrollIntoView({ block: r.height > window.innerHeight ? 'start' : 'end', behavior: 'auto' });
  }


  // ---- v1.6.88: cosmetic card movement --------------------------------------------------------
  // The server state is already final when it arrives; these sprites only replay the public moves
  // listed in lastEvent.steps (every card there is face up for everyone) from where the cards were in
  // the previous render to where they are now. Final elements stay hidden until their card lands.
  // One run at a time (generation id); a newer event cancels an older run and snaps it to the end.
  const FX = { move: 320, flip: 380, capture: 320, gap: 55, look: 130, glow: 200, impact: 170 };
  const BASE_W = 46; const BASE_H = 68;
  const SPECIAL_TAGS = ['jjok', 'ttadak', 'sweep', 'ppeok', 'jappeok', 'ppeokEat', 'bomb', 'kong', 'shake', 'bonus', 'firstPpeok', 'secondPpeok', 'chongtong', 'samppeok'];
  // v1.7.4: each special gets its own short look (colour, motion and a floor effect) so 뻑·자뻑·쪽·따닥·판쓸이·
  // 폭탄·콩알탄·흔들기·고·스톱 read differently at a glance. Kept under ~0.7s; nothing blocks input.
  const SPECIAL_FX = { ppeok: 'ppeok', jappeok: 'jappeok', ppeokEat: 'eat', jjok: 'jjok', ttadak: 'ttadak', sweep: 'sweep', bomb: 'bomb', kong: 'kong',
    shake: 'shake', bonus: 'bonus', firstPpeok: 'bonusPoint', secondPpeok: 'bonusPoint', chongtong: 'grand', samppeok: 'grand', go: 'go', stop: 'stop' };
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
  const fxMs = (run, ms, min = 90) => Math.max(min, Math.round(ms * (run?.pace || 1)));

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
    const pace = steps.length >= 7 ? 0.55 : steps.length >= 4 ? 0.72 : 1;
    const run = { key, gen: ++fxGen, sprites: new Map(), temps: new Set(), labels: new Set(), hidden: new Set(), cancelled: false, pace };
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
          await wait(fxMs(run, FX.gap, 24));
        }
        if (run.cancelled) return;
        const tags = (ev.tags || []).filter(tag => SPECIAL_TAGS.includes(tag) || tag === 'go' || tag === 'stop');
        const shown = tags.slice(0, 3).map((tag, i) => specialFx(run, tag, i, ev, state));
        if (ev.stolen?.length) badge(run, `피 뺏기 · ${ev.stolen.length}장`, ev.seat, 'steal', shown.length);
        pulseScores(run, oldItems, items);
        if ((ev.tags || []).includes('go')) pulse(anchors.stats.get(ev.seat));
        if (shown.length || ev.stolen?.length) await wait(fxMs(run, 360, 180));
      } finally {
        // A run that finished normally leaves its labels and table effects to fade out on their own;
        // only a newer event (cancelFx) clears them early.
        if (fxRun === run) { for (const el of run.labels) run.temps.delete(el); cancelFx(); if (lastState?.gameType === 'gostop') renderHand(lastState); }
      }
    })();
  }

  function log(run, k, id, from, to, seat) {
    fxLog.push({ run: run.gen, k, card: id, seat: seat || null, from: from && { x: Math.round(from.left), y: Math.round(from.top) }, to: to && { x: Math.round(to.left), y: Math.round(to.top) } });
    if (fxLog.length > 200) fxLog.splice(0, fxLog.length - 200);
  }

  // v1.7.4: a sprite is two layers -- the outer one only travels (translate/scale, as in v1.6.88), the
  // inner one carries the card's own motion: tilt, the 3D turn from back to face, and the landing hit.
  function spriteFor(run, id, at, { back = false } = {}) {
    let el = run.sprites.get(id);
    if (el) return el;
    el = document.createElement('div');
    el.className = 'gostopSprite';
    const inner = document.createElement('div');
    inner.className = `fxInner${back ? ' isBack' : ''}`;
    const front = cardEl(id, { size: 'normal', classes: ' fxFace fxFront' });
    const rear = backEl('normal', deckSkin(lastState));
    rear.classList.add('fxFace', 'fxRear');
    inner.append(front, rear);
    el.append(inner);
    el._inner = inner;
    el._at = at;
    el.style.transform = tf(at);
    layer().append(el);
    run.sprites.set(id, el);
    return el;
  }

  // Travel along a slight arc (lift at the middle) instead of a straight slide.
  function move(el, to, ms, { flipAt = null, arc = 0.18, tilt = 0 } = {}) {
    const from = el._at;
    el._at = to;
    el.style.transform = tf(to);
    if (flipAt !== null) turnOver(el, ms);
    if (!from) return Promise.resolve();
    const lift = Math.min(46, Math.hypot(to.left - from.left, to.top - from.top) * arc);
    const mid = { left: (from.left + to.left) / 2, top: (from.top + to.top) / 2 - lift, width: (from.width + to.width) / 2 * 1.06, height: (from.height + to.height) / 2 * 1.06 };
    if (tilt && flipAt === null) el._inner?.animate([{ transform: `${turned(el)} rotate(0deg)` }, { transform: `${turned(el)} rotate(${tilt}deg)`, offset: 0.55 }, { transform: `${turned(el)} rotate(0deg)` }], { duration: ms, easing: 'ease-out' });
    return el.animate([{ transform: tf(from) }, { transform: tf(mid), offset: 0.5 }, { transform: tf(to) }], { duration: ms, easing: 'cubic-bezier(.25,.75,.2,1)' }).finished.catch(() => {});
  }

  const turned = el => (el._inner?.classList.contains('isBack') ? 'rotateY(180deg)' : 'rotateY(0deg)');
  // 산패·상대 패 뒤집기: a real 3D half turn from the back face to the front face.
  function turnOver(el, ms) {
    const inner = el._inner;
    if (!inner || !inner.classList.contains('isBack')) return Promise.resolve();
    inner.classList.remove('isBack');
    if (fxRun) log(fxRun, 'turn', null, null, el._at);
    return inner.animate([
      { transform: 'rotateY(180deg) scale(1)' },
      { transform: 'rotateY(90deg) scale(1.16)', offset: 0.5 },
      { transform: 'rotateY(0deg) scale(1)' },
    ], { duration: Math.max(160, ms), easing: 'cubic-bezier(.3,.6,.3,1)' }).finished.catch(() => {});
  }

  // 탁: the landing card dips and the card it lands on jolts, with a short ring on the floor.
  function impact(run, el, partner = null) {
    el?._inner?.animate([{ transform: 'scale(1.12) rotate(-3deg)' }, { transform: 'scale(.96) rotate(1deg)', offset: 0.55 }, { transform: 'scale(1) rotate(0deg)' }],
      { duration: fxMs(run, FX.impact, 90), easing: 'ease-out' });
    partner?._inner?.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(2px,1px) rotate(2deg)', offset: 0.4 }, { transform: 'translate(0,0)' }],
      { duration: fxMs(run, FX.impact, 90) });
    const at = el?._at;
    if (!at) return;
    const throwSkin = skinOf(lastState, lastState?.game?.lastEvent?.seat);
    if (throwSkin?.fx) SKN().h.playFx(el, throwSkin.fx, 600, 40);
    log(run, 'impact', null, null, at);
    const ring = document.createElement('div');
    ring.className = 'fxRing';
    ring.style.left = `${at.left + at.width / 2}px`;
    ring.style.top = `${at.top + at.height / 2}px`;
    layer().append(ring);
    run.temps.add(ring);
    ring.animate([{ opacity: 0.85, transform: 'translate(-50%,-50%) scale(.4)' }, { opacity: 0, transform: 'translate(-50%,-50%) scale(1.6)' }], { duration: fxMs(run, 360, 160), easing: 'ease-out', fill: 'forwards' })
      .finished.then(() => ring.remove(), () => {});
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
        return move(el, { ...start, left: start.left + (step.seat === me ? 0 : i * 26), top: start.top - 22 }, fxMs(run, 240))
          .then(() => el._inner?.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(-9deg)' }, { transform: 'rotate(8deg)' }, { transform: 'rotate(-5deg)' }, { transform: 'rotate(0)' }], { duration: fxMs(run, 320, 160) }).finished.catch(() => {}));
      });
      await Promise.all(moves);
      await wait(fxMs(run, 360, 180));
      for (const id of step.cards) {
        if (next?.k === 'play' && next.cards.includes(id)) continue; // the played one keeps going
        const el = run.sprites.get(id);
        if (!el) continue;
        run.sprites.delete(id);
        run.temps.add(el);
        el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: fxMs(run, 180), fill: 'forwards' }).finished.then(() => el.remove(), () => {});
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
        // 손패를 탁 내기: a quick lift and tilt, then it snaps down onto its partner (or the floor).
        return move(el, target, fxMs(run, FX.move), { flipAt: hidden ? 0.45 : null, arc: 0.26, tilt: i % 2 ? 7 : -7 })
          .then(() => impact(run, el, partner ? run.sprites.get(partner) : null));
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
      // 산패 뒤집기: the top card lifts off the pile and turns over in 3D, then travels to its place.
      const lifted = { ...start, left: start.left + 6, top: start.top - 14 };
      await Promise.all([move(el, lifted, fxMs(run, FX.flip * 0.55, 110), { arc: 0 }), turnOver(el, fxMs(run, FX.flip * 0.55, 110))]);
      await wait(fxMs(run, FX.look, 70)); // let the month be read before anything else moves
      await move(el, target, fxMs(run, FX.flip * 0.6, 120), { arc: 0.2 });
      if (partner) impact(run, el, run.sprites.get(partner));
      return;
    }
    if (step.k === 'place') {
      await Promise.all(step.cards.map(async (id) => {
        const el = run.sprites.get(id);
        const target = finalRect(id);
        if (el && target) { log(run, 'place', id, el._at, target); await move(el, target, fxMs(run, 180)); }
        land(run, id);
      }));
      return;
    }
    if (step.k === 'match') {
      // Floor cards taking part get a sprite where they lay, then everything in the match glows together.
      for (const id of step.cards) if (!run.sprites.has(id) && before.cards.get(id)) spriteFor(run, id, before.cards.get(id));
      for (const id of step.cards) run.sprites.get(id)?.classList.add('fxGlow');
      log(run, 'match', step.cards.join(','), null, null);
      // 같은 월끼리 붙기: the pair tightens into one stack for a moment before it is taken.
      const anchor = run.sprites.get(step.cards[0])?._at;
      await Promise.all(step.cards.slice(1).map((id, i) => {
        const el = run.sprites.get(id);
        return anchor && el ? move(el, { ...anchor, left: anchor.left + 5 + i * 4, top: anchor.top + 2 }, fxMs(run, 130, 70), { arc: 0 }) : null;
      }));
      await wait(fxMs(run, FX.glow, 100));
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
        return move(el, target, fxMs(run, 240));
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
        await wait(Math.min(90, Math.round(i * 22 * run.pace)));
        log(run, step.k, id, start, target, seat);
        // 획득패 쓸어오기: a swept arc with a little spin; 피 뺏기 flies across with a bigger turn.
        el.classList.add(step.k === 'steal' ? 'fxSteal' : 'fxSweep');
        await move(el, target, fxMs(run, step.k === 'steal' ? FX.move : FX.capture), { arc: step.k === 'steal' ? 0.32 : 0.14, tilt: step.k === 'steal' ? 18 : (i % 2 ? 9 : -9) });
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

  // Entry motion of each special's label: a stamp, a pop, a shake, a double tap...
  const BADGE_IN = {
    ppeok: [{ transform: 'translate(-50%,0) scale(1.6) rotate(-8deg)', opacity: 0 }, { transform: 'translate(-50%,0) scale(.92) rotate(3deg)', opacity: 1, offset: 0.6 }, { transform: 'translate(-50%,0) scale(1) rotate(0)', opacity: 1 }],
    jappeok: [{ transform: 'translate(-50%,-18px) scale(.8)', opacity: 0 }, { transform: 'translate(-50%,4px) scale(1.08)', opacity: 1, offset: 0.6 }, { transform: 'translate(-50%,0) scale(1)', opacity: 1 }],
    jjok: [{ transform: 'translate(-50%,0) scale(.3)', opacity: 0 }, { transform: 'translate(-50%,0) scale(1.25)', opacity: 1, offset: 0.5 }, { transform: 'translate(-50%,0) scale(1)', opacity: 1 }],
    ttadak: [{ transform: 'translate(-50%,0) scale(.6)', opacity: 0 }, { transform: 'translate(-50%,0) scale(1.15)', opacity: 1, offset: 0.3 }, { transform: 'translate(-50%,0) scale(.95)', opacity: 1, offset: 0.5 }, { transform: 'translate(-50%,0) scale(1.15)', opacity: 1, offset: 0.7 }, { transform: 'translate(-50%,0) scale(1)', opacity: 1 }],
    sweep: [{ transform: 'translate(-160%,0) skewX(-18deg)', opacity: 0 }, { transform: 'translate(-40%,0) skewX(-6deg)', opacity: 1, offset: 0.7 }, { transform: 'translate(-50%,0) skewX(0)', opacity: 1 }],
    bomb: [{ transform: 'translate(-50%,0) scale(.2)', opacity: 0 }, { transform: 'translate(-50%,0) scale(1.45)', opacity: 1, offset: 0.45 }, { transform: 'translate(-50%,0) scale(1)', opacity: 1 }],
    kong: [{ transform: 'translate(-50%,6px) scale(.5)', opacity: 0 }, { transform: 'translate(-50%,-4px) scale(1.12)', opacity: 1, offset: 0.55 }, { transform: 'translate(-50%,0) scale(1)', opacity: 1 }],
    shake: [{ transform: 'translate(-50%,0) rotate(0)', opacity: 0 }, { transform: 'translate(-50%,0) rotate(-7deg)', opacity: 1, offset: 0.25 }, { transform: 'translate(-50%,0) rotate(7deg)', opacity: 1, offset: 0.5 }, { transform: 'translate(-50%,0) rotate(-4deg)', opacity: 1, offset: 0.75 }, { transform: 'translate(-50%,0) rotate(0)', opacity: 1 }],
    go: [{ transform: 'translate(-50%,10px) scale(.7)', opacity: 0 }, { transform: 'translate(-50%,-6px) scale(1.2)', opacity: 1, offset: 0.5 }, { transform: 'translate(-50%,0) scale(1)', opacity: 1 }],
    stop: [{ transform: 'translate(-50%,0) scale(1.8) rotate(10deg)', opacity: 0 }, { transform: 'translate(-50%,0) scale(1) rotate(-4deg)', opacity: 1 }],
    grand: [{ transform: 'translate(-50%,0) scale(.4) rotate(-14deg)', opacity: 0 }, { transform: 'translate(-50%,0) scale(1.3) rotate(4deg)', opacity: 1, offset: 0.6 }, { transform: 'translate(-50%,0) scale(1) rotate(0)', opacity: 1 }],
  };
  function badge(run, text, seat, kind = 'plain', row = 0) {
    const anchor = plain(rectOf($('gostopFloor')));
    if (!anchor) return;
    const el = document.createElement('div');
    el.className = `fxBadge fx-${kind}`;
    el.textContent = text;
    el.style.left = `${anchor.left + anchor.width / 2}px`;
    el.style.top = `${anchor.top + 8 + row * 34}px`;
    layer().append(el);
    run.temps.add(el);
    run.labels.add(el);
    el.animate(BADGE_IN[kind] || [{ opacity: 0, transform: 'translate(-50%, 6px) scale(.9)' }, { opacity: 1, transform: 'translate(-50%, 0) scale(1)' }], { duration: kind === 'ttadak' || kind === 'shake' ? 420 : 260, easing: 'ease-out', fill: 'forwards' });
    setTimeout(() => el.remove(), 1150);
  }

  // A short effect on the table itself for the specials that change the table.
  function floorFx(run, kind) {
    const floor = $('gostopFloor');
    const r = plain(rectOf(floor));
    if (!r) return;
    const el = document.createElement('div');
    el.className = `fxFloor fxFloor-${kind}`;
    Object.assign(el.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    layer().append(el);
    run.temps.add(el);
    run.labels.add(el);
    const ms = kind === 'sweep' ? 520 : kind === 'bomb' ? 480 : 360;
    if (kind === 'sweep') el.style.width = `${Math.round(r.width * 0.28)}px`; // one solid bar wiping across the table
    el.animate(kind === 'sweep'
      ? [{ transform: `translateX(${-r.width * 0.3}px) skewX(-16deg)`, opacity: 0.2 }, { transform: `translateX(${r.width * 0.85}px) skewX(-16deg)`, opacity: 0.9, offset: 0.8 }, { transform: `translateX(${r.width}px) skewX(-16deg)`, opacity: 0 }]
      : [{ opacity: 0.95, transform: 'scale(.85)' }, { opacity: 0, transform: 'scale(1.08)' }], { duration: ms, easing: 'ease-out', fill: 'forwards' })
      .finished.then(() => el.remove(), () => {});
    if (kind === 'bomb' || kind === 'ppeok') {
      floor.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(-4px,2px)' }, { transform: 'translate(4px,-2px)' }, { transform: 'translate(-2px,1px)' }, { transform: 'translate(0,0)' }], { duration: kind === 'bomb' ? 300 : 220 });
    }
  }

  function specialFx(run, tag, row, ev, state) {
    const kind = SPECIAL_FX[tag] || 'plain';
    const goCount = tag === 'go' ? state.game.seats?.[ev.seat]?.goCount : null;
    badge(run, tag === 'go' && goCount ? `${goCount}고!` : TAGS[tag] || tag, ev.seat, kind, row);
    const floor = ['ppeok', 'sweep', 'bomb', 'kong', 'jjok', 'ttadak', 'grand'].includes(kind) ? (kind === 'grand' ? 'bomb' : kind) : null;
    if (floor) floorFx(run, floor);
    const specialSkin = skinOf(state, ev.seat);
    if (specialSkin?.special) SKN().h.playFx($('gostopFloor'), specialSkin.special, 700, 20);
    fxLog.push({ run: run.gen, k: 'special', card: tag, fx: kind, floor, seat: ev.seat || null });
    return kind;
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

  function setPointAccount(account) {
    pointAccount = account || null;
    if (lastState?.gameType === 'gostop') renderPointHistory();
  }

  function init(roomAction) {
    submit = roomAction;
    $('gostopStakeSelect').addEventListener('change', event => act('set-gostop-stake', { pointsPerScore: Number(event.target.value) }));
    $('gostopStartBtn').addEventListener('click', () => act('start-gostop', {}));
  }

  // fxLog/fxBusy: read-only hooks for browser tests (public card ids and screen positions only).
  window.GostopUI = { init, render, reset, setPointAccount, cardInfo: info, fxLog, fxBusy: () => Boolean(fxRun) };
})();
