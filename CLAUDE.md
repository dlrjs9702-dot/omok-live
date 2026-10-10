# Claude 전용 작업 지침

공통 작업·기록·교대 규칙은 먼저 [AGENTS.md](AGENTS.md)를 읽고 따른다. 이 파일은 Claude 환경에서만 필요한 차이를 설명한다.

## claude.ai 일반 채팅

- 현재 확인된 환경에서는 공개 `omok-live`를 읽을 수 있지만 저장소 쓰기와 비공개 `gamecenter-notes` 읽기는 사용할 수 없다. 접근 가능 여부는 세션에서 확인한다. 접근할 수 없는 기록의 상태를 추측하거나 수정했다고 보고하지 않는다.
- 이 환경에서 구현·기록이 필요하면 사용자에게 전달할 단일 Claude Code 작업 지시문 또는 `IDEAS.md` 반영 문안을 작성한다. 사용자가 요청한 단순 아이디어 논의는 구현 요청으로 바꾸지 않는다.

## Claude Code

- claude.ai/code에서 새 세션을 시작할 때 omok-live와 gamecenter-notes를 함께 선택한다(2026-09-24 동시 연결과 gamecenter-notes 실제 쓰기 확인). 저장소를 연결하지 않고 시작한 세션은 비공개 기록을 읽을 수 없으므로, 기록 확인이 필요하면 두 저장소를 연결한 새 세션에서 작업한다.
- 코드를 고칠 때는 기록 저장소 `STATUS.md`의 담당과 마지막 원격 SHA를 확인한다. 새 작업에는 세션이 자동 생성한 `claude/…` 브랜치를 사용할 수 있지만, 이어받을 때는 기록된 기존 브랜치를 체크아웃한다. 코드 저장소 `omok-live`의 `main`에는 바로 커밋하지 않는다. 기록 저장소 `gamecenter-notes`는 AGENTS.md §3에 따라 `main`에 직접 커밋한다.
- 세션이 임시 환경이므로 의미 있는 단계마다 코드를 원격 작업 브랜치에 커밋·푸시한다. `STATUS.md`는 시작·중단·교대·완료 때 갱신한다. 기존 브랜치 이어받기나 PR 수정 등 사용하지 않았던 기능은 그 작업에서 접근 가능 여부를 확인한다.
- 코드 작업을 시작할 때 작업 규모에 맞는 모델 추천을 한 줄로 적고 현재 세션에서 바로 진행한다. 사용자가 모델 변경을 요구한 경우만 기다린다.
- 코드 변경을 PR로 올리기 전에 Codex 검토가 필요하면 codex 플러그인의 `/codex:review`(읽기 전용)를 쓴다. 파일을 수정하는 `/codex:rescue`로 코드 작업을 넘기지 않는다(AGENTS.md §8).
- Windows에서 한글 파일을 PowerShell 문자열 치환(`-replace`, `Set-Content` 등)으로 수정하지 않는다. 파일 편집 도구를 사용하고 인코딩을 확인한다.

### 로컬 Windows 터미널

- 로컬 작업 폴더는 `C:\Users\dlrjs\Desktop\아일랜드`의 `omok-live`·`gamecenter-notes`다(AGENTS.md §8). 로컬 저장소는 다른 환경의 병합을 자동으로 받지 않으므로, 작업을 시작할 때 두 폴더 모두 `git fetch` 후 `git pull --ff-only`로 원격과 맞춘다.
- 기록 저장소는 위 폴더의 `gamecenter-notes`를 쓰고 고치기 직전에 `git pull`한다(그 폴더가 없는 환경만 `gh repo clone dlrjs9702-dot/gamecenter-notes`로 세션 임시 폴더에 받는다). 새 복사본에 커밋 작성자가 없으면 `omok-live`의 `user.name`·`user.email`을 그 저장소에만 설정한다. `commit-graph` 쓰기 오류는 커밋·푸시와 무관하므로 `git status -sb`로 원격 반영만 확인한다.
- e2e에서 브라우저 실행 파일이 없다는 오류가 나면 `npx playwright install chromium` 후 다시 실행한다. 모바일 프로필의 `PC 전용 검증` 건너뜀은 정상이다.
- 자동 모드의 PR 병합에는 `/permissions`의 `Bash(gh pr merge:*)`·`Bash(gh pr ready:*)` 허용이 필요하다. 없으면 병합 직전에 멈추고 사용자에게 추가를 요청한다.
- 세션 대화·로컬 설정·Claude 메모리·`CLAUDE.local.md`는 다른 환경(Codex, 클라우드 Claude Code, GPT 채팅·Work)에서 보이지 않는다. 인계에 필요한 내용은 원격 브랜치와 `STATUS.md`에 남긴다.

Claude 프로젝트 지침에는 `AGENTS.md`와 이 파일을 따르라는 안내 및 실제 세션 접근 제한만 둔다. 과거 「Idea Storage/아이디어 저장」 대화는 기준 기록으로 삼지 않는다.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
