# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.63 통합 UI 개편 (Esc 메뉴·밝은 테마·게임 홀·게임방 틀·주민 대화·대화 카메라)

- 지시(사용자 2026-10-11, IDEAS 「통합 UI」 범위 조정): 계정 표시줄을 없애고 다른 게임처럼 Esc 메뉴, 테마는 어두운 기본·밝게·기기 설정 선택.
- 메뉴: `#gameMenuDialog`(내 정보·관리자 창·환경설정[테마 3택·전체화면]·접속 종료). Esc는 섬/로비에서 열린 창·입력 중·사진 모드·채집 중이 아닐 때만 연다(채집 중 Esc는 기존 취소). 휴대폰은 섬 왼쪽 위 ☰(채팅 탭은 오른쪽으로). 메뉴에서 다른 창을 열면 메뉴는 닫힌다. 섬 높이는 표시줄이 빠진 만큼 늘었다(PC `100vh - 40px`, 터치 `100dvh - 12px`).
- 테마: `<html data-theme>`를 app.js 시작에서 정한다(`gc.theme`, 기기 설정은 `prefers-color-scheme`를 따라 바뀜). 밝은 테마는 `tools/theme-light.js`가 `styles.css`에서 어두운 UI 팔레트를 쓰는 선언만 골라 글자색/바탕·선 색을 역할별로 바꾼 `theme-light-auto.css`(592규칙)를 만들고, 손보정은 `theme-light.css`. 각 게임 판·카드 그림의 고유 색은 대상 아님. `test/theme-light.test.js`가 생성 파일이 최신인지 확인. DESIGN.md에 두 테마 규칙.
- 게임 선택(사용자 2026-10-11 추가): 게임 목록을 「멀티게임 / 싱글게임」 탭으로, 멀티게임은 「대전게임 / 협동게임」 탭으로(index.html `data-game-pane`·`data-kind`, app.js `showGameTab`, `gc.gameTab` 기억, 첫 방문은 멀티·대전). 협동 = 팬데믹(다 함께 승패)·스무고개(협동전 모드), 대전 = 나머지 13개, 구현 중(랜드킹·잿빛 원정)은 멀티게임 아래 그대로. 고른 게임이 없는 종류로 바꾸면 그 종류의 첫 게임을 고른다(보이지 않는 게임의 방이 만들어지지 않게). 싱글게임에서는 방 만들기·참가를 숨긴다. e2e 「게임 선택」은 관리자 로그인 2번이라 자기 주소(X-Forwarded-For)로 — 같은 주소 15분 5회 제한에 다른 테스트가 걸리지 않게.
- 2 게임 홀: 공개방 목록을 카드로(게임 배지·상태 칩 `모집 중/진행 중/일시정지/종료`·제목·선수 n/max·접속 n명·바로 입장/관전하기, 모집 중은 왼쪽 초록 선). 키보드: 탭·게임 카드·싱글게임 버튼·방 카드 각 묶음 안에서 방향키로 이동(끝에서 처음으로), Enter/Space로 누름, Tab은 그대로 묶음 밖으로(app.js `ARROW_GROUPS`).
- 3 게임방 공통 틀: 같은 Esc 메뉴가 게임방에서도 열리고 맨 위에 「로비로 돌아가기」(기존 상단 버튼을 누름). 휴대폰 옆 패널이 열려 있으면 Esc는 그것부터 닫는다. 아무 데도 초점이 없을 때 Enter는 방 채팅 입력으로, 채팅에서 Esc는 입력에서 빠져나옴(다음 Esc가 메뉴). 결과 카드는 Esc·Enter로 바로 닫힘(클릭은 전처럼 아래 판으로). 다빈치 코드 선택 창 Esc는 메뉴를 열지 않는다. 상단 표시줄·판 카드 여백을 줄여 판을 넓혔다. 정보 순서(차례·시간·최근 행동·할 수 있는 행동)는 기존 `statusRow`가 이미 그 순서라 유지. 게임별 재대국·결과 흐름은 게임마다 달라 이번에 하나로 합치지 않았다.
- 4 주민 대화: 주민·퀘스트·분실물·시장·다른 사람 메뉴의 말을 화면 아래 말풍선으로(같은 `#plazaDialog`에 `talkMode`, 뒤 배경 투명, 이름표·꼬리). 대사는 한 줄씩: Space/Enter(또는 말풍선 터치)로 다음 줄, 다 나오면 초점 답을 누름, ↑↓로 답 고르기, 1~9로 바로 답, Esc 닫기.
- 5 몰입형 대화 카메라: 말을 걸면(plaza-scene `interact`가 상대 위치 기억) 카메라가 내 오른쪽 어깨 뒤로 부드럽게(약 0.5초) 들어가 서로 마주 보고(이벤트 주민도 나를 향함), 퀘스트 받기·완료·보상·부탁 수락은 옆에서 둘을 담는 투샷. 대화 창이 닫히면 내 시점(`zoomDist` 그대로)으로 돌아온다. 동작 줄이기 설정이면 미끄러짐 없이 바로 바뀜. 6m 넘게 떨어졌거나 기차·전체 지도 중이면 바꾸지 않음.
- 검증: e2e 새 「Esc 메뉴」(PC: Esc 열기/닫기, 채팅 입력 중 미동작, 테마 유지, 내 정보로 넘어감)·mobile-island ☰ 메뉴, 내 정보를 쓰던 기존 e2e 6곳은 Esc 뒤 클릭으로. 밝은/어두운 화면을 섬·메뉴·내 정보·가방·게임관·오목 방·휴대폰에서 눈으로 확인.

