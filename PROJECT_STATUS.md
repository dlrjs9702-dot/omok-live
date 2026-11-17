# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.349 DB 백업 (사용자 178A·179A, notes direction-ideas 끝)

- lib/db-backup.js: 모든 표(schema public)를 읽기 전용 한 스냅샷에서 커서로 500줄씩 → JSON 줄 → gzip → AES-256-GCM, 열쇠는 RSA-OAEP(SHA-256) 공개 키로 봉인. 파일 끝 줄 {end, rows}로 잘림 확인. DB 없으면 데이터 폴더 JSON 파일.
- 서버 GET /api/admin/backup: 관리자만, 하루 6번, 공개 키 BACKUP_PUBLIC_KEY 또는 tools/backup/backup-public.pem(없으면 503), 로그는 크기·시간만.
- tools/backup/: fetch.js(관리자 로그인 → DB백업\YYYY-MM-DD.bak → 로그아웃, 개인 키로 열어 확인, 30일 지난 것 지움, backup.log), keygen.js·open.js·restore.js(localhost만)·install-task.ps1(매일 05:30, 놓친 실행은 켜지면 바로)·README(되살리기 연습). 개인 키·설정·백업은 저장소 밖(DB백업\), .gitignore.
- 시험: test/db-backup(봉인·다른 키·변조, DB 커서 묶음, API 401·403·모든 표·하루 6번, fetch.js 날짜 파일·30일·비밀번호 없으면 FAILED).
- 남은 것: 관리자 비밀번호는 사용자가 DB백업\config.local.json에 직접, 예약 작업 등록은 총괄이 사용자 확인 뒤, 실제 Postgres 첫 받기 확인.

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
