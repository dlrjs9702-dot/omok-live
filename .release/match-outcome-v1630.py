from pathlib import Path
p=Path('server.js')
s=p.read_text(encoding='utf-8')
a="const { createMatchStore } = require('./lib/match-records');"
assert s.count(a)==1
s=s.replace(a,a+"\nconst { buildMatchResult } = require('./lib/match-result');",1)
start=s.index('function resultSeats(room) {')
end=s.index('async function recordOrError(room, res) {',start)
s=s[:start]+'''async function recordFinishedMatch(room) {
  const result = buildMatchResult(room, nowIso());
  if (!result) return false;
  room.recordedMatches ||= new Set();
  if (room.recordedMatches.has(result.id)) return false;
  await matchStore.recordMatch(result);
  room.recordedMatches.add(result.id);
  return true;
}

'''+s[end:]
p.write_text(s,encoding='utf-8')
print('centralized per-game result resolver connected')
