# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.330 경제 첫 손보기 (사용자 75A)

- 예금 이자 구간: bank:rate1 30‰ 그대로, bank:rate2 15 → 5‰(50만~500만 1.5% → 0.5%), bank:rate3 5 → 1‰(500만 넘는 부분 0.5% → 0.1%). 기본값만 바꿈 — 관리실에 저장한 값이 있으면 그 값이 쓰여요.
- [economy] 줄에 rates(지금 쓰는 구간·이자, set = 관리실 저장값)와 interestPaid(어제 예금에 실제로 붙은 이자 합)를 더함. 이자는 지갑이 아니라 예금에 붙어 장부(ledger) 행이 없어서, 붙은 날별 합을 JSON·PostgreSQL 저장소에 따로 모아요(bank_interest_days).
- 공지: 「큰 예금의 이자가 낮아져요(50만 P까지는 그대로)」.
- 함께: 329 화이트·점등 확인을 벽시계 2초마다(CI 흔들림 고침, #480 병합 뒤 커밋).
- 다음: 크리스마스 2단계 ②(1.10.331).

## v1.10.329 크리스마스 2단계 ①: 첫눈·화이트 크리스마스·점등식

- M1(christmas-boost): 행사 7일 17~06시 섬 전체 가벼운 눈, 24·25일 하루 종일 + 화이트 크리스마스(모든 구역 겨울 모습, 화면만 — 서버 계절은 날짜대로). IslandCalendar.snowOf, 행사 시계를 따름. 눈송이 둥글게.
- 135 snow_paint: 겨울 땅(눈)에 그린 눈 물결 질감, 옛 알갱이 대신.
- M5 트리 점등식: 12-19 17시 카운트다운 판(연말 판 자리·모형), 18시 점등(번쩍), 그 뒤 밤마다 전구 반짝임. 그 전 12월엔 트리 전구 꺼짐. IslandCalendar.lightingOf.
- 고침: asset-pipeline setDay가 둘째 값을 버려 화이트가 모형에 안 가던 것.
- 사진 notes img/xmas2-329.
- 다음: M3 주민 겨울 인사·차림, M4 종·캐럴, M2 집 장식(125).

## v1.10.328 주민 성격별 동작 연결 (에셋 123)

- 123 모션 23개 characters/motions에 복사(SHA256SUMS 일치), 빌드 설정 motions123.
- presets.json 7묶음(Elder·ElderBrisk·Kid·Formal·Sleuth·Dreamy·Brisk)을 주민 모형 등록부 preset으로: Idle·SlowWalk·Walk(·Run), speeds × 주민 크기(콩이 0.45는 재생 2배 상한), 노을 run 재생 6.2/4.2. lean은 그대로. 나머지(봄이·두리·반디·마루·물결)는 공통.
- createAnimator: 속도 항목을 요청한 상태로 고름(어르신은 걷기·달리기가 같은 Walk 액션 — 걷기가 달리기로 읽혀 0.68배로 느려지던 것).
- 사진·움직이는 그림: notes img/resident-motions-328 (주민 여섯, 공통/프리셋 전·후).
- 다음: 크리스마스 2단계(326 몫 M1 눈·M3·M4·M5).
