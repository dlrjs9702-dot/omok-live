# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.127 문제 기록 3회차 3묶음: 뜬 돌·잡초, 능선 계단과 관공서, 마당 바닥 깜빡임

- 근거: gamecenter-notes `docs/issue-log-review-20261022.md` 8·11·19번.
- 8: 흩어 놓은 것(나무·덤불·돌·꽃·잡초·풀덮개·가로등)을 계산식 땅(`ground`)이 아닌 그려진 땅(`meshGroundHeight`, 2 m 메시)에 놓음 — 능선 비탈·절벽 끝에서 둘이 최대 4 m 달라 뜨거나 묻힘. 절벽 조각만 계산식 그대로. 돌·꽃·잡초는 앉을 자리만(`settledSpot`: 둘레 0.3 m가 가운데보다 0.09 m 넘게 꺼지지 않음, 계산식·메시 차 0.15 m 미만, 길·계단 밖) — 돌 120 → 68, 처음 잡초 1,400 → 약 1,350. 잡초는 번호(w<i>)를 매긴 뒤 거르고, 다시 자라는 자리도 같은 규칙. 잡초에 따로 씨앗(`seed = 0x7a1f5`)과 시도 번호(`i`, `w<i>`, 시도마다 난수 3개) — 계단 이동으로 앞선 나무·꽃 배치가 난수 순서를 밀어 잡초가 전부 움직였기 때문, 이번 한 번 섞이고(뽑힘 기록은 번호로 남아 수는 그대로) 앞으로는 나무·꽃·길이 바뀌어도 그 자리만 빠지고 나머지 번호·자리 그대로. 잡초 서버 시험은 처음 수를 BASE에서 읽음. 단위 시험 `scattered-settled`(0.1 m 넘게 뜬 것 0, 번호 그대로). 「떠 보이는 붉은 바위」는 가을 각진 나무 — 에셋 교체(assets 63 `tree_block` 4계절: 줄기 1.7배, 가을 잎 아랫면 밝게).
- 11: 능선 계단을 능선 따라 1.5°(226° → 210.5°) 옮김 — 관공서 정면 모서리와 1.6 m → 4.75 m, 길·꼭대기 메움은 계단 끝을 따라감. 단위 시험 `footprints`(건물·마당·알림마루 소품·초가·집터·계단·다리 서로 2 m 이상).
- 19: 길 띠가 대청마당 박석과 관공서 마당 아래로 들어가 같은 높이에서 겹쳐, 보는 각도에 따라 흙이 비침 — 그 테두리 0.2 m 안에서 띠를 끝냄.
- 검증: 단위(흩어진 소품, 건물 간격, 달마루 섬, 에셋), e2e 달마루 걷기·광장. Codex 검토 대기(10/25).

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
