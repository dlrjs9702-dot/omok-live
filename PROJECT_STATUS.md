# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.98 함께하는 섬(B 47): 생일·우체통·안내 주민·곤충 채집·박물관·반려동물, 낚싯대 판매, 관리자 「문제 기록」, 두 세계 영웅전 정리

- 생일(`lib/island-together.js`, 계정 문서 birthday): 내 정보에서 월·일·숨김, 관리자는 계정 이름으로. 당일 광장 북서쪽 장식(현수막에 이름), 칭호 「생일 주인공」(lookFor), 선물 1,000P 한 해 한 번(payKey), 곁(4m)에서 「축하하기」 하루 한 사람 한 번·폭죽, 올해 축하 수. 오늘 생일 목록은 서버 메모리(하루·저장 때 다시 읽음 -- ponytail: 계정 수가 커지면 생일 색인).
- 우체통(광장 동쪽 `VILLAGE.mailbox`): 모든 활성 계정에게 편지 200자·하루 5통·30일·읽음, 소포는 선물 포장지 규칙(islandGift) 그대로, 받는 사람 접속 중이면 바로 알림.
- 안내 주민(`VILLAGE.guide`, 광장 스폰 곁에 늘): 2026-10-19 이후 만든 계정은 첫 섬에서 무조건 7단계(걷기·화면 돌리기·말 걸기·잡초·납품·게임관·메뉴), 건너뛰기 없음, 화살표, 끝나면 2,000P 한 번. 말 걸면 주제별 설명·처음부터 다시(사용자 2026-10-18). 시험 서버(NODE_ENV=test)에서는 자동 시작 안 함.
- 곤충 채집(`lib/island-insects.js`): 잠자리채(잡화점 1,500P, 쓰고도 남음)로 광장·길 밖 풀밭에서, 서버가 구역 계절·밤낮(관리자 시간대 포함)·비로 12종 중 하나와 오는 때를 정함, 2.5초 안에 Space/「잡기」. 도감에 곤충 12(대도감 완성 조건은 23 그대로), 상인 판매, 그림은 납품 SVG.
- 박물관(`MUSEUM` (28, 34), 외관만): 물고기·곤충 종류마다 한 번 기증, 처음 기증자 이름(worldValue museum, 기증은 한 줄로 차례대로). 다 채운 섬 보상·실내는 다음.
- 반려동물: 강아지·고양이 8,000P·어깨 새 6,000P(잡화점), 가방에서 「데리고 다니기」(이름 10자), 계정 문서 pet + 접속 표시에 실려 모두에게, 뒤쪽 옆을 따라옴(Walk·Idle, 내가 앉으면 Sit), 실제 시간으로 따라감. asset-loader `creature`.
- 낚싯대(사용자 2026-10-18): 잡화점 1,500P, 가방에 없으면 낚시 안 됨(NO_ROD). 기존 계정도 사야 함.
- 47 모델 29종 together-v1(우체통·생일·박물관 외관·안내 화살표만 입장 전 묶음, 나머지는 처음 쓸 때), 안내 주민은 characters/. 반려동물 노드 예산 12(budgets pet).
- 관리자 「문제 기록」(docs/admin-issue-log-20261018.md): Esc 메뉴(☰) 「문제 기록」 → 내용·종류(버그/어색함/개선), 화면(섬 위치·계절·시간대·날씨·화질/게임방/게임관/열린 창)·기기·FPS·최근 브라우저 오류 8줄·섬 사진(JPEG ≤60KB, `snapshot`) 자동, worldValue issueLog 500개, /api/admin/issues(사진은 ?shots=1), 관리자 창 카드(상태 열림/고치는 중/해결·지우기·열린 것 Markdown 복사).
- 두 세계 영웅전 정리(docs/herosurv-fix-20261019.md): 게임별 랭킹에 최고 기록(게임이 마지막으로 연 보드, worldValue herosurvBoard), 섬 위 전체 화면 iframe(페이지 frame-ancestors self·X-Frame-Options SAMEORIGIN, 「나가기」는 postMessage로 창만 닫음 — 다시 불러오기·재로그인 없음), 엔진 시작 전 IndexedDB /userfs에 참가 파일(leaderboard_<sha256(api 주소) 앞 16자>.cfg [guest]) 미리 써서 이름·메일 창 없음. 게임 파일(pck)은 그대로 — 남는 「이름 변경」 버튼 숨기기(빌드 수정)는 이 세션의 권한 검사가 막아 사용자 결정 대기. 원작 표기(카드·NOTICE.md, 원작: 스마트대디).
- CI: 느린 러너에서만 흔들리던 시험 정리(기본 대기 15초, 곁 사람 폭죽 보기는 CI 주석, 걷는 주민 말 걸기는 CI 건너뜀 — A-6에서 다시 씀).
- 검증: 단위 시험 전체, e2e island-together·island-guide·island-insects·island-pets(반복 2회)·general-store·plaza 낚시·river-fishing·island-assets 등록부. 실제 휴대폰·GPU 미검증.

## v1.10.97 섬 바닥 질감(B 48)

