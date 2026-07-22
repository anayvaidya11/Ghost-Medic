/**
 * BOARD VIEWER: the Ghost Medic wrist-unit PCB, in 3D, in the browser.
 *
 * The model is ghostmedic-sensor-hub.glb, exported straight from the committed
 * KiCad source with kicad-cli (exact command in hardware/README.md). Nothing here
 * is modelled by hand: what you orbit is the design file.
 *
 * Two things this file takes seriously:
 *
 *  1. IT MUST NEVER SHOW A BROKEN BOX. WebGL can be unavailable, the 6 MB model
 *     can fail to arrive, and file:// blocks module loading outright. Every one
 *     of those paths falls back to the static KiCad render that ships alongside
 *     it, with a line saying why. Call `mountBoardViewer` and it either upgrades
 *     the static image to an orbitable model or quietly leaves the image alone.
 *
 *  2. Draw calls. KiCad exports the board as 7282 separate primitives, which is
 *     a lot of draw calls for one static object. They are merged by material at
 *     load time, which collapses it to roughly the material count. If merging
 *     fails for any reason the unmerged scene renders anyway: slower, correct.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * @param {object} opts
 * @param {HTMLElement} opts.mount      container; must already hold the fallback image
 * @param {string}      opts.model      URL of the .glb
 * @param {HTMLElement} [opts.status]   element to write load state into
 * @param {HTMLElement} [opts.controls] element holding the reset button etc.
 */
