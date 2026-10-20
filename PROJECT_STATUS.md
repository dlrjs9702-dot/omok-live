# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.106 F1·G·F2: 가는 몸의 옷·소품, 걷기·뛰기 다듬기

- 근거: gamecenter-notes `docs/asset-orders-f-body-residents-20261018.md` 「F1 완료」「G 완료」, F2(assets 50) — 묶음 1과 2 사이에 끼운 에셋 연결(`docs/patch-bundles-20261020.md`).
- 에셋: assets 49(몸 5종·옷 55벌, 새 셸 방식), 50(신발 42·목걸이 42·망토 22·꼬리 40, IP 제외), 53(SlowWalk·Walk·Run G 판) — `island-models.json` 209개를 이미 압축된 파일로(`precompressed`). 기본 셔츠·바지·치마·멜빵바지도 Low 파일 사용.
- `baked`: 이 파일들은 새 몸에 맞춰 만든 것이라 `asset-loader`의 `slimmedGeometry`를 건너뜀(`island-assets.js` 끝의 규칙 — 머리 부위·IP 경로만 실행 중 줄이기). 규칙이 고른 파일 = 납품 파일 206개(모션 제외) 일치 확인. F2의 hair_ponytail·hair_twin_tail은 「tail」 이름 때문에 꼬리로 잘못 처리(가중치가 모두 Hips)된 것이라 빼고 게임 원래 파일 그대로 — 시험 「머리카락: Head 가중치가 대부분이고 baked가 아니다」.
- G: Walk·Run이 게임 속도 4.2·6.2로 만들어져 `rates` walk·run 1.0(slow 1.72 그대로).
- `budgets.json`: 옛 운동복·후드 몸·옷의 비양자화 예외 8개 삭제.
- 검증: 단위 전체(Windows 줄바꿈 6개 제외), motion36·island-assets·dress-room e2e 30개. Codex 검토 대기(사용량 한도 10/25).

## v1.10.105 패치 묶음 1: 달마루섬 마무리·섬 길 정리, 대청마당 바닥(assets 59), 버그 11·12, 문제 기록 허용

- 근거: gamecenter-notes `docs/patch-bundles-20261020.md` 묶음 1(하나의 PR·배포), `docs/bugs-20261020.md` 11·12, 문제 기록 허용(b04796d), assets 59(88eb828).
- 섬 길: 모든 장소(문·역·계단 양 끝·집·다리·알림마루·박물관·등대·부두·배 타는 곳·농부)가 대청마당에서 길로 이어짐(`test/dalmaru-paths.test.js`: 길 한 덩어리·장소 3.5 m 안·막다른 길 없음), 능선 위 길, 계단 옆면 한 면(`ShapeGeometry`), 절벽 면 돌 없앰(`slopeAt < 1`), 미니맵 글자 겹침(실제 너비).
- 주민 동산 순환: 이동 격자에 능선 계단 디딤판·발치·꼭대기 연결, 난간 원 여유 0.15 — 능선 3·서쪽 3·마을 7. 멀리 심부름: 상대는 부탁한 주민에게서 가장 먼 셋 중 하나, 거리 단계(60·120 m)마다 경제 `errand:far`(500), 부탁·재촉 때 말로 위치 힌트(지도·나침반 표시 없음). 섬 소문 위치는 멈춤 자리가 가장 많은 곳.
- 대청마당 바닥(assets 59 `plaza-v1`): 박석 그림 6 m 반복(`island.js`), 원판·고리·테두리돌(묶음 하나)·모서리, 물길 8칸 + 끝 수반(막음, `tank_water` depthWrite 끔), 정원 섬 6(계절 4판, 테두리 충돌, 앉을 자리 28) — 서쪽 긴 정원·둥근 정원 하나는 책수레·스폰·알림마루를 비켜 옮김. 옛 나무 화분 12개 뺌. mapCheck의 「그려진 것」 높이 0.3 → 0.15 m(물길 둑 0.17). 행사 배치는 구조물 원도 비킴.
- 버그 11·12: 옷가게 목록은 그림 없이 한 줄(3D 미리보기 옆), 내 정보는 착용·해제만, 검색 줄 고정, 생일 칸 「월」·「일」. 창이 화면 대부분을 덮으면 섬은 0.5초마다 그림(`covered`), 휴대폰 미리보기는 DPR 1·안티앨리어싱 끔·바뀔 때만.
- 문제 기록 허용: 관리자 계정 목록의 「문제 기록 허용」(world `issueWriters`), 허용 계정은 `/api/issues`로 쓰기(하루 30)·자기 기록만 보기, 관리자 목록에 쓴 사람과 거르기.
- 옛 섬(`ISLAND_MAP=classic`) 코드·시험은 이사 결과(운영 로그) 확인 전까지 되돌릴 길로 남김 — 다음 묶음에서 정리.
- 검증: 단위 전체(Windows 줄바꿈 6개 제외), dalmaru-walk mapCheck(보이지 않는 벽·뜬 것·묻힌 것·못 가는 곳 0), island-admin-look·dress-room e2e, 대청마당 그리기 호출 400(main 410)·삼각형 +6%. Codex 검토 대기(사용량 한도 10/25).

