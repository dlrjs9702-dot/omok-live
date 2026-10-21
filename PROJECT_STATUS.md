# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.123 문제 기록 2회차 5묶음: 툇마루섬 넓히기, 집터 12곳 다시 놓기

- 근거: gamecenter-notes `docs/issue-log-review-20261021-b.md` 15번(윤슬만 쪽만 넓히는 타원으로 정정).
- 15: 툇마루섬을 북쪽(윤슬만, −z)으로만 반지름 50까지 늘린 타원(`dalmaru-terrain` ISLE.rn·`isleDist`, 해안·평지 띠·계절 구역 모두). 남쪽 기차 링·역·다리는 그대로.
- 집터 12곳 새 자리와 방향(가까운 길 쪽, `HOME_LOTS` yaw): 큰 집 둘레(6.5 m)가 길과 2 m, 서로 2 m, 해안에서 3 m 이상, 평평한 땅(집터 평지 패드), 모든 크기의 문 앞이 걸을 수 있는 땅. 줄기 길과 집터마다 오솔길 다시 깔기.
- 안내판을 새 줄기 길 옆으로.
- 섬 주민 둘이 서로 비킬 때 한쪽이 소품에 막히면 다른 쪽이 남은 만큼 비킴(`island-npcs` 짝 떼어 놓기, 전에는 한쪽이 멈춰 선 때만) — 바뀐 경로에서 배회 NPC 시험(가혹한 장면)이 0.74 m를 찾아냄.
- 검증: 단위(집터 규칙 — 평지·해안·길·서로, 배회 NPC), e2e 내 집·달마루 걷기(PC·휴대폰). Codex 검토 대기(10/25).

## v1.10.122 문제 기록 2회차 4묶음: 내 집 가구를 캐릭터로 직접 옮기기

- 근거: gamecenter-notes `docs/issue-log-review-20261021-b.md` 11번.
- 11: 내 집에서 가구 앞에 서서 행동 단추(Space)를 0.45초 길게 누르면 잡기 — 앞뒤 이동으로 0.5 m 칸씩 밀고 당기기(속도 0.9), R·돌리기 단추로 90°, 다시 누르면 놓기. 자리 검사는 `HOME.placeError` 그대로, 옮길 때마다 `/api/home/place`로 저장하고 틀리면 되돌림.
- 모션 4개(FurnGrab·FurnPush·FurnPull·FurnTurn, `island-models.json`), 안내 「가구 놓기 · R 돌리기」, 휴대폰은 행동 단추 누름·뗌으로 같은 동작.
- 검증: e2e 내 집(잡기·밀기 0.5 m 칸·돌리기·놓기, 서버 반영, PC·휴대폰). Codex 검토 대기(10/25).

## v1.10.121 문제 기록 2회차 3묶음: 폭포 위 연못, 관공서 옆 절벽

- 근거: gamecenter-notes `docs/issue-log-review-20261021-b.md` 16·18번.
- 18: 두 폭포 위 능선에 작은 연못(`dalmaru-terrain` FALLS·HEAD_PONDS), 폭포가 연못 물 높이에서 흘러내림(`island.js`, 연못 면 = 못 높이 − 3 cm), 연못은 물로 처리(`isWater`).
- 16: 관공서 계단 쪽 옆면도 절벽으로 — 깎는 자리(CUTS)를 계단 길 폭(`stairsBand`)에서만 비움, 백화점처럼 파고 들어간 모양.
- 검증: 단위(달마루 섬), e2e 달마루 걷기·섬 충돌 포함 전체(CI). Codex 검토 대기(10/25).
