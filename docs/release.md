# 릴리스 절차

규칙은 [AGENTS.md](../AGENTS.md) §4~§6이 기준이다. 이 문서는 그 규칙을 실행 순서로 풀어 쓴 체크리스트이며, 둘이 어긋나면 AGENTS.md를 따른다. 릴리스는 Claude Code(로컬·클라우드)가 진행하며(AGENTS.md §8), 환경에 관계없이 같은 순서를 따른다.

## 목적
사용자에게 보이는 변경을 `main`에 병합하고 Render 운영 배포까지 확인한 뒤, 기록 두 곳(`PROJECT_STATUS.md`, 비공개 `STATUS.md`)을 맞춘다.

## 시작 조건
- 사용자 구현·패치 지시 또는 `IDEAS.md` 확정 결정이 있다.
- 비공개 `STATUS.md`에서 같은 브랜치의 다른 담당이 없음을 확인했다. 시작 시 담당·브랜치·기준 main SHA를 `진행 중`에 기록·푸시한다.
- 로컬 `main`을 원격과 맞췄다: `git fetch && git switch main && git pull --ff-only`

## 입력
- 새 버전 `X.Y.Z`(현재 `package.json` 버전의 다음), 사용자 표시 변경 목록, 작업 브랜치 이름

## 단계
1. **브랜치**: `main`에서 작업 브랜치를 만든다. 문서만 바꾸면 버전을 올리지 않고 5·9단계의 문서 규칙만 따른다.
2. **구현·화면**: 화면을 바꾸면 먼저 `DESIGN.md`를 읽는다.
3. **버전 동기화**: 이전 버전 문자열을 모두 새 버전으로 바꾼다. 현재 위치:
   - `package.json`, `package-lock.json`(상단 2곳)
   - `server.js`: `/health`의 `version`, 시작 로그 `게임 서버 vX.Y.Z 실행`
   - 코드 캐시 버스팅은 v1.10.24부터 서버가 내용 해시(`?h=`)로 자동 처리한다(`lib/code-manifest.js`). `index.html`·모듈 import에 `?v=`를 다시 넣지 않는다(`test/release-version.test.js`가 검사).
   - `test/*.test.js`의 고정 버전(`health.data.version` 등). 점을 이스케이프한 형태(`1\.7\.25`)가 생길 수 있으니 둘 다 찾는다.
   - 기능 주석(`// vX.Y.Z: …`), `PROJECT_STATUS.md`, 과거 공지는 바꾸지 않는다.
   - 확인(예: 이전 버전 1.7.25): `git grep -nF "1.7.25"`와 `git grep -nF '1\.7\.25'` 결과에 주석·공지·기록만 남아야 한다.
4. **공지**: `lib/release-announcements.js` 끝에 새 항목 하나만 추가한다(`key: 'vX.Y.Z'`, `[개선]`/`[수정]` 제목, 실제로 바꾼 것만 쓴 짧은 본문, `publishedAt`). 목록은 `key`의 버전 순으로 정렬되므로 시각으로 순서를 맞출 필요는 없다(`lib/announcement-store.js` `compareAnnouncements`). 미래 시각도 숨겨지지 않는다.
5. **기술 기록**: `PROJECT_STATUS.md`의 「코드 위치 참고」 아래에 `## vX.Y.Z 요약` 절을 추가한다(지시·원인·변경·제외·검증). 버전 절이 3개를 넘으면 가장 오래된 절을 비공개 `gamecenter-notes/archive/기술기록-PROJECT_STATUS.md` 맨 위(설명 아래)로 옮긴다. 문서 PR은 필요할 때만.
6. **검증**(AGENTS §5):
   - 바꾼 JS `node --check`, `git diff --check`
   - `npm test` 전체. 의존성 누락 오류(예: `three`)면 `npm ci` 후 재실행
   - 변경 기능 확인 한 가지(관련 `npm run test:e2e` 스펙 또는 로컬 서버 화면 확인). 브라우저 실행 파일 오류면 `npx playwright install chromium`
   - 화면·동작이 바뀌는 묶음: 작업 PC에서 `npm run dev`로 띄워 확인하고, 사용자가 볼 확인 체크리스트(3~5줄)를 PR 본문과 `STATUS.md`에 적는다. 독립된 수정은 번호별 커밋으로 나눈다.
   - Codex 읽기 전용 검토: 위험한 변경은 즉시, 일반 변경은 PR을 열기 직전에 묶어서 번호당 1회. 사용량이 없어 남은 `Codex 검토 대기` 번호가 있으면 PR 전에 다시 시도하고, 안 되면 사용자에게 묻는다(AGENTS.md §8).
   - 실행하지 못한 검증은 사유와 함께 기록한다.
