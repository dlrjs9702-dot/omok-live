# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.108 패치 묶음 2-2: 펫샵(백화점 3층), 승강기 1~3층

- 근거: gamecenter-notes `docs/pet-shop-20261020.md`(사용자 2026-10-20), `docs/patch-bundles-20261020.md` 묶음 2-2.
- 펫샵(`public/plaza/island-petshop.js`, 브라우저·서버 공용): 3층 방(섬 밖), 놀이 마당 10×8 m(앞 문 2 m), 하루 여덟 마리(종류×무늬 12에서, 종류마다 둘 이상, 서울 날짜로 모두 같음), `petAt(day, slot, ms)` — 마당 안 여섯 곳을 도는 길이 날짜에서 정해져 모든 화면·서버가 같은 자리.
- 서버: 승강기 하나로 1~3층(`/api/island/lift {to}`, 앞에서만 — 가구점의 up/down을 대신), `petshopInside`(⊂ storeInside, space `petshop`), `GET /api/island/petshop`, `POST .../adopt`(곁에서 — 지난 15초 안에 2.6 m 안이면, 이름 짓는 동안 걸어가도 됨; worldEdit로 먼저 온 한 명만, 1인 하루 한 마리, 값 = 경제 `good:pet_*`, 정산 `petshop:…`), `GET /api/island/pets`(펫샵 반려동물 world `pets:<계정>` + 잡화점에서 산 가방 반려동물 = 첫 무늬), `/api/island/pet`이 `uid`로도 고름. 반려동물 자리 정보에 `coat`. 잡화점 진열에서 반려동물 뺌(가진 것 그대로).
- 화면: 3층(assets 60 `petshop-v1` — 방·놀이 마당·고양이 타워 2·새 횃대·방석 3·밥그릇·장난감·계산대·간판), 무늬 판 12(`pet.<종류>__<무늬>`, 따라다니는 반려동물도 그 무늬), 승강기는 3층짜리(`mall.elevator` → elevator3, 57의 2층짜리 파일 삭제)와 층 고르기 창, 반려동물 곁 SPACE → 이름·데려가기, 가방 「반려동물」 목록.
- 고침: SPACE 대상 순서(지난 프레임의 대상이 남아 있으면 반려동물 대상이 한 프레임 걸러 사라지던 것), `budgets.pet` 노드 12 → 13(무늬 판).
- 걷기·뛰기 2판(걷기 2.5·뛰기 5)은 사용자 비교 중이라 보류(지금 G1·4.2/6.2 그대로).
- 검증: 단위(펫샵 하루·마당 안·승강기·동시·하루 한 마리·내 반려동물, 가구점), e2e 펫샵·가구점(PC·휴대폰), 광장·motion36. Codex 검토 대기(10/25).

## v1.10.107 패치 묶음 2: 가구점(백화점 2층), 내 정보 변신 켜기·끄기

- 근거: gamecenter-notes `docs/patch-bundles-20261020.md` 묶음 2, `docs/furniture-shop-20261019.md`(사용자 확정), `docs/shop-tryon-20261019.md` 「내 정보에서 변신 켜기/끄기」.
- 가구점(`public/plaza/island-furniture.js`, 브라우저·서버 공용): 상품 145(48 모양 × 색 판, 이름·구역·희귀도), 2층 방(1층처럼 섬 밖, 반 바퀴 돌린 방), 구역 4 × 받침대 3 + 뒷벽 걸이 3 + 넓은 자리 1 = 하루 16점, 늘 파는 4점. `displayOf(day)` 서울 날짜로 모두 같은 진열(흔함 6·보통 3·드묾 1 가중치, 모양 겹침 없음, 벽면 수조는 넓은 자리에서 약 9일에 1번).
- 서버: 1층 왼쪽 벽 승강기(`IslandStore.LIFT`) ↔ 2층(`/api/island/furniture/up·down`, `furnitureInside` ⊂ `storeInside`, space `furniture`), `GET /api/island/furniture`(진열·팔림·내 오늘 수), `POST .../buy`(그 가구 옆에서, worldEdit로 먼저 온 한 명만 — 늦은 사람 `SOLD`·포인트 그대로, 전시품 하루 `furniture:perDay` 3점, 늘 파는 것은 요청 번호마다 한 번), `GET .../mine`(가구 창고 — world `furniture:<계정>`, 300점까지). 결제는 새 `pointStore.charge`(JSON·PostgreSQL, 정산 id `furniture:…` 한 번만, 원장 사유 furniture). 팔리면 SSE `furniture`.
- 경제 값: `furniture:common` 3,000 · `uncommon` 6,000 · `rare` 15,000 · `base` 1,000 · `perDay` 3.
- 화면: 2층(assets 57 `furniture-v1` 157개 — 방·승강기·간판·구역 러그·받침대·가격표 받침·「팔렸어요」 상자·계산대), 받침대 위 가구와 가격 글씨, SPACE로 가구 창(사기), 메뉴 「가구 창고」(꾸미기 창의 3D 미리보기에 가구 — `tryOn(canvas, { model })`). 계단 모델은 쓰지 않음(승강기로 오르내림).
- 내 정보 변신: 꾸미기 창 위 「변신 중: ○○ · 풀기」 줄과 가진 변신 목록(변신하기/변신 풀기 = 기존 장착·해제, 장소 확인 없음). 변신 중에 다른 항목을 가리키면 3D는 변신을 끈 모습 + 「변신 중이라 섬에서는 변신 모습이에요」.
- 검증: 단위(가구점 진열 규칙, 승강기·동시 구매·하루 3점·늘 파는 것·창고), e2e 가구점·내 정보 변신(PC·휴대폰), 꾸미기 창·dalmaru-walk. Codex 검토 대기(10/25).

## v1.10.106 F1·G·F2: 가는 몸의 옷·소품, 걷기·뛰기 다듬기

- 근거: gamecenter-notes `docs/asset-orders-f-body-residents-20261018.md` 「F1 완료」「G 완료」, F2(assets 50) — 묶음 1과 2 사이에 끼운 에셋 연결(`docs/patch-bundles-20261020.md`).
- 에셋: assets 49(몸 5종·옷 55벌, 새 셸 방식), 50(신발 42·목걸이 42·망토 22·꼬리 40, IP 제외), 53(SlowWalk·Walk·Run G 판) — `island-models.json` 209개를 이미 압축된 파일로(`precompressed`). 기본 셔츠·바지·치마·멜빵바지도 Low 파일 사용.
- `baked`: 이 파일들은 새 몸에 맞춰 만든 것이라 `asset-loader`의 `slimmedGeometry`를 건너뜀(`island-assets.js` 끝의 규칙 — 머리 부위·IP 경로만 실행 중 줄이기). 규칙이 고른 파일 = 납품 파일 206개(모션 제외) 일치 확인. F2의 hair_ponytail·hair_twin_tail은 「tail」 이름 때문에 꼬리로 잘못 처리(가중치가 모두 Hips)된 것이라 빼고 게임 원래 파일 그대로 — 시험 「머리카락: Head 가중치가 대부분이고 baked가 아니다」.
- G: Walk·Run이 게임 속도 4.2·6.2로 만들어져 `rates` walk·run 1.0(slow 1.72 그대로).
- `budgets.json`: 옛 운동복·후드 몸·옷의 비양자화 예외 8개 삭제.
- 검증: 단위 전체(Windows 줄바꿈 6개 제외), motion36·island-assets·dress-room e2e 30개. Codex 검토 대기(사용량 한도 10/25).
