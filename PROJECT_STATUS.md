# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.414 S2 캠핑장 안(사용자 결정 72 · 73, 검토 safe-zones-visible §2-2, 에셋 164 · 176 · 177)

- 관리소 `camp_office`(176) (256, 259.5), 문 · 「관리소」 판이 모닥불 쪽. 판 글자는 게임이 씀, 겨울 지붕 눈, 밤 등 · 창 불빛.
- 화덕 세트 `camp_hearth_set`(164) (248.7, 249.1), 밤 불씨. 텐트 셋(land-v1 뾰족 · 둥근 · 용마루) 검토 자리, 모두 모닥불 쪽. 가운데 작은 모닥불 세트는 그대로.
- 막는 것: 별마루섬 소품 자료 `CAMP2`(사람 · 호랑이 같이), 대역 상자는 원 위에.
- 모락(177): 관리소 문 오른쪽 앞 `keeper`에 서 있는 캠핑장지기(걷지 않음). 「모락 · 말 걸기」 → 인사(밤에는 밤 인사) + 「안전한 곳은요? / 호랑이는요? / 꿀팁 있어요?」(camp-keeper.json).
- 걷기 검사: 쪽문 원에 표시를 달아 1 m 격자가 쪽문을 지나가게.

## v1.10.413 S1 캠핑장 높은 목책 + 쪽문 넷(사용자 결정 72, 검토 safe-zones-visible §2-1 · §3, 에셋 174)

- 목책 `fence_palisade_tall`(높이 3.3~3.55 m) 60칸 고리, 칸 가운데 반지름 22.9 m, 칸 사이 2.4 ± 0.05 m, 안쪽이 캠핑장.
- 쪽문 `fence_wicket` 넷: 들어오는 길 네 개 위(빈 폭 1.2 m — 호랑이 가슴 1.5~1.8 m는 못 지나감). 사람이 2 m 안이면 문짝이 안으로 열림, 호랑이 · 택시로는 안 열림. `fence_gate`가 아니라 문 둘레 12 m 규칙 없음 — 안으로 들어와야 안전.
- 안전 반지름: 섬 자료(`NEW_ISLE.camp.safe` 22.9, `peak.safe` 14)를 서버 · 화면이 같이 읽음.
- 자연물은 목책 바깥면까지 비움, 목책 줄 위 가로등 둘은 1.6 m 안 · 밖으로(길 밖). 땅 지도 다시 구움.

## v1.10.412 L3 서쪽 윤슬다리 + 섬 한 바퀴(사용자 결정 67-4 · 69 A, notes taxi-island-loop §5 · §6 · §7, 결정 78)

- 서쪽 윤슬다리: 동쪽과 같은 `dalmaru.bridge_yunseul_wide`(56 m, 걷는 폭 7.8 m, 바다 위 7 m, 가운데 노란 선), 초승 곶 끝만 폭 방향 평평.
- 고리 닫기: L2가 다리를 건너 툇마루섬 갈림길까지(287.1 m) — 길이 고리(610 m) + 곁가지. 가장 짧은 길이 서쪽으로 도는 곳이 생김(대청마당 → 툇마루섬 368 m, 요금은 그대로 1,000P).
- 「섬 한 바퀴(구경)」: 목적지 맨 아래, 탄 곳으로 돌아옴. 윤슬만이 차 오른쪽, 곁가지에서 타면 나갔다 돌아옴. 요금은 제 길이(고리 위 1,500P · 대청마당 1,750P). 돌아온 빈 차는 다른 종점으로.
- 모퉁이: 대청마당 밑 갈래의 되돌기(146°)는 두 팔 사이로 가로지름, 20° 넘는 모퉁이는 곡선(안쪽 1 m, 찻길 문 0.3 m) — 어느 길도 한 점에서 35° 넘게 안 꺾음.
- 서쪽 물가 거리 건너편 표지 · 표시: 정류장 바로 건너(바다 쪽 가로등 규칙이 표지 · 표시에서 비킴).
- L1 끝 도는 자리(−126, 242) r 6.2 칠, 자연물 · 가로등 비움. 건널목 서쪽 다리 양끝 2곳. 땅 지도 다시 구움.
