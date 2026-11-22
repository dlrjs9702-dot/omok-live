# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.416 S4 망루 + 먼 시야(사용자 결정 72 · 73 · 166A, 검토 safe-zones-visible §2-4 · §3, 에셋 178)

- 망루 `lookout_tower` (394.75, 216.75), 돌담 마당 안 · 오솔길 밖, 오르는 곳이 길가.
- 걷는 면 8개(발치 · 계단 셋(기울기 0.46) · 층계참 셋 · 마루 6 m)를 섬 높이 목록 `onTower`로(능선 계단 · 부두처럼), 땅보다 낮게는 안 됨. 난간 막는 원 128개 — 발치 말고는 높은 면으로 못 걸어 들어감.
- 결정 166A: 마루 · 꼭대기 층계참 위에서 안개 600 · 그리는 거리 650, 본섬 숲을 10 m 그물 하나(멀리 모양)로. 230 m 밖 물건은 그대로 안 그림.

## v1.10.415 S3 전망대 돌담 마당(사용자 결정 72 4 A, 검토 safe-zones-visible §2-3, 에셋 175)

- 돌담 `fence_stonewall_tall` 31칸 고리, 가운데 (393, 212), 칸 가운데 반지름 11.84 m, 칸 사이 2.4 ± 0.05 m. 칸마다 +x 끝 돌기둥이 다음 칸 이음 위.
- 돌담 쪽문 `fence_wicket_stone` 둘: 오솔길이 지나는 서 · 동(빈 폭 1.2 m 전부 길 위). 사람 2 m 안이면 문짝이 안으로 열림. 문 둘레 12 m 규칙 없음 — 안으로 들어와야 안전.
- 안전 반지름: 전망대 14 → 11.9(섬 자료 `peak.safe`, 서버 · 화면 같이).
- 캠핑장 목책과 같은 고리 만들기 하나로. 땅 지도 다시 구움.

## v1.10.414 S2 캠핑장 안(사용자 결정 72 · 73, 검토 safe-zones-visible §2-2, 에셋 164 · 176 · 177)

- 관리소 `camp_office`(176) (256, 259.5), 문 · 「관리소」 판이 모닥불 쪽. 판 글자는 게임이 씀, 겨울 지붕 눈, 밤 등 · 창 불빛.
- 화덕 세트 `camp_hearth_set`(164) (248.7, 249.1), 밤 불씨. 텐트 셋(land-v1 뾰족 · 둥근 · 용마루) 검토 자리, 모두 모닥불 쪽. 가운데 작은 모닥불 세트는 그대로.
- 막는 것: 별마루섬 소품 자료 `CAMP2`(사람 · 호랑이 같이), 대역 상자는 원 위에.
- 모락(177): 관리소 문 오른쪽 앞 `keeper`에 서 있는 캠핑장지기(걷지 않음). 「모락 · 말 걸기」 → 인사(밤에는 밤 인사) + 「안전한 곳은요? / 호랑이는요? / 꿀팁 있어요?」(camp-keeper.json).
- 걷기 검사: 쪽문 원에 표시를 달아 1 m 격자가 쪽문을 지나가게.
