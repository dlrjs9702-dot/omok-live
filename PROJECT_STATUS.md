# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.315 배치 도구 1단계

- docs/placement-tool-v2-20261114: 꾸미기 카메라 확대(1.5 m)·돌리기(끌기·Q/E·두 손가락), 열면 9 m 비스듬히, 세밀(0.05 m·15°, gc.placeFine), 물건끼리 겹치기 허용(문간·집·현관 길·울타리 밖은 막음), rot 1/6 단위·0.05 m 저장, 폰 단추 글자.
- 다음: 렉 줄이기 2차(1.10.316), 택시.

## v1.10.314 렉 줄이기

- 검토 render-scale-and-house-lag: ㄱ 울타리 셀 그림자 끔, ㄴ 에셋 120 울타리 다이어트(나무 417→64·돌 314→70·오두막 497→72·꽃 8,066→978, 멀리용), ㄹ ☰ 그리기 해상도(자동 = 높음 100·중간 75·낮음 60%, 1을 넘지 않음 / 100~50%, gc.renderScale).
- 다음: 배치 도구 1단계(1.10.315), 택시.

## v1.10.313 문제 기록 11-12~13

- A1 에셋 로더 fill() 공유 행렬 → 칸마다 행렬, 손 잡초 worldScale. A2 111 벤치 앞뒤 → prop.bench 회전 0·yard.bench π. A3 문제 기록 본문 96 KB. A4 관공서 마당 처음 잡초 제외. A5 큰 집 앞 막힘 원 11. A6 고사리 장식 plant_low·키 큰 풀 나무 밑동(사용자 확인 중). A7 다시 하기 = 그 판 난이도. A8 채집채 맞은 주민 서버 2.7초 붙잡기. ㅁ 문제 기록 perf.
- 다음: 렉 줄이기(1.10.314), 배치 도구 1단계(1.10.315), 택시.
