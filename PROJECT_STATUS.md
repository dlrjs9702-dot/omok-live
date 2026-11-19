# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.372 Codex 361~370 검토 고침 (notes docs/codex-review-361-370.md, 19건 모두 맞음)

- P1: #1 수조 물고기 길이(islandUse가 꺼낸 크기를 claim과 함께, 수조 size, 꺼낼 때 meta.size), #2 벼룩시장 「산 것」 이어받기(fleaHandOver·가방 여유), #3 주민 부탁 단계는 지급 뒤에만, #4 재료 사기 같은 주문 번호 유지, #5 옛 별 선물 기록 못 읽으면 보류, #6 starsFragmentFrom 읽기 오류는 덮어쓰지 않음, #7 소원 때 반짝이 확률 저장(stars.pct), #8 빗맞힘 하루 횟수 먼저, #9 이미 나간 바위 칸은 지나감.
- P2: #10 stocks/watch stockMarket, #11 골라 팔기 상한 PICK_MAX 464, #12 잡화점 재료 단가 상한 1천만, #13 섞인 수조 잠금(tankMixed), #14 판매 행사 추가액을 행사에 저장(paid), #15 건너뛴 SSE 연결에 최신 한 건, #16 별마루섬 열린 칸 표 20 ms 조각(isle2OpenWarm), #17 세로 화면 전체 지도 min(w/760, h/585).
- P3: #18 채집 3배 응답 수량, #19 capture --only가 spots.json에 덧붙임.

## v1.10.371 N1b §3 숲의 빛·공기

- public/plaza/forest-air.js: 숲 정도(island.isle2Wood, 12 m 둘레 9점의 숲속·오솔길 몫)를 1.5초(벽시계)로 따라감. 빛: 하늘빛을 초록 쪽 30 %, 밝기 −20 %, 해 −35 %, 안개 색 숲빛 60 %, 안개 175 → 90 m·70 → 18 m(바탕 빛은 setIsland가 정하고 그 위에 woodLight).
- 햇살 줄기 10개(교차 평면 한 묶음, 12 m 칸 해시 자리라 걸어도 그대로, 해 방향으로 기울기, 낮만), 떨어지는 잎 24/40/64(계절 색, 겨울·움직임 줄이기 없음), 밤 반딧불이 16/28/40(각자 깜빡임). 숲 밖에서는 그리기 0, 오솔길 터널 PC High 398 → 403 draws.
- 소리(WebAudio, RoomSound 켬일 때만, 화면 숨김 끔, 사진 모드 끔): 바람(필터 노이즈), 개울(creekDist 28 m 안), 낮 새소리·밤 풀벌레.
- 부팅 무게: lineDist 16구간 상자 건너뛰기(같은 값) -- nature() 2.18 → 1.92 s(로컬). CI 러너 ubuntu-24.04 고정(26.04는 Playwright 글꼴 패키지 없음).

## v1.10.370 전체 지도(M) + 개수 칸 + 택시 이유 + 369 뒷일

- 전체 지도(사용자 「M 으로 전체 지도 펼칠 수 있게. 확대해서 볼 수도 있게.」): M 열고 닫기(입력 칸·건물·게임 방·다른 창에서는 안 함, Esc 닫기), 미니맵 누르면 열림(전에는 눌리지 않았음 → 충돌 없음), public/map-view.js 범위 = 그려진 세계 x −230~530·z −200~385(별마루섬까지), 열 때 내 자리·3배, −/+/전체 보기/내 위치 단추, 내 방향 화살표, 별마루섬 이름(캠핑장·전망대 봉우리·개울·별마루다리).
- 개수 칸(사용자 「개수 딱 내가 몇개인지 쓸 수 있는 칸」): public/count-box.js 하나로 − [n] +, Enter·떠날 때 정함, 1~최대, 0·빈 칸은 빼기, 16px(폰 확대 없음). 팔 물건 줄, 잡화점 재료 사기(1·5·10은 빠른 고르기, 서버 1~99).
- 택시 TAXI_BUSY 이유(train·platform·fishing·seat·room, reason 필드와 말), 8 m 밖이거나 입질 3분 지난 낚시·4 m 밖 의자는 그 자리에서 풀기, `[taxi] busy reason=… age=…s` 로그.
- 369 뒷일: 늦게 끝낸 반짝이 이벤트는 끝날 시각까지만, 부팅 별마루섬 표 데우기는 test에서 안 함.
