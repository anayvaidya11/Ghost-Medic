/**
 * WEARER FIGURE: the mannequin the product concept is shown on.
 *
 * The mesh is MakeHuman's `hm08` base mesh, CC0 1.0, body group only,
 * processed by the documented pipeline in `tools/figure/` into
 * `assets/wearer-body.glb`. It is a generic open-source base mesh rendered
 * as a matte studio mannequin: NOT a scan of anyone, nobody's real
 * proportions. The page says the same wherever the figure appears.
 *
 * Everything the caller gets back is measured off the loaded mesh, not
 * eyeballed:
 *   wrist   position + orientation for the wrist unit, found by scanning the
 *           arm for its minimum-girth slice between hand and forearm
 *   chest   a mounting frame for the end-user device, found by probing the
 *           chest surface
 *   belt    a seat for the (killed, still renderable) belt pack, found by
 *           matching local curvature to the pack's 150 mm inner face
 *   surface torsoPoint / torsoRadiusAt / limbGap, backed by a radial profile
 *           binned from the mesh's own vertices, so cable routing can be
 *           checked against the real surface
 *
 * Units: millimetres. The wearer stands feet-at-y=0, facing +Z, body axis on
 * x = z = 0. The GLB's own units and orientation are never trusted: scale is
 * normalised to a stated stature and facing is verified by probing where the
 * toes point.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

const CLAY = 0xd8d4cc;          // warm off-white; a display form, not flesh
const STRAP_COLOR = 0x3d4038;

const STATURE_MM = 1750;        // normalised standing height
const CHEST_FRAC = 0.68;        // chest-plate height: mid-chest, below the armpits,
                                // so the strap passes under the hanging arms
const BELT_FRAC  = 0.60;        // belt line, as a fraction of stature
const WRIST_ROLL = 0.0;         // documented tunable: roll of the case about the forearm axis

/* ── profile grid resolution ── */
const PROF_ANGLES = 96;
const PROF_ROWS = 48;
const PROF_Y0_FRAC = 0.28;
const PROF_Y1_FRAC = 0.92;

