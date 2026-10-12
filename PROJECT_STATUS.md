# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.68 순발력 게임 5종(한판마당 자료)

- 지시(사용자 2026-10-12): 한판마당에서 받은 자료를 아일랜드에 적용 — 여러 번에 나눠 배포, 첫 묶음은 「반응 5종 먼저」(사용자 선택). 결정 근거: 비공개 IDEAS 「한판마당 · 자료 적용 결정」(반응·카드 게임 포인트 지급은 서버 검증 필수, 효과음 기본 켬·끄기 설정).
- 자료: `public/reflex/js/` 아래는 한판마당 원본 그대로(공통 엔진 `engine.js`·`audio.js`(Web Audio 합성, 음원 파일 없음)·`native.js`·`util.js`·`icons.js`·`levels.js`·`store.js`, 게임 `games/{whack,reaction,colorfind,numbers,rhythm}.js`). 출처·허락·안전 확인은 비공개 `docs/hanpanmadang-share-20261012.md`.
- 화면: 게임 선택 → 싱글게임 → 「순발력 게임」(`#soloReflexBtn`) → 섬 위 전체 화면 `#reflexView`(PC는 가운데 세로 틀 560px, 휴대폰은 꽉 차게; 두 테마 모두 어둡게). `public/reflex/reflex.js`가 목록(게임 색 카드·자료의 아이콘) → 게임(방법·난이도·포인트·내 최고·시작) → 판(엔진 캔버스·HUD, ✕ 그만두기) → 결과(점수·최고 기록·받은 포인트·통계·다시 하기/다른 게임). 처음 열 때 모듈을 불러온다(`import('/reflex/reflex.js')`). Esc: 판 → 게임, 결과 → 게임, 게임 → 목록, 목록 → 아일랜드. 반응속도는 Space·Enter, 비트 탭은 D F J K도 됨(자료 그대로). 효과음 켬/끔은 기기별 `localStorage gc.settings.sound`(자료의 Settings), 난이도는 `gc.reflexLevels`.
- 서버(`lib/reflex.js`, `server.js` `/api/solo/reflex`·`/start`·`/finish`): 점수는 브라우저가 계산하므로 서버가 판을 열고(id·시작 시각, 메모리, 1시간) 결과를 한 번만 받는다. 지급 조건 — 실제 걸린 시간 ≥ 게임 최소 시간(두더지·다른 색 15초, 반응속도 7초, 비트 탭 20초, 숫자 터치는 외우기 시간 + 한 칸 0.1초 — 오답 벌칙 초는 실제 시간이 아님), 점수가 사람이 낼 수 있는 범위(범위 밖은 400 거부: 반응속도 100ms 미만, 숫자 터치 한 칸 0.1초 미만 등), 최소 노력(두더지 100점·다른 색 5라운드·비트 탭 3,000점 미만은 0P). 지급 쉬움 1,000 / 보통 1,500 / 어려움 2,000P(반응속도는 보통 하나), 다섯 게임 합쳐 계정·서울 날짜당 20,000P. 기록은 지뢰찾기와 같은 `soloClear`(정산 `solo:<판 id>` 한 번, 사유 `solo_game`)에 `higher`(높을수록 좋은 기록)·`daily`(하루 상한)를 더함 — JSON `soloDaily`, PostgreSQL 새 표 `solo_daily(user_id, day, paid)`.
- 한계(의도): 반응 게임은 판 재생 검증이 불가능해 시간·범위·상한으로만 막는다(조작 시 하루 최대 20,000P). 판 진행 중 서버 재시작이면 그 판은 보상 없음.
- AGENTS.md §7 「효과음·BGM 넣지 않는다」에 한판마당 게임 예외를 동기화.
- Codex 검토 3건 반영: 숫자 터치 벌칙 초를 실제 경과 시간으로 요구하던 것, 시작 응답이 늦을 때 떠난 화면에서 게임이 시작되던 것(요청 번호로 무효화·난이도 고정), 정보 조회 응답이 진행 중인 화면을 목록으로 되돌리던 것.
- 검증: `test/reflex-server.test.js`(판정 규칙, JSON·PostgreSQL 저장소 하루 상한·높을수록 기록, API 너무 빠름 0P·범위 밖 400·한 번만·남의 판 409·노력 부족 0P), e2e `reflex.spec.js`(PC·휴대폰 프로필: 목록 5종, 판 중간 그만두기, 반응속도 5라운드 실제 완주 → +1,500P·잔액, Esc/나가기). 다섯 게임 PC 1280×800·휴대폰 390×844 화면 확인(스크린샷). 실제 휴대폰 미검증.

