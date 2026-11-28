# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.439 ④ 엔진 대신 셋 P1 — 폰 실측 · 성능 재기 · 장면 계산 줄이기 (결정 62 · 101 · 102)

- 장면 위치 계산 줄이기(plaza-scene): 장면 자체는 위치 행렬을 다시 만들지 않고(`scene.matrixAutoUpdate = false`), 장면에 바로 붙는 물체마다 `childadded`로 감싸서 숨겨진 물체는 건너뛰고 다시 보일 때 한 번 강제 갱신. 택시 정류장 표지 · 도로 표지 · 탑승 표시 · 차선 · 광장 택시 길은 처음 한 번 계산 뒤 고정(island-taxi-scene). 한 프레임 `updateMatrixWorld` 호출 16,213 → 6,502(PC).
- 결정 101: 자동 화질이 한 단계 내리는 기준 — 손가락 화면(`(pointer:coarse)`)만 느린 시간 30 % 넘으면, PC는 그대로 50 %.
- 관리자 「성능 재기」(관리자 창): 섬에서 누르면 약 1분 동안 다섯 곳(대청마당 · 정류장 앞 · 별마루다리 · 마을 거리 · 숲) × 화질 낮음 · 높음(정류장은 건물 비침 켬 · 끔)을 재서 표(fps · p95 · 50 ms 넘은 프레임 · 스크립트 ms · 그리기 수)로 보여 주고, `POST /api/admin/perf`로 서버 로그 `[perf]` 한 줄(이름 · 아이디 없음, 60초에 한 번).
- 프레임 시간이 거꾸로 가면 0으로(시험의 가짜 시계가 진짜 시간보다 작게 시작할 때 내 위치가 NaN이 되던 것).
- e2e island-assets:334 「동작 줄이기에서도 수동 시점과 이동 유지」: main에서도 4~8번에 1번 실패 — 가짜 시계 설치 직후 프레임이 아직 진짜 시간이라 키가 먼저 들어가고, `fastForward`가 프레임을 한 번씩만 돌려 부하 속 걷기 0.12 m. `runFor`로 바꿔 3명 동시 10/10.
- 폰 실측(S21+, 결정 102): 높음 다섯 곳 59.6~59.7 fps(27.6 °C), 이어서 자동 세 바퀴 내내 높음 유지 58.5~59.7 fps · 50 ms 넘은 프레임 0~1(33 °C까지). 스크립트 중앙값은 식었을 때 10~11 ms, 데워지면 12~18 ms — 순서를 바꿔도(자동 → 높음) 같아서 화질 모드가 아니라 온도 탓. 이번엔 느린 프레임이 30 %에 못 미쳐 자동이 내려갈 일이 없었음(내려가는 기준은 유닛으로만 확인).
- 시험: 유닛 perf-439, e2e island-assets · island-taxi-stops · island-taxi-yield · island-view-modes · plaza · island-map · island-solids · economy-admin · admin-issue-log.

## v1.10.438 C2 해안 산책로 + 밤 만 파도 (문제 기록 c057bfa1, 사용자 결정 99 · 100)

- ① 인도: 밤에 인도 · 연석 0.62배, 차선 0.86배(island.js 도로 셰이더 `uNight`) + 바깥 끝 0.5 m 어두운 테두리(땅에 박힌 듯).
- ② 가로등 바닥 빛: 밤 바닥 빛(plaza-scene lampPools)을 대청마당 가로등만이 아니라 길가 가로등(nature lampSpots, 차도 가운데에서 4.45 m) · 물가 거리 가로등에도 — 반지름 2.8 m라 인도와 가까운 차선까지.
- ③ 물가 난간(dalmaru-island `railRun`): 옛 물가 거리 원호(x ±55, 차로가 옮겨 가며 모래 위 1~3 m)에서 바다 쪽 인도 끝선(길 가운데 4.2 m)으로, 부두 T자에서 동쪽 x 67 · 서쪽 x -90까지 4.2 m마다. 비우는 곳: 부두 입구, 모래사장으로 내려가는 산책길, 정류장 표지 · 탑승 표시, 다리. 굽이 안쪽에서는 조각이 인도에서 벗어날 때까지 바다 쪽으로.
- ④ 인도 바깥 끝을 소음으로 흐트러뜨리고(±0.2 m), 마지막 0.6 m에 모래 번짐.
- ⑤ 바닷가 지도(tools/maps/shore.js): 인공 물가(B 64)를 난간 4 m 원 · 차로+1 m에서 실제 인도 · 난간 자리(0.35 m)로 줄이고, 그 옆 모래는 2.5 m에 걸쳐 B 204 → 255(파도가 서서히). 바다 물결 줄 소음 문턱 0.95~1.2 → 0.7~1.15.
- 다듬기 「밤 만 파도」: 밤에 물가 거품 · 얇은 물막과 얕은 물결 줄에 은은한 빛(바다 · 땅 셰이더 `uNight`), 밤 물결 0.3 → 0.5.
- 시험: 유닛 shore-walk-438, e2e dalmaru-walk · island-assets · dex-tabs · island-boat(PC · 폰). 전후 사진 notes img/c2-20261128.

## v1.10.437 C 화면 · 광장 작은 것 (notes docs/issue-plan-20261128.md 3번 묶음)

- a5c63780 재료 사기: 칸 한 개를 두 줄로(이름 · 값 / 개수 칸 · 1 · 5 · 10개 · 사기), 개수 칸 넓이 고정(3.4em, 손가락 화면 3.8em), 버튼 글자 안 꺾임 — 850 px · 폰 모두 칸 넘침 0.
- 22f4502e 가방 가구 탭: 다른 탭처럼 동그라미 칸(`.furnCell`, 8칸 · 폰 4칸), 가구 모델 정지 그림(plaza `furnShot`: 작은 렌더러 하나, 모델마다 한 번 찍어 기억, 안 오면 🪑), 고른 가구 카드도 같은 그림.
- 34141e35 섬 벼룩시장: 게시판을 대청마당 긴 화단(paving (-18, 18) → (-18, -66)) 위로 — 기록의 탑처럼 나무 없는 화단, 흙 위 0.45, 광장 가운데를 봄, SPACE 자리 화단 앞 1.2 m. 화단 앞 가운데 앉을 자리 하나 뺌.
- B 남은 칠 자국: 셰이더가 네 칸 거리를 도로 전체에서 0.9 m부터 씀 — T자 바깥 인도 끝 · 연석 모서리 울퉁불퉁 · 별마루섬 입구 길 끝 노란 자국 정리.
- 시험: 유닛 taxi-road-436(셰이더 판정 그대로) · dalmaru-paths · island-social 자리 수, e2e island-bag · island-flea · island-assets · plaza · dalmaru-walk(PC · 폰).
