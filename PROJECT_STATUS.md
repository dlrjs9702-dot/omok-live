# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.290 High/Low 바뀜 부드럽게

- 0.4초 4×4 점무늬 섞기(투명 아님, 인스턴스 lodFade 속성·혼자 LOD·사람 재질 복사본), 거리 1.5배, 그림자 그리는 항목 35 m 한도; 자동 화질 qualityGovernor(느림 9초 내림, 60초 올림, 내린 뒤 2분 막음, 5분 두 번 → 10분 머묾), 풀 1.5초 높이 0↔1·땅 무늬 섞기, 하루 한 번 알림, 문제 기록 화질 단계·auto/fixed·10분 바뀜 수. 성능 「중간」 288 대비 −6~+6%. 다음: 291 물고기 1층 가게, 주민 내기 목표.

## v1.10.289 메신저 폰 화면 맞춤

- 페이지 높이를 보이는 높이(visualViewport)에 맞춤(설치한 앱에서 100dvh가 화면보다 커서 두 겹 스크롤), 폰 방 안에서 설정 카드 숨김(목록·서랍·PC 그대로), 30줄 방 e2e. 다음: 290 High/Low 바뀜 부드럽게.

## v1.10.288 28번째 주민 다래

- 개명 창구 공무원 카멜레온(에셋 110, 0.86·윗몸 6°), 글 9가지(이야기 세 장 village·office, 대화 나무, 내기, 좋아하는 것, 사진 부탁), 단비와 겹치던 21줄은 다래 말씨로, 관공서 넷이 하루 하나씩 쉼(개명은 민원 창구가 받음), 개명 창구 이름표 대신 「· 다래」, 27을 박은 시험은 주민 수로. 다음: G3 빛.
