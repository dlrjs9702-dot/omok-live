# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.344 Codex 331~340 P2 고침

- P2-5 벼룩시장 올리기: 물건은 가방에서 뺄 때 같은 한 걸음에 내 flea 문서 `pending`에 매물을 남기고, 가구는 창고에서 빼기 전에 남김. 게시판 저장이 멈추면 같은 요청 다시·다음에 볼 때 한 번만 올림(게시판 `posted` 최근 500개). 가구가 아직 창고에 있으면 버림.
- P2-6 「산 것」: 수조에 넣을 때 산 것인지 기억(islandUse `bought`)해서 꺼낼 때 표시, 선물(giftBags)도 표시를 옮김.
- P2-7 썰매: 내릴 때 assets.detach + 전용 자원 정리.
- P2-8 트리 음악: 오래 멈춘 뒤엔 지금부터 다시(지난 음표 몰아 만들지 않음), 장면 stop에서 음악도 멈춤.
- 시험 test/flea-stops.test.js에 P2 두 개(올리기 멈춤 물건·가구, 산 표시·음악).

## v1.10.343 Codex 331~340 P1 고침 (벼룩시장·도장 가게 복제·이중 지급)

- P1-1 도장 가게: 가구 전달 기록 `handed`를 도장 문서에 따로 남김(창고에 있는지와 별개). OWNED 다시 시도는 10분 안에 산 것 중 전달 표시가 없는 것만 줌(`boughtAt`).
- P1-2 벼룩시장 사기: 사는 사람에게 먼저 예약(저장) → 그 사람 결제 키(`flea:buy:<id>:<계정>`) + 내 flea 문서 `paidFor` → 전달. 멈춤으로 남은 예약은 정리 때 결제가 있으면 그 사람에게 끝내 주고, 없으면 풀어 줌. 예약 중엔 다른 사람 FLEA_BUSY.
- P1-3 판 돈: 자동(3일)·받기 모두 판매마다 같은 키 `flea:sale:<id>`로 지급(이미 지급이면 표시만).
- P1-4 거두기: 게시판에서 내리고 「맡아 둔 것」으로 먼저 저장 → 같은 claim으로 돌려줌 → 맡김 풀기. 자리 없으면 게시판 그대로.
- 시험 test/flea-stops.test.js(저장 멈춤 흉내: 결제 뒤·거두기 뒤·받기 뒤·자동 지급 뒤·도장 표시 전), 옛 코드에서는 실패함을 확인.
- P2 5~8(맡기기 실패 소실, 산 물고기 표시가 수조·선물에서 사라짐, 썰매 로더 누적, 음악 몰아 생성)은 다음 PR.

## v1.10.342 4a 광석 8가지·채석장 전체·캐기 미니게임 (88A~98B, 146A, 검토 §1-8·§1-9·§1-14) + 147c

- 광석 lib/island-ores.js: 8가지(흔함 화강암·점토, 보통 석탄·철광석·구리 광석, 드묾 은 광석·수정, 아주 드묾 금 광석). 상인 146A 흔함 200P·보통 300P, 은·수정·금은 상인 안 받음(벼룩시장 값 800·1,000·2,000 사용자 확인 필요). 예전 「광석」은 그대로 둠. 주간 손보기 광석 5 → 화강암 5(예전 광석도 셈).
- 채석장 §9: 네 조각(서쪽 입구·가운데·폭포 목 r151·동쪽), 바위 32개(88A 화강암 8·점토 7·석탄 6·철 5·구리 3·은·수정·금 1), 94B 확률(흔함·보통 85 %, 은·수정 40 %, 금 15 %), 다시 차는 시간 3·3·6·12시간. 에셋 140 결 덧씌움(광석 색 paint), 141 벽·수레·천막·선반, 143 단 면 r134.5/135.5·기중기·전망 발판(올라섬)·레일 132 m(67조각, 땅 따라 기울임)·돌 블록·작업등·밧줄 난간·광석 상자. 먼 모델 60 m 밖(lod). 143 배치의 밧줄 난간·말뚝·상자 3개는 실제 땅에서 절벽 아래라 뺌. 안내판은 능선 길 끝 그대로.
- 캐기 98B + 검토 §1-8: 휘두를 때마다 바위 면 금 5곳 중 하나가 빛남(1.0/0.8/0.6초), 누른 금과 빛난 뒤 ms를 서버가 판정(빛 + 여유 300 ms, 가운데 ±150 ms 보너스), 세 번 중 두 번이면 광석, 아니면 작은 돌·곡괭이만 닳음. 캐는 동안 카메라가 옆에서 바위를 봄, 마우스 잠금 풀림, 폰은 누르는 반경 72px. 시험 훅 /api/test/quarry/plan.
- asset-loader `paint`(재질 이름별 색), propBatch 기울임, 땅 지도 다시 구움(Q.edgeDist: 조각 이음 가장자리 없음).
- 고침: 도박장 쪽지 SPACE 자리를 벤치 앞 0.9 m로(dalmaru-walk unreachable), 147c 도박장 파일·결과 표 맞춤.
- 사진 notes img/ores-342.
