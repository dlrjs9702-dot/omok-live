# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.391 N4-a 택시 종점 2대 · 목적지 고르기 · 오른쪽 차선 · 한 줄 다리(notes n4-plan-20261120 §5-1, 사용자 N4 §8)

- 차 무리(island-taxi.js createFleet/takeCar/settle/etaAt): 종점마다 2대(앞 칸 = 지금 자리, 뒤 칸 = 같은 방향 4.5 m 뒤), 앞 차가 떠나면 뒤 차가 당겨 섬. 내려 준 차는 손님이 내릴 때 그 종점에 2대 미만이면 머물러 빈 칸으로(3초), 아니면 빈 차로 돌아가 집 종점의 빈 칸으로. 자리 틀: ride.car·seat.
- 오른쪽 차선: 길 가운데에서 1.15 m(양끝 8 m와 다리 위는 가운데로), 길 점마다 차선 값(offs)을 두어 돌아가는 차도 자기 오른쪽.
- 한 줄 다리: 다리에 오르려는데 반대쪽 차가 다리 위에 있으면 6 m 앞에서 섬(빵 없음), 비면 다시 달림.
- 「어디로 갈까요?」 창: GET 응답에 dests·cars, POST에 to. 요금은 그대로(거리 요금·하루권 8,000P는 N4-b).
- 화면: 차 4대를 서버 차 목록(taxiStops = 차 목록)으로, 서 있는 차·당겨 서기·내려 준 뒤 머물기, 정류장 표지 「돌아오는 중 · N초」는 서 있는 차가 없을 때만. 뒤 칸에도 막는 원.
- 시험: test/island-taxi-fleet.test.js 새로, island-taxi-server(셋이 동시에 → 둘 타고 하나 기다림), bicycle·island-taxi-yield 스펙을 두 대 규칙으로.

## v1.10.390 N3-b 자연 구역 탐방선(사용자 결정 37, 에셋 134, notes n3-plan-20261120 §4-2)

- `public/plaza/island-boat.js`(서버·화면 공유): 배 4척(처음 2/2), 선착장마다 대는 자리 3 + 앞바다 대기, 오른쪽 두 줄 물길(±2.5 m), 13 m/s·다리 밑 8 m/s(약 28초), 처음 탄 뒤 6초 기다림·4자리 차면 바로, 내림 3초, 선착장 배가 2척 넘으면 빈 배로 돌아감(6초 동안 탈 수 있음), 배 없으면 줄 서서 온 순서대로, 떠나기 전 내리기. 화면에 토큰 안 보냄.
- 서버: 0.5초 틱, 바뀔 때만 SSE `boats`, 들어올 때 한 번·자세 응답에도. `POST /api/island/boat/board`·`/leave`, `GET /api/island/boats`, 시험 `/api/test/boats {scale}`. 탄 사람은 자리 위치(호랑이·자리 비움·밀어내기 목록 밖), 끊기면 자리 비움, 내리면 뜬 판 위.
- 화면: 배 4척(에셋 134, 대역 상자), 흔들림, 양옆 이름판 「자연 구역 탐방선」, 배마다 선장(주민 모습·모자, 셔츠 색 다름, 40 m 안), 탄 사람 의자에 앉음, 팻말 문구(배 N척 / 곧 출발 N초 / 배 오는 중 N초 · 내 순서).
- 시험: test/island-boat.test.js(물길·대는 자리·규칙·자세), tests/e2e/island-boat.spec.js(타고 건너 내리기, 2/2로 돌아옴).

## v1.10.389 N3-a 높은 윤슬다리 + 별마루섬 부두·부두 문(사용자 결정 27A·37, 에셋 133, notes n3-plan-20261120 §4-1)

- 동쪽 윤슬다리: 에셋 133 `dalmaru.bridge_yunseul_high`, 56 m 제 길이(배율 1), 끝 x 31.35 / 87.35. 판 높이 = base + 0.43 + hbProfile(u)(꼭대기 평평 13 m, 비탈 0.27), 가운데 바다 위 7.02 m. 끝은 걷는 땅(길 둑 포함)에 맞춰 섞음: 서쪽 2 m, 동쪽 4 m(땅이 0.73 m 낮음, 경사 0.45 이하). 모델은 fit으로 끝을 같이 굽힘. 길 둑은 옛 42 m 그대로(`bank`).
- 비탈 옆 막기: 판이 옆 땅보다 0.4 m 넘게 높은 뭍 위, 다리 줄에서 ±3.25 m에 0.4 m 원 0.5 m마다(`guard`), 대역 벽.
- 택시 다리 상자 31~88. 건널목 (36.4,140.5)→(25.5,140.6), (88.4,138.9)→(92.8,135.6). 역무원 철이 (83,137)→(89,146).
- 별마루섬 부두(DOCK2): 배 타는 곳 모델 한 벌, 뜬 판 (223.6,197) 남북, 건널판 동쪽. DOCKS 목록으로 걸음. 부두 문: isle2-props 목책 #194 → fence_gate(호랑이 안전지대 12 m 자동). 문은 다가가면 열림(문 여럿). 지도·미니맵에 부두·부두 문.
- 시험: test/n3a-bridge-dock.test.js 새로, isle2-props 문 2개, island-taxi 다리 옆 원 건너뜀, station-ground 다리 판 옆은 둑에서 뺌, 땅 지도 다시 만듦, GLB 예산 파일별 예외.
