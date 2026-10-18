# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.93 체형(DS 인상), 마을 주민 미니게임 퀘스트 2단계(7명·공동 진행도)

- 지시(사용자 2026-10-18): 구현 순서 `docs/implementation-order-20261018.md` A1(체형·팔, 시안 v2) → A2(주민 미니게임 퀘스트 2단계·정자 할아버지 AI 대전, assets 39).
- 체형(`asset-loader.js` `slimmedGeometry`, 등록부 `character.base.slim`): 몸통 폭 82%·깊이 80%, 팔 55%·다리 50%(뼈 축 쪽으로 스킨 가중치만큼), 손 82%·신발 85%. 몸과 모든 착용물(스킨·IP 파츠·변신)에 같은 변형을 적용해 따라감 — 재맞춤 주문 불필요. 모션 파일·리그는 그대로.
- 마을 주민(assets 39, `island-terrain.js` `VILLAGE`·`villageSolids`, `island-quests.js` 7편, `island-cast.js` 15~21): 한 주에 한 명씩(`VILLAGE` 순환, 주간 총액 그대로). 화가×다른 색 찾기→벽화 4단계, 거리 악단×비트 탭→무대 공연, 역무원×숫자 터치(`lower`)→남서해안역, 전기 담당×오늘의 회로 연결→가로등 3개, 공사 인부×오늘의 다리 잇기→징검돌 4단계(물 높이 −0.23), 도서관 할아버지×오늘의 네모로직→책 수레, 정자 할아버지×게임방 AI 오목→오델로(서버가 AI를 두고 승패 판정, `aiWinProgress`). 공동 진행도는 `/api/island/farm`의 `village`(그 주 도운 사람 수).
- 퍼즐 단계(`puzzle: true`): 오늘의 문제 쉬움의 정답 확인(`/api/solo/puzzle/finish`)이 단계를 채움. 이미 오늘 푼 사람은 말을 거는 순간 정산 기록(`puzzleSolved`)으로 바로 완료. 퀘스트로 연 판은 항상 오늘의 문제(`reflex.js` modeOf).
- 마을 소품 충돌: 충돌 격자는 시작 때 한 번 만들어지므로 마을 소품 원을 시작 때 넣음(전에는 나중에 넣어 통과됐음).
- 검증: 단위(village-quests·puzzle-quest-server·farmer·island-quests) 통과, e2e island-assets 등록부(백화점·마을 전용 모델 제외) 통과. Codex 검토 대기(사용량). 실제 휴대폰·GPU 미검증.

## v1.10.92 백화점·잡화 코너(진열 구매), 잡화 물건 쓰임, 포차코 변신

- 지시(사용자 2026-10-18): 「잡화점은 동물의 숲처럼 진열된 걸 사는 방식, 품목은 제안대로」, 「상점가도 백화점화, 큰 건물 하나에 섹터별로」, 「포차코는 다른 캐릭터와 같은 가격」.
- 백화점(`public/plaza/island-store.js`, assets 43 mall-v1): 상점가 북쪽(48, -15)의 24×14m 건물 하나(SPOTS.store kind `mall`, 섬 주민 경로는 `island-npcs.js` `inMall`로 피함). 들어가면 섬 밖 실내 방(30×20m, 관공서와 같은 방식, 서버 `storeInside`, `/api/island/store/enter|leave`). 구역 8곳: 게임 스킨·옷가게·미용실·소품 가게·성형외과·염색사·변신 의상실·잡화 — 각 구역의 SPACE 자리는 예전 시설 id(`shop`·`avatar`·`hair`·`accessories`·`faces`·`dye`·`transform`)라 가게 창·서버 장소 확인(`IslandStore.sectorPoint`)이 그대로. 섬의 개별 가게 건물·변신 부스는 없앰.
- 잡화(`lib/island-items.js` GOODS 16, `islandBuy`·`islandUse`·`islandGift` JSON/PG): 진열 자리(assets 41 모델·아이콘)에서 SPACE → 1·5·10개 구매(결제+가방 한 번에, `island_buy` 원장). 미끼: 낚시 시작 때 가방에서 자동 사용(대기 2~5초, 고급은 두 번 뽑아 비싼 쪽). 폭죽·풍선·비눗방울: 가방 「쓰기」, 서버가 6초 동안 `show:<kind>` 동작을 인정해 주변에 보임. 선물 포장지: 플레이어 메뉴 「선물하기」(3m 안, 포장지 1장 사용). 심부름 「사다 주기」(하루 최대 1개, 물건값+1,500P). 잡화 가격·사다 주기 보상은 경제 값 관리 표에. 꽃씨·묘목·비료는 「곧 판매」(심기 기능 전).
- 포차코(assets 42): 파츠 4종(의상·머리장식·꼬리·목걸이, 헬로키티와 같은 등급, 합 800,000P)과 변신 두 체형, 의상의 몸·모자 덮개 0. 변신 의상실 점원 모델. 포차코 모델은 기본 자세에서 1.4~1.8mm 어긋남(양자화) — 시험 허용 2.5mm, 재출력하면 0.1mm 이하로.
- 검증: 단위(general-store JSON/PG·island-errands·economy·asset-pipeline·native-transformations 22종) Windows 전용 6건 외 통과, e2e general-store(구매·물건 쓰기·선물)·shop-browse·transform-shop·native-assets·plaza 상점 PC·휴대폰 통과. Codex 검토 대기(사용량 한도, 풀리면 후속). 실제 휴대폰·GPU 미검증.

