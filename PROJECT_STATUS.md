# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.170 섬 채팅 창을 원하는 자리·크기로

- 섬 채팅 창의 머리(「채팅」 줄)를 끌어 원하는 곳으로 옮기고, 오른쪽 아래 모서리를 끌어 크기를 바꿀 수 있어요. PC는 마우스, 휴대폰은 손가락으로 똑같이 돼요.
- 정한 자리와 크기는 기기마다 기억해요(PC와 휴대폰은 따로). 화면 크기나 방향이 바뀌어도 비율대로 맞춰요.
- 창은 화면 밖으로 나가지 않고, 「↺ 기본 자리」를 누르면 처음 자리·크기로 돌아가요.
- 채팅 입력줄은 채팅 창 바로 아래를 따라가요(창이 화면 아래쪽이면 위로).

## v1.10.169 행사·대회 정산을 더 단단하게

- 수확제 요리 대회: 재료를 모두 내야 도장을 받아요. 그사이 재료를 팔았거나 썼다면 낸 재료를 돌려주고 다시 고르게 해요.
- 매주 대회: 서버가 며칠 쉬었다 깨어나도 지난 대회 결과(트로피·칭호·포인트·영웅마루)가 빠짐없이 정해져요.
- 가판대에서 바꾼 물건을 받지 못했다면 다시 누르면 받아요.
- 바쁜 단체 메신저 방에서 새 말이 늦게 들어오던 것을 고쳤어요.
- 행사 창에서 칸을 빠르게 바꾸면 다른 칸 내용이 보이던 것을 고쳤어요.

## v1.10.168 부탁은 받고 나서 시작해요

- 섬 주민과 이야기 주민의 부탁이 이제 쪽지로 먼저 와요. 할 일·받는 것·기한을 보고 「할게요!」를 눌러야 시작되고, 「다음에요」면 그냥 넘어가요.
- 받은 부탁은 화면 왼쪽 위 종이 카드에 진행이 보여요(최대 3개). 다 모으면 ✓와 함께 「○○에게 돌아가 말해요」로 바뀌고, 카드를 눌러 그만둘 수도 있어요.
- 부탁을 마치면 받은 것이 적힌 완료 카드가 떠요.
- 역 승강기 시험이 느린 화면에서 가끔 흔들리던 것을 고쳤어요.