## v1.10.104 달마루섬 개편 5단계: 모두 새 섬으로 이사

- 근거: gamecenter-notes `docs/dalmaru-implementation-20261019.md` 5단계, 확정 순서 3. 서버 기본 섬이 달마루섬(`island-terrain.js`가 `dalmaru-island.js`로 만듦; `ISLAND_MAP=classic`이면 지금 섬 — 옛 섬 코드는 다음 배포에서 정리). 페이지는 섬 스크립트보다 먼저 `/plaza/island-live.js`로 섬을 알게 됨.
- 이사(`dalmaruMoveIn`, 서버 시작 때 한 번 — world `dalmaruMoved`): 심은 꽃은 씨앗·나무는 묘목으로 주인 가방에(포인트 없음, 쪽지 「달마루섬 이사 돌려받기」), 땅 비움; 잡초 한 번 새로(`dalmaruWeeds`). PostgreSQL은 추가만.
- 서버가 새 섬 기준: 주민 순환(걷는 땅·절벽 정면·구조물 원), 퀘스트·사진 자리(`PLACES.quests`), 생활 자원·해안 자리·열매 나무, 잡초 1,400, 위치 경계 200, 할로윈·겨울 장식(대청마당 가운데·새 섬 들).
- 관공서: 창구 4개(민원·세금·예금·**개명 신청** — 작명소 업무, 6.8 m 간격), 절벽 정면 앞에 담장 마당·시장 정문(지금 섬 마당 그대로, 틀은 정면 앞면이 옛 관공서 앞면 자리). 백화점 9구역 **노점**(상인 매입). 새 섬에서는 밖의 작명소·상인 없음.
- 낚시 물가 5종(`fishWater`: sea·bay·lake·river·pool, 출현표는 바다/강 표에서 — 윤슬만은 먼바다 물고기 빼고, 호수는 개울 물고기 빼고, 폭포 웅덩이는 흔한 것 빼고), 폭포 2곳(떨어지는 물면·거품·물보라). 강 낚시 찌가 새 섬 강·호수·웅덩이 위로.
- 섬 꾸밈: 길 가로등 61개(밤길·할로윈 깃발줄), 강둑 자갈·꽃·계절 장식과 굽이 돌, 산책로 갈림 화분. 고침: 주민 첫 자리 겹침(첫 장면 순간이동), 능선 계단 양 끝의 보이지 않는 난간 충돌.
- 시험: 단위·e2e를 두 섬 모두에서(지금 섬 모양 전용 시험은 달마루섬에서 건너뜀), 새 섬 열차·계절·이사·창구·노점·물가 시험 추가.
- 검증: 단위 전체(두 섬 — Windows 줄바꿈 6개 제외), e2e 섬 시험(달마루섬). Codex 검토 대기(사용량 한도 10/25).
