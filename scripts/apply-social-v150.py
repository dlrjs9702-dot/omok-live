from pathlib import Path
import json

ROOT = Path.cwd()

def read(path):
    return (ROOT / path).read_text(encoding='utf-8')

def write(path, content):
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding='utf-8')

def replace_once(content, old, new, label):
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly 1 match, found {count}')
    return content.replace(old, new, 1)

write('lib/room-social.js', r'''\'use strict\';

const MAX_CHAT_MESSAGES = 100;
const MAX_CHAT_LENGTH = 300;

function createRoomSocial() {
  return { messages: [], nextId: 1 };
}

function ensureSocial(room) {
  if (!room.social) room.social = createRoomSocial();
  return room.social;
}

function pushMessage(room, message) {
  const social = ensureSocial(room);
  const row = {
    id: social.nextId++,
    type: message.type === 'system' ? 'system' : 'chat',
    label: String(message.label || '').slice(0, 40),
    text: String(message.text || '').slice(0, MAX_CHAT_LENGTH),
    at: new Date().toISOString(),
  };
  social.messages.push(row);
  if (social.messages.length > MAX_CHAT_MESSAGES) {
    social.messages.splice(0, social.messages.length - MAX_CHAT_MESSAGES);
  }
  return row;
}

function appendSystemMessage(room, text) {
  return pushMessage(room, { type: 'system', text });
}

function appendChatMessage(room, session, text) {
  return pushMessage(room, {
    type: 'chat',
    label: session.label || '게스트',
    text,
  });
}

function publicChatMessages(room) {
  const social = ensureSocial(room);
  return social.messages.map(({ id, type, label, text, at }) => ({ id, type, label, text, at }));
}

module.exports = {
  MAX_CHAT_LENGTH,
  createRoomSocial,
  appendSystemMessage,
  appendChatMessage,
  publicChatMessages,
};
''')

write('test/room-social.test.js', r'''const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MAX_CHAT_LENGTH,
  createRoomSocial,
  appendSystemMessage,
  appendChatMessage,
  publicChatMessages,
} = require('../lib/room-social');

test('room chat is memory-only, bounded and safe for public output', () => {
  const room = { social: createRoomSocial() };
  appendSystemMessage(room, '방이 열렸습니다.');
  appendChatMessage(room, { label: '우성' }, '안녕하세요');
  let rows = publicChatMessages(room);
  assert.equal(rows.length, 2);
  assert.deepEqual(Object.keys(rows[1]), ['id', 'type', 'label', 'text', 'at']);
  assert.equal(rows[1].label, '우성');
  assert.equal(rows[1].text, '안녕하세요');

  appendChatMessage(room, { label: '길이' }, '가'.repeat(MAX_CHAT_LENGTH + 50));
  rows = publicChatMessages(room);
  assert.equal(rows.at(-1).text.length, MAX_CHAT_LENGTH);

  for (let i = 0; i < 120; i += 1) appendChatMessage(room, { label: '테스트' }, String(i));
  rows = publicChatMessages(room);
  assert.equal(rows.length, 100);
});
''')

server = read('server.js')
server = replace_once(server,
"const { createAccessStore } = require('./lib/access-store');\n",
"const { createAccessStore } = require('./lib/access-store');\nconst {\n  MAX_CHAT_LENGTH,\n  createRoomSocial,\n  appendSystemMessage,\n  appendChatMessage,\n  publicChatMessages,\n} = require('./lib/room-social');\n",
'server room-social import')

server = replace_once(server, r'''function makeRoom(hostSession) {
  let code;
  do code = generateRoomCode(); while ([...rooms.values()].some((r) => r.code === code));
  const id = newSecret(12);
  const t = nowIso();
  return {
    id,
    code,
    createdAt: t,
    updatedAt: t,
    hostSessionToken: hostSession.token,
    participants: { [hostSession.token]: newParticipant(hostSession, false) },
    players: { black: null, white: null },
    game: makeInitialGame(),
  };
}
''', r'''function makeRoom(hostSession) {
  let code;
  do code = generateRoomCode(); while ([...rooms.values()].some((r) => r.code === code));
  const id = newSecret(12);
  const t = nowIso();
  const room = {
    id,
    code,
    gameType: 'omok',
    createdAt: t,
    updatedAt: t,
    hostSessionToken: hostSession.token,
    participants: { [hostSession.token]: newParticipant(hostSession, false) },
    players: { black: null, white: null },
    social: createRoomSocial(),
    game: makeInitialGame(),
  };
  appendSystemMessage(room, (hostSession.label || '방장') + '님이 방을 만들었습니다.');
  return room;
}
''', 'server makeRoom')

