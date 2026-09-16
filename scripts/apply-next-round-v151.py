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


server = read('server.js')
server = replace_once(server, """  if (action === 'rematch') {
    const seat = findSeat(room, session.token);
    if (!seat) return sendError(res, 403, 'SPECTATOR', '이번 대국의 흑·백만 다음 대국을 신청할 수 있습니다.');
    if (!['finished', 'draw'].includes(room.game.status)) return sendError(res, 409, 'NOT_FINISHED', '대국이 끝난 뒤 신청할 수 있습니다.');
    room.game.rematchRequests[seat] = true;
    if (room.game.rematchRequests.black && room.game.rematchRequests.white) prepareNextRound(room);
  }
""", """  if (action === 'next-round' || action === 'rematch') {
    if (!['finished', 'draw'].includes(room.game.status)) {
      return sendError(res, 409, 'NOT_FINISHED', '대국이 끝난 뒤 다음 판을 열 수 있습니다.');
    }
    prepareNextRound(room);
    appendSystemMessage(room, `${session.label || '참가자'}님이 다음 판을 열었습니다. 역할을 다시 선택해 주세요.`);
  }
""", 'server next-round action')
server = replace_once(
    server,
    "match = pathname.match(/^\\/api\\/room\\/(choose-role|move|resign|rematch)$/);",
    "match = pathname.match(/^\\/api\\/room\\/(choose-role|move|resign|next-round|rematch)$/);",
    'server action route',
)
server = server.replace("version: '1.5.0'", "version: '1.5.1'")
server = server.replace('게임 서버 v1.5.0 실행', '게임 서버 v1.5.1 실행')
write('server.js', server)

index = read('public/index.html')
index = index.replace('v=1.5.0', 'v=1.5.1')
index = replace_once(index, '<button id="rematchBtn" class="primary hidden">다음 대국 신청</button>', '<button id="nextRoundBtn" class="primary hidden">다음 판 준비</button>', 'mobile next-round button')
index = replace_once(index, '<button id="sideRematchBtn" class="primary hidden">다음 대국 신청</button>', '<button id="sideNextRoundBtn" class="primary hidden">다음 판 준비</button>', 'side next-round button')
write('public/index.html', index)

app = read('public/app.js')
app = replace_once(app, "  const rematchBtn = document.getElementById('rematchBtn');\n  const sideRematchBtn = document.getElementById('sideRematchBtn');", "  const nextRoundBtn = document.getElementById('nextRoundBtn');\n  const sideNextRoundBtn = document.getElementById('sideNextRoundBtn');", 'app next-round elements')
app = replace_once(app, """    for (const b of [rematchBtn, sideRematchBtn]) {
      b.classList.toggle('hidden', !finished || !canAct);
      const requested = canAct && g.rematchRequests?.[seat];
      b.disabled = Boolean(requested);
      b.textContent = requested ? '상대 응답 대기 중' : '다음 대국 신청';
    }
""", """    for (const b of [nextRoundBtn, sideNextRoundBtn]) {
      b.classList.toggle('hidden', !finished);
      b.disabled = !finished;
      b.textContent = '다음 판 준비';
    }
""", 'app next-round render')
app = replace_once(app, "  rematchBtn.addEventListener('click', () => roomAction('rematch'));\n  sideRematchBtn.addEventListener('click', () => roomAction('rematch'));", "  nextRoundBtn.addEventListener('click', () => roomAction('next-round'));\n  sideNextRoundBtn.addEventListener('click', () => roomAction('next-round'));", 'app next-round handlers')
write('public/app.js', app)

package = json.loads(read('package.json'))
package['version'] = '1.5.1'
write('package.json', json.dumps(package, ensure_ascii=False, indent=2) + '\n')

print('Applied next-round flow v1.5.1')
