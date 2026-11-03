# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.232 배치 도구

- 꾸미기·마당 꾸미기 창 맨 위 「🖐 배치 도구」(docs/place-tool-20261103.md): 창이 아래 가구 줄로(안 놓은 것 먼저), 가리킨 바닥(탁자 윗면 먼저)으로 미리보기, 칸 맞춤(집 0.25 m·탁자 위 0.05 m·마당 YARD.STEP), 벽 가구 0.6 m 안 벽 붙이기, 놓인 가구 누르면 다시 들기.
- PC 클릭·R·휠 클릭·Esc·오른쪽 클릭·오른쪽 끌기·방향키, 폰 끌기(손가락 60 px 위)·탭·✓ ↻ ✕·「⋯」 한 칸 단추. 세로 폰은 카메라를 멀리, 든 동안 가구 줄 접기.
- 집과 마당 같은 도구(app.js openPlaceTool, 어댑터만 다름), 서버 변경 없음(/api/home/place, /api/home/yard). 공간이 바뀌거나 다른 창이 열리면 도구 닫힘(걷기 돌아옴).
- 코드: IslandHome.aimAt·pieceAt, IslandYard.aimAt·pieceAt, plaza-scene placeTool·placePoint·placeScreen.
- 시험: place-tool(단위·e2e PC/폰).

## v1.10.231 M 박물관 전시관 + 물고기 크기

- 전시관(public/plaza/island-museum.js, assets 74 museum-v1): 섬 밖 방 24×16 m(ROOM x 100·z -430), 박물관 문 → /api/island/museum/enter·leave. 큰 수조(바다 21)·벽 수조 13(강·호수·폭포)·곤충 진열장 12·나비 돔(나비·잠자리), 명판(크기·기증자, 빈 칸 「아직 기증받지 못했어요」), 관장(기증해요·전시 이야기), 안내판(전시 n/46, 목록). 기증은 관장 창구 2.2 m 안에서만. 폰 화질 0이면 큰 수조 8마리.
- 물고기 크기(docs/fish-size-20261027.md): 서버가 잡을 때 cm(SIZES, 큰 끝 드묾, 평균 위치 0.35), 가방 meta.sizes(작은 것부터 팔기·선물·주기, 박물관은 가장 큰 것), 값 ×경제 값 fish:sizeMin 80~fish:sizeMax 130%(평균 같음), 낚시 쪽지 cm·내 최고, 도감 최고 크기·날(questDoc fishBest), 옛 물고기는 종류 가운데 값.
- 박물관 바꿔 걸기: 더 큰 것만(같거나 작으면 NOT_BIGGER), 첫 기증(first)·지난 기록 셋(past), 바뀐 사람에게 쪽지. 곤충은 종류마다 한 번 그대로.
- 물고기 13종 더(fish-additions-20261029, assets 85): 34종, 밤에만(오징어·동자개, 서울 20~05시), 해마 윤슬만·가재 강/폭포·산천어 폭포·철갑상어 호수만.
- 걷는 이야기 주민 떨림(검토 진단): 숨긴 quest 분신을 people·out 목록에서 뺌(npc.root.visible).
- 덤: 집 대문 이름 팻말 1.5배·밝은 판·진한 갈색(긴 이름 두 줄), talk-spot e2e 말 걸기 전 free-residents.
- 시험: museum-hall(단위·e2e PC/폰), island-fishing 34종·크기 값, island-insects 박물관 창구.

## v1.10.230 울타리 마을 (집터 동네를 새 땅으로)

- 땅: 툇마루섬 남쪽, 기차 고리 너머 새 땅(dalmaru-terrain VILLAGE x -154~170·z 199~281, 목 NECK x -20), coastDist에 soft union, 높이 0.9로 평평. 바닥 590 m·SEG 236, 구운 지도 1536.
- 집터 16곳(한 길 STREET_Z 236 따라 북 8·남 8, 12곳에 기존 집). 마당 = 울타리 안(18×16 → 22×20 → 26×24), 울타리 조각·문 1.4 m·이름 팻말(주인 「내 집」, 남 「○○의 집」)·문기둥·최대 크기 모서리 말뚝.
- 이사(server homeOf villageV 1): 집 안 그대로, 마당 물건은 가구 창고로, 관공서 쪽지 한 번, 게시판 알림 한 번. 새로 지은 집은 처음부터 villageV 1.
- 옛 툇마루섬 집터 → 꽃밭 4곳·벤치 8. 표지 「울타리 마을 ↓」「울타리 마을」. 지도·미니맵 땅 그림 z 300까지.
- 주민은 마을로 내려가는 목 길에서 멈추지 않음(서버 걸음과 어긋남). 잡초 범위 r 200, 서버 시작 바닥 계산 빠르게(ground-cover 먼 바다 건너뜀).
- 시험: dalmaru-island 16곳, island-yard(울타리 안·새 집 쪽지 없음), yard·weekly-new e2e 마을 이동은 PlazaWarp.
