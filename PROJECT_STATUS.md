# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.152 창 3단계 — 가방·가게·관공서 창구·기부함·알림 쪽지

- 근거: gamecenter-notes `docs/dialogue-box-redesign-20261025.md` 「섬 공통 부품으로 넓히기」 3단계(사용자 「그렇게 해」), 검토 세션 검토·재검토 통과.
- 가방: 천 주머니 — 리넨 결 바탕, 안쪽 바느질 선, 칸은 바느질한 주머니.
- 가게(잡화점·가구점·펫샵·변신 펫 목록): 나무 선반 위 가격표 카드, 고르면 살짝 떠오름(동작 줄이기면 없음). 물건 하나면 창이 카드 높이이고 카드는 선반 한 단 위에 놓임. 변신 펫 목록은 1줄 이름 + 작은 「캐릭터」 이름표, 2줄 가격.
- 관공서 창구(민원·세금·예금·개명): 직원 말은 맨 위 말풍선(창구마다 한 줄), 창은 종이 서류 + 제목 옆 「접수」 도장 칸. 창구에서 열 때만, 닫으면 사라짐.
- 기부함: 나무 안내판(판자 줄, 종이 팻말 제목, 순위는 종이 쪽지, 입력·버튼은 종이 쪽지 위), 「이번 주 기부가 아직 없어요.」
- 섬의 알림: 화면 위에서 내려오는 테이프 붙은 쪽지(좁은 폰은 메뉴·미니맵 아래). 섬 밖 알림은 그대로.
- 잡화점 설명 섬 말투(미끼·포장지 「~써요」). 새 주황 버튼 #9c5f14(흰 글자 약 5:1).
- 밝은 테마: 가게 선반 판자는 그림이라 그대로(KEEP_DARK에 shopMode).
- 시험: `plaza` 민원 창구 말풍선 열림·닫힘, `general-store` shopMode, `pet-catalog` 이름·이름표·가격.

## v1.10.151 창 2단계 — 게시판·출석·우체통·안내 지도

- 근거: gamecenter-notes `docs/dialogue-box-redesign-20261025.md` 「섬 공통 부품으로 넓히기」 2단계(사용자 「그렇게 해」).
- 게시판(공지·잡초 게시판·칭호 명예의 전당): 나무 틀 코르크판에 종이 쪽지를 압정으로 꽂은 모습, 쪽지마다 살짝 기울어짐. 글자는 크림 종이 위 갈색 잉크(대비 유지).
- 출석: 섬의 출석 자리에서 도장 카드 — 이번 달 동그란 칸(요일 맞춤), 출석한 날 「참 잘했어요」 도장, 오늘 칸에서 출석하면 도장이 찍히는 움직임(동작 줄이기면 없음). 새 API `GET /api/points/attendance/month`(이번 달 출석한 날·오늘·달 길이·첫 요일, 두 저장소 모두 `attendanceDays`). 시작 화면 출석 단추는 그대로.
- 우체통: 받은 편지는 줄 그어진 편지지, 편지 쓰는 칸도 편지지.
- 안내 지도: 접힌 종이 지도(종이 결 가장자리·접힌 금).
- 밝은 테마: 게시판 나무 틀·압정은 그림이라 그대로(tools/theme-light KEEP_DARK).
- 시험: 새 단위 `attendance-card`, 새 e2e `attendance-card`(PC·폰: 칸 수, 오늘, 도장, 포인트 한 번, 화면 안), `plaza` 출석은 카드에서.

## v1.10.150 동산 다듬기

- 근거: gamecenter-notes `docs/terrain-paint-design-20261025.md` 3(사용자 「진행해」 — 높이 그림 파일 대신 ground() 식에 모양 함수 목록).
- `dalmaru-terrain.js` `BRUSHES`: 층진 언덕(82, −58), 둔덕(50, −22)·(138, 34), 움푹한 곳(−126, 70), 절벽 턱(−86, −58). 대청마당·툇마루섬·건물 자리 평탄화는 그 뒤 그대로, 서버·화면 같은 코드.
- 모양은 빈 땅에만 — 문·계단·다리·집터 높이는 바뀌지 않음(오차 0). 땅 지도는 새 높이로 다시 만듦.
- 층진 언덕은 평평한 단 둘 + 풀 둑(가장 가파른 곳 0.83 — 걸을 수 있는 0.9 아래), 절벽 턱 2.4 m, 둑은 풀만(동물의 숲처럼), 비탈 면은 살짝 그늘.
- 나무·꽃·덤불·잡초는 모양 전의 땅으로 골라 자리·크기·종류가 그대로(나무 418 중 410, 새 둑 위 8그루만 빠짐; 열매 나무 38곳 중 37곳 같음), 거울호수·강·연못엔 파도 없음(바다와 이어진 물만).
- 시험: 새 단위 `terrain-brushes`(모양마다 길·문·집·계단 양 끝·다리 양 끝·집터·강·폭포 연못·바닷가와 안 겹침, 비탈 0.85 이하, 둔덕이 실제로 솟음), `ground-maps`.
