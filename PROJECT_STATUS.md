# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.206 구경 C안 + 도구 들기 규칙

- 구경 C안: 열한 곳 모두 그 자리의 작은 할 일(걸어 들어가기만으론 안 끝남). 꽃 색 찾기(물은 색은 카드에도)·쓰러진 허수아비 세우기·벽화 차례로·다음 열차 분(±1)·부두 배웅(sea.boat 천천히)·박자 박수 3·가로등 잡기·징검돌 건너기·책 수레 책·큰 호박 세 번·사탕 바구니 → 꽃님 댁 문. lib/island-quests TASK·drawPick·visitAct, 서버 /api/island/visit, 고르기 답은 받을 때 doc에(트랙엔 보기만), 타이밍은 화면 판단·서버는 시작 뒤 시간·자리. 옛 count 1 인정.
- 도구 들기 규칙: 낚싯대를 들어야 낚시(아니면 안내), 든 동안 잡초·열매·앉기 안 됨(「도구를 넣으면 주울/앉을 수 있어요」, 깜빡임 고침), 주민·문은 됨.
- 메신저 제목 깜빡임 Illegal invocation(감싼 기본 타이머). 시험 도우미 revealTalk.
- e2e island-visit-tasks·island-tool-rules(PC·폰), solo-quest 갱신. 사진 notes img/q2-visit.

## v1.10.205 Q2 앞 묶음

- 대화 창 저절로 닫힘(섬 이야기 e2e CI #349·#350 원인): 붙잡기 임대가 끝나거나 늦은 작별이 풀어도 곁이면 keep·topic이 다시 붙잡음, 끝은 busy·far일 때만 까닭 글과 함께. 도구 휘두르기는 누를 때 겨눈 주민 한 발 여유. playwright actionTimeout.
- 관광객 사진 부탁 B안: 방문객이 기념사진 명소 안(photoPlace)에 섬, 말 걸기 → 포즈, 사진 모드 셔터(관광객이 틀 안·12 m) → 서버 asked·2초·같은 명소·12 m → 6,000P.
- 할 일 카드 넷 이상이면 「+n개 더 · 전체 보기」 종이 칩 → 「내 할 일」 창(이야기·주민 부탁·심부름, 창에서 그만두기). 화면의 주민은 이름만(누리).
- 섬 채팅 단추: 새 채팅은 색만(점 없음, 폭 그대로).
- 해안 쓰레기 여덟 중 둘은 늘 윤슬만 가운데 해변.
- e2e island-photo-request·island-quest-list·resident-talk-gone(PC·폰). 사진 notes img/q2-interact.

## v1.10.204 X2 크리스마스 행사

- island-calendar christmas-2026(12/19~25): 선물 배달 1×3, 눈사람 3×1, 성탄 저녁 모임 6(12/25 18~22시 광장 트리 9 m), 대회 1 — 7일 다 하면 도장 50 / 가판대 37(트리 8·벽난로 8·스노볼 4·양말 걸이 3·과자 집 4·칭호 「메리 크리스마스」 10). PLACES tree·GATHER_R·snow(−18, −99, 10×7).
- lib/island-festival: 선물 takeGift/giveGift(받을 주민·포장 doc, IslandNpcs.walking() 하나), 눈사람 rollStart/rollEnd/finishSnowman(크기는 서버 자기 시계 0.35~1.1 m, roll 자리에서 3 m 넘게 움직여야, 꾸밈 하나 이상), award가 doc의 다른 값을 지킴.
- 화면: 가판대 덧씌움·선물 자루·산타 차림 행사 주민, 눈밭(눈 한 겹·팻말·지도), 굴리는 눈덩이, 꾸미기 창(빈 채로 시작·종이 칩), 그날 눈사람 최근 12개(남의 것 Low), 주민 대화의 선물 건네기, 행사마다 장식·탭 종이색.
- 섬 채팅 입력줄: 채팅 창이 닫혀 있으면 아래 가운데(창을 따라가는 건 열려 있을 때만).
- e2e island-xmas-festival(PC·폰), festival-server 크리스마스. 사진 notes img/xmas-festival-game.
