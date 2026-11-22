# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.411 L1 · L2 서쪽 길(사용자 결정 65-4 · 67 · 69, notes taxi-island-loop §2 A, 에셋 173 · 179)

- L2: 모퉁이 → 서쪽 물가 → 서쪽 바닷가 → 서쪽 강 다리(173, 그 축 위) → 초승 곶(219 m, L3 전까지 막다른 길). 검토 선 + 바닷가 2.6 m 서쪽 · 곶 1.5 m 동쪽, 길 둑.
- L1: 목 모퉁이 → 마을 길 서쪽 x −126, 마당 문 건널목 4곳, 가로등 규칙 x0 −126.
- 강 다리: 비스듬한 다리(방향 따로) — 다리 끝 띠 · 세움 벽 · 둑 빼기를 다리 자기 방향으로, 양 끝 폭 방향 평평.
- 정류장 5곳 양쪽(서쪽 물가 거리 · 한옥 마을 어귀 · 징검다리·농장 · 초승 등대·초승역 · 마을 서쪽), 길 위 자리 `road + d`, 쪽마다 제 발밑.
- 건널목: 주민이 L2를 건너는 5곳 + 동쪽 물가 1곳, 난간 기둥은 건널목 5 m 규칙에서 뺌.
- 정류장 반대 방향 출발: 3 m 앞으로 → 반원(1.75 m) 2.5 m/s → 0.4초 섬(미끄러짐 · 제자리 돌기 없앰).
- 같이: 거리 악단 자리 (−8, −15.5), 물가 쓰레기 만 안 여덟 자리 여유, 자연물 하한.

## v1.10.410 정류장 양쪽(사용자 결정 65-3 A, notes issues-taxi-resident §3)

- 길가 정류장 7곳 모두 양쪽에 표지 · 바닥 표시(건너편 자리는 배 타는 곳 −0.5 m · 물가 거리 +2 m 표지 0.8 · 달끝나루 −1 m · 툇마루섬 갈림길 +1 m로 비킴).
- 차는 오는 방향 쪽 연석에 섬(대청마당 쪽에서 오면 +1, 별마루섬 쪽에서 오면 −1) — 중앙선 안 넘음. 서 있는 쪽을 기억해 다음 운행을 거기서 시작, 반대 방향이면 앞으로 5 m 가서 돌아 나감.
- 부르면 차가 설 쪽이 내 표지 건너편일 때 「길 건너편에서 타요」. 타기 · 부르기 거리는 가까운 표지 · 차가 선 연석 기준.
- 배 시험: 높은 윤슬다리 밑도 깊이를 잼(409 둑 고침 뒤).

## v1.10.409 넓은 부두 + 배 움직임(에셋 172, 사용자 결정 75 「전부 a」, notes dock-maneuver-20261122)

- 부두: 두 곳 모두 `dock_boat_wide`(뜬 판 22 × 4 m + 내리는 팔 3 × 10 m), 뿌리만 바다 쪽 0.5 m(건널판 · 계단 그대로), 판 위 표지 「타는 곳」 · 「내리는 곳」.
- 배 자리: 타는 곳 0(바깥) · 1(안쪽), 내리는 곳 2(팔), 기다리는 자리는 내리는 곳 들어오는 줄 위.
- 배 길: 자리별 조각(옆으로 1 m · 앞으로 · 후진 · 호) + 뱃길. 손님 배는 늘 앞으로, 빈 배만 후진(내리는 곳에서 빠져 돌아 타는 곳에 후진으로). 조각별 빠르기(옆 0.7 · 후진 2 · 부두 앞 6 · 뱃길 13 m/s).
- 규칙: 바깥 자리 먼저 태움, 빈 배는 안쪽부터, 바깥 자리에 배가 있으면 빈 배로 바로 돌아감, 부두 앞 물은 한 번에 한 척. 뒤로 갈 때 · 옆으로 갈 때 물결 자국 없음.
- 다리 밑 바다에 택시 길 둑이 바닥을 −0.9로 올린 두 줄 없앰(배 용골이 닿던 곳).
