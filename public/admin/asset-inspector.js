// v1.10.90 에셋 점검실 (IDEAS #future-admin-console ③, 사용자 확정): every asset the game has registered, by kind -- 3D
// models turned and zoomed in their own small scene (High/Low, the season's file, beside a base character for size, day or
// night light), motions played on the base body (play/stop, speed, frame by frame, the clip's events), the drawn pictures
// (game cards, item icons, 도감) -- and a note on each (status, memo, the view at that moment) that the server keeps; the
// 수정 요청 notes go out as a draft Codex order. Loaded only when the administrator opens it (the island is untouched).
import * as THREE from '/vendor/three/three.module.js';
import { GLTFLoader } from '/vendor/three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from '/vendor/three/addons/libs/meshopt_decoder.module.js';

const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const KIND_NAMES = { character: '캐릭터·주민', wear: '의상·스킨 부품', facility: '건물·시설', cottage: '집', townhall: '관공서', prop: '소품', deco: '장식', nature: '자연', tree: '나무',
  ground: '바닥', path: '길', sea: '바다', struct: '구조물', train: '열차', fishing: '낚시 도구', fish: '물고기', farm: '농부 밭', quest: '퀘스트 소품', halloween: '할로윈', landmark: '광장 상징', fx: '효과' };
const urlOf = (entry, low, season) => {
  const e = low ? entry.low : entry; if (!e) return null;
  return (season && typeof e.seasons?.[season] === 'string' && e.seasons[season]) || (typeof e.url === 'string' ? e.url : null) || (e.seasons && Object.values(e.seasons).find((u) => typeof u === 'string')) || null;
};