export async function loadWearer({
  // Resolved against this module, not the page, so the preview harness under
  // tools/render/ loads the same file the site does.
  url = new URL('./wearer-body.glb', import.meta.url).href,
  statureMm = STATURE_MM,
  belt = false,
  chestRig = true,
  onProgress,
} = {}) {
  const t0 = performance.now();
  const gltf = await new Promise((resolve, reject) => {
    new GLTFLoader().load(url, resolve,
      (ev) => { if (onProgress && ev.total) onProgress(ev.loaded / ev.total); },
      reject);
  });

  // ── Bake every primitive into one plain Float32 geometry in world space.
  // KHR_mesh_quantization stores positions as normalised ints and moves the
  // dequantisation into node scale; reading through the attribute getters and
  // applying the world matrix resolves both, so everything downstream works
  // in ordinary millimetre floats.
  gltf.scene.updateMatrixWorld(true);
  const parts = [];
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const src = o.geometry;
    const pos = src.attributes.position;
    const out = new Float32Array(pos.count * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      out[i * 3] = v.x; out[i * 3 + 1] = v.y; out[i * 3 + 2] = v.z;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(out, 3));
    if (src.index) g.setIndex(src.index.clone());
    parts.push(g);
  });
  if (!parts.length) throw new Error('wearer-body.glb contains no mesh');
  let geo = parts.length === 1 ? parts[0] : BufferGeometryUtils.mergeGeometries(parts);

  // Weld seam-duplicated vertices (the UV set was dropped in the pipeline, so
  // position-identical vertices are true duplicates), then smooth-shade.
  geo = BufferGeometryUtils.mergeVertices(geo, 1e-4);

  // ── Normalise: stature, feet on the floor, centred, facing +Z. ──────────
  geo.computeBoundingBox();
  let bb = geo.boundingBox;
  const rawHeight = bb.max.y - bb.min.y;
  const scale = statureMm / rawHeight;
  const cx = (bb.min.x + bb.max.x) / 2;
  const cz = (bb.min.z + bb.max.z) / 2;
  {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      p.setXYZ(i,
        (p.getX(i) - cx) * scale,
        (p.getY(i) - bb.min.y) * scale,
        (p.getZ(i) - cz) * scale);
    }
    p.needsUpdate = true;
  }
  geo.computeBoundingBox();
  bb = geo.boundingBox;

  // Facing probe: feet are long forward of the ankle and short behind it, so
  // at ankle height the z-distribution has a long toe-ward tail. Measured
  // about the band's own centroid: a global-z comparison is thrown off by
  // where the whole-body bounding box happened to centre.
  let flipped = false;
  {
    const p = geo.attributes.position;
    let maxZ = -Infinity, minZ = Infinity, sum = 0, n = 0;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y < 30 || y > 130) continue;
      const z = p.getZ(i);
      maxZ = Math.max(maxZ, z); minZ = Math.min(minZ, z);
      sum += z; n++;
    }
    const mean = sum / Math.max(1, n);
    if ((mean - minZ) > (maxZ - mean)) {
      flipped = true;
      for (let i = 0; i < p.count; i++) p.setXYZ(i, -p.getX(i), p.getY(i), -p.getZ(i));
      p.needsUpdate = true;
    }
  }
  geo.computeVertexNormals();
  geo.computeBoundingBox();

  // ── The mannequin, its base disc, and the group. ─────────────────────────
  const group = new THREE.Group();
  const clay = new THREE.MeshStandardMaterial({
    color: CLAY, roughness: 0.62, metalness: 0.0,
  });
  const body = new THREE.Mesh(geo, clay);
  body.castShadow = body.receiveShadow = true;
  group.add(body);

  // ── Arm analysis (the -X arm, the one the unit is worn on). ──────────────
  const P = geo.attributes.position;
  const stat = statureMm;
  let xMin = Infinity;
  for (let i = 0; i < P.count; i++) xMin = Math.min(xMin, P.getX(i));

  // Everything in the outer 45% of the reach toward the fingertip is pure
  // arm; torso half-width never comes close to it.
  const armThresh = 0.55 * xMin;
  const armIdx = [];
  for (let i = 0; i < P.count; i++) if (P.getX(i) < armThresh) armIdx.push(i);
  if (armIdx.length < 100) throw new Error('arm not found; mesh orientation unexpected');

  // Principal axis of the arm subset by power iteration on its covariance.
  const centroid = new THREE.Vector3();
  for (const i of armIdx) centroid.add(new THREE.Vector3(P.getX(i), P.getY(i), P.getZ(i)));
  centroid.divideScalar(armIdx.length);
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const i of armIdx) {
    const d = [P.getX(i) - centroid.x, P.getY(i) - centroid.y, P.getZ(i) - centroid.z];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) C[r][c] += d[r] * d[c];
  }
  let axis = new THREE.Vector3(0, -1, -0.2);   // arms hang down-ish; a fair seed
  for (let it = 0; it < 40; it++) {
    axis.set(
      C[0][0] * axis.x + C[0][1] * axis.y + C[0][2] * axis.z,
      C[1][0] * axis.x + C[1][1] * axis.y + C[1][2] * axis.z,
      C[2][0] * axis.x + C[2][1] * axis.y + C[2][2] * axis.z,
    ).normalize();
  }
  // Point the axis distal: from the shoulder toward the fingertip, which is
  // the lower end of the hanging arm.
  if (axis.y > 0) axis.negate();

  // Pass 2: re-fit the axis on the distal 40% of the arm alone (hand and
  // forearm), where the limb is straight. The whole-arm axis bends at the
  // elbow, and slicing perpendicular to a bent axis cuts obliquely, which
  // inflates every radius it measures. This exact failure put the first
  // render's "wrist" at 45 mm, out at the hand.
  const rel = new THREE.Vector3();
  const sOf = (i, ax, org) => {
    rel.set(P.getX(i), P.getY(i), P.getZ(i)).sub(org);
    return rel.dot(ax);
  };
  let s0 = Infinity, s1 = -Infinity;
  for (const i of armIdx) {
    const s = sOf(i, axis, centroid);
    s0 = Math.min(s0, s); s1 = Math.max(s1, s);
  }
  const distalIdx = armIdx.filter((i) => sOf(i, axis, centroid) > s1 - 0.4 * (s1 - s0));
  const dc = new THREE.Vector3();
  for (const i of distalIdx) dc.add(new THREE.Vector3(P.getX(i), P.getY(i), P.getZ(i)));
  dc.divideScalar(distalIdx.length);
  const C2 = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const i of distalIdx) {
    const d = [P.getX(i) - dc.x, P.getY(i) - dc.y, P.getZ(i) - dc.z];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) C2[r][c] += d[r] * d[c];
  }
  const fore = axis.clone();
  for (let it = 0; it < 40; it++) {
    fore.set(
      C2[0][0] * fore.x + C2[0][1] * fore.y + C2[0][2] * fore.z,
      C2[1][0] * fore.x + C2[1][1] * fore.y + C2[1][2] * fore.z,
      C2[2][0] * fore.x + C2[2][1] * fore.y + C2[2][2] * fore.z,
    ).normalize();
  }
  if (fore.dot(axis) < 0) fore.negate();                    // keep pointing distal

  // Slice the distal arm perpendicular to the forearm axis and measure girth.
  let d0 = Infinity, d1 = -Infinity;
  for (const i of distalIdx) {
    const s = sOf(i, fore, dc);
    d0 = Math.min(d0, s); d1 = Math.max(d1, s);
  }
  const SLICE = 5;
  const nSlices = Math.ceil((d1 - d0) / SLICE);
  const slices = Array.from({ length: nSlices }, () => ({ n: 0, cx: 0, cy: 0, cz: 0, rMax: 0 }));
  const sliceOf = (i) => Math.min(nSlices - 1, Math.floor((sOf(i, fore, dc) - d0) / SLICE));
  for (const i of distalIdx) {
    const sl = slices[sliceOf(i)];
    sl.n++; sl.cx += P.getX(i); sl.cy += P.getY(i); sl.cz += P.getZ(i);
  }
  for (const sl of slices) if (sl.n) { sl.cx /= sl.n; sl.cy /= sl.n; sl.cz /= sl.n; }
  for (const i of distalIdx) {
    const sl = slices[sliceOf(i)];
    rel.set(P.getX(i) - sl.cx, P.getY(i) - sl.cy, P.getZ(i) - sl.cz);
    const along = rel.dot(fore);
    sl.rMax = Math.max(sl.rMax, Math.sqrt(Math.max(0, rel.lengthSq() - along * along)));
  }
  const smooth = slices.map((sl, i) => {
    const pick = [slices[i - 1], sl, slices[i + 1]].filter((x) => x && x.n);
    return pick.reduce((a, x) => a + x.rMax, 0) / (pick.length || 1);
  });

  // The wrist: the narrowest slice in the window 140–280 mm in from the
  // fingertip. The hand itself is about 190 mm long on this mesh, so a
  // shorter window lands in the palm; the first render proved it. d1 is the
  // tip end.
  let wristI = -1;
  for (let i = nSlices - 1; i >= 0; i--) {
    if (!slices[i].n) continue;
    const fromTip = d1 - (d0 + (i + 0.5) * SLICE);
    if (fromTip < 140 || fromTip > 280) continue;
    if (slices[i].rMax > 45) continue;
    if (wristI < 0 || smooth[i] < smooth[wristI]) wristI = i;
  }
  if (wristI < 0) wristI = Math.max(0, nSlices - 40);
  const wristSlice = slices[wristI];
  const wristPos = new THREE.Vector3(wristSlice.cx, wristSlice.cy, wristSlice.cz);
  const wristRMax = wristSlice.rMax;

  const wristAxis = fore.clone();                            // proximal → distal

  // Case faces outward and toward the viewer: a blend of radially-away-from-
  // the-body and straight ahead, orthogonalised against the forearm, plus the
  // documented roll trim. Pure-radial put the case edge-on to the camera and
  // left the band's open gap facing the viewer instead.
  let up = new THREE.Vector3(wristPos.x, 0, wristPos.z).normalize()
    .add(new THREE.Vector3(0, 0, 1.1)).normalize();
  up.addScaledVector(wristAxis, -up.dot(wristAxis)).normalize();
  if (WRIST_ROLL) up.applyAxisAngle(wristAxis, WRIST_ROLL);
  const right = new THREE.Vector3().crossVectors(up, wristAxis).normalize();
  const wristQuat = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(right, up, wristAxis));

  // ── Radial torso profile r(theta, y), binned from the vertices. ─────────
  // Bins beat raycasts here: ~4k rays against 26k triangles with no BVH is
  // seconds of work, binning 13k vertices is milliseconds. Arm vertices are
  // excluded (both arms, by mirror symmetry) so the profile is the torso and
  // legs alone. Empty bins inherit from their neighbours.
  const y0 = PROF_Y0_FRAC * stat, y1 = PROF_Y1_FRAC * stat;
  const prof = Array.from({ length: PROF_ROWS }, () => new Float32Array(PROF_ANGLES));
  {
    const nearAxis = (x, y, z) => {
      // distance to the arm axis line (and its mirror), for exclusion
      for (const sgn of [1, -1]) {
        rel.set(x * sgn, y, z).sub(centroid);
        const along = rel.dot(axis);
        const d = Math.sqrt(Math.max(0, rel.lengthSq() - along * along));
        if (d < 95 && along > s0 - 20 && along < s1 + 20) return true;
      }
      return false;
    };
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
      if (y < y0 || y > y1) continue;
      if (nearAxis(x, y, z)) continue;
      const row = Math.min(PROF_ROWS - 1, Math.floor(((y - y0) / (y1 - y0)) * PROF_ROWS));
      const th = Math.atan2(z, x);
      const col = ((Math.round((th / (2 * Math.PI)) * PROF_ANGLES) % PROF_ANGLES) + PROF_ANGLES) % PROF_ANGLES;
      const r = Math.hypot(x, z);
      if (r > prof[row][col]) prof[row][col] = r;
    }
    // fill gaps by angular then vertical neighbour averaging, two passes
    for (let pass = 0; pass < 2; pass++) {
      for (let rI = 0; rI < PROF_ROWS; rI++) {
        for (let c = 0; c < PROF_ANGLES; c++) {
          if (prof[rI][c] > 0) continue;
          const cand = [
            prof[rI][(c + 1) % PROF_ANGLES], prof[rI][(c + PROF_ANGLES - 1) % PROF_ANGLES],
            rI > 0 ? prof[rI - 1][c] : 0, rI < PROF_ROWS - 1 ? prof[rI + 1][c] : 0,
          ].filter((v) => v > 0);
          if (cand.length) prof[rI][c] = cand.reduce((a, b) => a + b, 0) / cand.length;
        }
      }
    }
  }

  const profileAt = (theta, y) => {
    const rowF = THREE.MathUtils.clamp(((y - y0) / (y1 - y0)) * (PROF_ROWS - 1), 0, PROF_ROWS - 1);
    const r0 = Math.floor(rowF), r1 = Math.min(PROF_ROWS - 1, r0 + 1);
    const u = rowF - r0;
    const colF = ((theta / (2 * Math.PI)) * PROF_ANGLES % PROF_ANGLES + PROF_ANGLES) % PROF_ANGLES;
    const c0 = Math.floor(colF) % PROF_ANGLES, c1 = (c0 + 1) % PROF_ANGLES;
    const v = colF - Math.floor(colF);
    const a = prof[r0][c0] * (1 - v) + prof[r0][c1] * v;
    const b = prof[r1][c0] * (1 - v) + prof[r1][c1] * v;
    return a * (1 - u) + b * u;
  };

  const torsoPoint = (theta, y) => {
    const r = profileAt(theta, y);
    return new THREE.Vector3(r * Math.cos(theta), y, r * Math.sin(theta));
  };

  const torsoRadiusAt = (theta, y, h = 0.02) => {
    const p0 = torsoPoint(theta - h, y), p1 = torsoPoint(theta, y), p2 = torsoPoint(theta + h, y);
    const dx = (p2.x - p0.x) / (2 * h), dz = (p2.z - p0.z) / (2 * h);
    const ddx = (p2.x - 2 * p1.x + p0.x) / (h * h), ddz = (p2.z - 2 * p1.z + p0.z) / (h * h);
    const num = (dx * dx + dz * dz) ** 1.5;
    const den = Math.abs(dx * ddz - dz * ddx);
    return den < 1e-9 ? Infinity : num / den;
  };

  const limbGap = (p) => {
    let best = Infinity;
    for (const sl of slices) {
      if (!sl.n) continue;
      const d = p.distanceTo(new THREE.Vector3(sl.cx, sl.cy, sl.cz)) - sl.rMax;
      best = Math.min(best, d);
    }
    return best;
  };

  // ── Belt seat (for the killed pack, still measurable). ───────────────────
  const beltY = BELT_FRAC * stat;
  let seat = null;
  for (let i = 0; i <= 200; i++) {
    const th = Math.PI / 2 + (i / 200) * (Math.PI / 2);   // front round to the wearer's left
    const r = torsoRadiusAt(th, beltY);
    const err = Math.abs(r - 150);
    if (!seat || err < seat.err) seat = { th, r, err };
  }
  const beltSeat = {
    theta: seat.th,
    thetaDeg: (seat.th * 180) / Math.PI,
    radius: seat.r,
    position: torsoPoint(seat.th, beltY),
    normal: (() => {
      const a = torsoPoint(seat.th - 0.02, beltY), b = torsoPoint(seat.th + 0.02, beltY);
      const tangent = b.sub(a);
      return new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
    })(),
  };

  if (belt) group.add(buildBand({ y: beltY, height: 27, thick: 4.5, standoff: 3, profileAt }));

  // ── Chest mount for the end-user device. ─────────────────────────────────
  const chestY = CHEST_FRAC * stat;
  const chestSurf = torsoPoint(Math.PI / 2, chestY);        // dead front
  const chestStandoff = 9;
  const chest = {
    position: new THREE.Vector3(0, chestY, chestSurf.z + chestStandoff),
    normal: new THREE.Vector3(0, 0, 1),
    quaternion: new THREE.Quaternion(),                     // screen already faces +Z
  };
  if (chestRig) {
    // A plate against the chest and a strap wrapping the torso at that
    // height: a plain strap-mounted carry, so the device never floats.
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(92, 168, 5),
      new THREE.MeshStandardMaterial({ color: STRAP_COLOR, roughness: 0.92 }));
    plate.position.set(0, chestY, chestSurf.z + 3.4);
    plate.castShadow = plate.receiveShadow = true;
    group.add(plate);
    group.add(buildBand({ y: chestY, height: 30, thick: 4, standoff: 2.5, profileAt }));
  }

  return {
    group,
    wrist: { position: wristPos.clone(), quaternion: wristQuat, axis: wristAxis.clone() },
    belt: beltSeat,
    mounts: { chest, beltSeat },
    surface: { torsoPoint, torsoRadiusAt, profileAt, limbGap },
    diagnostics: {
      statureMm: stat,
      scaleApplied: scale,
      flipped,
      vertexCount: P.count,
      wristGirthMm: 2 * Math.PI * (wristRMax * 0.9),   // ellipse-ish estimate from max radius
      wristRMax,
      bandBoreMm: 52,
      chestZ: chestSurf.z,
      seatRadius: beltSeat.radius,
      buildMs: Math.round(performance.now() - t0),
    },
  };
}

