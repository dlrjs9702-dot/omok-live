const { test, expect } = require('@playwright/test');

// IDEAS 백로그 10: 오델로 원판이 뒤집힐 때 색은 원판이 옆면(가장 얇은 순간)을 지날 때 바뀌어야 한다.
// 그리기 함수의 순수한 자세 계산(othelloFlipPose)을 0~1 진행 전체에서 확인한다.
test('오델로 뒤집기: 색은 옆면에서 한 번만 바뀌고, 시작은 이전 색·끝은 새 색의 온전한 원판이다', async ({ page }) => {
  await page.goto('/');
  for (const color of ['black', 'white']) {
    const other = color === 'black' ? 'white' : 'black';
    const result = await page.evaluate((finalColor) => {
      const poses = [];
      for (let i = 0; i <= 100; i += 1) poses.push({ flip: i / 100, ...window.OthelloFlipPose(i / 100, finalColor) });
      return poses;
    }, color);
    expect(result[0].face).toBe(other); // 뒤집기 시작: 이전 색
    expect(result[0].squash).toBeGreaterThan(.95);
    const last = result[result.length - 1];
    expect(last.face).toBe(color); // 끝: 새 색, 온전한 크기
    expect(last.squash).toBeGreaterThan(.95);
    const changes = result.flatMap((pose, i) => (i > 0 && pose.face !== result[i - 1].face ? [{ before: result[i - 1], after: pose }] : []));
    expect(changes).toHaveLength(1); // 한 번만 바뀐다
    // 바뀌는 순간의 원판은 거의 옆면(가장 얇음)이어야 한다(예전에는 진행률 0.5, 즉 이미 90% 넓이).
    expect(changes[0].before.squash).toBeLessThan(.2);
    expect(changes[0].after.squash).toBeLessThan(.2);
  }
});