## v1.10.62 휴대폰 아일랜드 조작

- 지시(사용자, 2026-10-11): 휴대폰에서도 아일랜드를 조작할 수 있게(IDEAS 「모바일 아일랜드 조작 지원 · 최우선」). AGENTS §7의 모바일 미고려 문구를 이 결정으로 바꿨다.
- 원인: `app.js`의 `plazaFits`(폭 600px 이상·터치 전용 아님)가 휴대폰을 기존 로비로 보냈고, 이동(방향키)·상호작용(Space)·채팅 입력(Enter)이 키보드에만 있었다. 시점 끌기와 시설 클릭은 포인터 이벤트라 터치에서도 이미 동작했다(캔버스 `touch-action:none`).
- 변경: 진입 조건 제거. 터치 전용 기기(`rpgTouchOnly`, body `touchIsland`)에 왼쪽 아래 조이스틱(`#islandStick`, 가방·사진 위, 데드존 20%)과 오른쪽 아래 행동 버튼(기존 `#plazaHint`를 누를 수 있게, SPACE 표기 없이). `plaza-scene`에 `setStick`(시점 기준, 방향키와 합산, 앉아 있으면 일어남)·`act`(Space와 같은 `interact(near)`). 스틱은 포인터 캡처라 다른 손가락의 시점 끌기와 동시에 된다. 채팅 탭이 입력창도 열고(전송 뒤 다시 누르면 다시 입력), 채팅 창·입력 폭을 화면에 맞췄다. 시설 창 격자 최소 폭을 `min(340px,100%)`로 해 휴대폰 창의 가로 넘침을 없앴다(PC 배치는 그대로).
- 사용자 확인 중 보완: 창을 좁히면 게임방용 💬·🎮 떠 있는 버튼이 섬 위에 나타나던 것을 섬에서는 숨김(`body.plazaMode`). 가로로 돌리면 섬 높이(최소 520px)·상단 표시줄 때문에 화면 밖으로 넘쳐 조이스틱·행동 버튼이 보이지 않던 것을, 터치 기기에서는 섬을 화면 높이(`100dvh`)에 맞추고 상단 표시줄을 얇게, 낮은 화면(높이 500px 이하)에서는 지도·조이스틱을 작게 해 해결(세로·가로·회전 중 모두 스크롤 없음, e2e에 회전 확인 추가).
- 추가 지시(사용자 2026-10-11): ⑧ 전체화면 — 계정 표시줄 「전체화면/창 모드」(페이지 전체 `requestFullscreen`, 창·대화상자 그대로 열림, Esc·뒤로 가기로 나와도 글자 따라감, 지원 안 하는 브라우저는 숨김). ⑨ 확대·축소 — 카메라 거리는 사용자 몫(PC 휠, 휴대폰 두 손가락 벌리기/좁히기, 6~26, 기본 13.1, 브라우저별 `gc.islandZoom` 기억). 건물에 등을 대면 당기던 자동 확대(`cameraDistance`, CAM_MIN)는 지우고, 같은 거리에서 CAM_OVER로 지붕 위로 올라가 건물을 반투명으로(기존 「건물 안 카메라 없음·4m 이상」 검사 그대로 통과). 앞으로의 몰입형 상호작용 카메라(IDEAS 2026-10-10)는 자기 시점으로 갔다가 이 사용자 거리로 돌아오게 하면 된다(`zoomDist`와 실제 `camDist` 분리). 휴대폰 계정 표시줄은 버튼이 늘어 두 줄로 넘치던 것을 한 줄로.
- 제외: 아이폰(Chrome도 WebKit `CriOS`)은 기존 「Chrome 전용」 입장 규칙으로 막힌 그대로. 수집 대기 중 Esc 취소, 상단 계정 표시줄 축소, 휴대폰 성능(그래픽 등급)은 손대지 않았다.
- 검증: Pixel 7 크기·터치 에뮬레이션 Chromium에서 진입·성별 선택·스틱 상하좌우 이동(1초 약 5m)·놓으면 정지·두 손가락(스틱+시점) 동시·「앉기」 탭→앉음→스틱으로 일어남·게시판/게임관/옷가게/가방 창 폭(가로 넘침 없음)·채팅 입력/전송. e2e `mobile-island.spec`(모바일 전용) 통과, PC `plaza.spec` 시설·방향키·채팅·시점 4건과 `island-entry`·`rpg-touch-only`·`entry-and-lobby` 양 프로필 통과(이 PC에서는 3D 페이지 병렬 실행 시 시간 초과가 나 1개씩 실행). npm 784 중 778(기존 6건 동일). 실제 휴대폰 미검증.

