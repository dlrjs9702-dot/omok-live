# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.369 별마루섬 숲 구역(§9) + §6 가려도 보이기 + 검토 고침

- 구역(사용자 「전부 A」, isle2Zone 데이터): 동산 20 %·숲속 53 %·산책길 22 %(양쪽 7 m)·오솔길 4 %. 숲속 100 m²당 3.0그루(큰 나무 1.2)·잎 덮임 88 %·빈 칸 없음, 산책길 2.3(큰 나무 줄), 오솔길 2.4(터널), 동산 0.25. 새 오솔길 3개(폭 1.5 m). 나무 발치 들꽃은 동산·산책길만.
- 무게: 별마루섬 묶음 40 m, 숲 안에서는 High 150 m·Low 70 m까지, 큰 나무 High 25 m. PC High 모든 자리 316선 아래, 폰 Low 숲 안 1.06배(동산 가장자리 1.48배는 총괄 OK). walkDist 상자 먼저 보기(같은 값, 빨라짐).
- §6 가려도 보이기: 나무·덤불·큰 나무·느티 재질에 화면 구멍(내 둘레 13 %, 나보다 카메라 쪽만, 0.2초), 3인칭 밖에서 카메라 6 m 안 잎·줄기 점무늬로 사라짐(3 m 안 없음), 1인칭·실내 끔. 그림자는 그대로.
- 막혔을 때: 별마루섬은 isle2Clear·isle2Open(길까지 이어진 빈 칸), 없으면 다리 머리. 본섬은 주민 격자의 큰 연결 덩어리만(검토 #7).
- 이벤트 칩 → 공지 카드(닫기), 판매 미리보기에 이벤트 배수(서버 sellMults, 정산 = 미리보기).
- 검토 #3 별똥별 반짝이 이벤트가 반짝이 확률에, #4 받은 소원은 wished에서 빠짐, #5 groundReady는 땅 그림만, #8 로딩 팁 메모리·IP 제한, #2(사용자 A) 보석은 이벤트 배수 없음.

## v1.10.368 로딩 안정화 + 장소 칩 + 민물·바다 수조

- 로딩(사용자 「로딩창 중 다 안정화 되고 넘어가게」): 장면 준비 신호 PlazaReady(땅 그림 LoadingManager 다 옴 + 모델·그 그림 대기 0 + compileAsync, 새로 온 뒤 다시 컴파일). 첫 입장 덮개 = 준비 + 10장면 50 ms 안(20초). 자리 바뀜(30 m 넘게 순간 이동·장면 재시작: 방·택시·열차·배·다시 연결·새로고침) 뒤 2장면에 준비 안 됐으면 짧은 덮개(팁 없음, 준비 + 5장면 100 ms 안, 8초). 시험: 단위 + e2e(땅 그림 cover-a 3초 붙잡기, PC·폰). three LoadingManager는 셈을 안 보여 줘서 itemStart/itemEnd로 직접 셈.
- 장소 칩(총괄): AREAS에 반지름 r(별지기 느티 25 m), 다리 위 「별마루다리」, 캠핑장 둘레 「캠핑장 터」, 서버 힌트 이름도 r 지킴.
- 민물·바다 수조(사용자 1A 2A): 첫 물고기가 물을 정함, 다른 물은 TANK_WATER, 비우면 다시, 섞인 수조는 꺼내기만. 모습: 민물 연초록 물 + 자갈 판, 바다 파란 물 + 모래 판(tank_water 재질 복사본). 창 제목 「민물/바다 수조 · n/m칸」, 「섞인 수조」. 물 구분은 island-home(단위 시험이 lib WATER_OF 50종과 같은지 확인).
- 캡처 도구: 별마루섬 숲 안쪽 자리 3곳, 짧은 덮개가 걷힌 뒤 찍기.

## v1.10.367 N1b 별마루섬 숲 다듬기(156) + 주식 부도 1A

- 세 층: 큰 나무 150(전나무·소나무·참나무, 156 High 40 m 안·Low 밖, 그림자는 High만), 숲 바닥 고사리 420(25 m 밖 사라짐)·이끼 바위 60·쓰러진 통나무 24. 각자 seed, 앞의 배치는 그대로. 숲길 가장자리 5 m 트임·12 m 안은 35 %만, 캠핑장·봉우리·개울 둘레 빈터.
- 별지기 느티(156 §8, 40 m): (261, 197) 다리 머리 북동쪽(선착장 30 m, 캠핑장 가장자리 34 m), 숲길에서 20 m. 채집 자리(버섯·나뭇가지) 한 번 새로 섞임. 18 m 안의 나무·덤불·바위 뺌, 막힘 = 156 solids.json(줄기 r 3.55 + 뿌리 원 184, 아치 아래는 지나감), 대역 = 줄기·잎·뿌리 상자. 표지판(빈터 가장자리), 지도·미니맵 이름(AREAS ancient), 로딩 팁.
- 멀리 모양: 숲 덩어리(156 clump 3종) + 느티 빌보드, 그림자 없음.
- 주식(사용자 1A·2A): 2026-11-23 09시(BUST_FROM)부터 부도 날마다 그날 종가 < 상장가인 회사 중 키 랜덤 1곳(주 1~3번 그대로, 없으면 없음). 그 전 값·부도는 그대로(시험: 바이트 같음). 해송 제과 부도는 그대로, 보상 없음.
- 다음 368: §3 빛·공기, §6 가려도 내 캐릭터 보이기.
