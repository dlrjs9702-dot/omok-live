# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.285 택시 고침

- 길을 0.5 m 격자로 다시 찾음(길 가운데, 물체에서 차 반폭+0.3 m, 물·계단 없음, 110점 404 m, 13 m/s 37~38초), 툇마루섬 정류장 → 「툇마루섬 마을」(−13.3, 173.1), 대청마당 정류장 3 m 남쪽, 승강장·서 있는 차 막힘(문 쪽 비움), 달리는 차는 나를 밀어냄, 걷는 주민 2 m 비킴·「빵!」, 타는 동안 모자 숨김, 택시 대역이 장면에 붙음. 다음: 286 메신저(폰 키보드·이모티콘 판 닫기), 287 얼굴, 288 다래.

## v1.10.284 그래픽 G1 땅과 풀 섬 전체

- 16 m 칸이 나를 따라(PC 45 m·8잎/m², 폰 25 m·5잎/m², 중간 1/3·2/3 거리, 낮음 없음), 땅 지도(path·cover·shore)로 풀 자리, 단단한 물체·광장·물 없음, 깎기 내 가까운 24개, 톤 바깥 전체(실내 그대로), 땅판은 그려진 땅 높이·점마다 계절 색; 주민 수는 cast에서(28번째 준비). 다음: G3 빛, G2(에셋 109), G4(사용자 6절).

## v1.10.283 Codex 271~280 12건 + 창구 이름

- 잊힌 내기 환불은 :stake 있고 :pay 없을 때만(hasClaim), 시작은 opens 먼저, 계정별 정산 직렬화, pending 안 지움, 실패 되돌림·b.want 재정산·settled 한 번, 택시 동시 요금 막음, contest+bet 400; 내기 단추·결과 감시·그림 글자 길이·pilot dispose·시범 나무 숨김 시점; 민원실 창구 안내 「· 직원 이름」. 다음: 그래픽 G1, G2(에셋 109).
