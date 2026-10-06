// 광장 아바타 skins (v1.9.2): the shop picture of each avatar item, on the plaza's big-headed character seen from the
// front. The 3D models of the same items live in public/plaza/plaza-scene.js (AVATAR_PARTS); the ids are the catalog's.
(function () {
  const S = window.SkinLooks;
  if (!S) return;
  const { TAU, starPath } = S.h;
  const SKIN = '#ffe0c4'; const HAIR = '#4a3326'; const SHIRT = '#7cb8ff';

  // Hair: drawn behind (back) and over (front) the face; r is the head radius, the head centre is (0, 0).
  const HAIRS = {
    base: { front: (c, r) => { c.fillStyle = HAIR; c.beginPath(); c.arc(0, -r * .1, r * 1.04, Math.PI * 1.02, Math.PI * 1.98); c.fill(); } },
    avatar_hair_1: { back: (c, r) => { c.fillStyle = '#7a4a2a'; for (const s of [-1, 1]) { c.beginPath(); c.ellipse(s * r * 1.05, r * .55, r * .22, r * .55, s * .2, 0, TAU); c.fill(); } }, front: (c, r) => { c.fillStyle = '#7a4a2a'; c.beginPath(); c.arc(0, -r * .1, r * 1.04, Math.PI * 1.02, Math.PI * 1.98); c.fill(); c.fillStyle = '#ff7aa2'; for (const s of [-1, 1]) { c.beginPath(); c.arc(s * r * .95, r * .1, r * .12, 0, TAU); c.fill(); } } },
    avatar_hair_2: { front: (c, r) => { c.fillStyle = '#2b1d14'; for (let i = 0; i < 9; i += 1) { const a = Math.PI + i * Math.PI / 8; c.beginPath(); c.arc(Math.cos(a) * r * .95, Math.sin(a) * r * .95 - r * .05, r * .3, 0, TAU); c.fill(); } } },
    avatar_hair_3: { back: (c, r) => { c.fillStyle = '#c0703a'; c.beginPath(); c.ellipse(r * .9, r * .2, r * .25, r * .7, -.4, 0, TAU); c.fill(); }, front: (c, r) => { c.fillStyle = '#c0703a'; c.beginPath(); c.arc(0, -r * .1, r * 1.04, Math.PI * 1.02, Math.PI * 1.98); c.fill(); } },
    avatar_hair_4: { front: (c, r) => { c.fillStyle = '#2f3b52'; c.beginPath(); for (let i = 0; i <= 6; i += 1) { const x = -r + i * r / 3; c.lineTo(x, -r * (i % 2 ? 1.5 : .7)); } c.lineTo(r, -r * .1); c.lineTo(-r, -r * .1); c.fill(); } },
    avatar_hair_5: { front: (c, r) => { ['#ff6b6b', '#ffd23f', '#6be38a', '#5fb0ff', '#b48aff'].forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.arc(0, -r * .1, r * (1.12 - i * .04), Math.PI * (1.02 + i * .19), Math.PI * (1.21 + i * .19)); c.lineTo(0, -r * .1); c.fill(); }); } },
    avatar_hair_6: { back: (c, r) => { c.fillStyle = '#2a2a6a'; c.beginPath(); c.ellipse(0, r * .3, r * 1.2, r * 1.05, 0, 0, TAU); c.fill(); }, front: (c, r) => { c.fillStyle = '#2a2a6a'; c.beginPath(); c.arc(0, -r * .1, r * 1.06, Math.PI * 1.02, Math.PI * 1.98); c.fill(); c.fillStyle = '#ffe28a'; for (const [x, y] of [[-.5, -.7], [.2, -.9], [.7, -.5], [-.9, .4], [1, .5]]) { starPath(c, x * r, y * r, r * .14, r * .05, 5); c.fill(); } } },
  };
  // Outfit: drawn on the body (a rounded torso below the head); b is the body box { x, y, w, h }.
  const OUTFITS = {
    base: (c, b) => { c.fillStyle = SHIRT; c.beginPath(); c.roundRect(b.x, b.y, b.w, b.h, b.w * .35); c.fill(); },
    avatar_outfit_1: (c, b) => { c.fillStyle = '#fff6dc'; c.beginPath(); c.roundRect(b.x, b.y, b.w, b.h, b.w * .35); c.fill(); c.fillStyle = '#3f74c8'; c.fillRect(b.x + b.w * .1, b.y + b.h * .45, b.w * .8, b.h * .55); for (const s of [.25, .75]) c.fillRect(b.x + b.w * s - 3, b.y, 6, b.h * .5); },
    avatar_outfit_2: (c, b) => { c.fillStyle = '#ffffff'; c.beginPath(); c.roundRect(b.x, b.y, b.w, b.h, b.w * .35); c.fill(); c.fillStyle = '#ff6b6b'; for (let y = b.y + 4; y < b.y + b.h; y += 9) c.fillRect(b.x + 2, y, b.w - 4, 4); },
    avatar_outfit_3: (c, b) => { c.fillStyle = '#ffd6e0'; c.beginPath(); c.roundRect(b.x, b.y, b.w, b.h, b.w * .35); c.fill(); c.fillStyle = '#5a8fd8'; c.fillRect(b.x, b.y + b.h * .55, b.w, b.h * .45); c.strokeStyle = '#ffffff'; c.lineWidth = 4; c.beginPath(); c.moveTo(b.x + b.w * .3, b.y); c.lineTo(b.x + b.w * .55, b.y + b.h * .5); c.stroke(); c.fillStyle = '#e83c5a'; c.fillRect(b.x + b.w * .5, b.y + b.h * .4, b.w * .35, 5); },
    avatar_outfit_4: (c, b) => { c.fillStyle = '#e8edf5'; c.beginPath(); c.roundRect(b.x - 3, b.y, b.w + 6, b.h, b.w * .35); c.fill(); c.strokeStyle = '#7a8aa8'; c.lineWidth = 2; c.stroke(); c.fillStyle = '#ff8a3d'; c.fillRect(b.x + b.w * .35, b.y + b.h * .3, b.w * .3, b.h * .22); c.fillStyle = '#5fb0ff'; c.beginPath(); c.arc(b.x + b.w * .5, b.y + b.h * .75, 4, 0, TAU); c.fill(); },
    avatar_outfit_5: (c, b) => { c.fillStyle = '#b8243a'; c.beginPath(); c.moveTo(b.x - b.w * .3, b.y + b.h); c.lineTo(b.x + b.w * .1, b.y); c.lineTo(b.x + b.w * .9, b.y); c.lineTo(b.x + b.w * 1.3, b.y + b.h); c.closePath(); c.fill(); c.fillStyle = '#fff6dc'; c.beginPath(); c.roundRect(b.x + b.w * .2, b.y + 4, b.w * .6, b.h - 4, 8); c.fill(); c.fillStyle = '#ffd23f'; c.fillRect(b.x + b.w * .05, b.y, b.w * .9, 6); for (let i = 0; i < 4; i += 1) { c.fillStyle = '#ffffff'; c.beginPath(); c.arc(b.x + b.w * (.12 + i * .25), b.y + 3, 3, 0, TAU); c.fill(); } },
  };
  // Hat / ornament: on top of the head.
  const HATS = {
    avatar_hat_1: (c, r) => { c.fillStyle = '#e8c56a'; c.beginPath(); c.ellipse(0, -r * .75, r * 1.45, r * .32, 0, 0, TAU); c.fill(); c.beginPath(); c.ellipse(0, -r * .95, r * .75, r * .5, 0, Math.PI, TAU); c.fill(); c.fillStyle = '#e83c5a'; c.fillRect(-r * .75, -r * 1.02, r * 1.5, r * .14); },
    avatar_hat_2: (c, r) => { for (const s of [-1, 1]) { c.fillStyle = '#4a3326'; c.beginPath(); c.moveTo(s * r * .3, -r * .85); c.lineTo(s * r * .65, -r * 1.55); c.lineTo(s * r * .95, -r * .55); c.fill(); c.fillStyle = '#ffb3c8'; c.beginPath(); c.moveTo(s * r * .45, -r * .85); c.lineTo(s * r * .65, -r * 1.3); c.lineTo(s * r * .82, -r * .7); c.fill(); } },
    avatar_hat_3: (c, r) => { ['#ff8fb8', '#ffd23f', '#ffffff', '#b48aff', '#7be0a0'].forEach((col, i) => { const a = Math.PI * (1.1 + i * .2); c.fillStyle = col; c.beginPath(); c.arc(Math.cos(a) * r * .95, Math.sin(a) * r * .95 - r * .05, r * .2, 0, TAU); c.fill(); }); },
    avatar_hat_4: (c, r) => { c.fillStyle = '#ffd23f'; c.strokeStyle = '#a87c00'; c.lineWidth = 2; c.beginPath(); c.moveTo(-r * .6, -r * .8); c.lineTo(-r * .6, -r * 1.35); c.lineTo(-r * .3, -r * 1.05); c.lineTo(0, -r * 1.5); c.lineTo(r * .3, -r * 1.05); c.lineTo(r * .6, -r * 1.35); c.lineTo(r * .6, -r * .8); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#e83c5a'; c.beginPath(); c.arc(0, -r * 1.0, r * .09, 0, TAU); c.fill(); },
    avatar_hat_5: (c, r) => { c.strokeStyle = '#ffe28a'; c.lineWidth = r * .14; c.shadowColor = '#ffe28a'; c.shadowBlur = 10; c.beginPath(); c.ellipse(0, -r * 1.35, r * .75, r * .2, 0, 0, TAU); c.stroke(); c.shadowBlur = 0; },
  };

  // The character with one item tried on (the others stay the default look).
  function drawAvatar(ctx, cx, cy, s, item) {
    const r = s * .42; const slot = item?.split('_')[1];
    const hair = HAIRS[slot === 'hair' ? item : 'base']; const outfit = OUTFITS[slot === 'outfit' ? item : 'base']; const hat = slot === 'hat' ? HATS[item] : null;
    ctx.save(); ctx.translate(cx, cy);
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(0, s * 1.05, s * .5, s * .1, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#5b6b8c'; for (const x of [-.18, .18]) { ctx.beginPath(); ctx.roundRect(x * s - s * .1, s * .7, s * .2, s * .32, s * .08); ctx.fill(); }
    outfit(ctx, { x: -s * .34, y: s * .3, w: s * .68, h: s * .5 });
    ctx.fillStyle = SKIN; for (const x of [-.42, .42]) { ctx.beginPath(); ctx.arc(x * s, s * .55, s * .08, 0, TAU); ctx.fill(); }
    ctx.translate(0, -s * .1);
    hair.back?.(ctx, r);
    ctx.fillStyle = SKIN; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    hair.front(ctx, r);
    ctx.fillStyle = '#2b2220'; for (const x of [-.36, .36]) { ctx.beginPath(); ctx.ellipse(x * r, r * .12, r * .1, r * .14, 0, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,140,150,.6)'; for (const x of [-.6, .6]) { ctx.beginPath(); ctx.ellipse(x * r, r * .38, r * .14, r * .08, 0, 0, TAU); ctx.fill(); }
    hat?.(ctx, r);
    ctx.restore();
  }
  // v1.10.32: the shop shows each item as the island draws it -- worn on the common character, front and back
  // (tools/assets/build-avatar-thumbs.py, a game resource-pack picture); this drawing until the picture is in
  const pictures = new Map();
  function previewAvatar(ctx, w, h, skinId) {
    let img = pictures.get(skinId);
    if (!img) { img = new Image(); img.decoding = 'async'; img.src = window.GameBoot?.assetUrl?.(`/assets/shop/avatar/${skinId}.webp`) ?? `/assets/shop/avatar/${skinId}.webp`; pictures.set(skinId, img); }
    if (img.complete && img.naturalWidth) { ctx.drawImage(img, 0, 0, w, h); return; }
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#bfe6ff'); g.addColorStop(.7, '#e8f6ff'); g.addColorStop(.7, '#9fd67f'); g.addColorStop(1, '#8cc970'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    if (HAIRS[skinId] || OUTFITS[skinId] || HATS[skinId]) drawAvatar(ctx, w / 2, h * .42, h * .42, skinId);
    img.addEventListener('load', () => ctx.drawImage(img, 0, 0, w, h), { once: true });
  }
  S.define({ avatar_: { avatar: true, preview: previewAvatar } }); // every avatar item (skin-looks def: by its id's family)
  S.drawAvatar = drawAvatar;
}());
