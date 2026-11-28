---
paths:
  - "package.json"
  - "package-lock.json"
  - "server.js"
  - "lib/release-announcements.js"
  - "PROJECT_STATUS.md"
  - "docs/release.md"
---

# 릴리스 파일을 고칠 때

- 먼저 `docs/release.md` 체크리스트를 읽고 그 순서대로 한다(버전 동기화 위치 · 공지 · 기술 기록 · PR · CI · 병합 · Render 확인 · 기록).
- 버전은 `package.json`·`package-lock.json`·`server.js`(/health · 시작 로그)·테스트의 고정 버전 문자열을 함께 맞춘다. 점을 이스케이프한 형태(`1\.10\.x`)도 찾는다. 캐시 버스팅은 서버 내용 해시(`?h=`)라 `?v=`를 쓰지 않는다.
- `lib/release-announcements.js`에는 이번 릴리스의 새 항목만 더하고 과거 공지는 고치지 않는다. 실제 배포할 사용자 표시 변경만 짧게 쓴다.
- `PROJECT_STATUS.md`는 최근 3개 버전만 둔다. 넘치는 가장 오래된 절은 비공개 `archive/기술기록-PROJECT_STATUS.md` 맨 위로 옮긴다.
