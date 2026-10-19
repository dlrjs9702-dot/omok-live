# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.102 건물 안 날씨 끔(bugs 9)

- 근거: gamecenter-notes `docs/bugs-20261019.md` 9(사용자 「실내에서 눈이나 비가 와」), 구현 순서 3-2(지도 무관, 바로).
- `plaza-scene.js`: 실내 판단 하나(`indoors`, 공간이 바뀌는 `setSpace` 한 곳에서 — 민원실·백화점, 나중의 달마루섬 절벽 정면 안·내 집도 같은 곳으로) → 비·눈 입자(`stepWeather`), 계절 낙엽·눈송이(`assets.tick`의 ambient 멈춤), 무지개 띠, 비 오는 하늘·안개 어둡게(`lightKey`에 `wet`)가 모두 따름. 섬으로 나오면 다시 켬. 빗소리는 따로 없음(확인).
- 시험: island-weather에 「비 날씨로 백화점에 들어가면 indoors·비·눈·무지개·낙엽 0」(고치기 전 코드에서 실패 확인). `PlazaDebug().weather()`에 `indoors`·`flakes`.
- 검증: island-weather·island-time e2e, 단위 전체(Windows 줄바꿈 6개 제외). Codex 검토 대기(사용량 한도 10/25).

## v1.10.101 꾸미기 창 새 단장(3-1): 참고 그림 모양·큰 미리보기·착용 전후, 스킨 선물

- 근거: gamecenter-notes 확정 순서(사용자 2026-10-19) 5 — 3-1 상점·내 정보 입어 보기 통일을 달마루 단계 사이에. 모양은 사용자 참고 그림(`docs/img/shop-ui-reference-20261019.webp`, 사용자 선택 「1」), 그림 에셋 assets 56(`public/assets/shop/ui/`).
- 꾸미기 창(`app.js` `dressView`·`dressParts`·`dressStart`): 상점 7곳(스킨·옷·소품·미용실·성형외과·염색사·변신 의상실)과 내 정보가 한 틀 — 나무 간판 제목, 왼쪽 목록(카드에 마우스를 올리면 미리보기, 누르면 선택·초록 테두리), 오른쪽 큰 미리보기(정원 배경, ⟲·＋·－, 정면·옆·뒤·걷기 ‹ › 점), 「착용 전 → 착용 후」 비교(`tryOnShot`: 따로 그리는 렌더러로 한 장씩), 상세, 아래 버튼 줄(포인트·구매·착용·선물하기·닫기 — 구매·착용은 카드 버튼을 그대로 누름). 휴대폰(700px 이하)은 한 줄, 버튼 줄은 아래에 붙음. 얼굴·염색·변신 카드도 같은 미리보기(`lookTried`·`tfDress`).
- 스킨 선물(사용자 2026-10-19 「선물 허용으로」「우체국으로 쪽지 오는걸로」, 결정 「1」): 상점 「선물하기」 → 받는 사람(우체통 목록)·쪽지 → 확인 → `POST /api/skins/gift`(IP 스킨 거절 → 받는 사람 확인(나 자신 안 됨) → 하루 횟수·요청 번호를 퀘스트 문서 `skinGifts`에 먼저 잡음(같은 요청은 한 번만, 경제 값 `gift:skinPerDay` 기본 5) → 이미 가졌으면 되돌림 → `pointStore.giftSkin`(주는 사람 원장 `skin_gift` 「선물 ○○ → △△」, 받는 사람 소유, JSON·PG 둘 다) → 받는 사람 우체통 쪽지(🎁 선물받은 스킨) → 알림). 받는 사람을 고르면 `/api/skins/gift/check`로 「이미 가지고 있어요」. 규칙은 `lib/skins.js` 머리말.
- 고침(gamecenter-notes bugs-20261019 10, 「상점 창이 한번 열면 다른 거 할 때도 계속 떠」): 섬 창(`openPlazaWindow`)은 열 때도 닫을 때도 같은 정리(`sendPlazaHome`) — 빌려 온 카드는 원래 자리로, 창 전용 카드(변신 의상실)는 치움. 바로 이어 연 창(성형외과)에 앞 창 목록이 남던 문제. 성형외과·염색사 카드가 기다리는 자리(body)는 보이지 않게, 건물에 들어가고 나올 때 섬 창(`closeIslandWindows`)을 닫음. 시험은 dress-room(변신 의상실 → 성형외과, 닫은 뒤 화면에 남는 것 없음)·백화점 들어가기 도우미는 문 앞 이동·들어가기를 될 때까지 다시.
- 남은 3-1 일: 품목 그림을 3D로 한 번 그려 저장(지금은 2D 미리보기), 게임 스킨 상점 오른쪽 2D 그림.
- 검증: 단위(skin-gift·point-store 선물 — 두 저장소), e2e dress-room(PC·휴대폰, 선물 끝까지)·transform-shop·shop-browse·plaza 가족 탭, theme-light. Codex 검토 대기(사용량 한도 10/25).

## v1.10.100 작은 버그 한 묶음(A-7), 달마루섬 개편 1단계(관리자 미리보기)

