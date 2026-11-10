# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.305 대회 순위·천막 하루 종일·에셋 117

- 기록의 탑 「매일 대회」 탭(진행 중/최근 전체 순위, 지난 7일), 대회 띠 → 탭. 서버 contestHistory 7일(keepHistory), /api/island/contest/history(계정 안 내보냄). 천막 stands 하루 종일, 가락 duty(알림 15분 전 ~ 끝+30분) contest:tent 붙잡기로 걸어옴·contest:back 귀가, 갈대 길·계산대 날은 백화점 문에서. 안내판 「섬 대회 안내」.
- 에셋 117 옷 7벌 장식(흡혈귀 나비넥타이·호박 배 등) High+Low, island-models refit117. 다음: 총괄 지시.

## v1.10.304 이모티콘 순서·알림 기기별·로컬 시험

- 이모티콘 칩: 0.4초 꾹 눌러 드래그(최근 고정, 끝 자동 스크롤, 「처음대로」 드래그 중만), /api/messenger/sticker-order 계정별 저장. 알림 방식: localStorage messengerAlert → 서버 값(유지 기기) → 열어 둘 때만, 유지 없으면 닫아도 받기 막음. 섬 안내 주제 클릭 중 타자 덮어쓰기 수정.
- 로컬 e2e: expect 15초, PW_GPU=1(로컬만) 1 worker 권장; 60fps 시험 시점(fp·카메라·원격 걸음 0.1초 구간), 터치 힌트. 다음: 대회 순위.

## v1.10.303 G4a 흩뿌리기·막힘

- 에셋 112: 덤불 +160·바위 +120·통나무 34·야자수 18(막힘), 키 큰 풀 240(40 m 밖 숨김)·연잎/연꽃 36. 바위 막힘(자갈·물가 돌 빼고). 택시 길 가운데서 4.05 m·정류장 10 m·걷는 길 2.5 m·건널목·집터·열매 자리 비움. Low 없음.
- 다음: G4b 채집(버섯·네잎클로버·나뭇가지) + 로컬 e2e 설정(로비 15초, PW_GPU, fp:107).
