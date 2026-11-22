# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.405 L0 길 계산 틀(notes taxi-island-loop-20261122 §4, 결정 69)

- 길 그림: ROADS를 만나는 점에서 조각으로(지금 3조각), 조각 끝점 사이 가장 짧은 길(Floyd). driveBetween·distanceOf가 이걸 씀 — 장소 90쌍 모두 옛 줄기와 같은 점·거리. 거리는 쌍마다 기억.
- 택시 한 줄 다리 상자는 dalmaru-terrain BRIDGES의 `taxi`에서. 길 둑은 island-taxi BANKED(지금 ROUTE만 — EXT까지 하면 별마루다리 서쪽 바닷가에 8 m 둑).
- 빈 차로 돌아오는 차: 돌아오는 길 끝에서 종점에서 11 m 떨어진 곳에서 길을 떠나(차로 그대로) 내리는 자리 → 쉼터 뒤 반원 → 앞으로 자리(HOME_V 6 m/s, 모서리 둥글게). 어긋남 25° 안·앞자리에서 4.4 m 밖 시험.
- 종점 도는 길(PARK_PATHS) 2.35 m 안에는 자연물·돌 없음 — 대청마당 종점 뒤 나무 하나(16.3, −47.1) 빠짐, 땅 덮개 지도 다시.

## v1.10.404 문제 기록 고침(notes issues-taxi-resident-20261122)

- c086f60d 높은 윤슬다리 깜빡임: 다리 맞추기(fit)를 LOD 단계마다 따로(asset-loader) — 두 단계가 한 묶음으로 같이 그려지던 것(389부터).
- a720f494·78b5ccc5 배 뒤 걷기: 내릴 때 loop('idle') → release()(나·다른 사람).
- 9748abea 건널목 줄 끝: rd.b 문턱 smoothstep(0.46, 0.54).
- de84f895 종점: 남는 차는 내린 자리에서 앞으로 4.5 m → 쉼터 뒤 반원(지름 6.4) → 뒤에서 자리로(PARK 5 s, 어긋남 20° 안 시험). 빈 차로 돌아오는 마지막은 L0에서.
- 3353cf17 대청마당: 가장자리 따라가는 길 칠 안 함(road.png 다시) — 차 길은 그대로.
- 7e6f3839 배: 서서 출발·가속·감속 1.5 m/s², 뱃길 모서리 둥글게(두 번 깎기), 뱃머리 2.5 s 동안 느릴 때 돌림 — 건너는 시간 약 29→36 s(총괄 OK).
- dddccb8f 다리 동쪽 끝 땅: 길 둑 뒤에 폭 9.8 × 안 1.5·밖 3 m 평평(끝 높이), 3 m에 풀기, 역 터 2 m는 그대로 — 다리판 아래 땅 0 cm.
- a0d86433 역 들어가는 길 정남은 해변 둑 기울기(1.28 > 0.85) 때문에 동쪽 다리 넓히기 묶음으로.

## v1.10.403 Codex 391~400 나머지 + 택시 셋(notes codex-review-391-400, issues-taxi-resident-20261122 ⑤③④)

- 택시: #2 결제 실패 되돌리기는 내 차·내가 당긴 차만 · #5 자정 지난 보유권 「타기」 TAXI_PRICE · #6 요금 claim = 화면 요청 id(응답 없던 같은 요청은 그 결제로, 한 결제 한 운행·10분) · #7·#13 누를 때 행선지·요금 고정, 고를 때마다 버튼·모자람 · #9 한 정류장 두 호출이면 차 두 대 · #10 돌아갈 종점이 차면 빈자리 종점 · #11 한 줄 다리 bridgeHold · #12 급이동 3초 부르기·타기 안 됨 · #18 종점 빈 자리 충돌 원은 차 있을 때만 · 게임 방 이유를 거리보다 먼저.
- 택시 셋: 뒤 차 당기기 pulledAt = 탄 뒤 inOf+1.1 s(겹침 0.94→4.5 m) · 화면 시계 프레임 시각(viewNow) · 반투명 택시 깊이 먼저(renderOrder 10).
- #3·#4 수조 tankPuts + 응답 없던 넣기 같은 요청 · #8 축제 날짜별 횟수 유지 · #14 창고 완료 기록 하루 · #15 꺼낼 때 seq · #16 호랑이 미처리 world 'tigerPending' + 재시작 재개 · #17 재료 심부름 미지급 금액 고정 · #19 사라진 창고 가림 기록 · #20 부팅 캐시 격자 실패면 다시 저장. #1은 401 핫픽스.
