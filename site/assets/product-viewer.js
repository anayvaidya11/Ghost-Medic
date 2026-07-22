/**
 * PRODUCT CONCEPT VIEWER: a 3D sketch of how the system would be worn:
 * a wrist unit (open band + case with a concept display) wired to a belt pack.
 *
 * This is NOT CAD and not a design file. Every shape is a placeholder built in
 * code to show the idea and where the finished software and the hand-designed
 * PCB would live. The page says the same next to it. The display on the case
 * is CONCEPT ONLY: the built board has no screen. The cable is deliberate: the
 * bridge is a wired, local stand-in for the eventual wrist-to-pack BLE link.
 *
 * Fallback: if WebGL is unavailable, the mount keeps its 2D SVG diagram and
 * this module exits.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const GRAPHITE = 0x23261f;   // enclosures, band, cable
const CARBON   = 0x181a16;   // darker inserts, seam, screen bezel
const STEEL    = 0xb9bdb6;   // clasp, connector bosses
const MOSS     = 0x86a37e;   // screen text bars
const CLAY     = 0x9c4f28;   // the alert bar on the screen

export function mountProductViewer({ mount, status }) {
  const say = (msg) => { if (status) status.textContent = msg; };

  if (!hasWebGL()) {
    say('WebGL is unavailable, so the concept is shown as a flat diagram.');
    return;
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const canvas = document.createElement('canvas');
  canvas.className = 'board-canvas';
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label',
    'Interactive 3D concept sketch: a wrist band with a case and screen, joined by a cable ' +
    'to a curved belt pack. Numbered markers match the legend below. Drag to rotate, scroll ' +
    'to zoom. This is a concept, not CAD.');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const key = new THREE.DirectionalLight(0xfff4e6, 1.7);
  key.position.set(60, 120, 70);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0005;
  Object.assign(key.shadow.camera, { left: -160, right: 160, top: 160, bottom: -160, near: 10, far: 400 });
  key.shadow.camera.updateProjectionMatrix();
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xdfe6e0, 0.55);
  rim.position.set(-80, 40, -60);
  scene.add(rim);

  const mat = (color, rough = 0.55, metal = 0.0) =>
    new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, side: THREE.DoubleSide });
  const sh = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

  // ══ WRIST UNIT ════════════════════════════════════════════════════════════
  // Band: an OPEN arc (about 300 degrees, gap at the bottom), rectangular
  // cross-section, tapering slightly toward the open ends. Not a torus.
  const wrist = new THREE.Group();
  const bandMat = mat(GRAPHITE, 0.9);
  for (const g of bandGeometries({
    innerR: 26, arcDeg: 300, width: 22, widthEnd: 15, thick: 3, thickEnd: 2.2, steps: 72,
  })) {
    wrist.add(sh(new THREE.Mesh(g, bandMat)));
  }

  // Case: rounded slab sitting tangent on the band's outer surface at the top.
  // 48 along the arm (z), 40 across (x), 11 thick, 5 mm fillets.
  const CASE_Y = 29 + 5.5 - 0.8;          // band outer top + half height, seated 0.8
  const kase = sh(new THREE.Mesh(new RoundedBoxGeometry(40, 11, 48, 4, 5), mat(GRAPHITE, 0.4, 0.2)));
  kase.position.y = CASE_Y;
  wrist.add(kase);

  // Concept display on the case face: dark glass with a uniform bezel and a
  // few abstract guidance bars. No numbers, nothing that reads as a vital.
  const glass = new THREE.Mesh(
    new RoundedBoxGeometry(34, 1.2, 42, 2, 1.5),
    new THREE.MeshStandardMaterial({ color: 0x11150f, roughness: 0.2, emissive: 0x0c120b, emissiveIntensity: 0.6 }));
  glass.position.y = CASE_Y + 5.3;
  wrist.add(glass);
  for (let i = 0; i < 3; i++) {
    const bar = new THREE.Mesh(
      new RoundedBoxGeometry(24 - (i % 2) * 5, 0.5, 2.2, 2, 0.7),
      new THREE.MeshStandardMaterial({ color: MOSS, roughness: 0.5, emissive: 0x3f5c38, emissiveIntensity: 0.55 }));
    bar.position.set(-2 + (i % 2) * 2.5, CASE_Y + 6.1, -13 + i * 6);
    wrist.add(bar);
  }
  const alert = new THREE.Mesh(
    new RoundedBoxGeometry(26, 0.5, 4.2, 2, 1.2),
    new THREE.MeshStandardMaterial({ color: CLAY, roughness: 0.5, emissive: 0x5e2a10, emissiveIntensity: 0.55 }));
  alert.position.set(0, CASE_Y + 6.1, 13);
  wrist.add(alert);

  // Cable connector boss on the case side facing the pack.
  const wristBoss = sh(new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 4, 14), mat(STEEL, 0.35, 0.85)));
  wristBoss.rotation.z = Math.PI / 2;
  wristBoss.position.set(21, CASE_Y - 1.5, 0);
  wrist.add(wristBoss);

  wrist.rotation.y = 0.55;                // three-quarter view: case face + curvature
  wrist.rotation.x = 0.10;
  wrist.position.set(-62, 24, 10);
  scene.add(wrist);

  // ══ BELT PACK: curved enclosure, compute + battery, belt strap ═══════════
  // A RoundedBox bent around a 150 mm body radius so the inner face is
  // concave against the waist.
  const pack = new THREE.Group();

  const shellGeo = new RoundedBoxGeometry(120, 80, 25, 5, 6);
  bendAroundY(shellGeo, 150, 162.5);
  shellGeo.computeVertexNormals();
  const shell = sh(new THREE.Mesh(shellGeo, mat(GRAPHITE, 0.55)));
  pack.add(shell);

  // Seam hinting at the two-part interior: compute on one side, battery on
  // the other. A vertical recessed line on the outer face.
  pack.add(onOuterFace(new THREE.BoxGeometry(0.9, 70, 0.8), CARBON, 0.14, 0, 175.6, sh, mat));

  // Passive vent slots near the top, compute side.
  for (let i = 0; i < 3; i++) {
    pack.add(onOuterFace(new THREE.BoxGeometry(11, 1.5, 0.8), CARBON, -0.16, 26 - i * 5, 175.6, sh, mat));
  }

  // Belt strap passing behind the inner face through two loops.
  const strapGeo = new RoundedBoxGeometry(190, 24, 3, 3, 1.4);
  bendAroundY(strapGeo, 145, 146.5);
  strapGeo.computeVertexNormals();
  const strap = sh(new THREE.Mesh(strapGeo, mat(CARBON, 0.85)));
  pack.add(strap);
  for (const th of [-0.24, 0.24]) {
    pack.add(onOuterFace(new THREE.BoxGeometry(13, 32, 2.5), GRAPHITE, th, 0, 143.2, sh, mat));
  }

  // Cable connector boss on the outer face, wrist side.
  const packBossGroup = new THREE.Group();
  const packBoss = sh(new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 5, 14), mat(STEEL, 0.35, 0.85)));
  packBoss.rotation.x = Math.PI / 2;
  packBossGroup.rotation.y = -0.3;
  packBoss.position.set(0, 18, 176);
  packBossGroup.add(packBoss);
  packBossGroup.position.z = -162.5;
  pack.add(packBossGroup);

  pack.position.set(62, 40, -34);
  pack.rotation.y = -0.75;              // show the curved profile, seam and vents
  scene.add(pack);

  // ══ THE CABLE: a solid tube with natural slack, boss to boss ═════════════
  scene.updateMatrixWorld(true);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  wristBoss.getWorldPosition(a);
  packBoss.getWorldPosition(b);
  const m1 = a.clone().lerp(b, 0.35);
  const m2 = a.clone().lerp(b, 0.7);
  m1.y = Math.max(8, Math.min(a.y, b.y) - 16);   // shallow sag, not taut, not an arc
  m2.y = Math.max(10, Math.min(a.y, b.y) - 10);
  const curve = new THREE.CatmullRomCurve3([a, m1, m2, b]);
  const cable = sh(new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 1.1, 10), mat(GRAPHITE, 0.7)));
  scene.add(cable);

  // ══ NUMBERED MARKERS ══════════════════════════════════════════════════════
  const marker = (n, pos) => {
    const c = document.createElement('canvas');
    c.width = c.height = 96;
    const g = c.getContext('2d');
    g.beginPath(); g.arc(48, 48, 40, 0, Math.PI * 2);
    g.fillStyle = '#F4F1E9'; g.fill();
    g.lineWidth = 5; g.strokeStyle = '#2C4630'; g.stroke();
    g.fillStyle = '#2C4630';
    g.font = '700 44px ui-monospace, Menlo, monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(n), 48, 51);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(c), depthTest: false, sizeAttenuation: true,
    }));
    sprite.scale.set(9, 9, 1);
    sprite.position.copy(pos);
    sprite.renderOrder = 10;
    return sprite;
  };
  scene.add(marker(1, new THREE.Vector3(-80, 56, 18)));               // case: PCB + firmware
  scene.add(marker(2, new THREE.Vector3(-46, 74, 14)));               // concept display
  scene.add(marker(3, curve.getPoint(0.55).add(new THREE.Vector3(0, 12, 6)))); // wired link
  scene.add(marker(4, new THREE.Vector3(84, 92, -16)));               // belt pack

  // ground shadow
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(500, 500), new THREE.ShadowMaterial({ opacity: 0.16 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // ══ CAMERA + CONTROLS ═════════════════════════════════════════════════════
  const camera = new THREE.PerspectiveCamera(36, 1, 1, 1000);
  camera.position.set(12, 95, 235);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.enablePan = false;
  controls.target.set(0, 34, 0);
  controls.minDistance = 110;
  controls.maxDistance = 420;
  controls.minPolarAngle = 0.15;
  controls.maxPolarAngle = Math.PI / 2 - 0.05;
  controls.autoRotate = !reduceMotion;
  controls.autoRotateSpeed = 0.5;
  controls.addEventListener('start', () => { controls.autoRotate = false; });

  mount.insertBefore(canvas, mount.firstChild);
  mount.classList.add('is-3d');
  say('');

  let resizePending = false;
  const resize = () => {
    resizePending = false;
    const w = mount.clientWidth;
    if (!w) return;
    const h = Math.max(300, Math.round(w * 0.56));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  new ResizeObserver(() => {
    if (resizePending) return;
    resizePending = true;
    requestAnimationFrame(resize);
  }).observe(mount);

  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.01 }).observe(mount);

  renderer.setAnimationLoop(() => {
    if (!visible) return;
    controls.update();
    renderer.render(scene, camera);
  });
}

/**
 * Sweeps a rectangular cross-section along an open circular arc and returns
 * one geometry per face (outer, inner, two sides, two end caps). Separate
 * faces keep the cross-section edges crisp while staying smooth along the
 * sweep. Angle 0 is the top of the arc; the gap is at the bottom.
 */
