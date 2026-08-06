/**
 * DEVICE MODELS: the concept hardware, built in code.
 *
 * Three builders, shared by the product viewer and the render harness:
 *   buildWristUnit()  the wrist sensor accessory. The board and firmware are
 *                     real; the enclosure is a concept. It has NO display,
 *                     because the board that was designed has no display.
 *   buildPhone()      the end-user device. The software on its screen is real
 *                     (the app runs today); the phone body is a placeholder
 *                     slab standing in for whatever device the responder
 *                     already carries.
 *   buildBeltPack()   the belt computer this project designed and then KILLED
 *                     (2026-08-05, docs/POSITIONING.md). Kept buildable so the
 *                     render harness can still show what was rejected; the
 *                     site no longer ships it in the scene.
 *
 * Every part is placeholder geometry, not CAD. Textures are drawn into
 * canvases at runtime, so nothing here adds an asset or a network request.
 */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const GRAPHITE = 0x23261f;   // enclosures, band, cable
export const CARBON   = 0x181a16;   // darker inserts, seam
export const STEEL    = 0xb9bdb6;   // clasp, connector bosses
export const STRAP    = 0x3d4038;   // belt webbing
export const MOSS     = 0x86a37e;   // status LED, screen accents
export const CLAY     = 0x9c4f28;   // the evacuation bar on the phone screen

export const PACK_MID_R   = 162.5;  // the pack's curvature centre, in pack-local Z
export const PACK_INNER_R = 150;    // its inner face, the surface that meets the body

const mat = (color, rough = 0.55, metal = 0.0) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, side: THREE.DoubleSide });
const sh = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

/* ── canvas texture helpers ─────────────────────────────────────────────────
   Fine surface variation is what separates "moulded part" from "extruded
   solid colour". These draw it at runtime instead of shipping image files. */

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

/** Speckled roughness: a mid-grey field with fine bright/dark grain, so the
 *  polymer catches light unevenly the way an injection-moulded texture does. */
