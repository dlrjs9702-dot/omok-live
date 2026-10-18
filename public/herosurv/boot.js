// v1.10.61 두 세계 영웅전: the Godot web export's own start-up script (moved out of the page: CSP allows no inline script),
// plus one fetch shim, as the original Manus page had one:
//  - the two large files (index.wasm, index.pck) come from the asset host named in the page (Cloudflare R2 behind a
//    Worker) under their sha256 names, so a new build never meets an old cached copy; with no host (local dev) they are
//    read next to this page,
//  - the game's leaderboard calls carry this tab's game-center session, so the server ranks the account by nickname.
(function () {
	const BIG = {
		'index.wasm': 'fc74679e3b97f76878947fcd4fbe1268cbfa6188182a2e33bbc3f5dc9bfa57d0.wasm',
		'index.pck': '132a93c0ea50dd1b7a04281aa148c257ad74ed13239ba1a5fcfc1bfaede4fed0.pck',
	};
	const assets = document.querySelector('meta[name="herosurv-assets"]').content;
	const realFetch = window.fetch.bind(window);
	window.fetch = function (input, init) {
		const url = typeof input === 'string' ? input : (input && input.url) || '';
		const file = url.split('?')[0].split('/').pop();
		if (assets && BIG[file]) return realFetch(`${assets}/herosurv/${BIG[file]}`, { ...init, credentials: 'omit' });
		if (/^\/api\/leaderboards\//.test(new URL(url, location.href).pathname)) {
			let token = '';
			try { token = sessionStorage.getItem('herosurvSession') || ''; } catch {} // set by the lobby button (app.js)
			const headers = new Headers(init && init.headers);
			headers.set('X-Session-Token', token);
			headers.delete('Authorization'); // the game's own guest token means nothing here
			return realFetch(input, { ...init, headers });
		}
		return realFetch(input, init);
	};
	// The game asks the page these through JavaScriptBridge.eval; the CSP allows no string eval, so they are answered here
	// (the two Manus flags as on a page without its history host). Anything else still goes to eval, and is refused.
	const ANSWERS = {
		"window.__MANUS_GAME_HISTORY__?.apiRoot || ''": () => '',
		'window.__MANUS_GAME_HISTORY__?.readOnly === true': () => false,
		'window.location.origin': () => location.origin,
		'window.location.pathname': () => location.pathname,
		'location.search': () => location.search,
	};
	const realEval = window.eval;
	window.eval = function (code) {
		return Object.hasOwn(ANSWERS, code) ? ANSWERS[code]() : realEval(code);
	};
}());

// The way back to the island. A run in progress is lost, so it asks first. Opened in the island's own window (사용자
// 2026-10-19), it just asks that window to close -- the island is still there, nothing loads again; a page opened on its
// own goes back to '/'. The button never keeps the focus: the game's keys (Space is the special move) stay with the canvas.
(function () {
	const exit = document.getElementById('herosurv-exit');
	exit.addEventListener('mousedown', (event) => event.preventDefault());
	exit.addEventListener('click', () => {
		if (!confirm('게임을 나가 아일랜드로 돌아갈까요?\n진행 중인 판은 기록되지 않습니다.')) { document.getElementById('canvas').focus(); return; }
		if (window.parent !== window) window.parent.postMessage({ type: 'herosurv-exit' }, location.origin);
		else location.href = '/';
	});
}());