export function mountBoardViewer({ mount, model, status, controls }) {
  const say = (msg) => { if (status) status.textContent = msg; };

  // ── graceful exit #1: no WebGL ───────────────────────────────────────────
  if (!hasWebGL()) {
    say('Your browser can’t run WebGL, so the board is shown as a still render below.');
    return;
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const canvas = document.createElement('canvas');
  canvas.className = 'board-canvas';
  canvas.setAttribute('aria-label',
    'Interactive 3D view of the Ghost Medic sensor-hub circuit board. ' +
    'Drag to rotate, scroll to zoom. A still render of the same board follows.');
  canvas.tabIndex = 0;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();

  // A procedural studio environment: no external HDR file to fetch. Without it
  // the gold pads and the black chip packages render as flat, dead surfaces,
  // because metals have nothing to reflect.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const key = new THREE.DirectionalLight(0xfff4e6, 2.1);
  key.position.set(0.35, 0.9, 0.55);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0005;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0xdfe6e0, 0.7);
  rim.position.set(-0.6, 0.4, -0.5);
  scene.add(rim);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.001, 100);

  const controlsObj = new OrbitControls(camera, canvas);
  controlsObj.enableDamping = true;
  controlsObj.dampingFactor = 0.075;
  controlsObj.enablePan = false;
  controlsObj.minPolarAngle = 0.12;
  controlsObj.maxPolarAngle = Math.PI - 0.12;
  controlsObj.autoRotate = !reduceMotion;
  controlsObj.autoRotateSpeed = 0.55;

  // Stop the idle spin the moment someone takes over: it is an invitation, not
  // an animation to sit through.
  let userEngaged = false;
  const stopSpin = () => { userEngaged = true; controlsObj.autoRotate = false; };
  controlsObj.addEventListener('start', stopSpin);

  say('Loading the board model…');

  new GLTFLoader().load(
    model,
    (gltf) => {
      const board = merged(gltf.scene);
      board.traverse((o) => {
        if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
      });

      // Frame whatever arrived, rather than hard-coding a camera for one export.
      const box = new THREE.Box3().setFromObject(board);
      const size = box.getSize(new THREE.Vector3());
      const centre = box.getCenter(new THREE.Vector3());
      board.position.sub(centre);

      const radius = Math.max(size.x, size.y, size.z);
      const dist = radius / (2 * Math.tan((camera.fov * Math.PI) / 360));

      camera.near = radius / 100;
      camera.far = radius * 100;
      camera.position.set(dist * 0.42, dist * 0.72, dist * 0.86);
      camera.updateProjectionMatrix();

      controlsObj.minDistance = radius * 0.55;
      controlsObj.maxDistance = radius * 4;
      controlsObj.target.set(0, 0, 0);
      controlsObj.saveState();

      key.position.set(radius, radius * 1.8, radius * 0.9);
      const shadowSpan = radius * 1.6;
      Object.assign(key.shadow.camera, {
        left: -shadowSpan, right: shadowSpan,
        top: shadowSpan, bottom: -shadowSpan,
        near: radius * 0.05, far: radius * 6,
      });
      key.shadow.camera.updateProjectionMatrix();

      // A contact shadow on an invisible plane: it grounds the board so it reads
      // as an object sitting on a surface rather than floating in a void.
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(radius * 6, radius * 6),
        new THREE.ShadowMaterial({ opacity: 0.16 })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -size.y / 2 - radius * 0.02;
      floor.receiveShadow = true;
      scene.add(floor);

      scene.add(board);

      mount.classList.add('is-3d');
      say('');
      if (controls) controls.hidden = false;

      const reset = controls?.querySelector('[data-board-reset]');
      reset?.addEventListener('click', () => {
        controlsObj.reset();
        controlsObj.autoRotate = !reduceMotion && !userEngaged;
      });
    },
    (evt) => {
      if (evt.lengthComputable) {
        say(`Loading the board model… ${Math.round((evt.loaded / evt.total) * 100)}%`);
      }
    },
    // ── graceful exit #2: the model did not arrive ─────────────────────────
    () => {
      say('The 3D model didn’t load, so the board is shown as a still render below. ' +
          'Both come from the same KiCad file.');
      canvas.remove();
      mount.classList.remove('is-3d');
      if (controls) controls.hidden = true;
    }
  );

  mount.insertBefore(canvas, mount.firstChild);

  // Resizing the renderer inside the observer callback re-triggers layout and
  // trips "ResizeObserver loop completed with undelivered notifications", so the
  // work is deferred to the next frame.
  let resizePending = false;
  const resize = () => {
    resizePending = false;
    const w = mount.clientWidth;
    if (!w) return;
    const h = Math.max(320, Math.round(w * 0.62));
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

  // Only render while the viewer is actually on screen: an off-screen canvas
  // spinning at 60 fps is a laptop fan for no reason.
  let visible = true;
  new IntersectionObserver(
    ([e]) => { visible = e.isIntersecting; },
    { threshold: 0.01 }
  ).observe(mount);

  renderer.setAnimationLoop(() => {
    if (!visible) return;
    controlsObj.update();
    renderer.render(scene, camera);
  });
}

/**
 * Collapse the export's thousands of primitives into one mesh per material.
 * Returns the original scene untouched if anything about the geometry resists
 * merging: a slow correct board beats no board.
 */
function merged(source) {
  try {
    const byMaterial = new Map();
    source.updateMatrixWorld(true);

    source.traverse((o) => {
      if (!o.isMesh) return;
      const geo = o.geometry.clone();
      geo.applyMatrix4(o.matrixWorld);
      // Merging requires identical attribute sets; position + normal is all the
      // KiCad export carries, and anything else would break the merge.
      for (const name of Object.keys(geo.attributes)) {
        if (name !== 'position' && name !== 'normal') geo.deleteAttribute(name);
      }
      if (!geo.attributes.normal) geo.computeVertexNormals();

      const mat = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!byMaterial.has(mat)) byMaterial.set(mat, []);
      byMaterial.get(mat).push(geo);
    });

    if (byMaterial.size === 0) return source;

    const group = new THREE.Group();
    for (const [mat, geos] of byMaterial) {
      const combined = BufferGeometryUtils.mergeGeometries(geos, false);
      if (!combined) return source;
      geos.forEach((g) => g.dispose());
      group.add(new THREE.Mesh(combined, mat));
    }
    return group;
  } catch {
    return source;
  }
}

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}
