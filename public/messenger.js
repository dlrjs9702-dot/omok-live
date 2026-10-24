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
  function showLogin(message = '') {
    for (const t of timers) clearInterval(t); timers = []; wantStream(false);
    app.classList.add('hidden'); loginForm.classList.remove('hidden'); byId('mLoginStatus').textContent = message;
    for (const id of ['mLogoutBtn', 'mDevicesBtn', 'mPushBtn', 'mDevices']) byId(id).classList.add('hidden');
  }
  const fail = (err) => { if (err.status === 401) { accountToken.set(''); deviceToken.set(''); showLogin('다시 로그인해 주세요.'); } else if (err.status === 403) showLogin(err.message); else showToast(err.message, 4000); };
  const when = (at) => { const d = new Date(at); return d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }); };
  const unreadOf = (rooms) => rooms.reduce((n, r) => n + (r.muted ? 0 : r.unread), 0);
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
    const unread = unreadOf(state.rooms); document.title = unread ? `(${unread > 99 ? '99+' : unread}) 아일랜드 메신저` : '아일랜드 메신저';
    if (navigator.setAppBadge) (unread ? navigator.setAppBadge(unread) : navigator.clearAppBadge()).catch(() => {}); // (the app icon's count, where it can)
  }
  async function refresh() { try { state = await api('/api/messenger'); renderRooms(); return true; } catch (err) { fail(err); return false; } }
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
    if (msg.from === state.me && !msg.deleted && Date.now() - Date.parse(msg.at) < 5 * 60 * 1000) { // mine, within 5 minutes, for everyone
      const del = document.createElement('button'); del.type = 'button'; del.className = 'messengerUnsend'; del.textContent = '삭제'; del.setAttribute('aria-label', '이 메시지 삭제');
      del.addEventListener('click', async () => {
        if (!window.confirm('이 메시지를 모두에게서 삭제할까요?')) return;
        try { await api(`/api/messenger/rooms/${current.id}/unsend`, { seq: msg.seq }); msg.text = ''; msg.deleted = true; render(); } catch (err) { fail(err); }
      });
      meta.append(del);
    }
    row.append(text, meta); item.append(row); return item;
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
    if (!current) return; const id = current.id;
    try {
      const data = await api(`/api/messenger/rooms/${id}/messages?after=${last}`);
      if (current?.id !== id) return;
      const firstPage = !last; current = data.room; showHead();
      const fresh = data.messages.filter((msg) => msg.seq > last);
      const key = JSON.stringify([current.reads, current.members]);
      if (!firstPage && !fresh.length && key === readsKey) return;
      const atEnd = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
      msgs.push(...fresh); if (fresh.length) last = fresh.at(-1).seq; readsKey = key;
      render();
      if (firstPage || (fresh.length && (atEnd || fresh.at(-1).from === state.me))) box.scrollTop = box.scrollHeight;
    } catch (err) { if (err.status === 404) { current = null; app.classList.remove('inRoom'); refresh(); } else fail(err); }
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
  function openRoom(room) { current = room; last = 0; msgs = []; readsKey = ''; box.replaceChildren(); app.classList.add('inRoom'); showHead(); renderRooms(); pull(); byId('messengerInput').focus(); }
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
  byId('messengerPinBtn').addEventListener('click', async () => {
    if (!current) return;
    try { current = (await api(`/api/messenger/rooms/${current.id}/pin`, { on: !current.pinned })).room; showHead(); refresh(); } catch (err) { fail(err); }
  });
  byId('messengerMuteBtn').addEventListener('click', async () => {
    if (!current) return;
    try { current = (await api(`/api/messenger/rooms/${current.id}/mute`, { on: !current.muted })).room; showHead(); refresh(); } catch (err) { fail(err); }
  });
  byId('messengerBackBtn').addEventListener('click', () => { current = null; app.classList.remove('inRoom'); refresh(); });
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

  // ---- ③ 알림 (Web Push, this page's own worker) and ② 앱으로 설치 ----
  let pushReg = null;
  const keyBytes = (b64) => { const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64.length % 4)) % 4)); return Uint8Array.from(s, (c) => c.charCodeAt(0)); };
  async function setupPush() {
    const btn = byId('mPushBtn');
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !deviceToken.get()) return;
    try {
      pushReg = await navigator.serviceWorker.register('/messenger-sw.js', { scope: '/messenger' });
      const { key, on } = await api('/api/messenger/push'); if (!key) return;
      btn.dataset.key = key; btn.textContent = on && Notification.permission === 'granted' ? '알림 끄기' : '알림 켜기'; btn.classList.remove('hidden');
    } catch {}
  }
  async function pushOff() { const sub = await pushReg?.pushManager.getSubscription(); if (sub) await sub.unsubscribe(); await api('/api/messenger/push/off', {}); }
  byId('mPushBtn').addEventListener('click', async () => {
    const btn = byId('mPushBtn');
    try {
      if (btn.textContent === '알림 끄기') { await pushOff(); btn.textContent = '알림 켜기'; showToast('이 기기의 알림을 껐어요.'); return; }
      if (await Notification.requestPermission() !== 'granted') { showToast('브라우저에서 알림이 막혀 있어요. 사이트 설정에서 허용해 주세요.', 5000); return; }
      const sub = (await pushReg.pushManager.getSubscription()) || await pushReg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(btn.dataset.key) });
      const j = sub.toJSON(); await api('/api/messenger/push', { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth });
      btn.textContent = '알림 끄기'; showToast('창을 닫아도 새 메시지를 알려 드려요.');
    } catch (err) { showToast(err.message || '알림을 켜지 못했어요.', 4000); }
  });
  navigator.serviceWorker?.addEventListener('message', (event) => { const r = state.rooms.find((x) => x.id === event.data?.room); if (r) openRoom(r); }); // (a notice tapped while open)
  let installPrompt = null;
  window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); installPrompt = event; byId('mInstallBtn').classList.remove('hidden'); });
  byId('mInstallBtn').addEventListener('click', async () => { if (!installPrompt) return; installPrompt.prompt(); await installPrompt.userChoice.catch(() => {}); installPrompt = null; byId('mInstallBtn').classList.add('hidden'); });
  window.addEventListener('appinstalled', () => byId('mInstallBtn').classList.add('hidden'));
  if (/iPhone|iPad/.test(navigator.userAgent) && !navigator.standalone) byId('mIosHint').classList.remove('hidden');
  // (the game's window opens this one with its login: a new login there reaches an open messenger too)
  try { new BroadcastChannel('gc-messenger').addEventListener('message', (event) => { if (event.data?.account && !accountToken.get() && !deviceToken.get()) { accountToken.set(event.data.account); start(); } }); } catch {}
  start();
})();
