# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.214 주민 근무표 B — 주민 말씨 + Codex 검토 5차 고침

- island-cast RESIDENTS 27명 한 목록(걷는 10 + 자리 17: 이야기 주민 원래 번호, 마루 23·단비 24·한솔 25·새롬 26), WALKERS·KEEPERS·VOICES·FLAVOR·MOODS·CHATS는 여기서. voices 최종본(story/voices-20261029)을 스크립트로 옮김. REG rumor_* 14·q0~q5 + 새 말씨 goeun·cheori·garak·hao·hasyo(10 말씨 × 60 키). rumor(ctx, random, n)·questionLine(n, k)로 섬 소문·이야기 나눠요가 말한 주민 말씨로. say: own 키는 자기 말만. 김우성 통과 말은 passLine 그대로. shop·duty는 데이터만(C에서 씀).
- Codex 검토 5차(docs/codex-review-5-20261031.md): P2-1 메신저 새 방 첫 메시지 팝업, P2-2 알림 구독 옮기기(새 것 뒤에 옛 것 해지, 「알림 끄기」는 이 기기 구독까지), P3-1 가방 정리 때 든 칸 놓기, P3-2 pull peek 요청마다, P3-3 storyDoc 첫 읽기 경쟁, P3-4 저장 실패 반쪽(카운트다운 칭호·눈사람 unshown·이야기 장 unpaid), P3-5 창 세대 closeIfStill·이야기 책 마지막 탭, P3-6 방문 효과·천장 dispose, P3-7 사진 대상 화면 안 먼저.
- 시험: 단위 resident-voice(27명 × 60 키·어미 다름)·countdown·festival·island-story(시험 전용 /api/test/store/fail로 저장 실패 넣음), e2e resident-register(새)·messenger 셋·bag·story·view-modes(PC·폰).

## v1.10.213 주민 근무표 A — 주민 모습

- 에셋 88: 주민 27명의 근무·평상 모델(34 모습 × High/Low), 기존 걷는 주민 10명 교체(다리·손). island-assets RESIDENT_LOOKS·RESIDENT_AT·residentLook(post). 자리마다 그 주민: 퀘스트 주민(이야기별), 관공서 창구 셋(단비 0.28 m 발판), 시장 마루(island-townhall), 교도관 우성. dressResident가 headTop·resident 표시.
- 대화 카메라(총괄 검토 「내 머리가 주민을 가려요」): 내 오른쪽 4.2 m·뒤 1.5 m·내 머리 높이, 주민 키와 거리로 겨눔 — 머리 위쪽, 허리는 대화 카드 위. 큰 주민(가락 3.5 m)은 더 멀리. 퀘스트 주민은 자기 모델 기준(옆 가로등 제외). 펫샵 계산대는 전처럼.
- 성능(전·후 3번씩): 프레임 PC +5~11%·폰 +8%(흔들림 안), draw call −8%, 텍스처 −25%, 먼 주민 Low 확인(wearLod).
- 시험: e2e resident-looks(자리마다 모델, 대화 구도 talkFrame3 — 머리·허리·내 머리 옆), resident-perf(PERF=1), island-assets 제외 목록·단위 파이프라인 34 id. 디버그 wearLod·residentPosts·talkFrame3·seesWalker.

## v1.10.212 메신저 최소화 중 읽음 고침

- 메신저 6절(사용자 「최소화 해 놓아도 읽은걸로 처리되고 있는데」): GET messages에 `peek=1`이면 서버가 읽음을 건드리지 않음. 창을 안 보고 있을 때(hidden·!hasFocus) pull()이 peek, 창으로 돌아오면(focus·visibilitychange) 열린 방을 보통으로 한 번 다시 불러 그때 읽음 + 안 읽은 수 다시.
- 시험: 단위 messenger(peek이면 reads 그대로), e2e messenger(창 숨김 → 상대 글 → 보낸 쪽 「1」·내 안 읽은 수 1 그대로 → 창 보임 → 읽음, 고치기 전 코드로는 실패 확인).