server = replace_once(server, r'''function registerParticipant(room, session) {
  if (!room.participants[session.token]) room.participants[session.token] = newParticipant(session, true);
  const p = room.participants[session.token];
  p.connected = true;
  p.lastSeen = nowIso();
  if (room.game.status !== 'selecting' && !findSeat(room, session.token)) p.choice = 'spectator';
  return p;
}
''', r'''function registerParticipant(room, session) {
  const isNew = !room.participants[session.token];
  if (isNew) room.participants[session.token] = newParticipant(session, true);
  const p = room.participants[session.token];
  p.label = session.label;
  p.connected = true;
  p.lastSeen = nowIso();
  if (room.game.status !== 'selecting' && !findSeat(room, session.token)) p.choice = 'spectator';
  if (isNew) appendSystemMessage(room, (session.label || '게스트') + '님이 입장했습니다.');
  return p;
}
''', 'server registerParticipant')

server = replace_once(server, r'''function publicPlayer(room, color) {
  const token = room.players[color];
  if (!token) return null;
  const p = room.participants[token];
  return { connected: Boolean(p?.connected) };
}
''', r'''function publicPlayer(room, color) {
  const token = room.players[color];
  if (!token) return null;
  const p = room.participants[token];
  return { label: p?.label || '게스트', connected: Boolean(p?.connected) };
}
''', 'server publicPlayer')

server = replace_once(server, r'''function liveSpectatorCount(room) {
  const live = uniqueLiveTokens(room.id);
  let count = 0;
  for (const token of live) {
    if (room.players.black === token || room.players.white === token) continue;
    count += 1;
  }
  return count;
}
''', r'''function liveSpectatorCount(room) {
  const live = uniqueLiveTokens(room.id);
  let count = 0;
  for (const token of live) {
    if (room.players.black === token || room.players.white === token) continue;
    count += 1;
  }
  return count;
}

function publicParticipants(room) {
  const live = uniqueLiveTokens(room.id);
  return Object.values(room.participants)
    .filter((p) => p.connected || live.has(p.sessionToken))
    .map((p) => ({
      label: p.label || '게스트',
      connected: Boolean(p.connected || live.has(p.sessionToken)),
      seat: findSeat(room, p.sessionToken),
      choice: p.choice || null,
      isHost: room.hostSessionToken === p.sessionToken,
    }))
    .sort((a, b) => Number(b.isHost) - Number(a.isHost) || a.label.localeCompare(b.label, 'ko'));
}
''', 'server publicParticipants')

server = replace_once(server, r'''  return {
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    connectedCount: live.size,
    spectatorCount: liveSpectatorCount(room),
    players: {
''', r'''  return {
    gameType: room.gameType || 'omok',
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    connectedCount: live.size,
    spectatorCount: liveSpectatorCount(room),
    participants: publicParticipants(room),
    chat: { messages: publicChatMessages(room) },
    players: {
''', 'server publicRoom envelope')

server = replace_once(server, r'''    me: {
      isHost,
      seat,
      choice: p?.choice || null,
''', r'''    me: {
      label: session.label,
      isHost,
      seat,
      choice: p?.choice || null,
''', 'server roomView me label')

server = replace_once(server, r'''function invalidateGuestSessions(guestKeyId) {
  for (const [token, session] of [...sessions]) {
    if (session.guestKeyId !== guestKeyId) continue;
    releaseSessionToken(token, { message: '이 입장 파일의 권한이 취소되었습니다.' });
  }
  activeGuestSessions.delete(guestKeyId);
}
''', r'''function invalidateGuestSessions(guestKeyId) {
  for (const [token, session] of [...sessions]) {
    if (session.guestKeyId !== guestKeyId) continue;
    releaseSessionToken(token, { message: '이 입장 파일의 권한이 취소되었습니다.' });
  }
  activeGuestSessions.delete(guestKeyId);
}

function guestPresence(guestKeyId) {
  if (!guestKeyInUse(guestKeyId)) return { online: false, inRoom: false };
  const token = activeGuestSessions.get(guestKeyId);
  const session = token ? sessions.get(token) : null;
  return {
    online: Boolean(session),
    inRoom: Boolean(session && getCurrentRoom(session)),
  };
}
''', 'server guestPresence')

