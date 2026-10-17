# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

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

## v1.10.88 메신저 카카오톡처럼

- 지시(사용자 2026-10-17): IDEAS `#future-messenger-kakao` 구현, 보관은 A안(서버에 전부 보관·기기 저장 없음, v1.10.87과 같음).
- 저장(`lib/messenger-store.js`, JSON·PostgreSQL 같은 동작): 계정별 마지막 읽은 번호(`setRead`, 앞으로만·방 회원만), 1:1 방(`dmRoom`, 두 사람당 한 방 — PostgreSQL은 쌍 잠금; 나간 사람이 다시 열리면 재입장 `joined`), 시스템 문구(`post(..., system)`; PostgreSQL은 기존 표를 바꾸지 않고 보낸 사람 앞에 `!`), 방의 마지막 메시지(`last`), 이름 바꾸기·알림 끄기. 새 표 `messenger_reads`·`messenger_mutes`·`messenger_dm`(기존 표 변경 없음).
- 서버(`/api/messenger*`): 방 보기에 `kind`·`unread`·`muted`·`reads`·`last`·회원 `active`(허용 해제·권한 취소는 안 읽은 사람 셈에서 뺌). 대화를 받으면 그 번호까지 읽음, 내가 보낸 줄은 읽음. `POST /api/messenger/dm`(1:1, 이름 = 상대), 초대·만들기·나가기·이름 변경 때 시스템 문구, `POST …/name`(단체만)·`…/mute`, 1:1 방 초대 막음, 이미 있는 사람 초대 막음.
- 화면(`public/app.js` messenger): 목록에 마지막 메시지·시간·안 읽은 수·🔕, 「1:1 대화」, 방 머리 「이름」·「알림 끄기」, 메시지 옆 안 읽은 사람 수(마우스 올리면 이름, 휴대폰은 눌러서), 날짜 구분선, 같은 사람 연속 메시지는 이름 한 번, 가운데 시스템 문구, 나가기 확인창 「나가면 대화 내용이 모두 사라지고 다시 초대받아야 들어올 수 있습니다」. 메신저 버튼 알림은 서버의 안 읽은 수(알림 끈 방 제외) — 기기별 `gc.messengerSeen`은 더 쓰지 않음.
- 남긴 것: 실시간(SSE) 대신 지금의 3초·10초 폴링 유지, 섬·게임 안 새 메시지 알림, 메시지 삭제(제안), 대화 목록 고정(선택). 업데이트 직후 기존 방은 서버 읽음 기록이 없어 한 번 전부 안 읽음으로 보임.
- 검증: `test/messenger.test.js`(JSON·PostgreSQL 읽음·1:1 동시 열기 한 방·재입장·시스템 문구·이름·알림, API 읽음·1:1·나가기 뒤 기록 유지·재입장 문구·허용 해제 active), e2e `messenger.spec.js` PC·휴대폰(시스템 문구, 「1」이 상대가 읽으면 사라짐, 서버 안 읽은 수 2, 목록 미리보기, 1:1 방 이름·초대 숨김, 나가기 경고 문구), 화면 확인. 실제 휴대폰 미검증.
