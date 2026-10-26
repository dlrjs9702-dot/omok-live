// U 섬 화면 테두리도 종이 (gamecenter-notes docs/island-hud-paper-20261026.md): what an island screen's always-there
// buttons and notes look like -- each shown for a moment if hidden, its paper and its text's contrast (WCAG)
const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const rgb = (s) => s.match(/[\d.]+/g).map(Number);
async function paperLooks(page, ids) {
  const looks = await page.evaluate((list) => list.map((id) => {
    const el = document.getElementById(id); const hidden = el.classList.contains('hidden'); const text = el.textContent;
    el.classList.remove('hidden'); if (!text.trim()) el.textContent = '시험';
    const cs = getComputedStyle(el); const out = { id, bg: cs.backgroundColor, fg: cs.color };
    el.textContent = text; if (hidden) el.classList.add('hidden'); return out;
  }), ids);
  return looks.map(({ id, bg, fg }) => { const b = rgb(bg); const paper = b[0] >= 240 && b[1] >= 220 && b[2] >= 195 && (b[3] ?? 1) >= 0.7; return { id, paper, contrast: Math.round(contrast(b.slice(0, 3), rgb(fg).slice(0, 3)) * 10) / 10 }; });
}
module.exports = { paperLooks };
