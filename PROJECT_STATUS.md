# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.144 R8 내 집 4단계 2층 큰 집

- 근거: gamecenter-notes `docs/backlog-dispatch-20261022.md` R8, assets 58(4단계). 경제 값 `home:price_4` 200,000P는 기본값으로 승인됨.
- 관공서에서 집 넓히기 한 번 더(3 → 4단계, 다음 날 완성). 외관 `manor2` 4색(High 17,357 / Low 8,599 삼각형, 예산 예외 20,000 / 9,000).
- 1층: 큰 집 방 + 앞 왼쪽 실내 계단(`stairs_in` 오크·월넛, 바닥 색에 맞춤), 가구 70·물고기 40. 계단 발치에서 SPACE(폰 상호작용)로 2층.
- 2층: 따로 떨어진 방(`upper_room`, `_s4` 바닥·벽지, 16×13, 계단 구멍 비움, 창가 의자), 가구 50. 구멍 옆에서 1층으로. 나가기는 1층에서만(2층에서는 `UPSTAIRS`).
- 가구는 층마다: 2층에 놓으면 `floor: 2`, 1층에는 안 보임. 손님도 2층에 가고, 같은 층 사람만 보임(presence `home` = `<집터>:2`).
- 새 API `POST /api/home/stairs`. 들어갈 때 1층부터. 섬을 떠나면 층 기억 지움.
- 시험: 단위 `island-home`(TOP_STAGE 4, 층마다 가구·자리·막힌 곳), e2e `my-home` 「2층 큰 집(R8)」(계단 오르내리기·층마다 가구·1층에서만 나감·손님 같은 층), 방문 허용 검사를 4단계까지.

## v1.10.143 Codex 검토 묶음(v1.10.113~138 서버·lib·app)

- 근거: gamecenter-notes `docs/codex-review-20261025.md`「1부」(서버·lib·app)·「2부」(화면 3D) — P1 없음.
- 1 낚시 화살표: 서버가 던질 때 화살표 12개를 정하고(물고기 등급만큼 앞에서부터), 당길 때 누른 순서·시각을 받아 다시 둬 봄 — 순서대로 다 못 누르면 「FISH_WRONG」, 시간을 넘기면 「FISH_LATE」, 틀린 것 사이는 흔들림만. 화면은 서버 화살표를 보여 주고 누른 것을 모두 보냄.
- 2 곤충 동시 잡기: 확인 직후 곤충을 선점하고(가방 넣기 전), 못 넣으면 되돌림 — 두 계정이 같은 곤충을 동시에 잡으면 한쪽만.
- 3 10분 배치 경계: 지난 배치에서 시작해 늦게 끝난 요청은 곤충 상태를 바꾸지 않음(새 배치의 잡힌 곤충이 되살아나지 않음).
- 4 위치 받기: await(구치소 판정·자전거) 뒤 섬을 떠났으면 위치·구치소를 등록하지 않음.
- 5 호감도 단계 보상: 점수가 바뀐 주민은 닿은 단계를 모두 다시 확인 — 포인트는 받았는데 가구 저장이 실패했으면 다음 번에 채움(각각 한 번).
- 6 반성문 호감도: 해당 없음 — 구치소장은 배회 주민이 아니라 단계 보상 대상이 아님.
- 7 오늘의 이야기·선물: 그날 표시를 먼저 하고(동시 두 번 막기), 호감도·아이템이 실패하면 표시를 되돌림(기회를 잃지 않음). 아이템이 빠진 뒤 호감도만 실패한 경우만 아이템을 잃고, 다시 줄 기회는 돌아옴.
- 8 달리기·자전거: 서버가 위치(보낸 사람 시계 기준 속도)로 판정 — 걷는 중 5.2 m/s(걷기 4.2 · 달리기 6.2) 넘거나 자전거면 곤충이 날아감(모두에게서).
- 9 가구 옮기기 저장: 한 번에 하나씩 순서대로, 보내는 동안은 조각마다 마지막 위치만.
- P3: 사진 링크 서명 키 처음 만들기를 하나로, 주민 편지는 계정·하루에 한 통, 반성문 늦은 응답은 통과·납부·퇴장 뒤 무시. `refreshHomes` 겹친 갱신은 이미 마지막 요청만 반영해서 해당 없음.
- 10 통째 캐릭터의 Low 파일이 안 받아지면 High만으로 나옴(전에는 둘 다 안 나옴).
- 11 가구를 살짝 밀고 놓아 칸 맞춤이 원래 자리면 모델도 원래 자리로, 저장은 안 함.
- 12 반성문 문장 고르기: 잘못된 날짜·문장 수보다 큰 개수에도 끝남(반복 상한).
- 13 가림 검사는 그려진 인스턴스 수(`mesh.count`)만 돎.
- P3(화면): 동상 명판의 재질·글자 텍스처 해제(동상 캐릭터는 자산 캐시라 그대로), 주민 맞음 반응 타이머는 세대 번호로(두 번째가 먼저 풀리지 않음), 가구 잡은 채 Ctrl+R은 새로고침, 섬을 떠나면 주민 길 격자 타이머 멈춤.
- 단위 시험 `syntax`: server.js·lib·public의 모든 .js(178개)가 읽히는지(스크립트 vm.Script, ES 모듈 .mjs 복사본 `node --check`, 약 7초). 이 묶음에서 줄 가운데 `//`로 문법이 깨진 걸 커밋했다가 고쳤고, 그 판에서 이 시험이 실패하는 것 확인.
- 시험: 단위 `island-fishing`(틀린 방향·하나 덜·시간 초과·흔들림 하나), 새 `insect-catch-race`(네 곤충을 두 계정이 두 번씩 동시에 → 곤충마다 한 사람, 달려가면 날아감), e2e 낚시·곤충·구치소·우체통·가구 옮기기.

## v1.10.142 R7: 순발력 게임 「하늘 계단」

- 근거: gamecenter-notes IDEAS #future-stair-dash, `docs/backlog-dispatch-20261022.md` R7, 사용자 결정(2026-10-25, 그림 보고): 이름 「하늘 계단」, 보상 1,500·2,500·4,000P, 숨 빠르기 그대로.
- `public/reflex/js/games/stairs.js`: 두 버튼(왼쪽 위·오른쪽 위; PC ← → / A D, 휴대폰 화면 반쪽), 반대쪽은 헛디딤, 숨 막대(보통: 처음 초당 0.17 + 한 칸마다 0.0009씩 빨라짐, 한 칸 +0.065, 40칸마다 꽃 발판 +0.3), 난이도별 방향 바뀜 길이, 높이 따라 하늘 낮 → 노을 → 밤. PC는 카드·퍼즐처럼 넓은 틀(1,200px).
- 서버: 순발력 게임 틀(`lib/reflex.js` stairs — 30계단부터, 계단 수 × 0.1초보다 짧은 판은 지급 안 함, 5,000 넘는 기록 거절), 보상은 경제 값 `solo:stairs:easy/normal/hard`(1,500·2,500·4,000P), 순발력 하루 20,000P 함께. `/api/solo/reflex`가 `gamePoints.stairs`로 화면에 값 표시.
- 시험: 단위 `reflex-server`(빠름·지급·너무 적음·범위 밖), e2e `reflex` 「하늘 계단」(PC·휴대폰 35계단 → 헛디딤 → +2,500P), 순발력 목록 여섯.
- Codex 검토 대기.
