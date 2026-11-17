# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

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

## v1.10.343 Codex 331~340 P1 고침 (벼룩시장·도장 가게 복제·이중 지급)

- P1-1 도장 가게: 가구 전달 기록 `handed`를 도장 문서에 따로 남김(창고에 있는지와 별개). OWNED 다시 시도는 10분 안에 산 것 중 전달 표시가 없는 것만 줌(`boughtAt`).
- P1-2 벼룩시장 사기: 사는 사람에게 먼저 예약(저장) → 그 사람 결제 키(`flea:buy:<id>:<계정>`) + 내 flea 문서 `paidFor` → 전달. 멈춤으로 남은 예약은 정리 때 결제가 있으면 그 사람에게 끝내 주고, 없으면 풀어 줌. 예약 중엔 다른 사람 FLEA_BUSY.
- P1-3 판 돈: 자동(3일)·받기 모두 판매마다 같은 키 `flea:sale:<id>`로 지급(이미 지급이면 표시만).
- P1-4 거두기: 게시판에서 내리고 「맡아 둔 것」으로 먼저 저장 → 같은 claim으로 돌려줌 → 맡김 풀기. 자리 없으면 게시판 그대로.
- 시험 test/flea-stops.test.js(저장 멈춤 흉내: 결제 뒤·거두기 뒤·받기 뒤·자동 지급 뒤·도장 표시 전), 옛 코드에서는 실패함을 확인.
- P2 5~8(맡기기 실패 소실, 산 물고기 표시가 수조·선물에서 사라짐, 썰매 로더 누적, 음악 몰아 생성)은 다음 PR.
