# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.367 N1b 별마루섬 숲 다듬기(156) + 주식 부도 1A

- 세 층: 큰 나무 150(전나무·소나무·참나무, 156 High 40 m 안·Low 밖, 그림자는 High만), 숲 바닥 고사리 420(25 m 밖 사라짐)·이끼 바위 60·쓰러진 통나무 24. 각자 seed, 앞의 배치는 그대로. 숲길 가장자리 5 m 트임·12 m 안은 35 %만, 캠핑장·봉우리·개울 둘레 빈터.
- 별지기 느티(156 §8, 40 m): (261, 197) 다리 머리 북동쪽(선착장 30 m, 캠핑장 가장자리 34 m), 숲길에서 20 m. 채집 자리(버섯·나뭇가지) 한 번 새로 섞임. 18 m 안의 나무·덤불·바위 뺌, 막힘 = 156 solids.json(줄기 r 3.55 + 뿌리 원 184, 아치 아래는 지나감), 대역 = 줄기·잎·뿌리 상자. 표지판(빈터 가장자리), 지도·미니맵 이름(AREAS ancient), 로딩 팁.
- 멀리 모양: 숲 덩어리(156 clump 3종) + 느티 빌보드, 그림자 없음.
- 주식(사용자 1A·2A): 2026-11-23 09시(BUST_FROM)부터 부도 날마다 그날 종가 < 상장가인 회사 중 키 랜덤 1곳(주 1~3번 그대로, 없으면 없음). 그 전 값·부도는 그대로(시험: 바이트 같음). 해송 제과 부도는 그대로, 보상 없음.
- 다음 368: §3 빛·공기, §6 가려도 내 캐릭터 보이기.

## v1.10.366 광석 개편 2(155) + 「재료 부탁」

- 광석 12종(사암·주석·옥·흑요석 새로), 값 「낚시랑 맞춰」(점토·사암 800, 보통 1,200, 은 3,000, 수정·옥 3,500, 금·흑요석 8,000), 위 단계 20 %(보너스 35 %), 바위 40개(새 8개), 바위마다 8번, 하루 60 그대로. 155 에셋 40개 sha256 확인(ore-v2).
- 보석 4종: 달빛석 50,000(모든 바위 0.5 %, 보너스 1.5 %), 루비·사파이어·에메랄드 각 100,000(드묾 이상 바위 0.7 %, 보너스 2 %), 경제 gem:<id>(‰)·item:gem_<id>, 섬 이벤트 「채석 위 단계」 배수도 받음(최대 50 %). 상인만 삼, 잡화점 안 팖.
- 보석 첫 발견(사용자 2A): 계정·종류마다 첫 번만 카드(gem-cards.json) + 섬 전체 알림(게임 안 이름만).
- 평균(상인 값, 보석 포함): 바위 고르게 1,885P, 다시 차는 시간 비율로 1,569P, 못 맞힘 20 %면 약 1,275P.
- 「재료 부탁」(총괄): 심부름 하루 3개 + 재료 부탁 1개(따로 seed), 광석·드문 광석·보석·별 조각 N개, 주민 28명 각자 말(errands-material.json), 보상 = 상인 값 × 개수 + errand:material 2,000.

## v1.10.365 접속 화면·로딩(153) + 별 조각·별 가구(154) + 화면 점검 고침 (365 화면 점검을 이 묶음에 합침; 「366」 계획 = 이 버전)

- 153 섬 그림(sha256 확인): 앱 아이콘·파비콘·badge, 계정 카드 섬 그림(돌 두 개 → 그림, 「PRIVATE BOARD GAMES」 → 「달마루섬 · 별마루섬」), manifest 아이콘 ?v=153, tools/make-app-icons.js 지움(옛 아이콘 되살림 막음).
- 로딩 화면(사용자 1A 2A): 「게임 접속」 뒤 첫 섬 진입만, 섬 그림(폰 세로)·「섬으로 가는 중…」·단계 막대·팁, public/loading-cover.js 규칙 = 섬이 돌고 + 섬 파일 1.5초 멈춤 + 연속 10장면 50 ms 안, 아니면 20초. 클릭 안 막음, 고전 로비·새로고침엔 없음.
- 관리자 로딩 팁: 기본 60(총괄 loading-tips.json, needs가 들어온 것만), 끄기, 내 팁 추가·고치기·지우기(60자), worldValue loadingTips, [loading-tips] 기록.
- 별 조각(사용자 A·「3000포인트에 3만 포인트로」): 소원 다음 날 별 조각(반짝이 10 %, 경제 star:shinyPct, 계정·별마다 고정), 상인 3,000 / 30,000, 벼룩시장 가능, 잡화점 안 팖; 이 버전 첫 시작 전 별(starsFragmentFrom)은 300P 그대로.
- 별 가구 154: 램프 5·모빌 8·러그 10+반짝이 1·마당 별 장식 6+반짝이 1(재료 두 가지 틀), REGISTRY star.*·yard.star_ornament, 집 크기·마당 막힘, 만들기만(상점에 없음).
- 화면 점검(364 총괄): 캡처 도구 폰 단계·자리 고침, 관공서 정문·건널목 정면 자리 추가; #6 광장 띠 = 모델 판석 이음(고칠 것 없음).
