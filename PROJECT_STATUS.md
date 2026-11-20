# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

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

## v1.10.376 N2a-2 별마루섬 호랑이 (152e, notes island-expansion 「별마루섬 호랑이」~「잡히면 가는 곳 바꿈」)

- 서버: lib/island-tigers.js -- 1 m 땅 칸(목책 2 m 안, 막힘 0.7 m 밖, 캠핑장·전망대·문 12 m 빼고, 가장 큰 덩어리), 별마루섬 사람 따라 흐름 길찾기, 0.1 s마다. 우레 8.0 m/s(크게 돎)·볼 25 m, 안개 7.0 m/s(바짝 꺾음)·볼 18 m. Stalk(1.8 s, 뛰거나 8 m 안이면 바로 Run) → Run → Pounce(앞발 0.84 s, 맞을 곳 예측, 길 막히면 안 덮침) → 10 s 포기. 쉬는 때 KST 우레 12~14 바위 위 Nap(1.44 m 위), 안개 4~6 늪가 Doze, 갈대 옆 Crouch.
- 잡히면: questApply 'tiger'로 가방 물건 칸 무작위 2개(도구·자전거·펫·심부름·주인 물건·지갑·이벤트·상자 속 빼고) 한 개씩, 하던 채집·낚시·앉기 끝, 관공서 마루 시장님 앞(townhallWorld(0, z1+3.2)), [tiger] 로그(계정 없이), 화면 「○○에게 잡혔어요! 마루 시장님: 「큰일 날 뻔했어요!」 호랑이에게 ○○, △△을(를) 잃었어요.」
- 화면: public/plaza/tigers-view.js -- 별마루섬 근처에서만 불러옴(파일 island.later 묶음, 가장 낮은 화질은 Low), 1.6배, 서버 자세로 따라감, Pounce 앞으로 가는 뿌리 움직임 빼고 서버 도약 곡선, 안개 노멀 그림은 우레 것 공유, 경고(#tigerWarn 빨간 가장자리 + WebAudio 소리).
- 에셋 152e: tiger/tiger_angae(+_low), sign_tiger(+_low) 152e로 바꿈; budgets EXT_texture_webp 허용·파일별 예외; asset-loader creature c.low.
- 시험: test/island-tigers.test.js, tests/e2e/island-tigers.spec.js(경고·잡힘·물건 2개·시장님 앞). 테스트 서버에서는 /api/test/tigers로만 켬.
