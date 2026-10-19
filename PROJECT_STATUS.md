# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

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

## v1.10.99 A-6 주민 대화: 걷는 주민에게 말 걸기·대화 중 멈춤·선택지·섬 소문·주민끼리 수다, 대화창·확인창 정리

- 근거: gamecenter-notes `docs/residents-talk-hills-20261018.md` 1·2·6(사용자 2026-10-18·19). 3(동산 주민 순환)·4(먼 심부름 자리)는 지도에 묶인 일이라 달마루섬 새 지도 위에서(확정 순서 2026-10-19), 5(주민 고유 외형)는 에셋 F3 도착 뒤, 6의 창 점검표(밝은/어두운·PC/휴대폰 캡처)는 문제 기록으로 들어오는 것부터.
- 말 걸기: 걷는 주민도 2.2m 안이면 「말 걸기 · 이름」(서버는 4m). 말을 걸면 서버가 그 주민을 `talk:<plazaId>`로 붙잡아(`lib/island-residents.js` `talk`·`keep`, 이벤트 붙잡기와 같은 길) 모든 화면에서 그 자리에 멈춰 나를 봄. 창이 열린 동안 브라우저가 4초마다 `/api/island/resident/keep`, 창을 닫으면 `/bye`, 6m 넘게 멀어지거나 갱신이 12초 끊기면(접속 끊김) 풀림, 최대 3분. 풀리면 밀린 시간만큼 `delay` — 멈춘 자리에서 이어 걸음. 붙잡기·풀기는 SSE `residents`로 바로 모두에게.
- 다른 사람과 이야기 중: 「지금은 ○○님과 이야기 중이에요」. 이벤트가 붙잡은 주민은 그대로 이벤트가 먼저.
- 선택지(`/api/island/resident/talk` topic): 첫 인사(심부름이 있으면 심부름 대사가 먼저) 뒤 1 요즘 어때요?(호감도 단계 대사) 2 섬 소문(`IslandCast.rumor`: 날씨·별똥별 6시간 안·주말 대회·꽃·나무 수·겨울 축제·할로윈·다른 주민이 자주 가는 곳 `IslandNpcs.hangout`, 심부름 중이면 찾는 주민 힌트 먼저) 3 부탁할 거 있어요?(심부름 흐름, 없으면 「오늘은 괜찮아요」) 4 잘 가요. 숫자 1~4·↑↓·Space/Enter·Esc·터치. 호감도 +1은 하루 첫 대화만.
- 상황 대사(`IslandCast.MOODS`): 주민 10명마다 비·무지개·별똥별 밤·대회 날·겨울 축제 한 줄씩, 첫 인사에 40% 확률.
- 주민끼리 수다(plaza-scene `chatter`, `IslandCast.chatLine`): 같은 멈춤 장소(3.2m)에 선 두 주민이 마주 보고 서버 시계 3초 칸마다 말풍선(여는 말·대답·인사, 한 칸 쉬고 상대가 엶) — 모든 화면 같음. 나와 대화 중인 주민은 빠짐.
- 대화창: 말풍선 위 갈색 제목줄을 없애고 이름표·닫기를 말풍선 색으로, 선택지는 번호 붙은 목록(밝은 테마 같이). 같은 talkMode를 쓰는 부탁·퀘스트 대화도 제목줄이 같이 바뀜. 확인창(접속 종료·포인트 지급·대국 일시 중단 등 `.logoutDialog`)도 다른 창과 같은 카드(둥글기 22px·창 바탕·선, 제목은 창 종류 색의 머리줄 — 일시 중단은 주황), 이벤트 창은 금색 테두리를 지키고 카드만. 상점류·게시판류는 이미 같은 카드(v1.10.83)라 그대로.
- 1.10.98 공지의 박물관 방향을 남동쪽으로 고침(지도 북쪽 = -z). CI 주석·docs/release.md의 「v1.10.99 CI 단축」을 실제 배포판 v1.10.98로.
- 시험: 단위 island-errands(수다 차례·소문·상황 대사). resident-talk.spec(두 화면 멈춤·13초 넘게 유지·「이야기 중」·선택지·닫으면 풀림·심부름 사례, PC·휴대폰), 단위 island-residents(붙잡기·갱신·풀림·3분). CI에서만 흔들리던 plaza 관광열차(두 번째 타기 — 4.6초 문 열림을 놓치면 다시 열고 누름)·사진가 기념품(CI 120초).
- 검증: 위 시험 로컬 통과. 실제 휴대폰 미검증.

## v1.10.98 함께하는 섬(B 47): 생일·우체통·안내 주민·곤충 채집·박물관·반려동물, 낚싯대 판매, 관리자 「문제 기록」, 두 세계 영웅전 정리

