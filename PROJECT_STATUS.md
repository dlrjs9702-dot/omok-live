# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.360 길 고침(문제 기록 8e1f13a5·ba1a3bd5) + 택시 시점 고정(사용자 11-18)

- 길 위 풀: 바람 풀(G1)이 road.png 마스크도 읽음(island-pilot-scene; 땅 그림 밖 별마루섬에선 안 읽음). 키 큰 풀·땅 장식은 bareGround에 길 3.9 m + 0.4. 바닷가 자리(shoreSpots)도 길 밖(쓰레기 병이 차선 위에 생기던 것). ba1a3bd5(툇마루섬 길 오른쪽 절반이 풀밭)는 같은 원인: 길 50 m마다 9곳, 풀이 난 점 고치기 전 8곳 → 0곳.
- 인도까지 바닷물: 물가 거리 등에서 인도 바깥 끝이 바다 높이 이하(최저 −0.98)였음. dalmaru-island roadBank: 길 띠와 그 밖 0.5 m를 바다 위 0.75 m로, 그 밖은 모래 비탈 0.3(약 2.5 m). 올리기만, 다리 끝 4 m 안은 그대로, 8 m 칸 격자로 빠르게. shore 맵은 길 + 1 m를 「지은 곳」(파도 없음).
- 모래사장: cover 맵에서 길 바깥 ~ 바다 사이를 모래로(길이 해안 12 m 안일 때). 바다 → 모래 → 난간/연석 → 인도.
- 택시 시점: plaza-scene에서 탈 때 차 뒤로 돌리기·달리는 동안 차 방향 더하기를 뺌. carYaw는 시험용 기록으로만 남김. 자전거·열차는 원래 카메라를 안 돌림.
- 시험: bicycle.spec 택시 「차가 돌아도 카메라 yaw 그대로, 내가 돌리면 유지」, dalmaru-walk(뜨거나 묻힌 것 0), 단위 땅 지도·택시·자연물. 땅 sampler 15 그대로.

## v1.10.359 N1 별마루섬 땅·다리·숲길 (notes docs/island-expansion-20261115.md §8, 163A~166A)

- 땅: dalmaru-terrain NEW_ISLE (365, 226) 반지름 145(해안 물결), 봉우리 (393, 212) 43.7 m · 남쪽 언덕 17.5 m · 동쪽 갯바위 18.4 m · 캠핑장 평지 (259, 250) 3 m, 개울 CREEK 6점(샘 27.6 m → 북서 해안, 바닥 0.7 m 낮춤, 물은 inCreek, 낚시 river). coastDist에 한 항. 넓이 66,100 ㎡.
- 다리: BRIDGES 세 번째(별마루다리, 윤슬다리 모델 61.75 m, z 226, 165.25~227). 마을 거리 (98, 236) → 다리 이어짐.
- 길: 다리 머리→캠핑장(walk 3), 부두 쪽(walk 2.6), 숲길 고리 701 m·산길 168 m·개울 옆 길(trail). 개울 건너는 곳 작은 다리 자동.
- 숲: 나무 630·덤불 525·바위 170·통나무 40·꽃 210·긴 풀 1,050(모두 isle2, 자기 씨앗으로 맨 뒤에 — 본섬 자연물 그대로, 열매 나무 없음).
- 그리기: 별마루섬 땅 그물(GROUND2 215/72.5/305, 122칸, 본섬 2.5 m 격자 위; 본섬 그물은 해안 14 m 안 칸을 뺌), 땅 지도 isle2-* 6장(768), 바다 판 1,300·별마루섬 바닷가 물결, 개울 물 띠, 멀리 모양(10 m 그물 한 덩어리).
- 넣고 빼기: island.isle2View — 해안에서 110 m 안 전부(나갈 때 125)·160 m 안 멀리 모양·밖은 없음, 전부일 때 60 m 칸이 180 m 밖이면 안 그림; 별마루섬 쪽(x>200)에선 본섬의 안개 밖(230 m) 정적 물체 안 그림. 폰 가장 낮은 단계 0.6배.
- 서버 위치 한계 330 → 540. 원경 coastLong (318, 75) → (330, −95). 미니맵 땅 그림 x −200~530·z −200~385, 안내 지도 가운데 (150, 92) 폭 585. AREAS 「별마루섬」. 이름 사용자 「A」(NAMES 두 줄). 주식 소식: newIsland 켬, 배 줄 2개는 boat(N3).
- 측정(work/n1-isle/p.cjs, gpu-20261117 탐침 그대로, PC 1600×900 높음, Chrome D3D11 RX 570, 358 0f795261 대 N1 -- 358의 땅 고침 뒤라 땅까지 그려진 값): 그리기 수(탐침 단위)·프레임 ms 중앙값

| 자리 | 358 | N1 |
|---|---|---|
| 대청마당 | 604 · 7.9 | 604 · 7.1 |
| 정류장 앞 | 816 · 8.7 | 816 · 7.9 |
| 집 거리 | 320 · 6.0 | 324 · 5.6 |
| 캠핑장(별마루섬) | 56 · 5.1 | 400 · 5.5 |
| 전망대 봉우리(별마루섬) | 164 · 5.6 | 536 · 5.6 |
| 다리 머리(별마루섬) | 72 · 5.2 | 332 · 5.4 |

  통과선: 본섬 세 자리 ±5 % 안, 새 세 자리 정류장(816) 아래.

## v1.10.358 긴급: 폰에서 땅 안 보임 (사용자 갤럭시 폴드, live 1.10.357)

- 원인: 땅 셰이더의 텍스처가 17칸(우리 15 + three.js dfgLUT + 해 그림자). 356까지는 16칸으로 딱 한도였고, 357의 tRoad(찻길 지도)가 넘겨서 MAX_TEXTURE_IMAGE_UNITS 16인 폰에서 프로그램 연결이 실패함(PC는 32라 멀쩡).
- 고침: 회색 결 그림 grass·soil·sand 세 장을 ground-v1/ground.grains.png 한 장으로(R 풀 64 px 4×4 · G 흙 256 · B 모래 32 px 8×8, tools/ground-grains.py). 셰이더는 GRASS/SOIL/SAND 매크로로 채널·배율만 바꿔 같은 값을 읽음 → 15칸.
- 재발 막기: test/ground-samplers.test.js(땅 sampler + 2 ≤ 15).
- 확인: 브라우저에서 땅 프로그램의 실제 sampler 15개(PC·폰 프로필), 모습 같음.
- 357 사진·CI가 멀쩡했던 까닭: Playwright 헤드리스 Chromium은 SwiftShader라 MAX_TEXTURE_IMAGE_UNITS 32. 이 PC의 Chrome(ANGLE D3D11, RX 570)과 대부분의 폰·PC 브라우저는 16이라, 357은 그쪽에서 모두 땅이 안 보였을 것.
