# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.348 4b 집 낡음·수리·바퀴벌레·오늘 알림 (notes gather-must-ideas §64~126, review-plan §1-12)

- island-farm: WEAR 4단계, wearOf(빠진 주마다 한 단계, 처음 판정은 예전 허름함, 낸 주는 그대로), REPAIR 81A(새 섬 전 통나무 = 나뭇가지 두 배), decayOf·decaySolids(139 solids), BUGS 3/8/15.
- 서버: upkeepNow가 level·levelWeek 저장 + 단계마다 관공서 편지, 집 들어가기 HOUSE_BROKEN(부서짐 모두)·HOUSE_WORN(낡음 손님), place·yard·style(방문 허용 빼고) 잠김, 손보기 'repair'(여러 종류 한 번에 take, 부서짐 수리비 20,000P payKey), farmView wear, point-store takeAll.
- 화면: 139 decay-v1 덮개(집 뿌리 자식, 울타리 원 막힘 + 대신 상자), 부서짐부터 125 장식 끔, 145 바퀴벌레(마당 30 m 안·집 안, 세발 걸음·더듬이, 1.6 m 안이면 흩어지고 숨음, 가끔 한 마리 달려옴, 바스락 소리, 집 안 바닥 얼룩), ☰ 「벌레 흐리게」(gc.bugsDim, 점 모델), 「오늘 알림」 창(집·출석·정리 매매·공지; 테스트에서는 gc.testTodayNotice일 때만), 손보기 상자 창 단계·고치기 줄.
- 에셋: 139 decay-v1 24개, 145 house-bugs-v1 3개 + 덧칠 4장(manifest·budgets·REGISTRY·e2e 제외·파이프라인 목록).
- 시험: island-farm(단계·수리 재료), house-wear(낡음 잠김·부서짐 못 들어감·수리비), yard e2e(낡음 덮개·울타리 막힘·벌레 8→15·흐리게·오늘 알림).
- 문제 기록 11-17 「이것도 너무 잡초같은데」: 숲 덮개 ground.fern·ground.shrub(109 plant_low, 잡초와 같은 부채 잎)는 숲 한가운데 나무 2.4 m 안에서만 남기고(고사리 61→12, 관목 34→7), 나머지는 토끼풀 덩이·이끼. 잡초 닮은 장식 조사: plant_low(바꿈), ground.tallgrass(111A 때 들꽃), 갈대 angular.grass_*(강·호수 물가 0.2~1.6 m, 잡초가 안 나는 곳, 둠), pilot grass_*·bush_fern(잡초 자신). 사진 notes img/house-wear-348.
- 남은 것: 벽 위 벌레·벽 얼룩(바닥만), 마당 덧칠 없음; 압류(seized)는 4c.

## v1.10.347 벼룩시장 묶음 (사용자 「여러개 올리기」)

- lib/island-flea.js: bundled(크기 없음·물고기·곤충 아님), put의 unit(개당 값·기준값 개당), reserve(buyQty), partTag(listing:팔린 수), soldPart(판 건마다 owed 한 줄·수수료, 남은 수·값 갱신, 0개면 내려감), shown에 unit·busy.
- 서버: 올리기에서 묶음은 개당 값(0.5~20배), 사기는 개수(1~남은 수, 넘으면 FLEA_QTY), 구매자 예약에 buyQty, 결제 키·paidFor·전달 claim·편지가 판 건마다(343 원칙 그대로), 정리도 partTag로 끝냄, 거두기는 남은 것만.
- 창: 팔기에서 개당 값·「n개가 다 팔리면」, 사기에서 개수 칸, 내 물건에 개당 값·남은 수.
- 시험: flea-stops 묶음(99개 → 60 → 동시에 둘이 30씩(9 남음: 하나만) → 결제 뒤 멈춤 4개 → 남은 5개 → 판 건마다 정산 → 거두기 남은 7개), island-flea e2e 개당 값.

## v1.10.346 에셋 150d · 154A · 155A · 기록의 탑 불러오는 중 · 도박장 입장 규칙

- 에셋 150d: UV를 지키며 다시 묶은 36파일(기록의 탑·증권거래소·대회 간판 Low·트로피 15종)을 넣어 150 깜빡임 고침을 다시 살림(UV 빠짐 0, painted-faces-uv 통과).
- 기록의 탑: 자료 받기 전·실패 때 「🏆 기록의 탑 · 순위를 불러오는 중」.
- 154A: 관리실 섬 운영 「지하 도박장 오늘」 — 오늘 암호·쪽지 벤치(관리자 API /api/admin/den/today만).
- 155A C안: 벼룩시장 게시판 (−4.1, −68.5) 정면이 분수, SPACE (−3.56, −70.53); 생일 코너 (9.9, −74.1) 분수 쪽(막힘 원은 그대로 하나 — 생일에만 서 있어서).
- 도박장 입장(사용자): 그날 암호 + 지갑 전부를 칩으로(5만 이상, DEN_MIN), 입장은 그날 바꾼 사람·칩 5,000 이상(DEN_ENTRY), 판 뒤 칩 5,000 아래면 남은 칩 1:1 포인트·거래소로(kicked), 다시는 지갑 전부.
