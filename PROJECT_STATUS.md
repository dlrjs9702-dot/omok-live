# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.149 파도 치는 바닷가

- 근거: gamecenter-notes `docs/shore-waves-design-20261025.md`(사용자 「진행해」, 시범 검토 1~3차 반영).
- 해안 지도 `ground-v2/shore.png`(바다 가장자리까지 거리 ±12 m, 깊이, 해안 종류: 모래·바위·인공 물가)를 같은 빌드 도구로.
- 모든 모래 해변: 물막이가 가상 비탈로 1.5~2.5 m 밀려왔다 빠짐(약 7초, 자리마다 박자 다름), 앞쪽 밝게, 이어진 거품 레이스(약 40 cm, 부채꼴 앞 가장자리·구멍, 빠질 때 얇아지고 흩어짐), 젖은 모래는 진하고 반짝이며 약 4초에 걸쳐 마름 — 모두 시간으로 계산(상태 없음).
- 바다: 깊이로 얕은 곳 맑은 청록·반투명, 해변으로 다가오는 끊긴 잔물결 줄(먼 곳일수록 옅게), 먼 바다도 옅은 잔물결과 해·달 반사. 시간대 색: 낮 파랑, 저녁 짙은 남색(보라 살짝)·얕은 곳 짙은 청록, 밤 남색 + 달빛.
- 움직임 줄이기면 멈춘 그림.
- 시험: `ground-maps`(shore.png 바이트 비교 포함).

## v1.10.148 섬 땅 지도 그림 — 길 전체 + 땅 종류

- 근거: gamecenter-notes `docs/path-paint-design-20261025.md`, `docs/terrain-paint-design-20261025.md`(사용자: 길 시범 「전보다 낫다」 → 「전부 그 방식대로」, 「확인 없이 전체」, 지도 저장은 「그림 파일로 가자」).
- 길 연결망은 `public/plaza/island-paths.js` 한 곳(`paintedWalks`: 길·문 앞 길·홀 포장길, 다리·물·대청마당·관공서 마당 밑은 뺌).
- 빌드 도구 `tools/maps/build-ground-maps.js`가 1024² RGB PNG를 만들고 게임은 읽기만: `ground-v2/path-a.png`(길 가장자리까지 거리, 길 따라 간 위치 cos·sin), `path-b.png`(종류, 갈림길, 대청마당 자갈 띠), `cover-a.png`(숲 바닥·흙·모래), `cover-b.png`(바위·짙은 풀·클로버). 약 710 KB, GameBoot 해시 주소라 캐시가 낡지 않음.
- 달마루섬에서 흙 띠·1 m 돌판·갈림길 원판·화분을 없앰(서는 높이 +5 cm도 없음). 길은 땅 셰이더가 칠함: 마을 길은 길 따라 휘는 엇갈린 판석, 갈림길은 결 없는 불규칙 판석이 길 결로 섞임, 산책로 모래, 오솔길 흙, 가장자리는 결 그림의 무작위로 둥글게 흔들림.
- 땅 종류는 계절 풀 위에 칠함: 숲 바닥(나무 밑), 흙(가장 가파른 비탈 얇게·문/벤치 앞 닳은 자리, 회갈색), 바위(거의 수직인 곳·바닷가 절벽), 짙은 풀(돌리고 비튼 잡음), 클로버·꽃 무더기, 모래, 대청마당 둘레 자갈. 겨울 눈은 풀·흙·비탈에, 바위면엔 조금 덜.
- 휴대폰 크기(헤드리스 비교): 대청마당 서쪽 9.8 → 11.2 fps, 툇마루섬 9.9 → 12.7 fps(그리기 492 → 397, 삼각형 148만 → 74만).
- 시험: 새 단위 `ground-maps`(다시 만든 PNG = 들어 있는 PNG 바이트까지, 모든 길이 칠해짐, 갈림길, 대청마당에서 칠한 땅으로 모든 문·다리 끝·계단 발치에 닿음), e2e `island-assets` 길 조각(달마루섬은 0개).

## v1.10.147 메신저 단독 창(B안)

- 근거: gamecenter-notes `docs/messenger-standalone-20261025.md`(사용자 「B로 진행하고 대화창 다음에 넣어」).
- ① `/messenger` 전용 페이지(`public/messenger.html`·`messenger.js`·`messenger.css`): 게임 코드 없음, 크롬 전용 관문 없음(아이폰 Safari 홈 화면 앱도). 방·1:1·고정·알림 끄기·삭제·안 읽은 사람 수는 그대로 옮김. 섬 공통 부품(크림 종이) 색.
- ② 앱으로 설치: `messenger.webmanifest`(id·scope `/messenger`, 「아일랜드 메신저」, 전용 아이콘) → 게임 앱과 따로 설치되는 독립 창. 설치 단추(`beforeinstallprompt`), 아이폰은 「홈 화면에 추가」 안내.
- ③ Web Push: `lib/web-push.js`(node crypto로 RFC 8291 aes128gcm + VAPID ES256, 추가 패키지 없음, RFC 부록 A 예와 바이트까지 같음). 환경 변수 `VAPID_PUBLIC_KEY`·`VAPID_PRIVATE_KEY`·`VAPID_SUBJECT`가 없으면 알림 단추가 안 나옴. 받는 사람 = 방의 다른 사람 중 알림 끈 사람·지금 메신저를 열어 둔 사람(스트림) 빼고. 알림은 「로그인 유지」 기기에서만 켬. 끊긴 구독(404·410) 정리. `messenger-sw.js`(scope `/messenger`)가 알림·앱 아이콘 안 읽은 수, 누르면 그 방.
- ④ 이 기기에서 로그인 유지: 기기 토큰 60일(해시로 저장, `worldValue messengerDevices`, 계정당 10대), 메신저 API만 됨. 비밀번호 변경·관리자 「메신저 해제」·그 기기 로그아웃이면 끝, 「로그인된 기기」 목록·끊기.
- ⑤ 게임 안에서: 내 계정·섬 화면의 메신저 단추(안 읽은 수) → 같은 창을 앞으로(새 창이면 이 탭의 로그인을 가져감). 섬 안 작은 알림은 그대로. 내 계정의 메신저 창(dialog)은 없앰.
- 서버가 잠들어 있으면 첫 요청 2.5초 넘을 때 「서버를 깨우는 중」 표시.
- 시험: 단위 `web-push`(RFC 예, 받는 기기 키로 풀림, VAPID 서명, 받는 사람), 새 `messenger-device`(기기 토큰은 메신저만, 끝나는 경우 셋, 알림 받는 사람·열어 둔 사람·알림 끈 사람, 구독은 기기와 같이), e2e `messenger`(로그인 유지·새로고침, 내 계정에서 같은 창, 안 읽은 수, 주고받기, 1:1·나가기 경고, 로그아웃, PC·폰).
