# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.129 문제 기록 3회차 5묶음: 대청마당 가장자리 꾸밈, 농장 마당

- 근거: gamecenter-notes `docs/issue-log-review-20261022.md` 13·15번.
- 13: 대청마당 남·동·서 가장자리 안쪽 3 m에 10 m마다 묶음(화단 1, 양옆 벤치, 연석 쪽 가로등) — 길 입구·문 앞 6 m·정원·물길·마당의 자리·스폰은 비움(`plazaProps` `clear()`). 화단 11, 벤치 14(+기존 4), 가로등 19. 가장자리 벤치는 연석에서 마당 안쪽을 봄(`rim: true`, 시험 `seat-facing`), 광장 좌석 4+14+28(`island-social`).
- 15: 퀘스트 밭 둘레를 농장 마당으로(`FARM.yard`): 밭 3개 더(2×2, 2 m 사이, 평지 패드), 울타리(0.7 m마다 부딪힘, 오솔길이 들어오는 북쪽은 문으로 비움), 남서쪽 창고, 밭 사이 허수아비. 나무·덤불은 마당 밖(`addNatureBlock`), 돌·꽃·잡초는 `settledSpot`이 마당을 뺌 — 잡초 13포기만 빠지고 나머지 번호·자리 그대로. 창고·허수아비는 에셋 요청 중이라 상자 대신 그림, 울타리는 계절 울타리 모델.
- 검증: 단위(좌석 방향·수, 흩어진 소품, 길 끝, 건물 간격), e2e 농장 주민·섬 에셋. Codex 검토 대기(10/25).

## v1.10.128 문제 기록 3회차 4묶음(길 체계): 대청마당 가장자리, 게임관 길, 계단 위아래 길 끝

- 근거: gamecenter-notes `docs/issue-log-review-20261022.md` 10·20번.
- 20: 대청마당 아래 땅이 박석보다 높아지지 않게 함(가장자리 2.5 m까지, 2 m 땅 칸이 가장자리에 걸쳐도 평평) — 게임관 평지 패드가 동쪽 가장자리를 26 cm 밀어 올려 잔디가 박석 위로 들쭉날쭉 솟았음. 게임관 문(계단 발치에서 1.5 m 안쪽)에서 마당 가장자리까지 마을 길 띠(폭 3.2)로 이음(`T.SPOTS`의 hall마다).
- 10: 능선 위 길이 맨 위 단 위에서 시작해 절벽 아래로 띠가 늘어지던 것 — 능선 가장자리(`stairsAt(34.4, -0.4)`)에서 시작. 계단 아래 길도 첫 단 앞(`stairsAt(-0.4, 1.7)`)에서 끝냄.
- 잡초: 길이 덮은 1포기만 빠지고 나머지 번호·자리 그대로(v1.10.127 시도 번호).
- 단위 시험 `walk-ends`: 모든 길 끝이 다른 길·마당·문·다리·계단·역·이름 있는 곳에 닿음(폭/2 + 0.7 안), 길 점이 계단 단 위에 없음.
- 검증: 단위(길 끝, 흩어진 소품, 건물 간격, 달마루 섬), e2e 달마루 걷기·광장. Codex 검토 대기(10/25).

## v1.10.127 문제 기록 3회차 3묶음: 뜬 돌·잡초, 능선 계단과 관공서, 마당 바닥 깜빡임

- 근거: gamecenter-notes `docs/issue-log-review-20261022.md` 8·11·19번.
- 8: 흩어 놓은 것(나무·덤불·돌·꽃·잡초·풀덮개·가로등)을 계산식 땅(`ground`)이 아닌 그려진 땅(`meshGroundHeight`, 2 m 메시)에 놓음 — 능선 비탈·절벽 끝에서 둘이 최대 4 m 달라 뜨거나 묻힘. 절벽 조각만 계산식 그대로. 돌·꽃·잡초는 앉을 자리만(`settledSpot`: 둘레 0.3 m가 가운데보다 0.09 m 넘게 꺼지지 않음, 계산식·메시 차 0.15 m 미만, 길·계단 밖) — 돌 120 → 68, 처음 잡초 1,400 → 약 1,350. 잡초는 번호(w<i>)를 매긴 뒤 거르고, 다시 자라는 자리도 같은 규칙. 잡초에 따로 씨앗(`seed = 0x7a1f5`)과 시도 번호(`i`, `w<i>`, 시도마다 난수 3개) — 계단 이동으로 앞선 나무·꽃 배치가 난수 순서를 밀어 잡초가 전부 움직였기 때문, 이번 한 번 섞이고(뽑힘 기록은 번호로 남아 수는 그대로) 앞으로는 나무·꽃·길이 바뀌어도 그 자리만 빠지고 나머지 번호·자리 그대로. 잡초 서버 시험은 처음 수를 BASE에서 읽음. 단위 시험 `scattered-settled`(0.1 m 넘게 뜬 것 0, 번호 그대로). 「떠 보이는 붉은 바위」는 가을 각진 나무 — 에셋 교체(assets 63 `tree_block` 4계절: 줄기 1.7배, 가을 잎 아랫면 밝게).
- 11: 능선 계단을 능선 따라 1.5°(226° → 210.5°) 옮김 — 관공서 정면 모서리와 1.6 m → 4.75 m, 길·꼭대기 메움은 계단 끝을 따라감. 단위 시험 `footprints`(건물·마당·알림마루 소품·초가·집터·계단·다리 서로 2 m 이상).
- 19: 길 띠가 대청마당 박석과 관공서 마당 아래로 들어가 같은 높이에서 겹쳐, 보는 각도에 따라 흙이 비침 — 그 테두리 0.2 m 안에서 띠를 끝냄.
- 검증: 단위(흩어진 소품, 건물 간격, 달마루 섬, 에셋), e2e 달마루 걷기·광장. Codex 검토 대기(10/25).
