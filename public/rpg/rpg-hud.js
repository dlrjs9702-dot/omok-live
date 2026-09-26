// 잿빛 원정 HUD: HTML/CSS overlay over the 3D canvas. Built with textContent only (player names are
// user text). Mouse is used here only -- choices, stats, items, ready, class pick.

const STAT_NAMES = { str: '힘', agi: '민첩', int: '지능', vit: '체력', luk: '행운' };
const STAT_HINT = { str: '기본 공격·근접 피해', agi: '공격속도·치명타', int: '스킬 피해·쿨타임', vit: '최대 HP·방어', luk: '발동 확률·보상 등급' };
const RARITY_NAME = { common: '일반', uncommon: '고급', rare: '희귀', epic: '영웅', legendary: '전설' };
const KIND_ICON = { combat: '⚔', elite: '☠', treasure: '◆', boss: '♛' };
const SLOT_ORDER = ['q', 'w', 'e', 'r'];
const CLASS_DESC = {
  guardian: '근접 · 생존 · 군중제어. Space 검 베기, Q 방패 강타. 혼자서도 싸울 수 있는 전사.',
  hunter: '원거리 · 기동 · 다수 대응. Space 화살, Q 관통 사격. 거리를 벌리며 싸운다.',
  arcanist: '원거리 · 광역 · 상태이상. Space 마력탄, Q 화염구. 후반 스킬 빌드가 화려하다.',
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createHud(root, handlers) {
  root.replaceChildren();
  const top = el('div', 'rpgTop');
  const rooms = el('div', 'rpgRooms');
  const roomLabel = el('div', 'rpgRoomLabel');
  top.append(rooms, roomLabel);
  const boss = el('div', 'rpgBoss hidden');
  const bossName = el('strong'); const bossBar = el('div', 'rpgBar boss'); const bossFill = el('i'); bossBar.append(bossFill);
  const bossPhase = el('small');
  boss.append(bossName, bossBar, bossPhase);
  const party = el('div', 'rpgParty');
  const build = el('div', 'rpgBuild');
  const bottom = el('div', 'rpgBottom');
  const me = el('div', 'rpgMe');
  const hpBar = el('div', 'rpgBar hp'); const hpFill = el('i'); const shieldFill = el('b'); const hpText = el('span'); hpBar.append(hpFill, shieldFill, hpText);
  const xpBar = el('div', 'rpgBar xp'); const xpFill = el('i'); const xpText = el('span'); xpBar.append(xpFill, xpText);
  me.append(hpBar, xpBar);
  const skills = el('div', 'rpgSkills');
  bottom.append(me, skills);
  const center = el('div', 'rpgCenter hidden');
  const status = el('div', 'rpgStatus hidden');
  const floats = el('div', 'rpgFloats');
  const help = el('div', 'rpgHelp', '방향키 이동 · Space 공격 · Q/W/E/R 스킬 · Shift 대시 · 1 물약 · Tab 대상 · Esc 창 닫기');
  const notice = el('div', 'rpgNotice hidden');
  root.append(top, boss, party, build, bottom, center, status, floats, help, notice);

  let meta = null;
  let mySeat = null;
  let panelHidden = false;
  let slotEls = {};
  let partyEls = {};
  let lastMetaKey = null;

  function skillSlot(key, label, name) {
    const slot = el('div', `rpgSlot${name ? '' : ' empty'}`);
    const k = el('kbd', '', label);
    const n = el('span', '', name || '비어 있음');
    const cd = el('i', 'cd');
    const t = el('small', 'cdText');
    slot.append(k, n, cd, t);
    slot.title = name || '레벨업으로 스킬을 배울 수 있습니다';
    return { slot, cd, t };
  }

  function renderSkills(p) {
    skills.replaceChildren();
    slotEls = {};
    const add = (key, label, name) => { const s = skillSlot(key, label, name); slotEls[key] = s; skills.append(s.slot); };
    add('b', 'Space', p?.basic || '기본 공격');
    for (const key of SLOT_ORDER) add(key, key.toUpperCase(), p?.skills?.[key] ? `${p.skills[key].name}${p.skills[key].mods.length ? ` +${p.skills[key].mods.length}` : ''}` : null);
    add('d', 'Shift', '대시');
    add('po', '1', '회복 물약');
  }

  function renderBuild(p) {
    build.replaceChildren();
    if (!p) return;
    const title = el('strong', '', `Lv.${p.level} 빌드`);
    build.append(title);
    const stats = el('small', 'rpgStatsLine', Object.entries(STAT_NAMES).map(([k, n]) => `${n} ${p.stats[k]}`).join(' · '));
    build.append(stats);
    for (const item of p.items) { const row = el('div', `rpgItemRow rarity-${item.rarity}`, `${item.name}`); row.title = item.desc; build.append(row); }
    for (const key of SLOT_ORDER) {
      const s = p.skills[key];
      if (s?.mods.length) build.append(el('div', 'rpgModRow', `${s.name}: ${s.mods.join(', ')}`));
    }
    if (p.passives.length) build.append(el('div', 'rpgModRow', p.passives.map(x => `${x.name}${x.count > 1 ? ` ×${x.count}` : ''}`).join(' · ')));
  }

  function renderParty(state) {
    party.replaceChildren();
    partyEls = {};
    const g = state.game;
    for (const seat of g.seatOrder.length ? g.seatOrder : Object.keys(state.players || {}).filter(s => state.players[s])) {
      const info = g.players?.[seat];
      const cls = info?.cls || g.classes?.[seat];
      const row = el('div', `rpgMember seat-${seat}${seat === mySeat ? ' me' : ''}`);
      const name = el('strong', '', `${state.players?.[seat]?.label || `${seat}번`}`);
      const sub = el('small', '', `${cls ? g.classInfo[cls].name : '역할 미선택'}${info ? ` · Lv.${info.level}` : ''}${g.phase === 'intermission' && info ? (info.ready ? ' · 준비 완료' : ' · 선택 중') : ''}`);
      const bar = el('div', 'rpgBar mini'); const fill = el('i'); bar.append(fill);
      row.append(name, sub, bar);
      party.append(row);
      partyEls[seat] = { row, fill };
    }
  }

  function renderRooms(g) {
    rooms.replaceChildren();
    g.rooms.forEach((r, i) => {
      const dot = el('span', `rpgRoomDot kind-${r.kind}${i < g.roomIndex ? ' done' : ''}${i === g.roomIndex ? ' now' : ''}`, KIND_ICON[r.kind] || '•');
      dot.title = `${i + 1}. ${r.label}`;
      rooms.append(dot);
    });
    roomLabel.textContent = g.room ? `${g.region} ${g.roomIndex + 1}/${g.roomCount} · ${g.room.label} · ${g.room.layoutName}${g.room.kind !== 'treasure' && g.room.waves > 1 && g.phase === 'combat' ? ` · ${Math.max(1, g.room.wave + 1)}/${g.room.waves} 웨이브` : ''}${g.room.cleared ? ' · 클리어' : ''}` : g.region;
  }

  function card(title, desc, onClick, extraClass = '') {
    const button = el('button', `rpgCard${extraClass}`);
    button.type = 'button';
    button.append(el('strong', '', title), el('span', '', desc));
    button.addEventListener('click', onClick);
    return button;
  }

  function renderLobby(state) {
    const g = state.game;
    center.replaceChildren();
    center.classList.remove('hidden');
    const box = el('div', 'rpgPanel');
    box.append(el('h3', '', '잿빛 원정 · 역할 선택'));
    box.append(el('p', 'rpgHint', '1~4명이 자리에 앉아 역할을 고르면 방장이 시작합니다. 같은 역할을 여럿이 골라도 됩니다. 한 판이 끝나면 성장은 초기화됩니다.'));
    const seated = Object.keys(state.players || {}).filter(s => state.players[s]);
    if (mySeat) {
      const row = el('div', 'rpgCards');
      for (const [cls, info] of Object.entries(g.classInfo)) {
        row.append(card(info.name, CLASS_DESC[cls], () => handlers.onClass(cls), `${g.classes[mySeat] === cls ? ' selected' : ''} cls-${cls}`));
      }
      box.append(row);
    } else box.append(el('p', 'rpgHint', '관전 중입니다. 자리를 선택하면 역할을 고를 수 있습니다.'));
    const list = el('div', 'rpgSeatList');
    for (const seat of seated) list.append(el('span', `seat-${seat}`, `${state.players[seat].label} · ${g.classes[seat] ? g.classInfo[g.classes[seat]].name : '선택 중'}`));
    box.append(list);
    if (state.me?.isHost) {
      const ready = seated.length >= 1 && seated.every(s => g.classes[s]);
      const start = el('button', 'primary rpgStart', ready ? `원정 시작 (${seated.length}명)` : '모두 역할을 골라야 시작');
      start.type = 'button'; start.disabled = !ready;
      start.addEventListener('click', handlers.onStart);
      box.append(start);
    }
    center.append(box);
  }

  function renderIntermission(state) {
    const g = state.game;
    const p = g.players[mySeat];
    center.replaceChildren();
    if (!p) { center.classList.add('hidden'); return; }
    center.classList.toggle('hidden', panelHidden);
    const box = el('div', 'rpgPanel wide');
    const head = el('div', 'rpgPanelHead');
    head.append(el('h3', '', g.room.kind === 'treasure' ? '보물방 · 성장 정비' : '방 클리어 · 성장 정비'));
    if (g.intermissionLeft !== null) head.append(el('small', '', `${g.intermissionLeft}초 뒤 자동 진행`));
    const close = el('button', 'secondary', '닫기 (Esc)'); close.type = 'button'; close.addEventListener('click', () => { panelHidden = true; center.classList.add('hidden'); showReopen(); });
    head.append(close);
    box.append(head);
    if (p.choices) {
      box.append(el('h4', 'rpgLevelUp', `LEVEL UP! Lv.${p.level - p.pendingLevels + 1}${p.pendingLevels > 1 ? ` (남은 선택 ${p.pendingLevels})` : ''}`));
      const row = el('div', 'rpgCards');
      p.choices.forEach((option, i) => row.append(card(option.name, option.desc, () => handlers.onPick(i), ` type-${option.type}`)));
      box.append(row);
    }
    if (p.itemChoices) {
      box.append(el('h4', '', '아이템 선택'));
      const row = el('div', 'rpgCards');
      p.itemChoices.forEach((item, i) => row.append(card(`[${RARITY_NAME[item.rarity]}] ${item.name}`, `${{ weapon: '무기', armor: '방어구', trinket: '장신구' }[item.slot]} · ${item.desc}`, () => handlers.onItem(i), ` rarity-${item.rarity}`)));
      row.append(card('물약 받기', '아이템 대신 회복 물약 +1', () => handlers.onItem('skip'), ' skip'));
      box.append(row);
    }
    const stats = el('div', 'rpgStatsBox');
    stats.append(el('h4', '', `능력치 분배 · 남은 포인트 ${p.statPoints}`));
    for (const [key, name] of Object.entries(STAT_NAMES)) {
      const row = el('div', 'rpgStatRow');
      row.append(el('span', '', `${name} ${p.stats[key]}${p.alloc[key] ? ` (+${p.alloc[key]})` : ''}`), el('small', '', STAT_HINT[key]));
      const plus = el('button', 'secondary', '+'); plus.type = 'button'; plus.disabled = p.statPoints <= 0; plus.setAttribute('aria-label', `${name} 올리기`);
      plus.addEventListener('click', () => handlers.onStat(key));
      row.append(plus);
      stats.append(row);
    }
    const d = p.derived;
    stats.append(el('small', 'rpgDerived', `최대 HP ${d.maxHp} · 방어 ${d.armor} · 치명타 ${d.crit}% · 공격속도 ${d.attackSpeed}% · 기본 공격 ${d.basic}% · 스킬 ${d.skill}% · 쿨타임 감소 ${d.cdr}%`));
    box.append(stats);
    const ready = el('button', `primary rpgReady${p.ready ? ' on' : ''}`, p.ready ? '준비 완료 (취소하려면 클릭)' : (p.choices || p.itemChoices ? '선택을 먼저 마쳐 주세요' : '준비 완료 → 다음 방'));
    ready.type = 'button'; ready.disabled = Boolean(p.choices || p.itemChoices);
    ready.addEventListener('click', () => handlers.onReady(!p.ready));
    box.append(ready);
    center.append(box);
  }

  function showReopen() {
    status.replaceChildren();
    status.classList.remove('hidden');
    const open = el('button', 'primary', '성장 정비 열기');
    open.type = 'button';
    open.addEventListener('click', () => { panelHidden = false; status.classList.add('hidden'); if (meta) renderIntermission(meta); });
    status.append(open);
  }

  function renderResult(state) {
    const g = state.game;
    center.replaceChildren();
    center.classList.remove('hidden');
    const box = el('div', `rpgPanel ${g.result?.kind === 'clear' ? 'victory' : 'defeat'}`);
    box.append(el('h3', '', g.result?.kind === 'clear' ? '원정 성공 · 잿불 군주 격파!' : g.result?.reason === 'abandon' ? '원정 포기' : '원정 실패 · 파티 전멸'));
    box.append(el('p', '', `${g.result?.rooms || 0}/${g.roomCount}번째 방 · ${Math.floor((g.result?.time || 0) / 60)}분 ${(g.result?.time || 0) % 60}초`));
    const list = el('div', 'rpgSeatList');
    for (const seat of g.seatOrder) { const p = g.players[seat]; list.append(el('span', `seat-${seat}`, `${state.players?.[seat]?.label || seat} · ${g.classInfo[p.cls].name} Lv.${p.level} · 아이템 ${p.items.length}개`)); }
    box.append(list);
    box.append(el('p', 'rpgHint', '이번 원정의 레벨·능력치·스킬·장비는 초기화됩니다.'));
    const again = el('button', 'primary', '다시 원정 준비'); again.type = 'button'; again.addEventListener('click', handlers.onNextRound);
    box.append(again);
    center.append(box);
  }

  function setMeta(state) {
    meta = state;
    mySeat = state.me?.seat || null;
    const g = state.game;
    const p = mySeat ? g.players?.[mySeat] : null;
    const key = `${g.phase}:${g.metaVersion}:${mySeat}:${state.stateSeq}`;
    if (key === lastMetaKey) return;
    lastMetaKey = key;
    renderRooms(g);
    renderParty(state);
    renderSkills(p);
    renderBuild(p);
    bottom.classList.toggle('hidden', !p);
    if (g.phase !== 'intermission') { panelHidden = false; status.classList.add('hidden'); }
    if (g.status === 'selecting') renderLobby(state);
    else if (g.phase === 'intermission') { if (panelHidden) showReopen(); renderIntermission(state); }
    else if (g.status === 'finished') renderResult(state);
    else { center.replaceChildren(); center.classList.add('hidden'); }
  }

  function escape() {
    if (meta?.game.phase === 'intermission' && !panelHidden) { panelHidden = true; center.classList.add('hidden'); showReopen(); return true; }
    return false;
  }

  function setTick(snap) {
    const g = meta?.game;
    if (!g) return;
    for (const p of snap.p) {
      const pe = partyEls[p.s];
      if (pe) { pe.fill.style.width = `${Math.max(0, p.hp / p.mh) * 100}%`; pe.row.classList.toggle('down', p.st === 'down'); }
    }
    const mine = snap.p.find(p => p.s === mySeat);
    if (mine) {
      hpFill.style.width = `${Math.max(0, mine.hp / mine.mh) * 100}%`;
      shieldFill.style.width = `${Math.min(1, mine.sh / mine.mh) * 100}%`;
      hpText.textContent = `HP ${mine.hp}/${mine.mh}${mine.sh ? ` · 보호막 ${mine.sh}` : ''}`;
      xpFill.style.width = `${Math.min(1, mine.xp / mine.xn) * 100}%`;
      xpText.textContent = `Lv.${mine.lv} · 경험치 ${mine.xp}/${mine.xn}`;
      const info = g.players?.[mySeat];
      const cds = { b: mine.cd.b, q: mine.cd.q, w: mine.cd.w, e: mine.cd.e, r: mine.cd.r, d: mine.cd.d };
      const full = { b: 0.6, d: info?.dashCooldown || 1.1, ...Object.fromEntries(SLOT_ORDER.map(k => [k, info?.skills?.[k]?.cooldown || 1])) };
      for (const [key, left] of Object.entries(cds)) {
        const s = slotEls[key];
        if (!s) continue;
        const share = Math.min(1, left / full[key]);
        s.cd.style.height = `${share * 100}%`;
        s.t.textContent = left > 0.05 && key !== 'b' ? left.toFixed(1) : '';
        s.slot.classList.toggle('ready', left <= 0.05);
      }
      if (slotEls.po) { slotEls.po.t.textContent = `×${mine.po}`; slotEls.po.slot.classList.toggle('empty', mine.po <= 0); }
      status.classList.toggle('downed', mine.st === 'down');
      if (mine.st === 'down' && g.status === 'playing') {
        status.classList.remove('hidden');
        status.textContent = g.partySize === 1 ? (g.revivesLeft > 0 ? '쓰러짐 · 곧 되살아납니다 (솔로 부활 1회)' : '쓰러짐') : `쓰러짐 · 동료가 곁에 서 있으면 부활 ${Math.round(mine.rv * 100)}%`;
      } else if (status.classList.contains('downed') || status.textContent.startsWith('쓰러짐')) { status.textContent = ''; status.classList.add('hidden'); }
    }
    const bossMob = snap.m.find(m => m.bo);
    boss.classList.toggle('hidden', !bossMob);
    if (bossMob) {
      bossName.textContent = '잿불 군주 이그라';
      bossFill.style.width = `${Math.max(0, bossMob.hp / bossMob.mh) * 100}%`;
      const target = bossMob.tg ? (meta.players?.[bossMob.tg]?.label || `${bossMob.tg}번`) : '-';
      bossPhase.textContent = `${bossMob.ph ? `${bossMob.ph + 1}단계${bossMob.ph >= 2 ? ' · 격노' : ''}` : '1단계'} · 노리는 대상: ${target}${bossMob.st === 'w' ? ' · 공격 준비!' : ''}`;
    }
  }

  function float(x, y, text, className) {
    const node = el('span', `rpgFloat ${className}`, text);
    node.style.left = `${x}px`; node.style.top = `${y}px`;
    floats.append(node);
    setTimeout(() => node.remove(), 900);
    while (floats.childElementCount > 60) floats.firstElementChild.remove();
  }

  function banner(text, className = '') {
    notice.textContent = text;
    notice.className = `rpgNotice ${className}`;
    clearTimeout(notice._timer);
    notice._timer = setTimeout(() => notice.classList.add('hidden'), 1600);
  }

  function showError(text) { banner(text, 'warn'); }

  function dispose() { root.replaceChildren(); clearTimeout(notice._timer); }

  return { setMeta, setTick, float, banner, showError, escape, dispose };
}
