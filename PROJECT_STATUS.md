# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.281 문제 기록 1·2·4

- 마우스 잠금은 사용자가 푼 것만 꺼짐(게임이 푼 것은 다음 클릭·키에서 다시 잡음); 개명 신청 직원 「개명 담당」, 시장 안내 「말 걸기 · 마루」; 🚲 단추 없앰, 폰은 빠른 칸 자전거(서버 빠른 칸 bike), 😊 단추 🚲 자리. 다음: 282 움직이는 이모티콘(107b), 283 Codex 271~280 12건.

## v1.10.280 이모티콘·주민 소품 고침

- 279에서 깨진 WebP 3장(줄 끝 변환 스크립트) 원본으로, 모든 그림 WebP 확인 단위; 😊 판 flex:none·높이 max(220px, min(300px, 42vh))·격자 360px(820×900·1280×600 두 줄 e2e); 감정 표현 때 held 재질만 숨김(에셋 108, 44명 88파일, island-models held108). 다음: 움직이는 이모티콘(107b), 총괄 지시.

## v1.10.279 메신저 이모티콘

- 😊 판(이모티콘 24·그림 글자 120·최근 8), messages POST {sticker}(목록 검사 BAD_STICKER, 글자·사진과 같이 400), text는 「(이모티콘) 글」, messenger_messages.sticker 칸, 보내기 취소 때 지움, 말풍선 없는 그림(PC 120·폰 110, 시간 글자는 그림 옆), 그림 에셋 107 WebP. 다음: 280 감정 표현 때 몸 소품 사라짐(에셋 108 held 재질).
