/**
 * PRODUCT CONCEPT VIEWER: how the system would be worn and carried.
 *
 * This is NOT CAD and not a design file. The device shapes are placeholders
 * built in code (see device-models.js) and the figure is an open-source CC0
 * base mesh rendered as a studio mannequin (see wearer-figure.js). The page
 * says the same next to it. The cable is deliberate: the bridge is a wired,
 * local stand-in for the eventual wrist-to-device wireless link.
 *
 * Two arrangements, same parts:
 *   default        the devices alone on a studio sweep, for reading them
 *   wearer: true   the same devices worn by the mannequin
 *
 * The device set is configurable so the render harness can still show the
 * belt-pack layout this project designed and then killed (2026-08-05,
 * docs/POSITIONING.md). The site ships ACTIVE_SET.
 *
 * Mounting is async: the figure loads from a GLB. mountProductViewer returns
 * immediately with a `ready` promise; dispose() any time is safe.
 *
 * Fallback: if WebGL is unavailable, or the figure fails to load, the mount
 * keeps its 2D SVG diagram and this module says so in the status line.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  buildWristUnit, buildPhone, buildBeltPack,
  GRAPHITE, PACK_MID_R, PACK_INNER_R,
} from './device-models.js';
import { loadWearer } from './wearer-figure.js';

export const ACTIVE_SET = 'wrist+phone';

export const DEVICE_SETS = {
  'wrist+phone':      { wrist: true, phone: true, pack: false, cableTo: 'phone' },
  'wrist+pack':       { wrist: true, phone: false, pack: true,  cableTo: 'pack'  },
  'wrist+phone+pack': { wrist: true, phone: true,  pack: true,  cableTo: 'pack'  },
};

const mat = (color, rough = 0.55, metal = 0.0) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });

export function mountProductViewer({
  mount, status, wearer = false, devices = ACTIVE_SET, preset = null,
} = {}) {
  const say = (msg) => { if (status) status.textContent = msg; };
  const set = DEVICE_SETS[devices] ?? DEVICE_SETS[ACTIVE_SET];

  if (!hasWebGL()) {
    say('WebGL is unavailable, so the concept is shown as a flat diagram.');
    return;
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const canvas = document.createElement('canvas');
  canvas.className = 'board-canvas';
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', wearer
    ? 'Interactive 3D concept: a studio mannequin wearing a wrist sensor unit, with a ' +
      'phone-class device carried on a low belt at the hip, joined by a cable. Numbered ' +
      'markers match the legend below. Drag to rotate, scroll to zoom. The devices are ' +
      'concept shapes and the mannequin is an open-source base mesh, not a scan of anyone.'
    : 'Interactive 3D concept: a wrist sensor unit and a phone-class device on a studio ' +
      'sweep, joined by a cable. Numbered markers match the legend below. Drag to rotate, ' +
      'scroll to zoom. These are concept shapes, not CAD.');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(studioEnvironment(), 0.04).texture;

  // ══ CAMERA + CONTROLS ═════════════════════════════════════════════════════
  const ASPECT = 1 / 0.56;
  const camera = new THREE.PerspectiveCamera(34, ASPECT, wearer ? 10 : 1, wearer ? 12000 : 3000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.enablePan = false;
  controls.minPolarAngle = 0.12;
  controls.maxPolarAngle = Math.PI / 2 + 0.04;
  controls.autoRotateSpeed = 0.5;
  controls.addEventListener('start', () => { controls.autoRotate = false; });

  const state = { disposed: false, visible: true, presets: {}, current: null };

  // ══ LIGHTS (shadow camera sized after the scene is built) ═════════════════
  const key = new THREE.DirectionalLight(0xfff2e2, 1.55);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0006;
  key.shadow.radius = 5;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xdfe8ea, 0.5);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xf2ece0, 0.3);
  scene.add(fill);

  const sizeLights = (box) => {
    const span = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3());
    const R = Math.max(span.x, span.y, span.z);
    key.position.set(c.x + R * 0.7, c.y + R * 1.1, c.z + R * 0.8);
    key.target.position.copy(c);
    scene.add(key.target);
    Object.assign(key.shadow.camera, {
      left: -R, right: R, top: R, bottom: -R, near: R * 0.05, far: R * 4,
    });
    key.shadow.camera.updateProjectionMatrix();
    rim.position.set(c.x - R, c.y + R * 0.5, c.z - R * 0.8);
    fill.position.set(c.x + R * 0.3, c.y + R * 0.2, c.z + R * 1.3);
  };

  // ══ SCENE CONTENT ═════════════════════════════════════════════════════════
  // On the body the wrist unit is built only after the figure loads, so its
  // band bore can be sized to the measured wrist the way a real strap is.
  let wristUnit = null;
  const phone = set.phone ? buildPhone() : null;
  const beltPack = set.pack ? buildBeltPack({ strap: !wearer }) : null;
  let figure = null;
  let curve = null;
  let cable = null;
  const markers = [];

  const finishScene = () => {
    // The cable joins the wrist boss to whichever hub the set names.
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    scene.updateMatrixWorld(true);
    wristUnit.boss.getWorldPosition(a);
    const hub = set.cableTo === 'pack' ? beltPack : phone;
    hub.boss.getWorldPosition(b);

    if (wearer) {
      // Push each control point outside the wearer's measured surface, so the
      // run can bow around the body but never through it.
      const drape = (u, bow, lift, guard) => {
        const p = a.clone().lerp(b, u);
        p.y += lift;
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
      // Leave the wrist outward (away from the limb) and proximally (up the
      // hanging arm) before turning for the chest, so the run rises beside
      // the arm rather than through it. Each waypoint is then pushed clear of
      // the limb's measured surface, mirroring the torso guard.
      const outw = new THREE.Vector3(a.x, 0, a.z).normalize();
      const armClear = (p, guard) => {
        const gap = figure.surface.limbGap(p) - 3;   // 3 = cable radius
        if (gap < guard) p.addScaledVector(outw, guard - gap);
        return p;
      };
      const lead = armClear(a.clone()
        .addScaledVector(figure.wrist.axis, -60)
        .addScaledVector(outw, 24), 10);
      curve = new THREE.CatmullRomCurve3([
        a, lead,
        armClear(drape(0.4, 34, 40, 30), 12),
        armClear(drape(0.72, 26, 15, 24), 12),
        b,
      ]);
    } else {
      const belly = Math.min(a.y, b.y) - 26;
      const m1 = a.clone().lerp(b, 0.30); m1.y = Math.max(8, belly); m1.z += 10;
      const m2 = a.clone().lerp(b, 0.70); m2.y = Math.max(8, belly); m2.z += 12;
      curve = new THREE.CatmullRomCurve3([a, m1, m2, b]);
    }
    cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 96, 3.0, 14), mat(GRAPHITE, 0.62));
    cable.castShadow = cable.receiveShadow = true;
    scene.add(cable);

    // Studio sweep under everything. On the body it sits at the floor; in the
    // devices view it is the whole stage.
    const stage = cyclorama(wearer ? 9000 : 900, wearer ? 3400 : 720, wearer ? 2800 : 420);
    scene.add(stage);

    // ── camera presets ──
    const boxOf = (...objs) => {
      const box = new THREE.Box3();
      for (const o of objs) if (o) box.expandByObject(o.group ?? o);
      return box;
    };
    const productBox = boxOf(wristUnit, phone, beltPack, cable);
    const p = state.presets;
    if (wearer) {
      p.figure = { box: boxOf(figure, wristUnit, phone, beltPack).expandByScalar(60), az: -0.38, el: 0.1, rotate: true };
      p.wrist = { box: boxOf(wristUnit).expandByScalar(46), az: -0.55, el: 0.14 };
      if (phone) {
        // Look straight down the hip mount's own normal, so the screen is
        // face-on wherever the carry position ends up on the body.
        const n = figure.mounts.hip.normal;
        p.phone = { box: boxOf(phone).expandByScalar(60), az: Math.atan2(n.x, n.z), el: 0.06 };
      }
      if (beltPack) p.pack = { box: boxOf(beltPack).expandByScalar(60), az: -0.8, el: 0.08 };
    } else {
      p.all = { box: productBox.clone().expandByScalar(50), az: 0.1, el: 0.16, rotate: true };
      p.wrist = { box: boxOf(wristUnit).expandByScalar(40), az: -0.4, el: 0.2 };
      if (phone) p.phone = { box: boxOf(phone).expandByScalar(46), az: 0.12, el: 0.1 };
      if (beltPack) p.pack = { box: boxOf(beltPack).expandByScalar(50), az: -0.5, el: 0.15 };
    }

    sizeLights(wearer ? p.figure.box : p.all.box);
    setPreset(preset ?? (wearer ? 'figure' : 'all'), true);
    say('');
  };

  const setPreset = (name, initial = false) => {
    const pr = state.presets[name];
    if (!pr) return;
    state.current = name;
    const centre = pr.box.getCenter(new THREE.Vector3());
    const span = pr.box.getSize(new THREE.Vector3());
    const fovV = (camera.fov * Math.PI) / 180;
    const fovH = 2 * Math.atan(Math.tan(fovV / 2) * (camera.aspect || ASPECT));
    const dist = Math.max(
      (span.y / 2) / Math.tan(fovV / 2),
      (Math.max(span.x, span.z) / 2) / Math.tan(fovH / 2));
    controls.target.copy(centre);
    camera.position.set(
      centre.x + dist * Math.cos(pr.el) * Math.sin(pr.az),
      centre.y + dist * Math.sin(pr.el),
      centre.z + dist * Math.cos(pr.el) * Math.cos(pr.az));
    controls.minDistance = dist * 0.4;
    controls.maxDistance = dist * 2.6;
    controls.autoRotate = !!pr.rotate && !reduceMotion && initial;
    controls.update();
    placeMarkers();
    // One explicit frame, so the scene is painted even while the mount is
    // scrolled out of view (the loop below only runs while it is visible).
    renderer.render(scene, camera);
  };

  // ── numbered markers, placed in the current camera's own frame ──
  const placeMarkers = () => {
    for (const m of markers) scene.remove(m);
    markers.length = 0;
    camera.updateMatrixWorld(true);
    const camRight = new THREE.Vector3(), camUp = new THREE.Vector3(), camFwd = new THREE.Vector3();
    camera.matrixWorld.extractBasis(camRight, camUp, camFwd);
    const beside = (anchor, dx, dy, dz = 0) => {
      const p = anchor.isObject3D
        ? anchor.getWorldPosition(new THREE.Vector3()) : anchor.clone();
      return p.addScaledVector(camRight, dx).addScaledVector(camUp, dy).addScaledVector(camFwd, dz);
    };
    const scaleM = wearer ? 46 : 16;
    const put = (n, pos) => { const s = marker(n, pos, scaleM); markers.push(s); scene.add(s); };
    // Anchor 2 to the cable point nearest halfway in height between the hubs.
    const a = curve.getPoint(0), b = curve.getPoint(1);
    const midY = (a.y + b.y) / 2;
    let tMid = 0.5, bestDy = Infinity;
    for (let i = 0; i <= 200; i++) {
      const dy = Math.abs(curve.getPoint(i / 200).y - midY);
      if (dy < bestDy) { bestDy = dy; tMid = i / 200; }
    }
    put(1, beside(wristUnit.kase, wearer ? -120 : -30, wearer ? 24 : 26, wearer ? 40 : 16));
    put(2, beside(curve.getPoint(tMid), wearer ? -90 : -22, wearer ? 10 : 4, wearer ? 40 : 16));
    const hub = set.cableTo === 'pack' ? beltPack.shell : phone.body;
    put(3, beside(hub, wearer ? 130 : 56, wearer ? 60 : 26, wearer ? 46 : 20));
  };

  // ══ PLACEMENT ═════════════════════════════════════════════════════════════
  const api = {
    scene, camera, controls, renderer, canvas, markers,
    phone, beltPack,
    setPreset,
    get wristUnit() { return wristUnit; },
    get figure() { return figure; },
    get curve() { return curve; },
    get presets() { return Object.keys(state.presets); },
    ready: null,
    dispose,
  };

  if (wearer) {
    say('Loading the figure…');
    api.ready = loadWearer({
      belt: set.pack,
      onProgress: (f) => say(`Loading the figure… ${Math.round(f * 100)}%`),
    }).then((fig) => {
      if (state.disposed) return api;
      figure = fig;
      scene.add(figure.group);

      wristUnit = buildWristUnit({
        bore: Math.max(26, fig.diagnostics.wristRMax + 1.5),
      });
      scene.add(wristUnit.group);
      wristUnit.group.position.copy(figure.wrist.position);
      wristUnit.group.quaternion.copy(figure.wrist.quaternion);

      if (phone) {
        scene.add(phone.group);
        const hip = figure.mounts.hip;
        phone.group.quaternion.copy(hip.quaternion);
        // half the slab's depth proud of the plate, along the hip normal
        phone.group.position.copy(hip.position).addScaledVector(hip.normal, 4.4);
      }
      if (beltPack) {
        scene.add(beltPack.group);
        const { position: seatP, normal: seatN } = figure.belt;
        const standoff = 3;
        beltPack.group.rotation.y = Math.atan2(seatN.x, seatN.z);
        beltPack.group.position.copy(seatP)
          .addScaledVector(seatN, (PACK_MID_R - PACK_INNER_R) + standoff);
      }
      finishScene();
      return api;
    }).catch((err) => {
      console.error('wearer figure failed to load:', err);
      if (!state.disposed) {
        // Honest fallback: back out to the flat diagram rather than an empty
        // stage, the same way the board viewer falls back to its still.
        say('The figure failed to load, so the concept is shown as a flat diagram.');
        teardownToFallback();
      }
      return api;
    });
  } else {
    // Studio tableau: the phone leaning slightly back, the wrist unit in
    // front-left, the (optional) pack behind right.
    wristUnit = buildWristUnit();
    scene.add(wristUnit.group);
    wristUnit.group.rotation.y = 0.55;
    wristUnit.group.rotation.x = 0.10;
    wristUnit.group.position.set(-110, 30, 40);
    if (phone) {
      scene.add(phone.group);
      phone.group.rotation.x = -0.18;
      phone.group.position.set(60, 74, -20);
    }
    if (beltPack) {
      scene.add(beltPack.group);
      beltPack.group.position.set(phone ? 190 : 60, 42, -110);
      beltPack.group.rotation.y = -0.5;
    }
    finishScene();
    api.ready = Promise.resolve(api);
  }

  mount.insertBefore(canvas, mount.firstChild);
  mount.classList.add('is-3d');

  // ══ RENDER LOOP + OBSERVERS ═══════════════════════════════════════════════
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

  const seenObs = new IntersectionObserver(
    ([e]) => { state.visible = e.isIntersecting; }, { threshold: 0.01 });
  seenObs.observe(mount);

  renderer.setAnimationLoop(() => {
    if (!state.visible) return;
    controls.update();
    renderer.render(scene, camera);
  });

  function teardownToFallback() {
    renderer.setAnimationLoop(null);
    resizeObs.disconnect();
    seenObs.disconnect();
    controls.dispose();
    pmrem.dispose();
    renderer.dispose();
    renderer.forceContextLoss?.();
    canvas.remove();
    mount.classList.remove('is-3d');
  }

  /** Full teardown; safe to call while the figure is still loading. */
  function dispose() {
    state.disposed = true;
    renderer.setAnimationLoop(null);
    resizeObs.disconnect();
    seenObs.disconnect();
    controls.dispose();
    scene.traverse((o) => {
      if (o.isMesh || o.isSprite) {
        o.geometry?.dispose?.();
        for (const m of [].concat(o.material ?? [])) {
          m.map?.dispose?.();
          m.emissiveMap?.dispose?.();
          m.roughnessMap?.dispose?.();
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
  }

  return api;
}

/* ════════════════════════════════════════════════════════════════════════════
   STAGE AND ENVIRONMENT
   ════════════════════════════════════════════════════════════════════════════ */

/** A photographer's sweep: floor curving up into a back wall, one surface
 *  with no visible join, so the parts sit in a place rather than a void. */
function cyclorama(width, depth, height, fillet = 160) {
  const pts = [];
  const N = 18;
  // floor from the front edge to where the fillet starts
  pts.push([depth / 2, 0], [-(depth / 2) + fillet, 0]);
  for (let i = 1; i <= N; i++) {
    const a = (i / N) * (Math.PI / 2);
    pts.push([-(depth / 2) + fillet - Math.sin(a) * fillet + (1 - Math.cos(a)) * 0,
      fillet - Math.cos(a) * fillet]);
  }
  pts.push([-(depth / 2), height]);

  const pos = [], idx = [];
  const cols = pts.length;
  for (const [z, y] of pts) {
    pos.push(-width / 2, y, z, width / 2, y, z);
  }
  for (let i = 0; i < cols - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
    color: 0xdedbd2, roughness: 0.94, metalness: 0, side: THREE.DoubleSide,
  }));
  m.receiveShadow = true;
  return m;
}

/** A code-built studio for the environment map: a big soft key panel, a cool
 *  rim strip, and a warm floor bounce. Reflections on glass and metal come
 *  from these, with no HDR file to ship. */
function studioEnvironment() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x484a46);
  const panel = (w, h, color, intensity, pos, lookAt = [0, 0, 0]) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(...lookAt);
    scene.add(m);
  };
  panel(6, 4, 0xfff4e4, 5.5, [3, 5, 4]);        // key softbox, warm, high right
  panel(7, 1.4, 0xdfeaf2, 3.2, [-4, 3, -4]);    // cool rim strip, back left
  panel(8, 8, 0xf0e9dc, 0.55, [0, -4, 0]);      // floor bounce
  panel(2.4, 3.4, 0xffffff, 2.6, [-4, 2.2, 3]); // a tall softbox for screen/glass reflections
  return scene;
}

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

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}
