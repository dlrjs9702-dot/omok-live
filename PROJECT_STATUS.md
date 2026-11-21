# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.395 Codex 검토 381~390 고침(notes docs/codex-review-381-390.md — 19건 확인, 표 그대로)

- P1: 수조 재전송(돌려준 기록 있으면 거절), 요리 재료·도장 한 거래(questApply take — 돌려주기 없앰, 산 물고기 길이·표시 그대로), 재료 부탁 미지급은 `owed`에 날짜와 상관없이 보존·1.10.380 기록 복구, 호랑이 잡힘 최근 10건 `lost`(늦은 재시도가 다시 안 뺌), 행사 `award`가 더 늦은 날짜 기록 보존.
- 탐방선: 빈 배도 같은 균형 규칙·앞바다 빈 배 되돌아감·기다리던 빈 배 그대로, 하선 자리 `outAt/outBerth`, 광장 떠나면 안 떠난 배 자리 놓음, 바로 타기·줄 같은 자격 검사, `leave` 실제 선석, 뛴 자세는 3초 동안 선착장 아님(승선만 — 전체 이동 검증은 따로).
- 창고 번호 다시 안 씀(`seq`)·꺼낼 때 물건 종류 확인·재시도 요청 번호 유지·끝난 요청 하루 기억, boot-cache 목록 검사, 펫 이름 ''/null 같게·줄 지오메트리 해제, 요리 작물 재료·「밭 채소 두 가지」는 서로 다른 종류, 같은 종류 칸 합산, 판매 재시도는 원래 행사에.
- 남긴 것: 5(a) 저장소 장애 중 재시작 시 재시도 기록(같은 저장소라 의미 없음), 7 전체 이동 검증.

## v1.10.394 N4-c 첫 갈래 — 별마루다리 넓은 문 · 문 안쪽 땅 깎기 · 호랑이 안전지대 16 m(notes n4-plan-20261120 §5-4, 결정 41, 에셋 163)

- 목책: 별마루다리 문(#182)과 양옆 두 조각을 넓은 문 하나(`fence_gate_wide`, 7.2 m, 기둥 사이 4.4 m, 위 가로대 없음)로. 종류 번호 5를 새로 붙여 다른 조각 번호는 그대로. 막는 원은 에셋 163 solids.json(기둥 둘 + 날개 여섯), 걷기 시험 대역 상자는 기둥·날개.
- 땅: dalmaru-terrain `gateCut` — 문 줄 안쪽만, 폭 7 m·안쪽 2.3 m를 문 줄 높이 0.04로, 그 밖은 1 m에 0.3 m씩 올라가 지금 땅과 만남, 가장 깊이 0.55 m(에셋 163 ground-cut.json 4,908점과 같음). 다리 바닥·자연물·채집 자리·땅 지도는 그대로(재 봄).
- 화면: 문짝 둘(leaf_l −1.45, leaf_r +1.45, 섬 안쪽으로)이 사람 3.5 m 또는 택시 20 m 안이면 열림. 그려진 땅(2.5 m 격자) 위로도 문짝 밑 여유 5 cm 넘음.
- 호랑이: 문마다 안전지대 반지름(넓은 문 16 m, 부두 문 12 m) — 세 번째 종점 자리(238, 229.5) 9 × 6 m가 모두 사냥 못 하는 땅.
- 길 연장·세 번째 종점·정류장 ⑥⑦은 다음 버전(이번 깎기로는 자리 다시 뽑힘이 없어서 나눔).

## v1.10.393 택시 비켜 가기 흔들림 고침(검토 notes docs/taxi-yield-flake-20261121.md)

- 서버: 택시 앞 보기(taxiBlocker)가 사람의 자리를 5초가 아니라 PLAZA_STALE_MS(15초)까지 봄 — 서 있는 화면은 3초마다 자리를 보내서, 화면이 2초만 버벅여도 길 위 사람을 놓쳐 반투명이 끊기거나 그냥 지나갔어요.
- 스펙 island-taxi-yield: 두 화면 holdQuality(0) — 느린 시험 화면에서 화질 자동이 낮음으로 내려가며 셰이더 23~25개를 다시 만들어 3~5초 멈추던 것(검토 측정: 고친 뒤 8/8 통과).
