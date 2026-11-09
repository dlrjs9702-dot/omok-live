# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.287 얼굴이 살아 있게

- 졸린 눈도 깜빡임(eyes_sleepy 건너뛰기 없앰), 말할 때 입(말풍선·주민 대화 창, 지금 입 ↔ o, 0.12~0.18초, 글자 × 0.06초 0.6~3초, 말할 때 표정 위로), 바라보기(0.25초마다 4 m 안 가장 가까운 사람·대화 상대 먼저, 머리 뼈 좌우 45°·위아래 15°, 서거나 걸을 때만, 등 굽힘처럼 믹서 앞에서 되돌림). 다음: 288 다래(에셋 110).

## v1.10.286 메신저 폰 고침 + 택시 좌석

- 폰은 방에 들어가도 입력칸 focus 안 함(PC 그대로), 이모티콘 판 닫기: ✕·메시지 목록·폰 입력칸(키보드 올라옴)·폰 뒤로 가기(history 한 단계), 열림 표시; 택시 탄 사람 뿌리 0.48 → 0.10(차 바닥, 엉덩이 두 번 더한 값), 머리 지붕 아래·타고 내릴 때 뜨지 않음, 단위가 몸·머리 모양 전부를 앉혀 지붕 0.05 m 아래 확인. 다음: 287 얼굴, 288 다래.

## v1.10.285 택시 고침

- 길을 0.5 m 격자로 다시 찾음(길 가운데, 물체에서 차 반폭+0.3 m, 물·계단 없음, 110점 404 m, 13 m/s 37~38초), 툇마루섬 정류장 → 「툇마루섬 마을」(−13.3, 173.1), 대청마당 정류장 3 m 남쪽, 승강장·서 있는 차 막힘(문 쪽 비움), 달리는 차는 나를 밀어냄, 걷는 주민 2 m 비킴·「빵!」, 타는 동안 모자 숨김, 택시 대역이 장면에 붙음. 다음: 286 메신저(폰 키보드·이모티콘 판 닫기), 287 얼굴, 288 다래.