function bandGeometries({ innerR, arcDeg, width, widthEnd, thick, thickEnd, steps }) {
  const half = (arcDeg / 2) * (Math.PI / 180);
  const ring = (i) => {
    const t = i / steps;                 // 0..1 along the sweep
    const theta = -half + t * 2 * half;
    const edge = Math.pow(Math.abs(theta) / half, 1.6);   // taper factor
    const w = width + (widthEnd - width) * edge;
    const th = thick + (thickEnd - thick) * edge;
    const sin = Math.sin(theta), cos = Math.cos(theta);
    const at = (r, z) => [r * sin, r * cos, z];
    return [
      at(innerR, -w / 2),        // c0 inner, -z
      at(innerR + th, -w / 2),   // c1 outer, -z
      at(innerR + th, w / 2),    // c2 outer, +z
      at(innerR, w / 2),         // c3 inner, +z
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

/** Bends a geometry around the Y axis: x becomes arc length at body radius R. */
function bendAroundY(geo, bodyR, midR) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const theta = x / bodyR;
    const r = midR + z;
    p.setX(i, r * Math.sin(theta));
    p.setZ(i, r * Math.cos(theta) - midR);
  }
  p.needsUpdate = true;
}

/**
 * Places a small detail flush on a face of the bent shell at angle `theta`
 * (radians around the body) and height `y`, at radius `r` from the curvature
 * centre. The rotation happens about the curvature centre (z = -162.5), which
 * is what keeps the detail on the curved surface.
 */
function onOuterFace(geometry, color, theta, y, r, sh, mat) {
  const pivot = new THREE.Group();
  pivot.position.z = -162.5;
  pivot.rotation.y = theta;
  const m = sh(new THREE.Mesh(geometry, mat(color, 0.6)));
  m.position.set(0, y, r);
  pivot.add(m);
  return pivot;
}

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}
