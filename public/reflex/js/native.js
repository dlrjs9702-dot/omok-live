// 네이티브(Capacitor) 연동 — 웹 브라우저에서는 조용히 대체 동작
// 앱 빌드 시 설치할 플러그인: @capacitor/app, @capacitor/haptics,
// @capacitor/status-bar, @capacitor/splash-screen
import { Settings } from './store.js';

const Cap = window.Capacitor;
const P = Cap?.Plugins || {};
export const isNative = !!Cap?.isNativePlatform?.();
// 진동을 쓸 수 있는 기기인지 (아이폰 사파리는 웹 진동을 지원하지 않는다)
export const canVibrate = isNative || typeof navigator.vibrate === 'function';

/* ---------- 진동 ---------- */
const VIB = { light: 8, medium: 18, heavy: 35, success: [12, 60, 18], error: [30, 50, 30] };
export function haptic(kind = 'light') {
  if (!Settings.get('haptics')) return;
  try {
    if (P.Haptics) {
      if (kind === 'success') return P.Haptics.notification({ type: 'SUCCESS' });
      if (kind === 'error') return P.Haptics.notification({ type: 'ERROR' });
      return P.Haptics.impact({ style: kind === 'heavy' ? 'HEAVY' : kind === 'medium' ? 'MEDIUM' : 'LIGHT' });
    }
    // 브라우저는 사용자가 한 번이라도 탭한 뒤에만 진동을 허용한다
    if (navigator.userActivation?.hasBeenActive !== false) navigator.vibrate?.(VIB[kind] ?? 10);
  } catch {}
}

/* ---------- 뒤로가기 ---------- */
// 핸들러 스택: 가장 마지막에 등록된 핸들러가 true를 반환하면 처리 완료
const backStack = [];
export function onBack(fn) {
  backStack.push(fn);
  return () => { const i = backStack.indexOf(fn); if (i >= 0) backStack.splice(i, 1); };
}
function handleBack() {
  for (let i = backStack.length - 1; i >= 0; i--) if (backStack[i]()) return true;
  return false;
}
export function exitApp() { P.App?.exitApp?.(); }

/* ---------- 앱 상태 (백그라운드 전환) ---------- */
const pauseSubs = new Set();
/** 앱이 백그라운드로 갈 때 호출. 해제 함수를 돌려준다 */
export const onAppPause = (fn) => { pauseSubs.add(fn); return () => pauseSubs.delete(fn); };

/* ---------- 앱 링크 (정원 초대 https://hanpanmadang.com/visit/#invite=…) ---------- */
// 처음 실행(getLaunchUrl)과 실행 중(appUrlOpen) 모두 'gc:openurl'로 알린다 — 처리는 main.js
// 시작 직후 두 경로로 같은 주소가 겹쳐 오는 것만 합치고(3초), 나중에 같은 링크를 다시 누르면 다시 연다
const recentUrls = new Map(); // 주소 → 받은 시각
export function openUrl(url, now = Date.now()) {
  if (!url) return false;
  if (now - (recentUrls.get(url) || -Infinity) < 3000) return false;
  recentUrls.set(url, now);
  dispatchEvent(new CustomEvent('gc:openurl', { detail: url }));
  return true;
}

export function initNative() {
  if (P.App) {
    P.App.addListener('appUrlOpen', (e) => openUrl(e?.url));
    P.App.getLaunchUrl?.().then((r) => openUrl(r?.url)).catch(() => {});
    // 처리할 화면이 없으면(예: 첫 화면) 앱을 닫는다
    P.App.addListener('backButton', () => { if (!handleBack()) exitApp(); });
    P.App.addListener('appStateChange', ({ isActive }) => { if (!isActive) pauseSubs.forEach((f) => f()); });
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseSubs.forEach((f) => f()); });
  // 웹 테스트용: Esc 키 = 뒤로가기
  addEventListener('keydown', (e) => { if (e.key === 'Escape') handleBack(); });

  try {
    P.StatusBar?.setStyle?.({ style: 'DARK' });
    P.StatusBar?.setBackgroundColor?.({ color: '#0B0C1A' });
  } catch {}
  setTimeout(() => P.SplashScreen?.hide?.({ fadeOutDuration: 250 }), 150);
}
