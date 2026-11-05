# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.250 기록의 탑 1 — 판과 순위

- 주간 기록(파일 soloWeek·PG solo_weekly), /api/solo/ranking·/api/solo/board, 결과 「이번 주 ○위」.
- 게임관 앞 기록의 탑(에셋 100): 글 면 셋 캔버스(6초마다 게임, 전광판, 명예의 칸), 전구 차례로, 깃발; 주민 길 격자에서 탑 자리 막힘.
- 「기록의 탑」 창: 게임·기간·난이도, 1~20위·내 순위, 도전하기.

## v1.10.249 게임관 G4 혼자

- 지뢰찾기를 한판마당 퍼즐 화면으로(서버 판 그대로, HUD 시간·남은 지뢰, 열기/깃발·오른쪽 클릭, 시트 난이도, 결과 패널, 폰 고급은 돌려서 16×30). 옛 창 제거.
- 두 세계 영웅전 나가기 ✕ 40px.
- 숫자야구 빈 기록 글 밝게, 폰 HUD 단추 40px.

## v1.10.248 게임관 G3 파티·추리 5

- 라이어·그림·스무고개 입력줄 50px 한 줄, HUD 큰 글(라이어 제시어/「?」, 그림 제시어, 스무고개 n/20), 그림 도구 40px 알약 + 색 5원.
- 숫자야구 54px 숫자 패드·기록표(최신 아래)·「내 숫자」 알약, 스무고개 시작 전 시트 양식, 팬데믹 차례 알약, 할리갈리 3명 이상 종 둘레 배치.
- 펠트·칠판·그림판 안 글자는 두 테마 모두 밝게, 폰 HUD 큰 글은 알약과 안 겹침.
- 검토 #397 시험 고침(island-projects, story-17).
