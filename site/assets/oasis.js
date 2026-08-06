/**
 * OASIS: the living hero scene on the overview page.
 *
 * A painted oasis in rain, drawn every frame on a 2D canvas: layered dunes,
 * palms whose fronds sway, lush broadleaf trees framing the headline, a pool
 * with a wavering reflection, sand drifting off the crests, and a soft rain
 * that swells in waves and rings the water where the drops land. Decoration
 * only; aria-hidden.
 *
 * The trees are pre-rendered once to offscreen canvases (hundreds of leaf
 * blobs each) and swayed as whole sprites, so the per-frame cost stays at a
 * handful of draws.
 *
 * Zero requests: everything is drawn in code, colours are read from the
 * stylesheet's scenery tokens so the palette stays one system.
 *
 * Honesty about motion: with prefers-reduced-motion the scene draws exactly
 * one still frame and stops. The loop also stops while the canvas is out of
 * view or the tab is hidden.
 */

export function mountOasis(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const css = getComputedStyle(document.documentElement);
  const tok = (name, fallback) => (css.getPropertyValue(name) || fallback).trim();
  const C = {
    stone: tok('--stone', '#E8E3D8'),
    dune: tok('--dune', '#DCCFA9'),
    dune2: tok('--dune-2', '#C9B98D'),
    pool: tok('--pool', '#DCE7E2'),
    pool2: tok('--pool-2', '#CFDEDA'),
    water: tok('--water', '#1F4E55'),
    water2: tok('--water-2', '#2E6B6F'),
    frond: tok('--frond', '#4A6B4F'),
    sun: '#F2E9D2',
  };

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let W = 0, H = 0, dpr = 1;
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();

  // Deterministic randoms, so every visit composes the same place.
  let seed = 77;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  // ── the cast, laid out in scene units (fractions of the canvas) ──────────
  const DUNES = [
    { y: 0.52, amp: 0.055, k: 1.7, ph: 0.8, drift: 3.5, color: C.dune, alpha: 0.42, grain: 40 },
    { y: 0.62, amp: 0.045, k: 2.6, ph: 2.9, drift: 6.5, color: C.dune2, alpha: 0.5, grain: 70 },
    { y: 0.74, amp: 0.035, k: 1.2, ph: 5.2, drift: 10, color: C.dune, alpha: 0.62, grain: 90 },
  ];
  const POOL = { x: 0.56, y: 0.845, rx: 0.21, ry: 0.052 };
  const PALMS = [
    { x: 0.40, y: 0.865, h: 0.46, lean: -0.16, fronds: 11, ph: 0.0, s: 1.0 },
    { x: 0.47, y: 0.875, h: 0.34, lean: 0.12, fronds: 9, ph: 2.1, s: 0.8 },
    { x: 0.755, y: 0.86, h: 0.28, lean: 0.22, fronds: 8, ph: 4.4, s: 0.7 },
  ];
  const REEDS = [];
  for (let i = 0; i < 14; i++) {
    const side = i < 8 ? -1 : 1;
    REEDS.push({
      x: POOL.x + side * POOL.rx * (0.92 + rnd() * 0.35),
      y: POOL.y + (rnd() - 0.3) * 0.03,
      h: 0.05 + rnd() * 0.055,
      lean: (rnd() - 0.5) * 0.5,
      ph: rnd() * 6.28,
    });
  }
  const GRAINS = [];
  for (let i = 0; i < 90; i++) {
    GRAINS.push({ x: rnd(), y: rnd(), v: 0.25 + rnd() * 0.6, band: Math.floor(rnd() * 3), ph: rnd() * 6.28 });
  }

  // The lush frame: broadleaf trees flanking the headline zone, and a pair
  // of bushes by the pool. Each is a recipe for a pre-rendered sprite.
  const TREES = [
    { x: 0.075, base: 1.02, h: 0.78, lean: 0.06, lobes: 5, spread: 1.25, ph: 0.4 },
    { x: 0.935, base: 1.03, h: 0.7, lean: -0.08, lobes: 5, spread: 1.15, ph: 2.6 },
    { x: 0.185, base: 1.16, h: 0.34, lean: 0.10, lobes: 5, spread: 1.9, ph: 4.1 },
    { x: 0.86, base: 1.17, h: 0.30, lean: -0.05, lobes: 5, spread: 2.0, ph: 1.3 },
    { x: 0.645, base: 0.88, h: 0.15, lean: 0.04, lobes: 4, spread: 1.6, ph: 3.3 },
    { x: 0.30, base: 0.885, h: 0.13, lean: -0.07, lobes: 4, spread: 1.7, ph: 5.0 },
  ];
  let treeSprites = [];

  // Rain is always near: a soft drizzle that swells in long waves. Drops that
  // land inside the pool leave rings.
  const RINGS = [];
  const rainAt = (t) => {
    const wave = 0.5 + 0.5 * Math.sin((t / 26) * Math.PI * 2 + 4.2);
    const gust = 0.5 + 0.5 * Math.sin((t / 7.3) * Math.PI * 2);
    return 0.28 + 0.62 * (wave ** 1.6) + 0.10 * gust * wave;
  };

  // ── painters ─────────────────────────────────────────────────────────────
  const duneY = (d, x, t) =>
    H * d.y + H * d.amp * (
      Math.sin((x / W) * Math.PI * d.k + d.ph + t * 0.01 * 0) +
      0.4 * Math.sin((x / W) * Math.PI * d.k * 2.7 + d.ph * 1.7));

  function sky(t, rain) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, C.stone);
    g.addColorStop(0.55, mix(C.stone, C.dune, 0.25 + rain * 0.05));
    g.addColorStop(1, mix(C.stone, C.dune, 0.45));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // sun, hazing over when a shower passes
    const sx = W * 0.8, sy = H * 0.2, r = Math.min(W, H) * 0.075;
    for (const [mul, a] of [[2.4, 0.16], [1.6, 0.22], [1, 0.6]]) {
      ctx.beginPath();
      ctx.arc(sx, sy, r * mul, 0, Math.PI * 2);
      ctx.fillStyle = C.sun;
      ctx.globalAlpha = a * (1 - rain * 0.55);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function dunes(t) {
    for (const d of DUNES) {
      ctx.beginPath();
      ctx.moveTo(0, H);
      const shift = (t * d.drift) % W;
      for (let x = 0; x <= W; x += 8) ctx.lineTo(x, duneY(d, x + shift, t));
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.globalAlpha = d.alpha;
      ctx.fillStyle = d.color;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  /** One palm: a tapered, gently curved trunk with ring marks, and a crown of
   *  drooping fronds, each spine carrying its rows of leaflets. `sway` bends
   *  the whole crown; each frond adds its own phase so the tree moves like a
   *  plant rather than a flag. */
  function palm(p, t, alpha = 1, flip = 1) {
    const x0 = p.x * W, y0 = p.y * H, h = p.h * H * flip;
    const sway = reduceMotion ? 0 : Math.sin(t * 0.9 + p.ph) * 0.045 + Math.sin(t * 0.37 + p.ph * 2) * 0.02;
    const crown = {
      x: x0 + (p.lean + sway * 0.6) * h,
      y: y0 - h,
    };
    ctx.save();
    ctx.globalAlpha = alpha;

    // trunk
    const tw = Math.max(3.5, h * 0.028) * p.s;
    ctx.strokeStyle = C.water;
    ctx.lineCap = 'round';
    const midX = x0 + p.lean * h * 0.35, midY = y0 - h * 0.5;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(midX, midY, crown.x, crown.y);
    ctx.lineWidth = tw;
    ctx.stroke();
    // ring marks up the trunk
    ctx.lineWidth = 1;
    ctx.globalAlpha = alpha * 0.45;
    for (let i = 1; i < 8; i++) {
      const u = i / 8;
      const rx = q(x0, midX, crown.x, u), ry = q(y0, midY, crown.y, u);
      const txv = qd(x0, midX, crown.x, u), tyv = qd(y0, midY, crown.y, u);
      const len = Math.hypot(txv, tyv) || 1;
      const nx = -tyv / len, ny = txv / len;
      const wgt = tw * (1 - u * 0.45) * 0.75;
      ctx.beginPath();
      ctx.moveTo(rx - nx * wgt, ry - ny * wgt);
      ctx.lineTo(rx + nx * wgt, ry + ny * wgt);
      ctx.stroke();
    }
    ctx.globalAlpha = alpha;

    // fronds
    for (let i = 0; i < p.fronds; i++) {
      const spread = (i / (p.fronds - 1)) * Math.PI * 1.25 - Math.PI * 0.625;
      const fPhase = p.ph + i * 1.7;
      const fSway = reduceMotion ? 0 : Math.sin(t * 1.15 + fPhase) * 0.06;
      const ang = -Math.PI / 2 + spread + sway + fSway;
      const flen = h * (0.34 + 0.05 * Math.sin(i * 2.3)) * p.s;
      const droop = 0.5 + 0.35 * Math.abs(Math.sin(spread));
      const ex = crown.x + Math.cos(ang) * flen;
      const ey = crown.y + Math.sin(ang) * flen * flip + droop * flen * 0.55;
      const cxp = crown.x + Math.cos(ang) * flen * 0.55;
      const cyp = crown.y + Math.sin(ang) * flen * 0.55 * flip;
      const shade = i % 2 ? C.water2 : C.frond;

      // spine
      ctx.strokeStyle = shade;
      ctx.lineWidth = Math.max(1.2, h * 0.008);
      ctx.beginPath();
      ctx.moveTo(crown.x, crown.y);
      ctx.quadraticCurveTo(cxp, cyp, ex, ey);
      ctx.stroke();

      // leaflets along the spine
      const nLeaf = 9;
      ctx.lineWidth = Math.max(0.9, h * 0.005);
      for (let k = 2; k <= nLeaf; k++) {
        const u = k / nLeaf;
        const lx = q(crown.x, cxp, ex, u), ly = q(crown.y, cyp, ey, u);
        const txv = qd(crown.x, cxp, ex, u), tyv = qd(crown.y, cyp, ey, u);
        const len = Math.hypot(txv, tyv) || 1;
        const dxn = txv / len, dyn = tyv / len;
        const leaf = flen * 0.16 * (1.05 - u * 0.75);
        for (const sgn of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(lx, ly);
          ctx.quadraticCurveTo(
            lx + dxn * leaf * 0.45 - dyn * sgn * leaf * 0.5,
            ly + dyn * leaf * 0.45 + dxn * sgn * leaf * 0.5,
            lx + dxn * leaf * 0.95 - dyn * sgn * leaf * 0.72,
            ly + dyn * leaf * 0.95 + dxn * sgn * leaf * 0.72 + leaf * 0.35);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  /** Pre-renders one lush broadleaf tree to an offscreen canvas: a bark
   *  trunk, a few branches, then hundreds of leaf blobs built up dark to
   *  light so the canopy reads full rather than flat. Drawn per frame as a
   *  single sprite, swaying about its base. */
  function makeTree(spec) {
    const h = Math.max(60, spec.h * H);
    const w = h * spec.spread;
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * dpr);
    c.height = Math.ceil(h * dpr);
    const g = c.getContext('2d');
    g.scale(dpr, dpr);

    let s = Math.floor(1000 + spec.ph * 977) || 7;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;

    const bark = mix('#3a3128', C.water, 0.3);
    const dark = mix(C.frond, C.water, 0.55);
    const mid = C.frond;
    const light = mix(C.frond, C.pool, 0.35);

    const bx = w / 2, by = h;
    const crown = { x: bx + spec.lean * h * 0.5, y: h * 0.34 };

    // trunk and a few limbs reaching into the crown
    g.strokeStyle = bark;
    g.lineCap = 'round';
    g.lineWidth = Math.max(4, h * 0.05);
    g.beginPath();
    g.moveTo(bx, by);
    g.quadraticCurveTo(bx + spec.lean * h * 0.2, h * 0.72, crown.x, crown.y + h * 0.14);
    g.stroke();
    g.lineWidth = Math.max(2, h * 0.022);
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (r() - 0.5) * 1.6;
      g.beginPath();
      g.moveTo(crown.x, crown.y + h * 0.16);
      g.quadraticCurveTo(
        crown.x + Math.cos(a) * h * 0.1, crown.y + h * 0.05,
        crown.x + Math.cos(a) * h * 0.22, crown.y + Math.sin(a) * h * 0.18);
      g.stroke();
    }

    // canopy lobes, then leaf blobs from shadow to light
    const lobes = [{ x: crown.x, y: crown.y, rr: h * 0.24 }];
    for (let i = 1; i < spec.lobes; i++) {
      lobes.push({
        x: crown.x + (r() - 0.5) * w * 0.62,
        y: crown.y + (r() - 0.42) * h * 0.30,
        rr: h * (0.13 + r() * 0.10),
      });
    }
    for (const lb of lobes) {                       // silhouette base
      g.fillStyle = dark;
      g.globalAlpha = 0.9;
      g.beginPath();
      g.ellipse(lb.x, lb.y, lb.rr * 1.06, lb.rr * 0.88, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    for (const [shade, count, bias] of [[dark, 26, 0.30], [mid, 34, 0.0], [light, 22, -0.32]]) {
      g.fillStyle = shade;
      for (const lb of lobes) {
        for (let i = 0; i < count; i++) {
          const a = r() * Math.PI * 2;
          const d = (r() + r()) * 0.5 * lb.rr;
          const px = lb.x + Math.cos(a) * d * 1.08;
          const py = lb.y + Math.sin(a) * d * 0.85 + bias * lb.rr;
          const rad = lb.rr * (0.10 + r() * 0.14);
          g.globalAlpha = 0.75 + r() * 0.25;
          g.beginPath();
          g.ellipse(px, py, rad, rad * (0.75 + r() * 0.3), r() * 1.2, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    g.globalAlpha = 1;
    return { c, w, h, spec };
  }

  let spritesBuilt = false;
  const buildSprites = () => {
    treeSprites = TREES.map(makeTree);
    spritesBuilt = true;
  };

  function drawTrees(t, layer) {
    if (!spritesBuilt) buildSprites();
    for (const sp of treeSprites) {
      const isBack = sp.spec.base < 1;
      if ((layer === 'back') !== isBack) continue;
      const sway = reduceMotion ? 0
        : Math.sin(t * 0.55 + sp.spec.ph) * 0.012 + Math.sin(t * 1.3 + sp.spec.ph * 1.7) * 0.004;
      ctx.save();
      ctx.translate(sp.spec.x * W, sp.spec.base * H);
      ctx.rotate(sway);
      ctx.drawImage(sp.c, -sp.w / 2, -sp.h, sp.w, sp.h);
      ctx.restore();
    }
  }

  function pool(t, rain) {
    const px = POOL.x * W, py = POOL.y * H, rx = POOL.rx * W, ry = POOL.ry * H;

    // the water
    const g = ctx.createLinearGradient(0, py - ry, 0, py + ry);
    g.addColorStop(0, C.pool);
    g.addColorStop(1, C.pool2);
    ctx.beginPath();
    ctx.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();

    // reflection: the palms again, upside-down, faint, clipped to the water
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2);
    ctx.clip();
    for (const p of PALMS) {
      if (Math.abs(p.x - POOL.x) < POOL.rx * 1.6) {
        palm({ ...p, y: 2 * POOL.y - p.y - 0.004 }, t, 0.2, -1);
      }
    }
    // ripple highlights crossing the surface
    ctx.strokeStyle = C.water2;
    for (let i = 0; i < 4; i++) {
      const u = ((reduceMotion ? 0.35 : t * 0.05) + i * 0.27) % 1;
      ctx.globalAlpha = 0.30 * Math.sin(Math.PI * u);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      const yy = py - ry * 0.7 + u * ry * 1.5;
      const half = rx * Math.sqrt(Math.max(0.05, 1 - ((yy - py) / ry) ** 2)) * 0.9;
      for (let x = -half; x <= half; x += 7) {
        const wob = Math.sin(x * 0.05 + t * 2.2 + i) * 1.4;
        if (x === -half) ctx.moveTo(px + x, yy + wob);
        else ctx.lineTo(px + x, yy + wob);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // rain rings on the water
    for (let i = RINGS.length - 1; i >= 0; i--) {
      const r = RINGS[i];
      const age = t - r.t0;
      if (age > 1.4) { RINGS.splice(i, 1); continue; }
      const u = age / 1.4;
      ctx.globalAlpha = 0.5 * (1 - u);
      ctx.strokeStyle = C.water2;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, 2 + u * 22, (2 + u * 22) * 0.32, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function reeds(t) {
    ctx.lineCap = 'round';
    for (const r of REEDS) {
      const sway = reduceMotion ? 0 : Math.sin(t * 1.4 + r.ph) * 3;
      ctx.strokeStyle = C.frond;
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(r.x * W, r.y * H);
      ctx.quadraticCurveTo(
        r.x * W + r.lean * 8, r.y * H - r.h * H * 0.6,
        r.x * W + r.lean * 16 + sway, r.y * H - r.h * H);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function sand(t) {
    if (reduceMotion) return;
    ctx.fillStyle = C.dune2;
    for (const s of GRAINS) {
      const d = DUNES[s.band];
      const x = ((s.x + t * 0.014 * s.v) % 1.04 - 0.02) * W;
      const y = duneY(d, x + ((t * d.drift) % W), t) - 2 - 14 * Math.abs(Math.sin(t * 0.5 + s.ph));
      ctx.globalAlpha = 0.35 * Math.abs(Math.sin(t * 0.8 + s.ph));
      ctx.fillRect(x, y, 1.6, 1.6);
    }
    ctx.globalAlpha = 1;
  }

  function rain(t, strength) {
    if (!strength || reduceMotion) return;
    ctx.strokeStyle = C.water2;
    ctx.lineWidth = 1;
    const n = Math.floor(30 + 115 * strength);
    for (let i = 0; i < n; i++) {
      // stable per-index randoms, advanced by time
      const h1 = Math.sin(i * 127.1) * 43758.5453;
      const rx = h1 - Math.floor(h1);
      const h2 = Math.sin(i * 311.7) * 12543.21;
      const rv = h2 - Math.floor(h2);
      const fall = ((t * (0.6 + rv * 0.5)) % 1);
      const x = (rx + fall * 0.06) % 1 * W;
      const y = fall * H;
      ctx.globalAlpha = 0.09 + 0.08 * strength;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 4, y + 13);
      ctx.stroke();
      // a drop that reaches the pool leaves a ring
      if (y > POOL.y * H - 4 && y < POOL.y * H + 4) {
        const dx = (x - POOL.x * W) / (POOL.rx * W);
        if (Math.abs(dx) < 0.95 && RINGS.length < 26 && Math.random() < 0.3) {
          RINGS.push({ x, y: POOL.y * H + (Math.random() - 0.3) * POOL.ry * H, t0: t });
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  function fade() {
    const g = ctx.createLinearGradient(0, H * 0.72, 0, H);
    g.addColorStop(0, hexA(C.stone, 0));
    g.addColorStop(1, hexA(C.stone, 1));
    ctx.fillStyle = g;
    ctx.fillRect(0, H * 0.72, W, H * 0.28);
  }

  function frame(t) {
    const strength = reduceMotion ? 0 : rainAt(t);
    ctx.clearRect(0, 0, W, H);
    sky(t, strength);
    dunes(t);
    sand(t);
    drawTrees(t, 'back');
    for (const p of PALMS) palm(p, t);
    pool(t, strength);
    reeds(t);
    drawTrees(t, 'front');
    rain(t, strength);
    fade();
  }

  // ── loop, gated on visibility and motion preference ──────────────────────
  let visible = true;
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.01 });
  io.observe(canvas);
  const ro = new ResizeObserver(() => {
    resize();
    buildSprites();                    // sprite pixels track the new size
    if (reduceMotion) frame(0.35);
  });
  ro.observe(canvas);

  if (reduceMotion) {
    frame(0.35);                      // one still, mid-scene
    return { dispose: () => { io.disconnect(); ro.disconnect(); } };
  }

  let raf = 0;
  const t0 = performance.now();
  const loop = () => {
    raf = requestAnimationFrame(loop);
    if (!visible || document.hidden) return;
    frame((performance.now() - t0) / 1000);
  };
  loop();
  return {
    dispose: () => { cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); },
  };
}

/* quadratic bezier point + derivative */
function q(a, b, c, u) { return (1 - u) * (1 - u) * a + 2 * (1 - u) * u * b + u * u * c; }
function qd(a, b, c, u) { return 2 * (1 - u) * (b - a) + 2 * u * (c - b); }

function mix(hexA_, hexB, u) {
  const pa = parseHex(hexA_), pb = parseHex(hexB);
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * u));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
function hexA(hex, a) {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r},${g},${b},${a})`;
}
function parseHex(h) {
  h = h.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