- 생일(`lib/island-together.js`, 계정 문서 birthday): 내 정보에서 월·일·숨김, 관리자는 계정 이름으로. 당일 광장 북서쪽 장식(현수막에 이름), 칭호 「생일 주인공」(lookFor), 선물 1,000P 한 해 한 번(payKey), 곁(4m)에서 「축하하기」 하루 한 사람 한 번·폭죽, 올해 축하 수. 오늘 생일 목록은 서버 메모리(하루·저장 때 다시 읽음 -- ponytail: 계정 수가 커지면 생일 색인).
- 우체통(광장 동쪽 `VILLAGE.mailbox`): 모든 활성 계정에게 편지 200자·하루 5통·30일·읽음, 소포는 선물 포장지 규칙(islandGift) 그대로, 받는 사람 접속 중이면 바로 알림.
- 안내 주민(`VILLAGE.guide`, 광장 스폰 동쪽 7m에 늘): 2026-10-19 이후 만든 계정은 첫 섬에서 무조건 7단계(걷기·화면 돌리기·말 걸기·잡초·납품·게임관·메뉴), 건너뛰기 없음, 화살표, 끝나면 2,000P 한 번. 말 걸면 주제별 설명·처음부터 다시(사용자 2026-10-18). 시험 서버(NODE_ENV=test)에서는 자동 시작 안 함.
- 곤충 채집(`lib/island-insects.js`): 잠자리채(잡화점 1,500P, 쓰고도 남음)로 광장·길 밖 풀밭에서, 서버가 구역 계절·밤낮(관리자 시간대 포함)·비로 12종 중 하나와 오는 때를 정함, 2.5초 안에 Space/「잡기」. 도감에 곤충 12(대도감 완성 조건은 23 그대로), 상인 판매, 그림은 납품 SVG.
- 박물관(`MUSEUM` (28, 34), 외관만): 물고기·곤충 종류마다 한 번 기증, 처음 기증자 이름(worldValue museum, 기증은 한 줄로 차례대로). 다 채운 섬 보상·실내는 다음.
- 반려동물: 강아지·고양이 8,000P·어깨 새 6,000P(잡화점), 가방에서 「데리고 다니기」(이름 10자), 계정 문서 pet + 접속 표시에 실려 모두에게, 뒤쪽 옆을 따라옴(Walk·Idle, 내가 앉으면 Sit), 실제 시간으로 따라감. asset-loader `creature`.
- 낚싯대(사용자 2026-10-18): 잡화점 1,500P, 가방에 없으면 낚시 안 됨(NO_ROD). 기존 계정도 사야 함.
- 47 모델 29종 together-v1(우체통·생일·박물관 외관·안내 화살표만 입장 전 묶음, 나머지는 처음 쓸 때), 안내 주민은 characters/. 반려동물 노드 예산 12(budgets pet).
- 관리자 「문제 기록」(docs/admin-issue-log-20261018.md): Esc 메뉴(☰) 「문제 기록」 → 내용·종류(버그/어색함/개선), 화면(섬 위치·계절·시간대·날씨·화질/게임방/게임관/열린 창)·기기·FPS·최근 브라우저 오류 8줄·섬 사진(JPEG ≤60KB, `snapshot`) 자동, worldValue issueLog 500개, /api/admin/issues(사진은 ?shots=1), 관리자 창 카드(상태 열림/고치는 중/해결·지우기·열린 것 Markdown 복사).
- 두 세계 영웅전 정리(docs/herosurv-fix-20261019.md): 게임별 랭킹에 최고 기록(게임이 마지막으로 연 보드, worldValue herosurvBoard), 섬 위 전체 화면 iframe(페이지 frame-ancestors self·X-Frame-Options SAMEORIGIN, 「나가기」는 postMessage로 창만 닫음 — 다시 불러오기·재로그인 없음), 엔진 시작 전 IndexedDB /userfs에 참가 파일(leaderboard_<sha256(api 주소) 앞 16자>.cfg [guest]) 미리 써서 이름·메일 창 없음. 게임 파일(pck)은 그대로 — 남는 「이름 변경」 버튼 숨기기(빌드 수정)는 이 세션의 권한 검사가 막아 사용자 결정 대기. 원작 표기(카드·NOTICE.md, 원작: 스마트대디).
- CI: 느린 러너에서만 흔들리던 시험 정리(기본 대기 15초, 곁 사람 폭죽 보기는 CI 주석, 걷는 주민 말 걸기는 CI 건너뜀 — A-6에서 다시 씀).
- 검증: 단위 시험 전체, e2e island-together·island-guide·island-insects·island-pets(반복 2회)·general-store·plaza 낚시·river-fishing·island-assets 등록부. 실제 휴대폰·GPU 미검증.
