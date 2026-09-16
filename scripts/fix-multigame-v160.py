from pathlib import Path
p = Path('public/app.js')
s = p.read_text(encoding='utf-8')
old = """  function enterRoomState(next) {\n    state = next;\n    seat = state?.me?.seat || null;\n    isHost = Boolean(state?.me?.isHost);\n    showView('room');\n"""
new = """  function enterRoomState(next) {\n    state = next;\n    selectedGameType = state?.gameType === 'othello' ? 'othello' : 'omok';\n    seat = state?.me?.seat || null;\n    isHost = Boolean(state?.me?.isHost);\n    showView('room');\n"""
if s.count(old) != 1:
    raise SystemExit('enterRoomState patch target mismatch')
s = s.replace(old, new, 1)
old = """    state = null;\n    showView('lobby');\n    if (sessionRole === 'admin') loadGuestKeys().catch(() => {});\n"""
new = """    state = null;\n    document.title = '게임센터';\n    showView('lobby');\n    if (sessionRole === 'admin') loadGuestKeys().catch(() => {});\n"""
if s.count(old) != 1:
    raise SystemExit('leaveRoom patch target mismatch')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')
