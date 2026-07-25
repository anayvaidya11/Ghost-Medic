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
 * Two arrangements, same parts:
 *   default        the two units alone, floating, for reading the enclosures
 *   wearer: true   the same units placed on a cropped body form from
 *                  wearer-figure.js, which is also a placeholder built in code
 *                  and is not a scan of anyone
 *
 * Fallback: if WebGL is unavailable, the mount keeps its 2D SVG diagram and
 * this module exits.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildWearer } from './wearer-figure.js';

const GRAPHITE = 0x23261f;   // enclosures, band, cable
const CARBON   = 0x181a16;   // darker inserts, seam, screen bezel
const STEEL    = 0xb9bdb6;   // clasp, connector bosses
const STRAP    = 0x3d4038;   // belt webbing, lighter than the enclosure
const MOSS     = 0x86a37e;   // screen text bars
const CLAY     = 0x9c4f28;   // the alert bar on the screen

const PACK_MID_R   = 162.5;  // the pack's curvature centre, in pack-local Z
const PACK_INNER_R = 150;    // its inner face, the surface that meets the body

const mat = (color, rough = 0.55, metal = 0.0) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, side: THREE.DoubleSide });
const sh = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

export function mountProductViewer({ mount, status, wearer = false }) {
  const say = (msg) => { if (status) status.textContent = msg; };

  if (!hasWebGL()) {
    say('WebGL is unavailable, so the concept is shown as a flat diagram.');
    return;
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const canvas = document.createElement('canvas');
  canvas.className = 'board-canvas';
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', wearer
    ? 'Interactive 3D concept sketch: a wrist unit with a case and screen worn on a raised ' +
      'forearm, joined by a cable to a pack on the belt of a cropped body form. Numbered ' +
      'markers match the legend below. Drag to rotate, scroll to zoom. This is a concept, not CAD.'
    : 'Interactive 3D concept sketch: a wrist band with a case and screen, joined by a cable ' +
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

  const S = wearer ? 2.6 : 1;            // the wearer scene is about 2.6x wider

  const key = new THREE.DirectionalLight(0xfff4e6, 1.7);
  key.position.set(60 * S, 120 * S, 70 * S);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0005;
  key.shadow.radius = 4.5;             // softer falloff, less of a hard cutout
  Object.assign(key.shadow.camera, {
    left: -160 * S, right: 160 * S, top: 160 * S, bottom: -160 * S, near: 10, far: 400 * S,
  });
  key.shadow.camera.updateProjectionMatrix();
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xdfe6e0, 0.55);
  rim.position.set(-80 * S, 40 * S, -60 * S);
  scene.add(rim);
  // A low fill from the front keeps the dark enclosures from going flat black
  // where neither the key nor the rim reaches.
  const fill = new THREE.DirectionalLight(0xf2ece0, 0.28);
  fill.position.set(30 * S, 20 * S, 120 * S);
  scene.add(fill);

  const wristUnit = buildWristUnit();
  const beltPack = buildBeltPack({ strap: !wearer });
  scene.add(wristUnit.group, beltPack.group);

  let figure = null;
  if (wearer) {
    figure = buildWearer();
    scene.add(figure.group);

    // The wrist unit rides the forearm on the frame the figure hands back.
    wristUnit.group.position.copy(figure.wrist.position);
    wristUnit.group.quaternion.copy(figure.wrist.quaternion);

    // The pack seats on the belt. Its group origin sits PACK_MID_R out from its
    // own curvature centre and its inner face 12.5 mm short of that, so putting
    // the origin at seat + (12.5 + standoff) along the surface normal lands the
    // inner face on the body with the standoff a belt pack really has.
    const { position: seatP, normal: seatN } = figure.belt;
    const standoff = 3;
    beltPack.group.rotation.y = Math.atan2(seatN.x, seatN.z);
    beltPack.group.position.copy(seatP)
      .addScaledVector(seatN, (PACK_MID_R - PACK_INNER_R) + standoff);
  } else {
    wristUnit.group.rotation.y = 0.55;    // three-quarter view: case face + curvature
    wristUnit.group.rotation.x = 0.10;
    wristUnit.group.position.set(-62, 24, 10);
    beltPack.group.position.set(56, 40, -32);
    beltPack.group.rotation.y = -0.5;     // shows the curved profile; strap clears both sides
  }

  // ══ THE CABLE: a solid tube hanging boss to boss ══════════════════════════
  // Standalone, the bosses sit about 75 mm apart with the floor at y = 0, so the
  // belly can drop well below them and still clear the ground. Two low mid-points
  // at the same height give the full, slack droop of a real cable rather than a
  // taut line across the gap. On the body the drop is nearly 280 mm and the
  // torso is in the way, so the mid-points are pushed clear of the surface
  // instead of pushed down. Thickness unchanged at 3 mm.
  scene.updateMatrixWorld(true);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  wristUnit.boss.getWorldPosition(a);
  beltPack.boss.getWorldPosition(b);

  let curve;
  if (wearer) {
    // A cable is longer than the gap it spans, so the run has to bow rather than
    // take the short way down. `bow` pushes the control point out from the body
    // axis, `sag` drops it; `guard` is then the floor on how close the result may
    // come to the torso, checked against the figure's own surface rather than a
    // second copy of it, so the cable can never end up inside the wearer.
    const drape = (u, bow, sag, guard) => {
      const p = a.clone().lerp(b, u);
      p.y -= sag;
      const radial = new THREE.Vector3(p.x, 0, p.z);
      if (radial.lengthSq() < 1e-6) radial.set(0, 0, 1);
      radial.normalize();
      p.addScaledVector(radial, bow);
      const surf = figure.surface.torsoPoint(Math.atan2(radial.z, radial.x), p.y);
      const minR = Math.hypot(surf.x, surf.z) + guard;
      const haveR = Math.hypot(p.x, p.z);
      if (haveR < minR) p.addScaledVector(radial, minR - haveR);
      return p;
    };
    // A cable leaving a wrist unit runs back down the forearm toward the elbow.
    // Without this first waypoint the run heads straight for the belt from the
    // connector, which on a raised arm means straight through the hand.
    const lead = a.clone()
      .addScaledVector(figure.wrist.axis, -54)
      .add(new THREE.Vector3(0, -26, 0));

    curve = new THREE.CatmullRomCurve3([
      a,
      lead,
      drape(0.34, 22, 58, 34),
      drape(0.62, 30, 78, 30),
      drape(0.86, 14, 38, 22),
      b,
    ]);
  } else {
    const belly = Math.min(a.y, b.y) - 34;         // ~23, deep sag, clears the floor
    const m1 = a.clone().lerp(b, 0.30); m1.y = belly; m1.z += 8;
    const m2 = a.clone().lerp(b, 0.70); m2.y = belly; m2.z += 10;
    curve = new THREE.CatmullRomCurve3([a, m1, m2, b]);
  }
  const cable = sh(new THREE.Mesh(new THREE.TubeGeometry(curve, 96, 3.0, 14), mat(GRAPHITE, 0.62)));
  scene.add(cable);

  // Ground shadow, standalone only. A cropped body has no contact with a floor,
  // so a shadow under it would put the figure on a surface that is not there.
  // Shadows still land on the figure itself: case onto forearm, pack onto hip.
  if (!wearer) {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(500, 500), new THREE.ShadowMaterial({ opacity: 0.13 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
  }

  // ══ CAMERA + CONTROLS ═════════════════════════════════════════════════════
  // The mount is always rendered at a 0.56 height-to-width ratio (see resize),
  // so the aspect is known before the canvas has been measured.
  const ASPECT = 1 / 0.56;
  const camera = new THREE.PerspectiveCamera(36, ASPECT, 1, 1000 * S);
  const controls = new OrbitControls(camera, canvas);
  if (wearer) {
    // Frame the product, not the body. Fitting the whole figure would drop the
    // 48 mm case to about 5% of frame height and lose every detail on it; this
    // fits the two units and the cable with a margin, and lets the torso run off
    // the top and bottom of the frame, which is the crop the design assumes.
    const box = new THREE.Box3();
    box.expandByObject(wristUnit.group);
    box.expandByObject(beltPack.group);
    box.expandByObject(cable);
    box.expandByScalar(58);
    const centre = box.getCenter(new THREE.Vector3());
    const span = box.getSize(new THREE.Vector3());
    const fovV = (camera.fov * Math.PI) / 180;
    const fovH = 2 * Math.atan(Math.tan(fovV / 2) * ASPECT);
    const dist = Math.max(
      (span.y / 2) / Math.tan(fovV / 2),
      (Math.max(span.x, span.z) / 2) / Math.tan(fovH / 2));
    // Round to the wearer's right and above, the direction the wrist display
    // is aimed at (see FACE_REF in wearer-figure.js).
    const az = -0.49, el = 0.24;
    controls.target.copy(centre);
    camera.position.set(
      centre.x + dist * Math.cos(el) * Math.sin(az),
      centre.y + dist * Math.sin(el),
      centre.z + dist * Math.cos(el) * Math.cos(az));
    controls.minDistance = dist * 0.45;
    controls.maxDistance = dist * 2.4;
  } else {
    camera.position.set(12, 95, 235);
    controls.target.set(0, 34, 0);
    controls.minDistance = 110;
    controls.maxDistance = 420;
  }
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.enablePan = false;
  controls.minPolarAngle = 0.15;
  controls.maxPolarAngle = Math.PI / 2 - 0.05;
  controls.autoRotate = !reduceMotion;
  controls.autoRotateSpeed = 0.5;
  controls.addEventListener('start', () => { controls.autoRotate = false; });

  // ══ NUMBERED MARKERS ══════════════════════════════════════════════════════
  // Offsets are measured in the camera's own frame, not the world's. The wearer
  // view looks in from an angle, so a world-space nudge that reads as "left of
  // the case" from one side lands on the cable from another; sliding along the
  // camera's right and up axes puts each marker where it is meant to be
  // regardless of where the camera ended up.
  const markerScale = wearer ? 22 : 9;
  const camRight = new THREE.Vector3(), camUp = new THREE.Vector3(), camFwd = new THREE.Vector3();
  camera.updateMatrixWorld(true);
  camera.matrixWorld.extractBasis(camRight, camUp, camFwd);
  const beside = (anchor, dx, dy, dz = 0) => {
    const p = anchor.isObject3D ? anchor.getWorldPosition(new THREE.Vector3()) : anchor.clone();
    return p.addScaledVector(camRight, dx).addScaledVector(camUp, dy).addScaledVector(camFwd, dz);
  };
  const markers = [];
  const put = (n, pos) => { const s = marker(n, pos, markerScale); markers.push(s); scene.add(s); };
  if (wearer) {
    // Marker 3 labels the cable, so it is anchored to the point on the run that
    // sits halfway in height between the two connectors. Picking a fixed curve
    // parameter instead kept landing it on the pack, because most of the curve's
    // parameter range is spent in the bend at the bottom.
    const midY = (a.y + b.y) / 2;
    let tMid = 0.5, bestDy = Infinity;
    for (let i = 0; i <= 200; i++) {
      const dy = Math.abs(curve.getPoint(i / 200).y - midY);
      if (dy < bestDy) { bestDy = dy; tMid = i / 200; }
    }
    put(1, beside(wristUnit.kase, -62, -14, 30));            // case: PCB + firmware
    put(2, beside(wristUnit.glass, -24, 32, 30));            // concept display
    put(3, beside(curve.getPoint(tMid), -48, 0, 30));        // wired link
    put(4, beside(beltPack.shell, -96, 26, 40));             // belt pack
  } else {
    put(1, new THREE.Vector3(-80, 56, 18));                  // case: PCB + firmware
    put(2, new THREE.Vector3(-46, 74, 14));                  // concept display
    put(3, curve.getPoint(0.55).add(new THREE.Vector3(0, 12, 6)));  // wired link
    put(4, new THREE.Vector3(84, 92, -16));                  // belt pack
  }

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
  const resizeObs = new ResizeObserver(() => {
    if (resizePending) return;
    resizePending = true;
    requestAnimationFrame(resize);
  });
  resizeObs.observe(mount);

  let visible = true;
  const seenObs = new IntersectionObserver(
    ([e]) => { visible = e.isIntersecting; }, { threshold: 0.01 });
  seenObs.observe(mount);

  renderer.setAnimationLoop(() => {
    if (!visible) return;
    controls.update();
    renderer.render(scene, camera);
  });

  /**
   * Tears the viewer down completely. The page offers two arrangements of the
   * same parts and rebuilds on each switch, so without this every switch would
   * leave behind a live animation loop, two observers and a WebGL context. A
   * browser only allows a handful of contexts before it starts discarding the
   * oldest, which would blank an earlier viewer on the page.
   */
  const dispose = () => {
    renderer.setAnimationLoop(null);
    resizeObs.disconnect();
    seenObs.disconnect();
    controls.dispose();
    scene.traverse((o) => {
      if (o.isMesh || o.isSprite) {
        o.geometry?.dispose?.();
        for (const m of [].concat(o.material ?? [])) {
          m.map?.dispose?.();
          m.dispose?.();
        }
      }
    });
    pmrem.dispose();
    scene.environment?.dispose?.();
    renderer.dispose();
    renderer.forceContextLoss?.();
    canvas.remove();
    mount.classList.remove('is-3d');
  };

  return {
    scene, camera, controls, renderer, figure, wristUnit, beltPack,
    curve, markers, canvas, dispose,
  };
}

/* ════════════════════════════════════════════════════════════════════════════
   THE WRIST UNIT
   Built at the origin with no placement of its own: the band's circle lies in
   local XY, the arm runs along local +Z, and the case seats on local +Y. The
   caller positions it, either floating or on a forearm.
   ════════════════════════════════════════════════════════════════════════════ */
function buildWristUnit() {
  const group = new THREE.Group();

  // Band: an OPEN arc (about 300 degrees, gap at the bottom), rectangular
  // cross-section, tapering slightly toward the open ends. Not a torus.
  const bandMat = mat(GRAPHITE, 0.9);
  for (const g of bandGeometries({
    innerR: 26, arcDeg: 300, width: 22, widthEnd: 15, thick: 3, thickEnd: 2.2, steps: 72,
  })) {
    group.add(sh(new THREE.Mesh(g, bandMat)));
  }

  // Case: rounded slab sitting tangent on the band's outer surface at the top.
  // 48 along the arm (z), 40 across (x), 11 thick, 5 mm fillets.
  const CASE_Y = 29 + 5.5 - 0.8;          // band outer top + half height, seated 0.8
  const kase = sh(new THREE.Mesh(new RoundedBoxGeometry(40, 11, 48, 5, 5), mat(GRAPHITE, 0.38, 0.12)));
  kase.position.y = CASE_Y;
  group.add(kase);

  // Concept display on the case face: dark glass with a thin uniform bezel and
  // a few abstract guidance bars. No numbers, nothing that reads as a vital.
  // 37 x 44 on a 40 x 48 case leaves roughly a 1.5 mm bezel.
  const glass = new THREE.Mesh(
    new RoundedBoxGeometry(37, 1.2, 44, 2, 1.5),
    new THREE.MeshStandardMaterial({ color: 0x11150f, roughness: 0.18, emissive: 0x0c120b, emissiveIntensity: 0.6 }));
  glass.position.y = CASE_Y + 5.3;
  group.add(glass);
  for (let i = 0; i < 3; i++) {
    const bar = new THREE.Mesh(
      new RoundedBoxGeometry(27 - (i % 2) * 5, 0.5, 2.4, 2, 0.7),
      new THREE.MeshStandardMaterial({ color: MOSS, roughness: 0.5, emissive: 0x3f5c38, emissiveIntensity: 0.55 }));
    bar.position.set(-2 + (i % 2) * 2.5, CASE_Y + 6.1, -14 + i * 6.5);
    group.add(bar);
  }
  const alert = new THREE.Mesh(
    new RoundedBoxGeometry(29, 0.5, 4.4, 2, 1.2),
    new THREE.MeshStandardMaterial({ color: CLAY, roughness: 0.5, emissive: 0x5e2a10, emissiveIntensity: 0.55 }));
  alert.position.set(0, CASE_Y + 6.1, 14);
  group.add(alert);

  // Cable connector boss on the case side facing the pack.
  const boss = sh(new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 4.5, 18), mat(STEEL, 0.3, 0.9)));
  boss.rotation.z = Math.PI / 2;
  boss.position.set(21, CASE_Y - 1.5, 0);
  group.add(boss);

  // Two side buttons on the face away from the cable. These stand for the two
  // switches actually on the board (SW1 reset, SW2 bootsel). A rotary crown was
  // considered and left off: the board has no encoder, so a crown would imply
  // hardware the design does not contain.
  for (const z of [8, -8]) {
    const btn = sh(new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 3.2, 16), mat(STEEL, 0.34, 0.85)));
    btn.rotation.z = Math.PI / 2;
    btn.position.set(-20.6, CASE_Y + 0.4, z);
    group.add(btn);
  }

  // Optical aperture on the underside, facing the skin: the window over the
  // MAX30102, which is on the board. A steel collar around a dark, unlit window
  // (raw red/IR only, so nothing about it glows).
  const apRing = sh(new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 0.7, 24), mat(STEEL, 0.34, 0.85)));
  apRing.position.set(0, CASE_Y - 5.5, 0);
  group.add(apRing);
  const apGlass = sh(new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 0.8, 24),
    new THREE.MeshStandardMaterial({ color: 0x0d0f0c, roughness: 0.2, metalness: 0.1 })));
  apGlass.position.set(0, CASE_Y - 5.8, 0);
  group.add(apGlass);

  // Strap lugs at the two edges of the band's width, where it emerges from
  // under the case, tying the two together the way watch lugs do. Kept narrow
  // so they clasp the band near its crown rather than bridging over its
  // shoulders.
  for (const z of [11.5, -11.5]) {
    const lug = sh(new THREE.Mesh(new RoundedBoxGeometry(16, 4, 5, 3, 1.5), mat(GRAPHITE, 0.6)));
    lug.position.set(0, CASE_Y - 5.7, z);
    group.add(lug);
  }

  return { group, boss, kase, glass };
}