## v1.10.61 두 세계 영웅전 연결

- 지시(사용자, 2026-10-11): 허가받은 외부 Godot 웹 게임 「두 세계 영웅전」을 게임센터에 직접 운영(B안). 원본 소스 없이 빌드 결과물만 있다(Godot 4.7.2, 스레드 끔).
- 페이지 `/herosurv/`(`public/herosurv/`): 엔진 파일은 그대로, 내보내기 HTML의 인라인 스크립트·스타일은 `boot.js`·`herosurv.css`로 옮겨 CSP를 지킨다. 게임이 `JavaScriptBridge.eval`로 묻는 고정 식 5개(주소·경로·검색어, Manus 기록 호스트 2개)는 `boot.js`가 답해 `unsafe-eval` 없이 동작한다. Manus 전용 BGM 스니펫 eval만 거부되어 BGM이 없다(소리 없는 PC 기준 유지).
- 큰 파일 2개(pck 72MB, wasm 39MB → brotli 8MB)는 R2 버킷 `gamecenter-games`에 sha256 이름으로 두고 Worker `gamecenter-games`(`ops/herosurv-assets/`, Workers Cache, 1년 immutable, CORS는 게임센터 주소만)가 내보낸다. 서버는 `HEROSURV_ASSETS`(기본 이 Worker) 주소를 페이지에 넣고 이 페이지 CSP `connect-src`에만 더한다. 빈 값이면 `public/herosurv/` 로컬 사본(gitignore)을 읽는다. 브라우저는 처음 한 번 받고 HTTP 캐시를 쓴다. 서비스워커 선받기 대상(`assets`·`hwatu`)에는 넣지 않았다.
- 랭킹: 게임이 부르는 `/api/leaderboards/v1/`(guests·me·boards/:id·boards/:id/runs·runs/:id)를 서버가 구현한다. 로비 버튼이 탭의 세션 토큰을 `sessionStorage.herosurvSession`에 넘기고 `boot.js`가 게임의 호출에 `X-Session-Token`을 붙인다. 표시 이름은 게임센터 닉네임(게임이 보내는 이름·메일은 쓰지 않고 저장하지 않음). 판 ID는 서버 메모리, 판당 1회(저장 실패 시 재제출 가능), 실제 경과보다 긴 기록 거부. 계정·보드별 최고 기록만 `herosurv_best`(PostgreSQL)·`herosurv`(JSON)에 둔다. 점수는 게임 보고값이라 포인트·미션과 연결하지 않는다.
- 게임 위 「나가기」(왼쪽 아래, 게임 화면에서 비어 있는 자리): 확인 창 뒤 `/`로 이동(게스트는 세션 이어짐), 버튼이 포커스를 갖지 않아 게임 키(Space 필살기)는 캔버스에 남는다. 사용자 확인 1~4 성공 뒤 추가 요청.
- Worker CORS는 항상 `*`: Workers Cache가 Origin과 무관하게 한 사본을 내보내, Origin별 헤더는 처음 채운 요청(헤더 없는 사본)을 따라가 페이지가 「Failed to fetch」로 멈췄다(사용자 실기에서 발견, 재배포 d45cb45d로 해결).
- Codex 검토 3건 반영: PostgreSQL 동시 첫 기록에서 낮은 점수가 덮어쓰던 문제(upsert 안에서 비교), 저장 실패 뒤 판 ID 소실, 관리자 세션 미전달.
- 검증: `test/herosurv.test.js` 3/3(JSON·PostgreSQL 저장, API 닉네임·판당1회·시간 초과·남의 판·페이지 CSP). 로컬 서버+실제 게임 파일 Chromium으로 로비→게임→한 판→기록·명예의 전당(닉네임·「나」)·뒤로 가기 로그인 유지, R2 Worker 경유 로드(두 파일 200, sha256 일치, 두 번째 요청 CF-Cache HIT). 전체 npm 784 중 778 — 실패 6건은 이 PC에서 수정 전 main도 같은 기존 실패(원인 미확인). 실제 운영·모바일·다인 실기 미검증.