server = replace_once(server, r'''  if (pathname === '/api/admin/keys' && req.method === 'GET') {
    if (!requireAdmin(req, res)) return;
    return sendJson(res, 200, { keys: await accessStore.list(), persistence: DATABASE_URL ? 'database' : 'ephemeral-file' });
  }
''', r'''  if (pathname === '/api/admin/keys' && req.method === 'GET') {
    if (!requireAdmin(req, res)) return;
    const keys = (await accessStore.list()).map((key) => ({ ...key, presence: guestPresence(key.id) }));
    return sendJson(res, 200, { keys, persistence: DATABASE_URL ? 'database' : 'ephemeral-file' });
  }
''', 'server admin key presence')

server = replace_once(server, r'''  if (pathname === '/api/room/leave' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    const room = getCurrentRoom(session);
    session.currentRoomId = null;
    if (room?.participants[session.token]) {
      room.participants[session.token].connected = false;
      room.participants[session.token].lastSeen = nowIso();
      touchRoom(room);
      broadcast(room);
    }
    return sendJson(res, 200, { ok: true });
  }
''', r'''  if (pathname === '/api/room/leave' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    const room = getCurrentRoom(session);
    session.currentRoomId = null;
    if (room?.participants[session.token]) {
      room.participants[session.token].connected = false;
      room.participants[session.token].lastSeen = nowIso();
      appendSystemMessage(room, (session.label || '게스트') + '님이 방에서 나갔습니다.');
      touchRoom(room);
      broadcast(room);
    }
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/room/chat' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    const room = getCurrentRoom(session);
    if (!room) return sendError(res, 404, 'NO_ROOM', '현재 입장한 방이 없습니다.');
    const key = 'room-chat:' + session.token.slice(0, 12);
    if (!checkRateLimit(key, 6, 5 * 1000)) return sendError(res, 429, 'CHAT_RATE_LIMIT', '메시지를 너무 빠르게 보내고 있습니다. 잠시 후 다시 보내 주세요.');
    const body = await parseJson(req);
    const text = String(body.text || '').trim();
    if (!text) return sendError(res, 400, 'EMPTY_CHAT', '메시지를 입력해 주세요.');
    if (text.length > MAX_CHAT_LENGTH) return sendError(res, 400, 'CHAT_TOO_LONG', '채팅은 ' + MAX_CHAT_LENGTH + '자까지 입력할 수 있습니다.');
    appendChatMessage(room, session, text);
    touchRoom(room);
    broadcast(room);
    return sendJson(res, 200, { ok: true });
  }
''', 'server leave + chat endpoint')

server = server.replace("version: '1.4.2'", "version: '1.5.0'")
server = server.replace('오목 서버 v1.4.2 실행', '게임 서버 v1.5.0 실행')
write('server.js', server)

index = read('public/index.html').replace('v=1.4.2', 'v=1.5.0')
index = replace_once(index,
'''<label for="guestLabelInput">파일 이름</label>
            <input id="guestLabelInput" autocomplete="off" maxlength="40" placeholder="예: 우성_PC" required />''',
'''<label for="guestLabelInput">닉네임</label>
            <input id="guestLabelInput" autocomplete="off" maxlength="40" placeholder="예: 우성" required />''',
'index nickname field')
index = replace_once(index,
'사람·기기별로 파일을 따로 발급하세요. 파일 자체가 사이트 출입 열쇠이며, 파일 1개는 동시에 1명만 사용할 수 있습니다.',
'사람별 닉네임으로 입장 파일을 발급하세요. 이 닉네임은 접속자·플레이어·채팅 이름으로 사용되며, 파일 1개는 동시에 1명만 사용할 수 있습니다.',
'index admin description')
index = replace_once(index,
'''          <div class="sideActions">
''',
'''          <section class="roomPeople" aria-label="현재 접속자">
            <div class="sectionTitleRow"><h3>현재 접속자</h3><small>닉네임 기준</small></div>
            <div id="participantList" class="participantList"></div>
          </section>

          <section class="chatPanel" aria-label="방 채팅">
            <div class="sectionTitleRow"><h3>방 채팅</h3><small>방 종료 시 삭제</small></div>
            <div id="chatMessages" class="chatMessages" aria-live="polite"></div>
            <form id="chatForm" class="chatForm">
              <input id="chatInput" maxlength="300" autocomplete="off" placeholder="메시지 입력" aria-label="채팅 메시지" />
              <button class="secondary" type="submit">전송</button>
            </form>
          </section>

          <div class="sideActions">
''',
'index social panel')
write('public/index.html', index)

