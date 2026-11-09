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
  // 메신저 정리 (docs/messenger-speed-photo-20261103.md 12절): ?embed=1 -- the island app's 서랍. Its tab's login (the same
  // sessionStorage), no icon count, no title blink, no notices of its own and no push (those are the messenger app's);
  // the head: ✕ and 「메신저 앱으로 열기 ↗」
  const EMBED = new URLSearchParams(location.search).has('embed'); if (EMBED) document.body.classList.add('mEmbed');
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
    clearBox(); list.replaceChildren(); app.classList.remove('inRoom', 'picking'); pick.classList.add('hidden'); baseTitle = '아일랜드 메신저'; blink.seen(); document.title = baseTitle;
    app.classList.add('hidden'); loginForm.classList.remove('hidden'); byId('mLoginStatus').textContent = message;
    for (const id of ['mLogoutBtn', 'mDevicesBtn', 'mPushBtn', 'mDevices', 'mAlertPick']) byId(id).classList.add('hidden');
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
    if (EMBED) { try { window.parent.postMessage({ type: 'gc-messenger-unread', unread: unreadOf(state.rooms.filter((r) => away() || r.id !== current?.id)) /* (Codex 251-260 #15: the 서랍 closed or not looked at -- its room is peeked, not read: counted) */ }, location.origin); } catch {} return; } /* (the room open is being read) */ // (12절: the count on the island's 메신저 button only -- told it at once, 총괄 #402)
    document.title = blink.text(baseTitle); blink.update(unread, away());
    window.MessengerAlert.setBadge(navigator, unread);
  }
  async function refresh() { const g = gen; try { const data = await api('/api/messenger'); if (g !== gen) return false; const before = state; state = data; renderRooms(); if (synced === g) popNew(before.rooms, data.rooms); synced = g; return true; } catch (err) { if (g === gen) fail(err); return false; } }
  // (메신저 3절 3) the window open but not looked at (minimised, another window in front): the notice the push would be --
  // same look, same tag (one notice a room), never for a muted room or my own line; the server pushes this device no more
  // while it is open here (3절 4)
  // (Codex 검토 5차 P2-1: the list after this login's first one -- a room not in it before is new, its first line a notice too)
  let synced = -1;
  function popNew(was, now) {
    // (10절: 열어 둘 때만 and 닫아도 받기 alike -- the page's own notice needs no push subscription, only the permission)
    if (alertMode === 'off' || !pushReg || !streamUp || !away() || Notification.permission !== 'granted') return; // (the stream down -- a few seconds reconnecting -- a pushed device is pushed then: one notice, one sound)
    const seen = new Map(was.map((r) => [r.id, r.seq]));
    for (const r of now) {
      if (r.muted || !r.last || r.last.system || r.last.mine || !(r.seq > (seen.get(r.id) ?? 0))) continue;
      const title = r.kind === 'dm' ? r.last.label : r.name; const body = (r.kind === 'dm' ? r.last.text : `${r.last.label}: ${r.last.text}`).slice(0, 120);
      pushReg.showNotification(title, { body, tag: r.id, renotify: true, icon: '/icons/icon-192.png', badge: '/icons/badge-96.png', data: { room: r.id } }).catch(() => {});
    }
  }
  function line(msg, same) { // `same`: the same person just before -- the name once (카톡)
    if (msg.system) { const p = document.createElement('p'); p.className = 'messengerSystem'; p.textContent = msg.text; return p; }
    const item = document.createElement('div'); item.className = 'chatMessage' + (msg.from === state.me ? ' mine' : '') + (same ? ' same' : '');
    if (!same) { const head = document.createElement('div'); head.className = 'chatMessageHead'; const who = document.createElement('strong'); who.textContent = msg.label; head.append(who); item.append(head); }
    const row = document.createElement('div'); row.className = 'chatMessageBody'; const text = document.createElement('div'); text.className = 'chatMessageText' + (msg.deleted ? ' deleted' : ''); if (msg.deleted) text.textContent = '삭제된 메시지입니다'; else text.append(...linked(msg.text));
    if (msg.sticker && !msg.deleted) { text.classList.add('messengerSticker'); text.replaceChildren(stickerImg(msg.sticker, msg.text)); } // (v1.10.279: the picture alone, no bubble)
    const grid = !msg.deleted && photoGrid(msg); if (grid) { text.classList.add('withPhotos'); if (msg.text === PHOTO_ONLY) text.replaceChildren(grid); else text.prepend(grid); } // (v1.10.233: photos, a grid)
    if (msg.pending || msg.failed) item.classList.add(msg.failed ? 'failed' : 'pending');
    const meta = document.createElement('span'); meta.className = 'messengerMeta';
    if (msg.pending) { const s = document.createElement('span'); s.className = 'messengerSending'; s.textContent = '🕒 보내는 중'; meta.append(s); row.append(text, meta); item.append(row); return item; }
    if (msg.failed) { const s = document.createElement('span'); s.className = 'messengerFailed'; s.textContent = msg.failed; const again = document.createElement('button'); again.type = 'button'; again.className = 'ghost tiny'; again.textContent = '다시 보내기'; again.addEventListener('click', () => resend(msg)); const drop = document.createElement('button'); drop.type = 'button'; drop.className = 'ghost tiny'; drop.textContent = '지우기'; drop.addEventListener('click', () => dropPending(msg)); meta.append(s, again, drop); row.append(text, meta); item.append(row); return item; }
    // 안 읽은 사람 수 (카톡의 「1」): the members (still let in) besides the sender whose last read is before this line
    const waitingFor = waitingOf(msg);
    if (waitingFor.length) {
      const n = document.createElement('button'); n.type = 'button'; n.className = 'messengerReadCount'; n.textContent = waitingFor.length;
      const who = waitingFor.map((m) => m.label).join(', '); n.title = `안 읽음: ${who}`; n.setAttribute('aria-label', `안 읽은 사람 ${waitingFor.length}명: ${who}`);
      n.addEventListener('click', () => showToast(`안 읽음: ${who}`, 4000)); // a phone has no hover
      meta.append(n);
    }
    const time = document.createElement('time'); time.textContent = new Date(msg.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }); meta.append(time);
    if (!msg.deleted) bubbleMenuOn(text, msg); // (B5: 복사 on every line; 삭제 mine, within 5 minutes, for everyone)
    row.append(text, meta); item.append(row); return item;
  }
  // 메신저 다듬기 B4: an http/https address in a line opens (a new tab, no opener, no referrer) -- made of text nodes and <a>
  // with textContent only, never the line as HTML; a closing mark after it (. , ! ? ) 」) left out of it
  const URL_IN = /https?:\/\/[^\s<>"'“”‘’「」『』]+/gi;
  function linked(s) {
    const out = []; let at = 0;
    for (const m of String(s).matchAll(URL_IN)) {
      let u = m[0];
      while (/[.,!?;:)\]}…。、]$/.test(u)) { if (u.endsWith(')') && (u.match(/\(/g) || []).length >= (u.match(/\)/g) || []).length) break; u = u.slice(0, -1); }
      let href = ''; try { const x = new URL(u); if (x.protocol === 'http:' || x.protocol === 'https:') href = x.href; } catch {}
      if (!href) continue;
      if (m.index > at) out.push(document.createTextNode(s.slice(at, m.index)));
      const a = document.createElement('a'); a.className = 'messengerLink'; a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = u; out.push(a); at = m.index + u.length;
    }
    if (at < s.length) out.push(document.createTextNode(s.slice(at)));
    return out;
  }
  // v1.10.190 말풍선 메뉴 (사용자: no 「삭제」 word under my line): a right click on the PC, a 0.5 s press on a phone (a
  // keyboard: the menu key on the focused line) opens a small menu by it; outside it or Esc closes it. B5: 「복사」 on every
  // line not deleted (mine and others'), 「삭제」 as before -- mine, within 5 minutes, asked once
  const canUnsend = (msg) => !msg.deleted && Date.now() - Date.parse(msg.at) < 5 * 60 * 1000;
  const canCopy = (msg) => !msg.deleted && Boolean(msg.text) && msg.text !== PHOTO_ONLY;
  const menuOf = (msg) => ({ copy: canCopy(msg), del: msg.from === state.me && canUnsend(msg) });
  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); return true; } catch {}
    const area = document.createElement('textarea'); area.value = t; area.setAttribute('readonly', ''); area.style.cssText = 'position:fixed;top:0;left:0;opacity:0'; document.body.append(area); area.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch {} area.remove(); return ok;
  }
  let bubbleMenu = null;
  const closeBubbleMenu = () => { bubbleMenu?.remove(); bubbleMenu = null; };
  document.addEventListener('pointerdown', (e) => { if (bubbleMenu && !bubbleMenu.contains(e.target)) closeBubbleMenu(); }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && bubbleMenu) closeBubbleMenu(); });
  function openBubbleMenu(bubble, msg, x, y) {
    closeBubbleMenu(); const can = menuOf(msg); if (!can.copy && !can.del) return; const room = current; // (C5 Codex 4차 P3-6: the room it was opened in)
    const menu = document.createElement('div'); menu.className = 'messengerMoreMenu messengerBubbleMenu'; menu.setAttribute('role', 'menu');
    const item = (label, cls, act) => { const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.setAttribute('role', 'menuitem'); b.textContent = label; b.addEventListener('click', act); menu.append(b); return b; };
    if (can.copy) item('복사', 'messengerBubbleCopy', async () => { closeBubbleMenu(); showToast(await copyText(msg.text) ? '복사했어요.' : '복사하지 못했어요.'); });
    if (can.del) item('삭제', 'messengerBubbleDelete', async () => {
      closeBubbleMenu(); if (!await ask({ text: '이 메시지를 모두에게서 삭제할까요?', ok: '삭제', danger: true })) return;
      if (current !== room) return; try { await api(`/api/messenger/rooms/${room.id}/unsend`, { seq: msg.seq }); msg.text = ''; msg.deleted = true; render(); } catch (err) { fail(err); }
    });
    app.append(menu); bubbleMenu = menu;
    if (!x && !y) { const r = bubble.getBoundingClientRect(); x = r.left; y = r.bottom; } // (the menu key: by the line)
    const w = menu.offsetWidth; const h = menu.offsetHeight;
    menu.style.left = `${Math.max(8, Math.min(x, innerWidth - w - 8))}px`; menu.style.top = `${Math.max(8, Math.min(y, innerHeight - h - 8))}px`;
    menu.querySelector('button').focus();
  }
  function bubbleMenuOn(bubble, msg) {
    bubble.classList.add('hasMenu'); bubble.tabIndex = 0; bubble.setAttribute('aria-haspopup', 'menu');
    bubble.addEventListener('contextmenu', (e) => { const can = menuOf(msg); if (!can.copy && !can.del) return; e.preventDefault(); openBubbleMenu(bubble, msg, e.clientX, e.clientY); });
    let press = null; let held = false; const cancel = () => { clearTimeout(press); press = null; };
    bubble.addEventListener('pointerdown', (e) => { held = false; if (e.pointerType === 'mouse') return; cancel(); const { clientX: x, clientY: y } = e; press = setTimeout(() => { press = null; held = true; openBubbleMenu(bubble, msg, x, y); }, 500); });
    bubble.addEventListener('click', (e) => { if (held) { held = false; e.preventDefault(); e.stopPropagation(); } }, true); // (a long press on an address opens the menu, not the address)
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) bubble.addEventListener(ev, cancel);
  }
  // 메신저 다듬기 A1 (사진 있는 방에서 보내거나 받으면 사진 근처가 보이던 것): only the lines that changed are drawn again -- a
  // line's key its seq (on its way: its pid), kept while what it shows is the same; the box held at its end when it was
  // there (after drawing, after a photo comes in, when the box itself changes size)
  let rows = new Map(); let stick = true; let unreadFrom = null; // (B2: my last read when the room was opened, while it has unread lines)
  const clearBox = () => { rows = new Map(); box.replaceChildren(); stick = true; newBelow.classList.add('hidden'); };
  function grow() { const t = byId('messengerInput'); t.style.height = 'auto'; t.style.height = `${t.scrollHeight + t.offsetHeight - t.clientHeight}px`; keepEnd(); } // (B3: max 5 lines in CSS)
  // 메신저 다듬기 B1: a new line come in while I read further up -- 「새 메시지 ↓」 over the box; pressed, the end; at the end, gone
  const newBelow = byId('messengerNewBelow');
  newBelow.addEventListener('click', () => { toEnd(); stick = true; newBelow.classList.add('hidden'); });
  const toEnd = () => { box.scrollTop = box.scrollHeight; };
  const keepEnd = () => { if (stick) toEnd(); };
  box.addEventListener('scroll', () => { stick = box.scrollHeight - box.scrollTop - box.clientHeight < 40; if (stick) newBelow.classList.add('hidden'); });
  try { new ResizeObserver(keepEnd).observe(box); } catch {}
  const waitingOf = (msg) => (msg.system || msg.pending || msg.failed ? [] : current.members.filter((m) => m.active && m.id !== msg.from && (current.reads[m.id] || 0) < msg.seq));
  function render() {
    const want = []; let prev = null; let prevDay = '';
    const put = (key, sig, make) => want.push({ key, sig, make });
    if (msgs.length && msgs[0].seq > 1) put('more', '', moreButton);
    let marked = false;
    for (const msg of msgs) {
      if (unreadFrom !== null && !marked && msg.seq > unreadFrom) {
        marked = true; // (the line only with something read above it)
        if (prev) put('unread', '', () => { const p = document.createElement('p'); p.className = 'messengerUnreadLine'; p.textContent = '여기까지 읽었어요'; return p; });
      }
      const day = new Date(msg.at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
      if (day !== prevDay) put(`d${day}`, day, () => { const s = document.createElement('p'); s.className = 'messengerDay'; s.textContent = day; return s; });
      const same = Boolean(prev && !prev.system && prev.from === msg.from && day === prevDay);
      put(`m${msg.seq}`, JSON.stringify([msg.text, msg.sticker || '', Boolean(msg.deleted), same, msg.label, waitingOf(msg).map((m) => m.id)]), () => line(msg, same));
      prev = msg; prevDay = day;
    }
    for (const p of pend.filter((x) => x.room === current?.id)) { const same = Boolean(prev && !prev.system && prev.from === p.from); put(`p${p.pid}`, JSON.stringify([p.text, same, p.pending, p.failed || '', p.done]), () => line(p, same)); prev = p; } // (v1.10.233: mine on their way)
    if (!want.length) { rows = new Map(); box.innerHTML = '<p class="emptyState">첫 메시지를 보내 보세요.</p>'; return; }
    const next = new Map();
    const nodes = want.map(({ key, sig, make }) => { let row = rows.get(key); if (!row || row.sig !== sig) row = { sig, node: make() }; next.set(key, row); return row.node; });
    rows = next;
    let at = box.firstChild; // (in place: a node already where it belongs is not touched)
    for (const node of nodes) { if (node === at) { at = at.nextSibling; continue; } box.insertBefore(node, at); }
    while (at) { const after = at.nextSibling; at.remove(); at = after; }
    keepEnd();
  }
  // ---- v1.10.233 보내기 빠르게 + 사진 (notes docs/messenger-speed-photo-20261103.md 2·5절) ----
  // Enter: the box empty at once and my line drawn at once, pale with 「보내는 중」; the send's own answer makes it the
  // server's (no second round trip); refused: 「다시 보내기 / 지우기」 on it and the words back in the box. One after
  // another, in the order typed. Photos: the 📷 button (a phone's album, many at once), dropped on the chat or pasted
  // (Ctrl+V) on a PC -- up to 10, shrunk here (1280 px, JPEG 0.8: no place data left in them), each taken out of the tray
  // before sending; sent one by one (3/7), then the message that takes them; a grid in the bubble, pressed: large, turned
  // through. Seven days on, each says it is gone.
  const PHOTO_ONLY = '📷 사진'; const PHOTO_DAYS = 7; const TRAY_MAX = 10;
  let pend = []; let sendChain = Promise.resolve(); let pseq = 0; let tray = [];
  const photoUrls = new Map(); // a photo's id -> its blob url, or 'gone' (asked with my headers: an <img> could not send them)
  const photoAsk = new Map();
  function photoUrl(id) {
    if (photoUrls.has(id)) return Promise.resolve(photoUrls.get(id)); if (photoAsk.has(id)) return photoAsk.get(id);
    const ask = fetch(`/api/messenger/photos/${id}`, { headers: headers(), cache: 'default' }).then(async (res) => { const u = res.status === 410 || res.status === 404 ? 'gone' : res.ok ? URL.createObjectURL(await res.blob()) : null; if (u) photoUrls.set(id, u); return u; }).catch(() => null).finally(() => photoAsk.delete(id));
    photoAsk.set(id, ask); return ask;
  }
  const photoGone = (msg, p) => p.gone || photoUrls.get(p.id) === 'gone' || Date.now() - Date.parse(msg.at) > PHOTO_DAYS * 86400000;
  function photoGrid(msg) {
    const list = msg.local || msg.photos || []; if (!list.length) return null;
    const grid = document.createElement('div'); grid.className = `messengerPhotos n${Math.min(list.length, 3)}`;
    list.forEach((p, k) => {
      const tile = document.createElement('button'); tile.type = 'button'; tile.className = 'messengerPhoto';
      if (!msg.local && photoGone(msg, p)) { tile.classList.add('gone'); tile.disabled = true; tile.textContent = '7일이 지나 사라진 사진'; grid.append(tile); return; }
      // (A1: the tile's size before the photo is in -- its own w/h, else a fixed 4:3 (CSS); one already here, its src at once)
      const img = document.createElement('img'); img.alt = ''; img.decoding = 'async'; if (p.w && p.h) img.style.aspectRatio = `${p.w} / ${p.h}`; img.addEventListener('load', keepEnd); tile.append(img); tile.setAttribute('aria-label', `사진 ${k + 1}/${list.length} 크게 보기`);
      const had = msg.local ? p.url : photoUrls.get(p.id);
      if (had && had !== 'gone') img.src = had; else photoUrl(p.id).then((u) => { if (u === 'gone') { tile.replaceChildren('7일이 지나 사라진 사진'); tile.classList.add('gone'); tile.disabled = true; keepEnd(); } else if (u) img.src = u; });
      tile.addEventListener('click', () => openViewer(msg, k)); grid.append(tile);
    });
    if (msg.pending && msg.local) { const prog = document.createElement('span'); prog.className = 'messengerPhotoProgress'; prog.textContent = `${msg.done || 0}/${list.length}`; grid.append(prog); }
    return grid;
  }
  // the big view: one at a time, ← → (a swipe on a phone), Esc or ✕ to close
  const viewer = byId('messengerViewer'); const viewerImg = byId('messengerViewerImg'); let viewing = null;
  async function showViewer() { setZoom({ s: 1, x: 0, y: 0 }); const { msg, k } = viewing; const list = msg.local || msg.photos; const p = list[k]; byId('messengerViewerCount').textContent = `${k + 1} / ${list.length}`; viewerImg.removeAttribute('src'); const u = msg.local ? p.url : await photoUrl(p.id); if (viewing?.msg === msg && viewing.k === k && u && u !== 'gone') viewerImg.src = u; }
  function openViewer(msg, k) { viewing = { msg, k }; viewer.classList.remove('hidden'); showViewer(); byId('messengerViewerClose').focus(); }
  const viewStep = (d) => { if (!viewing) return; const n = (viewing.msg.local || viewing.msg.photos).length; viewing.k = (viewing.k + d + n) % n; showViewer(); };
  const closeViewer = () => { viewing = null; viewer.classList.add('hidden'); viewerImg.removeAttribute('src'); setZoom({ s: 1, x: 0, y: 0 }); };
  byId('messengerViewerClose').addEventListener('click', closeViewer); byId('messengerViewerPrev').addEventListener('click', () => viewStep(-1)); byId('messengerViewerNext').addEventListener('click', () => viewStep(1));
  document.addEventListener('keydown', (e) => { if (!viewing) return; if (e.key === 'Escape') closeViewer(); else if (e.key === 'ArrowLeft') viewStep(-1); else if (e.key === 'ArrowRight') viewStep(1); });
  // v1.10.291 확대·축소 (public/messenger-zoom.js): two fingers, a double tap (2.5x <-> 1x), the wheel and 「− 100% +」; dragged
  // when zoomed; a swipe turns the photo only at 1x; back to 1x on another photo or closing (`viewer.dataset.zoom` the scale)
  var zoom = { s: 1, x: 0, y: 0 }; const MZ = window.MessengerZoom;
  const zoomBox = () => ({ w: viewerImg.offsetWidth, h: viewerImg.offsetHeight, W: viewer.clientWidth, H: viewer.clientHeight });
  const fromCentre = (cx, cy) => { const r = viewer.getBoundingClientRect(); return [cx - r.left - r.width / 2, cy - r.top - r.height / 2]; };
  function setZoom(z) { zoom = z; viewerImg.style.transform = z.s === 1 ? '' : `translate(${z.x}px, ${z.y}px) scale(${z.s})`; viewer.dataset.zoom = String(Math.round(z.s * 100) / 100); byId('messengerZoomPct').textContent = `${Math.round(z.s * 100)}%`; }
  const zoomTo = (s, px = 0, py = 0) => { const b = zoomBox(); setZoom(MZ.zoomAt(zoom, s, px, py, b.w, b.h, b.W, b.H)); };
  {
    const pts = new Map(); let start = null; let pinch = null; let lastTap = null;
    viewer.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return; pts.set(e.pointerId, [e.clientX, e.clientY]); try { viewer.setPointerCapture(e.pointerId); } catch {}
      if (pts.size === 1) start = { x: e.clientX, y: e.clientY, at: performance.now(), moved: false, pinched: false };
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, s: zoom.s }; if (start) { start.moved = true; start.pinched = true; } }
    });
    viewer.addEventListener('pointermove', (e) => {
      const p = pts.get(e.pointerId); if (!p) return; const dx = e.clientX - p[0]; const dy = e.clientY - p[1]; pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pinch && pts.size >= 2) { const [a, b] = [...pts.values()]; zoomTo(pinch.s * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d, ...fromCentre((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)); return; }
      if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) start.moved = true;
      if (zoom.s > 1) { const b = zoomBox(); setZoom(MZ.panBy(zoom, dx, dy, b.w, b.h, b.W, b.H)); }
    });
    const up = (e) => {
      if (!pts.delete(e.pointerId)) return; if (pts.size < 2) pinch = null; if (pts.size || !start) return; const s0 = start; start = null;
      if (!s0.moved && performance.now() - s0.at < 300) { /* (a tap; two within 350 ms and 30 px: the double tap) */
        const now = performance.now();
        if (lastTap && now - lastTap.at < 350 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) { lastTap = null; const b = zoomBox(); setZoom(MZ.toggle(zoom, ...fromCentre(e.clientX, e.clientY), b.w, b.h, b.W, b.H)); } else lastTap = { at: now, x: e.clientX, y: e.clientY };
        return;
      }
      if (zoom.s === 1 && !s0.pinched && Math.abs(e.clientX - s0.x) > 50) viewStep(e.clientX < s0.x ? 1 : -1);
    };
    viewer.addEventListener('pointerup', up); viewer.addEventListener('pointercancel', up);
    viewer.addEventListener('wheel', (e) => { if (!viewing) return; e.preventDefault(); zoomTo(zoom.s * Math.exp(-e.deltaY * 0.0015), ...fromCentre(e.clientX, e.clientY)); }, { passive: false });
    byId('messengerZoomIn').addEventListener('click', () => zoomTo(zoom.s * 1.5)); byId('messengerZoomOut').addEventListener('click', () => zoomTo(zoom.s / 1.5));
  }
  // the tray: shrunk here, before sending
  async function shrink(file) {
    let src = null; try { src = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { src = await new Promise((done) => { const im = new Image(); const u = URL.createObjectURL(file); im.onload = () => done(im); im.onerror = () => done(null); im.src = u; }); }
    if (!src) throw new Error('사진을 열지 못했어요.');
    const W = src.width || src.naturalWidth; const H = src.height || src.naturalHeight; const k = Math.min(1, 1280 / Math.max(W, H)); const w = Math.max(1, Math.round(W * k)); const h = Math.max(1, Math.round(H * k));
    const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(src, 0, 0, w, h); src.close?.();
    const blob = await new Promise((done) => { c.toBlob(done, 'image/jpeg', 0.8); }); if (!blob) throw new Error('사진을 줄이지 못했어요.');
    return { blob, w, h, url: URL.createObjectURL(blob) };
  }
  const shots = byId('messengerShots');
  function drawTray() {
    shots.classList.toggle('hidden', !tray.length);
    shots.replaceChildren(...tray.map((t, k) => { const d = document.createElement('div'); d.className = 'messengerShot'; const im = document.createElement('img'); im.src = t.url; im.alt = ''; const x = document.createElement('button'); x.type = 'button'; x.className = 'messengerShotDrop'; x.textContent = '✕'; x.setAttribute('aria-label', `사진 ${k + 1} 빼기`); x.addEventListener('click', () => { URL.revokeObjectURL(t.url); tray.splice(k, 1); drawTray(); }); d.append(im, x); return d; }), ...(tray.length ? [Object.assign(document.createElement('span'), { className: 'messengerShotNote', textContent: `${tray.length}/${TRAY_MAX}장 · 7일 동안 보관` })] : []));
  }
  async function addPhotos(files) {
    const list = [...files].filter((f) => /^image\//.test(f.type)); if (!list.length || !current) return;
    if (tray.length + list.length > TRAY_MAX) showToast(`한 번에 ${TRAY_MAX}장까지 보낼 수 있어요.`);
    for (const f of list.slice(0, Math.max(0, TRAY_MAX - tray.length))) { try { tray.push(await shrink(f)); drawTray(); } catch (err) { showToast(err.message); } }
  }
  const pickInput = byId('messengerPhotoPick');
  byId('messengerPhotoBtn').addEventListener('click', () => pickInput.click());
  pickInput.addEventListener('change', () => { addPhotos(pickInput.files); pickInput.value = ''; });
  byId('messengerInput').addEventListener('paste', (e) => { const files = [...(e.clipboardData?.files || [])]; if (files.some((f) => /^image\//.test(f.type))) { e.preventDefault(); addPhotos(files); } });
  { const room = byId('messengerRoom'); let depth = 0; const has = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
    room.addEventListener('dragenter', (e) => { if (!has(e) || !current) return; e.preventDefault(); depth += 1; room.classList.add('dropping'); });
    room.addEventListener('dragover', (e) => { if (has(e) && current) e.preventDefault(); });
    room.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) room.classList.remove('dropping'); });
    room.addEventListener('drop', (e) => { if (!has(e)) return; e.preventDefault(); depth = 0; room.classList.remove('dropping'); addPhotos(e.dataTransfer.files); }); }
  // sending: drawn at once, the answer makes it the server's
  async function upload(roomId, shot) {
    const res = await fetch(`/api/messenger/rooms/${roomId}/photos`, { method: 'POST', cache: 'no-store', headers: { ...headers(), 'Content-Type': 'image/jpeg', 'X-Photo-W': String(shot.w), 'X-Photo-H': String(shot.h) }, body: shot.blob });
    let data = {}; try { data = await res.json(); } catch {}
    if (!res.ok) throw Object.assign(new Error(data.message || '사진을 올리지 못했습니다.'), { status: res.status, code: data.error }); return data.id;
  }
  function queueSend(text, photos = [], sticker = null) { // (v1.10.279: a sticker -- { id, text } -- goes alone)
    const me = current.members.find((m) => m.id === state.me);
    const p = { pid: ++pseq, room: current.id, from: state.me, label: me?.label || '나', text: sticker ? `(이모티콘) ${sticker.text}` : text || (photos.length ? PHOTO_ONLY : ''), sticker: sticker?.id || null, at: new Date().toISOString(), pending: true, local: photos.length ? photos : null, ids: [], done: 0 };
    pend.push(p); render(); toEnd();
    sendChain = sendChain.then(() => sendOne(p));
  }
  async function sendOne(p) {
    const g = gen;
    try {
      for (let k = p.ids.length; k < (p.local || []).length; k += 1) { p.ids.push(await upload(p.room, p.local[k])); p.done = k + 1; if (current?.id === p.room) render(); }
      const data = await api(`/api/messenger/rooms/${p.room}/messages`, p.sticker ? { sticker: p.sticker } : { text: p.local && p.text === PHOTO_ONLY ? '' : p.text, photos: p.ids });
      if (g !== gen) return; pend = pend.filter((x) => x !== p);
      if (data.message?.photos && p.local) data.message.photos.forEach((q, k) => { if (p.local[k]) photoUrls.set(q.id, p.local[k].url); }); // (mine: the shrunk ones already here)
      if (current?.id === p.room && data.message && !msgs.some((x) => x.seq === data.message.seq)) {
        msgs.push(data.message); msgs.sort((a, b) => a.seq - b.seq);
        if (data.message.seq === last + 1) last = data.message.seq; else pull(); // (others' lines between: asked for, not skipped)
      }
      if (current?.id === p.room) { render(); toEnd(); }
    } catch (err) {
      if (g !== gen) return; p.pending = false; p.failed = err.message || '보내지 못했어요.';
      const input = byId('messengerInput'); if (!input.value && !p.local && !p.sticker) { input.value = p.text; grow(); } // (the words back in the box)
      if (current?.id === p.room) render(); if (err.status === 401 || err.status === 403) fail(err);
    }
  }
  function resend(p) { p.failed = null; p.pending = true; const input = byId('messengerInput'); if (input.value === p.text) { input.value = ''; grow(); } render(); sendChain = sendChain.then(() => sendOne(p)); }
  function dropPending(p) { pend = pend.filter((x) => x !== p); render(); }

  // ---- v1.10.279 이모티콘 (notes docs/messenger-emoticons-20261108.md): the 😊 panel over the box, PC and phone alike --
  // 「이모티콘」 (섬 친구들 1, 4 a row: pressed, large; pressed again, sent -- alone), 「그림 글자」 (6 groups, put in the box
  // at the cursor: a text line), the last 8 of each on top (this device's, never needed)
  const STICKERS = fetch('/messenger/stickers/stickers.json', { cache: 'default' }).then((r) => r.json()).then((d) => new Map(d.stickers.map((s) => [s.id, s]))).catch(() => new Map());
  function stickerImg(id, alt) {
    const img = document.createElement('img'); img.className = 'messengerStickerImg'; img.alt = String(alt || '').replace(/^\(이모티콘\) /, ''); img.decoding = 'async'; img.addEventListener('load', keepEnd);
    // (v1.10.281 움직이는 이모티콘: in the room its moving picture -- the panel keeps the still ones (a phone's weight); still
    // when the device asks for less motion. ponytail: off screen it is left to the browser (Chrome does not animate what it does not paint))
    STICKERS.then((m) => { const s = m.get(id); if (s) { img.src = `/messenger/stickers/${s.anim && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? s.anim : s.file}`; img.style.setProperty('--pad', String((s.pad || 0) / 360)); } }); return img; // (pad: its clear side edge -- the time beside the art)
  }
  const GLYPHS = [['얼굴', '😀 😃 😄 😁 😆 😅 🤣 😂 🙂 😉 😊 😇 🥰 😍 😘 😋 😜 🤔 😴 😭'], ['손', '👍 👎 👏 🙌 👐 🙏 🤝 👋 ✌️ 🤞 👌 🤙 💪 ☝️ 👉 👈 👆 👇 ✋ 🫶'],
    ['하트', '❤️ 🧡 💛 💚 💙 💜 🤎 🖤 🤍 💕 💞 💓 💗 💖 💘 💝 💌 💯 ✨ ⭐'], ['동물', '🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🐟 🐝'],
    ['음식', '🍎 🍊 🍋 🍉 🍇 🍓 🍑 🍒 🍞 🍕 🍔 🍟 🍗 🍜 🍣 🍙 🍰 🍩 ☕ 🍺'], ['물건', '🎉 🎁 🎈 🎂 🎮 🏆 ⚽ 🎵 📷 📱 💡 📌 ⏰ 🌸 🌈 ☀️ 🌙 ☔ 🔥 🏝️']].map(([name, s]) => [name, s.split(' ')]);
  const recentStore = keep(localStorage, 'gc.messengerRecent');
  const recentOf = (tab) => { try { const v = JSON.parse(recentStore.get() || '{}')[tab]; return Array.isArray(v) ? v.slice(0, 8) : []; } catch { return []; } };
  const used = (tab, v) => { try { const all = JSON.parse(recentStore.get() || '{}'); all[tab] = [v, ...recentOf(tab).filter((x) => x !== v)].slice(0, 8); recentStore.set(JSON.stringify(all)); } catch {} };
  const emoji = byId('messengerEmoji'); const emojiBody = byId('messengerEmojiBody'); const preview = byId('messengerEmojiPreview'); const emojiBtn = byId('messengerEmojiBtn');
  let emojiTab = 'sticker'; let chosenSticker = null;
  const showPreview = (s) => { // (the chosen cell marked too)
    for (const c of emojiBody.querySelectorAll('.messengerStickerCell')) c.setAttribute('aria-pressed', String(Boolean(s) && c.dataset.id === s.id)); chosenSticker = s; preview.classList.toggle('hidden', !s); if (s) { const im = preview.querySelector('img'); im.src = `/messenger/stickers/${s.file}`; im.alt = s.text; } };
  function sendSticker(s) { if (!current) return; used('sticker', s.id); showPreview(null); queueSend('', [], s); drawEmoji(); }
  const cell = (label, title, onPick, cls) => { const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.title = title; b.setAttribute('aria-label', title); if (typeof label === 'string') b.textContent = label; else b.append(label); b.addEventListener('click', onPick); return b; };
  const section = (name, cells, cls) => { const h = document.createElement('p'); h.className = 'messengerEmojiHead'; h.textContent = name; const g = document.createElement('div'); g.className = cls; g.append(...cells); return [h, g]; };
  async function drawEmoji() {
    for (const b of emoji.querySelectorAll('[role="tab"]')) b.setAttribute('aria-selected', String(b.dataset.tab === emojiTab));
    if (emojiTab === 'sticker') {
      const m = await STICKERS; if (emojiTab !== 'sticker') return;
      const pickS = (s) => { const im = document.createElement('img'); im.src = `/messenger/stickers/${s.file}`; im.alt = ''; im.loading = 'lazy';
        const b = cell(im, s.text, () => (chosenSticker?.id === s.id ? sendSticker(s) : showPreview(s)), 'messengerStickerCell'); b.dataset.id = s.id; b.setAttribute('aria-pressed', String(chosenSticker?.id === s.id)); return b; }; // (its id: the chosen one marked)
      const recent = recentOf('sticker').map((id) => m.get(id)).filter(Boolean);
      emojiBody.replaceChildren(...(recent.length ? section('최근', recent.map(pickS), 'messengerStickerGrid') : []), ...section('섬 친구들 1', [...m.values()].map(pickS), 'messengerStickerGrid'));
    } else {
      showPreview(null);
      const pickG = (g) => cell(g, g, () => putGlyph(g), 'messengerGlyph'); const recent = recentOf('glyph');
      emojiBody.replaceChildren(...(recent.length ? section('최근', recent.map(pickG), 'messengerGlyphGrid') : []), ...GLYPHS.flatMap(([name, list]) => section(name, list.map(pickG), 'messengerGlyphGrid')));
    }
  }
  const touch = () => Boolean(window.matchMedia?.('(hover: none) and (pointer: coarse)').matches); /* (a phone: no keypad unless the box is tapped) */
  // v1.10.289 (사용자 「핸드폰에서 스크롤이 생겨서 불편해」): the page as tall as what is seen -- the keypad up too (the box over it); a pinch's zoom
  // not taken for a smaller screen
  const fitPage = () => { const v = window.visualViewport; document.documentElement.style.setProperty('--mvh', `${Math.round(v ? v.height * v.scale : window.innerHeight)}px`); };
  fitPage(); window.visualViewport?.addEventListener('resize', fitPage); window.addEventListener('resize', fitPage);
  function putGlyph(g) { // at the cursor (the box's 500 letters kept); a phone's keypad not called up for it
    const input = byId('messengerInput'); const a = input.selectionStart ?? input.value.length; const b = input.selectionEnd ?? a;
    if (input.value.length - (b - a) + g.length > 500) return showToast('500자까지 쓸 수 있어요.'); // (v1.10.283 Codex #10: the chosen words replaced, not added to)
    input.setRangeText(g, a, b, 'end'); grow(); used('glyph', g);
    if (!window.matchMedia?.('(hover: none) and (pointer: coarse)').matches) input.focus();
  }
  // v1.10.286 (사용자 「이모티콘 창을 닫을 수가 없어」): besides the 😊 -- its ✕, the list tapped, and on a phone the box tapped (the keypad up) and the
  // phone's back (one history step while it is open)
  let emojiBack = false;
  function openEmoji(on) {
    const was = !emoji.classList.contains('hidden'); emoji.classList.toggle('hidden', !on); emojiBtn.setAttribute('aria-expanded', String(on));
    if (on) { if (touch()) { byId('messengerInput').blur(); if (!was && !emojiBack) { history.pushState({ emoji: 1 }, ''); emojiBack = true; } } drawEmoji(); keepEnd(); } else { showPreview(null); if (emojiBack) { emojiBack = false; history.back(); } }
  }
  window.addEventListener('popstate', () => { if (emojiBack) { emojiBack = false; openEmoji(false); } });
  emojiBtn.addEventListener('click', () => openEmoji(emoji.classList.contains('hidden')));
  byId('messengerEmojiClose').addEventListener('click', () => { openEmoji(false); emojiBtn.focus(); });
  byId('messengerMessages').addEventListener('pointerdown', () => { if (!emoji.classList.contains('hidden')) openEmoji(false); });
  byId('messengerInput').addEventListener('pointerdown', () => { if (touch() && !emoji.classList.contains('hidden')) openEmoji(false); }); /* (a PC keeps it: 그림 글자 at the cursor) */
  for (const b of emoji.querySelectorAll('[role="tab"]')) b.addEventListener('click', () => { emojiTab = b.dataset.tab; emojiBody.scrollTop = 0; drawEmoji(); });
  byId('messengerEmojiSend').addEventListener('click', () => { if (chosenSticker) sendSticker(chosenSticker); });
  byId('messengerEmojiPreviewClose').addEventListener('click', () => showPreview(null));
  emoji.addEventListener('keydown', (e) => { if (e.key === 'Escape') { openEmoji(false); emojiBtn.focus(); } });

  // 메신저 다듬기 B6: the page's own small window for 이름 바꾸기 / 나가기 / 삭제 (not the browser's prompt / confirm) -- the
  // island's paper, focus kept inside it, Esc · 취소 · outside closes it; answers true, the typed words, or null
  const askBack = byId('mAsk'); const askInput = byId('mAskInput'); const askOk = byId('mAskOk'); let asking = null;
  function ask({ text, ok = '확인', danger = false, value = null }) {
    asking?.(null);
    return new Promise((done) => {
      const before = document.activeElement; const typing = value !== null;
      byId('mAskText').textContent = text; askOk.textContent = ok; askOk.classList.toggle('mAskDanger', danger);
      askInput.hidden = !typing; askInput.value = typing ? value : '';
      askBack.classList.remove('hidden');
      asking = (answer) => { asking = null; askBack.classList.add('hidden'); if (before?.isConnected) before.focus?.(); done(answer); };
      if (typing) { askInput.focus(); askInput.select(); } else askOk.focus();
    });
  }
  byId('mAskForm').addEventListener('submit', (e) => { e.preventDefault(); asking?.(askInput.hidden ? true : askInput.value); });
  byId('mAskCancel').addEventListener('click', () => asking?.(null));
  askBack.addEventListener('pointerdown', (e) => { if (e.target === askBack) asking?.(null); });
  askBack.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); asking?.(null); return; }
    if (e.key !== 'Tab') return;
    const f = [...askBack.querySelectorAll('input:not([hidden]), button')]; const k = f.indexOf(document.activeElement);
    e.preventDefault(); f[(k + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
  });
  document.addEventListener('focusin', (e) => { if (asking && !askBack.contains(e.target)) (askInput.hidden ? askOk : askInput).focus(); });
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
      const peek = () => (away() ? '&peek=1' : ''); // (메신저 6절: not looked at -- the lines only, not read; read when I am back. Codex 검토 5차 P3-2: asked each request)
      let data = await api(`/api/messenger/rooms/${id}/messages?after=${from}${peek()}`);
      // (C3 ②: a busy room filled the page (100) with the asked-again lines -- the new ones asked for on their own)
      if (from < last && data.messages.length >= 100) { const more = await api(`/api/messenger/rooms/${id}/messages?after=${last}${peek()}`); data = { ...more, messages: [...data.messages.filter((msg) => msg.seq <= last), ...more.messages] }; }
      if (current?.id !== id || g !== gen) return;
      const firstPage = !last; current = data.room; showHead();
      const fresh = data.messages.filter((msg) => msg.seq > last && !msgs.some((x) => x.seq === msg.seq)); // (v1.10.233: mine, from its own answer, not twice)
      let gone = false; for (const msg of data.messages) { const had = msg.deleted && msgs.find((x) => x.seq === msg.seq && !x.deleted); if (had) { had.text = ''; had.deleted = true; gone = true; } }
      const key = JSON.stringify([current.reads, current.members]);
      if (!firstPage && !fresh.length && !gone && key === readsKey) return;
      const atEnd = stick;
      msgs.push(...fresh); msgs.sort((a, b) => a.seq - b.seq); if (data.messages.length) last = Math.max(last, data.messages.at(-1).seq); readsKey = key;
      render();
      // B2: opened -- the first unread line in view with 「여기까지 읽었어요」 over it (none unread: the end)
      const mark = firstPage && box.querySelector('.messengerUnreadLine');
      if (mark) { box.scrollTop += mark.getBoundingClientRect().top - box.getBoundingClientRect().top - 6; stick = box.scrollHeight - box.scrollTop - box.clientHeight < 40; }
      else if (firstPage && unreadFrom !== null && msgs.length && msgs[0].seq > unreadFrom) { box.scrollTop = 0; stick = box.scrollHeight - box.clientHeight < 40; } // (all of it unread: from the top, no line over nothing read)
      else if (firstPage || (fresh.length && (atEnd || fresh.at(-1).from === state.me))) toEnd();
      else if (fresh.some((x) => x.from !== state.me)) newBelow.classList.remove('hidden');
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
        msgs.unshift(...data.messages.filter((msg) => msg.seq < msgs[0].seq)); stick = false; render();
        box.scrollTop += box.scrollHeight - height; b.disabled = false; // (A1: the button kept across drawings)
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
  function openRoom(room) { closeBubbleMenu(); if (typeof closeViewer === 'function') closeViewer(); openEmoji(false); for (const t of tray) URL.revokeObjectURL(t.url); tray = []; drawTray(); current = room; last = 0; msgs = []; readsKey = ''; clearBox(); unreadFrom = room.unread > 0 ? (room.reads?.[state.me] ?? Math.max(0, room.seq - room.unread)) : null; app.classList.add('inRoom'); showHead(); renderRooms(); pull(); if (!touch()) byId('messengerInput').focus(); } /* (v1.10.286 사용자: on a phone the keypad only when the box is tapped) */
  // 메신저 다듬기 A2 사람 고르기 (새 대화방·초대·1:1 같은 화면): 이름 찾기 (치는 대로, 부분 일치) · 고른 사람은 알약 (✕로 빼기) ·
  // 한 줄에 한 사람 (줄 아무 데나 누르면 고름) -- 최근 대화한 사람 먼저 · 방 이름은 아래, 비우면 고른 사람 이름들로 · 단추
  // 「N명과 대화 시작」/「N명 초대」/(1:1, 한 명만)「대화 시작」, 아무도 안 고르면 누를 수 없음
  let chosen = []; let pickRows = [];
  const peopleBox = byId('messengerPeople'); const pickFind = byId('messengerPickFind'); const pickGo = byId('messengerPickGo');
  const AVATAR = ['#8a6a4a', '#4f6d8a', '#5f7d4e', '#8a4f6d', '#9a5a26', '#5a5f8a'];
  const avatarOf = (label) => { const s = document.createElement('span'); s.className = 'messengerAvatar'; s.setAttribute('aria-hidden', 'true'); s.textContent = [...String(label || '?').trim()][0] || '?'; let h = 0; for (const c of String(label)) h = (h * 31 + c.codePointAt(0)) >>> 0; s.style.background = AVATAR[h % AVATAR.length]; return s; };
  const roomNameOf = (labels) => { // 「지우, 한별, 솔」 (20자 안: 넘치면 「지우, 한별 외 3명」)
    const all = labels.join(', '); if (all.length <= 20) return all;
    for (let k = labels.length - 1; k >= 1; k -= 1) { const s = `${labels.slice(0, k).join(', ')} 외 ${labels.length - k}명`; if (s.length <= 20) return s; }
    const tail = ` 외 ${labels.length - 1}명`; return `${labels[0].slice(0, 20 - tail.length)}${tail}`;
  };
  function drawPicked() {
    const box2 = byId('messengerPicked'); box2.classList.toggle('hidden', !chosen.length || picking === 'dm');
    box2.replaceChildren(...chosen.map((p) => { const c = document.createElement('span'); c.className = 'messengerChip'; c.append(p.label); const x = document.createElement('button'); x.type = 'button'; x.textContent = '✕'; x.setAttribute('aria-label', `${p.label} 빼기`); x.addEventListener('click', () => togglePerson(p)); c.append(x); return c; }));
    for (const row of pickRows) row.b.setAttribute('aria-pressed', String(chosen.some((p) => p.id === row.p.id)));
    const n = chosen.length; pickGo.disabled = !n;
    pickGo.textContent = picking === 'dm' ? '대화 시작' : picking === 'invite' ? (n ? `${n}명 초대` : '초대') : n ? `${n}명과 대화 시작` : '대화 시작';
    byId('messengerPickName').placeholder = n && picking === 'new' ? roomNameOf(chosen.map((p) => p.label)) : '방 이름 (안 써도 돼요)';
  }
  function togglePerson(p) {
    if (picking === 'dm') chosen = chosen[0]?.id === p.id ? [] : [p];
    else chosen = chosen.some((x) => x.id === p.id) ? chosen.filter((x) => x.id !== p.id) : [...chosen, p];
    drawPicked();
  }
  function filterPeople() {
    const q = pickFind.value.trim().toLocaleLowerCase('ko'); let shown = 0;
    for (const row of pickRows) { const on = !q || row.p.label.toLocaleLowerCase('ko').includes(q); row.li.hidden = !on; if (on) shown += 1; }
    byId('messengerPeopleNone')?.remove();
    if (pickRows.length && !shown) { const li = document.createElement('li'); li.id = 'messengerPeopleNone'; li.className = 'smallMuted messengerPeopleNone'; li.textContent = `「${pickFind.value.trim()}」 이름이 없어요.`; peopleBox.append(li); }
  }
  function showPick(mode) { // 'new' | 'invite' | 'dm'
    picking = mode; chosen = []; const inRoom = new Set(mode === 'invite' ? current.members.map((m) => m.id) : []);
    byId('messengerPickTitle').textContent = mode === 'new' ? '새 대화방' : mode === 'dm' ? '1:1 대화' : `「${current.name}」에 초대`;
    byId('messengerPickName').classList.toggle('hidden', mode !== 'new'); byId('messengerPickName').value = ''; pickFind.value = '';
    // the people I talked with lately first (their rooms' last line), the rest after in name order
    const lately = new Map(); for (const r of state.rooms) for (const m of r.members || []) { const at = Date.parse(r.last?.at || r.lastAt || '') || 0; if (m.id !== state.me && at > (lately.get(m.id) || 0)) lately.set(m.id, at); }
    const people = state.people.filter((p) => !inRoom.has(p.id)).sort((a, b) => (lately.get(b.id) || 0) - (lately.get(a.id) || 0) || a.label.localeCompare(b.label, 'ko'));
    pickRows = people.map((p) => {
      const li = document.createElement('li'); const b = document.createElement('button'); b.type = 'button'; b.className = 'messengerPerson'; b.setAttribute('aria-pressed', 'false');
      const name = document.createElement('span'); name.className = 'messengerPersonName'; name.textContent = p.label;
      const mark = document.createElement('span'); mark.className = 'messengerPersonMark'; mark.setAttribute('aria-hidden', 'true');
      b.append(avatarOf(p.label), name, mark); b.addEventListener('click', () => togglePerson(p)); li.append(b); return { p, li, b };
    });
    peopleBox.replaceChildren(...pickRows.map((r) => r.li));
    if (!people.length) peopleBox.innerHTML = '<li class="smallMuted messengerPeopleNone">함께할 수 있는 사람이 없습니다. 메신저는 관리자가 허용한 계정끼리 씁니다.</li>';
    drawPicked(); app.classList.add('picking'); pick.classList.remove('hidden'); peopleBox.scrollTop = 0;
    if (people.length) pickFind.focus();
  }
  pickFind.addEventListener('input', filterPeople);
  pickFind.addEventListener('keydown', (e) => { if (e.key !== 'Enter') return; e.preventDefault(); const first = pickRows.find((r) => !r.li.hidden); if (first && pickFind.value.trim()) { togglePerson(first.p); pickFind.value = ''; filterPeople(); } }); // (Enter in the find box: the first one shown, not the form)
  function hidePick() { picking = null; chosen = []; pickRows = []; app.classList.remove('picking'); pick.classList.add('hidden'); }
  pick.addEventListener('submit', async (event) => {
    event.preventDefault();
    const members = chosen.map((p) => p.id); if (!members.length) return;
    try {
      if (picking === 'new') { const data = await api('/api/messenger/rooms', { name: byId('messengerPickName').value.trim() || roomNameOf(chosen.map((p) => p.label)), members }); hidePick(); await refresh(); openRoom(data.room); }
      else if (picking === 'dm') { const data = await api('/api/messenger/dm', { with: members[0] }); hidePick(); await refresh(); openRoom(data.room); }
      else { await api(`/api/messenger/rooms/${current.id}/members`, { members }); hidePick(); pull(); refresh(); }
    } catch (err) { fail(err); }
  });
  byId('messengerPickCancel').addEventListener('click', hidePick);
  byId('messengerNewBtn').addEventListener('click', () => showPick('new'));
  byId('messengerDmBtn').addEventListener('click', () => showPick('dm'));
  byId('messengerInviteBtn').addEventListener('click', () => current && showPick('invite'));
  byId('messengerRenameBtn').addEventListener('click', async () => {
    const room = current; if (!room) return; const name = (await ask({ text: '새 방 이름 (20자)', ok: '바꾸기', value: room.name }))?.trim(); if (!name || current !== room) return;
    try { await api(`/api/messenger/rooms/${room.id}/name`, { name }); pull(); refresh(); } catch (err) { fail(err); }
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
    const room = current; if (!room || !await ask({ text: `「${room.name}」에서 나갈까요?\n나가면 대화 내용이 모두 사라지고 다시 초대받아야 들어올 수 있습니다.`, ok: '나가기', danger: true }) || current !== room) return;
    try { await api(`/api/messenger/rooms/${room.id}/leave`, {}); current = null; app.classList.remove('inRoom'); clearBox(); refresh(); } catch (err) { fail(err); }
  });
  // (v1.10.247 G2: a touch on 보내기 leaves the focus in the box -- the keypad stays, as in a chat app; a mouse as before)
  byId('messengerForm').querySelector('button[type="submit"]').addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') e.preventDefault(); });
  byId('messengerForm').addEventListener('submit', async (event) => {
    event.preventDefault(); const input = byId('messengerInput'); const text = input.value.trim(); if ((!text && !tray.length) || !current) return;
    input.value = ''; grow(); const photos = tray; tray = []; drawTray(); queueSend(text, photos); // (v1.10.233: at once -- the answer confirms it)
  });
  // 메신저 다듬기 B3 여러 줄: the box grows with the words (up to 5 lines, then it scrolls; 500 letters); a PC sends with Enter
  // (Shift+Enter a new line), a phone's Enter is a new line and 보내기 sends; never while a Korean letter is being put together
  { const input = byId('messengerInput'); const phone = window.matchMedia?.('(hover: none) and (pointer: coarse)');
    input.addEventListener('input', grow);
    input.addEventListener('keydown', (e) => { if (e.key !== 'Enter' || e.shiftKey || e.isComposing || e.keyCode === 229 || phone?.matches) return; e.preventDefault(); byId('messengerForm').requestSubmit(); }); }

  // (12절) ?open=web+gcmessenger:<room id> (the protocol's link, its %s): the room in it, or none for 「open」
  const roomOfOpen = (href) => { try { const v = new URL(href, location.href).searchParams.get('open') || ''; const m = /^web\+gcmessenger:(?:\/\/)?([0-9A-Za-z_-]{6,64})$/.exec(v); return m && m[1] !== 'open' ? m[1] : null; } catch { return null; } };
  // ---- 로그인 (④ 이 기기에서 로그인 유지) ----
  async function start() {
    if (!accountToken.get() && !deviceToken.get()) { showLogin(); return; }
    if (!await refresh()) return;
    loginForm.classList.add('hidden'); app.classList.remove('hidden'); byId('mLogoutBtn').classList.remove('hidden');
    byId('mDevicesBtn').classList.toggle('hidden', !deviceToken.get());
    wantStream(true); timers = [setInterval(() => { if (!streamUp) pull(); }, 3000), setInterval(() => refresh(), 30000)];
    const room = new URLSearchParams(location.search).get('room') || roomOfOpen(location.href); const r = room && state.rooms.find((x) => x.id === room); if (r) openRoom(r); // (a notice tapped; the 서랍's 「메신저 앱으로 열기」)
    // (opened by web+gcmessenger:) the 서랍 that asked is told the app is up -- as an app or a tab -- and closes its own tab
    const launched = () => { try { new BroadcastChannel('gc-messenger').postMessage({ type: 'gc-messenger-app', app: Boolean(window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone) }); } catch {} };
    if (new URLSearchParams(location.search).has('open')) launched();
    try { window.launchQueue?.setConsumer((p) => { if (p?.targetURL && new URL(p.targetURL).searchParams.has('open')) launched(); const id = p?.targetURL && (new URL(p.targetURL).searchParams.get('room') || roomOfOpen(p.targetURL)); /* (Codex 251-260 #2: ?room= too) */ const x = id && state.rooms.find((y) => y.id === id); if (x) openRoom(x); }); } catch {} // (the app already open: focused, told the room)
    if (!EMBED) setupPush(); // (12절: notices are the messenger app's)
  }
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault(); byId('mLoginStatus').textContent = '';
    try {
      const data = await api('/api/account/login', { loginId: byId('mLoginId').value, password: byId('mLoginPw').value, keep: byId('mKeep').checked, device: deviceName(), deviceKind: deviceKind() });
      byId('mLoginPw').value = '';
      if (!data.account.messenger) { byId('mLoginStatus').textContent = '메신저는 관리자가 허용한 계정만 쓸 수 있습니다.'; return; }
      accountToken.set(data.accountToken); deviceToken.set(data.deviceToken || '');
      start();
    } catch (err) { byId('mLoginStatus').textContent = err.message; }
  });
  // (12절, 검토) a phone or a PC by the screen, not the name: a phone's 「데스크톱 사이트」 says Linux or Mac with touch -- a
  // Windows touch laptop stays a PC
  const deviceKind = () => { const ua = navigator.userAgent; return /Mobi|Android|iPhone|iPad/.test(ua) || ((navigator.maxTouchPoints || 0) > 1 && /Macintosh|Linux/.test(ua)) ? 'phone' : 'pc'; };
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
      byId('mDeviceList').replaceChildren(...devices.map((d) => { const li = document.createElement('li'); li.textContent = `${d.name || '기기'} · ${new Date(d.at).toLocaleDateString('ko-KR')}${d.mine ? ' (이 기기)' : ''}${d.game ? ' · 게임·메신저' : ''}`; if (!d.mine) { const b = document.createElement('button'); b.type = 'button'; b.className = 'ghost tiny'; b.textContent = '끊기'; b.addEventListener('click', async () => { await api('/api/messenger/devices/drop', { id: d.id }).catch(fail); li.remove(); }); li.append(' ', b); } return li; }));
    } catch (err) { fail(err); }
  });
  byId('mDropOthers').addEventListener('click', async () => { try { await api('/api/messenger/devices/drop', { all: true }); byId('mDevices').classList.add('hidden'); showToast('다른 기기의 로그인을 모두 끊었어요.'); } catch (err) { fail(err); } });

  // ---- ③ 알림 (Web Push, the app's worker) ----
  // 다음 메신저 묶음 (docs/messenger-speed-photo-20261103.md 10절) 알림 방식, 기기마다: 「열어 둘 때만」 (a PC's default) -- no push
  // subscription, the page's own notice (popNew) while the window is open, minimised or behind another too, nothing once
  // it is shut; 「닫아도 받기」 (a phone's default) -- the push subscription as before; 「안 받기」. The choice is the device's
  // (server), the login kept as before. Either way the browser's permission is needed once (「알림 켜기」 asks).
  let pushReg = null; let pushOn = false; let pushKey = null; let alertMode = 'off';
  const keyBytes = (b64) => { const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64.length % 4)) % 4)); return Uint8Array.from(s, (c) => c.charCodeAt(0)); };
  const alertSel = byId('mAlert');
  const granted = () => typeof Notification !== 'undefined' && Notification.permission === 'granted';
  const browserSub = () => pushReg?.pushManager?.getSubscription().catch(() => null) ?? Promise.resolve(null);
  function drawAlert() { // the select as the device's way; 「알림 켜기」 while the browser has not allowed notices yet
    alertSel.value = alertMode; byId('mAlertPick').classList.remove('hidden');
    alertSel.querySelector('[value="push"]').disabled = !pushKey || !('PushManager' in window); // (no VAPID on the server, no push in this browser: only while open)
    byId('mPushBtn').classList.toggle('hidden', alertMode === 'off' || granted());
  }
  async function setupPush() {
    if (!('serviceWorker' in navigator) || !deviceToken.get()) return;
    try {
      // (메신저 3절 2) the app's own worker (sw.js, scope /) takes the push: an icon badge set by a worker reaches only the apps
      // inside its scope -- the old /messenger worker's never reached the island app's icon. Its subscription moves over.
      pushReg = await navigator.serviceWorker.register('/sw.js');
      const old = (await navigator.serviceWorker.getRegistrations()).find((r) => new URL(r.scope).pathname === '/messenger');
      const { key, on, mode, moved } = await api('/api/messenger/push'); pushKey = key || null; alertMode = mode || 'off';
      // (Codex 검토 5차 P2-2) the old one let go only once the new one and its record stand -- a failed move keeps the old,
      // tried again next time. (10절: a device not on 닫아도 받기 wants no subscription at all -- the old one just goes)
      const oldSub = old ? await old.pushManager.getSubscription().catch(() => null) : null;
      const kept = oldSub && granted() && alertMode === 'push' && pushKey && !(await subscribe(pushKey).then(() => true, () => false));
      if (old && !kept) { await oldSub?.unsubscribe().catch(() => {}); await old.unregister().catch(() => {}); }
      if (alertMode !== 'push') { const sub = await browserSub(); if (sub) await sub.unsubscribe().catch(() => {}); } // (열어 둘 때만 / 안 받기: nothing left in the browser either)
      else if (granted() && pushKey) await subscribe(pushKey).catch(() => {}); // (닫아도 받기 and allowed: made now, or the one there sent again -- 검토 2026-11-06: a new login is a new device, and the subscription moves to it)
      pushOn = alertMode === 'push' && granted() && Boolean(await browserSub()); void on;
      drawAlert();
      if (moved) showToast('이 PC는 「열어 둘 때만」 알림으로 바뀌었어요. 창을 닫아도 받으려면 위 「알림」에서 「닫아도 받기」를 고르세요.', 7000);
    } catch {}
  }
  async function pushOff() { const sub = await browserSub(); if (sub) await sub.unsubscribe(); await api('/api/messenger/push/off', {}); pushOn = false; }
  async function subscribe(key) {
    await navigator.serviceWorker.ready;
    const sub = (await pushReg.pushManager.getSubscription()) || await pushReg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
    const j = sub.toJSON(); await api('/api/messenger/push', { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }); pushOn = true; // (the server: this device on 닫아도 받기)
  }
  const ALERT_SAID = { open: '창을 열어 둔 동안만 새 메시지를 알려 드려요.', push: '창을 닫아도 새 메시지를 알려 드려요.', off: '이 기기의 알림을 껐어요.' };
  async function askPermission() { if (granted()) return true; if (await Notification.requestPermission() === 'granted') return true; showToast('브라우저에서 알림이 막혀 있어요. 사이트 설정에서 허용해 주세요.', 5000); return false; }
  async function chooseAlert(want) {
    const before = alertMode;
    try {
      if (want !== 'off' && !(await askPermission())) { drawAlert(); return; }
      if (want === 'push') await subscribe(pushKey); // (its answer sets the device to 닫아도 받기)
      else { const sub = await browserSub(); if (sub) await sub.unsubscribe().catch(() => {}); await api('/api/messenger/alert', { mode: want }); pushOn = false; }
      alertMode = want; drawAlert(); showToast(ALERT_SAID[want]);
    } catch (err) { // (Codex 10판 ④: the subscription may be gone already -- the select shows the server's way, not the old one)
      alertMode = before; try { alertMode = (await api('/api/messenger/push')).mode || before; pushOn = alertMode === 'push' && Boolean(await browserSub()); } catch {}
      drawAlert(); showToast(err.message || '알림 방식을 바꾸지 못했어요.', 4000); }
  }
  alertSel.addEventListener('change', () => chooseAlert(alertSel.value));
  byId('mPushBtn').addEventListener('click', async () => { // (the browser's permission, then the device's way as chosen)
    /* (Codex 261-270 #1: tried everywhere -- only when it fails where it may be the island app's window, where to turn it on) */
    const elsewhere = () => { if (!window.MessengerAlert?.pushElsewhere({ install, standalone: standalone(), appSeen })) return false; showToast('알림은 크롬이나 메신저 앱에서 켤 수 있어요.', 4000); chromeLine('알림은 크롬이나 메신저 앱에서 켤 수 있어요'); return true; };
    try { if (!(await askPermission())) { elsewhere(); return; } if (alertMode === 'push') await subscribe(pushKey); drawAlert(); showToast(ALERT_SAID[alertMode]); } catch (err) { if (!elsewhere()) showToast(err.message || '알림을 켜지 못했어요.', 4000); }
  });
  // (10절 ①) 메신저만 따로 설치: the browser's own install prompt, when it offers one (not inside an installed window)
  let installPrompt = null; const standalone = () => Boolean(window.matchMedia?.('(display-mode: standalone)').matches);
  const install = new URLSearchParams(location.search).get('install'); /* (Codex 251-260 #16, v1.10.263: '1' from the island app's fallback, 'chrome' in Chrome itself) */
  window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); installPrompt = event; byId('mChromeInstall').classList.add('hidden'); if (standalone() && install !== '1') return; const b = byId('mInstallBtn'); b.classList.remove('hidden'); if (install) { b.classList.replace('secondary', 'primary'); b.focus({ preventScroll: true }); } });
  byId('mInstallBtn').addEventListener('click', async () => { if (!installPrompt) return; installPrompt.prompt(); await installPrompt.userChoice.catch(() => {}); installPrompt = null; byId('mInstallBtn').classList.add('hidden'); });
  window.addEventListener('appinstalled', () => { byId('mInstallBtn').classList.add('hidden'); byId('mChromeInstall').classList.add('hidden'); });
  // the Chrome line: install=1 at once (no waiting: the fallback comes only when there is no messenger app), else after 3 s
  // with no prompt; the values it was decided on kept on it and in the console (a phone where it fails tells why)
  const LINE_OFF = 'gc.messengerChromeLineOff'; let lineOff = false; try { lineOff = localStorage.getItem(LINE_OFF) === 'off'; } catch {}
  // (v1.10.267 총괄) the messenger app opened here (its own window at its start_url): the day kept -- the island's 서랍, the same
  // Chrome profile and origin, then no longer asks to install it; and the messenger app opened with install=1 is not taken for
  // the island app's window
  const APP_SEEN = 'gc.messengerApp'; let appSeen = false;
  try { if (!EMBED && standalone() && location.pathname === '/messenger') localStorage.setItem(APP_SEEN, new Date().toISOString().slice(0, 10)); appSeen = Boolean(localStorage.getItem(APP_SEEN)); } catch {}
  const copyAddress = async (url) => { try { await navigator.clipboard.writeText(url); showToast('주소를 복사했어요'); } catch { showToast(url, 8000); } }; /* (no clipboard: the address shown to copy by hand) */
  byId('mChromeInstallClose').addEventListener('click', () => { byId('mChromeInstall').classList.add('hidden'); try { localStorage.setItem(LINE_OFF, 'off'); } catch {} }); /* (v1.10.264: ✕ -- not again here; a true messenger app opened with install=1 may say it too) */
  const chromeLine = (note = null) => {
    const why = { ua: navigator.userAgent, standalone: standalone(), prompted: Boolean(installPrompt), install, appSeen }; const c = window.MessengerAlert?.chromeInstall({ ...why, origin: location.origin });
    const show = c ? (c.menuOnly ? 'menu' : 'copy') : 'none'; const box = byId('mChromeInstall'); box.dataset.why = JSON.stringify({ ...why, show }); console.info('[messenger install]', box.dataset.why);
    if (!c || (lineOff && !note)) return false; byId('mChromeInstallBtn').classList.toggle('hidden', Boolean(c.menuOnly)); byId('mChromeInstallText').textContent = note || c.line; box.classList.remove('hidden');
    if (c.copy) byId('mChromeInstallBtn').onclick = () => copyAddress(c.copy); return true;
  };
  if (!EMBED) { if (install === '1') chromeLine(); else setTimeout(() => chromeLine(), 3000); }
  navigator.serviceWorker?.addEventListener('message', (event) => { const r = state.rooms.find((x) => x.id === event.data?.room); if (r) openRoom(r); }); // (a notice tapped while open)
  { const sel = byId('mTheme'); sel.value = window.MessengerTheme?.get() || 'light'; sel.addEventListener('change', () => window.MessengerTheme?.set(sel.value)); } // (어두운 화면: messenger-theme.js)
  // (the game's window opens this one with its login: a new login there reaches an open messenger too)
  // (12절) the 서랍's head: ✕ (and Esc) tells the island app to close it; 「메신저 앱으로 열기 ↗」 opens /messenger.html in its own
  // window (Chrome takes it to the installed messenger app when there is one) with this tab's login; the one-line note on the
  // messenger app until it is closed
  if (EMBED) {
    const closeMe = () => { try { window.parent.postMessage({ type: 'gc-messenger-close' }, location.origin); } catch {} };
    byId('mCloseEmbed').addEventListener('click', closeMe);
    window.addEventListener('keydown', (event) => { if (event.key === 'Escape' && byId('mAsk').classList.contains('hidden') && byId('messengerViewer').classList.contains('hidden') && !document.querySelector('.messengerBubbleMenu') && byId('messengerMoreMenu').classList.contains('hidden') && pick.classList.contains('hidden')) closeMe(); }, true); /* (first, before the menus' own Esc: one open, Esc closes only it) */
    // (사용자 신고 2026-11-06: the island app's scope is / -- a window it opens on /messenger.html stays the island app's) the
    // messenger app by its own link, web+gcmessenger: (its manifest's protocol_handlers, the OS's once it is installed) with
    // the room open here; this window not left within 1.5 s (no app): a window as before
    // (사용자 「아일랜드 앱 말고 크롬으로 열리게」) one Chrome tab, opened in the click (a blank one is outside the island app's
    // scope -- 10/25's 「섬 앱에서 누르면 크롬으로 열려」 the other way round), sent to web+gcmessenger:; the messenger app, if it
    // opens, says so on the channel (as an app) -- the tab closed then; else the tab goes on to the messenger, the login by the
    // channel as before. Never a second tab, never the island app's window.
    byId('mOpenApp').addEventListener('click', () => {
      const room = current?.id || '';
      const intent = window.MessengerAlert?.appIntent(navigator.userAgent, location.origin, room); /* (v1.10.258 Android: no protocol_handlers there -- the OS picks the messenger app) */
      if (intent) { window.open(intent, '_blank'); setTimeout(() => { try { new BroadcastChannel('gc-messenger').postMessage({ account: accountToken.get() }); } catch {} }, 1500); return; }
      const w = window.open('', '_blank'); if (!w) return;
      try { w.opener = null; } catch {}
      let app = false; let ch = null; try { ch = new BroadcastChannel('gc-messenger'); ch.onmessage = (e) => { if (e.data?.type === 'gc-messenger-app' && e.data.app) app = true; }; } catch {}
      try { w.location.href = `web+gcmessenger:${room || 'open'}`; } catch {}
      setTimeout(() => {
        try { ch?.close(); } catch {}
        if (app) { try { w.close(); } catch {} return; }
        try { w.location.href = `/messenger.html${room ? `?room=${encodeURIComponent(room)}` : ''}`; w.focus(); } catch {}
        setTimeout(() => { try { new BroadcastChannel('gc-messenger').postMessage({ account: accountToken.get() }); } catch {} }, 800);
      }, 2000);
    });
    const HINT = 'gc.messengerInstallHint'; let off = false; try { off = localStorage.getItem(HINT) === 'off'; } catch {}
    byId('mInstallHint').classList.toggle('hidden', off || appSeen); /* (v1.10.267: the messenger app already opened on this device -- no more asking) */
    { const android = /Android/i.test(navigator.userAgent); /* (v1.10.267 총괄 「1번」: Chrome's intent opened in the island app's own window too -- the address copied instead, pasted in Chrome) */
      byId('mInstallHintChrome').classList.toggle('hidden', !android);
      if (android) { byId('mInstallHintText').textContent = window.MessengerAlert.COPY_LINE; byId('mInstallHintChrome').addEventListener('click', () => copyAddress(window.MessengerAlert.messengerUrl(location.origin))); } }
    byId('mInstallHintClose').addEventListener('click', () => { byId('mInstallHint').classList.add('hidden'); try { localStorage.setItem(HINT, 'off'); } catch {} });
  }
  try { new BroadcastChannel('gc-messenger').addEventListener('message', (event) => { if (event.data?.account && !accountToken.get() && !deviceToken.get()) { accountToken.set(event.data.account); start(); } }); } catch {}
  start();
})();
