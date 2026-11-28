@AGENTS.md

# Claude 전용

공통 규칙은 위 AGENTS.md. 특정 파일에서만 필요한 규칙은 `.claude/rules/`(그 파일을 열 때만 읽힘).

- 시작할 때 `omok-live`·`gamecenter-notes` 둘 다 `git fetch` 후 `git pull --ff-only`. 기록 저장소는 고치기 직전에 다시 `git pull`하고 `main`에 직접 커밋한다. `omok-live`의 `main`에는 직접 커밋하지 않는다(`claude/…` 브랜치).
- Windows에서 한글 파일을 PowerShell 문자열 치환(`-replace`, `Set-Content`)으로 고치지 않는다. 편집 도구를 쓰고 인코딩을 확인한다.
- Codex 검토(AGENTS.md의 시점)는 diff를 프롬프트에 붙인 읽기 전용 작업으로 맡긴다(플러그인 `review`는 git을 못 써서 실패). 파일을 고치는 `/codex:rescue`로 코드 작업을 넘기지 않는다.
- 코드 작업을 시작할 때 맞는 모델을 한 줄 추천하고 바로 진행한다.
- 세션 대화·Claude 메모리·`CLAUDE.local.md`는 다른 환경에서 안 보인다. 인계할 것은 원격 브랜치와 `STATUS.md`에 남긴다.
- 저장소에 쓸 수 없는 환경(claude.ai 일반 채팅 등)에서는 Claude Code 작업 지시문이나 `IDEAS.md` 반영 문안만 만들고, 읽을 수 없는 기록을 추측하지 않는다.
- 코드 질문은 `graphify-out/graph.json`이 있으면 `graphify query "<질문>"`(`path`·`explain`)부터. 코드를 고친 뒤 `graphify update .`.
