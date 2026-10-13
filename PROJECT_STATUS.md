# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.74 스킨 2배 — 꾸미기 156종·캐릭터 게임 스킨 연결

- 지시(사용자 2026-10-13): Codex 27번 묶음(Blender 다듬기 전 원본)을 연결, 농부(26)는 연결하지 않음, 통과하면 바로 배포.
- 아바타 156(`public/plaza/skins-x2.js` 한 목록을 `lib/skins.js` 카탈로그와 `island-assets.js` 옷장이 함께 읽음): 일반 112 `avatar_x2_<칸>_<이름>`(파일 `characters/wear/x2_*`, 등급은 칸마다 일반·고급·희귀·전설 섞임, 주색 `primary` 염색), 캐릭터 44 `avatar_ip_<캐릭터>_<칸>`(파일 `characters/wear-ip/` 폴더째 삭제 가능, 일반 등급 없음 — 의상 전설·쿠로미 두건 전설, 염색 안 함). 맞춤은 동물 세트와 같은 규칙(의상 위·아래 대체, 모자 cover 1.95, 신발 대체). 원본 SHA는 `tools/assets/island-models.json`(gltfpack, 기존 파일은 바이트 동일).
- 캐릭터 게임 스킨 10(`public/skin-art-ip.js` 한 파일에 그림 33장 전부): SVG를 Path2D로 바로 그림(이미지 로딩 없음 → 판 텍스처 캐시가 빈 그림을 담지 않음), 말의 `id="side"`는 편 색. 연결: 오목(헬로키티·슈퍼맨 말, 헬로키티 테마)·사목(마이멜로디·아이언맨 말, 마이멜로디 테마)·오델로(쿠로미 말)·윷놀이(쿠로미 전설 말 ↔ 쿠로미 테마 짝, 배트맨 말). 나머지 9게임(카드 뒷면·모서리 표시·커서·배지 등 게임마다 쓰는 자리가 다름) 그림은 파일에 있고 연결은 다음 단계.
- IP 장치: 카탈로그 `ip`(산리오/DC/마블/포켓몬)·`character`, 상점에 「○○ 캐릭터」 표시, 서버 `IP_SKINS=off`면 카탈로그에서 빠져 상점·외형·방 어디에도 안 나옴(착용 중이면 기본 모습). 삭제 시 환불은 삭제할 때 구현(IDEAS 필수 항목).
- 검증: `test/skins.test.js`(캐릭터 54개 모두 소유자·일반 아님, `IP_SKINS=off`면 0, 가격, 짝), `test/avatar-appearance-models.test.js`(새 의상 19 실제 GLB의 `primary`만 염색, 캐릭터 의상은 염색 목록 밖), 운영 등록부(새 부품 156 파일·메시), 화면 확인(쿠로미·배트맨·일반 세트 착용, 캐릭터 말 편 색, 쿠로미 윷판 테마). 실제 휴대폰·GPU 미검증.
- 후속 수정(Codex, 사용자 이번 패치만 예외 인계 승인): 리뷰 P2 — 고정 재질만 있는 신규 목걸이 18종을 염색 목록·옷장 색 채널에서 제외(무효 차감 방지). 추가 발견 — 새 `avatar_x2_*` 주색 저장을 포인트 저장소가 기존 숫자 ID 정규식으로 거절하던 500 오류 수정(실제 염색 가능한 카탈로그 ID만 허용). 서버/API의 요청당 1회 차감·무료 원색 복구·재입장 유지 및 JSON/PostgreSQL 저장 회귀, 일반 부품 112종의 High/Low 재질과 염색 목록 일치 검사 추가. 스킨 E2E 수량·희귀 구역 기대값 갱신; 팬데믹은 초기 리소스 준비 완료 뒤 방 복구 검증, 팀 오목 독립 서버 준비 확인은 해당 자식의 시작 로그도 확인(다른 서버 /health를 준비 완료로 오인하지 않음).

## v1.10.73 결함 3건·게임관 전면 개편·마을 환경정비사업