function speckleRoughness(base = 150, grain = 46, n = 2600) {
  const tex = canvasTexture(256, 256, (g) => {
    g.fillStyle = `rgb(${base},${base},${base})`;
    g.fillRect(0, 0, 256, 256);
    let seed = 9;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < n; i++) {
      const v = base + Math.floor((rnd() - 0.5) * 2 * grain);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(rnd() * 256, rnd() * 256, 1.6, 1.6);
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

/** Brushed roughness: fine horizontal streaks for anodised metal. */
function brushedRoughness(base = 96, streak = 40) {
  const tex = canvasTexture(256, 256, (g) => {
    g.fillStyle = `rgb(${base},${base},${base})`;
    g.fillRect(0, 0, 256, 256);
    let seed = 5;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 420; i++) {
      const v = base + Math.floor((rnd() - 0.5) * 2 * streak);
      g.strokeStyle = `rgba(${v},${v},${v},0.55)`;
      g.lineWidth = 0.8 + rnd() * 0.8;
      const y = rnd() * 256;
      g.beginPath(); g.moveTo(0, y); g.lineTo(256, y + (rnd() - 0.5) * 3); g.stroke();
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** The phone screen: the real app's layout, drawn as a mock. Header, live
 *  mark, the three honest readings, numbered step bars, the evacuation bar.
 *  Deliberately no readable medical text and no vitals the device cannot
 *  measure. Palette matches app/index.tsx. */
function phoneScreenTexture() {
  const tex = canvasTexture(360, 760, (g, w, h) => {
    g.fillStyle = '#0a0f0a'; g.fillRect(0, 0, w, h);
    const mono = (px, weight = 400) => `${weight} ${px}px Menlo, monospace`;

    g.fillStyle = '#7cff6b'; g.font = mono(26, 700);
    g.textBaseline = 'top';
    g.fillText('ARCHIATER', 26, 30);
    g.font = mono(15); g.fillText('● LIVE', w - 92, 38);

    g.fillStyle = '#6b7560'; g.font = mono(11);
    g.fillText('DECISION SUPPORT · NOT A MEDICAL DEVICE', 26, 66);

    // readings row: the three things the accessory honestly reports
    const cols = [['ALT', '+2.1 m'], ['AIR', '21.0°C'], ['FALL', 'NO']];
    cols.forEach(([k, v], i) => {
      const x = 26 + i * 108;
      g.fillStyle = '#6b7560'; g.font = mono(12); g.fillText(k, x, 104);
      g.fillStyle = '#dce5d4'; g.font = mono(17, 600); g.fillText(v, x, 122);
    });
    g.strokeStyle = '#1d241d'; g.lineWidth = 2;
    g.strokeRect(18, 92, w - 36, 62);

    // numbered candidate actions, as bars rather than fake advice
    for (let i = 0; i < 4; i++) {
      const y = 196 + i * 92;
      g.fillStyle = '#7cff6b'; g.font = mono(20, 700);
      g.fillText(String(i + 1) + '.', 26, y);
      g.fillStyle = i % 2 ? '#232b22' : '#283226';
      g.fillRect(62, y - 2, w - 96 - (i % 3) * 34, 24);
      g.fillRect(62, y + 30, w - 150 - (i % 2) * 44, 24);
    }

    // the evacuation line, the one row that matters most
    g.fillStyle = '#9c4f28';
    g.fillRect(18, 596, w - 36, 74);
    g.fillStyle = '#f4f1e9'; g.font = mono(13, 600);
    g.fillText('EVACUATION', 34, 610);
    g.fillStyle = 'rgba(244,241,233,0.75)';
    g.fillRect(34, 636, w - 110, 18);

    g.fillStyle = '#43503f'; g.font = mono(11);
    g.fillText('hold to speak · type · photo', 26, 706);
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ════════════════════════════════════════════════════════════════════════════
   THE WRIST SENSOR ACCESSORY
   Built at the origin: the band's circle lies in local XY, the arm runs along
   local +Z, and the case seats on local +Y. The caller positions it.
   ════════════════════════════════════════════════════════════════════════════ */
export function buildWristUnit({ bore = 26 } = {}) {
  const group = new THREE.Group();
  const OUTER = bore + 3;                 // band outer radius
  const CASE_Y = OUTER + 5.5 - 0.8;       // band outer top + half height, seated 0.8

  // Band: an OPEN arc (about 300 degrees, gap at the bottom), tapering toward
  // the open ends. `bore` is sized by the caller to the wrist it is worn on,
  // the way a strap is. A darker inner liner runs just inside it, so the
  // strap reads as two moulded layers rather than one extruded ribbon.
  const bandMat = mat(GRAPHITE, 0.9);
  bandMat.roughnessMap = speckleRoughness(190, 40);
  for (const g of bandGeometries({
    innerR: bore, arcDeg: 300, width: 22, widthEnd: 15, thick: 3, thickEnd: 2.2, steps: 72,
  })) {
    group.add(sh(new THREE.Mesh(g, bandMat)));
  }
  const linerMat = mat(CARBON, 0.85);
  for (const g of bandGeometries({
    innerR: bore - 0.6, arcDeg: 296, width: 18, widthEnd: 12, thick: 0.8, thickEnd: 0.8, steps: 64,
  })) {
    group.add(sh(new THREE.Mesh(g, linerMat)));
  }


  // Case: rounded slab, anodised finish, seated tangent on the band's crown.
  const caseMat = new THREE.MeshStandardMaterial({
    color: GRAPHITE, roughness: 0.38, metalness: 0.45,
    roughnessMap: brushedRoughness(92, 36), side: THREE.DoubleSide,
  });
  const kase = sh(new THREE.Mesh(new RoundedBoxGeometry(40, 11, 48, 5, 5), caseMat));
  kase.position.y = CASE_Y;
  group.add(kase);

  // Top plate: a machined-looking inset in place of the display an earlier
  // concept carried. The board has no screen, so the case doesn't either; the
  // phone is the display now. A shallow engraved ring and a pinhole LED keep
  // the face from reading as an unfinished blank.
  // Kept dark and matte enough that it can never read as a screen: the point
  // of this face is that there isn't one.
  const plate = sh(new THREE.Mesh(new RoundedBoxGeometry(35, 1.0, 43, 3, 2),
    new THREE.MeshStandardMaterial({
      color: 0x1d201b, roughness: 0.5, metalness: 0.35,
      roughnessMap: brushedRoughness(128, 26),
    })));
  plate.position.y = CASE_Y + 5.4;
  group.add(plate);
  const topLed = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.7, 14),
    new THREE.MeshStandardMaterial({ color: MOSS, roughness: 0.4, emissive: 0x3f5c38, emissiveIntensity: 0.8 }));
  topLed.position.set(0, CASE_Y + 6.0, 16);
  group.add(topLed);

  // Cable connector boss on the case side facing the device.
  const boss = sh(new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 4.5, 18), mat(STEEL, 0.3, 0.9)));
  boss.rotation.z = Math.PI / 2;
  boss.position.set(21, CASE_Y - 1.5, 0);
  group.add(boss);

  // Two side buttons: the board's real SW1 (reset) and SW2 (bootsel). Not a
  // crown; the board has no encoder.
  for (const z of [8, -8]) {
    const btn = sh(new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 3.2, 16), mat(STEEL, 0.34, 0.85)));
    btn.rotation.z = Math.PI / 2;
    btn.position.set(-20.6, CASE_Y + 0.4, z);
    group.add(btn);
  }

  // Optical aperture on the underside: the window over the MAX30102, which is
  // on the board. Raw red/IR only, so nothing about it glows.
  const apRing = sh(new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 0.7, 24), mat(STEEL, 0.34, 0.85)));
  apRing.position.set(0, CASE_Y - 5.5, 0);
  group.add(apRing);
  const apGlass = sh(new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 0.8, 24),
    new THREE.MeshStandardMaterial({ color: 0x0d0f0c, roughness: 0.2, metalness: 0.1 })));
  apGlass.position.set(0, CASE_Y - 5.8, 0);
  group.add(apGlass);

  // Strap lugs where the band emerges from under the case, tucked tight so
  // they read as retainers rather than fins.
  for (const z of [10.5, -10.5]) {
    const lug = sh(new THREE.Mesh(new RoundedBoxGeometry(12, 3.5, 4, 3, 1.2), mat(GRAPHITE, 0.6)));
    lug.position.set(0, CASE_Y - 6.2, z);
    group.add(lug);
  }

  return { group, boss, kase, plate };
}

