# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.121 문제 기록 2회차 3묶음: 폭포 위 연못, 관공서 옆 절벽

- 근거: gamecenter-notes `docs/issue-log-review-20261021-b.md` 16·18번.
- 18: 두 폭포 위 능선에 작은 연못(`dalmaru-terrain` FALLS·HEAD_PONDS), 폭포가 연못 물 높이에서 흘러내림(`island.js`, 연못 면 = 못 높이 − 3 cm), 연못은 물로 처리(`isWater`).
- 16: 관공서 계단 쪽 옆면도 절벽으로 — 깎는 자리(CUTS)를 계단 길 폭(`stairsBand`)에서만 비움, 백화점처럼 파고 들어간 모양.
- 검증: 단위(달마루 섬), e2e 달마루 걷기·섬 충돌 포함 전체(CI). Codex 검토 대기(10/25).

## v1.10.120 문제 기록 2회차 2묶음: 승강기·집 벽·마루·다리 끝·반려동물 이름, 사진 링크

- 근거: gamecenter-notes `docs/issue-log-review-20261021-b.md` 2·4·8·10·12·14번, 사진 링크(로그에서 사진 보기, 2026-10-21 제안).
- 8: 승강기 충돌을 실제 모델 자리(lx -14.05~-12.14)에, 서는 자리를 문 앞(-11.5)으로 — 1·2·3층(`island-store`·`island-furniture`·`island-petshop`, 서버 승강기 거리 2.6 그대로).
- 12: 집 안 벽에서 0.55 m(큰 머리 반지름) 떨어져 섬. 14: 방 바닥을 마루판 바로 아래(2 cm)로 — 4 cm 판이 걸레받이를 덮고 떠 보이던 것.
- 4: 자동 다리 양 끝을 각자 둑 높이에(서쪽 강 북쪽 끝 단차 65 cm → 4 cm), 가운데는 전보다 낮지 않게, 난간도 같은 기울기. 단위 시험(모든 자동 다리 끝 단차 10 cm 미만).
- 10: 이름 붙인 반려동물 머리 위 이름표(사람 이름표와 같은 모양, 내 것·남의 것), 내 반려동물 창 「이름 바꾸기」(`/api/island/pet/name`, 닉네임 규칙 한글·숫자·공백, 10자).
- 2: 자전거가 앞·뒤 바퀴 땅 높이로 기울고 두 바퀴 평균 높이에 섬. 기록 자리(0.8,-33.9)는 거의 평평해 재현 안 됨 — 사진 확인 뒤 다시.
- 사진 링크: `[issue]` 추가 줄에 `shot` 서명 링크(HMAC-SHA256, 7일, 로그인 없이 JPEG 한 장, 틀리거나 만료·삭제면 404, IP당 분당 60회), 서버 시작 때 한 번 열린 기록의 `[issue-shot-link]`. 키는 처음 한 번 만들어 서버 저장소에만(`issueShotKey`). base64 조각 줄은 뺌.
- 검증: 단위(다리 끝, 사진 링크 서명·만료·위조·삭제), e2e 가구점·펫샵(이름표·이름 바꾸기, PC·휴대폰)·잡화점·내 집·자전거(비탈 바퀴)·달마루 걷기. Codex 검토 대기(10/25).

## v1.10.119 문제 기록 2회차 1묶음: 사진 로그, 자전거 9/12, 섬 투명화 끔, 문패·동상 명판

- 근거: gamecenter-notes `docs/issue-log-review-20261021-b.md`(사용자 「1번으로(사진도 서버 로그에). 내가 지시한 두 가지와 현재 등록된 문제 기록 확인해서 구현 세션에서 진행해」), [자전거](bicycle-20261020.md)·[문제 기록](admin-issue-log-20261018.md) 대기 항목.
- 사진 로그: 기록을 추가할 때(그리고 배포 뒤 한 번, 열린·고치는 중 기록의 사진을 소급해) 사진(JPEG base64)을 `[issue-shot] {"id","part","of","data"}` 줄로 8KB씩(`lib/issue-log.js shotLines`). 계정 id·토큰·IP 없음. 진단에 카메라 방향·기울기·확대(`camera`)도. 하루 30개 상한 없앰(전체 500·정리·요청 횟수 제한 그대로).
- 공통 오류 `stepWeeds` (reading 'x'): 뽑던 잡초가 목록에서 사라지면(잡초 2배 뒤 새 목록, 서버 응답 기다리는 중 사라짐) 뽑기를 끝내고 건너뜀.
- 자전거: 9 m/s, Shift(휴대폰 뛰기 단추)를 누르는 동안 12 m/s(그때 Shift는 걷기 속도를 바꾸지 않음), 다른 사람 화면 따라가기 최대 12. 다리 위에서는 계속 탐(계단·실내·사람 많은 곳은 그대로 내림).
- 1: 섬에서는 건물 투명화 없음(실내는 그대로). 5: 집 문패를 단계별 앞벽 0.6m 앞으로, 긴 이름은 …. 7·17: 동상 이름은 받침 앞 명판(정면에서만 읽힘), 거리 따라 커지던 이름표 없앰 — 영웅마루·대회 광장.
- 검증: 단위(사진 줄 조각·이어 붙이기), e2e 자전거(속도·다리 위, PC·휴대폰), 카메라(섬 투명화 0), 기부 동상(명판 크기 거리와 무관), 문제 기록. Codex 검토 대기(10/25).
