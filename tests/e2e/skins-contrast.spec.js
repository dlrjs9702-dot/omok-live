const { test, expect } = require('@playwright/test');
const { shopper, stoneContrast } = require('./skin-support');

// v1.10.269 시험 정리 (gamecenter-notes docs/test-audit-20261107.md §4, 총괄 「새 의존성 없이 e2e 한 테스트로」): every skin's
// legibility checks of the skin specs, one login, one page -- what each skin draws or colours, by the browser's own canvas
// (the art needs it). Each failure names its skin (soft: all of them reported). PC 전용.
test.skip(({ isMobile }) => isMobile, 'PC 전용 검증');

const ids = (family, list = ['c1', 'c2', 'c3', 'c4', 'c5', 'p1', 'p2', 'p3', 'l1', 'l2']) => list.map((i) => `${family}_${i}`);
// WCAG contrast of two CSS colours (a translucent one blended on the dark page)
const contrastOf = (page, fg, bg) => page.evaluate(([f, b]) => {
  const parse = (css) => { const c = document.createElement('canvas').getContext('2d'); c.fillStyle = '#0b1324'; c.fillRect(0, 0, 1, 1); c.fillStyle = css; c.fillRect(0, 0, 1, 1); const d = c.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]]; };
  const lin = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
  const lum = ([r, g, bl]) => .2126 * lin(r) + .7152 * lin(g) + .0722 * lin(bl);
  const [l1, l2] = [lum(parse(f)), lum(parse(b))].sort((x, y) => y - x);
  return (l1 + .05) / (l2 + .05);
}, [fg, bg]);
// a card back's mean luminance (the faces are light: about .95)
const backLum = (page, id, w, h) => page.evaluate(([skinId, W, H]) => {
  const d = window.SkinLooks.def(skinId); const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); d.art(x, W, H);
  const px = x.getImageData(0, 0, W, H).data; const lin = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
  let l = 0; let n = 0; for (let i = 0; i < px.length; i += 4) { l += .2126 * lin(px[i]) + .7152 * lin(px[i + 1]) + .0722 * lin(px[i + 2]); n += 1; }
  return l / n;
}, [id, w, h]);
// the mean colour a yut piece or dots line skin draws for each side (blue must lead for `black`, red for `white`)
const tint = (page, id, kind) => page.evaluate(([skinId, what]) => {
  const out = {};
  for (const side of ['black', 'white']) {
    const list = [];
    for (const label of what === 'piece' ? ['1', '2', '3', '4'] : ['']) {
      const c = document.createElement('canvas'); c.width = 240; c.height = 120; const x = c.getContext('2d');
      if (what === 'piece') { x.translate(120, 60); window.SkinLooks.paintStone(x, 40, skinId, side, label); } else window.SkinLooks.def(skinId).line(x, 20, 60, 220, 60, side);
      const d = x.getImageData(0, 0, 240, 120).data; let r = 0; let g = 0; let b = 0; let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n += 1; }
      list.push(n ? [r / n, g / n, b / n] : null);
    }
    out[side] = list;
  }
  return out;
}, [id, kind]);