/* ════════════════════════════════════════════════════════════════════════════
   THE END-USER DEVICE (a phone-class slab)
   Built at the origin: screen faces local +Z, long edge along local Y. The
   caller mounts it. The software on the screen is real; the slab is not.
   ════════════════════════════════════════════════════════════════════════════ */
export function buildPhone() {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x1c1f1a, roughness: 0.42, metalness: 0.55,
    roughnessMap: brushedRoughness(100, 30), side: THREE.DoubleSide,
  });
  const body = sh(new THREE.Mesh(new RoundedBoxGeometry(72, 150, 8.5, 5, 4), bodyMat));
  group.add(body);

  // Screen: nearly edge-to-edge dark glass carrying the app-layout mock.
  const screenTex = phoneScreenTexture();
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(66, 143),
    new THREE.MeshStandardMaterial({
      map: screenTex,
      emissiveMap: screenTex,
      emissive: 0xffffff, emissiveIntensity: 0.55,
      roughness: 0.12, metalness: 0.0,
    }));
  screen.position.z = 4.3;
  group.add(screen);

  // Camera block on the back: two generic lenses, no brand cues.
  const bump = sh(new THREE.Mesh(new RoundedBoxGeometry(24, 24, 2.0, 3, 1.6), mat(CARBON, 0.4, 0.3)));
  bump.position.set(-18, 55, -5.0);
  group.add(bump);
  for (const dy of [6, -6]) {
    const lens = sh(new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.4, 1.4, 22),
      new THREE.MeshStandardMaterial({ color: 0x0b0d0a, roughness: 0.12, metalness: 0.2 })));
    lens.rotation.x = Math.PI / 2;
    lens.position.set(-18, 55 + dy, -6.2);
    group.add(lens);
  }

  // Side buttons.
  for (const [y, h] of [[34, 14], [12, 22]]) {
    const btn = sh(new THREE.Mesh(new RoundedBoxGeometry(1.6, h, 3.2, 2, 0.7), mat(STEEL, 0.35, 0.8)));
    btn.position.set(36.5, y, 0);
    group.add(btn);
  }

  // Bottom port with a steel collar: where the accessory's cable lands.
  const well = sh(new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 2.2, 18), mat(0x0e100d, 0.8)));
  well.position.set(0, -74.6, 0);
  group.add(well);
  const boss = sh(new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.0, 4.0, 18), mat(STEEL, 0.3, 0.9)));
  boss.position.set(0, -76.5, 0);
  group.add(boss);

  return { group, boss, body, screen };
}

