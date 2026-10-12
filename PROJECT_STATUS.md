# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.66 홈 화면 앱(아이폰·안드로이드)

- 지시(사용자 2026-10-12): 아이폰은 페이지 전체화면이 안 되므로 「홈 화면에 추가」로 앱처럼 열리게, 안드로이드도 같이. 아이콘은 기존 에셋에 섬 그림이 없으면 섬 그림으로 — 기존 미리보기는 에셋 견본판, 게임 안내 지도는 글자·선로가 섞여 있어, 섬 실제 해안선·개울·연못·광장(`island-terrain.js`)으로 새로 그림. 바다색 네모 위 섬(아이폰은 항상 둥근 네모, 안드로이드 런처는 모양을 자르므로 네모가 바다).
- 변경: `public/manifest.webmanifest`(standalone — 상단 표시줄은 남기는 앱 모드, 시작 `/`, 아이콘 192·512·maskable 512), `index.html` manifest·아이콘·아이폰 웹앱 meta, 서버 MIME `.webmanifest`. 아이콘 생성 `tools/make-app-icons.js`(섬 모양 SVG → Playwright로 PNG, 섬 모양이 바뀌면 다시 실행). 메뉴 환경설정: 전체화면을 못 하는 곳(`document.fullscreenEnabled` 없음 = 아이폰)에는 전체화면 버튼 대신 「홈 화면에 추가」 안내, 홈 화면으로 연 상태(`display-mode: standalone`)에서는 숨김. 안드로이드 Chrome은 기존 전체화면 버튼 그대로. Codex 지적 반영: 아이폰 홈 화면 앱의 user agent는 `Mobile/…`로 끝나고 Safari 표시가 없어 v1.10.65 판별기가 막았으므로 그 형태도 `ios`로(앱 내 브라우저는 뒤에 자기 이름이 붙어 제외).
- 주의: 홈 화면 앱은 브라우저 탭과 저장소가 따로라 처음 한 번 다시 로그인할 수 있다. 실제 아이폰·안드로이드 홈 화면 추가 미검증.
- 검증: `test/home-app.test.js`(manifest MIME·standalone·maskable, 아이콘 4개 PNG 200), e2e 「메뉴: 홈 화면에 추가 안내」(전체화면 지원 시 버튼, 미지원 시 안내).

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
