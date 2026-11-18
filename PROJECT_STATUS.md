# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.363 메모리(운영 OOM 11-18 13:18Z, Render 512 MiB, 사용자 「A 코드부터 줄이기」) -- 이것만 먼저, 나머지 363 계획은 364로

- 원인(로컬 소크: 봇 30명 입장·이동·읽기·나가기 + 읽지 않는 SSE 화면 5개): 안 읽는 로비 스트림에 광장 스냅샷(150 ms마다)이 끝없이 쌓임 -- 화면당 분당 5~6 MB; GC 뒤 힙 60 → 116 MB(2분), rss 370 MB. 입장 페이지(틀 137 KB + 에셋 목록 411 KB)를 replace 8번으로 매번 -- 입장 1번에 ~2.3 MB 할당.
- 고침: SSE 프레임 한 번 만들어 모두에게(광장 틱·broadcastIsland), 광장 스냅샷은 256 KB 밀린 화면 건너뜀, 2 MB 밀리면 연결 닫음(req close 정리, 화면이 다시 붙음). 입장 페이지는 lib/page-chunks.js로 켜질 때 조각(바이트 같음, 시험). 같은 소크: 38 → 42 MB, rss 최고 212 MB, 총 할당 6.4 → 3.9 GB.
- [mem] 로그(lib/mem-watch.js): 5분마다 rss·heapUsed·heapTotal·external·arrayBuffers·한도 %(MEMORY_LIMIT_MB 512)·큰 Map 8개·sseClosed·sseSkipped, 80% 넘을 때 한 줄(75% 아래에서 다시).
- 켜질 때 메모리는 그대로 작음(356~362 모두 GC 뒤 88 MB).

## v1.10.362 통 50·100·200·가방 물고기 한 칸(사용자 1A~4A) + Codex 351-360 8건 + 광석 값·잡화점 재료·나뭇가지(사용자 11-18)

- 통: BOX_GROW 50·100·200(30만·80만·200만P, 경제 키 keepnet·bugbox:<칸>), 이미 산 통 30→50·60/90→100·120→200(BOX_STEP, 서버 시작에 한 번 저장·[box-step] 로그). 통 종류 표 BOX_KINDS 하나(받는 것·경제 키·이름·한 칸/겹침) -- 2차 가방 개편의 채집 바구니·재료 상자는 줄 하나로.
- 가방 물고기 한 칸: addToBag가 물고기를 칸마다(크기). 옛 묶음은 서버 시작에 splitFish(가방 칸 → 물고기 통 → 남는 것만 겹침, 다시 해도 같음, [fish-split] 로그). 가방 칸에 크기 표시.
- Codex 351-360(notes docs/codex-review-351-360.md 구현 확인): 채석장 놓침 작은 돌도 하루 60에 셈, 타격 시각은 서버 시각 −450 ms보다 이르지 않게, 골라 팔기 한 번에 하나·요청 고정, 확인 금액은 물고기 실제 값(sizePrices), 주식 알림 거래소 밖에서도·폐지 회사 알림 빼고 셈, 개울 수면 creekWaterY(물 그림·낚시 같이), 되살리기 뒤 sequence 맞춤.
- 광석 값(사용자 1A): 상인 점토 600·석탄·철·구리 900·은 1,500·수정 1,800·금 3,600(모두 삼), 작은 돌 100. 경제 키 ore:<id>, ore:shopMul 3. 잡화점 「재료 사기」: shop 표시 물건(작은 돌·잔가지·나뭇가지·잡초·퇴비·광석 8)만, 상인 값×3, 물고기·곤충·채집물 안 팖. 집 수리 철 개수 그대로(사용자 A).
- 나뭇가지(사용자 1A 2A): 한 번에 1~3(평균 2), 1시간, 자리 60. 공용 공급 526,667 → 560,167P/h.
- 시험 기다림: 관리자 접속·다빈치·할리갈리 2개 서버 시험 wait-ready(30초)·free-port.

## v1.10.361 문제 기록 묶음(notes docs/issue-log-review-20261118.md, 사용자 「넣어」·「361 전부 A」) + 에셋 151 + 가방 돌아가기

- 낚싯대(090e3a14·a7dbc058): 들고 다닐 때 ROD_CARRY 돌림(끝 오른 0.11·위 0.89·앞 0.45), 던질 때는 rot 0.
- 도박장 1·3인칭(a7f35fb1): FP_PLACES·천장 lid에 den.
- 선택지 늦음(50540f40): 고른 말 바로 표시 + 「…」, 서버 대화의 DB 읽기를 Promise.all로.
- 초승역 판(8d449da3): 크림 종이·갈색 글.
- 소장(a6797d63): 내가 철창 안이면 철창 쪽으로 돌아봄(아니면 책상 앞), 구치소 의자(4cd68300): 벤치 2개 × 2자리(IslandJail.SEATS, 서버 SEATS, clamp가 앉은 자리 허용).
- 동상(a3933cc0·0f995a22): 벽감 간격 ~10 m → 3 m, 빈 벽감마다 「○○ 자리 · 곧 새겨질 자리」 명판, 명판 0.9 → 0.42 m·2 m 앞(발이 안 가려짐).
- 툇마루섬 안내판(70b45159) 글 쪽이 찻길로. 박물관(975ab8e0) 9×7.2 m를 원 하나 대신 벽 따라 막음.
- 에셋 151: 옛 잔교(island.js) 달마루섬에서 숨김(c114b222 두 갑판 같은 평면), 빛나 Photo 동작 4개(5dffd074, sha 4/4).
- 1A 절벽 끝(2d83e547·618fce8f): 그려진 땅이 0.1 m 넘게 낮은 칸만 서는 높이를 그려진 땅으로(0.35 m에서 다). 2A 턱(4f5588e0): 걸음을 0.3 m마다 확인(설 수 없음·0.9 m 넘게 떨어짐이면 막음, 3 m 넘는 점프는 도착점만). 3A 책장(3c7be8cf): 오른쪽 벽 가운데 → 왼쪽 벽 뒤 화분 옆(4.70, 1.9). 4A 퀘스트 표시: 코드 없음, 다음 문제 기록에 주민·부탁 적어 달라고.
- 가방(사용자 11-18): 통·도감·기념사진·받은 것 창 「← 가방」, ESC·폰 뒤로가기(cancel)는 가방으로.
- 확인 못 함: ff5b6754 도박장 묻힘(발 1 cm, 안개 층 영향 없음).
