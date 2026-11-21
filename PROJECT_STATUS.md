# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.396 N4-c 길 연장 · ④ 정류장 · 문제 기록 6건(notes n4-plan-20261120 §5-3, 결정 50 A · 26 바뀜, 검토 isle2-fence-bridge-whale · pet-unnamed-invisible)

- 길(island-taxi EXT, ROADS): 마을 정류장 앞 모퉁이 → 목 x −20 → 마을 거리 z 236(마당 울타리 앞면 232.1·239.9 사이 7.8 m) → lot14 모퉁이 지나 x 116 → 별마루다리 걷는 길 → 다리 → 넓은 문 안 10.5 m, 320 m. 건널목 6곳(−20,224 · −12/14/42/70/98,236). 땅 띠·칠·주민 길 격자·채집·나무 비우기(별마루섬 숲 포함, 자리 다시 뽑힘 한 번)가 모든 길을 읽음, 마을 거리 가로등은 인도 위 3.3 m, 별마루섬 안내판 길 밖으로. 차는 아직 새 길로 안 감(397).
- ④ 달끝나루·달끝역 정류장: 길 위 225 m(두 건널목에서 6.75 m).
- 문제 기록: 38e19523 걷기·뛰기는 모든 펫이 따라 달림(자전거만 387 방식 — 결정 26 뛰기 몫 바뀜), b718b5ab 1인칭에서 내 이름표·내 펫 이름표 숨김, 5218e442·1bca464b 별마루섬 목책·동굴·캠핑장·바위·표지판이 화면 solids에, 937dce24 낮은 모델 다리 옆막이(문턱 0.15), a3408e31 긴 다리 25 m 안에 고래·바다 볼거리 없음.
- 시험: 새 길 단위, island-pets 이름 없는 펫 Idle, island-tigers 경고를 80 ms 감시로 기록(검토: 395 CI 흔들림).

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
