# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.431 가방 자동 정리 · 탭 줄바꿈 · 관리자 창 안쪽 종이(사용자 결정 91, 실서버 430 사진 · 관리자 창 사진)

- 자동 정리(결정 91): 「정리」 → 「자동 정리 켬/끔」(사람마다 서버 `bagAuto:<계정>`, 기본 켬). 탭 안에서 하위 분류 → 등급 → 이름 → 큰 묶음(notes inventory-2-plan §8); 화면의 보여 주기만이라 서버 순서 · 물건 그대로, 켜져 있으면 손으로 안 옮김.
- 관리자 창: 섬 운영의 「섬 환경」 · 「매일 섬 대회」 · 「운영 스위치」도 접히는 묶음, 모든 묶음 열림 기억(`gc.adminOpen`). 안쪽(접속 현황 · 계정 줄 · 열쇠 줄 · 계정 자세히 · 위험 단추 · 포인트 지급 확인 · 묶음 선)을 섬 종이 · U3 토큰으로, 계정 자세히 닫기는 머리 ✕(notes admin-paper-20261124).

- 터치 겸용 PC는 `pointer:coarse`라 U8의 `@media (pointer:fine)` 줄바꿈이 안 먹어 탭이 잘림 → `.islandBagTabs` 자체를 줄바꿈 · 옆 넘침 없음(폰은 세 줄).
- 기록의 탑 칩: `(pointer:fine),(any-pointer:fine),(min-width:900px)`에서 줄바꿈 — 폰은 한 줄 밀기 그대로.
- 시험: `island-ui-u8`, e2e island-bag — 탭 scrollWidth ≤ clientWidth · 마지막 탭이 창 안, PC는 터치 흉내(coarse)로 한 번 더, 폰.

## v1.10.430 인벤토리 2차 — 종류별 칸(결정 「1A 2A 3A」 · 결정 88, notes inventory-2-plan-20261124)

- 서버: 종류 표 하나(가방 탭 표 + 서버가 아는 물고기 · 곤충 · 도구 · 탈것), 칸 — 도구 8 · 물고기 · 곤충 · 채집물 · 광석·재료 10(그릇 50 · 100 · 200) · 기타 10 · 탈것 · 펫 없음. 같은 물건 묶음은 넘쳐도 쌓임, 새 칸만 막음. 물건 행은 그대로(옛 통 표시 `meta.box` 유지 — 429로 되돌려도 같은 통).
- 새 그릇: 채집 바구니 · 재료 상자(경제 값 `basket:*` · `matbox:*` 30만 · 80만 · 200만P), 결정 3A — 가방 24 · 32칸 산 사람 채집 바구니 50 무료(읽을 때 + 시작 때 한 번 `bagKinds430`).
- 가득 말: 어느 종류 칸인지와 늘리는 그릇(`BAG_FULL` + `kind`). 마당 잡초: 자리 먼저 보고 뽑음(가득이면 잃던 것).
- 화면(결정 88): 종류 탭 여덟 · 「전체」 없음 · 마지막 본 탭, 탭마다 n/칸 · 빈 칸 · 꽉 참, 그 탭의 그릇 단추; 통 창 · 가방 늘리기 없앰, 놓아주기는 말풍선.
- 시험: `inventory-430` 외 칸 시험들 새 규칙으로, e2e island-bag(PC · 폰) 외 가방 쓰는 spec들 종류 탭 열기.

## v1.10.429 택시 종점 마당 목책(사용자 결정 86 · 87 A, 검토 terminal-yard-20261123)

- 높은 목책 15칸(14 + 부두 길 쪽문 1)으로 섬 바깥 목책과 캠핑장 목책을 이음, 이음 두 곳에 통나무 끝 기둥(코드, 막는 원 0.3 m).
- NEW_ISLE.yard 다각형을 서버 safeAt · 화면 tigers-view에: 마당 안 쫓길 곳 0 · 호랑이 땅 0. SAFES를 지금 반지름 22.9 · 11.9로.
- 종점 차 길: 이 종점만 손님을 마당 쪽 차선에 내리고, 왼쪽으로 크게 돌아(반지름 2.2 m) 앞으로 자리에 — 캠핑장 목책을 뚫던 반원 대신, 울타리와 1.19 m 넘게 · 쉼터와 1.6 m.
- 시험: `terminal-yard`, camp-s1(캠핑장 고리만), e2e dalmaru-walk · 택시 정류장 · 택시 양보 · 호랑이.
