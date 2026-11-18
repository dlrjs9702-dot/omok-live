# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.358 긴급: 폰에서 땅 안 보임 (사용자 갤럭시 폴드, live 1.10.357)

- 원인: 땅 셰이더의 텍스처가 17칸(우리 15 + three.js dfgLUT + 해 그림자). 356까지는 16칸으로 딱 한도였고, 357의 tRoad(찻길 지도)가 넘겨서 MAX_TEXTURE_IMAGE_UNITS 16인 폰에서 프로그램 연결이 실패함(PC는 32라 멀쩡).
- 고침: 회색 결 그림 grass·soil·sand 세 장을 ground-v1/ground.grains.png 한 장으로(R 풀 64 px 4×4 · G 흙 256 · B 모래 32 px 8×8, tools/ground-grains.py). 셰이더는 GRASS/SOIL/SAND 매크로로 채널·배율만 바꿔 같은 값을 읽음 → 15칸.
- 재발 막기: test/ground-samplers.test.js(땅 sampler + 2 ≤ 15).
- 확인: 브라우저에서 땅 프로그램의 실제 sampler 15개(PC·폰 프로필), 모습 같음.

## v1.10.357 T1 택시 길 넓히기 (notes docs/island-expansion-20261115.md §9, 171A~175A)

- 길: island-taxi ROUTE 110→125점, 물가 거리 d 53~112 뭍 쪽 2.6 m·동쪽 물가 d 187~245 2 m·툇마루섬 d 332~345 북쪽 2 m(앞뒤 10 m 부드럽게, work/t1-roads/route.cjs). ROAD { lane 2.3, walk 1.6, half 3.9 }.
- 칠하기: 땅 지도 road.png(island-paths buildRoadMap: R 가운데부터 부호 있는 거리 ±5 m, G 칠할 곳, B 건널목), island.js 땅 셰이더가 차선(아스팔트·노란 중앙선·흰 가장자리선·건널목 흰 줄)·연석·인도(돌) 칠함. 다리·대청마당 바닥·바다엔 안 칠함.
- 건널목 4→11곳(종점 앞 2, 배 타는 곳, 박물관, 달끝나루, 동쪽 물가 3, 윤슬다리 서쪽, 툇마루섬 집 길, 갈림길). 물가 거리는 난간이 5 m 안이라 없음.
- 옮김: 물가 거리 가로등·벤치(뭍 쪽 인도 밖), 길가 가로등(인도 바깥 끝, 안 되면 건너편), 전기공 가로등 3개(x 0.5±4.5)와 전기공, 툇마루섬 안내판 1 m 북쪽, 대청마당 정류장 8 m 안 꽃밭 묶음 2개 없앰. 나무·덤불·바위·꽃·풀(잡초 번호 그대로)은 길 3.9 m 밖만 남김.
- 주민 격자: 차선(2.5 m 안)은 건널목 말고 비쌈, 인도(3.9 m까지) 싸게; offTaxiRoad는 인도 가운데(3.1 m)로.
- 차는 아직 길 가운데로 달림(차선 지키기·마주 지나기는 T2).
- 시험: island-taxi 「T1 길 넓히기」, npcs 건널목 합 기준(건널목 수만큼), G4a 덤불 g4 표시.

## v1.10.356 가방 개편: 종류별 탭 + 골라 팔기 (사용자 2026-11-17, notes docs/bag-tabs-20261117.md)

- 탭: public/island-bag-data.js(193개 물건의 탭과 설명, work/bag356/make-data.cjs가 notes story/bag-items·bag-descriptions json에서 만듦), app.js drawBagTabs·applyBagTab(칸 hidden)·gc.bagTab 기억·가구 탭 drawFurnList(/api/island/furniture/mine placed:false만).
- 설명 칸 bagDetail: 그림·이름·종류·설명·쓰는 곳(파는 곳·값, 집 손보기 재료, 벼룩시장)·크기·산 것. 자전거 꺼내기·넣기.
- 골라 팔기: 창 두 칸(왼쪽 내 가방+종류 탭, 오른쪽 팔 물건 −/+/전부, 다 옮기기, 끌어 놓기), 안 받는 것은 흐리게 이유, 합계 → 한 번 더 확인. 좁은 폰은 위아래. 창 폭 640px.
- 서버: /api/island/sell pick [{entryId, qty}] 1~64개, lib/island-items sellPicked(고른 수만, 물고기는 작은 것부터, 나머지는 가방에), requestId 그대로.
- 시험: island-items 단위 「골라 팔기」, island-bag.spec 탭·개수·설명·기억·가구 탭(PC·폰), plaza.spec 관공서·노점 새 흐름.
