from pathlib import Path

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
        raise RuntimeError(f'{label}: expected 1 match, found {count}')
    return content.replace(old, new, 1)

# ---- server: in-memory lobby chat + lobby-only SSE ----
server = read('server.js')
server = replace_once(server,
"""const streams = new Map(); // roomId -> Set<{res, sessionToken}>\nconst rateLimits = new Map();\n""",
"""const streams = new Map(); // roomId -> Set<{res, sessionToken}>\nconst lobbyStreams = new Set(); // Set<{res, sessionToken}>\nconst lobbySocial = { social: createRoomSocial() }; // memory-only, never persisted\nconst LOBBY_CHAT_MESSAGES = 50;\nconst rateLimits = new Map();\n""",
'lobby globals')

server = replace_once(server,
"""  for (const [roomId, set] of streams) {\n    for (const entry of [...set]) {\n      if (entry.sessionToken !== token) continue;\n      try {\n        if (message) sseWrite(entry.res, 'sessionExpired', { message });\n        entry.res.end();\n      } catch {}\n      set.delete(entry);\n    }\n    if (!set.size) streams.delete(roomId);\n  }\n  return true;\n}\n""",
"""  for (const [roomId, set] of streams) {\n    for (const entry of [...set]) {\n      if (entry.sessionToken !== token) continue;\n      try {\n        if (message) sseWrite(entry.res, 'sessionExpired', { message });\n        entry.res.end();\n      } catch {}\n      set.delete(entry);\n    }\n    if (!set.size) streams.delete(roomId);\n  }\n  let lobbyChanged = false;\n  for (const entry of [...lobbyStreams]) {\n    if (entry.sessionToken !== token) continue;\n    try {\n      if (message) sseWrite(entry.res, 'sessionExpired', { message });\n      entry.res.end();\n    } catch {}\n    lobbyStreams.delete(entry);\n    lobbyChanged = true;\n  }\n  if (lobbyChanged) broadcastLobby();\n  return true;\n}\n""",
'release lobby stream')

server = replace_once(server,
"""function sseWrite(res, event, data) {\n  res.write(`event: ${event}\\n`);\n  res.write(`data: ${JSON.stringify(data)}\\n\\n`);\n}\n\nfunction uniqueLiveTokens(roomId) {\n""",
"""function sseWrite(res, event, data) {\n  res.write(`event: ${event}\\n`);\n  res.write(`data: ${JSON.stringify(data)}\\n\\n`);\n}\n\nfunction trimLobbyMessages() {\n  const messages = lobbySocial.social?.messages || [];\n  if (messages.length > LOBBY_CHAT_MESSAGES) {\n    messages.splice(0, messages.length - LOBBY_CHAT_MESSAGES);\n  }\n}\n\nfunction publicLobbyState() {\n  const liveTokens = new Set([...lobbyStreams].map((entry) => entry.sessionToken));\n  return {\n    connectedCount: liveTokens.size,\n    messages: publicChatMessages(lobbySocial).slice(-LOBBY_CHAT_MESSAGES),\n  };\n}\n\nfunction broadcastLobby() {\n  const state = publicLobbyState();\n  for (const entry of [...lobbyStreams]) {\n    const session = sessions.get(entry.sessionToken);\n    if (!session || session.currentRoomId) {\n      try { entry.res.end(); } catch {}\n      lobbyStreams.delete(entry);\n      continue;\n    }\n    try {\n      sseWrite(entry.res, 'lobbyState', state);\n    } catch {\n      lobbyStreams.delete(entry);\n    }\n  }\n}\n\nfunction uniqueLiveTokens(roomId) {\n""",
'lobby helpers')

