# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.126 문제 기록 3회차 2묶음: 꾸미기 창·벽에 붙이기·부드럽게 밀기, 집 명패, 실내 검정

- 근거: gamecenter-notes `docs/issue-log-review-20261022.md` 5·6·7·16·18번.
- 5: 꾸미기 창을 가장자리 띠로(`plazaDialog.editMode`, PC 오른쪽 340 px·휴대폰 아래 44%, 「접기」로 제목만), 카메라는 방 전체를 위에서(`homeEditView`, 방 크기 × 1.6, 들기 1.05 rad).
- 6: 가구가 0.25 m 칸 또는 벽에 딱 붙은 자리에 섬 — 벽(±4.35·±5.85·…)이 칸에 맞지 않아 최대 0.24 m 틈. `placeError`가 벽 맞닿음을 받고, `snapPos`가 가장 가까운 칸·벽 자리로(꾸미기 단추·잡아 옮기기 공통). 단위 시험.
- 7: 잡은 가구는 캐릭터와 함께 0.9 m/s로 미끄러짐(칸 없이, 벽·다른 가구 앞에서 멈춤 — 반씩 줄여 마지막 빈 자리), 돌리거나 놓을 때만 `snapPos`로 맞춰 서버에 한 번 저장. e2e 내 집 바뀜.
- 16: 집 위 떠 있는 이름표를 없애고 명패 모델 판(가운데 패널 0.5 × 0.22 m)에 이름을 새김, 정면에서만 읽힘.
- 18: 실내에선 배경·안개 검정, 바다 볼거리·고래 멈춤.
- 검증: 단위(내 집 배치·앉는 높이), e2e 내 집(PC·휴대폰)·가구점·펫샵·광장(PC). Codex 검토 대기(10/25).

## v1.10.125 문제 기록 3회차 1묶음: 공통 오류, 수조 물고기, 소파 앉기, 민원실 데스크, 관공서 기둥

- 근거: gamecenter-notes `docs/issue-log-review-20261022.md` 공통 오류·2·3·9·12번.
- 공통 오류 `reading 'name' @ plaza-scene.js:3091 at step`(4건): 가까운 것(best)이 지난 프레임의 `grab:hold`·`fish:spot`일 때 — 가구를 놓거나 낚싯줄을 거두며 그 자리를 지운 뒤 이름을 읽음. `doorOf`에 없는 id는 건너뜀(모든 경로가 지나는 자리 한 곳).
- 12: 수조 물고기가 머리(−Z) 쪽으로 헤엄(방향 +π, 에셋 front −Z).
- 3: 내 집 앉을 자리 높이 — SitIdle 몸 앉는 면이 뿌리보다 0.26 위, 장면이 0.28 올림 → 뿌리를 방석보다 0.54 아래(광장 벤치와 같게, 전에는 0.45로 9 cm 뜸). 침대 0.55·2층 침대 0.5로 모델 매트리스에 맞춤. 단위 시험 `home-seat-height`(모든 앉는 가구: 모델 방석 높이, 앉은 몸).
- 9: 민원실 — 데스크 앞줄(데스크 앞면 + 0.35) 뒤로는 서지 못하고, 데스크 안에서 밀려날 때도 앞이나 옆으로만(`roomClamp`, 서버 공통). 단위 시험 추가.
- 2: 관공서 정면 에셋 교체(assets 55 `facade_townhall`, 기둥 ±2.9·±6.0·±9.1·±12.2, 가운데 칸 5.8 m).
- 검증: 단위(앉는 높이, 민원실, 에셋), e2e 내 집(PC·휴대폰), 광장(PC — 챔피언 이름표 :400·첫 접속 성별 :753은 main에서도 같은 자리에서 실패, CI 3차에 넘김). Codex 검토 대기(10/25).

## v1.10.124 문제 기록 2회차 6묶음: 가구점·펫샵 바닥, 길 파임, 자전거가 돌판에 묻힘, 진단에 장착

- 근거: gamecenter-notes `docs/issue-log-review-20261021-b.md` 2·3·9·10번(사진 서명 링크로 사진 확인 뒤 원인).
- 9·10: 가구점 바닥이 꺼지고 펫샵 바닥이 들쭉날쭉하던 것 — 바닥 모델은 방 가운데와 카메라 거리로 Low로 바뀌는데, 6 cm 판 바닥의 Low는 단순화로 아래를 보는 면 하나만 남아 위에서 안 보였음(위를 보는 면 가구점 658→69 m², 펫샵 654→250, 깔개 18→1, 내 집 타일 바닥 절반). 바닥·깔개·내 집 바닥은 Low 없이 High만(`island-assets` FLOOR, 빌드 설정·Low 파일 21개 뺌). 단위 시험 `floor-low`: 위를 보는 면이 10 m² 넘는 모델의 Low가 1/3 넘게 잃으면 실패.
- 3: 마을 길 1 m 돌판을 가운데 높이로 평평하게 놓아 비탈에서 위쪽 절반이 잔디에 묻혔음(898장 중 343장, 최대 11 cm) — 판마다 땅 기울기로 눕히고 1 cm 띄움, 갈림길 원판은 둘레에서 땅이 가장 솟은 만큼 더 올림(`island.js` placeFlat). 단위 시험 `path-paving`: 섬 전체 마을 길 판·원판에서 땅이 솟아 나온 곳 없음.
- 2: 캐릭터·자전거가 지형 높이에 서서 4 cm 돌판에 5 cm 묻혔음 — `island.js` heightAt에 마을 길 돌판 높이(`paveLift` 0.05, 광장·다리·물길·관공서 자리 제외).
- 문제 기록 진단에 쓴 사람의 장착(옷 칸 id·변신·보이는 방식·입힌 부품, `ctx.wear`·`[issue]` 줄 `wear`) — 옷 기록을 사진과 장착으로 바로 재현. 계정 id·토큰·IP는 그대로 안 넣음(`docs/issue-log-status-20261021.md` 4).
- 1회차 16 「배가 옷을 뚫고」: 재현 안 됨 — 사진의 회색 고양이 머리 + 노란 윗옷은 v1.10.118에서 뺀 동물 고양이 옷. 고양이 변신 current는 털 몸 전체 모델(옷 없음)이고 섬에서는 변신이 옷을 대신함. 기본 옷과 남은 노란 계열 세 벌(캐주얼 반팔·짧은 우비·스포츠복)을 서기·걷기, 정면·옆에서 찍어도 배가 안 보임.
- 검증: 단위(바닥 Low, 길 돌판, 문제 기록 장착, 전체), e2e 자전거·달마루 걷기·광장·가구점·펫샵·내 집(PC), 자전거·펫샵(휴대폰). Codex 검토 대기(10/25).
