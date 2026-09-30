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
      black: { stops: ['#7c8494', '#23272f', '#04050a'], sheen: .22 },
      white: { stops: ['#fffdf9', '#f3ecf0', '#c9bcc6'], sheen: .3, ring: 'rgba(214,180,205,.5)' },
    },
    omok_common_jade: {
      black: { stops: ['#5fb08c', '#1d5a44', '#082a1f'], sheen: .2, ring: 'rgba(160,230,196,.3)' },
      white: { stops: ['#ffffff', '#edf4ea', '#bfd0bd'], sheen: .18, ring: 'rgba(120,170,140,.4)' },
    },
    omok_common_amber: {
      black: { stops: ['#d69a3a', '#7b4a12', '#2a1504'], sheen: .3, ring: 'rgba(255,214,140,.35)' },
      white: { stops: ['#ffffff', '#e4f0f7', '#a4bfce'], sheen: .35, ring: 'rgba(150,200,225,.5)' },
    },
    omok_common_porcelain: {
      black: { stops: ['#4a6cb8', '#15296b', '#050c2c'], sheen: .3, ring: 'rgba(200,215,255,.55)' },
      white: { stops: ['#ffffff', '#f1f4fa', '#c3ccdd'], sheen: .3, ring: 'rgba(44,84,170,.6)' },
    },
    omok_common_bronze: {
      black: { stops: ['#94714a', '#40291a', '#140a05'], sheen: .18, ring: 'rgba(230,190,130,.3)' },
      white: { stops: ['#ffffff', '#dfe3e9', '#98a1ad'], sheen: .3, ring: 'rgba(120,130,145,.45)' },
    },
  };

  function look(skinId, color) {
    return (LOOKS[skinId] || CLASSIC)[color === 'black' ? 'black' : 'white'];
  }

  // Paint one stone centered at (0, 0) of ctx with radius r.
  function paintStone(ctx, r, skinId, color) {
    const spec = look(skinId, color);
    const g = ctx.createRadialGradient(-r * .35, -r * .4, r * .08, 0, 0, r);
    g.addColorStop(0, spec.stops[0]); g.addColorStop(spec.mid || .42, spec.stops[1]); g.addColorStop(1, spec.stops[2]);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
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
