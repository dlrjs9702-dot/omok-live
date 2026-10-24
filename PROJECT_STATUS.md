# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.135 문제 기록 3회차 10묶음: 변신 펫·메타몽

- 근거: gamecenter-notes `docs/issue-log-review-20261022.md` 21번.
- 21: 펫샵(백화점 3층) 카운터 SPACE(`petshop:counter`) → 목록 — 변신 22종을 그 모습 그대로 작게(`transformPet`, 0.42배, 공통 Idle·Walk·SitIdle) + 메타몽(assets 65 `together.pet_ditto`, 삼각형 예외 High 17,000 / Low 5,500). `island-petshop.js` `catalog()`·`catalogOf`·`known`·`nameOf`, 가격은 경제 값 `pet:transform_animal` 8,000 · `pet:transform_ip` 12,000 · `pet:ditto` 12,000, `POST /api/island/petshop/buy`. 한 종류에 한 마리, 가방 밖이라 선물 불가.
- 고침: 승강기로 멀리 간 뒤 펫이 섬 땅 높이로 붙어 방 바닥 아래에 남던 것(`spaceFloor`), 시험용 teleport도 방 바닥 높이로.
- 시험: 단위 `pet-catalog`, e2e `pet-catalog`(PC·휴대폰).
- Codex 검토 대기(10/25).

## v1.10.134 문제 기록 3회차 9묶음: 곤충·물고기 부탁

- 근거: gamecenter-notes `docs/issue-log-review-20261022.md` 17번(사용자 결정 10/22 「곤충·물고기 부탁」).
- 17: 사진가의 두 부탁(`photomemory` 첫 섬 나들이, `photographer` 주간)을 `catchSteps`로 — 곤충 한 마리(`give insect_*`) 다음 물고기 한 마리(`give fish_*`). 첫 나들이 메뚜기·붕어, 주간 무당벌레·망둥어(날마다 섬 어딘가에 있는 것). 보상 3,000 + 4,000 + 마무리 15,000(합계 그대로). 상태에 `v: 2`, 그 전부터 진행 중이던 사진 부탁(`v` 없음)은 `storyState`가 완료로 봄(받은 보상 그대로). 곤충을 잡거나 물고기를 낚으면 서버가 그 자리에서 부탁용 가방을 갱신(`questBagNow`).
- 시험: 단위 `island-quests`·`solo-quest-server`, e2e `plaza`(부탁 흐름).
- Codex 검토 대기(10/25).

## v1.10.133 문제 기록 4회차: 능선 계단 둘레(끊긴 길·뜬 발판·계단 위 산)

- 근거: gamecenter-notes `docs/issue-log-review-20261023.md` 새 기록 3건(모두 v1.10.127에서 계단을 1.5° 옮긴 뒤).
- 원인: 땅은 2.5 m 그물(`meshGroundHeight`)로 그려지는데, 관공서 옆 절벽 메움(CUTS)이 계단 쪽에서 1.5 m만 비켜 있었음 — 계단이 관공서에서 3 m 떨어진 뒤로는 그려진 절벽이 계단 발치·판 위로 기울어 최대 17 m 덮음(서는 땅은 1.5 m — 「통과할 수 있는 산」), 그 위 갈림길 원판(`placeFlat`, 둘레 가장 높은 땅만큼 올림)이 9 m 공중. 꼭대기 메움(TOP)은 2.4 m 깊이라 그물 사이에 빠져 그려진 땅이 7 m 아래. 능선 길 첫 점이 216°에 고정돼 계단 꼭대기(210.5°)에서 가파른 비탈을 지남.
- 고침(`dalmaru-island.js`): 계단 둘레 메움 비킴 4.5 m(`STAIRS_CLEAR`, 그물 한 칸 대각선보다 넓게), 꼭대기 메움 5 m 깊이·2.5 m 가장자리, 능선 길은 메움 한가운데에서 계단 꼭대기 각도(`STAIRS_TOP_DEG`)+4°로, 계단 둘레(10 m)는 그려진 땅이 발보다 0.5 m 넘게 위·아래면 설 수 없음(`underDrawnRock` — 보이는 것 = 막는 것).
- 시험: 새 `stairs-ground`(계단 판 위 그려진 땅 0, 둘레 보이는 땅 = 서는 땅, 위·아래 끝에서 걸어서 길까지, 섬의 모든 길이 걸을 수 있는 땅 — 셋 다 옛 코드에서 실패), `path-paving` 갈림길 원판 0.4 m 넘게 뜨지 않음(옛 코드 실패), `scattered-settled` 잡초 기준점을 계단에서 먼 w3501로(1,396개 번호·자리 그대로, 계단 둘레 4개만 바뀜). e2e 자전거(계단에서 내림)·달마루섬 걷기 통과.
- Codex 검토 대기(10/25).
