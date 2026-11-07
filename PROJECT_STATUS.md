# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.271 섬 택시

- 대청마당 ↔ 툇마루섬 입구, 에셋 99(차·정류장·TaxiEnter/Sit/Exit). 요금 집 없으면 1,000P(경제 taxi:fare), 집주인 무료. 서버가 길·시계로 자리 결정. 검토 반영: 동작은 좌석 원점(enter_L/exit_L), 문은 동작 시각, 카메라는 차 뒤 대각선·1인칭 차 안. 다음: 272 Codex 261~270 고침.

## v1.10.270 시험 정리 2차(일부) + 크롬 열기 시험 지우기

- 크롬 열기 시험 단추·try·install-why 지움(주소 복사 확정), resident-talk-gone 합침, island-assets 4계절 → 한 번. 남은 합침·줄이기는 다음 시험 정리 묶음. 다음: 271 택시.

## v1.10.269 시험 정리 1차

- 폰 빼기 38곳, 겹치는 e2e 지움(pandemic·island-entry 파일 포함), 스킨 판독 대비 12개 → skins-contrast 한 테스트, 메신저 manifest 단위, ci-timings 새로(PC 205·폰 50 기계분). 다음: 270 합침·줄이기, 크롬 열기 시험·install-why 지우기.
