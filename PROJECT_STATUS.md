# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.365 접속 화면·로딩(153) + 별 조각·별 가구(154) + 화면 점검 고침 (365 화면 점검을 이 묶음에 합침; 「366」 계획 = 이 버전)

- 153 섬 그림(sha256 확인): 앱 아이콘·파비콘·badge, 계정 카드 섬 그림(돌 두 개 → 그림, 「PRIVATE BOARD GAMES」 → 「달마루섬 · 별마루섬」), manifest 아이콘 ?v=153, tools/make-app-icons.js 지움(옛 아이콘 되살림 막음).
- 로딩 화면(사용자 1A 2A): 「게임 접속」 뒤 첫 섬 진입만, 섬 그림(폰 세로)·「섬으로 가는 중…」·단계 막대·팁, public/loading-cover.js 규칙 = 섬이 돌고 + 섬 파일 1.5초 멈춤 + 연속 10장면 50 ms 안, 아니면 20초. 클릭 안 막음, 고전 로비·새로고침엔 없음.
- 관리자 로딩 팁: 기본 60(총괄 loading-tips.json, needs가 들어온 것만), 끄기, 내 팁 추가·고치기·지우기(60자), worldValue loadingTips, [loading-tips] 기록.
- 별 조각(사용자 A·「3000포인트에 3만 포인트로」): 소원 다음 날 별 조각(반짝이 10 %, 경제 star:shinyPct, 계정·별마다 고정), 상인 3,000 / 30,000, 벼룩시장 가능, 잡화점 안 팖; 이 버전 첫 시작 전 별(starsFragmentFrom)은 300P 그대로.
- 별 가구 154: 램프 5·모빌 8·러그 10+반짝이 1·마당 별 장식 6+반짝이 1(재료 두 가지 틀), REGISTRY star.*·yard.star_ornament, 집 크기·마당 막힘, 만들기만(상점에 없음).
- 화면 점검(364 총괄): 캡처 도구 폰 단계·자리 고침, 관공서 정문·건널목 정면 자리 추가; #6 광장 띠 = 모델 판석 이음(고칠 것 없음).

## v1.10.364 서버 시험·켜짐 시간·근처 빈 자리·수조 50종·📲 게임 설치·관리자 섬 이벤트(+사서 팔기 구멍)·화면 캡처 도구·글 고침 64

- 서버 시험 46개 wait-ready(30초)·자기 timeout +30초: 단위 전체 혼자 1144 통과(asset-manifest 실패도 같은 원인).
- 켜짐: 에셋 목록 크기·mtime 캐시(.cache/asset-manifest.json, npm postinstall이 데움), [boot] 단계 줄(모듈·에셋·저장소·listen, 땅 속도 지도) — Render 80초의 내역은 다음 배포 로그로.
- 막혔을 때(사용자 A): 15 m 안 가장 가까운 빈 자리(서 있을 수 있고 주민 길 격자의 빈 칸), 없으면 대청마당, 10분에 한 번, stuckRefuse 훅(N2a 호랑이).
- 수조(사용자 「수조에 대형 물고기 안들어가나지금?」): FISH_SIZE 50종(30 cm 작음·80 중간·큼), 150 cm↑ 6자리, 꽃게·가재 바닥, 수조 공간 80 %를 넘는 모델은 작게.
- 📲 게임 설치(사용자 A): 계정 화면 메신저 아래 + ☰, 설치된 앱에선 숨김, Chrome 제안이 없으면 기기별 안내 카드.
- 관리자 섬 이벤트(사용자 1B 2B 3A): 알림만·판매 배수·잡기 배수, 30분~6시간·예약, 겹침 거절, 섬 화면 띠+소리·「남은 N분」·노점 「적용 중」, [island-event]/[economy] 기록. 구멍 막기: 잡화점 재료는 「산 것」 → 원래 값, 배수는 큰 것 하나 최대 ×3, 확률 50 %까지.
- tools/screen-check/capture.cjs(사용자 A, 총괄 screencheck.mjs용): 23곳·PC/폰·높음/낮음·밤 3곳, heavy-lock.
- 글 고침: 총괄 spell-fixes 63 + voice-fixes 1(고은 해요체).

## v1.10.363 메모리(운영 OOM 11-18 13:18Z, Render 512 MiB, 사용자 「A 코드부터 줄이기」) -- 이것만 먼저, 나머지 363 계획은 364로

- 원인(로컬 소크: 봇 30명 입장·이동·읽기·나가기 + 읽지 않는 SSE 화면 5개): 안 읽는 로비 스트림에 광장 스냅샷(150 ms마다)이 끝없이 쌓임 -- 화면당 분당 5~6 MB; GC 뒤 힙 60 → 116 MB(2분), rss 370 MB. 입장 페이지(틀 137 KB + 에셋 목록 411 KB)를 replace 8번으로 매번 -- 입장 1번에 ~2.3 MB 할당.
- 고침: SSE 프레임 한 번 만들어 모두에게(광장 틱·broadcastIsland), 광장 스냅샷은 256 KB 밀린 화면 건너뜀, 2 MB 밀리면 연결 닫음(req close 정리, 화면이 다시 붙음). 입장 페이지는 lib/page-chunks.js로 켜질 때 조각(바이트 같음, 시험). 같은 소크: 38 → 42 MB, rss 최고 212 MB, 총 할당 6.4 → 3.9 GB.
- [mem] 로그(lib/mem-watch.js): 5분마다 rss·heapUsed·heapTotal·external·arrayBuffers·한도 %(MEMORY_LIMIT_MB 512)·큰 Map 8개·sseClosed·sseSkipped, 80% 넘을 때 한 줄(75% 아래에서 다시).
- 켜질 때 메모리는 그대로 작음(356~362 모두 GC 뒤 88 MB).
