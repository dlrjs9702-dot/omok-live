# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

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

## v1.10.95 날씨·별똥별(A4 일부), 게임관 점검 반영 2차(A3)

- 지시: 구현 순서 A3 나머지(작업서 gamehall-fix-spec-20261018.md)와 A4 「함께하는 섬 — 에셋 없이 되는 것」의 날씨·별똥별.
- 날씨(`lib/island-weather.js`): 서울 하루의 3시간 단위마다 맑음·비(약 1/4, 시드 고정 — 서버마다 같음), 비 갠 뒤 30분 무지개. `/api/island/weather`, 관리자 고정 `/api/admin/island/weather`(worldValue `weather`, `islandWeather` 방송). 화면: 비 줄기(화질 단계별 200/450/900)·겨울 구역은 눈(`seasonAt`)·비 올 때 하늘·조명 어둡게·무지개는 시야 위 띠(카메라가 아래를 봐 하늘이 화면에 없음). 비 오는 동안 낚시는 한 번 더 뽑아 비싼 쪽(`where.rain`).
- 별똥별(`lib/island-stars.js`): 서울 밤(20~4시) 30분마다 45%로 한 개, 시각은 시드 고정. `/api/island/stars`(지금·다음 별, 어제 소원 선물 300P 지급 — `claimEvent star_gift_<slot>` 1회), `/api/island/stars/wish`(떨어지는 20초 안 1회, 계정의 `stars` 문서에 기록). 우체통(B 47)이 생기면 선물을 그쪽으로.
- A3 2차: 맞고 결과 창(body로 옮긴 가운데 창, 항목 한 줄씩, [한 판 더]·[게임관으로]·[판 보기]), 따 온 패 「n장부터」(엔진 `SCORE_FROM`·`PIBAK_MAX`를 공개 상태로)·단·고도리 n/3·피박·광박 위험, 이름표 얼굴(`publicPlayer` face·title — 피부·머리색 요약), 오목 AI 연습에 장착한 오목 돌 스킨(`/api/skins`), 카드놀이 공용 탁자(초록 펠트+나무 테두리)·도둑잡기 같은 앞면·파란 뒷면·부채꼴 상대 패, 다빈치 차례 시간은 고리로.
- 남은 A4: 주말 섬 대회. A5: 메신저 SSE, 기념사진 2버튼, 근거리·같은 열차 채팅, 통합 UI, 관리자 나머지.
- 검증: e2e island-weather·island-stars(관리자 고정·겨울 눈·무지개, 별 시계 이동 시험 훅)·gostop-late-layout(결과 창)·reflex(AI 스킨)·skins-cards, 단위 gostop 60건·theme-light. Codex 검토 대기(사용량 한도, 18:19 KST 해제 뒤). 실제 휴대폰·두 기기 미검증.
