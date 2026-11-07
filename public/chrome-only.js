// v1.10.263: the Chrome-only notice on an iPhone -- 「주소 복사」 copies this page's address (server.js sendChromeOnly)
document.getElementById('copyAddr')?.addEventListener('click', async (event) => {
  const input = document.getElementById('addr'); let ok = true;
  try { await navigator.clipboard.writeText(input.value); } catch { input.select(); try { ok = document.execCommand('copy'); } catch { ok = false; } }
  event.target.textContent = ok ? '복사했어요' : '길게 눌러 복사해 주세요'; /* (Codex 261-270 #13: not copied -- the address stays selected to copy by hand) */
});