/* ════════════════════════════════════════════════════════════════════════════
   THE BELT PACK (killed 2026-08-05; kept buildable for the record)
   Built at the origin, curvature centre at local z = -PACK_MID_R, inner face
   toward -Z. The caller seats it.
   ════════════════════════════════════════════════════════════════════════════ */
export function buildBeltPack({ strap = true } = {}) {
  const group = new THREE.Group();

  const shellMat = mat(GRAPHITE, 0.42, 0.08);
  shellMat.roughnessMap = speckleRoughness(120, 44);
  const shellGeo = new RoundedBoxGeometry(120, 80, 25, 6, 8);
  bendAroundY(shellGeo, PACK_MID_R);
  shellGeo.computeVertexNormals();
  const shell = sh(new THREE.Mesh(shellGeo, shellMat));
  group.add(shell);

  // Bumper frame: a slightly larger, softer ring in darker TPU tone.
  const bumperGeo = new RoundedBoxGeometry(123, 83, 24, 6, 9);
  bendAroundY(bumperGeo, PACK_MID_R + 0.4);
  bumperGeo.computeVertexNormals();
  const bumper = sh(new THREE.Mesh(bumperGeo, mat(CARBON, 0.78)));
  bumper.scale.setScalar(0.997);
  group.add(bumper);

  // Parting seam at mid-thickness.
  const seamGeo = new RoundedBoxGeometry(121, 2.0, 26, 4, 0.9);
  bendAroundY(seamGeo, PACK_MID_R);
  seamGeo.computeVertexNormals();
  group.add(sh(new THREE.Mesh(seamGeo, mat(CARBON, 0.75))));

  group.add(onOuterFace(new THREE.BoxGeometry(0.9, 70, 0.8), CARBON, 0.14, 0, 175.6));
  group.add(onOuterFace(new RoundedBoxGeometry(24, 28, 0.8, 5, 1.2), 0x131610, -0.16, 12, 175.3));
  for (let i = 0; i < 4; i++) {
    group.add(onOuterFace(new THREE.BoxGeometry(19, 2.2, 1.1), GRAPHITE, -0.16, 22 - i * 6.5, 176.0));
  }

  const ledPivot = new THREE.Group();
  ledPivot.position.z = -PACK_MID_R;
  ledPivot.rotation.y = 0.34;
  const led = sh(new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.9, 20),
    new THREE.MeshStandardMaterial({ color: MOSS, roughness: 0.4, emissive: 0x3f5c38, emissiveIntensity: 0.7 })));
  led.rotation.x = Math.PI / 2;
  led.position.set(0, 30, 175.4);
  ledPivot.add(led);
  group.add(ledPivot);

  if (strap) {
    const strapMat = mat(STRAP, 0.95);
    for (const g of strapGeometries({ innerR: 147.5, arcRad: 1.22, hCenter: 22, hEnd: 7, thick: 2.5, steps: 110 })) {
      group.add(sh(new THREE.Mesh(g, strapMat)));
    }
  }

  const bossGroup = new THREE.Group();
  const well = sh(new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 2.4, 20), mat(0x0e100d, 0.8)));
  well.rotation.x = Math.PI / 2;
  well.position.set(0, 18, 174.6);
  bossGroup.add(well);
  const boss = sh(new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 5, 18), mat(STEEL, 0.3, 0.9)));
  boss.rotation.x = Math.PI / 2;
  boss.position.set(0, 18, 176);
  bossGroup.add(boss);
  bossGroup.rotation.y = -0.3;
  bossGroup.position.z = -PACK_MID_R;
  group.add(bossGroup);

  return { group, boss, shell };
}

