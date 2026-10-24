# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.142 R7: 순발력 게임 「하늘 계단」

- 근거: gamecenter-notes IDEAS #future-stair-dash, `docs/backlog-dispatch-20261022.md` R7, 사용자 결정(2026-10-25, 그림 보고): 이름 「하늘 계단」, 보상 1,500·2,500·4,000P, 숨 빠르기 그대로.
- `public/reflex/js/games/stairs.js`: 두 버튼(왼쪽 위·오른쪽 위; PC ← → / A D, 휴대폰 화면 반쪽), 반대쪽은 헛디딤, 숨 막대(보통: 처음 초당 0.17 + 한 칸마다 0.0009씩 빨라짐, 한 칸 +0.065, 40칸마다 꽃 발판 +0.3), 난이도별 방향 바뀜 길이, 높이 따라 하늘 낮 → 노을 → 밤. PC는 카드·퍼즐처럼 넓은 틀(1,200px).
- 서버: 순발력 게임 틀(`lib/reflex.js` stairs — 30계단부터, 계단 수 × 0.1초보다 짧은 판은 지급 안 함, 5,000 넘는 기록 거절), 보상은 경제 값 `solo:stairs:easy/normal/hard`(1,500·2,500·4,000P), 순발력 하루 20,000P 함께. `/api/solo/reflex`가 `gamePoints.stairs`로 화면에 값 표시.
- 시험: 단위 `reflex-server`(빠름·지급·너무 적음·범위 밖), e2e `reflex` 「하늘 계단」(PC·휴대폰 35계단 → 헛디딤 → +2,500P), 순발력 목록 여섯.
- Codex 검토 대기.

## v1.10.141 R6: 게임관 G4 남은 것(한판마당 PC 넓게)

- 근거: gamecenter-notes `docs/gamehall-fix-spec-20261018.md` G3·G4 완료 기준, `docs/backlog-dispatch-20261022.md` R6.
- 점검: G3(오목 터치 두 번·마우스 한 번, AI 연습 오목에 내 스킨, 사목 빨강 선공, 「내 차례」, 트럼프 한 벌·도둑잡기 부채꼴, 할리갈리 종 가운데)은 v1.10.94·95에서 끝나 있음. G4는 틀이 1,200 px라 기존 e2e는 통과했지만, 그려진 카드놀이 카드 줄이 약 920 px였음.
- 카드놀이 카드 폭 상한 124 → 140(1920×1080에서 카드 줄 1,028 px), 프리셀 118 → 124. 스도쿠는 이미 약 820 px.
- 지뢰찾기: 넓은 마우스 화면에서 칸 크기를 창 높이에 맞춤(26~52 px, `--cell`), 판을 창 가운데로(초급 258 → 492 px). 휴대폰은 26 px 그대로.
- 남긴 것: G4 「위 막대를 게임방과 같은 모양」은 완료 기준 밖이라 이번에 안 함.
- 시험: e2e `reflex` 「PC 넓게」에 그려진 카드 줄(캔버스 픽셀로 잼)·지뢰찾기 판 크기·가운데 — 고치기 전 판에서 779 px로 실패하는 것 확인.
- Codex 검토 대기.

## v1.10.140 R5: 윷 말 스킨 「밤장난 꼬마 마녀」·방 테마 「한밤의 마녀 윷판」

- 근거: gamecenter-notes `docs/yut-skin-night-imp-order-20261012.md`(사용자 2026-10-12 결정), `docs/backlog-dispatch-20261022.md` R5, 사용자 「R8까지」(2026-10-25).
- `lib/skins.js` CATALOG.yut 끝에 덧붙임: 고급 `yut_p7` 「밤장난 꼬마 마녀」(200,000P), 방 테마 `yut_t4` 「한밤의 마녀 윷판」(300,000P, 전설 짝 없음). 주문서 때의 고급 3·테마 2는 v1.10.90 스킨 2배로 6·3이 되어 일곱 번째·네 번째로.
- `public/skin-art-yut.js`: `witch`(팀 색 몸통·번호 판, 꺾인 마녀 모자와 팀 색 밝은 띠·초승달, 앞머리, 반쯤 감은 눈·송곳니 하나·분홍 볼 — 번호 판에 가리지 않게 얼굴은 위로, 박쥐 날개 망토 끝, 발치 별), `batTrail`(박쥐·별), `midnight`(밤하늘 남보라·초승달·별, 판 아래 띠에 마녀 모자·빗자루 실루엣, 칸은 보라 빛 돌).
- 쿠로미 특징(광대 두건·해골·긴 토끼 귀·화살촉 꼬리·흰 얼굴+검정+분홍 배색) 없음, 이름·설명에 다른 회사 캐릭터 이름 없음.
- 시험: 단위 `skins`(윷 고급 7·테마 4, 새 테마는 짝 없음).
- Codex 검토 대기.
