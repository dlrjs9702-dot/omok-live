# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.147 메신저 단독 창(B안)

- 근거: gamecenter-notes `docs/messenger-standalone-20261025.md`(사용자 「B로 진행하고 대화창 다음에 넣어」).
- ① `/messenger` 전용 페이지(`public/messenger.html`·`messenger.js`·`messenger.css`): 게임 코드 없음, 크롬 전용 관문 없음(아이폰 Safari 홈 화면 앱도). 방·1:1·고정·알림 끄기·삭제·안 읽은 사람 수는 그대로 옮김. 섬 공통 부품(크림 종이) 색.
- ② 앱으로 설치: `messenger.webmanifest`(id·scope `/messenger`, 「아일랜드 메신저」, 전용 아이콘) → 게임 앱과 따로 설치되는 독립 창. 설치 단추(`beforeinstallprompt`), 아이폰은 「홈 화면에 추가」 안내.
- ③ Web Push: `lib/web-push.js`(node crypto로 RFC 8291 aes128gcm + VAPID ES256, 추가 패키지 없음, RFC 부록 A 예와 바이트까지 같음). 환경 변수 `VAPID_PUBLIC_KEY`·`VAPID_PRIVATE_KEY`·`VAPID_SUBJECT`가 없으면 알림 단추가 안 나옴. 받는 사람 = 방의 다른 사람 중 알림 끈 사람·지금 메신저를 열어 둔 사람(스트림) 빼고. 알림은 「로그인 유지」 기기에서만 켬. 끊긴 구독(404·410) 정리. `messenger-sw.js`(scope `/messenger`)가 알림·앱 아이콘 안 읽은 수, 누르면 그 방.
- ④ 이 기기에서 로그인 유지: 기기 토큰 60일(해시로 저장, `worldValue messengerDevices`, 계정당 10대), 메신저 API만 됨. 비밀번호 변경·관리자 「메신저 해제」·그 기기 로그아웃이면 끝, 「로그인된 기기」 목록·끊기.
- ⑤ 게임 안에서: 내 계정·섬 화면의 메신저 단추(안 읽은 수) → 같은 창을 앞으로(새 창이면 이 탭의 로그인을 가져감). 섬 안 작은 알림은 그대로. 내 계정의 메신저 창(dialog)은 없앰.
- 서버가 잠들어 있으면 첫 요청 2.5초 넘을 때 「서버를 깨우는 중」 표시.
- 시험: 단위 `web-push`(RFC 예, 받는 기기 키로 풀림, VAPID 서명, 받는 사람), 새 `messenger-device`(기기 토큰은 메신저만, 끝나는 경우 셋, 알림 받는 사람·열어 둔 사람·알림 끈 사람, 구독은 기기와 같이), e2e `messenger`(로그인 유지·새로고침, 내 계정에서 같은 창, 안 읽은 수, 주고받기, 1:1·나가기 경고, 로그아웃, PC·폰).

## v1.10.146 대화창 새 단장 1단계

- 근거: gamecenter-notes `docs/dialogue-box-redesign-20261025.md`(사용자 「추천대로 진행해」, 섬 공통 부품 「그렇게 해」).
- 섬 공통 부품: CSS 변수 `--isle-paper #FFF6E3`·`--isle-ink #5A4632`·`--isle-line #D9C3A0`, `.isle-paper`·`.isle-tag`·`.isle-choice`. 대화창이 이걸로 만들어짐(2·3단계 게시판·창들이 같이 씀).
- 말풍선: 크림색 바탕, 둥근 모서리, 연한 갈색 테두리, 위로 꼬리, 바깥 살짝 어둡게. 이름표는 왼쪽 위 알약 — 배회 주민 10명 저마다 색(`IslandCast` `tagColor`, 흰 글자 4.5:1 이상).
- 대사는 한 글자씩(초당 약 40자, 지난 시간 기준이라 느린 화면도 같은 빠르기). 누르기·Space·Enter는 그 줄을 다 보임, 다음 누르기는 다음 줄(▼ 깜빡). 동작 줄이기면 바로 다 보임.
- 선택지는 대사가 다 나온 뒤 말풍선 오른쪽 위 작은 풍선에 최대 4개: 이야기해요(→ 요즘 어때요·섬 소문·이야기 나눠요·돌아가기)·부탁할 거 있어요?·선물해요·잘 가요. 오늘 할 수 없는 것은 숨김 — 서버가 응답마다 `today: { asked, gifted, errand }`를 보냄(부탁은 그 주민과 오늘 심부름이 있을 때만). 숫자키·방향키·Enter·Esc 그대로, 줄 높이 44px.
- 호감도는 대사 아래 작은 줄(꿀색 하트).
- 같은 말풍선: 분실물 주인·잡화점 주인·연계 퀘스트 주민·다른 사람 메뉴·안내 주민·시장, 이번에 구치소장 안내도 말풍선으로.
- 시험: e2e `resident-talk`(한 글자씩 → Space로 다 보기 → 4개 이하 → 이야기해요 하위 → 돌아가기, 오늘 이야기·선물 뒤 숨김, 두 풍선 화면 안·안 겹침, PC·폰), `plaza` 말풍선, `island-jail`.

## v1.10.145 거리 악단 자리

- 근거: 사용자 지적 2026-10-25 「거리 악단이 너무 뜬금없이 있어」 — 무대가 물가 거리 안쪽 빈 풀밭 한가운데, 길에서 떨어져 있었음.
- 물가 거리 땅 쪽, 배 타는 곳 길 갈림 서쪽(266.5°)에 둥근 포장 자리(지름 6 m, 마을 길 원판 1.2배)를 만들어 걷는 길에 바로 닿게 함. 자리 좌표는 `PL.busk` 한 곳(땅에 칠하는 길 연결망의 「버스킹 자리」 점).
- 무대는 뒤가 땅 쪽, 앞이 바다 쪽. 거리 악단은 무대 앞, 무대를 향한 벤치 2개(`bench_waterfront`), 옆 가로등(`lamp_waterfront`), 무대 위 악보 받침, 뒤 모서리 꽃. 이번 주 도움을 받았으면 음표가 떠오름(동작 줄이기면 없음, 60 m 안에서만).
- 무대까지 가던 오솔길은 지움. 퀘스트 「무대 앞에서 공연 듣기」는 무대 4.5 m 안 그대로(벤치 자리 포함).
- 시험: 단위 `dalmaru-paths`(길 연결·배치 1 m 간격), `island-npcs`(서버 주민 격자 = 화면 격자), e2e `dalmaru-walk`(보이는 것 = 막는 것, 뜬 것·묻힌 것 0, 모두 걸어서 닿음), `island-solids`.