/* ════════════════════════════════════════════════════════════════════════════
   GEOMETRY HELPERS (verified in earlier sessions; see ROADMAP Phase 4c/4d)
   ════════════════════════════════════════════════════════════════════════════ */

/**
 * Sweeps a rectangular cross-section along an open circular arc and returns
 * one geometry per face. Angle 0 is the top of the arc; the gap is at the
 * bottom.
 */
export function bandGeometries({ innerR, arcDeg, width, widthEnd, thick, thickEnd, steps }) {
  const half = (arcDeg / 2) * (Math.PI / 180);
  const ring = (i) => {
    const t = i / steps;
    const theta = -half + t * 2 * half;
    const edge = Math.pow(Math.abs(theta) / half, 1.6);
    const w = width + (widthEnd - width) * edge;
    const th = thick + (thickEnd - thick) * edge;
    const sin = Math.sin(theta), cos = Math.cos(theta);
    const at = (r, z) => [r * sin, r * cos, z];
    return [
      at(innerR, -w / 2),
      at(innerR + th, -w / 2),
      at(innerR + th, w / 2),
      at(innerR, w / 2),
    ];
  };

  const strip = (ca, cb) => {
    const pos = [];
    const idx = [];
    for (let i = 0; i <= steps; i++) {
      const c = ring(i);
      pos.push(...c[ca], ...c[cb]);
      if (i < steps) {
        const k = i * 2;
        idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };

  const cap = (i) => {
    const c = ring(i);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(
      [...c[0], ...c[1], ...c[2], ...c[3]], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.computeVertexNormals();
    return g;
  };

  return [strip(1, 2), strip(0, 3), strip(0, 1), strip(3, 2), cap(0), cap(steps)];
}

/**
 * Sweeps a tapering rectangular cross-section along an arc around the Y axis,
 * for the belt strap. Depths are relative to the pack's curvature centre.
 */
export function strapGeometries({ innerR, arcRad, hCenter, hEnd, thick, steps }) {
  const half = arcRad / 2;

  const ring = (i) => {
    const t = i / steps;
    const theta = -half + t * arcRad;
    const edge = Math.pow(Math.abs(theta) / half, 1.5);
    const h = hCenter + (hEnd - hCenter) * edge;
    const sin = Math.sin(theta), cos = Math.cos(theta);
    const at = (r, y) => [r * sin, y, r * cos - PACK_MID_R];
    return [
      at(innerR, -h / 2),
      at(innerR + thick, -h / 2),
      at(innerR + thick, h / 2),
      at(innerR, h / 2),
    ];
  };

  const strip = (ca, cb) => {
    const pos = [], idx = [];
    for (let i = 0; i <= steps; i++) {
      const c = ring(i);
      pos.push(...c[ca], ...c[cb]);
      if (i < steps) {
        const k = i * 2;
        idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };

  return [strip(1, 2), strip(0, 3), strip(0, 1), strip(3, 2)];
}

/**
 * Bends a geometry around the Y axis so a flat panel wraps the waist. Each
 * vertex keeps its own radius r = midR + z and takes the angle theta = x / r,
 * preserving the panel's width on every layer. (The fixed-radius shortcut
 * squeezed the inner face into a wedge; see ROADMAP Phase 4c.)
 */
export function bendAroundY(geo, midR) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const r = midR + z;
    const theta = x / r;
    p.setX(i, r * Math.sin(theta));
    p.setZ(i, r * Math.cos(theta) - midR);
  }
  p.needsUpdate = true;
}

/** Places a small detail flush on a face of the bent shell. */
export function onOuterFace(geometry, color, theta, y, r) {
  const pivot = new THREE.Group();
  pivot.position.z = -PACK_MID_R;
  pivot.rotation.y = theta;
  const m = sh(new THREE.Mesh(geometry, mat(color, 0.6)));
  m.position.set(0, y, r);
  pivot.add(m);
  return pivot;
}
