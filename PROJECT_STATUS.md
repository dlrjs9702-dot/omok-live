# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.140 R5: 윷 말 스킨 「밤장난 꼬마 마녀」·방 테마 「한밤의 마녀 윷판」

- 근거: gamecenter-notes `docs/yut-skin-night-imp-order-20261012.md`(사용자 2026-10-12 결정), `docs/backlog-dispatch-20261022.md` R5, 사용자 「R8까지」(2026-10-25).
- `lib/skins.js` CATALOG.yut 끝에 덧붙임: 고급 `yut_p7` 「밤장난 꼬마 마녀」(200,000P), 방 테마 `yut_t4` 「한밤의 마녀 윷판」(300,000P, 전설 짝 없음). 주문서 때의 고급 3·테마 2는 v1.10.90 스킨 2배로 6·3이 되어 일곱 번째·네 번째로.
- `public/skin-art-yut.js`: `witch`(팀 색 몸통·번호 판, 꺾인 마녀 모자와 팀 색 밝은 띠·초승달, 앞머리, 반쯤 감은 눈·송곳니 하나·분홍 볼 — 번호 판에 가리지 않게 얼굴은 위로, 박쥐 날개 망토 끝, 발치 별), `batTrail`(박쥐·별), `midnight`(밤하늘 남보라·초승달·별, 판 아래 띠에 마녀 모자·빗자루 실루엣, 칸은 보라 빛 돌).
- 쿠로미 특징(광대 두건·해골·긴 토끼 귀·화살촉 꼬리·흰 얼굴+검정+분홍 배색) 없음, 이름·설명에 다른 회사 캐릭터 이름 없음.
- 시험: 단위 `skins`(윷 고급 7·테마 4, 새 테마는 짝 없음).
- Codex 검토 대기.

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
