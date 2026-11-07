// v1.10.263: the Chrome-only notice on an iPhone -- 「주소 복사」 copies this page's address (server.js sendChromeOnly)
document.getElementById('copyAddr')?.addEventListener('click', async (event) => {
  const input = document.getElementById('addr');
  try { await navigator.clipboard.writeText(input.value); } catch { input.select(); document.execCommand('copy'); }
  event.target.textContent = '복사했어요';
});