app = read('public/app.js')
app = replace_once(app,
'''  const spectatorCount = document.getElementById('spectatorCount');
  const toast = document.getElementById('toast');
''',
'''  const spectatorCount = document.getElementById('spectatorCount');
  const participantList = document.getElementById('participantList');
  const chatMessages = document.getElementById('chatMessages');
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');
  const toast = document.getElementById('toast');
''',
'app social element refs')
app = replace_once(app,
'''      small.textContent = `사용 가능 · ${used} · ${key.useCount || 0}회`;
''',
'''      const online = key.presence?.online ? (key.presence.inRoom ? '🟢 접속 중 · 방 참여 중' : '🟢 접속 중') : '⚫ 오프라인';
      small.textContent = `${online} · ${used} · ${key.useCount || 0}회`;
''',
'app guest presence')
app = replace_once(app,
'''  function setPlayerCard(el, color, player) {
    const small = el.querySelector('small');
    el.classList.toggle('occupied', Boolean(player));
    el.classList.toggle('disconnected', Boolean(player && !player.connected));
    if (!player) small.textContent = '선택 가능';
    else small.textContent = player.connected ? '접속 중' : '연결 끊김';
    el.classList.toggle('mySeat', seat === color);
  }
''',
'''  function setPlayerCard(el, color, player) {
    const small = el.querySelector('small');
    el.classList.toggle('occupied', Boolean(player));
    el.classList.toggle('disconnected', Boolean(player && !player.connected));
    if (!player) small.textContent = '선택 가능';
    else small.textContent = `${player.label || '게스트'} · ${player.connected ? '접속 중' : '연결 끊김'}`;
    el.classList.toggle('mySeat', seat === color);
  }

  function participantRoleText(p) {
    if (p.seat === 'black') return '흑';
    if (p.seat === 'white') return '백';
    if (p.choice === 'spectator') return '관전';
    return '역할 선택 중';
  }

  function renderParticipants() {
    participantList.innerHTML = '';
    const people = state?.participants || [];
    if (!people.length) {
      const empty = document.createElement('span');
      empty.className = 'participantEmpty';
      empty.textContent = '접속자가 없습니다.';
      participantList.appendChild(empty);
      return;
    }
    for (const person of people) {
      const chip = document.createElement('div');
      chip.className = 'participantChip';
      const dot = document.createElement('span');
      dot.className = `presenceDot${person.connected ? ' online' : ''}`;
      const name = document.createElement('strong');
      name.textContent = person.label || '게스트';
      const role = document.createElement('small');
      role.textContent = `${person.isHost ? '방장 · ' : ''}${participantRoleText(person)}`;
      chip.append(dot, name, role);
      participantList.appendChild(chip);
    }
  }

  function renderChat() {
    const rows = state?.chat?.messages || [];
    chatMessages.innerHTML = '';
    if (!rows.length) {
      const empty = document.createElement('div');
      empty.className = 'chatEmpty';
      empty.textContent = '아직 메시지가 없습니다.';
      chatMessages.appendChild(empty);
      return;
    }
    for (const row of rows) {
      const item = document.createElement('div');
      item.className = `chatMessage ${row.type === 'system' ? 'system' : ''}`;
      if (row.type === 'system') {
        item.textContent = row.text;
      } else {
        const head = document.createElement('div');
        head.className = 'chatMessageHead';
        const who = document.createElement('strong');
        who.textContent = row.label || '게스트';
        const time = document.createElement('time');
        const d = new Date(row.at);
        time.textContent = Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
        head.append(who, time);
        const text = document.createElement('div');
        text.className = 'chatMessageText';
        text.textContent = row.text;
        item.append(head, text);
      }
      chatMessages.appendChild(item);
    }
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
''',
'app social renderers')
app = replace_once(app,
'''    setPlayerCard(blackPlayer, 'black', state.players.black);
    setPlayerCard(whitePlayer, 'white', state.players.white);
    renderRoleChooser();
''',
'''    setPlayerCard(blackPlayer, 'black', state.players.black);
    setPlayerCard(whitePlayer, 'white', state.players.white);
    renderParticipants();
    renderChat();
    renderRoleChooser();
''',
'app render social')
app = replace_once(app,
'''  async function copyRoomCode() {
''',
'''  async function sendChat(event) {
    event.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;
    chatInput.disabled = true;
    try {
      await api('/api/room/chat', {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
      chatInput.value = '';
    } catch (err) {
      showToast(err.message, 3500);
    } finally {
      chatInput.disabled = false;
      chatInput.focus();
    }
  }

  async function copyRoomCode() {
''',
'app send chat')
app = replace_once(app,
'''  issueFileForm.addEventListener('submit', issueFile);
  copyRoomCodeBtn.addEventListener('click', copyRoomCode);
''',
'''  issueFileForm.addEventListener('submit', issueFile);
  chatForm.addEventListener('submit', sendChat);
  copyRoomCodeBtn.addEventListener('click', copyRoomCode);
''',
'app chat binding')
write('public/app.js', app)