server = replace_once(server,
"""  if (pathname === '/api/logout' && req.method === 'POST') {\n    const session = getSession(req, { touch: false });\n    if (session) releaseSessionToken(session.token);\n    return sendJson(res, 200, { ok: true });\n  }\n\n  if (pathname === '/api/admin/keys' && req.method === 'GET') {\n""",
"""  if (pathname === '/api/logout' && req.method === 'POST') {\n    const session = getSession(req, { touch: false });\n    if (session) releaseSessionToken(session.token);\n    return sendJson(res, 200, { ok: true });\n  }\n\n  if (pathname === '/api/lobby/chat' && req.method === 'POST') {\n    const session = requireSession(req, res);\n    if (!session) return;\n    if (getCurrentRoom(session)) return sendError(res, 409, 'IN_ROOM', '게임 방에서는 방 채팅을 이용해 주세요.');\n    const key = 'lobby-chat:' + session.token.slice(0, 12);\n    if (!checkRateLimit(key, 6, 5 * 1000)) return sendError(res, 429, 'CHAT_RATE_LIMIT', '메시지를 너무 빠르게 보내고 있습니다. 잠시 후 다시 보내 주세요.');\n    const body = await parseJson(req);\n    const text = String(body.text || '').trim();\n    if (!text) return sendError(res, 400, 'EMPTY_CHAT', '메시지를 입력해 주세요.');\n    if (text.length > MAX_CHAT_LENGTH) return sendError(res, 400, 'CHAT_TOO_LONG', '채팅은 ' + MAX_CHAT_LENGTH + '자까지 입력할 수 있습니다.');\n    appendChatMessage(lobbySocial, session, text);\n    trimLobbyMessages();\n    broadcastLobby();\n    return sendJson(res, 200, { ok: true });\n  }\n\n  if (pathname === '/api/lobby/events' && req.method === 'GET') {\n    const session = requireSession(req, res);\n    if (!session) return;\n    if (getCurrentRoom(session)) return sendError(res, 409, 'IN_ROOM', '현재 게임 방에 참여 중입니다.');\n    res.writeHead(200, securityHeaders({\n      'Content-Type': 'text/event-stream; charset=utf-8',\n      'Cache-Control': 'no-cache, no-transform',\n      'Connection': 'keep-alive',\n      'X-Accel-Buffering': 'no',\n    }));\n    res.write(': connected\\n\\n');\n    const entry = { res, sessionToken: session.token };\n    lobbyStreams.add(entry);\n    broadcastLobby();\n\n    const heartbeat = setInterval(() => {\n      const current = sessions.get(session.token);\n      if (!current || current.currentRoomId) {\n        try { res.end(); } catch {}\n        clearInterval(heartbeat);\n        return;\n      }\n      current.lastSeen = nowMs();\n      if (current.guestKeyId) current.leaseSeenAt = current.lastSeen;\n      res.write(': ping\\n\\n');\n    }, 15000);\n\n    req.on('close', () => {\n      clearInterval(heartbeat);\n      lobbyStreams.delete(entry);\n      broadcastLobby();\n    });\n    return;\n  }\n\n  if (pathname === '/api/admin/keys' && req.method === 'GET') {\n""",
'lobby routes')

server = server.replace("version: '1.6.1'", "version: '1.6.2'")
server = server.replace('게임 서버 v1.6.1 실행', '게임 서버 v1.6.2 실행')
write('server.js', server)

# ---- lobby UI ----
index = read('public/index.html')
index = replace_once(index,
"""        </article>\n      </section>\n    </section>\n\n    <section id=\"roomView\" class=\"room hidden\">\n""",
"""        </article>\n      </section>\n\n      <section class=\"card lobbyChatCard\" aria-label=\"대기방 채팅\">\n        <div class=\"lobbyChatHead\">\n          <div>\n            <p class=\"eyebrow\">LOBBY CHAT</p>\n            <h2>대기방 채팅</h2>\n            <p class=\"muted lobbyChatNote\">방에 들어가기 전 대화하는 공용 채팅입니다. 최근 50개만 임시 보관되며 서버가 재시작되면 모두 사라집니다.</p>\n          </div>\n          <div class=\"lobbyChatStatus\">\n            <span id=\"lobbyConnectionBadge\" class=\"badge\">연결 중</span>\n            <small id=\"lobbyConnectedCount\" class=\"smallMuted\">대기 0명</small>\n          </div>\n        </div>\n        <div id=\"lobbyChatMessages\" class=\"chatMessages lobbyChatMessages\"></div>\n        <form id=\"lobbyChatForm\" class=\"chatForm\">\n          <input id=\"lobbyChatInput\" type=\"text\" maxlength=\"300\" autocomplete=\"off\" placeholder=\"대기방에 메시지 보내기\" aria-label=\"대기방 메시지\" />\n          <button class=\"secondary\" type=\"submit\">보내기</button>\n        </form>\n      </section>\n    </section>\n\n    <section id=\"roomView\" class=\"room hidden\">\n""",
'lobby chat html')
index = index.replace('v=1.6.1', 'v=1.6.2')
write('public/index.html', index)