test('스킨 판독 대비: 오목·사목·오델로 돌, 카드 뒷면, 글자 행, 표식·타일·도구 색, 윷·점과 상자 팀 색 — 모든 스킨', async ({ browser, request }) => {
  test.setTimeout(180000);
  const a = await shopper(browser, request, '대비'); const { page } = a; const soft = expect.soft;
  const def = async (id, pick) => pick(await page.evaluate((skinId) => JSON.parse(JSON.stringify(window.SkinLooks.def(skinId))), id)); /* (its colours -- the drawing functions left behind) */

  // 오목 흑·백 4:1 (공용 돌 5종 포함), 사목 3:1(빨강·노랑 기본 칩), 오델로 4:1
  for (const id of [...ids('omok'), 'omok_common_obsidian', 'omok_common_jade', 'omok_common_amber', 'omok_common_porcelain', 'omok_common_bronze']) soft(await stoneContrast(page, id), `${id} 흑·백`).toBeGreaterThanOrEqual(4);
  for (const [family, min] of [['connect4', 3], ['othello', 4]]) for (const id of ids(family)) soft(await stoneContrast(page, id), `${id} 두 진영`).toBeGreaterThanOrEqual(min);

  // 도둑잡기·고스톱 뒷면은 어둡다
  for (const id of ids('oldmaid')) soft(await backLum(page, id, 57, 77), `${id} 뒷면 평균 밝기`).toBeLessThan(.2);
  for (const id of ids('gostop')) soft(await backLum(page, id, 46, 68), `${id} 뒷면 평균 밝기`).toBeLessThan(.2);

  // 글자가 배경 위에서 또렷하다: 할리갈리 프레임, 라이어 말풍선·이름표, 스무고개 줄·Q/A, 숫자야구 숫자·램프
  for (const id of ids('halligalli')) { const d = await def(id, (s) => ({ bg: s.text.bg, text: s.text.color })); soft(await contrastOf(page, d.text, d.bg), `${id} 글자`).toBeGreaterThanOrEqual(4.5); }
  for (const id of ids('liar')) { const d = await def(id, (s) => ({ bg: s.text.bg, text: s.text.color, who: s.text.who })); soft(await contrastOf(page, d.text, d.bg), `${id} 글자`).toBeGreaterThanOrEqual(4.5); soft(await contrastOf(page, d.who, d.bg), `${id} 이름표`).toBeGreaterThanOrEqual(4.5); }
  for (const id of ids('twentyquestions')) {
    const d = await def(id, (s) => ({ bg: s.text.bg, text: s.text.color, q: [s.tagQ.color, s.tagQ.backgroundColor], a: [s.tagA.color, s.tagA.backgroundColor] }));
    soft(await contrastOf(page, d.text, d.bg), `${id} 글자`).toBeGreaterThanOrEqual(4.5); soft(await contrastOf(page, d.q[0], d.q[1]), `${id} Q`).toBeGreaterThanOrEqual(4.5); soft(await contrastOf(page, d.a[0], d.a[1]), `${id} A`).toBeGreaterThanOrEqual(4.5);
  }
  for (const id of ids('baseball')) {
    const d = await def(id, (s) => ({ bg: s.row.backgroundColor, digit: s.digit.color, lamps: [s.lamp.strike, s.lamp.ball, s.lamp.out], off: s.lamp.off }));
    soft(await contrastOf(page, d.digit, d.bg), `${id} 숫자`).toBeGreaterThanOrEqual(4.5);
    for (const lamp of d.lamps) soft(await contrastOf(page, lamp, d.bg), `${id} 램프`).toBeGreaterThanOrEqual(3);
    soft(await contrastOf(page, d.lamps[0], d.off), `${id} 켜짐과 꺼짐`).toBeGreaterThanOrEqual(3);
  }

  // 빙고: 칸 숫자가 표식 위에서도 3:1
  for (const id of ids('bingo')) {
    const ratio = await page.evaluate((skinId) => {
      const d = window.SkinLooks.def(skinId); const s = 96; const c = document.createElement('canvas'); c.width = s; c.height = s; const x = c.getContext('2d');
      x.fillStyle = '#fffdf6'; x.fillRect(0, 0, s, s); x.save(); x.translate(s * .06, s * .06); x.scale(.88, .88); d.mark(x, s); x.restore();
      const data = x.getImageData(s * .3, s * .3, s * .4, s * .4).data; const lin = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
      let l = 0; for (let i = 0; i < data.length; i += 4) l += .2126 * lin(data[i]) + .7152 * lin(data[i + 1]) + .0722 * lin(data[i + 2]); l /= data.length / 4;
      const tc = document.createElement('canvas').getContext('2d'); tc.fillStyle = d.text.color; tc.fillRect(0, 0, 1, 1); const t = tc.getImageData(0, 0, 1, 1).data;
      const tl = .2126 * lin(t[0]) + .7152 * lin(t[1]) + .0722 * lin(t[2]); return (Math.max(l, tl) + .05) / (Math.min(l, tl) + .05);
    }, id);
    soft(ratio, `${id} 표식 위 숫자`).toBeGreaterThanOrEqual(3);
  }

  // 다빈치: 타일 가운데(숫자 자리)는 비워 두고, 어두운·밝은 타일 7:1, 숫자 4.5:1
  for (const id of ids('davinci')) {
    const worst = await page.evaluate((skinId) => {
      const d = window.SkinLooks.def(skinId); let max = 0;
      for (const color of ['black', 'white']) for (const revealed of [true, false]) { const c = document.createElement('canvas'); c.width = 88; c.height = 120; const x = c.getContext('2d'); d.deco(x, color, revealed); const px = x.getImageData(26, 36, 36, 48).data; for (let i = 3; i < px.length; i += 4) max = Math.max(max, px[i] / 255); }
      return max;
    }, id);
    soft(worst, `${id} 가운데 장식 투명도`).toBeLessThanOrEqual(.2);
    const pal = await def(id, (s) => s.pal); const [dark1, dark2, darkText] = pal.black; const [light1, light2, lightText] = pal.white;
    const lums = await page.evaluate(([d1, d2, l1, l2]) => {
      const parse = (css) => { const c = document.createElement('canvas').getContext('2d'); c.fillStyle = css; c.fillRect(0, 0, 1, 1); const d = c.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]]; };
      const lin = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
      const lum = (css) => { const [r, g, b] = parse(css); return .2126 * lin(r) + .7152 * lin(g) + .0722 * lin(b); };
      return { dark: Math.max(lum(d1), lum(d2)), light: Math.min(lum(l1), lum(l2)) };
    }, [dark1, dark2, light1, light2]);
    soft((lums.light + .05) / (lums.dark + .05), `${id} 어두운/밝은 타일`).toBeGreaterThanOrEqual(7);
    for (const [text, body, name] of [[darkText, dark1, '어두운 위쪽'], [darkText, dark2, '어두운 아래쪽'], [lightText, light1, '밝은 위쪽'], [lightText, light2, '밝은 아래쪽']]) soft(await contrastOf(page, text, body), `${id} ${name} 숫자`).toBeGreaterThanOrEqual(4.5);
  }

  // 그림 맞히기: 도구가 고른 색(검정·빨강·파랑)을 지킨다
  for (const id of ids('pictionary')) {
    const r = await page.evaluate((skinId) => {
      const d = window.SkinLooks.def(skinId); const out = {};
      for (const [name, color] of [['black', '#111111'], ['red', '#e11d48'], ['blue', '#1d4ed8']]) {
        const c = document.createElement('canvas'); c.width = 300; c.height = 120; const x = c.getContext('2d'); x.fillStyle = '#fffdf6'; x.fillRect(0, 0, 300, 120);
        let px = 20; let py = 60; for (let i = 1; i <= 40; i += 1) { const nx = 20 + i * 6.5; const ny = 60 + Math.sin(i / 5) * 18; d.seg(x, px, py, nx, ny, color, 8); px = nx; py = ny; }
        const p = x.getImageData(0, 0, 300, 120).data; let rr = 0; let g = 0; let b = 0; let n = 0;
        for (let i = 0; i < p.length; i += 4) if (Math.abs(p[i] - 255) + Math.abs(p[i + 1] - 253) + Math.abs(p[i + 2] - 246) > 90) { rr += p[i]; g += p[i + 1]; b += p[i + 2]; n += 1; }
        out[name] = n ? [rr / n, g / n, b / n] : null;
      }
      return out;
    }, id);
    if (!r.black || !r.red || !r.blue) { soft(r, `${id} 그린 것 없음`).toBeNull(); continue; }
    soft(r.black[0] + r.black[1] + r.black[2], `${id} 검정은 어둡다`).toBeLessThan(300);
    soft(r.red[0], `${id} 빨강은 빨강 계열`).toBeGreaterThan(r.red[2] + 40); soft(r.red[0], `${id} 빨강`).toBeGreaterThan(r.red[1] + 50);
    soft(r.blue[2], `${id} 파랑은 파랑 계열`).toBeGreaterThan(r.blue[0] + 40);
  }

  // 윷 말·점과 상자 선: 선공 파랑, 후공 빨강
  for (const [list, kind] of [[ids('yut', ['c1', 'c2', 'c3', 'c4', 'c5', 'p1', 'p2', 'p3', 'l1']), 'piece'], [ids('dots', ['c1', 'c2', 'c3', 'c4', 'c5', 'p1', 'p2', 'p3', 'l1']), 'line']]) {
    for (const id of list) {
      const t = await tint(page, id, kind);
      for (const rgb of t.black) { soft(rgb, `${id} 선공`).not.toBeNull(); if (rgb) soft(rgb[2], `${id} 선공은 파랑 계열`).toBeGreaterThan(rgb[0]); }
      for (const rgb of t.white) { soft(rgb, `${id} 후공`).not.toBeNull(); if (rgb) soft(rgb[0], `${id} 후공은 빨강 계열`).toBeGreaterThan(rgb[2]); }
    }
  }
  await a.context.close();
});
