# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.73 결함 3건·게임관 전면 개편·마을 환경정비사업

- 지시(사용자 2026-10-12): 한 브랜치에서 ① 결함 3건 → ② 게임관 UI 전면 개편(게임방 틀까지) → ③ 마을 환경정비사업(길 3단계·땅 다듬기, 버섯 군락 제외)을 이어서, 묶음마다 PR CI 확인, 버전·공지는 마지막에 한 번.
- ① 이벤트 주민(`public/plaza/island-npcs.js` `createWalkers`): 재현 — 섬 화면이 멈춘 동안(숨긴 탭·게임관) 의뢰가 잡히면 돌아왔을 때 주민이 20m 넘게 떨어진 옛 자리에서 직선으로 걷다 광장 장식 사이에 갇힘. 1초 넘게 그리지 않은 화면은 의뢰 자리에 바로 두고, 5m 넘거나 1.5초 못 다가가면 순환경로 격자로 길 찾기(`findPath`의 `blockedCell` — 그 화면의 충돌 원·10월 밤 호박도 피함, 막힌 시작·끝은 가까운 빈칸). 공용 격자는 그대로(순환경로·서버·v1.10.60 시험 유지).
- ① 밝은 테마(`tools/theme-light.js`): 변환표에 없던 UI 바탕 8색(게시판 `#0e1729`·고정 공지 `#172033`·내 말풍선 `#214b83` 등). `test/theme-light.test.js`가 게임 그림·`KEEP_DARK` 밖의 미변환 어두운 바탕과 게시판 글자 대비 4.5:1 미만을 잡음.
- ① 자정 직후 배회 NPC 시험: 원인은 시험이 늘 주민 0번을 고른 것 — 열린 NPC 의뢰가 0번을 예약하면 설계대로 비키지 않음(서버 시계를 00:02·14:00 KST로 옮겨 같은 실패 재현, 자정 무관). 예약 안 된 주민을 고르게 고침.
- ② 게임관(`public/gamehall-catalog.js` 카탈로그 31개, `app.js` `openGamehall`·`openGameSheet`·`quickStart`, `#gamehallView`·`#gameSheet`): 섬 게임관 → 전용 화면(섬 멈춤, Esc·‹ 섬으로는 같은 자리), 오늘의 게임(서울 날짜 순환)·요약 3칸(`/api/records/me` `total.week` 추가)·분류 칩·카드·상세 시트(방 만들기는 기존 방 양식을 옮겨 그 게임 옵션만). 관리자 대체 로비는 그대로. `GameLaunch.play(game, { level, goal, place })` → `{ score, done, run }`(reflex.js `play`, 퀘스트는 그 난이도로 바로 시작·나가면 done:false·섬으로). 한판마당 화면 메뉴·결과를 우리 팔레트로(밝은 테마 따라감, 캔버스·HUD는 그대로). 게임방 틀: 위쪽 바 ‹ 게임관·게임 2색 아이콘·자리 칩, 카드(고스톱·도둑잡기·할리갈리·다빈치)·말(윷·팬데믹) 게임 판 위 상태 줄 `.gamePanelHead`, 고스톱 중복 「내 포인트」 제거. DESIGN.md 게임관·게임방 절 실제 값과 게임별 2색 표(시험이 카탈로그와 일치 확인).
- ③ 길 3단계(`public/plaza/island.js`): `tierAt` — 마을 길(게임관 길·상점가·광장 32m 안 등반/항구 길) 판석 2종+테라조+양쪽 연속 테두리, 산책로(둘레길·마을 밖) 가장자리 띠, 오솔길(자연·정자) 징검돌, 교차 원판, 마을→산책로 화분 한 쌍; 길가 무작위 연석·조약돌·꽃 제거(개울가는 그대로), 충돌 없음. ③ 땅 다듬기: 화질 0 숲 바닥 칠(나무 6m 안 밀도), 1 납작(잔디밭은 구역 계절 — 꽃잎·클로버·낙엽·눈, 숲은 이끼), 2 고사리·덤불·꽃무리(`coverFlat`/`coverLow`를 장면이 화질로 켬). 에셋 assets/24 중 11종·assets/25 중 9종(`tools/assets/island-models.json` SHA 기록, gltfpack), 나머지 조각은 자리 정해질 때까지 보류.
- 성능(같은 카메라 10곳, PC 1280×800 소프트웨어 렌더, 기준은 두 번 잰 평균): 그리기 호출 평균 약 +8%(지점별 +2~+13%), 삼각형 +0~11%. 숲 지점 화질 0→2 그리기 603→647.
- Codex 읽기 전용 검토(브랜치 전체 1회) 지적 2건 반영: ① 퀘스트 퍼즐이 계정 진행 정보를 받기 전에 시작해 영영 시작되지 않던 것 → 정보를 받은 뒤 시작 ② 퀘스트 난이도로 끝낸 판의 기록·제출이 저장된 기본 난이도로 가던 것 → 시작한 난이도(`runLevel`)를 끝까지 사용(e2e: 어려움 퀘스트 → level hard, 스도쿠 퀘스트 시작).
- CI: `.github/workflows/playwright.yml`에 concurrency(같은 PR 이전 실행 취소, 필수 검사 이름 그대로).
- 검증: `npm test`(Windows 로컬은 줄바꿈 탓 6건, CI 통과), e2e — 이벤트 주민(10월 밤 광장 반대편·멈춘 화면), 배회 NPC, 게임관 전용 화면·시트·방 만들기·AI 연습·Esc, 게임 실행 규약, 섬 게임 초대, 마을 환경정비사업(조각 수·화질 0·1·2), 운영 등록부, 순발력 8개, 입장·로비. 실제 휴대폰·실제 GPU 미검증.