# ---- client behavior ----
app = read('public/app.js')
app = replace_once(app,
"""  const identityLabel = document.getElementById('identityLabel');\n  const roomIdentityLabel = document.getElementById('roomIdentityLabel');\n""",
"""  const identityLabel = document.getElementById('identityLabel');\n  const roomIdentityLabel = document.getElementById('roomIdentityLabel');\n  const lobbyChatMessages = document.getElementById('lobbyChatMessages');\n  const lobbyChatForm = document.getElementById('lobbyChatForm');\n  const lobbyChatInput = document.getElementById('lobbyChatInput');\n  const lobbyConnectionBadge = document.getElementById('lobbyConnectionBadge');\n  const lobbyConnectedCount = document.getElementById('lobbyConnectedCount');\n""",
'lobby dom refs')

app = replace_once(app,
"""  let streamController = null;\n  let streamRetryTimer = null;\n  let hover = null;\n""",
"""  let streamController = null;\n  let streamRetryTimer = null;\n  let lobbyStreamController = null;\n  let lobbyStreamRetryTimer = null;\n  let lobbyState = { messages: [], connectedCount: 0 };\n  let hover = null;\n""",
'lobby client state')

app = replace_once(app,
"""  function expireSession(message = '입장 세션이 만료되었습니다. 다시 입장해 주세요.') {\n    stopStream();\n    sessionToken = '';\n""",
"""  function expireSession(message = '입장 세션이 만료되었습니다. 다시 입장해 주세요.') {\n    stopStream();\n    stopLobbyStream();\n    sessionToken = '';\n""",
'expire lobby stream')

app = replace_once(app,
"""      const room = await api('/api/room');\n      if (room.state) enterRoomState(room.state);\n      else showView('lobby');\n""",
"""      const room = await api('/api/room');\n      if (room.state) enterRoomState(room.state);\n      else enterLobby();\n""",
'load lobby')

app = replace_once(app,
"""    state = null;\n    document.title = '게임센터';\n    showView('lobby');\n    if (sessionRole === 'admin') loadGuestKeys().catch(() => {});\n  }\n""",
"""    state = null;\n    enterLobby();\n    if (sessionRole === 'admin') loadGuestKeys().catch(() => {});\n  }\n""",
'leave room lobby')

app = replace_once(app,
"""  function enterRoomState(next) {\n    state = next;\n""",
"""  function enterLobby() {\n    stopStream();\n    state = null;\n    document.title = '게임센터';\n    showView('lobby');\n    renderLobbyChat();\n    startLobbyStream();\n  }\n\n  function enterRoomState(next) {\n    stopLobbyStream();\n    state = next;\n""",
'enter lobby helper')

app = replace_once(app,
"""  function stopStream() {\n    if (streamController) streamController.abort();\n    streamController = null;\n    clearTimeout(streamRetryTimer);\n    streamRetryTimer = null;\n  }\n\n  async function startStream() {\n""",
"""  function stopStream() {\n    if (streamController) streamController.abort();\n    streamController = null;\n    clearTimeout(streamRetryTimer);\n    streamRetryTimer = null;\n  }\n\n  function stopLobbyStream() {\n    if (lobbyStreamController) lobbyStreamController.abort();\n    lobbyStreamController = null;\n    clearTimeout(lobbyStreamRetryTimer);\n    lobbyStreamRetryTimer = null;\n  }\n\n  async function startLobbyStream() {\n    stopLobbyStream();\n    if (!sessionToken || state) return;\n    const controller = new AbortController();\n    lobbyStreamController = controller;\n    lobbyConnectionBadge.textContent = '연결 중';\n    lobbyConnectionBadge.classList.remove('online');\n    try {\n      const res = await fetch('/api/lobby/events', {\n        headers: { 'X-Session-Token': sessionToken, Accept: 'text/event-stream' },\n        cache: 'no-store',\n        signal: controller.signal,\n      });\n      if (res.status === 401) return expireSession();\n      if (!res.ok || !res.body) throw new Error('대기방 실시간 연결 실패');\n      lobbyConnectionBadge.textContent = '온라인';\n      lobbyConnectionBadge.classList.add('online');\n      const reader = res.body.getReader();\n      const decoder = new TextDecoder();\n      let buffer = '';\n      while (true) {\n        const { value, done } = await reader.read();\n        if (done) break;\n        buffer += decoder.decode(value, { stream: true });\n        let split;\n        while ((split = buffer.indexOf('\\n\\n')) >= 0) {\n          const block = buffer.slice(0, split).replace(/\\r/g, '');\n          buffer = buffer.slice(split + 2);\n          handleLobbySseBlock(block);\n        }\n      }\n      if (!controller.signal.aborted) throw new Error('대기방 실시간 연결 종료');\n    } catch (err) {\n      if (controller.signal.aborted || state) return;\n      lobbyConnectionBadge.textContent = '재연결 중';\n      lobbyConnectionBadge.classList.remove('online');\n      lobbyStreamRetryTimer = setTimeout(() => startLobbyStream(), 1800);\n    }\n  }\n\n  function handleLobbySseBlock(block) {\n    if (!block || block.startsWith(':')) return;\n    let event = 'message';\n    let data = '';\n    for (const line of block.split('\\n')) {\n      if (line.startsWith('event:')) event = line.slice(6).trim();\n      else if (line.startsWith('data:')) data += line.slice(5).trim();\n    }\n    if (!data) return;\n    let parsed;\n    try { parsed = JSON.parse(data); } catch { return; }\n    if (event === 'lobbyState') {\n      lobbyState = parsed || { messages: [], connectedCount: 0 };\n      renderLobbyChat();\n    } else if (event === 'sessionExpired') {\n      expireSession(parsed.message);\n    }\n  }\n\n  async function startStream() {\n""",
'lobby stream client')

