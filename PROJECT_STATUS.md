# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.104 달마루섬 개편 5단계: 모두 새 섬으로 이사

- 근거: gamecenter-notes `docs/dalmaru-implementation-20261019.md` 5단계, 확정 순서 3. 서버 기본 섬이 달마루섬(`island-terrain.js`가 `dalmaru-island.js`로 만듦; `ISLAND_MAP=classic`이면 지금 섬 — 옛 섬 코드는 다음 배포에서 정리). 페이지는 섬 스크립트보다 먼저 `/plaza/island-live.js`로 섬을 알게 됨.
- 이사(`dalmaruMoveIn`, 서버 시작 때 한 번 — world `dalmaruMoved`): 심은 꽃은 씨앗·나무는 묘목으로 주인 가방에(포인트 없음, 쪽지 「달마루섬 이사 돌려받기」), 땅 비움; 잡초 한 번 새로(`dalmaruWeeds`). PostgreSQL은 추가만.
- 서버가 새 섬 기준: 주민 순환(걷는 땅·절벽 정면·구조물 원), 퀘스트·사진 자리(`PLACES.quests`), 생활 자원·해안 자리·열매 나무, 잡초 1,400, 위치 경계 200, 할로윈·겨울 장식(대청마당 가운데·새 섬 들).
- 관공서: 창구 4개(민원·세금·예금·**개명 신청** — 작명소 업무, 6.8 m 간격), 절벽 정면 앞에 담장 마당·시장 정문(지금 섬 마당 그대로, 틀은 정면 앞면이 옛 관공서 앞면 자리). 백화점 9구역 **노점**(상인 매입). 새 섬에서는 밖의 작명소·상인 없음.
- 낚시 물가 5종(`fishWater`: sea·bay·lake·river·pool, 출현표는 바다/강 표에서 — 윤슬만은 먼바다 물고기 빼고, 호수는 개울 물고기 빼고, 폭포 웅덩이는 흔한 것 빼고), 폭포 2곳(떨어지는 물면·거품·물보라). 강 낚시 찌가 새 섬 강·호수·웅덩이 위로.
- 섬 꾸밈: 길 가로등 61개(밤길·할로윈 깃발줄), 강둑 자갈·꽃·계절 장식과 굽이 돌, 산책로 갈림 화분. 고침: 주민 첫 자리 겹침(첫 장면 순간이동), 능선 계단 양 끝의 보이지 않는 난간 충돌.
- 시험: 단위·e2e를 두 섬 모두에서(지금 섬 모양 전용 시험은 달마루섬에서 건너뜀), 새 섬 열차·계절·이사·창구·노점·물가 시험 추가.
- 검증: 단위 전체(두 섬 — Windows 줄바꿈 6개 제외), e2e 섬 시험(달마루섬). Codex 검토 대기(사용량 한도 10/25).

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
