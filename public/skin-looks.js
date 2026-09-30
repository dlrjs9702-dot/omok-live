// v1.7.30 skin looks: how each 오목 skin's two stones are painted. Purely cosmetic; the catalog, prices and ownership
// live on the server (lib/skins.js). Unknown or missing skin ids fall back to the classic slate-and-shell stones
// so a board never fails to draw. Loaded before app.js (browser) and required by the tests (Node, contrast check).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SkinLooks = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  // stops: [highlight, body, rim] of the radial gradient. ring: a thin inner circle. sheen: opacity of the gloss.
  const CLASSIC = {
    black: { stops: ['#6e6e6e', '#2b2b2b', '#070707'], mid: .35, sheen: .1 },
    white: { stops: ['#ffffff', '#f3f1ea', '#c9c4b8'], mid: .55, lines: true },
  };
  const LOOKS = {
    omok_common_obsidian: {
      black: { stops: ['#7c8494', '#23272f', '#04050a'], sheen: .22, pattern: 'pearl' },
      white: { stops: ['#fffdf9', '#f3ecf0', '#c9bcc6'], sheen: .3, ring: 'rgba(214,180,205,.5)', pattern: 'pearl' },
    },
    omok_common_jade: {
      black: { stops: ['#5fb08c', '#1d5a44', '#082a1f'], sheen: .2, ring: 'rgba(160,230,196,.3)', pattern: 'veins' },
      white: { stops: ['#ffffff', '#edf4ea', '#bfd0bd'], sheen: .18, ring: 'rgba(120,170,140,.4)', pattern: 'veins' },
    },
    omok_common_amber: {
      black: { stops: ['#d69a3a', '#7b4a12', '#2a1504'], sheen: .3, ring: 'rgba(255,214,140,.35)', pattern: 'facets' },
      white: { stops: ['#ffffff', '#e4f0f7', '#a4bfce'], sheen: .35, ring: 'rgba(150,200,225,.5)', pattern: 'facets' },
    },
    omok_common_porcelain: {
      black: { stops: ['#4a6cb8', '#15296b', '#050c2c'], sheen: .3, ring: 'rgba(200,215,255,.55)', pattern: 'blossom' },
      white: { stops: ['#ffffff', '#f1f4fa', '#c3ccdd'], sheen: .3, ring: 'rgba(44,84,170,.6)', pattern: 'blossom' },
    },
    omok_common_bronze: {
      black: { stops: ['#94714a', '#40291a', '#140a05'], sheen: .18, ring: 'rgba(230,190,130,.3)', pattern: 'grooves' },
      white: { stops: ['#ffffff', '#dfe3e9', '#98a1ad'], sheen: .3, ring: 'rgba(120,130,145,.45)', pattern: 'grooves' },
    },
  };

  function look(skinId, color) {
    return (LOOKS[skinId] || CLASSIC)[color === 'black' ? 'black' : 'white'];
  }

  // Fine detail drawn inside the stone (clipped to it, no randomness so a redraw never flickers). `dark` stones use
  // light strokes and light stones use tinted ones. Detail stays soft: the stone's color must still read at a glance.
  function paintPattern(ctx, r, name, dark) {
    const ink = (light, tint) => (dark ? `rgba(255,255,255,${light})` : tint);
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip();
    ctx.lineCap = 'round';
    if (name === 'pearl') { // iridescent sheen and soft nacre bands
      const g = ctx.createLinearGradient(-r, -r, r, r);
      g.addColorStop(0, dark ? 'rgba(160,190,255,.22)' : 'rgba(255,160,205,.34)');
      g.addColorStop(.5, dark ? 'rgba(200,160,255,.10)' : 'rgba(160,215,255,.30)');
      g.addColorStop(1, dark ? 'rgba(120,220,220,.2)' : 'rgba(255,225,150,.34)');
      ctx.fillStyle = g; ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.strokeStyle = ink(.35, 'rgba(255,255,255,.75)'); ctx.lineWidth = Math.max(1, r * .06);
      for (let i = 1; i <= 3; i += 1) { ctx.beginPath(); ctx.arc(0, r * 1.5, r * (1 + i * .24), Math.PI * 1.22, Math.PI * 1.78); ctx.stroke(); }
    } else if (name === 'veins') { // mottled stone with a few winding veins
      ctx.strokeStyle = dark ? 'rgba(190,240,215,.38)' : 'rgba(60,135,95,.38)'; ctx.lineWidth = Math.max(1, r * .07);
      for (const [x0, y0, cx, cy, x1, y1] of [[-.9, -.1, -.4, -.7, .1, -.25], [-.2, .35, .3, -.1, .85, .3], [.05, .85, .25, .5, .6, .7]]) {
        ctx.beginPath(); ctx.moveTo(x0 * r, y0 * r); ctx.quadraticCurveTo(cx * r, cy * r, x1 * r, y1 * r); ctx.stroke();
      }
      ctx.fillStyle = dark ? 'rgba(190,240,215,.12)' : 'rgba(90,160,120,.14)';
      for (const [x, y, k] of [[-.35, .25, .28], [.4, -.4, .22], [.3, .5, .18]]) { ctx.beginPath(); ctx.arc(x * r, y * r, k * r, 0, Math.PI * 2); ctx.fill(); }
    } else if (name === 'facets') { // a cut gem: alternating light and shade wedges
      for (let i = 0; i < 8; i += 1) {
        const a0 = i * Math.PI / 4 + .2;
        ctx.fillStyle = i % 2 ? (dark ? 'rgba(255,225,160,.20)' : 'rgba(255,255,255,.55)') : (dark ? 'rgba(0,0,0,.24)' : 'rgba(80,140,185,.24)');
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, a0, a0 + Math.PI / 4); ctx.closePath(); ctx.fill();
      }
      ctx.strokeStyle = ink(.35, 'rgba(90,150,190,.5)'); ctx.lineWidth = Math.max(1, r * .05);
      ctx.beginPath(); for (let i = 0; i < 8; i += 1) { const a = i * Math.PI / 4 + .2; ctx.moveTo(Math.cos(a) * r * .32, Math.sin(a) * r * .32); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.stroke();
    } else if (name === 'blossom') { // blue-and-white porcelain: a six-petal flower
      ctx.fillStyle = dark ? 'rgba(210,225,255,.55)' : 'rgba(44,84,170,.62)';
      for (let i = 0; i < 6; i += 1) {
        ctx.save(); ctx.rotate(i * Math.PI / 3);
        ctx.beginPath(); ctx.ellipse(0, -r * .36, r * .13, r * .24, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      ctx.beginPath(); ctx.arc(0, 0, r * .12, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = dark ? 'rgba(210,225,255,.4)' : 'rgba(44,84,170,.5)'; ctx.lineWidth = Math.max(1, r * .05);
      ctx.beginPath(); ctx.arc(0, 0, r * .86, 0, Math.PI * 2); ctx.stroke();
    } else if (name === 'grooves') { // machined metal: concentric grooves and a center boss
      ctx.strokeStyle = dark ? 'rgba(255,225,170,.34)' : 'rgba(80,90,105,.42)'; ctx.lineWidth = Math.max(1, r * .05);
      for (const k of [.22, .4, .58, .8]) { ctx.beginPath(); ctx.arc(0, 0, r * k, 0, Math.PI * 2); ctx.stroke(); }
      ctx.fillStyle = dark ? 'rgba(255,225,170,.4)' : 'rgba(80,90,105,.45)';
      ctx.beginPath(); ctx.arc(0, 0, r * .09, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // Paint one stone centered at (0, 0) of ctx with radius r.
  function paintStone(ctx, r, skinId, color) {
    const spec = look(skinId, color);
    const g = ctx.createRadialGradient(-r * .35, -r * .4, r * .08, 0, 0, r);
    g.addColorStop(0, spec.stops[0]); g.addColorStop(spec.mid || .42, spec.stops[1]); g.addColorStop(1, spec.stops[2]);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    if (spec.pattern) paintPattern(ctx, r, spec.pattern, color === 'black');
    if (spec.ring) {
      ctx.strokeStyle = spec.ring; ctx.lineWidth = Math.max(1, r * .06);
      ctx.beginPath(); ctx.arc(0, 0, r * .68, 0, Math.PI * 2); ctx.stroke();
    }
    if (spec.lines) {
      ctx.strokeStyle = 'rgba(150,140,120,.13)'; ctx.lineWidth = 1;
      for (let i = 1; i <= 4; i += 1) { ctx.beginPath(); ctx.arc(0, r * 1.6, r * (1.1 + i * .16), Math.PI * 1.28, Math.PI * 1.72); ctx.stroke(); }
    }
    if (spec.sheen) {
      ctx.fillStyle = `rgba(255,255,255,${spec.sheen})`;
      ctx.beginPath(); ctx.ellipse(-r * .3, -r * .38, r * .38, r * .2, -.6, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Shop preview: a black and a white stone on a wooden swatch.
  function paintPreview(canvas, skinId) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width; const h = canvas.height;
    const wood = ctx.createLinearGradient(0, 0, w, h);
    wood.addColorStop(0, '#d9b070'); wood.addColorStop(1, '#c39a58');
    ctx.fillStyle = wood; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(50,30,10,.7)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.moveTo(w * .28, 0); ctx.lineTo(w * .28, h); ctx.moveTo(w * .72, 0); ctx.lineTo(w * .72, h); ctx.stroke();
    const r = Math.min(w, h) * .3;
    for (const [cx, color] of [[w * .28, 'black'], [w * .72, 'white']]) {
      ctx.save();
      ctx.fillStyle = 'rgba(40,20,0,.32)';
      ctx.beginPath(); ctx.ellipse(cx + 2, h / 2 + 3, r, r * .92, 0, 0, Math.PI * 2); ctx.fill();
      ctx.translate(cx, h / 2);
      paintStone(ctx, r, skinId, color);
      ctx.restore();
    }
  }

  return { CLASSIC, LOOKS, look, paintStone, paintPreview };
}));