## v1.10.67 이름 「아일랜드」로 통일·휴대폰 조이스틱 위치·크기

- 지시(사용자 2026-10-12): 모든 곳에서 「게임센터」를 빼고 「아일랜드」로 통일.
- 변경(화면에 보이는 곳): 브라우저 탭 제목·첫 화면 큰 제목·아이폰 홈 화면 제목(`index.html`), 홈 화면 앱 이름·짧은 이름(`manifest.webmanifest`), 게임방 탭 제목 「○○ · 아일랜드」·내 차례 알림 제목·채팅/게임 진행 팝업 제목(`app.js`), 입장 파일 이름 「아일랜드 - 닉네임.html」·파일 안 제목·버튼 「아일랜드 입장하기」(`lib/security.js`), 고스톱 규칙의 「아일랜드 포인트」(`app.js`·`lib/games/gostop.js`), 경제 개편 이벤트 제목(`lib/point-events.js`). 과거 공지 본문·코드 주석·저장소 이름(omok-live)·문서의 「Game Center」 프로젝트명은 그대로.
- 주의: 이미 홈 화면에 추가한 앱은 기기에 따라 지우고 다시 추가해야 이름이 바뀐다. 이미 받은 입장 파일은 이름만 옛것이고 그대로 쓸 수 있다.
- 조이스틱 위치·크기(사용자 2026-10-12, 이름 통일과 한 번에 배포): 메뉴(☰) → 환경설정 → 「조이스틱 위치·크기」(터치 화면에서만) → 조정 모드(조이스틱에 노란 점선, 위쪽 막대). 조이스틱을 끌어 옮기고 막대의 슬라이더로 크기 80~180px, 「기본값」·「완료」. 위치는 섬 화면 대비 비율(가로·세로 돌려도 같은 자리), 크기·위치는 기기별 `localStorage gc.stick`. 조정 중에는 걷지 않는다. 손잡이 크기는 조이스틱의 43%(`--stick-knob`). 검증: mobile-island 「모바일 조이스틱」(끌어 옮김·걷지 않음·크기 160·새로고침 유지·기본값 복귀).
- 검증: e2e 「일반 주소」 탭 제목, turn-alert 「오델로 · 아일랜드」·알림 제목, `test/security.test.js` 파일 이름.

## v1.10.66 홈 화면 앱(아이폰·안드로이드)

- 지시(사용자 2026-10-12): 아이폰은 페이지 전체화면이 안 되므로 「홈 화면에 추가」로 앱처럼 열리게, 안드로이드도 같이. 아이콘은 기존 에셋에 섬 그림이 없으면 섬 그림으로 — 기존 미리보기는 에셋 견본판, 게임 안내 지도는 글자·선로가 섞여 있어, 섬 실제 해안선·개울·연못·광장(`island-terrain.js`)으로 새로 그림. 바다색 네모 위 섬(아이폰은 항상 둥근 네모, 안드로이드 런처는 모양을 자르므로 네모가 바다).
- 변경: `public/manifest.webmanifest`(standalone — 상단 표시줄은 남기는 앱 모드, 시작 `/`, 아이콘 192·512·maskable 512), `index.html` manifest·아이콘·아이폰 웹앱 meta, 서버 MIME `.webmanifest`. 아이콘 생성 `tools/make-app-icons.js`(섬 모양 SVG → Playwright로 PNG, 섬 모양이 바뀌면 다시 실행). 메뉴 환경설정: 전체화면을 못 하는 곳(`document.fullscreenEnabled` 없음 = 아이폰)에는 전체화면 버튼 대신 「홈 화면에 추가」 안내, 홈 화면으로 연 상태(`display-mode: standalone`)에서는 숨김. 안드로이드 Chrome은 기존 전체화면 버튼 그대로. Codex 지적 반영: 아이폰 홈 화면 앱의 user agent는 `Mobile/…`로 끝나고 Safari 표시가 없어 v1.10.65 판별기가 막았으므로 그 형태도 `ios`로(앱 내 브라우저는 뒤에 자기 이름이 붙어 제외).
- 주의: 홈 화면 앱은 브라우저 탭과 저장소가 따로라 처음 한 번 다시 로그인할 수 있다. 실제 아이폰·안드로이드 홈 화면 추가 미검증.
- 검증: `test/home-app.test.js`(manifest MIME·standalone·maskable, 아이콘 4개 PNG 200), e2e 「메뉴: 홈 화면에 추가 안내」(전체화면 지원 시 버튼, 미지원 시 안내).

