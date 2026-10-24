# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.136 R1: 이름 있는 주민 13명 새 몸, 배회 주민 10명 고유 외형(F3)

- 근거: gamecenter-notes `docs/backlog-dispatch-20261022.md` R1(assets 52 F4), F3(assets 51 v2, 2026-10-24 검토 통과).
- R1: 농부·화가·역무원·거리 악단·전기 담당·공사 인부·도서관 할아버지·정자 할아버지·민원·세무·은행 직원·잡화점 주인·변신 의상실 주인 13명 원본을 `npc52:`로 바꿔 High·Low 26개 다시 빌드. 얼굴·머리·옷 색·직업 소품은 그대로.
- F3: 배회 주민 10명(봄이·바다 할아버지·하람·두리·노을 할머니·오 탐정·다온·바람이·이솔·가람)이 `character.islander`+옷 색 대신 `character.walker.<id>`(island-cast WALKERS 순서, `WALKER_LOOKS`), baked, 가람 0.75배, 말풍선 높이 주민마다. 예산 예외(사용자): 이 20개만 High ≤ 32,000 / Low ≤ 10,000(`budgets.json` fileOverrides, 원본 sha 고정).
- F3 상체 기울임(README 권장 각도, 화면만 — 걷는 속도 그대로): `WALKER_LOOKS` lean(노을 할머니 8°, 바다 할아버지 5° 등, 0이면 없음)을 Spine 60 %·Chest 40 %로 나눠 모델 앞(−Z)으로. 움직임 16개가 Spine·Chest 중 하나에 회전 트랙이 없어 지난 프레임 기울임을 먼저 빼고 `anim.update` 뒤 다시 더함(쌓이지 않음).
- `asset-loader.js` dress(): Low 파일이 있는 통째 캐릭터는 High·Low를 둘 다 받아 Low를 High 뼈에 관절 이름으로 묶고 거리로 바꿈(wearLod, 휴대폰 낮은 등급은 더 가까이서 Low) — 이름 있는 NPC들도 같이 혜택.
- 남은 것: 노을 할머니 지팡이가 앉을 때 좌석을 통과할 수 있음(배회 주민은 아직 앉지 않음 — 앉게 될 때 숨기기).
- 시험: 에셋 파이프라인·GLB 예산(예외 사유·sha), e2e `island-assets`·`resident-talk`.
- Codex 검토 대기(10/25).

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