## v1.10.91 주민 대화·호감도·심부름, 경제 값 관리, 변신 의상실(변신 따로 판매 A안)

- 지시(사용자 2026-10-18): 「주민들에게 이름과 설정, 설정에 맞는 대사, 퀘스트가 없어도 대화(기존 대화 카메라 그대로), 주민끼리 찾기·가져다주기·사다 주기」, 「호감도에 따라 대사 4단계」, 「경제 수치 열 수 있게」, 「포차코는 다른 캐릭터와 같은 가격, 기존 이용자 A안」.
- 주민(`public/plaza/island-cast.js`): 걷는 주민 10명(n 0~9) 이름·역할·설정·4단계 대사(+아침·밤), 이야기 주민 5명(n 10~14) 대사. `{me}`는 이용자 이름. 말 걸기: 서 있는 주민 2.2m 안에서 `resident:<n>`(대화 카메라·마주 보기), 서버 `POST /api/island/resident/talk`이 같은 시드로 주민 위치를 계산해 4m 안 확인.
- 심부름(`lib/island-errands.js`): 서울 하루 3개(같은 날 모두 같음, 부탁하는 주민 서로 다름) 찾기(대상에게 들은 뒤 부탁한 주민에게 알리면 2,000P)·전하기(대상에게 말하면 1,500P), `claimEvent`로 계정당 하루 1회 지급, 진행 단계는 메모리(재시작 시 다시 부탁받음). 머리 위 ★/✓, 추적창 「심부름 · …」. 「사다 주기」는 잡화점과 함께.
- 호감도(`affinityOf`/`affinityAdd`, JSON `island.affinity`, PG 새 표 `resident_affinity`): 하루 첫 대화 +1, 심부름 부탁한 주민 +3·받은 주민 +2, 이야기 단계 +2, 단계 기준 5·15·30, 상한 999. 대화창 아래 「아는 사이 ♥♥」.
- 경제 값 관리(`lib/economy.js`, `/api/admin/economy`): 생활 자원·물고기 판매가, 지뢰찾기 보상, 심부름 보상을 관리자 창 표에서 변경(범위 1~기본×10, 확인창, 변경 이력 200개·되돌리기, 서버 `worldValue('economy')`). 은행·세금·퀘스트 단계·원장은 코드에 둠.
- 변신 따로 판매 A안(`lib/skins.js` `avatar_tf_*` slot `transform`, 가격 = 세트 파츠 합): 파츠 착용만으로는 변신하지 않고 `look.transform`이 정함(`character-transformations.js` `match`). 시작 때 1회 `grantTransformations`: 세트 전부 보유 계정에 변신 무료 지급, 세트를 다 입고 있던 계정은 변신 선택(`worldValue('transformGrant')`). 상점가 입구(28, 10)의 「변신 의상실」(임시 부스, assets 42로 교체 예정) `/api/transformations`, 상점 목록에서는 제외. 기존 「잡화점」(모자·장식) 이름은 「소품 가게」.
- CI: 새 섬 e2e(resident-talk·transform-shop)는 plaza 작업에. 검증: 단위(errands·economy·transform-grant JSON/PG·skins·native-transformations·point-store) Windows 전용 6건 외 통과, e2e resident-talk·transform-shop(PC·휴대폰)·economy-admin·native-assets 통과. 실제 휴대폰·GPU 미검증.