- 근거: gamecenter-notes 확정 순서(사용자 2026-10-19) 2·3 — `docs/bugs-20261019.md`의 위치와 무관한 것 + 보이지 않는 벽 2곳(대회 동상 자리·깨진 길·역 길은 개편이 흡수), `docs/dalmaru-implementation-20261019.md` 1단계.
- 보이는 것만 막기: 책 수레(도서관 할아버지 부탁 중일 때만), 대회 우승자 받침대(우승자가 있을 때만, 기부 동상과 같은 받침대를 그림, 자리는 그대로 −11,0), 겨울 축제 소품(눈사람·썰매·사탕 지팡이·눈 더미·선물 상자 — 축제 때만), 할로윈 장식은 「밤」이 아니라 장식이 켜졌을 때(v1.10.90에서 둘이 나뉨). plaza-scene `solids`에 `off` 조건, `blocksNow`. 시험 island-solids.
- 시장 떨림: 1.6m/s 걸음이 animator에서 `slow`인데 마당 코드가 idle·walk 말고는 「동작 중」으로 쳐서 멈춤 → idle → 다시 걸음이 매 프레임 반복(실제 모델에서 15초에 29번 → 3번). 걸음 상태는 모두 「바쁘지 않음」, 방향은 이동 전에 잡음(도착 프레임의 0 벡터). 시험 mayor-gait(실제 모델 — 섬 시험의 대역 캐릭터에는 걸음 상태가 없음).
- 민원실 일어서기: `standUp`이 섬 땅 높이(`heightAt`) 대신 방 바닥·방 안(`roomClamp`, 잡화점도 `STORE.clamp`).
- 창구 의자(`IslandTerrain.COUNTERS`, 좌석 `c-civil|c-tax|c-bank`): 민원·세금·예금 책상 앞 손님 의자, 「SPACE · 앉아서 ○○ 창구 업무」 → 앉기 → 직원에게 대화 카메라(`counterCamera`) → 창구 창. 창을 닫으면 일어나 홀 쪽으로 한 걸음, 누가 앉아 있으면 「다른 분이 업무 중이에요」. 서 있는 창구 자리는 없앰(서버의 창구 1.8m 검사는 그대로 — 의자가 그 안). 창구 의자에서는 창이 열려도 앉은 채(다른 좌석은 전처럼 창이 열리면 일어남).
- 달마루섬 미리보기 1단계: `public/plaza/dalmaru-terrain.js`(assets 54) + `dalmaru-island.js` — 같은 IslandTerrain 이름으로 새 섬의 땅(바닥 380m·2.5m 격자, 바다·윤슬만·거울호수·강·폭포 웅덩이는 해수면 아래로 파서 바다 물이 보임, 걷기, 윤슬다리 2·강 위 임시 다리 3, 계절 4구역, 씨앗 자연, 지도·미니맵은 땅 그림). 관리자 운영 스위치 「달마루섬 미리보기」 → `/api/island/map`이 관리자에게만 dalmaru → `island-map.js`가 섬 스크립트보다 먼저 고름(바뀌면 한 번 새로고침). 미리보기 화면은 위치를 서버로 보내지 않고 혼자 걸음, 옛 섬의 건물·소품·열차·주민·이벤트·잡초는 숨김(옛 좌표는 지도 밖으로). 서버와 다른 사람은 지금 섬 그대로. 시험 dalmaru-preview.
- 두 세계 영웅전 빌드(사용자 2026-10-19 빌드 수정 허락): 원본 pck에 `tools/herosurv/gc_patch.gd`(autoload) 하나를 덧붙인 게임센터용 pck(`tools/herosurv/repack.js` — 원본 파일은 그대로, pack format 4 디렉터리만 새로) → R2 `herosurv/5a2d176d….pck`, `boot.js` `BIG`·`fileSizes`. 숨김: 「이름 변경」·「변경하기」·「랭킹 참가」·「랭킹에 올리기」·「참가하기」·「이름 정하고 랭킹 등록」 버튼, 메일 입력·안내, 「랭킹 참가 ○○」, 랭킹판이 직접 그리는 「[랭킹 참가]를 누르면…」(RankBoard의 그 문자열을 비움). 원본·수정본 화면 비교로 확인. 원래부터 있던 콘솔 오류(배경음 브리지 `__manusBgm`이 CSP eval에 막힘)는 따로.
- 남은 1단계 일: 실제 휴대폰 FPS(먼 바닥 LOD는 필요하면), 낚시 물가 5종·폭포 표현, 윤슬다리 모델(55)은 2단계 시설과 함께.
- CI: 관광열차 두 번째 타기·내리기는 문 열림을 놓치면 다시 열고 누름, 챔피언 이름표·카메라 페이드는 CI에서 더 기다림, 가방 시험은 관공서에서 나온 직후 상인으로 순간이동이 되돌려지면 다시.
- 검증: 단위(전체 — Windows 줄바꿈 때문에 로컬에서만 실패하는 6개 제외), e2e island-solids·mayor-gait·dalmaru-preview·plaza 가방/관공서(8회 반복)·island-contest·관공서 시장. 실제 휴대폰 미검증.