- 지시(사용자 2026-10-12): 한 브랜치에서 ① 결함 3건 → ② 게임관 UI 전면 개편(게임방 틀까지) → ③ 마을 환경정비사업(길 3단계·땅 다듬기, 버섯 군락 제외)을 이어서, 묶음마다 PR CI 확인, 버전·공지는 마지막에 한 번.
- ① 이벤트 주민(`public/plaza/island-npcs.js` `createWalkers`): 재현 — 섬 화면이 멈춘 동안(숨긴 탭·게임관) 의뢰가 잡히면 돌아왔을 때 주민이 20m 넘게 떨어진 옛 자리에서 직선으로 걷다 광장 장식 사이에 갇힘. 1초 넘게 그리지 않은 화면은 의뢰 자리에 바로 두고, 5m 넘거나 1.5초 못 다가가면 순환경로 격자로 길 찾기(`findPath`의 `blockedCell` — 그 화면의 충돌 원·10월 밤 호박도 피함, 막힌 시작·끝은 가까운 빈칸). 공용 격자는 그대로(순환경로·서버·v1.10.60 시험 유지).
- ① 밝은 테마(`tools/theme-light.js`): 변환표에 없던 UI 바탕 8색(게시판 `#0e1729`·고정 공지 `#172033`·내 말풍선 `#214b83` 등). `test/theme-light.test.js`가 게임 그림·`KEEP_DARK` 밖의 미변환 어두운 바탕과 게시판 글자 대비 4.5:1 미만을 잡음.
- ① 자정 직후 배회 NPC 시험: 원인은 시험이 늘 주민 0번을 고른 것 — 열린 NPC 의뢰가 0번을 예약하면 설계대로 비키지 않음(서버 시계를 00:02·14:00 KST로 옮겨 같은 실패 재현, 자정 무관). 예약 안 된 주민을 고르게 고침.
- ② 게임관(`public/gamehall-catalog.js` 카탈로그 31개, `app.js` `openGamehall`·`openGameSheet`·`quickStart`, `#gamehallView`·`#gameSheet`): 섬 게임관 → 전용 화면(섬 멈춤, Esc·‹ 섬으로는 같은 자리), 오늘의 게임(서울 날짜 순환)·요약 3칸(`/api/records/me` `total.week` 추가)·분류 칩·카드·상세 시트(방 만들기는 기존 방 양식을 옮겨 그 게임 옵션만). 관리자 대체 로비는 그대로. `GameLaunch.play(game, { level, goal, place })` → `{ score, done, run }`(reflex.js `play`, 퀘스트는 그 난이도로 바로 시작·나가면 done:false·섬으로). 한판마당 화면 메뉴·결과를 우리 팔레트로(밝은 테마 따라감, 캔버스·HUD는 그대로). 게임방 틀: 위쪽 바 ‹ 게임관·게임 2색 아이콘·자리 칩, 카드(고스톱·도둑잡기·할리갈리·다빈치)·말(윷·팬데믹) 게임 판 위 상태 줄 `.gamePanelHead`, 고스톱 중복 「내 포인트」 제거. DESIGN.md 게임관·게임방 절 실제 값과 게임별 2색 표(시험이 카탈로그와 일치 확인).
- ③ 길 3단계(`public/plaza/island.js`): `tierAt` — 마을 길(게임관 길·상점가·광장 32m 안 등반/항구 길) 판석 2종+테라조+양쪽 연속 테두리, 산책로(둘레길·마을 밖) 가장자리 띠, 오솔길(자연·정자) 징검돌, 교차 원판, 마을→산책로 화분 한 쌍; 길가 무작위 연석·조약돌·꽃 제거(개울가는 그대로), 충돌 없음, 모델이 없는 조각은 대신 그리지 않음(대체 모양 수천 개가 모델 끈 시험의 섬 시작을 늦춰 CI assets 묶음 30초 시험이 시간 초과 — 길 띠가 단계 색을 보여 줌). ③ 땅 다듬기: 화질 0 숲 바닥 칠(나무 6m 안 밀도), 1 납작(잔디밭은 구역 계절 — 꽃잎·클로버·낙엽·눈, 숲은 이끼), 2 고사리·덤불·꽃무리(`coverFlat`/`coverLow`를 장면이 화질로 켬). 에셋 assets/24 중 11종·assets/25 중 9종(`tools/assets/island-models.json` SHA 기록, gltfpack), 나머지 조각은 자리 정해질 때까지 보류.
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