/* ════════════════════════════════════════════════════════════════════════════
   THE BELT PACK
   Built at the origin, curvature centre at local z = -PACK_MID_R, inner face
   toward -Z. The caller seats it, either floating or against a waist.
   ════════════════════════════════════════════════════════════════════════════ */
function buildBeltPack({ strap = true } = {}) {
  const group = new THREE.Group();

  // A RoundedBox bent around the body radius so the inner face is concave
  // against the waist. Softer fillets and a slightly glossier finish so it reads
  // as a moulded enclosure rather than an extruded rectangle.
  //
  // bendAroundY wraps the flat 120 mm panel around the waist so every layer
  // keeps its own width (see the function for the maths). An earlier version
  // bent the whole shell at one fixed radius, which held the outer face right
  // but squeezed the inner face into a wedge: 92 mm against 107 mm, measured.
  // The per-vertex bend renders 117.4 mm across, inner and outer within a
  // millimetre of each other, 2.45x the case's 48 mm long edge. The residual
  // 2.6 mm under the nominal 120 comes from a bent panel's chord being shorter
  // than its arc, which no bend can avoid.
  const shellGeo = new RoundedBoxGeometry(120, 80, 25, 6, 8);
  bendAroundY(shellGeo, PACK_MID_R);
  shellGeo.computeVertexNormals();
  const shell = sh(new THREE.Mesh(shellGeo, mat(GRAPHITE, 0.42, 0.08)));
  group.add(shell);

  // Parting seam running around the whole enclosure at mid-thickness, where
  // the two halves of a moulded case meet. Rounded a little more than before so
  // it reads as a softened chamfer rather than a hard scored line.
  const seamGeo = new RoundedBoxGeometry(121, 2.0, 26, 4, 0.9);
  bendAroundY(seamGeo, PACK_MID_R);
  seamGeo.computeVertexNormals();
  group.add(sh(new THREE.Mesh(seamGeo, mat(CARBON, 0.75))));

  // Vertical seam on the outer face hinting at the two-part interior:
  // compute on one side, battery on the other.
  group.add(onOuterFace(new THREE.BoxGeometry(0.9, 70, 0.8), CARBON, 0.14, 0, 175.6));

  // Venting on the compute side, as a recessed grille. The shell is a closed
  // surface, so a true cut-in recess would sit behind it and never show. The
  // read comes instead from a dark inset panel with lighter fins raised across
  // it: the gaps between the fins are the vent slots, deeper and better defined
  // than the earlier flat grooves. Kept above the parting seam.
  group.add(onOuterFace(new RoundedBoxGeometry(24, 28, 0.8, 5, 1.2), 0x131610, -0.16, 12, 175.3));
  for (let i = 0; i < 4; i++) {
    group.add(onOuterFace(new THREE.BoxGeometry(19, 2.2, 1.1), GRAPHITE, -0.16, 22 - i * 6.5, 176.0));
  }

  // Status LED on the battery side, raised just proud of the face. Part of the
  // concept enclosure, which stands in for a laptop today; the pack has no
  // hardware design, so nothing on it maps to a built component.
  const ledPivot = new THREE.Group();
  ledPivot.position.z = -PACK_MID_R;
  ledPivot.rotation.y = 0.34;
  const led = sh(new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.9, 20),
    new THREE.MeshStandardMaterial({ color: MOSS, roughness: 0.4, emissive: 0x3f5c38, emissiveIntensity: 0.7 })));
  led.rotation.x = Math.PI / 2;
  led.position.set(0, 30, 175.4);
  ledPivot.add(led);
  group.add(ledPivot);

  // Belt strap, standalone only. It sits at radius 147.5, inside the pack's
  // 150 mm inner face, so it genuinely passes behind the enclosure and emerges
  // symmetrically on both sides rather than sticking out as a panel on one edge.
  // It tapers from 22 mm at the centre to 8 mm at the ends so it reads as
  // continuing out of frame. On the body it is dropped: the figure wears a real
  // belt that wraps the whole waist.
  if (strap) {
    const strapMat = mat(STRAP, 0.95);
    for (const g of strapGeometries({ innerR: 147.5, arcRad: 1.22, hCenter: 22, hEnd: 7, thick: 2.5, steps: 110 })) {
      group.add(sh(new THREE.Mesh(g, strapMat)));
    }
  }

  // Cable connector: a recessed port sunk into the outer face with a metal
  // collar around it, so the cable lands somewhere rather than into a flat wall.
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
   GEOMETRY HELPERS
   ════════════════════════════════════════════════════════════════════════════ */