app = replace_once(app,
"""  function renderChat() {\n    const rows = state?.chat?.messages || [];\n""",
"""  function renderLobbyChat() {\n    if (!lobbyChatMessages) return;\n    const rows = lobbyState?.messages || [];\n    lobbyConnectedCount.textContent = `대기 ${lobbyState?.connectedCount || 0}명`;\n    lobbyChatMessages.innerHTML = '';\n    if (!rows.length) {\n      const empty = document.createElement('div');\n      empty.className = 'chatEmpty';\n      empty.textContent = '아직 대기방 메시지가 없습니다.';\n      lobbyChatMessages.appendChild(empty);\n      return;\n    }\n    for (const row of rows) {\n      const item = document.createElement('div');\n      item.className = 'chatMessage';\n      const head = document.createElement('div');\n      head.className = 'chatMessageHead';\n      const who = document.createElement('strong');\n      who.textContent = row.label || '게스트';\n      const time = document.createElement('time');\n      const d = new Date(row.at);\n      time.textContent = Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });\n      head.append(who, time);\n      const text = document.createElement('div');\n      text.className = 'chatMessageText';\n      text.textContent = row.text;\n      item.append(head, text);\n      lobbyChatMessages.appendChild(item);\n    }\n    lobbyChatMessages.scrollTop = lobbyChatMessages.scrollHeight;\n  }\n\n  function renderChat() {\n    const rows = state?.chat?.messages || [];\n""",
'render lobby chat')

app = replace_once(app,
"""  async function sendChat(event) {\n""",
"""  async function sendLobbyChat(event) {\n    event.preventDefault();\n    const text = lobbyChatInput.value.trim();\n    if (!text) return;\n    lobbyChatInput.disabled = true;\n    try {\n      await api('/api/lobby/chat', {\n        method: 'POST',\n        body: JSON.stringify({ text }),\n      });\n      lobbyChatInput.value = '';\n    } catch (err) {\n      showToast(err.message, 3500);\n    } finally {\n      lobbyChatInput.disabled = false;\n      lobbyChatInput.focus();\n    }\n  }\n\n  async function sendChat(event) {\n""",
'send lobby chat')

app = replace_once(app,
"""  issueFileForm.addEventListener('submit', issueFile);\n  chatForm.addEventListener('submit', sendChat);\n""",
"""  issueFileForm.addEventListener('submit', issueFile);\n  lobbyChatForm.addEventListener('submit', sendLobbyChat);\n  chatForm.addEventListener('submit', sendChat);\n""",
'lobby chat listener')
write('public/app.js', app)

# ---- style ----
css = read('public/styles.css')
css += '''\n/* Lobby chat: one realtime connection only while waiting in lobby */\n.lobbyChatCard{margin-top:18px;padding:22px}\n.lobbyChatHead{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}\n.lobbyChatHead h2{margin:.15em 0 .35em}\n.lobbyChatNote{margin:0;max-width:760px;font-size:.84rem}\n.lobbyChatStatus{display:flex;flex-direction:column;align-items:flex-end;gap:7px;white-space:nowrap}\n.lobbyChatMessages{height:220px;margin-top:14px}\n@media(max-width:640px){.lobbyChatCard{padding:14px}.lobbyChatHead{gap:10px}.lobbyChatNote{font-size:.76rem}.lobbyChatMessages{height:190px}}\n'''
write('public/styles.css', css)

package = read('package.json').replace('"version": "1.6.1"', '"version": "1.6.2"')
write('package.json', package)

print('Applied memory-only lobby chat v1.6.2')
