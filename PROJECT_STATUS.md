# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.91 주민 대화·호감도·심부름, 경제 값 관리, 변신 의상실(변신 따로 판매 A안)

- 지시(사용자 2026-10-18): 「주민들에게 이름과 설정, 설정에 맞는 대사, 퀘스트가 없어도 대화(기존 대화 카메라 그대로), 주민끼리 찾기·가져다주기·사다 주기」, 「호감도에 따라 대사 4단계」, 「경제 수치 열 수 있게」, 「포차코는 다른 캐릭터와 같은 가격, 기존 이용자 A안」.
- 주민(`public/plaza/island-cast.js`): 걷는 주민 10명(n 0~9) 이름·역할·설정·4단계 대사(+아침·밤), 이야기 주민 5명(n 10~14) 대사. `{me}`는 이용자 이름. 말 걸기: 서 있는 주민 2.2m 안에서 `resident:<n>`(대화 카메라·마주 보기), 서버 `POST /api/island/resident/talk`이 같은 시드로 주민 위치를 계산해 4m 안 확인.
- 심부름(`lib/island-errands.js`): 서울 하루 3개(같은 날 모두 같음, 부탁하는 주민 서로 다름) 찾기(대상에게 들은 뒤 부탁한 주민에게 알리면 2,000P)·전하기(대상에게 말하면 1,500P), `claimEvent`로 계정당 하루 1회 지급, 진행 단계는 메모리(재시작 시 다시 부탁받음). 머리 위 ★/✓, 추적창 「심부름 · …」. 「사다 주기」는 잡화점과 함께.
- 호감도(`affinityOf`/`affinityAdd`, JSON `island.affinity`, PG 새 표 `resident_affinity`): 하루 첫 대화 +1, 심부름 부탁한 주민 +3·받은 주민 +2, 이야기 단계 +2, 단계 기준 5·15·30, 상한 999. 대화창 아래 「아는 사이 ♥♥」.
- 경제 값 관리(`lib/economy.js`, `/api/admin/economy`): 생활 자원·물고기 판매가, 지뢰찾기 보상, 심부름 보상을 관리자 창 표에서 변경(범위 1~기본×10, 확인창, 변경 이력 200개·되돌리기, 서버 `worldValue('economy')`). 은행·세금·퀘스트 단계·원장은 코드에 둠.
- 변신 따로 판매 A안(`lib/skins.js` `avatar_tf_*` slot `transform`, 가격 = 세트 파츠 합): 파츠 착용만으로는 변신하지 않고 `look.transform`이 정함(`character-transformations.js` `match`). 시작 때 1회 `grantTransformations`: 세트 전부 보유 계정에 변신 무료 지급, 세트를 다 입고 있던 계정은 변신 선택(`worldValue('transformGrant')`). 상점가 입구(28, 10)의 「변신 의상실」(임시 부스, assets 42로 교체 예정) `/api/transformations`, 상점 목록에서는 제외. 기존 「잡화점」(모자·장식) 이름은 「소품 가게」.
- CI: 새 섬 e2e(resident-talk·transform-shop)는 plaza 작업에. 검증: 단위(errands·economy·transform-grant JSON/PG·skins·native-transformations·point-store) Windows 전용 6건 외 통과, e2e resident-talk·transform-shop(PC·휴대폰)·economy-admin·native-assets 통과. 실제 휴대폰·GPU 미검증.

## v1.10.90 스킨 2배·IP 환불, 낚시 도감 21종, 잡초 게시판·제초왕, UI 그림, 메신저 보완, 섬 시간대, 에셋 점검실·운영 스위치

- 지시(사용자 2026-10-17): 「기록된 구현을 하나씩 계속」; IDEAS 스킨 2배, IP 스킨 정리, 낚시 도감 확장(assets 40), 잡초 게시판, UI 그림(assets 38), 메신저 보완, 섬 시간대, `#future-admin-console` ①②③.
- 스킨 2배(`public/skin-art-*.js`, `lib/skins.js`): 14게임 일반 c6–c10·고급 p4–p6·방 테마 t3·전설 l3(t3과 짝). IP 환불: `IP_SKINS=off`면 시작 때 `refundSkins(IP_SKIN_IDS)`(산 값 1회 환불, 원장 `ip_skin_refund:<skin>:<user>`, 소유·장착 제거, PG도 같은 키로 한 번만).
- 낚시(`lib/island-fishing.js`): 13종 추가 21종, 강/바다×계절 출현표 `TABLE`, `island-terrain` `fishWater`로 개울가 자리, 도감 칭호 3은 18종 유지·`dex_title_4` 대도감 완성(31). 모델·아이콘 assets 40.
- 잡초(`lib/island-weeds.js` `targetFor`·`wilt`): 전날 뽑은 양 <140→1,680, <350→1,400, 그 외 1,120; 하루 이상 비면 0으로 본다. 게시판 `GET /api/island/weeds/board`(오늘 순위, 어제 섬 실적, 어제 수훈 2명 `weedday:` 결산), 주간 칭호 일반화(`WEEKLY_TITLES` 낚시왕·제초왕).
- UI 그림(assets 38): 게임관 카드 31, 오늘의 게임 테두리, 가방·판매 아이템 그림. 메신저: 5분 안 삭제(`unsend`), 대화방 고정(PG `messenger_pins` 새 표), 섬 새 메시지 알림.
- 섬 시간대(`plaza-scene` `LIGHTS`·`phaseAt`): 실제 시각 자동 또는 관리자 고정(`/api/admin/island/time`, SSE `islandTime`), 할로윈 장식과 밤 분리. 에셋 점검실(`public/admin/asset-inspector.js`): 등록 모델·모션·그림 미리보기, 메모 서버 저장(최대 300), 수정 요청 → Codex 주문서 초안. 운영 스위치(`/api/admin/switches`): 새 가입 신청·메신저. 관리자 세계값 저장은 한 번에 하나씩(`worldEdit`).
- 검증: 단위 skins·ip-skin-refund·island-fishing·island-items·island-weeds-server·messenger·asset-pipeline, e2e river-fishing·weed-board·island-time·asset-inspector·plaza 낚시, Codex 검토 반영(스위치·메모 동시 저장, 건너뛴 날 잡초, PG 중복 환불). 실제 휴대폰·GPU 미검증.

