# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

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

## v1.10.436 B 택시 · 도로 (notes docs/issue-plan-20261128.md 2번 묶음)

- f62f225a-1 문: assets 183(taxi_island High · Low를 door_L · door_R · wheel_FL/FR/RL/RR 노드로 다시 나눔 — 272 99b 빌드가 한 덩어리로 합쳤음, `precompressed`), `taxi.car` `keepNodes`. 탈 때 · 내릴 때 door_L 0 → −70°, 바퀴 굴림 반지름 0.38.
- f62f225a-2 대청마당 합류부(사용자 결정 98 A): 길 끝 차선(x −1.6 ~ 3.0)부터 두 번째 자리 차 끝(x 14.6)까지 돌바닥 위 폭 3 m 아스팔트 띠(z −55 ~ −52, `PLAZA_WAY`)와 흰 가장자리 선 — 메시, 돌바닥 위 3 cm · polygonOffset. 차가 이 띠를 따라 나와 길로 꺾어 들어감(운행은 그대로).
- 66460bba 지그재그 금: T자 한쪽 구석에서 두 길의 좌우 부호가 엇갈려 노란 선 · 회색 줄이 생김. 툇마루섬 마을 정류장 · 툇마루섬 갈림 · 마을 길 모퉁이를 TEES로 칠함(`box` · `far` · `bar` 생략 가능), L1도 `PAINT_FLIP`(회차 자리 부호는 길 끝을 따름), 막힌 끝은 10 m 안 조각을 끝 평면으로 자름. 셰이더(island.js)는 걸러진 R이 0 근처인데 네 칸 거리가 먼 곳을 그 거리로 읽어 인도 · 차선으로 그림. 섬 전체에 못 가리는 뒤집힘은 별마루섬 입구 길 끝(택시 서는 자리 아래) 하나.
- ca8229cf 떨림: 탈 때 받은 위치 보정(`correction`)이 목표에 닿지 못해 타는 내내 stepTaxi 뒤에서 정류장 쪽으로 끌어당김. 택시 · 배 · 기차 · 엘리베이터 위에서는 보정을 받지 않고 남은 것도 버림, 탈 때 · 내릴 때 `trainChangedAt`으로 그 전 보정 무시.
- f62f225a-3 기울기: 차 앞뒤 1.3 m · 옆 0.75 m 땅 높이로 앞뒤 · 옆 기울기(0.35 rad까지) — 별마루다리 아치에서 ±0.15 rad.
- 다듬기 「택시 비스듬히」: 서 있는 차를 문 쪽으로 25° 돌려 그림(그림만; 서는 자리 · 문 · 탑승 표시 · 운행은 그대로), 탈 때 곧게, 서면 다시.
- 시험: 유닛 `taxi-road-436`, e2e island-taxi-stops · island-taxi-yield · bicycle · island-boat · dalmaru-walk(PC · 폰).
