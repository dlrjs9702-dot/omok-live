'use strict';
// 메신저 단독 창 (gamecenter-notes docs/messenger-standalone-20261025.md B안): the messenger as its own page -- open beside
// the game or without it, installed as its own app window, a notice on the device when it is shut. The rooms, 1:1, pins,
// mutes, unsend and read counts are v1.10.78·87·88·90's (moved here from 내 계정's window); what is new: the login kept on
// this device (a messenger-only token, 60 days), Web Push, install, and the wait while the free server wakes up.
(() => {
  const byId = (id) => document.getElementById(id);
  const toast = byId('toast'); let toastTimer = 0;
  const showToast = (message, ms = 2800) => { toast.textContent = message; toast.classList.remove('hidden'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.add('hidden'), ms); };
  // the tokens: this tab's account login (sessionStorage -- the game's window hands its own over when it opens this one)
  // or this device's kept login (localStorage)
  const keep = (store, key) => ({ get: () => { try { return store.getItem(key) || ''; } catch { return ''; } }, set: (v) => { try { if (v) store.setItem(key, v); else store.removeItem(key); } catch {} } });
  const accountToken = keep(sessionStorage, 'gc.account'); const deviceToken = keep(localStorage, 'gc.messengerDevice');
  const headers = () => ({ ...(accountToken.get() ? { 'X-Account-Token': accountToken.get() } : {}), ...(deviceToken.get() ? { 'X-Messenger-Device': deviceToken.get() } : {}) });
  // the free server sleeps after 15 quiet minutes: a call slower than 2.5 s says it is waking
  const wake = byId('mWake'); let waiting = 0;
  async function api(path, body, method = body === undefined ? 'GET' : 'POST') {
    waiting += 1; const slow = setTimeout(() => wake.classList.remove('hidden'), 2500);
    try {
      const res = await fetch(path, { method, cache: 'no-store', headers: { ...headers(), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
      let data = {}; try { data = await res.json(); } catch {}
      if (!res.ok) throw Object.assign(new Error(data.message || '요청을 처리하지 못했습니다.'), { status: res.status, code: data.error });
      return data;
    } finally { clearTimeout(slow); waiting -= 1; if (!waiting) wake.classList.add('hidden'); }
  }

  const app = byId('mApp'); const loginForm = byId('mLogin'); const list = byId('messengerRoomList'); const box = byId('messengerMessages'); const pick = byId('messengerPick');
  let state = { rooms: [], people: [], me: '' }; let current = null; let last = 0; let msgs = []; let readsKey = ''; let picking = null; let timers = [];
  // (Codex 검토 2차 #4) a login's generation: on the login screen the last one's rooms and lines are gone, and an answer
  // to its requests coming late is dropped -- on a shared PC the next person sees nothing of them
  let gen = 0;
  function showLogin(message = '') {
    for (const t of timers) clearInterval(t); timers = []; wantStream(false);
    gen += 1; state = { rooms: [], people: [], me: '' }; current = null; last = 0; msgs = []; readsKey = '';
    box.replaceChildren(); list.replaceChildren(); app.classList.remove('inRoom', 'picking'); pick.classList.add('hidden'); baseTitle = '아일랜드 메신저'; blink.seen(); document.title = baseTitle;
    app.classList.add('hidden'); loginForm.classList.remove('hidden'); byId('mLoginStatus').textContent = message;
    for (const id of ['mLogoutBtn', 'mDevicesBtn', 'mPushBtn', 'mDevices']) byId(id).classList.add('hidden');
  }
  const fail = (err) => { if (err.status === 401) { accountToken.set(''); deviceToken.set(''); showLogin('다시 로그인해 주세요.'); } else if (err.status === 403) showLogin(err.message); else showToast(err.message, 4000); };
  const when = (at) => { const d = new Date(at); return d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }); };
  // v1.10.190: the app icon's count and the title blinking while away (public/messenger-alert.js, as the game window's)
  const { unreadOf } = window.MessengerAlert; let baseTitle = '아일랜드 메신저';
  const blink = window.MessengerAlert.titleBlink(() => { document.title = blink.text(baseTitle); });
  const away = () => document.visibilityState === 'hidden' || !document.hasFocus();
  // (메신저 6절, v1.10.212 사용자 「최소화 해 놓아도 읽은걸로 처리되고 있는데」) back to the window: the open room asked once as
  // looking -- read then, the unread counts with it
  const looking = () => { if (away()) return; blink.seen(); if (current) pull().then(() => refresh()); };
  document.addEventListener('visibilitychange', looking); window.addEventListener('focus', looking);
  function renderRooms() {
    list.replaceChildren(...state.rooms.map((room) => {
      const li = document.createElement('li'); const b = document.createElement('button'); b.type = 'button'; b.className = 'ghost';
      const main = document.createElement('span'); main.className = 'messengerRoomMain';
      const name = document.createElement('strong'); name.textContent = `${room.pinned ? '📌 ' : ''}${room.kind === 'dm' ? room.name : `${room.name} (${room.members.length})`}`;
      const preview = document.createElement('span'); preview.className = 'messengerPreview'; preview.textContent = room.last ? room.last.text : '';
      main.append(name, preview);
      const side = document.createElement('span'); side.className = 'messengerRoomSide';
      const time = document.createElement('time'); time.textContent = room.last ? when(room.last.at) : ''; side.append(time);
      if (room.muted) { const m = document.createElement('span'); m.textContent = '🔕'; m.title = '알림 꺼짐'; side.append(m); }
      if (room.unread > 0 && room.id !== current?.id) { const n = document.createElement('span'); n.className = 'messengerUnread'; n.textContent = room.unread > 99 ? '99+' : room.unread; side.append(n); }
      b.append(main, side);
      b.setAttribute('aria-current', String(room.id === current?.id)); b.addEventListener('click', () => openRoom(room)); li.append(b); return li;
    }));
    if (!state.rooms.length) list.innerHTML = '<li class="smallMuted">아직 대화방이 없습니다.</li>';
    const unread = unreadOf(state.rooms); baseTitle = unread ? `(${unread > 99 ? '99+' : unread}) 아일랜드 메신저` : '아일랜드 메신저';
    document.title = blink.text(baseTitle); blink.update(unread, away());
    window.MessengerAlert.setBadge(navigator, unread);
  }
  async function refresh() { const g = gen; try { const data = await api('/api/messenger'); if (g !== gen) return false; const before = state; state = data; renderRooms(); popNew(before.rooms, data.rooms); return true; } catch (err) { if (g === gen) fail(err); return false; } }
  // (메신저 3절 3) the window open but not looked at (minimised, another window in front): the notice the push would be --
  // same look, same tag (one notice a room), never for a muted room or my own line; the server pushes this device no more
  // while it is open here (3절 4)
  function popNew(was, now) {
    if (!pushOn || !pushReg || !streamUp || !away() || !was.length || Notification.permission !== 'granted') return; // (the stream down -- a few seconds reconnecting -- the server pushes this device: one notice, one sound)
    const seen = new Map(was.map((r) => [r.id, r.seq]));
    for (const r of now) {
      if (r.muted || !r.last || r.last.system || r.last.mine || !(r.seq > (seen.get(r.id) ?? r.seq))) continue;
      const title = r.kind === 'dm' ? r.last.label : r.name; const body = (r.kind === 'dm' ? r.last.text : `${r.last.label}: ${r.last.text}`).slice(0, 120);
      pushReg.showNotification(title, { body, tag: r.id, renotify: true, icon: '/icons/icon-192.png', badge: '/icons/badge-96.png', data: { room: r.id } }).catch(() => {});
    }
  }
  function line(msg, same) { // `same`: the same person just before -- the name once (카톡)
    if (msg.system) { const p = document.createElement('p'); p.className = 'messengerSystem'; p.textContent = msg.text; return p; }
    const item = document.createElement('div'); item.className = 'chatMessage' + (msg.from === state.me ? ' mine' : '') + (same ? ' same' : '');
    if (!same) { const head = document.createElement('div'); head.className = 'chatMessageHead'; const who = document.createElement('strong'); who.textContent = msg.label; head.append(who); item.append(head); }
    const row = document.createElement('div'); row.className = 'chatMessageBody'; const text = document.createElement('div'); text.className = 'chatMessageText' + (msg.deleted ? ' deleted' : ''); text.textContent = msg.deleted ? '삭제된 메시지입니다' : msg.text;
    const meta = document.createElement('span'); meta.className = 'messengerMeta';
    // 안 읽은 사람 수 (카톡의 「1」): the members (still let in) besides the sender whose last read is before this line
    const waitingFor = current.members.filter((m) => m.active && m.id !== msg.from && (current.reads[m.id] || 0) < msg.seq);
    if (waitingFor.length) {
      const n = document.createElement('button'); n.type = 'button'; n.className = 'messengerReadCount'; n.textContent = waitingFor.length;
      const who = waitingFor.map((m) => m.label).join(', '); n.title = `안 읽음: ${who}`; n.setAttribute('aria-label', `안 읽은 사람 ${waitingFor.length}명: ${who}`);
      n.addEventListener('click', () => showToast(`안 읽음: ${who}`, 4000)); // a phone has no hover
      meta.append(n);
    }
    const time = document.createElement('time'); time.textContent = new Date(msg.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }); meta.append(time);
    if (msg.from === state.me && !msg.deleted && canUnsend(msg)) bubbleMenuOn(text, msg); // mine, within 5 minutes, for everyone
    row.append(text, meta); item.append(row); return item;
  }
  // v1.10.190 말풍선 메뉴 (사용자: no 「삭제」 word under my line): a right click on the PC, a 0.5 s press on a phone (a
  // keyboard: the menu key on the focused line) opens a small menu by it -- 삭제, asked once; outside it or Esc closes it
  const canUnsend = (msg) => !msg.deleted && Date.now() - Date.parse(msg.at) < 5 * 60 * 1000;
  let bubbleMenu = null;
  const closeBubbleMenu = () => { bubbleMenu?.remove(); bubbleMenu = null; };
  document.addEventListener('pointerdown', (e) => { if (bubbleMenu && !bubbleMenu.contains(e.target)) closeBubbleMenu(); }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && bubbleMenu) closeBubbleMenu(); });
  function openBubbleMenu(bubble, msg, x, y) {
    closeBubbleMenu(); if (!canUnsend(msg)) return; const room = current; // (C5 Codex 4차 P3-6: the room it was opened in)
    const menu = document.createElement('div'); menu.className = 'messengerMoreMenu messengerBubbleMenu'; menu.setAttribute('role', 'menu');
    const del = document.createElement('button'); del.type = 'button'; del.className = 'messengerBubbleDelete'; del.setAttribute('role', 'menuitem'); del.textContent = '삭제';
    del.addEventListener('click', async () => {
      closeBubbleMenu(); if (!window.confirm('이 메시지를 모두에게서 삭제할까요?')) return;
      if (current !== room) return; try { await api(`/api/messenger/rooms/${room.id}/unsend`, { seq: msg.seq }); msg.text = ''; msg.deleted = true; render(); } catch (err) { fail(err); }
    });
    menu.append(del); app.append(menu); bubbleMenu = menu;
    if (!x && !y) { const r = bubble.getBoundingClientRect(); x = r.left; y = r.bottom; } // (the menu key: by the line)
    const w = menu.offsetWidth; const h = menu.offsetHeight;
    menu.style.left = `${Math.max(8, Math.min(x, innerWidth - w - 8))}px`; menu.style.top = `${Math.max(8, Math.min(y, innerHeight - h - 8))}px`;
    del.focus();
  }
  function bubbleMenuOn(bubble, msg) {
    bubble.classList.add('hasMenu'); bubble.tabIndex = 0; bubble.setAttribute('aria-haspopup', 'menu');
    bubble.addEventListener('contextmenu', (e) => { if (!canUnsend(msg)) return; e.preventDefault(); openBubbleMenu(bubble, msg, e.clientX, e.clientY); });
    let press = null; const cancel = () => { clearTimeout(press); press = null; };
    bubble.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') return; cancel(); const { clientX: x, clientY: y } = e; press = setTimeout(() => { press = null; openBubbleMenu(bubble, msg, x, y); }, 500); });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) bubble.addEventListener(ev, cancel);
  }
  function render() {
    const nodes = []; let prev = null; let prevDay = '';
    if (msgs.length && msgs[0].seq > 1) nodes.push(moreButton());
    for (const msg of msgs) {
      const day = new Date(msg.at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
      if (day !== prevDay) { const s = document.createElement('p'); s.className = 'messengerDay'; s.textContent = day; nodes.push(s); }
      nodes.push(line(msg, prev && !prev.system && prev.from === msg.from && day === prevDay));
      prev = msg; prevDay = day;
    }
    if (nodes.length) box.replaceChildren(...nodes); else box.innerHTML = '<p class="emptyState">첫 메시지를 보내 보세요.</p>';
  }
  function showHead() {
    byId('messengerRoomName').textContent = current.name; byId('messengerMembers').textContent = current.members.map((m) => m.label).join(' · ');
    const group = current.kind !== 'dm';
    byId('messengerInviteBtn').classList.toggle('hidden', !group); byId('messengerRenameBtn').classList.toggle('hidden', !group);
    byId('messengerMuteBtn').textContent = current.muted ? '알림 켜기' : '알림 끄기';
    byId('messengerPinBtn').textContent = current.pinned ? '고정 해제' : '고정';
  }
  async function pull() {
    if (!current) return; const id = current.id; const g = gen;
    // (Codex 검토 2차 #6) the lines of the last 6 minutes asked again: one unsent since (5 minutes at most) shows as deleted
    const recent = msgs.find((msg) => !msg.system && !msg.deleted && Date.now() - Date.parse(msg.at) < 6 * 60 * 1000);
    const from = recent ? Math.min(last, recent.seq - 1) : last;
    try {
      const peek = away() ? '&peek=1' : ''; // (메신저 6절: not looked at -- the lines only, not read; read when I am back)
      let data = await api(`/api/messenger/rooms/${id}/messages?after=${from}${peek}`);
      // (C3 ②: a busy room filled the page (100) with the asked-again lines -- the new ones asked for on their own)
      if (from < last && data.messages.length >= 100) { const more = await api(`/api/messenger/rooms/${id}/messages?after=${last}${peek}`); data = { ...more, messages: [...data.messages.filter((msg) => msg.seq <= last), ...more.messages] }; }
      if (current?.id !== id || g !== gen) return;
      const firstPage = !last; current = data.room; showHead();
      const fresh = data.messages.filter((msg) => msg.seq > last);
      let gone = false; for (const msg of data.messages) { const had = msg.deleted && msgs.find((x) => x.seq === msg.seq && !x.deleted); if (had) { had.text = ''; had.deleted = true; gone = true; } }
      const key = JSON.stringify([current.reads, current.members]);
      if (!firstPage && !fresh.length && !gone && key === readsKey) return;
      const atEnd = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
      msgs.push(...fresh); if (fresh.length) last = fresh.at(-1).seq; readsKey = key;
      render();
      if (firstPage || (fresh.length && (atEnd || fresh.at(-1).from === state.me))) box.scrollTop = box.scrollHeight;
    } catch (err) { if (g !== gen) return; if (err.status === 404) { current = null; app.classList.remove('inRoom'); refresh(); } else fail(err); }
  }
  function moreButton() { // 100 at a time from the top, the view held where it was
    const b = document.createElement('button'); b.type = 'button'; b.className = 'ghost tiny messengerMore'; b.textContent = '이전 대화 더 보기';
    b.addEventListener('click', async () => {
      const id = current?.id; if (!id) return; b.disabled = true;
      try {
        const data = await api(`/api/messenger/rooms/${id}/messages?before=${msgs[0].seq}`);
        if (current?.id !== id) return;
        const height = box.scrollHeight;
        msgs.unshift(...data.messages.filter((msg) => msg.seq < msgs[0].seq)); render();
        box.scrollTop += box.scrollHeight - height;
      } catch (err) { b.disabled = false; fail(err); }
    });
    return b;
  }
  // a held stream (fetch: the token goes in a header); a room's change pulls it at once, a dropped stream comes back
  let streamUp = false; let streamCtl = null; let streamWanted = false;
  async function openStream() {
    if (!streamWanted || streamCtl) return; streamCtl = new AbortController();
    try {
      const res = await fetch('/api/messenger/stream', { headers: headers(), signal: streamCtl.signal, cache: 'no-store' });
      if (!res.ok || !res.body) throw new Error(String(res.status));
      streamUp = true; const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true }); let cut;
        while ((cut = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, cut); buf = buf.slice(cut + 2);
          if (!/^event: msg$/m.test(chunk)) continue;
          let room = null; try { room = JSON.parse((chunk.match(/^data: (.*)$/m) || [])[1] || '{}').room; } catch {}
          if (current?.id === room) pull(); refresh();
        }
      }
    } catch {}
    streamUp = false; streamCtl = null;
    if (streamWanted) setTimeout(openStream, 5000);
  }
  function wantStream(on) { streamWanted = on; if (on) openStream(); else { streamCtl?.abort(); streamCtl = null; streamUp = false; } }
  function openRoom(room) { closeBubbleMenu(); current = room; last = 0; msgs = []; readsKey = ''; box.replaceChildren(); app.classList.add('inRoom'); showHead(); renderRooms(); pull(); byId('messengerInput').focus(); }
  function showPick(mode) { // 'new' | 'invite' | 'dm'
    picking = mode; const inRoom = new Set(mode === 'invite' ? current.members.map((m) => m.id) : []);
    byId('messengerPickTitle').textContent = mode === 'new' ? '새 대화방' : mode === 'dm' ? '1:1 대화' : `「${current.name}」에 초대`;
    byId('messengerPickName').classList.toggle('hidden', mode !== 'new'); byId('messengerPickName').value = '';
    const people = state.people.filter((p) => !inRoom.has(p.id));
    byId('messengerPeople').replaceChildren(...people.map((p) => { const l = document.createElement('label'); const c = document.createElement('input'); c.type = mode === 'dm' ? 'radio' : 'checkbox'; c.name = 'messengerPerson'; c.value = p.id; l.append(c, p.label); return l; }));
    if (!people.length) byId('messengerPeople').innerHTML = '<p class="smallMuted">함께할 수 있는 사람이 없습니다. 메신저는 관리자가 허용한 계정끼리 씁니다.</p>';
    app.classList.add('picking'); pick.classList.remove('hidden');
  }
  function hidePick() { picking = null; app.classList.remove('picking'); pick.classList.add('hidden'); }
  pick.addEventListener('submit', async (event) => {
    event.preventDefault();
    const members = [...byId('messengerPeople').querySelectorAll('input:checked')].map((c) => c.value);
    try {
      if (picking === 'new') { const data = await api('/api/messenger/rooms', { name: byId('messengerPickName').value, members }); hidePick(); await refresh(); openRoom(data.room); }
      else if (picking === 'dm') { const data = await api('/api/messenger/dm', { with: members[0] }); hidePick(); await refresh(); openRoom(data.room); }
      else { await api(`/api/messenger/rooms/${current.id}/members`, { members }); hidePick(); pull(); refresh(); }
    } catch (err) { fail(err); }
  });
  byId('messengerPickCancel').addEventListener('click', hidePick);
  byId('messengerNewBtn').addEventListener('click', () => showPick('new'));
  byId('messengerDmBtn').addEventListener('click', () => showPick('dm'));
  byId('messengerInviteBtn').addEventListener('click', () => current && showPick('invite'));
  byId('messengerRenameBtn').addEventListener('click', async () => {
    const name = current && window.prompt('새 방 이름 (20자)', current.name); if (!name) return;
    try { await api(`/api/messenger/rooms/${current.id}/name`, { name }); pull(); refresh(); } catch (err) { fail(err); }
  });
  // (Codex 검토 2차 #5) a pin or mute answered after I moved to another room changes only the list, never the room I am in
  async function roomSwitch(what, on) {
    if (!current) return; const id = current.id; const g = gen;
    try { const { room } = await api(`/api/messenger/rooms/${id}/${what}`, { on }); if (g !== gen) return; if (current?.id === id) { current = room; showHead(); } refresh(); } catch (err) { if (g === gen) fail(err); }
  }
  // I8-3 (문제 기록 8회차 3: 「‹ 목록」 옆 「나가기」가 목록으로 가는 건지 헷갈려): the head is 「‹ 목록 · 방 이름 · ⋯」 -- 초대·이름·고정·
  // 알림·방 나가기 in the ⋯ menu; a choice, a click outside or Esc closes it
  const more = byId('messengerMoreBtn'); const moreMenu = byId('messengerMoreMenu');
  const showMore = (on) => { moreMenu.classList.toggle('hidden', !on); more.setAttribute('aria-expanded', String(on)); };
  more.addEventListener('click', (event) => { event.stopPropagation(); showMore(moreMenu.classList.contains('hidden')); });
  moreMenu.addEventListener('click', () => showMore(false));
  document.addEventListener('click', (event) => { if (!moreMenu.contains(event.target)) showMore(false); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') showMore(false); });
  byId('messengerPinBtn').addEventListener('click', () => roomSwitch('pin', !current?.pinned));
  byId('messengerMuteBtn').addEventListener('click', () => roomSwitch('mute', !current?.muted));
  byId('messengerBackBtn').addEventListener('click', () => { showMore(false); current = null; app.classList.remove('inRoom'); refresh(); });
  byId('messengerLeaveBtn').addEventListener('click', async () => { // 창 닫기 ≠ 나가기: only this button (with the warning) takes me out
    if (!current || !window.confirm(`「${current.name}」에서 나갈까요?\n나가면 대화 내용이 모두 사라지고 다시 초대받아야 들어올 수 있습니다.`)) return;
    try { await api(`/api/messenger/rooms/${current.id}/leave`, {}); current = null; app.classList.remove('inRoom'); box.replaceChildren(); refresh(); } catch (err) { fail(err); }
  });
  byId('messengerForm').addEventListener('submit', async (event) => {
    event.preventDefault(); const input = byId('messengerInput'); const text = input.value.trim(); if (!text || !current) return;
    try { await api(`/api/messenger/rooms/${current.id}/messages`, { text }); input.value = ''; pull(); } catch (err) { fail(err); }
  });

  // ---- 로그인 (④ 이 기기에서 로그인 유지) ----
  async function start() {
    if (!accountToken.get() && !deviceToken.get()) { showLogin(); return; }
    if (!await refresh()) return;
    loginForm.classList.add('hidden'); app.classList.remove('hidden'); byId('mLogoutBtn').classList.remove('hidden');
    byId('mDevicesBtn').classList.toggle('hidden', !deviceToken.get());
    wantStream(true); timers = [setInterval(() => { if (!streamUp) pull(); }, 3000), setInterval(() => refresh(), 30000)];
    const room = new URLSearchParams(location.search).get('room'); const r = room && state.rooms.find((x) => x.id === room); if (r) openRoom(r); // (a notice tapped)
    setupPush();
  }
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault(); byId('mLoginStatus').textContent = '';
    try {
      const data = await api('/api/account/login', { loginId: byId('mLoginId').value, password: byId('mLoginPw').value, keep: byId('mKeep').checked, device: deviceName() });
      byId('mLoginPw').value = '';
      if (!data.account.messenger) { byId('mLoginStatus').textContent = '메신저는 관리자가 허용한 계정만 쓸 수 있습니다.'; return; }
      accountToken.set(data.accountToken); deviceToken.set(data.deviceToken || '');
      start();
    } catch (err) { byId('mLoginStatus').textContent = err.message; }
  });
  const deviceName = () => { const ua = navigator.userAgent; const os = /Android/.test(ua) ? '안드로이드' : /iPhone|iPad/.test(ua) ? '아이폰' : /Windows/.test(ua) ? '윈도우' : /Mac OS/.test(ua) ? '맥' : '기기'; const b = /Edg\//.test(ua) ? '엣지' : /Chrome\//.test(ua) ? '크롬' : /Safari\//.test(ua) ? '사파리' : '브라우저'; return `${os} ${b}`; };
  byId('mLogoutBtn').addEventListener('click', async () => {
    await pushOff().catch(() => {});
    if (deviceToken.get()) await api('/api/messenger/devices/drop', { self: true }).catch(() => {});
    if (accountToken.get()) await api('/api/account/logout', {}).catch(() => {});
    accountToken.set(''); deviceToken.set(''); current = null; showLogin('로그아웃했습니다.');
  });
  byId('mDevicesBtn').addEventListener('click', async () => {
    const panel = byId('mDevices'); const open = panel.classList.toggle('hidden') === false; byId('mDevicesBtn').setAttribute('aria-expanded', String(open)); if (!open) return;
    try {
      const { devices } = await api('/api/messenger/devices');
      byId('mDeviceList').replaceChildren(...devices.map((d) => { const li = document.createElement('li'); li.textContent = `${d.name || '기기'} · ${new Date(d.at).toLocaleDateString('ko-KR')}${d.mine ? ' (이 기기)' : ''}`; if (!d.mine) { const b = document.createElement('button'); b.type = 'button'; b.className = 'ghost tiny'; b.textContent = '끊기'; b.addEventListener('click', async () => { await api('/api/messenger/devices/drop', { id: d.id }).catch(fail); li.remove(); }); li.append(' ', b); } return li; }));
    } catch (err) { fail(err); }
  });
  byId('mDropOthers').addEventListener('click', async () => { try { await api('/api/messenger/devices/drop', { all: true }); byId('mDevices').classList.add('hidden'); showToast('다른 기기의 로그인을 모두 끊었어요.'); } catch (err) { fail(err); } });

  // ---- ③ 알림 (Web Push, the app's worker) ----
  let pushReg = null; let pushOn = false;
  const keyBytes = (b64) => { const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64.length % 4)) % 4)); return Uint8Array.from(s, (c) => c.charCodeAt(0)); };
  async function setupPush() {
    const btn = byId('mPushBtn');
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !deviceToken.get()) return;
    try {
      // (메신저 3절 2) the app's own worker (sw.js, scope /) takes the push: an icon badge set by a worker reaches only the apps
      // inside its scope -- the old /messenger worker's never reached the island app's icon. Its subscription moves over.
      pushReg = await navigator.serviceWorker.register('/sw.js');
      const old = (await navigator.serviceWorker.getRegistrations()).find((r) => new URL(r.scope).pathname === '/messenger');
      let moved = null; if (old) { moved = await old.pushManager.getSubscription().catch(() => null); await moved?.unsubscribe().catch(() => {}); await old.unregister().catch(() => {}); }
      const { key, on } = await api('/api/messenger/push'); if (!key) return;
      pushOn = on && Notification.permission === 'granted';
      if (moved && pushOn) { await subscribe(key); }
      btn.dataset.key = key; btn.textContent = pushOn ? '알림 끄기' : '알림 켜기'; btn.classList.remove('hidden');
    } catch {}
  }
  async function pushOff() { const sub = await pushReg?.pushManager.getSubscription(); if (sub) await sub.unsubscribe(); await api('/api/messenger/push/off', {}); pushOn = false; }
  async function subscribe(key) {
    await navigator.serviceWorker.ready;
    const sub = (await pushReg.pushManager.getSubscription()) || await pushReg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
    const j = sub.toJSON(); await api('/api/messenger/push', { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }); pushOn = true;
  }
  byId('mPushBtn').addEventListener('click', async () => {
    const btn = byId('mPushBtn');
    try {
      if (btn.textContent === '알림 끄기') { await pushOff(); btn.textContent = '알림 켜기'; showToast('이 기기의 알림을 껐어요.'); return; }
      if (await Notification.requestPermission() !== 'granted') { showToast('브라우저에서 알림이 막혀 있어요. 사이트 설정에서 허용해 주세요.', 5000); return; }
      await subscribe(btn.dataset.key);
      btn.textContent = '알림 끄기'; showToast('창을 닫아도 새 메시지를 알려 드려요.');
    } catch (err) { showToast(err.message || '알림을 켜지 못했어요.', 4000); }
  });
  navigator.serviceWorker?.addEventListener('message', (event) => { const r = state.rooms.find((x) => x.id === event.data?.room); if (r) openRoom(r); }); // (a notice tapped while open)
  { const sel = byId('mTheme'); sel.value = window.MessengerTheme?.get() || 'light'; sel.addEventListener('change', () => window.MessengerTheme?.set(sel.value)); } // (어두운 화면: messenger-theme.js)
  // (the game's window opens this one with its login: a new login there reaches an open messenger too)
  try { new BroadcastChannel('gc-messenger').addEventListener('message', (event) => { if (event.data?.account && !accountToken.get() && !deviceToken.get()) { accountToken.set(event.data.account); start(); } }); } catch {}
  start();
})();
