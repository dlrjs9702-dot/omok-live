# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.131 문제 기록 3회차 7묶음: 잠자리채·낚싯대 들기와 휘두르기, 농장 창고·허수아비

- 근거: gamecenter-notes `docs/issue-log-review-20261022.md` 22번, 15번(에셋 68).
- 22: 가방의 잠자리채·낚싯대 「들기/넣기」(손에 장착, `TOOL_HOLD`). 잠자리채를 들면 SPACE(휴대폰 상호작용)가 `tool:swing` — NetSwing 동작(assets 66), 앞 1.5 m 부채꼴을 450 ms에 판정: 곤충은 `/api/island/insect/catch`로 잡고, 주민은 HitReact 뒤 Angry와 화난 말풍선. 들지 않으면 곤충 앞 안내만(「가방에서 잠자리채를 들면 잡을 수 있어요」).
- 15: 농장 마당 창고(`farm.shed`, 문 −Z로 마당 안쪽)·허수아비(`farm.scarecrow`) 모델(assets 68)로 임시 상자 교체.
- 시험: e2e `island-tool-swing`(들기·곤충 잡기·주민 맞기·넣기, PC·휴대폰), `island-insects`의 잡기를 휘두르기로(#271의 고르기·같은 답 비교 유지), 에셋 파이프라인 목록.
- Codex 검토 대기(10/25).

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
