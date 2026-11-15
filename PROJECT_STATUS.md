# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.328 주민 성격별 동작 연결 (에셋 123)

- 123 모션 23개 characters/motions에 복사(SHA256SUMS 일치), 빌드 설정 motions123.
- presets.json 7묶음(Elder·ElderBrisk·Kid·Formal·Sleuth·Dreamy·Brisk)을 주민 모형 등록부 preset으로: Idle·SlowWalk·Walk(·Run), speeds × 주민 크기(콩이 0.45는 재생 2배 상한), 노을 run 재생 6.2/4.2. lean은 그대로. 나머지(봄이·두리·반디·마루·물결)는 공통.
- createAnimator: 속도 항목을 요청한 상태로 고름(어르신은 걷기·달리기가 같은 Walk 액션 — 걷기가 달리기로 읽혀 0.68배로 느려지던 것).
- 사진·움직이는 그림: notes img/resident-motions-328 (주민 여섯, 공통/프리셋 전·후).
- 다음: 크리스마스 2단계(326 몫 M1 눈·M3·M4·M5).

## v1.10.327 택시 손보기

- 속도 13 → 16 m/s(사용자 「16의 속도로 올려」), 동쪽 윤슬다리 위도 같은 속도(SLOW = FAST, 나중 다리에도 느린 구간 없음). 한 번 약 28~29초. 서서 기다리기(317)는 앞 보기 거리가 속도에 따라 늘어 그대로 사람 앞에서 섬(서버 시험 통과).
- 요금(사용자 2026-11-16): 집이 있어도 냄. 탈 때 「한 번 1,000P / 오늘 자유이용권 5,000P」, 자유이용권은 KST 그날 0~24시 몇 번이든(서버가 계정·날짜로 한 번만 받음). 경제 값 taxi:fare·taxi:dayPass. 정류장 쌍별 추가요금 자리(EXTRA, 지금 비어 있음). 내역 「택시 요금」·「택시 자유이용권」, 카드에 「오늘 자유이용권 ✓」.
- island-insects e2e: 밤(20~06시)엔 밤 곤충만 적게 나와 새벽 CI가 흔들림 → 시험 동안 섬 시간을 낮으로.
- 사진: notes img/taxi-327.
- 다음: 주민 성격별 동작 연결(123).

## v1.10.326 흔들림 고치기

- patch-speed §6 순서대로: 시험 한 줄 고침 7개(messenger 보류 줄, visit-tasks 자리 키, view-modes·talk-camera 주민 고르기·fov, 광장 챔피언 60 s, 운반 count, fish-tug tug:false, emotes 깜박임), 시간 예산(백화점 문 30·45 s, talk-camera 25 s), game-points-server 시험 파일 둘로.
- 게임 한 줄 둘: 역 승강기 입구가 더 가까운 사람·물건을 덮지 않음, 대화 카메라는 모형이 6 m 밖이면 서버 자리로.
- 확신 낮은 둘(emotes 표정 미리 그리기, resident-faces 팩·긴 줄)은 2주 지켜봄.
- 기록의 탑 시험: 'board:records'가 뒷면 키의 앞부분이라 뒷면에서 누름이 사라지던 것 → 앞면 키를 정확히 기다림. resident-bets는 325에서 고침(그날 심부름 주민 빼기).
- rerun-once: 열린 PR의 머리 커밋 실행만 다시 돌림.
- 다음: 택시 손보기(속도 16·다리 같은 속도·요금).