css = read('public/styles.css')
css = replace_once(css, 'grid-template-columns:minmax(0,1fr) 300px', 'grid-template-columns:minmax(0,1fr) 350px', 'css sidebar width')
css += r'''
.sectionTitleRow{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-top:20px}.sectionTitleRow h3{margin:0}.sectionTitleRow small{color:#64748b;font-size:.72rem}.roomPeople{padding-top:2px}.participantList{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.participantChip{display:grid;grid-template-columns:8px auto;column-gap:7px;align-items:center;background:#0f172a;border:1px solid #263246;border-radius:12px;padding:8px 10px;min-width:0}.participantChip strong{font-size:.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.participantChip small{grid-column:2;color:#94a3b8;font-size:.68rem;margin-top:2px}.presenceDot{width:8px;height:8px;border-radius:50%;background:#475569}.presenceDot.online{background:#22c55e;box-shadow:0 0 0 3px rgba(34,197,94,.12)}.participantEmpty,.chatEmpty{color:#64748b;font-size:.78rem;padding:8px 0}.chatPanel{margin-top:18px;padding-top:18px;border-top:1px solid #263246}.chatMessages{height:260px;overflow-y:auto;background:#0b1324;border:1px solid #263246;border-radius:14px;padding:10px;margin-top:10px;scrollbar-width:thin}.chatMessage{padding:8px 7px;border-bottom:1px solid rgba(51,65,85,.45)}.chatMessage:last-child{border-bottom:0}.chatMessage.system{color:#94a3b8;font-size:.75rem;text-align:center;padding:7px 4px}.chatMessageHead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:4px}.chatMessageHead strong{font-size:.8rem;color:#e2e8f0}.chatMessageHead time{font-size:.65rem;color:#64748b}.chatMessageText{font-size:.84rem;color:#f8fafc;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere}.chatForm{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;margin-top:9px}.chatForm input{min-width:0;border:1px solid #334155;border-radius:11px;padding:10px 11px;background:#0f172a;color:#fff;outline:none}.chatForm input:focus{border-color:#60a5fa;box-shadow:0 0 0 3px rgba(96,165,250,.12)}@media(max-width:880px){.chatMessages{height:230px}.participantChip{flex:1 1 130px}}
'''
write('public/styles.css', css)

pkg = json.loads(read('package.json'))
pkg['version'] = '1.5.0'
pkg['description'] = '입장 파일 + 닉네임 + 방 채팅 기반 실시간 보드게임 서버'
write('package.json', json.dumps(pkg, ensure_ascii=False, indent=2) + '\n')

print('Applied social/chat upgrade v1.5.0')