function marker(n, pos, scale) {
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
  sprite.scale.set(scale, scale, 1);
  sprite.position.copy(pos);
  sprite.renderOrder = 10;
  return sprite;
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

/**
 * Sweeps a tapering rectangular cross-section along an arc around the Y axis,
 * for the belt strap. Returns one geometry per face so the edges stay crisp.
 * Angle 0 is the front of the wearer; the strap is centred there and runs
 * symmetrically to both sides. Depths are expressed relative to the pack's
 * curvature centre so the strap shares its frame.
 */
function strapGeometries({ innerR, arcRad, hCenter, hEnd, thick, steps }) {
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
 * so its arc length from centre (r * theta) equals its original x. That
 * preserves the panel's width on every layer, inner and outer alike. Computing
 * theta at one fixed radius instead (an earlier shortcut) held the outer face
 * right but shrank the inner face, turning the cross-section into a wedge.
 */
function bendAroundY(geo, midR) {
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

/**
 * Places a small detail flush on a face of the bent shell at angle `theta`
 * (radians around the body) and height `y`, at radius `r` from the curvature
 * centre. The rotation happens about the curvature centre, which is what keeps
 * the detail on the curved surface.
 */
function onOuterFace(geometry, color, theta, y, r) {
  const pivot = new THREE.Group();
  pivot.position.z = -PACK_MID_R;
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