export function mountInspector(host, { api, toast }) {
  const R = globalThis.IslandAssets?.REGISTRY || {};
  const base = R['character.base'] || {};
  const motions = Object.entries(base.clips || {}); // [name, url]
  const kinds = {};
  for (const id of Object.keys(R)) { if (!urlOf(R[id], false, 'summer')) continue; const k = id.split('.')[0]; (kinds[k] ||= []).push(id); }
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  host.replaceChildren();
  const side = el('div', 'inspectSide'); const stage = el('div', 'inspectStage'); host.append(side, stage); host.classList.add('assetInspector');
  // the list: kind tabs (+ 모션 and 그림), a search, the ids
  const tabs = el('div', 'skinChips'); const search = el('input', 'skinSearch'); search.type = 'search'; search.placeholder = '이름으로 찾기';
  const list = el('ol', 'inspectList'); side.append(tabs, search, list);
  const groups = [...Object.keys(kinds).sort((a, b) => kinds[b].length - kinds[a].length).map((k) => [k, `${KIND_NAMES[k] || k} ${kinds[k].length}`]), ['motion', `모션 ${motions.length}`], ['svg', '그림']];
  let group = groups[0][0]; let pictures = null; let notes = {};
  for (const [k, label] of groups) { const b = el('button', 'ghost tiny skinChip', label); b.type = 'button'; b.dataset.group = k; b.addEventListener('click', () => { group = k; drawList(); }); tabs.append(b); }
  // the stage: a canvas, its controls, the note
  const canvas = el('canvas', 'inspectCanvas'); const bar = el('div', 'inspectBar'); const motionBar = el('div', 'inspectBar hidden');
  const noteBox = el('form', 'inspectNote'); stage.append(canvas, bar, motionBar, noteBox);
  const title = el('strong', 'inspectTitle', '왼쪽에서 에셋을 고르세요');
  const lowBtn = el('button', 'ghost tiny', 'High'); lowBtn.type = 'button';
  const seasonSel = el('select'); for (const s of SEASONS) { const o = el('option', null, { spring: '봄', summer: '여름', autumn: '가을', winter: '겨울' }[s]); o.value = s; seasonSel.append(o); } seasonSel.value = 'summer';
  const refBtn = el('button', 'ghost tiny', '기준 캐릭터'); refBtn.type = 'button'; refBtn.setAttribute('aria-pressed', 'true');
  const nightBtn = el('button', 'ghost tiny', '밤 조명'); nightBtn.type = 'button'; nightBtn.setAttribute('aria-pressed', 'false');
  bar.append(title, lowBtn, seasonSel, refBtn, nightBtn);
  const playBtn = el('button', 'ghost tiny', '멈춤'); playBtn.type = 'button';
  const speedSel = el('select'); for (const v of ['0.25', '0.5', '1', '2']) { const o = el('option', null, `${v}배`); o.value = v; speedSel.append(o); } speedSel.value = '1';
  const frame = el('input'); frame.type = 'range'; frame.min = '0'; frame.max = '1000'; frame.value = '0'; frame.setAttribute('aria-label', '프레임');
  const timeText = el('span', 'smallMuted', '0.00초'); const events = el('span', 'smallMuted');
  motionBar.append(playBtn, speedSel, frame, timeText, events);
  const status = el('select'); for (const [v, t] of [['', '상태 없음'], ['check', '확인 필요'], ['fix', '수정 요청'], ['ok', '확인 완료']]) { const o = el('option', null, t); o.value = v; status.append(o); }
  const memo = el('textarea'); memo.rows = 3; memo.maxLength = 1000; memo.placeholder = '고칠 점·확인한 점 (예: 왼쪽 소매가 몸을 뚫음, 2.1초)';
  const save = el('button', 'primary tiny', '메모 저장'); save.type = 'submit';
  const exportBtn = el('button', 'ghost tiny', '수정 요청 → Codex 주문서 초안'); exportBtn.type = 'button';
  const filter = el('select'); for (const [v, t] of [['', '메모 모두'], ['check', '확인 필요'], ['fix', '수정 요청'], ['ok', '확인 완료']]) { const o = el('option', null, t); o.value = v; filter.append(o); }
  const noteList = el('ul', 'inspectNotes');
  noteBox.append(status, memo, save, exportBtn, filter, noteList);

  // the scene
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 400);
  const hemi = new THREE.HemisphereLight(0xfff4dc, 0x8cc970, 1.6); const sun = new THREE.DirectionalLight(0xfff0d2, 2); sun.position.set(4, 8, 6); scene.add(hemi, sun);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 48), new THREE.MeshStandardMaterial({ color: 0xcfe3b8, roughness: 1 })); floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const grid = new THREE.GridHelper(20, 20, 0x8aa070, 0xb0c69a); grid.position.y = 0.002; scene.add(grid);
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder); const files = new Map();
  const load = (url) => { if (!files.has(url)) files.set(url, new Promise((ok, no) => loader.load(url, ok, undefined, no))); return files.get(url); };
  let view = { yaw: 0.6, pitch: 0.35, dist: 4, target: new THREE.Vector3(0, 0.9, 0) };
  let shown = null; let ref = null; let mixer = null; let action = null; let clipLen = 0; let playing = true; let current = null; let low = false;
  const fit = (object) => { const box = new THREE.Box3().setFromObject(object); const size = box.getSize(new THREE.Vector3()); const r = Math.max(size.x, size.y, size.z, 0.3); view.dist = r * 2.2; view.target.set(0, Math.max(0.2, size.y / 2), 0); };
  async function showRef() { // the base body standing beside, for size (1 m to the left of the thing)
    if (ref) { scene.remove(ref); ref = null; }
    if (refBtn.getAttribute('aria-pressed') !== 'true' || current?.kind === 'motion' || !base.url) return;
    const g = await load(base.url).catch(() => null); if (!g) return;
    ref = g.scene.clone(true); scene.add(ref);
    const box = new THREE.Box3().setFromObject(shown || new THREE.Object3D()); ref.position.x = (Number.isFinite(box.min.x) ? box.min.x : 0) - 0.7;
  }
  async function show(item) {
    current = item; title.textContent = item.label; if (shown) { scene.remove(shown); shown = null; } mixer = null; action = null;
    motionBar.classList.toggle('hidden', item.kind !== 'motion');
    try {
      if (item.kind === 'motion') {
        const [body, clipFile] = await Promise.all([load(base.url), load(item.url)]);
        if (current !== item) return;
        shown = body.scene.clone(true); scene.add(shown); // (facing the camera)
        const clip = clipFile.animations[0]; mixer = new THREE.AnimationMixer(shown); action = mixer.clipAction(clip); action.play(); clipLen = clip.duration;
        const ev = clipFile.parser?.json?.animations?.[0]?.extras?.events || clipFile.parser?.json?.extras?.events || [];
        events.textContent = ev.length ? `이벤트: ${ev.map((e) => `${e.event} ${Number(e.time).toFixed(2)}초`).join(' · ')}` : '';
        fit(shown); view.dist = 3.2;
      } else {
        const url = urlOf(R[item.id], low, seasonSel.value); if (!url) { toast('Low 파일이 없습니다.'); low = false; lowBtn.textContent = 'High'; return; }
        const g = await load(url); if (current !== item) return;
        shown = g.scene.clone(true); if (R[item.id].rotationY) shown.rotation.y = R[item.id].rotationY; if (R[item.id].scale) shown.scale.setScalar(R[item.id].scale);
        scene.add(shown); fit(shown);
        if (g.animations?.length) { mixer = new THREE.AnimationMixer(shown); action = mixer.clipAction(g.animations[0]); action.play(); clipLen = g.animations[0].duration; motionBar.classList.remove('hidden'); }
      }
      title.textContent = `${item.label} · 삼각형 ${triangles(shown).toLocaleString('ko-KR')}`;
      showRef(); drawNote();
    } catch (error) { title.textContent = `${item.label} · 불러오지 못함 (${error.message || error})`; }
  }
  const triangles = (o) => { let n = 0; o.traverse((m) => { if (m.isMesh) n += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3; }); return Math.round(n); };
  function showPicture(item) {
    current = item; if (shown) { scene.remove(shown); shown = null; } if (ref) { scene.remove(ref); ref = null; } mixer = null; motionBar.classList.add('hidden');
    title.textContent = item.label;
    const img = new Image(); img.onload = () => {
      const c = document.createElement('canvas'); c.width = 512; c.height = 512; const x = c.getContext('2d');
      x.fillStyle = '#fff7ea'; x.fillRect(0, 0, 256, 512); x.fillStyle = '#0b1220'; x.fillRect(256, 0, 256, 512); // the two backgrounds
      for (const [cx, s] of [[64, 128], [192, 32], [320, 128], [448, 32]]) x.drawImage(img, cx - s / 2, 256 - s / 2, s, s);
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      shown = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: tex })); shown.position.y = 1; scene.add(shown);
      view = { yaw: 0, pitch: 0, dist: 2.6, target: new THREE.Vector3(0, 1, 0) };
    };
    img.src = item.url; drawNote();
  }
  function drawList() {
    for (const b of tabs.children) b.classList.toggle('selected', b.dataset.group === group);
    const q = search.value.trim().toLowerCase();
    const items = group === 'motion' ? motions.map(([name, url]) => ({ kind: 'motion', id: `motion.${name}`, label: name, url }))
      : group === 'svg' ? (pictures || []).map((p) => ({ kind: 'svg', id: `svg.${p}`, label: p.split('/').pop(), url: p }))
      : kinds[group].map((id) => ({ kind: 'model', id, label: id }));
    if (group === 'svg' && !pictures) api('/api/admin/assets/pictures').then((d) => { pictures = d.files; drawList(); }).catch((e) => toast(e.message));
    list.replaceChildren(...items.filter((i) => !q || i.label.toLowerCase().includes(q)).map((i) => {
      const li = el('li'); const b = el('button', `ghost tiny${notes[i.id]?.status ? ` note-${notes[i.id].status}` : ''}`, i.label); b.type = 'button';
      b.addEventListener('click', () => (i.kind === 'svg' ? showPicture(i) : show(i))); li.append(b); return li;
    }));
  }
  function drawNote() {
    const n = notes[current?.id] || {}; status.value = n.status || ''; memo.value = n.memo || '';
    const all = Object.entries(notes).filter(([, x]) => !filter.value || x.status === filter.value).sort((a, b) => b[1].at - a[1].at);
    noteList.replaceChildren(...all.map(([id, x]) => { const li = el('li'); li.append(el('strong', '', id), el('span', `smallMuted note-${x.status}`, ` ${{ check: '확인 필요', fix: '수정 요청', ok: '확인 완료' }[x.status] || ''}`), el('p', '', x.memo || '')); if (x.shot) { const im = el('img'); im.src = x.shot; im.alt = ''; im.width = 160; li.append(im); } return li; }));
  }
  const shot = () => { const c = document.createElement('canvas'); c.width = 320; c.height = Math.round(320 * canvas.height / canvas.width); c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.7); };
  noteBox.addEventListener('submit', async (event) => {
    event.preventDefault(); if (!current) return;
    const body = { id: current.id, status: status.value, memo: memo.value, shot: shot(), view: { yaw: +view.yaw.toFixed(3), pitch: +view.pitch.toFixed(3), dist: +view.dist.toFixed(2), frame: action ? +action.time.toFixed(2) : null, low, season: seasonSel.value } };
    try { notes = (await api('/api/admin/asset-notes', { method: 'POST', body: JSON.stringify(body) })).notes; drawNote(); drawList(); toast('메모를 저장했습니다.'); } catch (error) { toast(error.message); }
  });
  exportBtn.addEventListener('click', () => { // the 수정 요청 notes as a draft order (docs/work-brief-template.md style), saved as a file
    const fixes = Object.entries(notes).filter(([, x]) => x.status === 'fix');
    if (!fixes.length) { toast('수정 요청 메모가 없습니다.'); return; }
    const lines = ['# 에셋 수정 주문서 초안', '', `작성: 관리자 창 에셋 점검실 · ${new Date().toLocaleString('ko-KR')}`, '', '## 고칠 것', ''];
    for (const [id, x] of fixes) lines.push(`- \`${id}\` — ${x.memo || '(메모 없음)'}${x.view?.frame != null ? ` (모션 ${x.view.frame}초)` : ''}${x.view?.low ? ' [Low]' : ''}${x.view?.season ? ` [${x.view.season}]` : ''}`);
    lines.push('', '## 지켜야 할 것', '', '- 기존 규격(공통 20관절 리그·예산·정점 색·meshopt+quantization)과 파일 이름 유지, 바꾼 파일만 납품.', '- Blender 다듬기(헤드리스 베벨·AO) 후 예산·원점·크기 재확인, 전/후 미리보기.', '');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/markdown' })); a.download = `asset-fix-order-${new Date().toISOString().slice(0, 10)}.md`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  filter.addEventListener('change', drawNote);
  search.addEventListener('input', drawList);
  lowBtn.addEventListener('click', () => { low = !low; lowBtn.textContent = low ? 'Low' : 'High'; if (current && current.kind === 'model') show(current); });
  seasonSel.addEventListener('change', () => { if (current?.kind === 'model') show(current); });
  refBtn.addEventListener('click', () => { refBtn.setAttribute('aria-pressed', String(refBtn.getAttribute('aria-pressed') !== 'true')); showRef(); });
  nightBtn.addEventListener('click', () => {
    const on = nightBtn.getAttribute('aria-pressed') !== 'true'; nightBtn.setAttribute('aria-pressed', String(on));
    hemi.color.set(on ? 0x5a6fa8 : 0xfff4dc); hemi.intensity = on ? 0.7 : 1.6; sun.intensity = on ? 0.5 : 2; scene.background = on ? new THREE.Color(0x0b1530) : new THREE.Color(0xbfe6ff);
  });
  scene.background = new THREE.Color(0xbfe6ff);
  playBtn.addEventListener('click', () => { playing = !playing; playBtn.textContent = playing ? '멈춤' : '재생'; });
  frame.addEventListener('input', () => { if (!action) return; playing = false; playBtn.textContent = '재생'; action.time = clipLen * Number(frame.value) / 1000; mixer.update(0); });
  // turning and zooming: drag / wheel (a pinch on a phone counts as the wheel's two fingers)
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (!drag) return; view.yaw -= (e.clientX - drag.x) * 0.01; view.pitch = Math.max(-0.2, Math.min(1.3, view.pitch + (e.clientY - drag.y) * 0.01)); drag = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); view.dist = Math.max(0.4, Math.min(120, view.dist * (e.deltaY > 0 ? 1.1 : 0.9))); }, { passive: false });
  const clock = new THREE.Clock(); let raf = 0;
  const loop = () => {
    if (!canvas.isConnected) { renderer.dispose(); return; }
    const dt = clock.getDelta(); const w = canvas.clientWidth || 640; const h = canvas.clientHeight || 400;
    if (canvas.width !== Math.round(w * renderer.getPixelRatio())) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    if (mixer && playing) { mixer.update(dt * Number(speedSel.value)); }
    if (action) { frame.value = String(Math.round((action.time % (clipLen || 1)) / (clipLen || 1) * 1000)); timeText.textContent = `${(action.time % (clipLen || 1)).toFixed(2)}초 / ${clipLen.toFixed(2)}초`; }
    const t = view.target; camera.position.set(t.x + Math.sin(view.yaw) * Math.cos(view.pitch) * view.dist, t.y + Math.sin(view.pitch) * view.dist, t.z + Math.cos(view.yaw) * Math.cos(view.pitch) * view.dist); camera.lookAt(t);
    renderer.render(scene, camera); raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  api('/api/admin/asset-notes').then((d) => { notes = d.notes || {}; drawList(); drawNote(); }).catch(() => drawList());
  drawList();
  return { debug: () => ({ group, current: current?.id || null, shown: Boolean(shown), triangles: shown ? triangles(shown) : 0, motion: action ? { time: action.time, length: clipLen } : null, notes: Object.keys(notes).length, raf: Boolean(raf) }), select: (id) => { const k = id.startsWith('motion.') ? 'motion' : id.split('.')[0]; group = k; drawList(); const item = k === 'motion' ? { kind: 'motion', id, label: id.slice(7), url: base.clips?.[id.slice(7)] } : { kind: 'model', id, label: id }; return show(item); } };
}
