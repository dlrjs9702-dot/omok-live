# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.433 Codex 401~432 검토 P1 10건 고침 (결정 93)

- 가방 버리기·놓아주기(P1-1·3·6): 확인 창마다 요청 ID 한 번, 되돌리기 토큰과 버리기 직전 칸 수를 `point_settlements`에 영구 저장(재시도·서버 재시작 유지, 10칸 초과 보유자도 직전 수량까지 복원). 곤충·물고기 놓아주기도 확인 창·수량 선택(기본 1)·10초 되돌리기 적용(`islandRelease`→`islandDiscard` 경로 통일).
- 통·가방·잡초·수조(P1-4·5·7·8): 옛 `/api/island/bag/grow`는 결제 전 `BAG_RETIRED`로 거절(기존 24/32칸 무료 바구니 이력은 유지). 통 구매 `growBox`를 포인트 차감+`boxSlots` 한 거래로 묶고 시작 시 미완료 구매 자동 복구(`paidBoxClaims`). 마당 잡초 뽑기 `pullYardWeed`를 마당 제거+가방 지급 한 거래로 원자화. 수조 넣기 완료를 `home_tank_done:<claim>` 영구 정산으로 기록해 `tankPuts` 만료 후 재도착 시 복사 차단.
- 혼자 게임·택시(P1-2·9·10): `/api/solo/reflex/finish`는 `fast` 판정을 `soloClear` 전에 `400 TOO_FAST`로 거절(개인·주간 순위·트로피 미반영), 저장 실패(`503`) 시 판을 유지해 자동·수동 재전송 허용. 택시 단건 승차권은 경로·금액·`used`를 정산에 저장해 `useTaxiTicket`으로 1회만 전환(재시작 후 재사용·경로 위조 차단).
- 시험: `codex-p1-433`(JSON·PG·서버 재시작 포함) 추가, `bag-discard-432`·`bag-grow`·`inventory-430`·`reflex-server`·e2e `island-bag` 갱신.

## v1.10.432 가방 버리기 (사용자 결정 92 전부 A)

- 가방 칸 말풍선 메뉴 맨 끝 「버리기」 → 확인 창(영영 사라짐 · 포인트 없음). 묶음은 1개 · 전부 · 숫자 입력. 버린 뒤 10초 「되돌리기」(같은 사람 · 한 번).
- 막는 것: 분실물(lost · wallet) · 받은 심부름(1단계)의 사 오기 · 재료 물건 — 버리기 흐리게 + 까닭. 도구는 버릴 수 있음.
- 서버가 판단: `POST /api/island/bag/discard` {requestId, entryId, qty} — 개수 검사, 요청 하나는 한 번(정산 claim), 동시 요청도 가진 만큼만. JSON · PostgreSQL 같은 동작(`islandDiscard`).
- 되돌리기 `POST /api/island/bag/discard/undo` — 메모리 토큰 10초, 누르자마자 사용 표시, 같은 물건(물고기 크기 · 도구 닳음 포함)을 자기 claim으로 돌려줌(두 번 안 됨).
- 그 종류가 다 없어지면 빠른 칸과 손에서 뺌. 관리자 「버린 기록」(누가 · 무엇 · 몇 개 · 언제, 최근 100건, world `discardLog` 500건).
- 시험: `bag-discard-432`(JSON·PG), e2e island-bag(PC·폰) · quickbar 메뉴 목록.

## v1.10.431 가방 자동 정리 · 탭 줄바꿈 · 관리자 창 안쪽 종이(사용자 결정 91, 실서버 430 사진 · 관리자 창 사진)

- 자동 정리(결정 91): 「정리」 → 「자동 정리 켬/끔」(사람마다 서버 `bagAuto:<계정>`, 기본 켬). 탭 안에서 하위 분류 → 등급 → 이름 → 큰 묶음(notes inventory-2-plan §8); 화면의 보여 주기만이라 서버 순서 · 물건 그대로, 켜져 있으면 손으로 안 옮김.
- 관리자 창: 섬 운영의 「섬 환경」 · 「매일 섬 대회」 · 「운영 스위치」도 접히는 묶음, 모든 묶음 열림 기억(`gc.adminOpen`). 안쪽(접속 현황 · 계정 줄 · 열쇠 줄 · 계정 자세히 · 위험 단추 · 포인트 지급 확인 · 묶음 선)을 섬 종이 · U3 토큰으로, 계정 자세히 닫기는 머리 ✕(notes admin-paper-20261124).

- 터치 겸용 PC는 `pointer:coarse`라 U8의 `@media (pointer:fine)` 줄바꿈이 안 먹어 탭이 잘림 → `.islandBagTabs` 자체를 줄바꿈 · 옆 넘침 없음(폰은 세 줄).
- 기록의 탑 칩: `(pointer:fine),(any-pointer:fine),(min-width:900px)`에서 줄바꿈 — 폰은 한 줄 밀기 그대로.
- 시험: `island-ui-u8`, e2e island-bag — 탭 scrollWidth ≤ clientWidth · 마지막 탭이 창 안, PC는 터치 흉내(coarse)로 한 번 더, 폰.
