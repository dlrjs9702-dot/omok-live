# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.133 문제 기록 4회차: 능선 계단 둘레(끊긴 길·뜬 발판·계단 위 산)

- 근거: gamecenter-notes `docs/issue-log-review-20261023.md` 새 기록 3건(모두 v1.10.127에서 계단을 1.5° 옮긴 뒤).
- 원인: 땅은 2.5 m 그물(`meshGroundHeight`)로 그려지는데, 관공서 옆 절벽 메움(CUTS)이 계단 쪽에서 1.5 m만 비켜 있었음 — 계단이 관공서에서 3 m 떨어진 뒤로는 그려진 절벽이 계단 발치·판 위로 기울어 최대 17 m 덮음(서는 땅은 1.5 m — 「통과할 수 있는 산」), 그 위 갈림길 원판(`placeFlat`, 둘레 가장 높은 땅만큼 올림)이 9 m 공중. 꼭대기 메움(TOP)은 2.4 m 깊이라 그물 사이에 빠져 그려진 땅이 7 m 아래. 능선 길 첫 점이 216°에 고정돼 계단 꼭대기(210.5°)에서 가파른 비탈을 지남.
- 고침(`dalmaru-island.js`): 계단 둘레 메움 비킴 4.5 m(`STAIRS_CLEAR`, 그물 한 칸 대각선보다 넓게), 꼭대기 메움 5 m 깊이·2.5 m 가장자리, 능선 길은 메움 한가운데에서 계단 꼭대기 각도(`STAIRS_TOP_DEG`)+4°로, 계단 둘레(10 m)는 그려진 땅이 발보다 0.5 m 넘게 위·아래면 설 수 없음(`underDrawnRock` — 보이는 것 = 막는 것).
- 시험: 새 `stairs-ground`(계단 판 위 그려진 땅 0, 둘레 보이는 땅 = 서는 땅, 위·아래 끝에서 걸어서 길까지, 섬의 모든 길이 걸을 수 있는 땅 — 셋 다 옛 코드에서 실패), `path-paving` 갈림길 원판 0.4 m 넘게 뜨지 않음(옛 코드 실패), `scattered-settled` 잡초 기준점을 계단에서 먼 w3501로(1,396개 번호·자리 그대로, 계단 둘레 4개만 바뀜). e2e 자전거(계단에서 내림)·달마루섬 걷기 통과.
- Codex 검토 대기(10/25).

## v1.10.132 문제 기록 3회차 8묶음: 낚시 입질 화살표

- 근거: gamecenter-notes `docs/issue-log-review-20261022.md` 4번.
- 4: 입질 때 SPACE 한 번 대신 화살표 순서 맞추기. `lib/island-fishing.js` `ARROWS {common:4, normal:6, rare:9, big:12}`, `arrowsFor`, 시간 `arrowMs(n) = n×700 + 1500`(늦음 판정도 이것, `BITE_MS` 없앰). 서버 fish/start가 `window`·`arrows`를 보냄. 화면 `#fishArrows`(PC 방향키, 휴대폰 `pointer:coarse`는 단추 4개), 틀리면 찌만 흔들림, 마지막 화살표가 당기기. 시간 막대는 상자가 보인 뒤 줄어듦. 보상은 그대로.
- 시험: 단위 `island-fishing`, e2e `plaza`(낚시)·`river-fishing`은 `pressFishArrows`로(PC·휴대폰).
- Codex 검토 대기(10/25).

## v1.10.131 문제 기록 3회차 7묶음: 잠자리채·낚싯대 들기와 휘두르기, 농장 창고·허수아비

- 근거: gamecenter-notes `docs/issue-log-review-20261022.md` 22번, 15번(에셋 68).
- 22: 가방의 잠자리채·낚싯대 「들기/넣기」(손에 장착, `TOOL_HOLD`). 잠자리채를 들면 SPACE(휴대폰 상호작용)가 `tool:swing` — NetSwing 동작(assets 66), 앞 1.5 m 부채꼴을 450 ms에 판정: 곤충은 `/api/island/insect/catch`로 잡고, 주민은 HitReact 뒤 Angry와 화난 말풍선. 들지 않으면 곤충 앞 안내만(「가방에서 잠자리채를 들면 잡을 수 있어요」).
- 15: 농장 마당 창고(`farm.shed`, 문 −Z로 마당 안쪽)·허수아비(`farm.scarecrow`) 모델(assets 68)로 임시 상자 교체.
- 시험: e2e `island-tool-swing`(들기·곤충 잡기·주민 맞기·넣기, PC·휴대폰), `island-insects`의 잡기를 휘두르기로(#271의 고르기·같은 답 비교 유지), 에셋 파이프라인 목록.
- Codex 검토 대기(10/25).
