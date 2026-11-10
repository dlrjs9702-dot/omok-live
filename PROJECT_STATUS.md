# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.304 이모티콘 순서·알림 기기별·로컬 시험

- 이모티콘 칩: 0.4초 꾹 눌러 드래그(최근 고정, 끝 자동 스크롤, 「처음대로」 드래그 중만), /api/messenger/sticker-order 계정별 저장. 알림 방식: localStorage messengerAlert → 서버 값(유지 기기) → 열어 둘 때만, 유지 없으면 닫아도 받기 막음. 섬 안내 주제 클릭 중 타자 덮어쓰기 수정.
- 로컬 e2e: expect 15초, PW_GPU=1(로컬만) 1 worker 권장; 60fps 시험 시점(fp·카메라·원격 걸음 0.1초 구간), 터치 힌트. 다음: 대회 순위.

## v1.10.303 G4a 흩뿌리기·막힘

- 에셋 112: 덤불 +160·바위 +120·통나무 34·야자수 18(막힘), 키 큰 풀 240(40 m 밖 숨김)·연잎/연꽃 36. 바위 막힘(자갈·물가 돌 빼고). 택시 길 가운데서 4.05 m·정류장 10 m·걷는 길 2.5 m·건널목·집터·열매 자리 비움. Low 없음.
- 다음: G4b 채집(버섯·네잎클로버·나뭇가지) + 로컬 e2e 설정(로비 15초, PW_GPU, fp:107).

## v1.10.302 게임관 1차

- F1 첫걸음: 판 게임 고르는 중 덮개에 역할 버튼(오른쪽 칸 버튼 대역)과 방장 시작, 빈 자리 이름표 누르면 앉기. 팬데믹 P1 역할 카드(불투명, 이유 창이 뜨면 닫힘)·칩 짧은 역할 이름, P3 지금 할 일, P5 함께하기 N명, P7 치료제 동그라미·큐브 3개 빨간 테두리·? 범례, P8 못 쓰는 버튼 이유.
- 다음: G4a 흩어진 자연물(에셋 112).
