# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.246 게임관 G1 + 메신저 다듬기 A+B

- 서버 handClock { startedAt, finishedAt } → 결과 패널 「시간」.
- 토스트 정리: 방 만들기 안내 처음 한 번, 정산 글은 결과 패널 한 줄, 판이 끝나면 배너도 사라짐. 판 밖 위쪽 단추 40px 둥근 단추.
- G1 판 게임: 돌·상자·완주 수 HUD 알약, 상대 차례 초, 사목 글띠·열 번호 없앰, 빙고 상자 접음, 윷 던지기 .hpBtn.go.
- 메신저 다듬기 A+B(#393, 클라우드 세션): 사진 있는 방 맨 아래 유지, 사람 고르기 화면, 새 메시지 ↓·안 읽은 줄·여러 줄 입력·링크·복사·작은 창, 폰 사진 방 가로 넘침 고침.

## v1.10.245 게임관 UI 통일 U3

- 결과 패널 하나(.hpPanel): 판 게임 #boardOverlay(알약·제목·큰 숫자 64px·통계 3칸·단추 2개), 맞고 #gostopResult.hpPanel(두 칸 점수 표·금액 64px), 한판마당 .hpPanel.reflexBox(옛 .reflexPanel 없앰).
- 판·맞고 패널이 뜨면 #resultEffect 이모지 카드 없음, 전설 승리는 효과 뒤 2.2초에 패널.
- 효과음 한 세트: room-sound.js가 reflex/js/audio.js sfx 사용, 내 차례 마지막 5초 beep.

## v1.10.244 게임관 UI 통일 U2

- 판 중 게임방 HUD 한 줄(#roomHud): ✕ · 「게임 · 상대」 라벨 · 큰 숫자(내 차례 남은 초, 아니면 그 게임 숫자 2 : 2 / N점) · 차례 글 · 수 알약 · 🎮 💬 ☰(원래 단추를 아이디 그대로 옮김), 아래 시간 막대(10초 아래 분홍). 옛 위 막대·상태 줄은 숨김.
- ⓘ 방 정보·🔔 알림은 ☰ 안으로, 빠른 말(#quickChat)은 💬 채팅 창 안으로.
- 이름표(.player·.teamPlayer)를 차례 알약으로: 40px·모서리 12·얼굴 32px·m:ss와 가는 막대, 차례인 쪽만 .on(--c1 2px). 게임별 자리판(화투·파티)은 G2·G3.
- 안내 배너: #boardNote를 HUD 바로 아래 초록 유리 알약(1.8초), 내 차례가 오면 「내 차례예요」 한 번.
