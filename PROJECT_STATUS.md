# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.65 아이폰 접속 허용

- 지시(사용자 2026-10-12, 최우선·확인 없이 배포): 아이폰에서도 되게(IDEAS 「아이폰 허용」 2026-10-12 확정).
- 원인: 입장 규칙이 Google Chrome 전용(`public/browser-gate.js` 판별 + `server.js` `ALLOWED_BROWSERS`)인데 아이폰은 Safari·Chrome(`CriOS`) 모두 WebKit이고 Client Hints가 없어 `other`로 막혔다.
- 변경: user agent가 iPhone/iPad/iPod + AppleWebKit이고 `CriOS/` 또는 `Version/… Safari/`(Safari)면 `ios`로 판별(Edge iOS는 기존대로 `edge`, Firefox·Whale·카카오톡 등 앱 내 브라우저는 `other`). 운영 기본 허용을 `chrome ios`로. 안내 문구에 「아이폰은 Safari·Chrome」. 전체화면 버튼은 `document.fullscreenEnabled`가 없는 아이폰 Safari에서 이미 숨겨진다. 터치 조작(v1.10.62)·`dvh` 높이·아이디 로그인(v1.10.63)은 그대로 쓴다.
- 제외·주의: iPadOS의 「데스크톱 웹사이트」 모드(Mac Safari로 보임)는 `other`로 남는다. 아이폰에서 입장 파일(.html)을 여는 방식은 확인하지 않았다(아이디 로그인 권장). **실제 아이폰 미검증** — 확인 전 지원 완료로 표시하지 않는다.
- 검증: `test/browser-gate.test.js` 아이폰 Safari·Chrome·iPad=ios, iOS Edge=edge, iOS Firefox·Whale·카카오톡·Mac Safari=other.

## v1.10.64 게임방 조작 정리 (사용자 확인 후속)

- 지시(사용자 2026-10-12, v1.10.63 배포 뒤): ③ 게임방에서 Tab이 게임 밖으로 넘어가지 않게 ④ 게임방 상단 「접속 종료」 제거(Esc 메뉴에만) ⑤ 대화 말풍선 「닫기」도 방향키로 ⑥ 휴대폰 긴 화면 아래 파란 동그라미 제거.
- Tab: 게임방이 보이고 열린 창이 없을 때, 방 안의 보이는 조작 요소(+ 💬·🎮 떠 있는 버튼)를 한 고리로 — 마지막에서 Tab은 처음으로, 처음에서 Shift+Tab은 마지막으로(app.js `FOCUSABLE`). 중간은 브라우저 기본 순서.
- 접속 종료: 게임방 상단 버튼을 「☰ 메뉴」(`#roomMenuBtn`, Esc 메뉴를 엶)로 바꿈 — 접속 종료는 메뉴 안에만, 휴대폰은 이 버튼으로 메뉴.
- 말풍선 방향키: 답들 다음에 「닫기」까지 한 고리(↑↓←→), 숫자 1~9는 답에만. 「닫기」에 초점일 때 Space/Enter는 닫기를 누름.
- 파란 동그라미: 게임방 좁은 화면용 💬·🎮(`.chatFloatBtn`)을 `body.roomMode`일 때만 보이게(첫 화면·로비·섬에서 숨김; showView가 `roomMode`를 붙임).
- 검증: e2e 「일반 주소」(PC·모바일: 첫 화면에 💬·🎮 없음), 「게임방: Esc 메뉴와 Enter 채팅」(접속 종료 버튼 없음·☰ 메뉴에 접속 종료·Tab 60번이 방 밖으로 안 나감·Shift+Tab), 「주민 대화」(↑로 닫기, ↓로 첫 답).

## v1.10.63 통합 UI 개편·아이디 로그인 (Esc 메뉴·밝은 테마·게임 홀·게임방 틀·주민 대화·대화 카메라·아이디·비밀번호)

