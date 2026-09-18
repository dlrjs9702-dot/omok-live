from pathlib import Path
p = Path('server.js')
s = p.read_text(encoding='utf-8')
def one(a,b):
 global s
 assert s.count(a)==1, (a[:90],s.count(a))
 s=s.replace(a,b,1)
one("    role: session.role,\n    rejoinable:", "    role: session.role,\n    recordId: session.guestKeyId || `admin:${session.publicId}`,\n    rejoinable:")
one("playerId: p.guestKeyId || (p.role === 'admin' ? 'admin' : null)", "playerId: p.recordId || p.guestKeyId || null")
one("const id = person?.guestKeyId || (person?.role === 'admin' ? 'admin' : null);", "const id = person?.recordId || person?.guestKeyId || null;")
one("function recordIdentity(session) { return session.guestKeyId || (session.role === 'admin' ? 'admin' : null); }", "function recordIdentity(session) { return session.guestKeyId || `admin:${session.publicId}`; }")
one("return [{ id: 'admin', label: '관리자' }, ...keys.map(key => ({ id: key.id, label: key.label }))];", "return [...[...sessions.values()].filter(session => session.role === 'admin').map(session => ({ id: recordIdentity(session), label: session.label })), ...keys.map(key => ({ id: key.id, label: key.label }))];")
one("const recordLookup = pathname.match(/^\\/api\\/records\\/(admin|[0-9a-f-]{36})$/i);", "const recordLookup = pathname.match(/^\\/api\\/records\\/(admin:[A-Za-z0-9_-]{10,40}|[0-9a-f-]{36})$/i);")
p.write_text(s,encoding='utf-8')
print('admin sessions distinct; guest UUID remains persistent')
