# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.324 스스로 알려 주는 섬 + 광석 300P

- 검토 ②(docs/direction-ideas-20261110, 7A): 화면 오류(한 종류 한 번, 한 페이지 10개)와 섬 프레임(1분 뒤, 15분마다)을 POST /api/client/report(들어온 사람만, 1분 20번)로 모아 매일 00:10 KST 뒤 Render 로그 [client] 한 줄(오류 상위 20·종류 수, 기기별 fps 10·50·90%·20 아래 비율·단계 분포). 주소·아이디·긴 토큰은 지움, 계정·이름·자리 없음.
- 광석 판매가 800 → 300P(58A).
- DB 백업(③)은 60A~63A로 정했고 사용자가 요청할 때 넣어요.
- 다음: 크리스마스 보강 + 대청마당 다시 배치.

## v1.10.323 Q1 채석장 + 땅 질감

- 채석장(docs/island-expansion-20261115 28A·29B·30A, assets 129·130): 능선 B(298~314°, r 148~166), 영웅마루역에서 능선 길 79 m, 바위 10(가득/캔 뒤 모델, 자리별 캐는 자리), 표지판 「채석장」, 광석 더미, 막힘 + 대신 상자. 곡괭이(잡화점 2,000P, 40회), 캐기 3번 휘두름 = 광석 1(800P), 바위당 2, 3시간 뒤 다시 참, 하루 6개(값은 사용자 확인 필요). 손보기 광석 주 5(집 크기 배수).
- 땅 질감(assets 135, 45A): 풀·모래·흙 그림 + 넓은 얼룩(33 m 얼룩 대신), 높음·중간만, 눈 위는 예전 알갱이. 렉: 집 거리·대청마당·정류장·풀밭 모두 전후 60 fps(상한).
- 길·자연물 변화: 건널목 곁 나무는 규칙으로 뺌, 땅 지도 그림 다시 만듦.
- 다음: 크리스마스 보강(+ 대청마당 다시 배치).

## v1.10.322 편의 1

- notes docs/mokpo-onxdo-ui-ideas-20261115: U1 느린 기기 알림(입장 3초 뒤 10초 fps < 20, 기기당 한 번, 최대한 가볍게 = 낮음 + 60%), U2 섬 화면 3단계(자동/가볍게 보통·80%/최대한 가볍게 낮음·60%) + 「지금 화면」 + 「더 보기」, U3 막혔을 때 대청마당으로(서버 /api/island/unstuck, 방·택시·열차 거절, 20초에 한 번), U4 조작법 카드(PC·폰) + 처음 3일 안내 띠, U5 미니맵 위 「지금 자리」 칩.
- 섬 주식 보드: 줄 색과 ▲▼를 「오늘」 한 기준으로, 열 이름, 회사 창 오늘·어제보다, 7일 안 되면 「상장 n일째」.
- 경제 로그: Render [economy]·[economy:flows] 한 줄씩(시작 1분 뒤, 매일 00:10 KST 뒤), 계정 정보 없음.
- 폰 화면 밀림(notes phone-screen-shift-20261115 검토): body.plazaMode 100dvh, 캔버스 touch-action none, 섬 모드 폰 스크롤 되돌리기, 문제 기록 device에 100vh 실측.
- 다음: Q1 채석장 또는 땅 질감(에셋 먼저 온 쪽).
