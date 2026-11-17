# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

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

## v1.10.345 긴급: 시세판·순위판 남색(에셋 150 UV 빠짐) + 테드 칩 입장 자격

- 원인: 1.10.340 에셋 150 재내보내기에서 그림을 끼우는 면의 UV(TEXCOORD_0)가 빠져 캔버스의 한 점(남색 바탕)만 보임. 36파일(기록의 탑·_low, 증권거래소·_low·방, 대회 간판 _low, 마당 트로피 15종·_low).
- 고침: 그 36파일만 340 전(48e1602b~1) 것으로 되돌리고 island-models.json의 그 파일 sha·src도 되돌림(그 면들의 150 깜빡임 고침도 같이 빠짐 → 에셋에 -kv -vtf로 다시 묶기 요청).
- 막기: test/painted-faces-uv.test.js(board_face·board_honor·board_ticker·board_screen·sign_plate·trophy_plate 면은 UV가 있어야 함).
- 테드(사용자 「입장 자격을 확인한 후에」): 그날 암호를 맞힌 사람만 포인트 → 칩(서버 DEN_PASS), 창에서도 암호 전엔 칩 줄을 숨김. 이미 가진 칩은 칩 → 포인트로 돌려받을 수 있음.
