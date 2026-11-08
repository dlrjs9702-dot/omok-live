# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.278 주민 내기

- 아는 사이·근무 중 아님·하루 한 판, 점수 내기(순발력, 서버 판정, 최대 5,000)·대국 내기(AI 방 「○○와 내기」, 최대 10,000), 판돈 먼저(resident_bet)·2배/비김 돌려받기, 하루 딴 돈 30,000 한도, 「♠」 잡힘, 주민 제안(섬 하루 3번), 총괄 대사 270줄, 재시작 때 열린 내기 판돈 돌려받기, 대국은 두는 동안 40분까지 기다림. 다음: 총괄 지시.

## v1.10.277 시험 정리 2차

- test-audit §6: fp·island-projects 1·2·3·island-story+s2·talk-camera 합침, reflex AI·solo-quest 할머니·current-actor 오델로 옮김, yard 줄임, river-fishing 도감 칸 data-item·줄다리기 자동 진행 고침, 시간표 새로(#426), 폰 샤드 6 → 4. 다음: 278 주민 내기(설계 notes 1e5c890).

## v1.10.276 그래픽 시범 2차

- PC 높음·GPU·구역 6 m 안: GTAO·약한 블룸(1초 서서히, 이름표·반투명 판 제외, 색 차이 없음 확인), 구역 땅 무늬(코드 그림), 구역 섬 나무 → 시범 나무(열매 나무·충돌 그대로), 화질별 풀잎(낮음 없음·중간 절반). fps 표는 #426. 다음: 총괄 지시 대기(실제 폰 측정, 시범 결과 정리).