## v1.10.72 게임방 AI 자리(오목·사목·오델로)

- 지시(사용자 2026-10-12): 한판마당 오목 등 AI를 우리 오목판에 — ②「게임방 AI 자리」(서버 판정), 전적·랭킹에서 빼고 참가 포인트도 뺀다. 성능 질문에 대한 답: 트래픽은 사람 수 하나와 같고, CPU는 어려움 오목 수당 약 0.7초(로컬) → 작업 스레드 하나에서 차례로 계산해 섬·다른 방은 막지 않음.
- 서버(`lib/room-ai.js`·`lib/room-ai-worker.mjs`): 자료 `ai-core.js`의 `gomokuAi`·`connect4AiAs`·`reversiAiAs`(v1.10.71에 들어온 그 파일, AI 오목 장목 규칙 수정 포함)를 작업 스레드에서. 우리 판(`[y][x]` 'black'/'white')을 위에서부터 한 줄씩 펼친 0/1/2로 넘기고, 돌려받은 칸 번호(사목은 열)를 같은 게임 엔진 `applyMove`로 둔다. 대기 20개·30초 넘으면 실패 → 3초 뒤 다시(유휴 틱도 다시 부름). 최소 0.5초 뒤에 둔다(너무 빠르지 않게).
- 방(`server.js`): `/api/rooms` `ai: easy|normal|hard`(오목·사목·오델로만, 오목 2vs2 아님) → 비공개 방 + AI 참가자(`ai:<방 id>`, 세션·포인트 계정·전적 id 없음, 항상 접속, 이름 「AI · 보통」). 자리 고르기: 한 사람만 흑·백 어느 쪽이든, AI는 맞은편으로 옮겨 앉음(둘째 사람은 관전만, 409). 참가 포인트 없음(`entrySnapshot` null), `recordFinishedMatch`가 바로 끝냄(전적·미션·업적·랭킹 없음), 끊김 판정에서 AI 제외·AI 차례엔 자리비움 시계 없음. 매 행동 뒤·유휴 틱마다 `scheduleAiMove`(판·라운드·수가 그대로일 때만 둠, 오델로 패스 뒤 연속 차례도).
- Codex 검토 2건 반영: ① AI가 생각하는 동안 사람이 끊겨 방이 일시정지되어도 그대로 두던 것 → 두기 직전 `syncGamePause` 후 일시정지면 두지 않음(재접속 뒤 유휴 틱이 다시 부름) ② AI 방에도 참가 포인트 규칙이 보이던 것 → 방 정보 `points.policy: practice`(참가비 0), 화면 「AI 연습 · 포인트·전적 없음」.
- 화면: 방 만들기 「상대」 사람 / AI 쉬움 / 보통 / 어려움(오목 1vs1·사목·오델로일 때만, `#roomAiChoices`). 게임판·스킨은 평소 방 그대로.
- 검증: `test/room-ai-server.test.js`(빙고·없는 난이도 400, 비공개, 백을 고르면 AI가 흑으로 먼저 둠, 둘째 사람 자리 409, 두면 AI가 받아 둠, 기권 뒤 전적 0판·잔액 그대로, 다음 판에 다시 앉음), e2e 「게임방 AI」(오목 방 UI로 AI 보통 → 흑 → 두면 2수, PC·휴대폰 프로필). 실제 휴대폰 미검증.

