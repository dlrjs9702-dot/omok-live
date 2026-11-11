# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.308 윷놀이 B (3~4명)

- lib/games/yut.js 2~4명(SEATS black·white·green·yellow, 3~4명 말 3개, seatOrder), 서버 방 인원 players 2~4·다 차면 시작·AI 1~3(fillYutAi), 정산 seatOrder, 기록 2인 yut·3·4인 yut3·yut4(미션은 yut), 랭킹 고르기 3명·4명. 화면: 초록·노랑 카드, 폰 카드 2줄, 판 아래 자리 글씨 크림 칩, 3~4명 출발·완주 칸 갈색·회색, HUD 완주 두 줄, 윷 「내 차례예요」 알림은 폰에서 윷가락 판 위.
- 다음: 윷놀이 C(사람 방 빈자리 AI·나간 자리 AI 이어 두기·섞인 판 정산과 전적, 주민 대화 TOO_FAR 한 줄), 택시 서서 기다리기, 마당 농사 F1.

## v1.10.307 윷놀이 실제 규칙 A

- lib/games/yut.js 한판마당 규칙(서버 판 번호 20 참먹이·99 남, 화면은 finishLine/finished), pend 모으기·결과마다 말 고르기(move-yut ri)·빽도 tr·도 3/16·빽도 1/16·쓸 수 없는 결과 버림, aiPick + 2인 AI(scheduleAiMove), 결과 칩(판 바로 아래 가운데). release-batch 05:17·예비 05:47. resident-faces :46·:69 시험(검토).
- 다음: 윷놀이 B(3~4명·초록·노랑·인원별 랭킹·나간 자리 AI).

## v1.10.306 G4b 채집

- lib/island-gather.js 83자리(버섯 44: 통나무 둘레 27·푸른 4, 나뭇가지 34, 네잎클로버 5), 공용 자원 fixed 종류: 같은 자리 재생(버섯·가지 3시간, 푸른 6시간, 클로버 12시간), 자라는 중 worldValue gatherGrowing 저장. 하루 상한 없음(사용자). 흔한 버섯 5종 = 「버섯」, 새 물건 mushroom_blue 6,000·branch 500·twig 300·clover_four 10,000. 버섯·클로버 1.5배. 잡초 A안(채집 표에 행만). 공급 약 31,700P/h.
- 감정 표현 remoteEmote 한 줄(검토, emotes:31), resident-roster:87 시험 두 줄(검토). 다음: 윷놀이.
