# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.199 팬데믹 공통 틀 + 파티 작은 고침 3

- 팬데믹: 판 중 자리 카드 비킴, 지도 위 얼굴 이름표 한 줄(역할·손패·차례), 확산·감염률·치료제 늘 보임 / 더미·버림·큐브 「더미 N · 큐브」 접힘, 치료 right·확산 wrong 소리.
- 폰 팬데믹: 지도 55dvh, 보기를 칸 모양에 맞춤(세로 칸은 전체 높이·옆으로 이동), 처음엔 내 말 도시 가운데, 작은 지도 폭 25% 오른쪽 위, 카드 띠 지도 아래, 시작 칸 sticky. PC 도시 이름 겹침 9곳 옮김.
- 파티: 스무고개 카테고리 작은 표, 폰 쪽지는 라운드 줄 아래(쪽지 띄울 때 잼, .boardCard blur 기준 빼기), 폰 답 단추 한 줄, 폰 라이어 투표 칸 sticky.
- server.js 옛 주석 8곳 실제 버전으로, 출시 때는 /health·listen 두 줄만.

## v1.10.198 C5 Codex 4차 고침

- P2-1 공지 날짜: v1.10.95~197 publishedAt을 main 병합 시각(UTC, package.json이 그 버전이 된 커밋)으로, 같으면 +1분. 그 앞 v1.10.77~94는 v95보다 늦은 것만 실제 병합 시각(없으면 다음 것 -1분)으로. 앞으로 새 공지는 실제 시각.
- P2-2 가방 폰 꾹: 든 칸의 손 뗌 click 무시, 다시 그려도 든 칸 유지. e2e는 실제 순서(pointerdown → 0.4초 → pointerup → click → 다른 칸).
- P3: 요리 대회 차감 중 예외도 giveBack, errand/drop은 await 뒤에 단계 읽기, point-store 모든 bagView에 계정 칸 수(slotsOf), moveBagSlot 최신 응답만, 행사 창 draw는 차례 검사 뒤 반영, 메신저 말풍선 메뉴는 연 방에 묶고 방 바꾸면 닫힘.

## v1.10.197 파티 공통 틀 — 그림 맞히기·라이어·스무고개

- tableGameRoom·tableGamePlaying에 세 게임(+ partyGame): 판 중 자리 카드 비킴, 점수는 한 줄 얼굴 이름표(차례 노란 테두리), 입력 줄 판 아래 sticky(safe-area), 토스트·쪽지는 위 띠 아래(--roomBarBottom), 맞힘·틀림 소리(그림 roundAwards, 라이어 결과 내 편, 스무고개 guessHistory).
- 그림: 그림판 높이 맞춤 폭(3:2 그대로), 판 머리 한 줄(라운드·카테고리·시간, 「○○님이 그리는 중」은 띠에만), 제시어+도구 한 줄, 타이머 줄바꿈 없음.
- 라이어: 이름표 고르기 → 「○○님 지목」 확인, 판 수 고르기 판 중 숨김, 점수 이름표 줄은 제시어 바로 아래.
- 스무고개: 머리 「? 스무고개」·차례 상자 숨김, 내 정답은 작은 쪽지, 입력 하나 + 「질문」·「정답」, 출제자 예/아니오/비슷함/애매함 판 아래 엄지 자리.
- e2e party-table(PC·폰, 3명).
