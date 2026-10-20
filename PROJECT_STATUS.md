# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.110 자전거

- 근거: gamecenter-notes `docs/bicycle-20261020.md`(사용자 「자전거부터」 → 「그렇게 해」), assets 61.
- 물건: 잡화점 `bike_mint·red·sky·butter`(12,000P — 반려동물 6,000~8,000P보다 한 단계 위, 경제 값 `good:bike_*`), 쓰임 `bike`(가방에 있는 동안 탐). 잡화 코너 앞 바닥에 작은 자전거 넷(펫이 있던 진열 대신).
- 타기: **B 키**(빈 키) · 휴대폰 🚲 단추(자전거가 가방에 있을 때만, 걷기·뛰기 단추 위). 속도 7 m/s(`BIKE_SPEED`), 부딪히면 그냥 멈춤(기존 충돌). SPACE로 무엇을 하면 먼저 내림.
- 저절로 내림(그 자리에서 이유 한 줄): 실내(공간이 섬이 아님 — 백화점 각 층·관공서), 열차·승강장, 능선 계단·다리, 사람 많은 곳(5 m 안에 다른 사람 3명).
- 모습: 캐릭터 안에 몸체(색)·바퀴 둘·크랭크(assets 61 `bike-v1`, bike.json 위치) — 바퀴는 속도 / 0.24로, 크랭크는 `BikeRide` 재생 시간으로 돔(재생 속도 = 속도 / 4), 멈추면 `BikeIdle`(크랭크 −3π/2). 동작 파일 `characters/motions/BikeRide·BikeIdle`. `createAnimator.loop(name, rate)`·`heldTime()`.
- 다른 사람: 자리 정보 `bike`(색) — 서버는 가방에 그 색이 있고 섬 위(실내·열차 아님)일 때만 받음(가방 색은 30초 캐시, 살 때 비움). `plazaSnapshot`에 `bike`.
- 함께 고침: 내 화면에서 내 반려동물의 무늬가 빠지던 것(`setMyPet`).
- 검증: e2e 자전거(PC·휴대폰: 단추 없음/있음, B·🚲로 타고 내리기, 다른 화면에 색, 계단·사람 많은 곳·백화점에서 저절로 내림), 잡화점·반려동물 e2e, 단위(잡화점 32종, 등록부). Codex 검토 대기(10/25).

## v1.10.109 걸음 3판(최종)

- 근거: gamecenter-notes `docs/asset-orders-f-body-residents-20261018.md` 「걸음 3판 = 최종」(사용자 2026-10-20 「추천대로 가자」 — 동물의 숲 녹화 측정, 속도 그대로 + 여유 있는 걸음 + 발 미끄러짐 허용; 2판 2.5/5.0은 버림).
- assets 49·53 `motions/` SlowWalk·Walk·Run 3판(`island-models.json` slim49, 이미 압축): 걷기 초당 2.5보·느리게 2보·뛰기 4보·상체 24°. `character.base` speeds 1/4.2/6.2 그대로, `rates` 셋 다 1(느리게 1.72 → 1).
- 검증: 단위 전체(Windows 줄바꿈 6개 제외), motion36 e2e. Codex 검토 대기(10/25).

## v1.10.108 패치 묶음 2-2: 펫샵(백화점 3층), 승강기 1~3층

- 근거: gamecenter-notes `docs/pet-shop-20261020.md`(사용자 2026-10-20), `docs/patch-bundles-20261020.md` 묶음 2-2.
- 펫샵(`public/plaza/island-petshop.js`, 브라우저·서버 공용): 3층 방(섬 밖), 놀이 마당 10×8 m(앞 문 2 m), 하루 여덟 마리(종류×무늬 12에서, 종류마다 둘 이상, 서울 날짜로 모두 같음), `petAt(day, slot, ms)` — 마당 안 여섯 곳을 도는 길이 날짜에서 정해져 모든 화면·서버가 같은 자리.
- 서버: 승강기 하나로 1~3층(`/api/island/lift {to}`, 앞에서만 — 가구점의 up/down을 대신), `petshopInside`(⊂ storeInside, space `petshop`), `GET /api/island/petshop`, `POST .../adopt`(곁에서 — 지난 15초 안에 2.6 m 안이면, 이름 짓는 동안 걸어가도 됨; worldEdit로 먼저 온 한 명만, 1인 하루 한 마리, 값 = 경제 `good:pet_*`, 정산 `petshop:…`), `GET /api/island/pets`(펫샵 반려동물 world `pets:<계정>` + 잡화점에서 산 가방 반려동물 = 첫 무늬), `/api/island/pet`이 `uid`로도 고름. 반려동물 자리 정보에 `coat`. 잡화점 진열에서 반려동물 뺌(가진 것 그대로).
- 화면: 3층(assets 60 `petshop-v1` — 방·놀이 마당·고양이 타워 2·새 횃대·방석 3·밥그릇·장난감·계산대·간판), 무늬 판 12(`pet.<종류>__<무늬>`, 따라다니는 반려동물도 그 무늬), 승강기는 3층짜리(`mall.elevator` → elevator3, 57의 2층짜리 파일 삭제)와 층 고르기 창, 반려동물 곁 SPACE → 이름·데려가기, 가방 「반려동물」 목록.
- 고침: SPACE 대상 순서(지난 프레임의 대상이 남아 있으면 반려동물 대상이 한 프레임 걸러 사라지던 것), `budgets.pet` 노드 12 → 13(무늬 판).
- 걷기·뛰기 2판(걷기 2.5·뛰기 5)은 사용자 비교 중이라 보류(지금 G1·4.2/6.2 그대로).
- 검증: 단위(펫샵 하루·마당 안·승강기·동시·하루 한 마리·내 반려동물, 가구점), e2e 펫샵·가구점(PC·휴대폰), 광장·motion36. Codex 검토 대기(10/25).
