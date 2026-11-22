# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.403 Codex 391~400 나머지 + 택시 셋(notes codex-review-391-400, issues-taxi-resident-20261122 ⑤③④)

- 택시: #2 결제 실패 되돌리기는 내 차·내가 당긴 차만 · #5 자정 지난 보유권 「타기」 TAXI_PRICE · #6 요금 claim = 화면 요청 id(응답 없던 같은 요청은 그 결제로, 한 결제 한 운행·10분) · #7·#13 누를 때 행선지·요금 고정, 고를 때마다 버튼·모자람 · #9 한 정류장 두 호출이면 차 두 대 · #10 돌아갈 종점이 차면 빈자리 종점 · #11 한 줄 다리 bridgeHold · #12 급이동 3초 부르기·타기 안 됨 · #18 종점 빈 자리 충돌 원은 차 있을 때만 · 게임 방 이유를 거리보다 먼저.
- 택시 셋: 뒤 차 당기기 pulledAt = 탄 뒤 inOf+1.1 s(겹침 0.94→4.5 m) · 화면 시계 프레임 시각(viewNow) · 반투명 택시 깊이 먼저(renderOrder 10).
- #3·#4 수조 tankPuts + 응답 없던 넣기 같은 요청 · #8 축제 날짜별 횟수 유지 · #14 창고 완료 기록 하루 · #15 꺼낼 때 seq · #16 호랑이 미처리 world 'tigerPending' + 재시작 재개 · #17 재료 심부름 미지급 금액 고정 · #19 사라진 창고 가림 기록 · #20 부팅 캐시 격자 실패면 다시 저장. #1은 401 핫픽스.

## v1.10.402 펫 — 에셋 169·169b 연결 + 결정 61(자전거 머리 위 없앰) · 60-1(아이언맨 겹침)

- 작은 8종(PET_SMALL)은 자전거 때 basket, 169 BasketSit, 방석 보임(169b 표 PET_SEAT 0.064~0.087). 새는 birdFly: 파일 안 Fly, 옆 0.9 m·뒤 0.1 m·높이 1.05 m, d×8 따라잡기. tf 고양이 BasketSitPaw(PET_KIND_CLIP), 상자 펫 PET_SEAT 169 값.
- 배트맨 활공 때 cape_spread 0→1(0.25 s, High·Low 메시). 슈퍼맨 Fly(55°, 주먹 머리 옆), 아이언맨 재질 부드럽게 + 60-1 헬멧 아래 면 잘라 겹침 177→10 cm²(예산 △ 갱신).
- 걷어 냄(400 머리 위 몫): HEAD_SINK·이름표 어깨 옆(tagBeside)·폰 세로 headPetK·1인칭 머리 펫 숨김. 펫 이름표는 자세 그대로 잰 높이+6 cm(역할 바뀌면 다시).
- 파일 39개 SHA 일치(HeadSit·HeadSitWide는 안 씀).

## v1.10.401 핫픽스 — Codex 391~400 #1 택시 중간 정류장 출발 시 서버 종료

- 서버 택시 틱(100 ms)이 앞을 내다볼 때 운행을 `{ from, startedAt }`로만 복사 → 중간 정류장(ROADSTOPS) 출발은 끝(`to`)이 없어 `curbOf(undefined)` 예외로 프로세스 종료(393부터; 부른 빈 차가 돌아갈 때도). `IslandTaxi.timeless(ride)`: to·empty·stay·park는 지키고 warp·side·ghost만 뺌.
- 시험: island-taxi-fleet(모든 중간 정류장 × 종점 3 × 손님/빈 차, 옛 복사는 throw·새 복사는 시계 없는 운행과 같은 자리), island-taxi-call(실제 속도로 배 타는 곳 → 박물관, 1.5 s 뒤 서버 응답 — 고치기 전 코드는 같은 TypeError로 실패).
