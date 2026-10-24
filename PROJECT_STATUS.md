# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

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

## v1.10.144 R8 내 집 4단계 2층 큰 집

- 근거: gamecenter-notes `docs/backlog-dispatch-20261022.md` R8, assets 58(4단계). 경제 값 `home:price_4` 200,000P는 기본값으로 승인됨.
- 관공서에서 집 넓히기 한 번 더(3 → 4단계, 다음 날 완성). 외관 `manor2` 4색(High 17,357 / Low 8,599 삼각형, 예산 예외 20,000 / 9,000).
- 1층: 큰 집 방 + 앞 왼쪽 실내 계단(`stairs_in` 오크·월넛, 바닥 색에 맞춤), 가구 70·물고기 40. 계단 발치에서 SPACE(폰 상호작용)로 2층.
- 2층: 따로 떨어진 방(`upper_room`, `_s4` 바닥·벽지, 16×13, 계단 구멍 비움, 창가 의자), 가구 50. 구멍 옆에서 1층으로. 나가기는 1층에서만(2층에서는 `UPSTAIRS`).
- 가구는 층마다: 2층에 놓으면 `floor: 2`, 1층에는 안 보임. 손님도 2층에 가고, 같은 층 사람만 보임(presence `home` = `<집터>:2`).
- 새 API `POST /api/home/stairs`. 들어갈 때 1층부터. 섬을 떠나면 층 기억 지움.
- 시험: 단위 `island-home`(TOP_STAGE 4, 층마다 가구·자리·막힌 곳), e2e `my-home` 「2층 큰 집(R8)」(계단 오르내리기·층마다 가구·1층에서만 나감·손님 같은 층), 방문 허용 검사를 4단계까지.
