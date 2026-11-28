# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.436 B 택시 · 도로 (notes docs/issue-plan-20261128.md 2번 묶음)

- f62f225a-1 문: assets 183(taxi_island High · Low를 door_L · door_R · wheel_FL/FR/RL/RR 노드로 다시 나눔 — 272 99b 빌드가 한 덩어리로 합쳤음, `precompressed`), `taxi.car` `keepNodes`. 탈 때 · 내릴 때 door_L 0 → −70°, 바퀴 굴림 반지름 0.38.
- f62f225a-2 대청마당 합류부(사용자 결정 98 A): 길 끝 차선(x −1.6 ~ 3.0)부터 두 번째 자리 차 끝(x 14.6)까지 돌바닥 위 폭 3 m 아스팔트 띠(z −55 ~ −52, `PLAZA_WAY`)와 흰 가장자리 선 — 메시, 돌바닥 위 3 cm · polygonOffset. 차가 이 띠를 따라 나와 길로 꺾어 들어감(운행은 그대로).
- 66460bba 지그재그 금: T자 한쪽 구석에서 두 길의 좌우 부호가 엇갈려 노란 선 · 회색 줄이 생김. 툇마루섬 마을 정류장 · 툇마루섬 갈림 · 마을 길 모퉁이를 TEES로 칠함(`box` · `far` · `bar` 생략 가능), L1도 `PAINT_FLIP`(회차 자리 부호는 길 끝을 따름), 막힌 끝은 10 m 안 조각을 끝 평면으로 자름. 셰이더(island.js)는 걸러진 R이 0 근처인데 네 칸 거리가 먼 곳을 그 거리로 읽어 인도 · 차선으로 그림. 섬 전체에 못 가리는 뒤집힘은 별마루섬 입구 길 끝(택시 서는 자리 아래) 하나.
- ca8229cf 떨림: 탈 때 받은 위치 보정(`correction`)이 목표에 닿지 못해 타는 내내 stepTaxi 뒤에서 정류장 쪽으로 끌어당김. 택시 · 배 · 기차 · 엘리베이터 위에서는 보정을 받지 않고 남은 것도 버림, 탈 때 · 내릴 때 `trainChangedAt`으로 그 전 보정 무시.
- f62f225a-3 기울기: 차 앞뒤 1.3 m · 옆 0.75 m 땅 높이로 앞뒤 · 옆 기울기(0.35 rad까지) — 별마루다리 아치에서 ±0.15 rad.
- 다듬기 「택시 비스듬히」: 서 있는 차를 문 쪽으로 25° 돌려 그림(그림만; 서는 자리 · 문 · 탑승 표시 · 운행은 그대로), 탈 때 곧게, 서면 다시.
- 시험: 유닛 `taxi-road-436`, e2e island-taxi-stops · island-taxi-yield · bicycle · island-boat · dalmaru-walk(PC · 폰).

## v1.10.435 A 배·부두 (notes docs/issue-plan-20261128.md 1번 묶음)

- 7f7ee860 승무원 없음: 배 모델은 그대로, 선장 캐릭터 4명 뺌(무인 운영).
- 9fc80a32 걸어 타기: 탄 자리에서 발판 → 배 옆문 → 가운데 통로 → 자리 앞 → 앉기(3.36 m/s). 문 안부터는 배 기준 좌표라 배가 떠나도 같이 감. 문 전에 배가 떠나면 바로 앉음. 서버(island-boat `walkMsOf`)가 걸어 올 시간만큼 배를 붙잡음(혼자 · 다 찬 배 · 줄 선 사람, 시험 속도 배율과 무관).
- 95bff217 모자: 배 문을 지나면 모자 넣기(택시와 같은 `assets.hat`), 내리면 다시.
- 3faca5e1 펫: 주인이 앉으면 배 뒤 갑판(자리별 칸)에 앉아 함께 감 — 배를 그린 뒤 자리 잡아 한 프레임 늦지 않음.
- 1b9f6edf 부두 앞 T자: 칠만 T자(island-paths buildRoadMap `TEES`) — 곧은 물가 길 · 줄기 끝 · 입구(B MOUTH)는 선 없음 · 건널목 줄기에 반듯이(0.59,-14.4). L2를 반대 방향으로 칠해(`PAINT_FLIP`) 노란 선 지렁이 없앰. 차 길 · 정류장 · 요금은 434 그대로. T자 아래 땅 둔덕 · 비움도 T자로(dalmaru-island).
- 시험: 유닛 `boat-dock-435`, e2e island-boat(걸어 타기 · 모자) · dalmaru-walk · island-taxi-stops · island-taxi-yield · island-pets(PC · 폰).

## v1.10.434 Codex 401~432 검토 P2 10건 · P3 1건 고침 (결정 93)

- 행사 밭·채석장·도구(P2-11~14): 행사 밭 수확을 `questApply`(`bagNext`) 한 거래로 묶어 동시 첫 수확의 횟수 이중 소진 차단. 채석장 `islandGive`에 `requireTool: true`를 적용하고 실패 작은 돌 보상을 `questApply` 한 거래로 원자화(채집물 꽉 참·곡괭이 없음 시 횟수/내구도 미변경). 도구 구매 `islandBuy`가 복구 대기(`island_discard_undo`) 중인 같은 종류 도구도 `TOOL_MAX`에 합산.
- 가방·펫·호랑이·롤백(P2-15~18): 버리기 뒤 빠른 칸 정리를 `worldEdit` 안에서 최신 배열을 다시 읽어 해당 종류만 제거. 산책 중인 가방 펫을 마지막까지 버리면 `pet` 문서와 캐시·presence를 함께 해제. `tigerPending`을 잡힘 ID별 `worldEdit` 갱신(`tigerPendingMutate`)과 초기 읽기 재시도로 변경. `bagView`·`visibleSlots`가 보유 칸 수 이상을 보장해 롤백 호환 유지.
- 택시·탐방선(P2-19·20, P3-21): `IslandTaxi.fleetView`에 정차 `curb` 포함 및 `island-taxi-scene` 좌표 전달. `IslandBoat`의 출항·이동·접안·입항이 공통 부두 앞 수역 예약(`dockWaterBusy`)을 공유. `IslandBoat.nearDock` 공통 22 m 발판+팔 영역을 화면(`plaza-scene`)과 서버(`boatAtDock`)가 함께 사용.
- 시험: `codex-p2-434`(JSON·PG·서버·규칙) 추가 및 연관 단위 테스트 통과.
