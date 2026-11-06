# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.261 새 곤충 12종 (insect-catch-improve 4~5절, 에셋 105)

- 새 12종·물가(shore)·등불(lamp) 자리, 종류별 배치 몫(나무·꽃·풀 13, 물가 3, 등불 3), 겨울 3종.
- 자루 열림/닫힘 하나만, 곤충 자루 안 0.18 m. 도감 84·곤충관 24·설명 12.

## v1.10.260 곤충 손맛 (insect-catch-improve 1~3절, 에셋 103)

- 겨누기·살금살금, 세 휘두르기(테 0.9 m), 자루·퍼덕임, 평범/좋은 순간, 놓침·달아남(서버 자리 옮김, 달팽이 숨기).
- 채 v2·효과 6·곤충 12 새 판·동작 9. 261: 새 곤충 12종.

## v1.10.259 물고기 16종·대어 0.8%·입질 게임 반반·대어 줄다리기

- 에셋 91(대어 9)·93(민물 7), 모든 칸 낮 7종 이상, 칸마다 대어 0.8% 먼저 뽑기. 박물관 대어 수조·물별 벽 25.
- 입질: 화살표/타이밍 막대 반반(세 번 연속 없음), 서버 확인(막대 하한·도착 시각). 대어 줄다리기(public/fish-tug.js, 서버 재계산).
- 자랑: 모든 물고기 두 손 가로.
