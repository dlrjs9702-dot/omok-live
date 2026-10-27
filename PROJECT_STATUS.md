# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.189 스툴·방석 방향 고르기

- 등받이 없는 스툴·방석에는 앉기 직전 바라보던 방향(45° 단위)으로 앉아요 — 전에는 늘 가구 앞쪽만 봤어요.
- 앉은 채 ←/→로 45°씩 돌아요(↑/↓는 일어나기). 폰은 앉아 있는 동안 걷기 단추 위에 ↺ ↻ 단추가 나와요.
- 다른 사람 화면에도 같은 방향으로 보여요.
- 소파·의자·벤치는 그대로 앞을 봐요.

## v1.10.188 반려동물·앉기 고침

- 접속하거나 업데이트된 뒤 반려동물이 안 보이던 문제를 고쳤어요 — 펫샵에서 데려온 메타몽·변신 친구는 다시 골라야 보였는데, 이제 늘 그대로 따라다녀요.
- 반려동물이 잠깐씩 사라졌다 나타나던 깜빡임도 줄였어요.
- 의자·벤치에 앉아서 채팅하거나 창을 열어도 일어나지 않아요. 일어나기는 방향키·조이스틱으로.
- (시험) 단위 시험 하나가 실패하면 CI가 45분 멈추던 것을 막았어요 — 실패는 바로 실패로.

## v1.10.187 할리갈리·숫자야구·빙고, 판 아래에서

- 할리갈리: 「카드 뒤집기」가 판 아래 가운데에 크게, 종도 커졌어요. 폰에선 종이 카드 아래 가운데에 있고, 터치 기기에선 「종을 눌러 치세요」.
- 숫자야구: 추측 칸이 기록 위로 — PC에서도 바로 보여요.
- 빙고: 판 중엔 판 크기·숫자 범위·승리 조건 줄을 접고, 「선택된 숫자·현재 빙고」를 한 줄로.
- 오목·사목은 돌이 판에 닿는 순간 「탁」, 오델로는 뒤집힐 때마다 「착」 소리가 나요.