7. **커밋·PR**: 원격 작업 브랜치에 푸시하고 Draft PR을 만든다. 제목 `[vX.Y.Z] 요약`(문서만: `[docs] 요약`), 본문에는 변경·제외·검증과 비공개 `STATUS.md` 링크만 둔다. `STATUS.md`에 마지막 원격 SHA와 PR 번호를 갱신한다.
8. **CI**: GitHub Actions `Playwright E2E`(정적 검사, `npm test`, `npm run test:e2e`)가 성공해야 한다. PR에서는 `pull_request`로 한 번만 돈다(작업 브랜치 push로는 돌지 않음, 2026-10-05 #153). 병합 뒤 `main` push로 한 번 더 돈다. 실패하면 병합하지 않는다. 준비되지 않은 중간 변경으로 PR CI를 반복하지 않도록, 묶음을 완성한 뒤 Draft PR을 연다. E2E가 반복해서 35분을 넘거나 40분 제한으로 취소되면 제한만 늘리지 말고 2개 작업으로 나눈다(shard). v1.10.32부터 E2E는 `shard 1/2`·`2/2` 두 작업이 함께 돌고(정적 검사·`npm test`는 1번에서만), 모든 묶음이 성공해야 한다. v1.10.47부터는 일반 PC 2분할·실물 에셋·광장을 각각 실행하는 4묶음으로 나누고, 기존 모바일 프로젝트는 전체 실행한다.
9. **병합**: 사용자 승인 범위 안에서 Ready for review로 바꾼 뒤 squash 병합한다(기존 관례). 화면·동작이 바뀌는 묶음은 `STATUS.md`를 `확인대기`로 두고 사용자가 체크리스트를 확인한 뒤 병합한다(일부 번호만 고쳐 달라고 하면 그 번호만 고치고 다시 확인). 사용자가 "확인 없이 올려"라고 했거나 눈으로 볼 변경이 없으면 바로 진행한다(AGENTS.md §4). 코드 변경이 있으면 병합 커밋에 `[skip render]`를 넣지 않는다. 문서만 바뀐 PR은 **실제 병합 커밋 메시지**에 `[skip render]`를 넣는다.
10. **배포 확인**(AGENTS §6): Render 서비스 `omok-live`의 배포 기록을 직접 조회한다.
    - 새 main SHA의 배포가 `live`, 로그에 `omok-live@X.Y.Z start`·`게임 서버 vX.Y.Z 실행`·저장소 PostgreSQL 줄
    - 운영 `https://omok-live.onrender.com/health`가 `{"ok":true,"version":"X.Y.Z"}`
    - 문서 PR은 배포 대신 Render에 건너뛰기(`commit_ignored`) 기록을 확인한다.
11. **마무리**: 로컬 `main`을 pull하고 작업 브랜치를 `git branch -d`로 지운다(squash라 경고가 나와도 원격 병합 확인 후 삭제되면 정상). 비공개 `STATUS.md`의 항목을 `최근 완료` 맨 위로 옮기고(최신 3개만 유지, 넘치는 것은 `archive/STATUS-이력.md` 맨 위로) `진행 중`을 정리해 푸시한다. 이번 릴리스로 남은 일이 하나도 없게 된 비공개 `IDEAS.md` 절은 `archive/IDEAS-완료-이력.md`로 옮기고(일부만 끝난 절은 완료 표시만, 계속 유효한 규칙·경제 기준은 `reference/게임-규칙-경제.md`로), 옮긴 절을 가리키는 링크를 고친다.

## 출력
- 병합된 `main` 커밋, Render 배포 ID·상태, 갱신된 `PROJECT_STATUS.md`·`STATUS.md`

## 완료 기준
- 보고에 `코드 준비 / GitHub 반영 / 배포 시작 / 배포 완료 / 실기 미검증 / 실기 검증`을 사실대로 구분했다.
- `STATUS.md` 완료 항목에 PR·마지막 작업 브랜치 SHA·최종 main SHA·검증 결과·Render 배포 ID와 로그·실기 여부가 있다.

## 예외
- CI 실패, 병합 충돌, 배포 실패: 병합·다음 단계를 멈추고 `STATUS.md`에 상태와 다음 행동 하나를 적어 사용자에게 보고한다.
- 병합 승인이 불명확하면 병합 전에 확인한다. 이전 결정(`IDEAS.md`, 과거 릴리스 기록)과 충돌하는 지시는 구현 전에 확인한다.
- 작업을 멈추거나 다른 환경으로 넘길 때는 푸시 후 `STATUS.md`에 `인계대기`와 다음 행동을 남긴다(AGENTS §4 정상 교대).

## 게임 리소스 캐시 롤백 (v1.10.14~)
브라우저에 남는 Service Worker·Cache Storage까지 되돌려야 완전한 롤백이다. Git/Render와 사용자 Chrome을 따로 처리한다.
1. **브라우저 쪽 끄기(코드 수정 없음)**: Render 환경변수 `ASSET_CACHE=off` 저장 → 재시작 후 `/asset-cache.json`이 `{"enabled":false}`. 이후 접속하는 페이지는 새 다운로드를 하지 않고, 워커를 해제하고 `gc-res:` 이름의 캐시만 지운 뒤 기존처럼 서버에서 리소스를 받는다. 다른 사이트 데이터·로그인 정보는 건드리지 않는다. 다시 켜려면 변수를 지운다.
2. **코드 되돌리기**: 필요하면 이전 버전을 재배포한다. 1을 건너뛰어도, 남은 워커는 `?rev=` 주소만 처리하므로 이전 코드에 영향이 없고, 첫 페이지 로드 때 `/asset-cache.json`이 404면 캐시를 지우고 스스로 해제된다. v1.10.22(단일 `gc-res:files` 캐시)에서 v1.10.14~21로 되돌리면 그 코드는 `gc-res:files`에서 새 팩을 복사해 만들고 `gc-res:files`는 남는다(무해, 1번이나 다시 v1.10.22 이상에서 정리).
3. **3D 모델 하나만 끄기(v1.10.15~)**: Render 환경변수 `ISLAND_ASSETS_OFF`에 대상 id를 쉼표로(예: `facility.townhall,character.player`, 전부는 `*`) 넣고 재시작하면 그 대상만 코드 생성형 외형으로 돌아간다. 리소스 캐시·게임은 그대로.