## v1.10.71 AI 대전·게임별 랭킹(한판마당 자료 4차)

- 지시(사용자 2026-10-12): 마지막 묶음 — 오목 AI는 「연습으로 둔다」(포인트 없음). 같은 묶음의 랭킹과 함께. 윷놀이 AI 대신 두기는 설계 결정 필요로 보류(아래).
- AI 대전: `public/reflex/js/games/{gomoku,connect4,reversi,ai-core,rules,chess-core,go-core,turnnet}.js` 원본(ai-core·rules가 체스·바둑 코어를 import해서 함께). `public/reflex/js/cosmetics.js`는 우리 것(자료에 없는 꾸미기 상점 대신 늘 기본 바둑판·흑백 돌). 고친 곳: `reversi.js` 이름 「리버시」→「오델로」. 싱글게임 → 「AI 대전」(`#soloAiBtn`) → reflex.js `open('ai')`. AI 난이도 쉬움·보통·어려움(`E.level`), 게임의 `options`를 그대로 고르기로(오목 규칙 렌주룰/3수 교환·먼저 두기, 사목·오델로 먼저 두기 — reflex.js가 퍼즐의 「문제」 고르기도 같은 길로 일반화). AI 계산은 브라우저(자료 그대로). 결과는 서버로 보내지 않음(포인트·전적 없음). 사목 색은 자료 그대로 노랑/분홍(우리 방 게임은 빨강/노랑).
- 게임별 랭킹: `lib/game-ranking.js`(자료 `ranking-excerpt.js`의 `weekStart`·`wilson` 그대로 + 순위 정렬), 전적 저장소 `matchesOf(game, since)`(JSON·PostgreSQL, 색인 `game_match_history_game_at_idx`), `GET /api/records/ranking?game=&week=this|all` → 상위 20·내 순위. 10판 이상, 무승부 반 승, 윌슨 하한 → 판수 → 그 기록에 먼저 도달(마지막 판 시각), 같은 점수 같은 순위, 이번 주 = 서울 월요일 0시부터. 화면: 내 전적 「랭킹」 → 게임(규칙 설명의 게임 목록, 랜드킹·잿빛 원정 제외)·이번 주/전체. 이름은 전적 조회와 같은 플레이어 목록(입장 키 닉네임).
- Codex 검토 2건 반영: ① 자료 `rules.js` `gmForbidden`이 한 수로 5목과 다른 방향 장목이 함께 생기면 5목을 먼저 봐서 승리로 처리 — 우리 오목(`lib/game.js`)은 장목 금수라 장목을 먼저 보게 고침(주석 「아일랜드 v1.10.71」, `test/hanpan-gomoku-rules.test.js`, 자료의 렌주 시험 `gomoku-renju.mjs`도 그대로 통과) ② 게임 선택이 랜드킹·잿빛 원정일 때 랭킹 창이 빈 게임으로 열려 오류 → 오목으로.
- 보류 — 윷놀이 AI 대신 두기: 우리 윷은 2인(1:1)이고, 한판마당도 1:1 대결은 AI가 대신 두지 않고 재접속을 기다린다(대신 두기는 2~4인 여럿이 판만). 1:1에서 대신 두면 자리 비운 사람이 참가 포인트·전적을 AI 덕에 얻을 수 있고, 자료의 `yutAi`는 한판마당 윷 규칙 형식이라 우리 규칙(빽도·지름길·완주 직전 칸)에 맞춘 연결이 필요 — 사용자 결정 대기.
- 검증: `test/game-ranking.test.js`(공식·순위·같은 순위·주 경계, JSON·PostgreSQL 기간 조회, API), e2e 「AI 대전」(오목 두면 AI가 받아 둠·서버로 안 보냄)·「랭킹」(PC·휴대폰 프로필). 실제 휴대폰 미검증.
