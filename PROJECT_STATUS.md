# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.407 넓은 동쪽 윤슬다리(에셋 170, 사용자 결정 66 · 67 A, notes bridges-two-way §3 · §6 · §7)

- 모델 `dalmaru.bridge_yunseul_wide`(High · Low), 걷는 폭 7.8 m, 오르막 옆막이 ±4.35, 133 모델은 등록만 남김.
- 택시: 다리 한 줄 상자 뺌, 길 선을 다리 가운데(z 140)에, 가운데 노란 선은 코드 띠(결정 67-3 A).
- 주민: 넓은 다리 위는 인도로.
- 달끝역 · 초승역 들어가는 길 곧게 북쪽(a0d86433, (±91.9, 142.9)); 역 터 시험은 달끝나루 판 끝 계단을 다리처럼 뺌.
- 다리 옆막이 1 m · 끝 3 m 안 자연물 비움, 배 시험 기둥 v ±3.0 r 0.8, 땅 지도 다시 구움.

## v1.10.406 넓은 문(사용자 결정 65-1 A, notes issues-taxi-resident §1)

- 시간표 안 멈춤: 길에서 만나는 넓은 문(dalmaru-terrain TAXI_GATES)이 운행 15 m 넘게 앞에 있으면 문 4 m 앞까지 감속 → 1.2 s 섬 → 다시 가속. 별마루섬 입구로 들어오는 운행만(종점이 문 안 10.5 m라 떠나는 운행은 탈 때 이미 열림). 들어오는 운행 약 +2.9 s.
- 화면: 택시가 넓은 문 25 m 안이면 내가 60 m 밖이어도 문을 움직임.
- 사람이 문 앞에 서 있을 때 서는 자리는 지금 비켜 가기 규칙 그대로(171 새 문 때 다시).

## v1.10.405 L0 길 계산 틀(notes taxi-island-loop-20261122 §4, 결정 69)

- 길 그림: ROADS를 만나는 점에서 조각으로(지금 3조각), 조각 끝점 사이 가장 짧은 길(Floyd). driveBetween·distanceOf가 이걸 씀 — 장소 90쌍 모두 옛 줄기와 같은 점·거리. 거리는 쌍마다 기억.
- 택시 한 줄 다리 상자는 dalmaru-terrain BRIDGES의 `taxi`에서. 길 둑은 island-taxi BANKED(지금 ROUTE만 — EXT까지 하면 별마루다리 서쪽 바닷가에 8 m 둑).
- 빈 차로 돌아오는 차: 돌아오는 길 끝에서 종점에서 11 m 떨어진 곳에서 길을 떠나(차로 그대로) 내리는 자리 → 쉼터 뒤 반원 → 앞으로 자리(HOME_V 6 m/s, 모서리 둥글게). 어긋남 25° 안·앞자리에서 4.4 m 밖 시험.
- 종점 도는 길(PARK_PATHS) 2.35 m 안에는 자연물·돌 없음 — 대청마당 종점 뒤 나무 하나(16.3, −47.1) 빠짐, 땅 덮개 지도 다시.
