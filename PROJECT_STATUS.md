# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.243 게임관 UI 통일 U1

- 한판마당 토큰 --hp-*(어두운 :root, 밝은 :root[data-theme=light] 크림·민트·갈색), 고르는 곳은 「게임관 화면:」 라디오(총괄 답 B).
- 단추 셋 .hpBtn(.go·.cta)·.hpPill·.hpX, 게임관·시트·결과에 씀(게임방은 U2).
- 시트가 하나뿐인 시작 화면: 난이도·옵션 알약·내 최고, 시작 = 바로 판(reflexMenu는 옛 로비만).

## v1.10.242 주민 날마다 말 + 가락 대회 말

- 1 lib/island-daily.js: 27명 × 10상황 × 2줄(총괄 글 묶음 확정본). 차례 내 일(대어 10분·새 집·트로피·오랜만 3일, 그날 그 주민 한 번) → 대회 → 눈(겨울 구역 비) → 계절(선 구역), 2~4는 35%. 조사 slot(), 같은 줄 연달아 안 나옴.
- 2 public/plaza/contest-lines.js: 가락 종목별 전·중·후·참가 부족, 시상 1·2·3위 차례, 내일 대회(실제 시각), 참가 한 줄.
- docs/release.md 12단계: 출시 확인 → 같은 턴에서 다음 묶음.

## v1.10.241 대회 천막 교체 + 매일 14시 대회 + Codex 10판 고침

- 1 에셋 100: contest_tent(깃발 flag_L·R 흔들림, 밤 glow, keepNodes)·contest_sign(sign_plate에 종목 글씨, 광장 쪽). 가락은 모델 keeper 자리.
- 2 섬 대회 매일 14:00(서울) 30분, 종목 9개 날마다 차례(dayContest, contest_d<day>). 천막 13:50~15:00, 0시 넘김 포함 끝+30분까지 유지. 관리자는 시각·길이 + 아직 시작 안 한 대회 종목만(지난·진행 중 400). 대회 없을 때 띠 「내일 14:00 · ○○ 대회」.
- 3 Codex 10판: guideTargetOf 줄 가운데 // 고침, 1인칭 손에 폭죽·비눗방울, quickSave 두 번 실패 시 서버가 받은 칸으로, loadQuick 늦은 응답이 바꾼 칸을 덮지 않음, settleContest 종목 확인.
