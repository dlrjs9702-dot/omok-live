# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.79 3인칭 동작·어깨 정비 연결(assets 36)

- 지시(사용자 2026-10-17 2순위): assets 36 HANDOFF 기준으로 지원 복장·기본 사회행동부터 연결, 확인 없이 배포.
- 동작(`tools/assets/island-models.json` 출처 `motion36`, gltfpack): 기존 28개 교체 + 느리게 걷기·둘러보기·알아보기·짧은 인사 4개. 새 클립이 팔 자세를 직접 가지므로 런타임 armTuck 제거(`asset-loader.js`). WalkStart/Stop·선회(초안, 루트 이동)·농사/음식/도구 등 소품이 필요한 자유 모션·CarryWalk/Run·SitTalk는 연결하지 않음(파일도 넣지 않음).
- 몸·옷 짝(`wardrobe-contract.json`): 운동복·후드는 전용 몸(`body_sports/hoodie`)과 가중치 수정 옷, 옷 없음은 `body_bare`, 나머지 59의상은 기존 `body_core`(`island-assets.js` `body`/`bare`, `asset-loader` `wear`). 납품 바이트 그대로 복사(precompressed) — 양자화 없는 meshopt·재질별 메시라 `budgets.json` `$motion36` 해시 고정 예외.
- 이동 3단계(`plaza-scene.js`): 1.0/4.2/6.2, Shift 탭 = 느리게↔보통, 0.3초 홀드 = 뛰기(놓으면 이전 걸음), 휴대폰 `#islandPaceBtn` 같은 규칙. 애니메이터(`asset-pipeline.js`)에 `slow` 상태·클립별 재생률(`rates`). 다른 사람은 위치 속도로 같은 걸음이 보임.
- 메신저 후속(v1.10.78 Codex 검토, 플러그인 실행 오류라 diff를 직접 넘겨 검토): PostgreSQL 번호 증가와 메시지 저장을 한 트랜잭션으로(동시 전송 시 메시지 건너뜀), 밀린 메시지는 받은 번호 다음부터 100개씩(최신 100개만 주던 누락), JSON 저장 실패 뒤에도 다음 저장 계속, 방 인원 제한을 저장소에서 확인(동시 초대 31명). 시험 `test/messenger.test.js`.
- 시설 관리인: 다가가면 짧은 인사(20초에 한 번), 비어 있을 때 가끔 둘러보기 — 평소 대기 위에서만.
- 검증: 단위(GLB 예산·등록부·파이프라인), e2e `motion36.spec.js`(Shift 탭/홀드 걸음·클립·거리, 운동복 전용 몸), 기존 섬 에셋·광장 e2e. 실제 휴대폰·GPU·다른 59의상 교차 미검증.

## v1.10.78 메신저

- 지시(사용자 2026-10-17): IDEAS `#future-messenger`를 이번 작업에 함께 구현. 미정 항목은 Claude가 정함: 관리자가 계정마다 허용/해제(입장 파일 목록의 「메신저 허용」), 허용된 사람은 누구나 방을 만들고 허용된 사람을 초대, 한 방 30명·한 사람 20방·메시지 500자, 방마다 최근 1,000개 보관(나이로 지우지 않음), 마지막 사람이 나가면 방과 대화 삭제, 알림은 메신저 창 안의 안 읽은 수만.
- 서버(`server.js` `/api/messenger*`, `lib/messenger-store.js` JSON·PostgreSQL): 시작 화면의 계정 토큰(`X-Account-Token`)으로 매번 로그인·허용·방 회원을 확인(버튼 숨김에 기대지 않음), 허용 해제는 즉시 모든 요청 403. 메시지는 방마다 번호(`seq`, PostgreSQL은 방 행 `UPDATE … RETURNING`으로 동시에 보내도 안 겹침), 이름은 응답 때 현재 닉네임으로.
- 화면(`#accountMessengerBtn`·`#messengerDialog`, `app.js` `messenger`): 허용 계정만 버튼, 목록|대화 두 칸(휴대폰은 한 칸씩 ‹ 목록), 창이 열린 동안 대화 3초·목록 10초마다 새로 받음(시작 화면엔 실시간 연결 없음), 안 읽은 수는 이 기기에 본 번호 기준.
- 검증: `test/messenger.test.js` 저장소 JSON·PostgreSQL(동시 보내기 번호), API(허용 전 403·관리자만 허용·허용 안 된 사람 초대 거절·방 밖 404·해제 즉시 403·나가기), `tests/e2e/messenger.spec.js` PC·휴대폰(허용 안 된 계정 버튼 없음, 방 만들기→보내기→상대가 받음). 실제 휴대폰 미검증.

## v1.10.77 과일나무 전수 채집·카메라 튐·CI 포트 경합

- 과일나무(`public/plaza/island-terrain.js` `treeKind`): 나무 종류를 정하던 해시 규칙을 지형 파일 하나로 옮겨 화면(`island.js` `kindOf`)과 서버가 같이 씀. `harvestTrees()`는 기존 20그루 그대로 + 과일 종류 나무 중 접근 지점이 있고 다른 채집 나무와 5m 이상 떨어진 것(행사 간격 4m) = 27그루. 채집 대상이 아닌 과일 모양은 일반 둥근 나무로 그리고 일반 `nature.tree.fruit` 모델(계절 4×High/Low 8파일)은 삭제. `lib/island-events.js` 열매 슬롯 = 채집 나무 수, 재생 시간 = 나무 수×1분(시간당 60개 → 경제 시험 244,000P/h 유지).
- 카메라(`public/plaza/plaza-scene.js` `placeCamera`): 카메라 자리가 건물 충돌 원을 스치면 한 프레임에 7.5m 위로 튀던 것 → 0/1 판정을 `camOver`로 부드럽게 섞고(약 0.035 ease) 들어갈 때 0.6m·나올 때 1.8m 여유(왕복 깜박임 방지). 순간이동(`snap`)은 바로.
- CI 포트 경합(`test-support/free-port.js`): `listen(0)` 후 닫고 다시 여는 방식은 병렬 테스트 파일끼리 같은 포트를 받아 다른 서버에 붙음(omok-team 403 BAD_PASSWORD). 20000–29999를 임시 폴더 잠금 파일(`wx`, 30분 지나면 만료)로 하나씩 차지하고 지금 비었는지 확인. 서버 시험 30개 파일·`test-server.js`가 같이 씀.
- 검증: 섬 단위 79, 전체 `node --test` 819 통과(Windows 줄바꿈 전용 6개 제외, CI는 통과), 카메라·시점 e2e 4개. 실제 휴대폰·GPU 미검증.
