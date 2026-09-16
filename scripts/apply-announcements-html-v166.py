from pathlib import Path
p = Path('public/index.html')
s = p.read_text()
def once(old, new, label):
    global s
    n = s.count(old)
    if n != 1: raise RuntimeError(f'{label}: expected one anchor, got {n}')
    s = s.replace(old, new, 1)

notice = '''      <section id="announcementsCard" class="card noticeCard" aria-label="공지사항">
        <div class="noticeBar">
          <button id="announcementTab" type="button" class="noticeTab" aria-expanded="true" aria-controls="announcementPanel">📢 공지사항 <span id="announcementCount" class="noticeCount">0</span></button>
          <button id="announcementAddBtn" type="button" class="ghost tiny hidden">공지 등록</button>
        </div>
        <div id="announcementPanel" class="noticePanel">
          <div id="announcementList" class="announcementList"><p class="emptyState">공지를 불러오는 중입니다.</p></div>
          <form id="announcementForm" class="noticeForm hidden" autocomplete="off">
            <strong id="announcementFormTitle">공지 등록</strong>
            <label for="announcementTitle">제목</label>
            <input id="announcementTitle" type="text" maxlength="100" placeholder="공지 제목" required />
            <label for="announcementBody">내용</label>
            <textarea id="announcementBody" maxlength="3000" rows="5" placeholder="공지 내용을 입력하세요." required></textarea>
            <div class="noticeFormActions">
              <button id="announcementSaveBtn" class="secondary" type="submit">저장</button>
              <button id="announcementCancelBtn" class="ghost" type="button">취소</button>
            </div>
          </form>
        </div>
      </section>

'''
once('      <section class="lobbyTopGrid">', notice + '      <section class="lobbyTopGrid">', 'announcement top tab')
once('''          <h2>게임 선택</h2>
          <p class="muted">방을 만들 게임을 먼저 선택하세요. 방 비밀번호로 참가할 때는 해당 방의 게임이 자동으로 열립니다.</p>''', '''          <div class="helpHeading"><h2>게임 선택</h2><details class="helpDisclosure"><summary>자세히 보기</summary><p>방을 만들 게임을 먼저 선택하세요. 방 비밀번호로 참가할 때는 해당 방의 게임이 자동으로 열립니다.</p></details></div>''', 'game help')
once('''          <div class="gamePicker" id="gamePicker">
            <button type="button" class="gameChoice selected" data-game="omok">
              <strong>오목</strong><small>15×15 · 흑 선공 · 금수 적용</small>
            </button>
            <button type="button" class="gameChoice" data-game="othello">
              <strong>오셀로</strong><small>8×8 · 돌 뒤집기 · 자동 패스</small>
            </button>
            <button type="button" class="gameChoice" data-game="baseball">
              <strong>숫자야구</strong><small>3자리 · 각자 비밀 숫자 · 스트라이크/볼</small>
            </button>
          </div>
          <p id="selectedGameText" class="selectedGameText">오목 방을 만듭니다.</p>''', '''          <div class="gamePicker" id="gamePicker">
            <div class="gameOption" data-game-option="omok">
              <button type="button" class="gameChoice selected" data-game="omok"><strong>오목</strong></button>
              <details class="gameRuleDetails"><summary>자세히 보기</summary><p>15×15 바둑판에서 흑이 먼저 둡니다. 흑은 정확히 5목을 만들면 승리하며 3-3, 4-4, 6목 이상은 금수입니다. 백은 5목 이상이면 승리하며 금수가 없습니다.</p></details>
            </div>
            <div class="gameOption" data-game-option="othello">
              <button type="button" class="gameChoice" data-game="othello"><strong>오셀로</strong></button>
              <details class="gameRuleDetails"><summary>자세히 보기</summary><p>8×8 판에서 흑이 먼저 둡니다. 상대 돌을 양쪽에서 감싸면 가운데 돌을 내 색으로 뒤집습니다. 둘 곳이 없으면 자동 패스하며, 양쪽 모두 둘 수 없으면 종료되고 돌이 많은 쪽이 이깁니다.</p></details>
            </div>
            <div class="gameOption" data-game-option="baseball">
              <button type="button" class="gameChoice" data-game="baseball"><strong>숫자야구</strong></button>
              <details class="gameRuleDetails"><summary>자세히 보기</summary><p>각자 서로 다른 숫자 3개로 비밀 숫자를 정합니다. 첫 자리는 0이 아니어야 합니다. 숫자와 자리가 같으면 스트라이크, 숫자만 같으면 볼, 모두 다르면 아웃입니다. 선공부터 번갈아 추측해 먼저 3스트라이크를 맞히면 승리합니다. 상대의 비밀 숫자는 보이지 않습니다.</p></details>
            </div>
          </div>
          <p id="selectedGameText" class="selectedGameText hidden">오목 방을 만듭니다.</p>''', 'compact picker')
once('''            <h2>대기방 채팅</h2>
            <p class="muted lobbyChatNote">방에 들어가기 전 대화하는 공용 채팅입니다. 최근 50개만 임시 보관되며 서버가 재시작되면 모두 사라집니다.</p>''', '''            <div class="helpHeading"><h2>대기방 채팅</h2><details class="helpDisclosure"><summary>자세히 보기</summary><p>방에 들어가기 전 대화하는 공용 채팅입니다. 최근 50개만 임시 보관되며 서버가 재시작되면 모두 사라집니다.</p></details></div>''', 'chat help')
once('''          <h2>게스트 입장 파일</h2>
          <p class="muted">사람별 닉네임으로 입장 파일을 발급하세요. 이 닉네임은 접속자·플레이어·채팅 이름으로 사용되며, 파일 1개는 동시에 1명만 사용할 수 있습니다.</p>''', '''          <div class="helpHeading"><h2>게스트 입장 파일</h2><details class="helpDisclosure"><summary>자세히 보기</summary><p>사람별 닉네임으로 입장 파일을 발급하세요. 닉네임은 접속자·플레이어·채팅 이름으로 사용됩니다. 파일 1개는 동시에 1명만 사용할 수 있고 권한을 취소하면 더 이상 입장할 수 없습니다. 취소한 파일은 관리자가 복구할 수 있습니다.</p></details></div>''', 'admin help')
once('''          <div class="rules">
            <strong>현재 규칙</strong>
            <p id="rulesText">게임 규칙을 불러오는 중입니다.</p>
          </div>''', '''          <details class="rules roomRuleDetails">
            <summary>게임 규칙 자세히 보기</summary>
            <p id="rulesText">게임 규칙을 불러오는 중입니다.</p>
          </details>''', 'room rules help')
s = s.replace('v=1.6.5', 'v=1.6.6')
p.write_text(s)
print('Announcement top tab and compact default-closed game/help sections integrated')
