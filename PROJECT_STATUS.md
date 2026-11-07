# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.266 ① 주민 대화 나무 서버

- 대화 상태·힌트 8종(섬 지금 상태)·오늘의 물때(rare ×1.5)·열림 단계·keepsakes. 총괄 검토: 시작 때 started로 TALK_DONE(호감도 무한 막기), 대화 나무 호감도 주민마다 하루 affinity:talkDaily(기본 2). RELATIONS는 그대로(§3 ②). 다음: ② 화면·이야기 책 주고받기.

## v1.10.265 흔들림 묶음

- river-fishing 서버 입질 먼저·판정 시계 자동 조작·줄다리기 전략·박물관 칸, shopper 로비/섬 60초. 로컬 단위 게임 서버 10초 초과 9~10개(CI 통과)는 다음 흔들림 때.

## v1.10.264 주민 표정 (docs/emotes-20261107.md 5~6절, 에셋 102)

- 주민 44모습 교체·표정 묶음 27, 말할 때 표정, 혼자 감정, 내 감정에 반응(화면만). 메신저 #16 폴드: 서랍 「크롬에서 설치」, [install-why] 로그.