- 지시(사용자 2026-10-11, IDEAS 「통합 UI」 범위 조정): 계정 표시줄을 없애고 다른 게임처럼 Esc 메뉴, 테마는 어두운 기본·밝게·기기 설정 선택.
- 메뉴: `#gameMenuDialog`(내 정보·관리자 창·환경설정[테마 3택·전체화면]·접속 종료). Esc는 섬/로비에서 열린 창·입력 중·사진 모드·채집 중이 아닐 때만 연다(채집 중 Esc는 기존 취소). 휴대폰은 섬 왼쪽 위 ☰(채팅 탭은 오른쪽으로). 메뉴에서 다른 창을 열면 메뉴는 닫힌다. 섬 높이는 표시줄이 빠진 만큼 늘었다(PC `100vh - 40px`, 터치 `100dvh - 12px`).
- 테마: `<html data-theme>`를 app.js 시작에서 정한다(`gc.theme`, 기기 설정은 `prefers-color-scheme`를 따라 바뀜). 밝은 테마는 `tools/theme-light.js`가 `styles.css`에서 어두운 UI 팔레트를 쓰는 선언만 골라 글자색/바탕·선 색을 역할별로 바꾼 `theme-light-auto.css`(592규칙)를 만들고, 손보정은 `theme-light.css`. 각 게임 판·카드 그림의 고유 색은 대상 아님. `test/theme-light.test.js`가 생성 파일이 최신인지 확인. DESIGN.md에 두 테마 규칙.
- 게임 선택(사용자 2026-10-11 추가): 게임 목록을 「멀티게임 / 싱글게임」 탭으로, 멀티게임은 「대전게임 / 협동게임」 탭으로(index.html `data-game-pane`·`data-kind`, app.js `showGameTab`, `gc.gameTab` 기억, 첫 방문은 멀티·대전). 협동 = 팬데믹(다 함께 승패)·스무고개(협동전 모드), 대전 = 나머지 13개, 구현 중(랜드킹·잿빛 원정)은 멀티게임 아래 그대로. 고른 게임이 없는 종류로 바꾸면 그 종류의 첫 게임을 고른다(보이지 않는 게임의 방이 만들어지지 않게). 싱글게임에서는 방 만들기·참가를 숨긴다. e2e 「게임 선택」은 관리자 로그인 2번이라 자기 주소(X-Forwarded-For)로 — 같은 주소 15분 5회 제한에 다른 테스트가 걸리지 않게.
- 2 게임 홀: 공개방 목록을 카드로(게임 배지·상태 칩 `모집 중/진행 중/일시정지/종료`·제목·선수 n/max·접속 n명·바로 입장/관전하기, 모집 중은 왼쪽 초록 선). 키보드: 탭·게임 카드·싱글게임 버튼·방 카드 각 묶음 안에서 방향키로 이동(끝에서 처음으로), Enter/Space로 누름, Tab은 그대로 묶음 밖으로(app.js `ARROW_GROUPS`).
- 3 게임방 공통 틀: 같은 Esc 메뉴가 게임방에서도 열리고 맨 위에 「로비로 돌아가기」(기존 상단 버튼을 누름). 휴대폰 옆 패널이 열려 있으면 Esc는 그것부터 닫는다. 아무 데도 초점이 없을 때 Enter는 방 채팅 입력으로, 채팅에서 Esc는 입력에서 빠져나옴(다음 Esc가 메뉴). 결과 카드는 Esc·Enter로 바로 닫힘(클릭은 전처럼 아래 판으로). 다빈치 코드 선택 창 Esc는 메뉴를 열지 않는다. 상단 표시줄·판 카드 여백을 줄여 판을 넓혔다. 정보 순서(차례·시간·최근 행동·할 수 있는 행동)는 기존 `statusRow`가 이미 그 순서라 유지. 게임별 재대국·결과 흐름은 게임마다 달라 이번에 하나로 합치지 않았다.
- 4 주민 대화: 주민·퀘스트·분실물·시장·다른 사람 메뉴의 말을 화면 아래 말풍선으로(같은 `#plazaDialog`에 `talkMode`, 뒤 배경 투명, 이름표·꼬리). 대사는 한 줄씩: Space/Enter(또는 말풍선 터치)로 다음 줄, 다 나오면 초점 답을 누름, ↑↓로 답 고르기, 1~9로 바로 답, Esc 닫기.
- 5 몰입형 대화 카메라: 말을 걸면(plaza-scene `interact`가 상대 위치 기억) 카메라가 내 오른쪽 어깨 뒤로 부드럽게(약 0.5초) 들어가 서로 마주 보고(이벤트 주민도 나를 향함), 퀘스트 받기·완료·보상·부탁 수락은 옆에서 둘을 담는 투샷. 대화 창이 닫히면 내 시점(`zoomDist` 그대로)으로 돌아온다. 동작 줄이기 설정이면 미끄러짐 없이 바로 바뀜. 6m 넘게 떨어졌거나 기차·전체 지도 중이면 바꾸지 않음.
- 사용자 확인 반영(2026-10-12): 게임관 창 공개방 카드 여백, 방에서 「게임 선택으로」 나오면 섬에서 게임관 창이 바로 열림, 말풍선에서 Space/Enter가 누를 것(초점 답·닫기, 말풍선 자체 초점이면 첫 답)을 테두리로 강조하고 키는 문서 전체에서 받음(대화 중 섬을 눌러도), 카메라는 문 좌표 대신 상대의 실제 위치(이벤트 주민·다른 플레이어·시장)를 잡고 내 어깨 뒤 옆으로 비켜 상대 얼굴·상반신이 말풍선 위에 오게, 1.6m보다 붙어 있으면 내가 1.6m로 물러섬(이벤트 주민·플레이어만, 대화 거리 1.9 안), 대화 중에는 상대·나의 고개 돌리기를 꺼 얼굴이 옆으로 꺾이지 않게. 투샷은 뒤쪽에서 넓게.
- 아이디·비밀번호 로그인(IDEAS 2026-10-11 확정, 위험 변경): 입장키 행에 `login_id`(소문자 저장, 대기 신청 포함 하나의 UNIQUE)·`password_hash`(scrypt+솔트)·`real_name`·`pending_at`(가입 신청 = 대기 행, 계정 목록·입장에서 제외). 첫 화면은 로그인/회원가입(이름·아이디[중복 확인]·비밀번호·확인·닉네임) 탭, 관리자 로그인은 아래 작은 줄(기존 e2e 31곳이 그 칸을 그대로 씀). 로그인 → 내 계정(게임 접속·입장 파일 받기·비밀번호 변경·로그아웃), 계정 토큰은 서버 메모리 12시간·탭 sessionStorage. 게임 접속은 `/guest-entry`에 계정 토큰을 보내 입장 파일과 같은 입장(동시 접속 차단·방 복귀 동일). 입장 파일 받기는 확인창 뒤 재발급(이전 파일 무효). 아이디 없는 계정이 입장 파일로 오면 설정 표(15분)로 아이디·비밀번호 설정 뒤에만 입장(test 환경은 `/api/test/account-setup`으로 키별로 켬). 관리자: 가입 신청 승인/거절, 계정 상세에 아이디·이름, 비밀번호 초기화(임시 비밀번호 1회 표시, 그 계정 로그인 종료). 시도 제한: 중복 확인 30/10분, 가입 5/시간, 로그인 주소·아이디별 10/15분, 설정 10/15분, 비밀번호 변경 10/15분, 파일 발급 5/시간. 서버 재시작 시 로그인은 다시(계정 토큰은 메모리).
- 검증: e2e 새 「Esc 메뉴」(PC: Esc 열기/닫기, 채팅 입력 중 미동작, 테마 유지, 내 정보로 넘어감)·mobile-island ☰ 메뉴, 내 정보를 쓰던 기존 e2e 6곳은 Esc 뒤 클릭으로. 밝은/어두운 화면을 섬·메뉴·내 정보·가방·게임관·오목 방·휴대폰에서 눈으로 확인.
