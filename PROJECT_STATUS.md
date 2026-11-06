# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.252 메신저 정리 — 섬 앱은 서랍, 알림은 메신저 앱

- 섬 앱 메신저 단추: 서랍(PC 오른쪽 380 px, 폰 아래 85 %)에 /messenger.html?embed=1(같은 출처만 틀), ✕·메신저 앱으로 열기, 읽으면 섬 단추 숫자 바로.
- 아이콘 숫자·제목 깜박임은 메신저 앱만. 푸시: 기기 kind phone|pc, PC는 연 지 12시간 안·TTL 600, 폰 TTL 86400, Topic 방마다, 열 때마다 구독 다시 등록.
- 주민세 첫 징수 시작 2분 뒤, 단위 서버 기다림 30 s, 마당 트로피 detach, 사람 창 트로피 줄 늦은 응답 막기.

## v1.10.251 기록의 탑 2 — 정산과 상

- 월요일 정산(solo_week:<주> 한 번, 서버가 켜질 때 밀린 주부터): 14종 보통 1·2·3위에게 마당 트로피(에셋 98, 금·은·동 재질·이름판 글·누르면 기록 한 줄·밤 빛)와 게임관 편지, 1위 칭호 14개(이름표 🏆), 3개 이상은 게임관의 별.
- 내 업적 탭(합계·트로피 수·내 최고·순위), 사람 창 🥇🥈🥉, 칭호 명예의 전당, 새 1위 리본과 섬 토스트, 판 글 해상도 2배.
- 기록의 탑 양면(글 면·전구를 뒷면에 복제, 뒷면 SPACE), 시상대 광장 쪽. Codex 10판 검토 8개.

## v1.10.250 기록의 탑 1 — 판과 순위

- 주간 기록(파일 soloWeek·PG solo_weekly), /api/solo/ranking·/api/solo/board, 결과 「이번 주 ○위」.
- 게임관 앞 기록의 탑(에셋 100): 글 면 셋 캔버스(6초마다 게임, 전광판, 명예의 칸), 전구 차례로, 깃발; 주민 길 격자에서 탑 자리 막힘.
- 「기록의 탑」 창: 게임·기간·난이도, 1~20위·내 순위, 도전하기.