- 바닥 질감(B 48 ground-v1): 회색 반복 질감 3장(잔디 64·흙 32·모래 32px)과 길 가장자리 술 마스크(128px)만 — GPU 약 120KB. 지형·길 재질에 `onBeforeCompile`(island.js `grained`)로 세계 좌표 반복, 각 질감을 자기 평균 밝기(선형 0.611·0.319·0.701)로 나눠 색·계절·숲 바닥 밝기는 그대로, 결만 50%. 지형은 꼭짓점마다 풀·모래 비율(`aGround`), 길은 따라 3m마다 반복·가로질러 가장자리 1 → 마스크로 흙/풀 결과 투명도(섬 풀이 술 모양으로 비침). 팩의 색상판·해안 경계·모래-물 질감은 쓰지 않음(해안 띠가 따로 없음).
- 검증: 단위 시험(Windows 줄바꿈 6건 외), 로컬 화면 확인(낮·길·바닷가). 실제 휴대폰·GPU 미검증.

## v1.10.96 주말 섬 대회(A4), 메신저 실시간·관리자 나머지(A5), 겨울 축제·민원실 넓히기·꽃·나무 심기(B 46·44·45)

- 주말 섬 대회(`lib/island-contest.js`): 기본 토 20:00·30분(관리자 `/api/admin/contest`), 낚시(가장 비싼 한 마리)·두더지 잡기(최고 점수)·잡초 뽑기(수) 주마다 순환, 기존 서버 판정 지점에서 기록(`contestNote`), 막대·실시간 순위, 끝나면 1~3위 30,000/15,000/8,000 + 참가 1,000(2명 이상일 때, `claimEvent contest_<n>_prize` 1회), 우승자 동상(`CONTEST_STATUE` 광장 서쪽). 진행 중 기록은 메모리(재시작 시 그 대회 기록 사라짐 — ponytail 표시).
- 메신저 실시간 받기: `/api/messenger/stream`(계정 토큰은 헤더 → fetch 스트림), 방이 바뀌면 구성원에게 방 id(`pokeRoom`), 끊기면 5초 뒤 다시·그동안만 3초 묻기. 관리자 나머지: 계절 회전 자동/지금 배치로 멈춤(낚시 계절도), 이벤트 장식 자동/할로윈/겨울 축제/끔(밤과 분리), 공지 예약(`noticeQueue`, 30초마다 게시, 취소). 사진 2버튼·근거리 채팅·통합 UI 6~8은 이미 v1.10.43~83에 구현돼 있었음.
- 겨울 축제(B 46 winter-v1): 12월 또는 관리자 스위치 — 분수 자리 트리·선물·눈사람·썰매·사탕 지팡이·눈더미, 광장 벤치·가로등에 눈 덮개(겹침 모델), 겨울 의상 6종(`WINTER_ITEMS`, 산타 옷은 자체 몸체). 팩의 화환·가랜드·전구줄은 걸 난간이 없어 뺌.
- 민원실 넓히기(B 44 townhall-v3): 28x18m, 창구 3개 9m 간격·직원 자체 모델, 대리석 의자 12+벤치 6석(좌석 `t0..t17`, 방 바닥 높이 `y`), 로비 소품, 가구 충돌(가장 가까운 빈 쪽). 팩을 반 바퀴 돌려 입구는 그대로 카메라 쪽.
- 꽃·나무 심기(B 45 planting-v1, `lib/island-plants.js`): 꽃씨 5색·묘목·비료 판매, 가방 「심기」(광장·길·물가·시설·밭·마을 소품 밖, 꽃 0.6m·나무 3.2m 간격, 1인 20·섬 600), 단계(꽃 8시간·나무 2일마다, 3단계), 비료 한 번이면 그 뒤 2배, 모두에게 보임(`plants` 방송·2분마다). PG 새 표 `island_plants`.
- 검증: e2e island-contest·island-admin-look(겨울 축제 포함)·island-plants·messenger(2.5초 안 도착), townhall 관련 plaza 시험, 단위 island-a4(모듈 자체 검사 4)·general-store(심기 JSON/PG)·asset-pipeline·skins. Codex 검토(v1.10.95·96): 지적 10건 모두 반영 — 지난 소원 선물(어제만→받지 않은 날 모두), 섬 재진입 때 별똥별·대회 확인 재시작, 맞고 「판 보기」 닫힘은 방마다, 날씨 늦은 응답 무시, 공지 예약 변경 한 줄로 차례대로·게시 뒤에만 빼기, 일요일 늦게 시작해 월요일로 넘어가는 대회 유지, 정산 실패 시 15초마다 다시, 오래 접속 중인 계정도 날마다 접속일 기록. 실제 휴대폰·GPU 미검증.
- 예금 이자(사용자 2026-10-18): 마지막 접속 뒤 7번째 자정부터 이자 없음(`bankAccrue` visitDay, 접속일은 로비·방 연결 때 하루 한 번 `noteVisit` — 이자를 먼저 옛 접속일로 센 뒤 바꿈; 기록 없는 계정은 2026-10-18 접속으로 침). PG 새 표 `bank_visits`. 입장 전 묶음은 겨울 축제·민원실 모델을 빼 21.6→19.9MB(`island.later`, 처음 쓸 때 받음).
