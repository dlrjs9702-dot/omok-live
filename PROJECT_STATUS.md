# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.297 물고기 통·곤충 채집통·폰 시점 단추

- 물고기 통·곤충 채집통(사용자 확정): 1층 잡화점, 30→60→90→120칸 20만/50만/100만/200만P(keepnet:*, bugbox:*). 같은 가방 목록에 meta.box 표시(스키마 변경 없음), 통 먼저 → 가득 차면 가방, 물고기 한 칸 한 마리·크기, 곤충 쌓기, 모두 팔기·박물관·부탁·선물 그대로, 놓아주기, 가방에서 옮기기, 통 창은 등급·크기 순. 폰 위 왼쪽 단추 flex 한 줄 + 대회 띠 같은 줄(폴드에서 시점 가림 고침). 다음: 114 주민별 이모티콘.

## v1.10.296 G3 빛(C안)·가방 늘리기 안내

- G3 C안(사용자): GTAO 어디서나 없앰(패스 안 만듦, 276 시범 구역 포함), 블룸만 PC 「높음」 섬 바깥 전체. RX 570 vsync 끔: 끔 84/74/76 → 켬 82/70/75 fps. 가방 창 아래 「가방 늘리기: 백화점 1층 잡화점」, 1층에선 단추, 32칸이면 「가방이 가장 커요」. 다음: 물고기 통·곤충 채집통.

## v1.10.295 뒷머리 층(턱) 고침

- 에셋 116 머리 23개(High 12·Low 11): 73 뒤통수 껍질을 머리 테두리에 맞춰 다시, 테두리 법선 바깥으로(문제 기록 「건」). 코드 변경 없음. 다음: G3 빛.
