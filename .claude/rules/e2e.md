---
paths:
  - "tests/e2e/**"
  - "playwright.config.*"
---

# e2e를 고치거나 돌릴 때

- 브라우저 실행 파일이 없다는 오류가 나면 `npx playwright install chromium` 후 다시 돌린다.
- 모바일 프로필의 `PC 전용 검증` 건너뜀은 정상이다. 자동 테스트(모바일 e2e)와 실제 휴대폰 확인은 따로 적는다.