## v1.10.89 상점 미리보기·분류, 행동 중 이동 잠금, 잡초 뽑기 모션·310P

- 지시(사용자 2026-10-17): 「상점 창에서 각 파츠 미리보기를 다음 패치에. 내 정보에서 산 것들도 분류를 더 자세히, 상점도」; IDEAS `#future-action-move-lock`, `#future-weed-motion`(납품가 200→310P 같은 릴리스).
- 상점·내 정보(`public/app.js` `skinFilterBar`·`filterSkins`·`slotTabsOf`): 이름 검색(카드만 다시 그려 한글 입력 유지), 등급·시리즈(기본·동물 세트·추가 의상·캐릭터)·보유(상점만) 칩, 개수 표시, 내 정보 광장 아바타에 부위 탭(전체·부위별 개수), 게임 탭에도 개수. 조건에 맞는 것이 없으면 안내.
- 파츠 미리보기(`plaza-scene.js` `tryOn`·`tryOnClose`): 섬과 같은 부품·캐시로 내 캐릭터(지금 입은 것 + 그 파츠)를 별도 작은 캔버스의 두 번째 렌더러에 그려 천천히 돈다(Idle). 상점·내 정보 위쪽 고정 칸, 창을 닫으면 정리. 섬이 켜진 경우만 버튼(고전 화면은 기존 그림 미리보기).
- 이동 잠금(`plaza-scene.js` `actLock`, `asset-pipeline` `onceLeft`): 이모트·일어서기·건네기·줍기 클립이 끝날 때까지 이동 안 받음(클립 길이, 없으면 0.9초, 최대 3초), 그동안 이모트 연타 무시, 창·Esc·열차/승강장 이동 때 즉시 해제. 낚시 마무리는 원래 채집 잠금 안.
- 잡초: assets 37 `GatherWeed.glb`(1.4초, 쥐기 0.49·들기 0.62초) 교체, `WEED_MS`·서버 `PULL_MS` 1400, 잡초가 들리는 시점을 lift 이벤트에 맞춤, 납품가 310P(`lib/island-items.js`, 제초 요청 날 930P).
- 원격 낚시(IDEAS `#future-remote-action-animation`): 낚는 사람의 단계를 act `fish:cast|wait|reel|catch|miss`로 보냄(바뀌면 즉시), 서버는 그 사람의 낚싯대가 물에 있을 때만 받고 잡은 물고기는 서버 결과(`fishActOf`). 다른 화면은 낚싯대·같은 클립·잡은 물고기 들기(`remoteFish`). 찌·줄은 원격에 그리지 않음.
- 칭호 명예의 전당(IDEAS `#future-title-history`): 저장된 주간 결산(`point_settlements`의 `climb_week`·`donation_week`·`fishking_week`)에서 챔피언·호구왕·낚시왕 역대 수상자(`titleWeeks`, 그 주 이름, 계정 ID 비공개), `GET /api/island/titles`, 게시판 공지 아래 접힌 칸(칭호 탭·1대부터·현재·20개씩 더 보기·기록 시작일). 기록 이전은 만들지 않음.
- 낚시왕(IDEAS `#future-fishing-dex`): 그 주(서울 월~월) 어부 판매 지급 합계 1위(동률: 먼저 도달, 계정 ID), 다음 한 주 칭호 `title_fishking`(칭호 칸 착용·보유 중에만 표시), 판매 기록에서 집계(`fishSalesWeek`), 결산은 한 번(`settleTitleWeek`), 2026-10-12 주부터. 낚시 도감 13종 에셋은 assets 40 제작 완료(연결은 다음).
- 밭 수확(IDEAS `#future-island-minigames`): 밭 3단계일 때 밭 안에서 SPACE · 밭 · 수확 → 계정마다 주 1회 「밭 채소」(상인 3,000P), `POST /api/island/farm/harvest`, `GET /api/island/farm`의 `harvested`.
- 검증: e2e `shop-browse.spec.js`(PC·휴대폰: 보유·검색·없음 안내·3D 미리보기 모델 로드·내 정보 부위 탭), `action-lock.spec.js`(PC: 이모트 중 정지·연타 무시·끝나면 누른 방향키로 이동), `title-hall.spec.js`(PC·휴대폰), `plaza.spec.js` 낚시(구경하는 사람 화면에 단계·잡은 물고기), 단위 `island-items`·`island-weeds-server`·`climb-server`(명예의 전당)·`island-fishing`(낚시왕·집계)·`farmer-quest-server`(수확), 화면 확인. 실제 휴대폰·GPU 미검증.
