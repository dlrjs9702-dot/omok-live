# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.103 달마루섬 개편 2~4단계(관리자 미리보기): 길·건물·구조물, 영웅마루 조각상, 관광열차 고리

- 근거: gamecenter-notes `docs/dalmaru-implementation-20261019.md`, 확정 순서(사용자 2026-10-19) 3 — 단계마다 미리보기 뒤에 두고 자동 검사로 확인(사용자 「단계마다 확인하기 곤란한 환경이라 일단 구현하는 걸로」). 모두에게 바꾸는 것은 5단계.
- 2단계: `dalmaru-terrain.js` `PLACES`(시설·주민·퀘스트·할로윈 자리) + `dalmaru-island.js` 길(`WALKS`·`tier`)·다리(윤슬다리 아치, 강 다리)·능선 계단(경사면 채움)·부두·배 타는 곳·마을(이웃골 집 10)·박물관·농부 밭, 관공서·백화점은 절벽 정면(assets 55 `facade.*`, 30×14, 절벽에서 4.6m). `plaza-scene` `mapCheck()`(보이는 것 = 막는 것, 뜨거나 묻힌 것, 문·집·명소까지 걸어서 닿는지) + `dalmaru-walk.spec`.
- 3단계: 영웅마루 홈 7칸(55 `niche.hero`) — 기부 1·2위·주말 대회 우승자 캐릭터를 손 흔드는 자세로 굳혀 한 메시·한 돌 재질로 굽기(모델이 늦게 오면 다시), 이름판 「제 ○주 기부 ○위」, 새로 새길 때 먼지, 빈 홈 「곧 새겨질 자리」. 굽기는 위치만 이어 붙여 덧붙임 모듈을 받지 않음(모델 없는 섬은 아무것도 더 받지 않는 시험 그대로).
- 4단계: `island-train.js` 달마루섬 노선 — 바깥 고리(r 184, 바다 위) + 역 4곳(달끝역·툇마루역·초승역·영웅마루역, 역 앞 직선을 안쪽으로 당겨 승강기가 땅 위), 구간 시간은 길이대로, 4대가 1/4 바퀴 간격. 지금 섬 8자 노선은 그대로.
- 검증: 단위 전체(두 섬 — Windows 줄바꿈 6개 제외), e2e dalmaru-walk·dalmaru-preview·plaza(지금 섬). Codex 검토 대기(사용량 한도 10/25).

## v1.10.102 건물 안 날씨 끔(bugs 9)

- 근거: gamecenter-notes `docs/bugs-20261019.md` 9(사용자 「실내에서 눈이나 비가 와」), 구현 순서 3-2(지도 무관, 바로).
- `plaza-scene.js`: 실내 판단 하나(`indoors`, 공간이 바뀌는 `setSpace` 한 곳에서 — 민원실·백화점, 나중의 달마루섬 절벽 정면 안·내 집도 같은 곳으로) → 비·눈 입자(`stepWeather`), 계절 낙엽·눈송이(`assets.tick`의 ambient 멈춤), 무지개 띠, 비 오는 하늘·안개 어둡게(`lightKey`에 `wet`)가 모두 따름. 섬으로 나오면 다시 켬. 빗소리는 따로 없음(확인).
- 시험: island-weather에 「비 날씨로 백화점에 들어가면 indoors·비·눈·무지개·낙엽 0」(고치기 전 코드에서 실패 확인). `PlazaDebug().weather()`에 `indoors`·`flakes`.
- 검증: island-weather·island-time e2e, 단위 전체(Windows 줄바꿈 6개 제외). Codex 검토 대기(사용량 한도 10/25).

## v1.10.101 꾸미기 창 새 단장(3-1): 참고 그림 모양·큰 미리보기·착용 전후, 스킨 선물

- 근거: gamecenter-notes 확정 순서(사용자 2026-10-19) 5 — 3-1 상점·내 정보 입어 보기 통일을 달마루 단계 사이에. 모양은 사용자 참고 그림(`docs/img/shop-ui-reference-20261019.webp`, 사용자 선택 「1」), 그림 에셋 assets 56(`public/assets/shop/ui/`).
- 꾸미기 창(`app.js` `dressView`·`dressParts`·`dressStart`): 상점 7곳(스킨·옷·소품·미용실·성형외과·염색사·변신 의상실)과 내 정보가 한 틀 — 나무 간판 제목, 왼쪽 목록(카드에 마우스를 올리면 미리보기, 누르면 선택·초록 테두리), 오른쪽 큰 미리보기(정원 배경, ⟲·＋·－, 정면·옆·뒤·걷기 ‹ › 점), 「착용 전 → 착용 후」 비교(`tryOnShot`: 따로 그리는 렌더러로 한 장씩), 상세, 아래 버튼 줄(포인트·구매·착용·선물하기·닫기 — 구매·착용은 카드 버튼을 그대로 누름). 휴대폰(700px 이하)은 한 줄, 버튼 줄은 아래에 붙음. 얼굴·염색·변신 카드도 같은 미리보기(`lookTried`·`tfDress`).
- 스킨 선물(사용자 2026-10-19 「선물 허용으로」「우체국으로 쪽지 오는걸로」, 결정 「1」): 상점 「선물하기」 → 받는 사람(우체통 목록)·쪽지 → 확인 → `POST /api/skins/gift`(IP 스킨 거절 → 받는 사람 확인(나 자신 안 됨) → 하루 횟수·요청 번호를 퀘스트 문서 `skinGifts`에 먼저 잡음(같은 요청은 한 번만, 경제 값 `gift:skinPerDay` 기본 5) → 이미 가졌으면 되돌림 → `pointStore.giftSkin`(주는 사람 원장 `skin_gift` 「선물 ○○ → △△」, 받는 사람 소유, JSON·PG 둘 다) → 받는 사람 우체통 쪽지(🎁 선물받은 스킨) → 알림). 받는 사람을 고르면 `/api/skins/gift/check`로 「이미 가지고 있어요」. 규칙은 `lib/skins.js` 머리말.
- 고침(gamecenter-notes bugs-20261019 10, 「상점 창이 한번 열면 다른 거 할 때도 계속 떠」): 섬 창(`openPlazaWindow`)은 열 때도 닫을 때도 같은 정리(`sendPlazaHome`) — 빌려 온 카드는 원래 자리로, 창 전용 카드(변신 의상실)는 치움. 바로 이어 연 창(성형외과)에 앞 창 목록이 남던 문제. 성형외과·염색사 카드가 기다리는 자리(body)는 보이지 않게, 건물에 들어가고 나올 때 섬 창(`closeIslandWindows`)을 닫음. 시험은 dress-room(변신 의상실 → 성형외과, 닫은 뒤 화면에 남는 것 없음)·백화점 들어가기 도우미는 문 앞 이동·들어가기를 될 때까지 다시.
- 남은 3-1 일: 품목 그림을 3D로 한 번 그려 저장(지금은 2D 미리보기), 게임 스킨 상점 오른쪽 2D 그림.
- 검증: 단위(skin-gift·point-store 선물 — 두 저장소), e2e dress-room(PC·휴대폰, 선물 끝까지)·transform-shop·shop-browse·plaza 가족 탭, theme-light. Codex 검토 대기(사용량 한도 10/25).