/** A closed band wrapping the body at height `y`, following the measured
 *  profile the same way the old analytic wrapBand followed the loft. */
function buildBand({ y, height, thick, standoff, profileAt, radial = 96 }) {
  const pos = [], idx = [];
  // The binned profile is jagged where the arm exclusion thinned the data, and
  // a strap shows every jag as a tear. Sample it once, then smooth the ring of
  // radii until the strap reads as webbing under tension.
  const raw = [];
  for (let j = 0; j < radial; j++) raw.push(profileAt((j / radial) * Math.PI * 2, y));
  for (let pass = 0; pass < 6; pass++) {
    for (let j = 0; j < radial; j++) {
      raw[j] = (raw[(j + radial - 1) % radial] + raw[j] * 2 + raw[(j + 1) % radial]) / 4;
    }
  }
  const ring = (j) => {
    const t = (j / radial) * Math.PI * 2;
    const r = raw[j % radial];
    const dir = new THREE.Vector3(Math.cos(t), 0, Math.sin(t));
    const inner = dir.clone().multiplyScalar(r + standoff);
    const outer = dir.clone().multiplyScalar(r + standoff + thick);
    return [
      [inner.x, y - height / 2, inner.z],
      [outer.x, y - height / 2, outer.z],
      [outer.x, y + height / 2, outer.z],
      [inner.x, y + height / 2, inner.z],
    ];
  };
  for (let j = 0; j <= radial; j++) pos.push(...ring(j % radial).flat());
  for (let j = 0; j < radial; j++) {
    const a = j * 4, b = (j + 1) * 4;
    for (const [u, v] of [[0, 1], [1, 2], [2, 3], [3, 0]]) {
      idx.push(a + u, a + v, b + u, a + v, b + v, b + u);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g,
    new THREE.MeshStandardMaterial({ color: STRAP_COLOR, roughness: 0.95, side: THREE.DoubleSide }));
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}
