# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.379 채석장(사용자 「제한 없애고 바위마다 고르게」·결정 8 A)·곡괭이·158 Pounce·가려도 보이기 별마루섬만

- 곡괭이: 잡화점 줄 kind 표에 곡괭이(e.tool 'pickaxe', qty 합)로 3개까지, TOOL_MAX 안내 「곡괭이는 3개까지」(결정 6 A).
- 채석장: 하루 60번 한도 없음(셈은 남김), 바위는 비지 않음(늘 가득, 캐기마다 자기 claim, quarryKept 안 씀). 화강암 벽 그대로. 곡괭이 닳기 40번 그대로.
- 광석 표(lib/island-ores): 모든 바위 한 조각 기대값 같게 -- 제 광석 몫 흔함 34 %·보통 30 %·드묾 12 %·아주 드묾 7 %, 나머지 12종은 price^beta(목표값에 맞춰 풂), 각 광석은 제 바위에서 가장 많이(흔함·보통 바위는 그 바위에서도 가장 많이), 모든 바위에 네 등급. 보너스·「채석 위 단계」 비율 옛 그대로. 보석 모든 바위 같게: 달빛석 5‰(보너스 15‰), 루비·사파이어·에메랄드 5‱(14‱, 경제 키 단위 ‱).
- 값(결정 8 A): 상인 값 ×0.46 -- 화강암 20·점토·사암 370·석탄·철·구리·주석 550·은 1,380·수정·옥 1,610·금·흑요석 3,680, 달빛석 23,000·루비 등 46,000. 맞힌 한 조각 725P, 못 맞힘(20 %) 작은 돌 100P -> 캐기 한 번 600P, 약 7.5초 -> 시간당 약 480번·288,000P. 잡화점은 상인 값 ×3 그대로.
- 호랑이(에셋 158): 새 Pounce(달리며 뛰어오름), 서버는 Run 0.40~0.55초 위상에서만 덮치기 시작, 화면은 Run을 서버 시작 시각·speed/run으로 재생, Pounce fadeIn 0.1초. 우레 12 m/s가 선 사람 둘레를 돌던 것: 4.5 m 안이면 어느 방향이든 덮치기, 잡기는 몸 중심에서 0.84초 앞발 자리까지의 선분 거리, yaw 감김 고침. 선 사람 18 m에서 약 4초에 잡힘(시뮬).
- 가려도 보이기(사용자 「별마루에서만… 달마루섬은 건물에만」): plaza-scene seeStep의 나무 구멍·가까운 흐림은 IslandTerrain.onIsle2일 때만, 달마루섬 건물은 occlusion.js 그대로. e2e island-view-modes(달마루섬 구멍 없음) + 사진 PC·폰(달마루 숲·광장 나무·별마루 숲·건물 옆).

## v1.10.378 N2b 별마루섬 곤충 131·물고기 132·버섯 136 (notes island-expansion 46A·47A·E14)

- 곤충: lib/island-insects SPECIES moth_longtail(희귀, 밤·여름, 나무·풀)·stag_giant(희귀, 밤·여름~가을, 나무), `isle2: true` -- spotsOf가 별마루섬 자리에 isle2 표시, layout은 그 자리에서만. INSECT_LONG 0.268·0.24, together.insect_ 정지 모델, 도감 아이콘 SVG.
- 물고기: lib/island-fishing SPECIES lenok(희귀 4,200)·kumgang_minnow(흔함 350)·striped_beakperch(희귀 4,500), SIZES, ISLE2 표(개울=river 사계절 둘, 갯바위=동쪽 절벽 (497,214) 45 m 안 바다 봄~가을 돌돔), isle2Water, 서버 낚시 cast에 isle2. 손 at 132 manifest. 집 수조 크기·민물.
- 버섯: lib/island-gather KINDS mushroom_glow(공유 2)·mushroom_parasol(5)·mushroom_lionsmane(3), group isle2_mushroom 12자리(별마루섬 쓰러진 나무·큰 나무·나무 둘레, 앞 자리들 그대로), 재생 12시간(섬 공용 공급 565,000P/h 안). 가방 물건 발광 버섯 8,000·우산버섯 3,000·노루궁뎅이 5,000. 발광 버섯 nightGlow.
- 박물관: 곤충관 양쪽 벽 상자 2(26), 바다 수조 22번째 돌돔, 새 물 「별마루섬 개울」 벽 수조(앞벽 동쪽 x 8·10, 여분 12).
- 도감 글(79종), 가방 탭·설명.
- 행사 창(사용자 「잘 안읽혀」): .festivalCard 크림 바탕·진한 글씨(보드 투명 카드 위로), 할 일 줄 이름·도장 배지·오늘 n/m 배지·방법 줄, 재료 고르기 크림 칸, 못 바꾸는 단추도 읽히게. 대비 8.4:1 이상(PC·폰 사진 확인).

## v1.10.377 N2a 남은 것 (총괄: 동굴 물 재질, 글자 안내판, 다리 문 열림)

- 동굴 물: asset-loader `swap` 항목 + setSwapMaterials -- island.js가 157 파일 재질 water/water_fall/water_foam을 개울 물(water clone, vertexColors)·폭포(fallMat)·거품(foam)으로 바꿔 줌. spring.cave에 `swap: true`.
- 안내판: 136 sign_reserve·sign_trail(+_low) 다시 넣음(sha256 확인). 자리는 tools/isle2-props.cjs(SIGN_RESERVE 문 안쪽 길 옆, SIGN_TRAIL 캠핑장 가장자리 길 옆, 화살 셋을 캠핑장·전망대·별마루다리에 가장 가깝게 돌림), 막힘 원 추가(땅 지도 그대로). 글자는 plaza-scene boardText로 FACE 자리 1.5 mm 앞(「별마루섬 자연 구역」, 화살마다 갈 곳).
- 다리 문: fence_gate를 묶음에서 빼고 plaza-scene에서 따로 붙임(keepNodes), 사람(나·다른 사람)이 2.6 m 안이면 leaf가 +Y로 1.45 rad 열림.
- 호랑이 조정(사용자 직접): 달리기 우레 12(「우레 속도 1 업」)·안개 11 m/s, 포기 25초, 크기 1.6→2.4배(걷기·달리기·Stalk 재생 속도, 앞발 거리 2.1/1.73, 잡힘 반지름 2.4/2.1, 몸 여유 0.9 m), 덮치기는 멈추지 않고 달리던 대로 앞으로 곧게(0.84 s에 앞발, 도약 = 예상 자리까지, 최대 달리기 0.84 s + 클립 도약), 잡히면 5초 #tigerTransfer 「이송 중」(빨간 깜빡임) 뒤 시장님 말. 15 m/s 넘는 순간 이동은 속도 0. 시뮬레이션(25초 안 잡힘): 뛰기 6.2는 둘 다 15/20/25 m 거의 다 잡힘(2.7~14 s), 자전거 9는 우레 1/15·안개 9/15, Shift 12는 0.
- 시험: island-tigers.spec에 문 열림·안내판 글자 확인 추가.
