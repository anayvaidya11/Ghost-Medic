/**
 * VERGE: the green edges of every page.
 *
 * Two fixed strips, one down each side of the viewport, where foliage
 * reaches in from off-screen: broadleaf sprigs, fern fronds, a hanging vine.
 * They sway on their own phases, drift gently against the scroll so depth
 * reads, and carry the same soft rain as the hero. Under the foliage the
 * strips also carry the oasis washes: pools of sand, palm green and water
 * anchored to the page, so a long scroll runs sand, green, water, sand down
 * its margins. (The washes are painted here and not as a body background
 * layer because any page-scale background-image stalls software rasterisers
 * at screenshot time; see the note in style.css.) Decoration only;
 * aria-hidden, pointer-transparent, and drawn only into the margins the
 * text column does not use.
 *
 * The strips size themselves to the free margin beside this page's own
 * content column (measured, so a narrow prose page keeps its foliage longer
 * than a wide diagram page) and remove themselves entirely when that margin
 * is thin (tablet, phone), so the foliage never crowds a line of text.
 *
 * Sprites are pre-rendered once per resize; the frame loop draws a handful
 * of images. Reduced motion gets one still, dry frame. Zero requests.
 */

export function mountVerge() {
  const css = getComputedStyle(document.documentElement);
  const tok = (name, fallback) => (css.getPropertyValue(name) || fallback).trim();
  const C = {
    water: tok('--water', '#1F4E55'),
    water2: tok('--water-2', '#2E6B6F'),
    pool: tok('--pool', '#DCE7E2'),
    frond: tok('--frond', '#4A6B4F'),
    sand: '#EDE6D0',
  };

  // The oasis washes, anchored to page depth (rem down the document) and
  // split between the sides: scrolling runs sand, green, water, sand.
  const WASHES = {
    left:  [{ y: 30, c: C.frond, a: 0.22 }, { y: 170, c: C.water, a: 0.16 }],
    right: [{ y: 8, c: C.sand, a: 0.50 }, { y: 64, c: C.water2, a: 0.18 },
            { y: 118, c: C.frond, a: 0.20 }],
  };
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const WIDE_PX = 58 * 16;                 // the widest column any page uses
  const MIN_MARGIN = 72;                   // below this, no room for foliage

  // The free margin is measured against this page's own content, not the
  // widest column the site owns: a prose-only page (About) keeps its foliage
  // at window widths where a diagram page has no room for any.
  const contentPx = () => {
    let w = 0;
    for (const el of document.querySelectorAll('main .col, main .col-w')) {
      w = Math.max(w, el.getBoundingClientRect().width);
    }
    return w || WIDE_PX;
  };

  const sides = [];
  for (const side of ['left', 'right']) {
    const c = document.createElement('canvas');
    c.className = 'verge';
    c.setAttribute('aria-hidden', 'true');
    c.style.cssText =
      `position:fixed;top:0;${side}:0;height:100vh;pointer-events:none;z-index:30;display:none;`;
    document.body.appendChild(c);
    sides.push({ side, c, ctx: c.getContext('2d'), sprigs: [], washes: [], W: 0, H: 0 });
  }

  let dpr = 1;
  let active = false;

  // deterministic layout, same garden every visit
  let seed = 31;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  const mix = (a, b, u) => {
    const pa = parseHex(a), pb = parseHex(b);
    return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * u)).join(',')})`;
  };

  /** A leafy sprig pre-rendered to its own canvas: a woody stem entering
   *  from the outer edge, then either blob foliage, a fern frond, or a
   *  hanging vine. Anchor is mid-left of the sprite; the right side reaches
   *  toward the text and stays soft. */
  function makeSprig(kind, w, h) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * dpr);
    c.height = Math.ceil(h * dpr);
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    const dark = mix(C.frond, C.water, 0.5);
    const midc = C.frond;
    const light = mix(C.frond, C.pool, 0.35);
    const ay = h / 2;

    if (kind === 'blob') {
      // a branch with clustered leaves
      g.strokeStyle = mix('#3a3128', C.water, 0.3);
      g.lineCap = 'round';
      g.lineWidth = Math.max(2.5, h * 0.035);
      g.beginPath();
      g.moveTo(-4, ay + h * 0.1);
      g.quadraticCurveTo(w * 0.4, ay + h * 0.02, w * 0.72, ay - h * 0.12);
      g.stroke();
      const lobes = [
        { x: w * 0.45, y: ay - h * 0.02, rr: h * 0.24 },
        { x: w * 0.68, y: ay - h * 0.16, rr: h * 0.28 },
        { x: w * 0.56, y: ay + h * 0.16, rr: h * 0.20 },
      ];
      for (const lb of lobes) {
        g.fillStyle = dark;
        g.globalAlpha = 0.92;
        g.beginPath();
        g.ellipse(lb.x, lb.y, lb.rr * 1.05, lb.rr * 0.85, 0, 0, Math.PI * 2);
        g.fill();
      }
      for (const [shade, n, bias] of [[dark, 16, 0.3], [midc, 22, 0], [light, 14, -0.3]]) {
        g.fillStyle = shade;
        for (const lb of lobes) {
          for (let i = 0; i < n; i++) {
            const a = rnd() * Math.PI * 2;
            const d = (rnd() + rnd()) * 0.5 * lb.rr;
            g.globalAlpha = 0.7 + rnd() * 0.3;
            g.beginPath();
            g.ellipse(
              lb.x + Math.cos(a) * d, lb.y + Math.sin(a) * d * 0.8 + bias * lb.rr,
              lb.rr * (0.12 + rnd() * 0.14), lb.rr * (0.10 + rnd() * 0.12),
              rnd() * 1.5, 0, Math.PI * 2);
            g.fill();
          }
        }
      }
    } else if (kind === 'fern') {
      // one arching frond, leaflets shrinking to the tip
      const tip = { x: w * 0.9, y: ay - h * 0.18 };
      const cx = w * 0.45, cy = ay + h * 0.12;
      g.strokeStyle = midc;
      g.lineCap = 'round';
      g.lineWidth = Math.max(1.5, h * 0.02);
      g.beginPath();
      g.moveTo(-4, ay + h * 0.05);
      g.quadraticCurveTo(cx, cy, tip.x, tip.y);
      g.stroke();
      const nLeaf = 11;
      for (let k = 1; k <= nLeaf; k++) {
        const u = k / (nLeaf + 1);
        const px = qp(-4, cx, tip.x, u), py = qp(ay + h * 0.05, cy, tip.y, u);
        const tx = qd(-4, cx, tip.x, u), ty = qd(ay + h * 0.05, cy, tip.y, u);
        const len = Math.hypot(tx, ty) || 1;
        const nx = -ty / len, ny = tx / len;
        const leaf = h * 0.3 * (1 - u * 0.72);
        g.lineWidth = Math.max(1.2, h * 0.014);
        for (const sgn of [-1, 1]) {
          g.strokeStyle = sgn > 0 ? midc : dark;
          g.globalAlpha = 0.9;
          g.beginPath();
          g.moveTo(px, py);
          g.quadraticCurveTo(
            px + tx / len * leaf * 0.3 + nx * sgn * leaf * 0.5,
            py + ty / len * leaf * 0.3 + ny * sgn * leaf * 0.5,
            px + tx / len * leaf * 0.7 + nx * sgn * leaf * 0.8,
            py + ty / len * leaf * 0.7 + ny * sgn * leaf * 0.8 + leaf * 0.18);
          g.stroke();
        }
      }
    } else {
      // vine: hangs from the top edge with paired leaflets
      const x0 = w * 0.3;
      g.strokeStyle = dark;
      g.lineCap = 'round';
      g.lineWidth = Math.max(1.4, h * 0.012);
      g.beginPath();
      g.moveTo(x0, -4);
      g.quadraticCurveTo(x0 + w * 0.16, h * 0.45, x0 - w * 0.05, h * 0.92);
      g.stroke();
      const nLeaf = 8;
      for (let k = 1; k <= nLeaf; k++) {
        const u = k / (nLeaf + 1);
        const px = qp(x0, x0 + w * 0.16, x0 - w * 0.05, u);
        const py = qp(-4, h * 0.45, h * 0.92, u);
        const leaf = h * 0.075 * (1 - u * 0.3);
        for (const sgn of [-1, 1]) {
          g.fillStyle = sgn > 0 ? midc : light;
          g.globalAlpha = 0.9;
          g.beginPath();
          g.ellipse(px + sgn * leaf * 0.9, py + leaf * 0.2, leaf, leaf * 0.45, sgn * 0.6, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    g.globalAlpha = 1;
    return c;
  }

  const layout = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const margin = (window.innerWidth - contentPx()) / 2;
    active = margin >= MIN_MARGIN;
    for (const s of sides) {
      s.c.style.display = active ? 'block' : 'none';
      if (!active) continue;
      s.W = Math.min(340, margin);
      s.H = window.innerHeight;
      s.c.style.width = `${s.W}px`;
      s.c.style.height = `${s.H}px`;
      s.c.width = Math.ceil(s.W * dpr);
      s.c.height = Math.ceil(s.H * dpr);
      s.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // a column of sprigs, spaced down the strip, wrapping as you scroll
      seed = s.side === 'left' ? 31 : 907;
      s.washes = WASHES[s.side].map((wsh) => ({
        ...wsh, y: wsh.y * 16, ry: (18 + rnd() * 8) * 16,
      }));
      s.sprigs = [];
      const kinds = ['blob', 'fern', 'vine', 'blob', 'fern', 'blob', 'vine', 'fern'];
      const n = Math.max(5, Math.round(s.H / 210));
      // In a slim strip the sprigs shrink with it, so narrow margins get
      // small foliage instead of clipped-off halves of big foliage.
      const slim = Math.min(1, Math.max(0.55, s.W / 210));
      for (let i = 0; i < n; i++) {
        const kind = kinds[i % kinds.length];
        const scale = 0.75 + rnd() * 0.6;
        const w = Math.min(s.W * 0.94, (kind === 'vine' ? 120 : 210) * scale);
        const h = (kind === 'vine' ? 230 : 150) * scale * slim;
        s.sprigs.push({
          kind,
          img: makeSprig(kind, w, h),
          w, h,
          y: (i + rnd() * 0.5) * (s.H / n),
          drift: 0.04 + rnd() * 0.12,       // how much scroll moves it
          ph: rnd() * 6.28,
          alpha: 0.62 + rnd() * 0.3,
        });
      }
    }
  };

  const drawSide = (s, t, scrollY) => {
    const { ctx, W, H } = s;
    ctx.clearRect(0, 0, W, H);

    // a breath of green at the very edge, fading toward the text (the right
    // strip's outer edge is x = W, so its gradient runs the other way)
    const g = s.side === 'left'
      ? ctx.createLinearGradient(0, 0, W, 0)
      : ctx.createLinearGradient(W, 0, 0, 0);
    g.addColorStop(0, hexA(C.frond, 0.10));
    g.addColorStop(0.55, hexA(C.frond, 0.03));
    g.addColorStop(1, hexA(C.frond, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // the oasis washes ride the page itself, fading out before the text
    for (const wsh of s.washes) {
      const y = wsh.y - scrollY;
      if (y < -wsh.ry || y > H + wsh.ry) continue;
      ctx.save();
      ctx.translate(s.side === 'left' ? 0 : W, y);
      ctx.scale(1, wsh.ry / W);
      const wg = ctx.createRadialGradient(0, 0, 0, 0, 0, W);
      wg.addColorStop(0, hexA(wsh.c, wsh.a));
      wg.addColorStop(1, hexA(wsh.c, 0));
      ctx.fillStyle = wg;
      ctx.fillRect(-W, -W, 2 * W, 2 * W);
      ctx.restore();
    }

    for (const sp of s.sprigs) {
      const wrap = H + sp.h * 2;
      let y = (sp.y - scrollY * sp.drift) % wrap;
      if (y < -sp.h) y += wrap;
      const sway = reduceMotion ? 0
        : Math.sin(t * 0.6 + sp.ph) * 0.02 + Math.sin(t * 1.4 + sp.ph * 1.9) * 0.008;
      ctx.save();
      ctx.translate(0, y);
      if (s.side === 'right') { ctx.translate(W, 0); ctx.scale(-1, 1); }
      ctx.rotate(sway);
      ctx.globalAlpha = sp.alpha;
      ctx.drawImage(sp.img, sp.kind === 'vine' ? 0 : -6, -sp.h / 2, sp.w, sp.h);
      ctx.restore();
    }

    // the same rain as the hero, thinner
    if (!reduceMotion) {
      ctx.strokeStyle = C.water2;
      ctx.lineWidth = 1;
      for (let i = 0; i < 16; i++) {
        const h1 = Math.sin(i * 127.1 + (s.side === 'left' ? 0 : 9)) * 43758.5453;
        const rx = h1 - Math.floor(h1);
        const h2 = Math.sin(i * 311.7) * 12543.21;
        const rv = h2 - Math.floor(h2);
        const fall = (t * (0.5 + rv * 0.5)) % 1;
        ctx.globalAlpha = 0.10;
        ctx.beginPath();
        ctx.moveTo(rx * W + fall * 8, fall * H);
        ctx.lineTo(rx * W + fall * 8 - 3, fall * H + 11);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  };

  const frame = (t) => {
    const scrollY = window.scrollY || 0;
    for (const s of sides) drawSide(s, t, scrollY);
  };

  layout();
  let relayoutPending = false;
  window.addEventListener('resize', () => {
    if (relayoutPending) return;
    relayoutPending = true;
    requestAnimationFrame(() => {
      relayoutPending = false;
      layout();
      if (reduceMotion && active) frame(0.4);
    });
  });

  if (reduceMotion) {
    if (active) frame(0.4);
    return;
  }
  const t0 = performance.now();
  const loop = () => {
    requestAnimationFrame(loop);
    if (!active || document.hidden) return;
    frame((performance.now() - t0) / 1000);
  };
  loop();
}

/* quadratic bezier point + derivative */
function qp(a, b, c, u) { return (1 - u) * (1 - u) * a + 2 * (1 - u) * u * b + u * u * c; }
function qd(a, b, c, u) { return 2 * (1 - u) * (b - a) + 2 * u * (c - b); }

function hexA(hex, a) {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r},${g},${b},${a})`;
}
function parseHex(h) {
  h = h.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.startsWith('rgb')) return h.match(/\d+/g).slice(0, 3).map(Number);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
