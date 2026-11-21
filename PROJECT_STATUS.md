# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.393 택시 비켜 가기 흔들림 고침(검토 notes docs/taxi-yield-flake-20261121.md)

- 서버: 택시 앞 보기(taxiBlocker)가 사람의 자리를 5초가 아니라 PLAZA_STALE_MS(15초)까지 봄 — 서 있는 화면은 3초마다 자리를 보내서, 화면이 2초만 버벅여도 길 위 사람을 놓쳐 반투명이 끊기거나 그냥 지나갔어요.
- 스펙 island-taxi-yield: 두 화면 holdQuality(0) — 느린 시험 화면에서 화질 자동이 낮음으로 내려가며 셰이더 23~25개를 다시 만들어 3~5초 멈추던 것(검토 측정: 고친 뒤 8/8 통과).

## v1.10.392 N4-b 택시 정류장 · 택시 부르기 · 거리 요금(notes n4-plan-20261120 §5-2·§5-5, 결정 40 A · 41-3 A, 에셋 163 표지)

- 길 위 자리(island-taxi.js ROADSTOPS): ① 배 타는 곳 s 52.3, ② 물가 거리 92.1, ③ 박물관·잔치마루 177.2(건널목에서 9 m), ⑤ 툇마루섬 갈림길 365 — 차는 길가 칸(오른쪽 차선 + 1.2 m), 표지는 그 2.2 m 밖. ④ 달끝나루는 자리 물음(건널목 6 m 규칙) 뒤에.
- 두 자리 사이 길(driveBetween), 빈 차 이동은 손님 없는 타기(`empty`, 문 여닫기 없음). 부르면 가장 가까운 종점의 앞 차가 옴(sendCar), 정류장에서 15초 기다림, 손님을 정류장(또는 정류장에서 꽉 찬 종점)에 내려 준 차는 가장 가까운 빈 종점으로(goEmpty).
- 서버: POST /api/island/taxi/call { stop } — 이미 서 있으면 ready, 아니면 보냄 또는 줄(내 순서), 표지에서 10 m 넘게 벗어나면 부름 지움. GET/POST /api/island/taxi는 정류장에서도, 목적지 목록은 모든 자리.
- 요금: taxi:per100 250(가까운 100 m) · taxi:minFare 500 · taxi:dayPass 8000. 대청마당 ↔ 마을 404 m = 1,000P 그대로.
- 화면: 정류장 표지(에셋 163 taxi_stop_sign, plate 앞뒤 면에 정류장 이름), 「택시 부르기」 창, 표지 막는 원.
- 시험: island-taxi-call(부르기 → 정류장끼리 타기 → 빈 종점으로, 자리 뜨면 취소), island-taxi-stops e2e, 요금·하루권 시험 고침.

## v1.10.391 N4-a 택시 종점 2대 · 목적지 고르기 · 오른쪽 차선 · 한 줄 다리(notes n4-plan-20261120 §5-1, 사용자 N4 §8)

- 차 무리(island-taxi.js createFleet/takeCar/settle/etaAt): 종점마다 2대(앞 칸 = 지금 자리, 뒤 칸 = 같은 방향 4.5 m 뒤), 앞 차가 떠나면 뒤 차가 당겨 섬. 내려 준 차는 손님이 내릴 때 그 종점에 2대 미만이면 머물러 빈 칸으로(3초), 아니면 빈 차로 돌아가 집 종점의 빈 칸으로. 자리 틀: ride.car·seat.
- 오른쪽 차선: 길 가운데에서 1.15 m(양끝 8 m와 다리 위는 가운데로), 길 점마다 차선 값(offs)을 두어 돌아가는 차도 자기 오른쪽.
- 한 줄 다리: 다리에 오르려는데 반대쪽 차가 다리 위에 있으면 6 m 앞에서 섬(빵 없음), 비면 다시 달림.
- 「어디로 갈까요?」 창: GET 응답에 dests·cars, POST에 to. 요금은 그대로(거리 요금·하루권 8,000P는 N4-b).
- 화면: 차 4대를 서버 차 목록(taxiStops = 차 목록)으로, 서 있는 차·당겨 서기·내려 준 뒤 머물기, 정류장 표지 「돌아오는 중 · N초」는 서 있는 차가 없을 때만. 뒤 칸에도 막는 원.
- 시험: test/island-taxi-fleet.test.js 새로, island-taxi-server(셋이 동시에 → 둘 타고 하나 기다림), bicycle·island-taxi-yield 스펙을 두 대 규칙으로.
