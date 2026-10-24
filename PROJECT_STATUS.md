# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.139 주민 길 격자를 서버에서

- 근거: v1.10.137(#283) CI 회귀 후속 — 「검토, 지적」 요청(2026-10-24): 화면이 격자를 만들지 않고 서버가 만든 것을 받기(PC·휴대폰 같게).
- 서버: `GET /api/island/npc-grid` — `IslandNpcs.packGrid()`(칸마다 2비트: 막힘·산책길, 267 × 267 = 17,823 B, gzip 4,407 B), 처음 한 번 만들어 메모리에, `ETag`(바이트의 sha1)·`Cache-Control: no-cache`(같으면 304). 로그인 필요 없음.
- 화면: 서버 섬(`GC_ISLAND_LIVE`)이면 섬이 뜰 때 받아 `IslandNpcs.useGrid`(이어진 부분만 계산, 약 10 ms). 받기 실패나 크기가 다르면(다른 지도: 관리자 미리보기) 전처럼 타이머로 만들기(3초 뒤 나머지 한 번에).
- 서버 격자 = 페이지와 같은 순서(island-train.js가 역·선로 나무를 먼저 비움)로 만든 격자(단위 시험으로 확인).
- 측정(섬이 뜬 뒤 주민 10명이 나오기까지, 두 번씩): 보통 PC 3.3~3.6초 → 1.0~1.1초, CPU 6배 느리게 14.7~16.2초 → 5.2~5.3초. 받는 시간 103~106 ms(6배: 8 ms, 캐시). 남은 시간은 주민 캐릭터 만들기(격자 10 ms, 바퀴 10개 48 ms).
- 시험: 단위 `island-npcs`(싸서 받은 화면도 같은 격자·같은 바퀴, 다른 크기 거절, API 304), e2e plaza 「배회 NPC」.
- Codex 검토 대기(10/25).

## v1.10.138 R4: 구치소 반성문

- 근거: gamecenter-notes `docs/backlog-dispatch-20261022.md` R4, 사용자 「구치소 진행」(2026-10-23).
- 관공서 옆 구치소(assets 67: 외관·실내·철창·문·책상·벤치·게시판·구치소장 `IslandCast` keeper `warden`), 문은 남쪽, 문 위 간판 「구치소」.
- 체납자(관리자·가입 첫날 제외)는 섬 방문 첫 자세에서 철창 안으로(`/api/plaza/state` `jail.inmate`); 그날 통과하면 다시 안 갇힘.
- 구치소장 말풍선 문장(20초 고리)을 섬 채팅으로 똑같이: 틀리거나 늦으면 「다시.」, 3문장(친한 사이 2) 통과로 철창 열림. 「지금 세금 내기」 다 내면 열림.
- 구경꾼은 철창 밖만(`clamp` 'free'), 오늘 통과 수; 오늘의 반성문 게시판은 구치소 안에서만. 방 앞벽은 잘라 내 문에서도 방이 보이게, 철창 문은 방 쪽으로 +100°.
- 시험: 서버 `island-jail`, e2e `island-jail`(PC·휴대폰).
- Codex 검토 대기(10/25).

## v1.10.137 R2·R3 주민 상호작용 + 문제 기록 3회차 1·18(곤충 크기·주민 길 멈춤·실내 하늘색)

- 근거: gamecenter-notes `docs/backlog-dispatch-20261022.md` R2·R3, `docs/issue-log-review-20261022.md` 1·18, #271 「못 고친 것」. 사용자 결정(2026-10-24, 같은 문서 끝 「합쳐 내」): 세 묶음을 PR 하나로.

### R2 먼저 말 걸기·기억·오늘의 이야기·단계 보상
- ① 아는 사이부터 곁을 지나면 머리 위 인사(함께한 일이 있으면 그 이야기 먼저), 친한 사이부터 인사 동작. 주민마다 10분에 한 번, 전체 20초에 한 번.
- ② 함께한 일(심부름·오늘의 이야기) 최근 3개를 계정 문서 `resmem`에 기억해 대사와 인사에.
- ④ 「이야기 나눠요」: 주민마다 하루 한 질문, 세 답 중 좋아하는 답 +2·보통 +1·싫어하는 답 0, 하루 한 번.
- 단계 보상(계정·주민마다 한 번, `lib/island-affinity.js`): 아는 사이 2,000P, 친한 사이 5,000P + 그 주민의 가구(가구 창고), 단짝 칭호 「<이름>의 단짝」. 친한 주민 심부름 110 %, 단짝 120 %(하루 3개 상한 그대로). 수치는 관리자 경제 값 표.
- 시험: 단위 `resident-affinity`, e2e `resident-greet`·`resident-talk`(PC·휴대폰).

### R3 주민의 하루·관계·선물·편지(집 방문 제외)
- ③ 시간대마다 다른 하루 길: 아침 항구 쪽, 낮 그대로, 저녁 정자·알림마루 쪽, 밤 마을 쪽(근처 70 m 멈춤 자리). 서버·화면이 같은 섬 시간대(관리자 고정 포함)로 같은 자리, 소문의 「보통 어디」도 그 시간대.
- ⑤ 관계표(친구·서먹한 사이): 서먹한 둘 사이 심부름을 끝내면 둘 다 호감도 +1과 화해 대사, 친구 사이면 한마디 더.
- ⑥ 선물: 하루 한 번 주민마다 가방의 물고기·곤충·섬에서 모은 것 하나(`GIFTABLE`) — 좋아함 +3·보통 +1·싫어함 0, 기억에 남음.
- ⑥ 편지: 친한 사이 이상 중 가장 가까운 주민이 하루 한 통 우체통에(답장 단추 없음). 보낸 사람은 이름 그대로(「님」 없이)와 작은 「· 주민」, 플레이어 편지는 그대로 「님」.
- 고침: 플레이어 편지 「답장」이 받는 사람을 고르지 않던 것(누르기 처리가 줄 끝 주석 안에 들어감).
- 시험: 단위 `resident-affinity`, e2e `resident-talk`(PC·휴대폰), `island-together` 우체통(플레이어 편지 답장 → 받는 사람 골라짐, 주민 편지는 「· 주민」·답장 없음).

### 3k 곤충 크기·주민 길 멈춤·실내 하늘색
- 1: 섬 곤충 12종 모두 가장 긴 쪽 0.3 m(사용자 10/23 「주먹의 1.5배」) — 등록부 scale = 0.3 / 만든 길이, 휘두르기·안내 거리 +0.15 m(`INSECT_HALF`). 집 곤충 상자 안은 상자(0.24 m)에 맞게 그대로.
- 주민 길 격자: 화면은 프레임마다 몇 줄씩(`buildGridSlice`), 급하면 남은 것을 한 번에; 이어진 부분 표시로 이어지지 않은 곳 사이는 찾지 않고 바로 없음 — 아침 주민 길 8.6초 → 0.25초, 길은 그대로.
- 18: 실내에 들어가면 하늘색 대신 검정이 바로(`setSpace`에서 빛 갱신, 5초 기다리지 않음).
- 시험: 단위 `island-npcs`·에셋 파이프라인(곤충 scale 범위), e2e `insect-size`.

- Codex 검토 대기(10/25).