// (사용자 2026-10-19) The game asks a name and a mail before its 명예의 전당 -- ours ranks by the game-center nickname, so
// the join is written in advance, where the game looks for it: its user storage (IndexedDB '/userfs', the Emscripten IDBFS
// entry shape), the file user://leaderboard_<the first 16 hex of sha256(api root)>.cfg with [guest] token, name,
// player_id, anon (scripts/net/online_leaderboard). The server never uses these values (the session header ranks).
// The game's own files are untouched.
function herosurvPrejoin() {
	const root = location.origin + '/api/leaderboards/v1';
	let nick = '게스트';
	try { nick = sessionStorage.getItem('herosurvName') || nick; } catch {}
	const esc = (v) => v.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
	const text = `[guest]\n\ntoken="gamecenter"\nname="${esc(nick)}"\nplayer_id="gamecenter"\nanon=false\n`;
	return crypto.subtle.digest('SHA-256', new TextEncoder().encode(root)).then((hash) => new Promise((resolve) => {
		const hex = [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
		const key = `/userfs/leaderboard_${hex}.cfg`;
		const req = indexedDB.open('/userfs', 21);
		req.onupgradeneeded = () => { const store = req.result.createObjectStore('FILE_DATA'); store.createIndex('timestamp', 'timestamp', { unique: false }); };
		req.onerror = () => resolve();
		req.onsuccess = () => {
			const db = req.result;
			try {
				const tx = db.transaction(['FILE_DATA'], 'readwrite'); const store = tx.objectStore('FILE_DATA');
				const got = store.get(key);
				got.onsuccess = () => { if (!got.result) store.put({ timestamp: new Date(), mode: 33206, contents: new TextEncoder().encode(text) }, key); };
				tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => { db.close(); resolve(); };
			} catch { db.close(); resolve(); }
		};
	})).catch(() => {});
}

const GODOT_CONFIG ={"args":[],"canvasResizePolicy":2,"emscriptenPoolSize":8,"ensureCrossOriginIsolationHeaders":true,"executable":"index","experimentalVK":true,"fileSizes":{"index.pck":72447648,"index.wasm":39514754},"focusCanvas":true,"gdextensionLibs":[],"godotPoolSize":4};
const GODOT_THREADS_ENABLED = false;
const engine = new Engine(GODOT_CONFIG);

(function () {
	const statusOverlay = document.getElementById('status');
	const statusProgress = document.getElementById('status-progress');
	const statusNotice = document.getElementById('status-notice');

	let initializing = true;
	let statusMode = '';

	function setStatusMode(mode) {
		if (statusMode === mode || !initializing) {
			return;
		}
		if (mode === 'hidden') {
			statusOverlay.remove();
			initializing = false;
			return;
		}
		statusOverlay.style.visibility = 'visible';
		statusProgress.style.display = mode === 'progress' ? 'block' : 'none';
		statusNotice.style.display = mode === 'notice' ? 'block' : 'none';
		statusMode = mode;
	}

	function setStatusNotice(text) {
		while (statusNotice.lastChild) {
			statusNotice.removeChild(statusNotice.lastChild);
		}
		const lines = text.split('\n');
		lines.forEach((line) => {
			statusNotice.appendChild(document.createTextNode(line));
			statusNotice.appendChild(document.createElement('br'));
		});
	}

	function displayFailureNotice(err) {
		console.error(err);
		if (err instanceof Error) {
			setStatusNotice(err.message);
		} else if (typeof err === 'string') {
			setStatusNotice(err);
		} else {
			setStatusNotice('An unknown error occurred.');
		}
		setStatusMode('notice');
		initializing = false;
	}

	const missing = Engine.getMissingFeatures({
		threads: GODOT_THREADS_ENABLED,
	});

	// (the export's service-worker fallback is left out: this build needs no cross-origin isolation, threads are off)
	if (missing.length !== 0) {
		displayFailureNotice('Error\nThe following features required to run Godot projects on the Web are missing:\n' + missing.join('\n'));
	} else {
		setStatusMode('progress');
		herosurvPrejoin().then(() => engine.startGame({
			'onProgress': function (current, total) {
				if (current > 0 && total > 0) {
					statusProgress.value = current;
					statusProgress.max = total;
				} else {
					statusProgress.removeAttribute('value');
					statusProgress.removeAttribute('max');
				}
			},
		})).then(() => {
			setStatusMode('hidden');
		}, displayFailureNotice);
	}
}());
