# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.130 문제 기록 3회차 6묶음: 안내 지도 크게 보기

- 근거: gamecenter-notes `docs/issue-log-review-20261022.md` 14번.
- 14: 알림마루 지도판 창을 화면 가득(`plazaDialog.mapMode`, 96vw·96dvh), 캔버스를 보이는 크기 × 화소 비율(최대 2)로 그림. 휠(PC)·두 손가락 핀치(휴대폰)로 그 점을 중심으로 6배까지 확대, 끌어서 이동(섬 밖으로는 안 나감). 이름은 확대해도 같은 크기로, 점 위 → 아래 → 오른쪽 → 왼쪽 중 비는 곳에, 다 막히면 뺌(확대하면 나타남) — 「현재 위치」가 먼저, 다른 이름은 남의 점을 덮지 않음. 3D 지도판 그림도 같은 규칙.
- 시험 e2e `island-map`(화면 가득·휠·끌기·핀치, PC·휴대폰).
- Codex 검토 대기(10/25).

## v1.10.129 문제 기록 3회차 5묶음: 대청마당 가장자리 꾸밈, 농장 마당

- 근거: gamecenter-notes `docs/issue-log-review-20261022.md` 13·15번.
- 13: 대청마당 남·동·서 가장자리 안쪽 3 m에 10 m마다 묶음(화단 1, 양옆 벤치, 연석 쪽 가로등) — 길 입구·문 앞 6 m·정원·물길·마당의 자리·스폰은 비움(`plazaProps` `clear()`). 화단 11, 벤치 14(+기존 4), 가로등 19. 가장자리 벤치는 연석에서 마당 안쪽을 봄(`rim: true`, 시험 `seat-facing`), 광장 좌석 4+14+28(`island-social`).
- 15: 퀘스트 밭 둘레를 농장 마당으로(`FARM.yard`): 밭 3개 더(2×2, 2 m 사이, 평지 패드), 울타리(0.7 m마다 부딪힘, 오솔길이 들어오는 북쪽은 문으로 비움), 남서쪽 창고, 밭 사이 허수아비. 나무·덤불은 마당 밖(`addNatureBlock`), 돌·꽃·잡초는 `settledSpot`이 마당을 뺌 — 잡초 13포기만 빠지고 나머지 번호·자리 그대로. 창고·허수아비는 에셋 요청 중이라 상자 대신 그림, 울타리는 계절 울타리 모델.
- 검증: 단위(좌석 방향·수, 흩어진 소품, 길 끝, 건물 간격), e2e 농장 주민·섬 에셋. Codex 검토 대기(10/25).

## v1.10.128 문제 기록 3회차 4묶음(길 체계): 대청마당 가장자리, 게임관 길, 계단 위아래 길 끝

- 근거: gamecenter-notes `docs/issue-log-review-20261022.md` 10·20번.
- 20: 대청마당 아래 땅이 박석보다 높아지지 않게 함(가장자리 2.5 m까지, 2 m 땅 칸이 가장자리에 걸쳐도 평평) — 게임관 평지 패드가 동쪽 가장자리를 26 cm 밀어 올려 잔디가 박석 위로 들쭉날쭉 솟았음. 게임관 문(계단 발치에서 1.5 m 안쪽)에서 마당 가장자리까지 마을 길 띠(폭 3.2)로 이음(`T.SPOTS`의 hall마다).
- 10: 능선 위 길이 맨 위 단 위에서 시작해 절벽 아래로 띠가 늘어지던 것 — 능선 가장자리(`stairsAt(34.4, -0.4)`)에서 시작. 계단 아래 길도 첫 단 앞(`stairsAt(-0.4, 1.7)`)에서 끝냄.
- 잡초: 길이 덮은 1포기만 빠지고 나머지 번호·자리 그대로(v1.10.127 시도 번호).
- 단위 시험 `walk-ends`: 모든 길 끝이 다른 길·마당·문·다리·계단·역·이름 있는 곳에 닿음(폭/2 + 0.7 안), 길 점이 계단 단 위에 없음.
- 검증: 단위(길 끝, 흩어진 소품, 건물 간격, 달마루 섬), e2e 달마루 걷기·광장. Codex 검토 대기(10/25).
