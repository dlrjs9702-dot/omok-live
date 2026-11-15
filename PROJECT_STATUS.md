# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.321 Codex 311~320 고침

- notes docs/codex-review-311-320: P1 #1 시세 키(서버 저장소에 한 번 만든 32바이트 키, HMAC + 시간마다 AES-CTR, 공개 기본 seed 없음; 320 시세로 산 주식은 첫 시장 준비 때 산 값 그대로 환불·기록 비움·우편 한 통(stock_refund, 사용자 B; 거래 없으면 아무 일 없음)), #2 종목 코드 정규형만(0.0/00.0 우회 막힘).
- P2: #3 제작 재료·지급을 한 기록(owed)으로, 실패 시 다음 만들기에서 재료 없이 지급, #4 작물 번호 고유 + 수확 claim에 텃밭, #5 주별 자료(last)·그때 값으로 정산, #6 폐지 우편 모두 들어가야 완료, #7 SSE에 택시 정류장 차 + 내 택시 시계, #8 농사 holder detach·대체 도형 해제, #9 좌표 1e-8 m, #10 버튼 참조 await 전 보관.
- 다음: 편의 1(+경제 로그) 1.10.322.

## v1.10.320 섬 주식

- docs/island-stocks-20261114: 30개 회사, 9~17시 한 시간마다(하루 9번) 씨앗으로 정해지는 값(모두 같음, 재시작에도 같음), 오르내림 상한 없음, 폐지(상장가 10% 아래 또는 부도, 주 1~3개) 전 하루 정리 매매(팔기만, 하루 상한에서 뺌)·우편, 1~3일 뒤 새 상장.
- 주문: 1주 단위, 수수료 0.5%, 한 회사 1,000주, 하루 20번, 포인트와 보유를 한 번에(같은 주문 번호 한 번). 주간 수익률 순위 + 1위 칭호 「이번 주 큰손」(동상·포인트 없음).
- 섬 증권거래소: 대청마당 나 자리(사용자 22A), 에셋 118 바깥(시세판 캔버스)·118b 방(보드 하나)·119 테드 창(팔짱, 짧은 한마디), 막힘 + dalmaru-walk, 내 정보 「섬 주식」.
- 다음: 한판마당 H1 혼자 퍼즐.

## v1.10.319 111b 새 마당 물건 25종

- 에셋 111 「새 마당 물건」 35에서 밭·작물 10을 뺀 25종(yard-v2 사계절 100 파일), 값표 docs/yard-111b-prices-20261110(합 197,500P).
- 3층 가구점 30×20 → 38×26 m(사용자 10A·11B, notes img/yard-111b map-A2): 마당 코너 4열×8줄 32칸(지금 13 + 작은 것 19), 큰 것 6은 제 크기로 단 위(앞 띠·오른쪽 띠), 통로 1.8 m 이상, 큰 단은 가장자리로 SPACE 거리, 벽 진열 4는 뒷벽과 3 m 뒤로, 바닥 모델 늘림.
- 다음: 320 섬 주식(거래소 자리 후보 사진부터).
