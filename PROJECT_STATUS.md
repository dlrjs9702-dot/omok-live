# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

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

## v1.10.344 Codex 331~340 P2 고침

- P2-5 벼룩시장 올리기: 물건은 가방에서 뺄 때 같은 한 걸음에 내 flea 문서 `pending`에 매물을 남기고, 가구는 창고에서 빼기 전에 남김. 게시판 저장이 멈추면 같은 요청 다시·다음에 볼 때 한 번만 올림(게시판 `posted` 최근 500개). 가구가 아직 창고에 있으면 버림.
- P2-6 「산 것」: 수조에 넣을 때 산 것인지 기억(islandUse `bought`)해서 꺼낼 때 표시, 선물(giftBags)도 표시를 옮김.
- P2-7 썰매: 내릴 때 assets.detach + 전용 자원 정리.
- P2-8 트리 음악: 오래 멈춘 뒤엔 지금부터 다시(지난 음표 몰아 만들지 않음), 장면 stop에서 음악도 멈춤.
- 시험 test/flea-stops.test.js에 P2 두 개(올리기 멈춤 물건·가구, 산 표시·음악).
