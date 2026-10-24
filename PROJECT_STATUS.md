# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.150 동산 다듬기

- 근거: gamecenter-notes `docs/terrain-paint-design-20261025.md` 3(사용자 「진행해」 — 높이 그림 파일 대신 ground() 식에 모양 함수 목록).
- `dalmaru-terrain.js` `BRUSHES`: 층진 언덕(82, −58), 둔덕(50, −22)·(138, 34), 움푹한 곳(−126, 70), 절벽 턱(−86, −58). 대청마당·툇마루섬·건물 자리 평탄화는 그 뒤 그대로, 서버·화면 같은 코드.
- 모양은 빈 땅에만 — 문·계단·다리·집터 높이는 바뀌지 않음(오차 0). 땅 지도는 새 높이로 다시 만듦.
- 층진 언덕은 평평한 단 둘 + 풀 둑(가장 가파른 곳 0.83 — 걸을 수 있는 0.9 아래), 절벽 턱 2.4 m, 둑은 풀만(동물의 숲처럼), 비탈 면은 살짝 그늘.
- 나무·꽃·덤불·잡초는 모양 전의 땅으로 골라 자리·크기·종류가 그대로(나무 418 중 410, 새 둑 위 8그루만 빠짐; 열매 나무 38곳 중 37곳 같음), 거울호수·강·연못엔 파도 없음(바다와 이어진 물만).
- 시험: 새 단위 `terrain-brushes`(모양마다 길·문·집·계단 양 끝·다리 양 끝·집터·강·폭포 연못·바닷가와 안 겹침, 비탈 0.85 이하, 둔덕이 실제로 솟음), `ground-maps`.

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
