/**
 * WEARER FIGURE: the cropped body the product concept is shown on.
 *
 * This is NOT a body scan, not CAD, and not anyone's real proportions. It is a
 * placeholder form built in code, the same way the wrist unit and the belt pack
 * beside it are: a torso lofted through superellipse cross-sections and an arm
 * swept along a curve. Both ends of the torso are cut off by the frame on
 * purpose. A whole standing figure would put the 48 mm wrist case at about 3%
 * of frame height and hide every detail on it.
 *
 * Everything is in millimetres, in the wearer's frame: origin at the waist
 * centre, +Y up, +Z out of the chest toward the viewer, +X the wearer's left.
 *
 * What the module hands back is two mounting frames, so the product parts are
 * placed by measurement rather than by nudging numbers until it looks right:
 *   wrist — position and orientation for the wrist unit, on the forearm
 *   belt  — a seat point, an outward normal, and the local radius of curvature
 *           of the torso there, which is what the pack has to sit against
 * plus `clearance()`, which reports how close the arm passes to the torso. That
 * is a question about whether two surfaces intersect, and eyeballing a render
 * answers it wrong.
 */

import * as THREE from 'three';

const SKIN = 0xada79b;          // matte neutral, no metalness; a display form, not flesh
const BELT_COLOR = 0x3d4038;

/**
 * Torso cross-sections, low to high. `a` is half-width, `b` is half-depth, and
 * `n` is the superellipse exponent: 2 is a plain ellipse, higher is squarer.
 * A torso is squarer than an ellipse across the back and ribs, so n sits above 2.
 * The top and bottom levels exist only to run past the frame edge.
 */
const TORSO_LEVELS = [
  { y: -330, a: 170, b: 117, n: 2.8 },   // thigh, cut off by the frame
  { y: -250, a: 176, b: 118, n: 2.7 },
  { y: -170, a: 179, b: 117, n: 2.6 },   // hip, the widest point below the waist
  { y:  -80, a: 157, b: 106, n: 2.5 },   // upper hip, where a belt pack rides
  { y:    0, a: 145, b:  99, n: 2.5 },   // waist, the narrowest point
  { y:   60, a: 152, b: 103, n: 2.6 },   // lower ribs
  { y:  180, a: 176, b: 114, n: 2.7 },   // chest
  { y:  300, a: 176, b: 110, n: 2.8 },   // upper chest
  { y:  430, a: 178, b: 108, n: 2.9 },   // shoulder line, cut off by the frame
];

const TORSO_TOP = 430;
const TORSO_BOTTOM = -330;

// Where the pack rides. The seat angle is not chosen by eye: findPackSeat scans
// the front-left quadrant for the angle whose local radius of curvature comes
// closest to the pack's own 150 mm inner face.
const BELT_Y = -55;             // the belt line
const PACK_Y = -78;             // the pack's centre, hanging just under the belt

/**
 * The arm, swept as one surface from the shoulder to the fingertips.
 *
 * The shoulder point sits INSIDE the torso on purpose. The sweep's start cap is
 * then buried in the body and never shows, which is what lets the arm be cut
 * off without leaving a floating disc of a stump hanging in the air. The elbow
 * is a control point rather than a joint: a centripetal Catmull-Rom through it
 * bends about as much as a relaxed elbow does.
 */
const SHOULDER = new THREE.Vector3(-158, 338, 12);
const ELBOW    = new THREE.Vector3(-215, 55, 115);
const WRIST    = new THREE.Vector3(-30, 130, 290);
const HAND_LEN   = 152;         // wrist to fingertip
const HAND_DROOP = 0.26;        // radians the hand hangs below the forearm axis
const HAND_YAW   = 0.45;        // radians the hand turns in across the body

export function buildWearer({ radial = 96 } = {}) {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({
    color: SKIN, roughness: 0.92, metalness: 0.0, side: THREE.DoubleSide,
  });

  // ══ TORSO ═════════════════════════════════════════════════════════════════
  const torso = new THREE.Mesh(loftTorso({ rings: 72, radial }), skin);
  torso.castShadow = torso.receiveShadow = true;
  group.add(torso);

  // ══ ARM AND HAND ══════════════════════════════════════════════════════════
  // One swept surface shoulder to fingertip. Sweeping it in one piece rather
  // than joining separate parts keeps the wrist free of a seam exactly where
  // the band has to sit on it.
  const armPath = buildArmPath();
  const marks = armLandmarks(armPath);
  const armSection = makeArmSection(marks);
  const arm = new THREE.Mesh(
    sweepLimb({ path: armPath, section: armSection, steps: 170, radial: 44 }), skin);
  arm.castShadow = arm.receiveShadow = true;
  group.add(arm);

  const thumb = new THREE.Mesh(buildThumb(armPath, marks), skin);
  thumb.castShadow = thumb.receiveShadow = true;
  group.add(thumb);

  // ══ BELT ══════════════════════════════════════════════════════════════════
  // A real belt wrapping the torso surface, not a strap floating beside the
  // pack. It follows the same superellipse the torso does, 3 mm proud of it.
  const belt = new THREE.Mesh(
    wrapBand({ y: BELT_Y, height: 27, thick: 4.5, standoff: 3, radial }),
    new THREE.MeshStandardMaterial({ color: BELT_COLOR, roughness: 0.95, side: THREE.DoubleSide }));
  belt.castShadow = belt.receiveShadow = true;
  group.add(belt);

  // ══ MOUNTING FRAME: THE WRIST ═════════════════════════════════════════════
  // The wrist unit's own geometry sweeps its band in the local XY plane with the
  // arm running along local +Z, and seats the case on local +Y. So the frame it
  // needs is: +Z along the forearm, +Y out through the back of the wrist.
  //
  // Both the point and the direction come from the curve at the wrist landmark,
  // not from the WRIST constant and not from a straight elbow-to-wrist line. The
  // sweep follows the curve, so anything mounted from a different source drifts
  // off the surface it is supposed to be sitting on.
  const wristAt = armPath.getPoint(marks.wrist);
  const axis = armPath.getTangent(marks.wrist).normalize();
  const up = FACE_REF.clone()
    .addScaledVector(axis, -FACE_REF.dot(axis)).normalize();     // orthogonalise against the arm
  const right = new THREE.Vector3().crossVectors(up, axis);
  const wristQuat = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(right, up, axis));

  // ══ MOUNTING FRAME: THE BELT SEAT ═════════════════════════════════════════
  const seat = findPackSeat(150);

  /** Gap from a point to the arm's surface: negative means inside the limb.
   *  `from` restricts the search along the sweep, so the cable can be checked
   *  against the hand alone without the forearm it deliberately runs beside. */
  const limbGap = (p, from = 0, to = 1) => {
    let best = Infinity;
    for (let i = 0; i <= 300; i++) {
      const t = from + (i / 300) * (to - from);
      const { a, b } = armSection(t);
      best = Math.min(best, armPath.getPoint(t).distanceTo(p) - Math.max(a, b));
    }
    return best;
  };

  return {
    group,
    wrist: { position: wristAt.clone(), quaternion: wristQuat, axis: axis.clone() },
    belt: seat,
    diagnostics: {
      seatAngleDeg: seat.thetaDeg,
      seatRadius: seat.radius,
      wristSection: armSection(marks.wrist),
      armLength: ELBOW.distanceTo(WRIST),
      clearance: clearance(armPath, armSection, marks),
      marks,
    },
    // Exposed so the viewer and the verification script measure against the real
    // surface rather than against a second copy of the maths.
    surface: {
      torsoPoint, torsoNormalAt, torsoRadiusAt, sectionAt,
      armPath, armSection, marks, limbGap,
    },
  };
}

/* ════════════════════════════════════════════════════════════════════════════
   TORSO SURFACE
   ════════════════════════════════════════════════════════════════════════════ */

/** Half-width, half-depth and exponent at height `y`, smoothstepped between the
 *  defined levels so the loft has no visible crease at each one. */
function sectionAt(y) {
  const L = TORSO_LEVELS;
  if (y <= L[0].y) return { ...L[0] };
  if (y >= L[L.length - 1].y) return { ...L[L.length - 1] };
  for (let i = 0; i < L.length - 1; i++) {
    if (y <= L[i + 1].y) {
      const p = L[i], q = L[i + 1];
      let u = (y - p.y) / (q.y - p.y);
      u = u * u * (3 - 2 * u);
      return { a: p.a + (q.a - p.a) * u, b: p.b + (q.b - p.b) * u, n: p.n + (q.n - p.n) * u };
    }
  }
  return { ...L[L.length - 1] };
}

/** Superellipse |x/a|^n + |z/b|^n = 1, parametrised so t = 0 is the wearer's
 *  left side and t = pi/2 is dead front. */
function superXZ(a, b, n, t) {
  const c = Math.cos(t), s = Math.sin(t), e = 2 / n;
  return [
    a * Math.sign(c) * Math.abs(c) ** e,
    b * Math.sign(s) * Math.abs(s) ** e,
  ];
}

function torsoPoint(t, y) {
  const s = sectionAt(y);
  const [x, z] = superXZ(s.a, s.b, s.n, t);
  return new THREE.Vector3(x, y, z);
}

/** Outward normal in the horizontal plane, from the gradient of the superellipse.
 *  The loft's vertical taper is gentle enough that ignoring it here costs less
 *  than a degree, and the pack only needs the horizontal direction. */
function torsoNormalAt(t, y) {
  const s = sectionAt(y);
  const [x, z] = superXZ(s.a, s.b, s.n, t);
  const gx = (s.n / s.a) * Math.abs(x / s.a) ** (s.n - 1) * Math.sign(x);
  const gz = (s.n / s.b) * Math.abs(z / s.b) ** (s.n - 1) * Math.sign(z);
  return new THREE.Vector3(gx, 0, gz).normalize();
}

/** Local radius of curvature of the cross-section at `t`, by finite difference.
 *  This is the number that decides whether the pack can sit flush. */
function torsoRadiusAt(t, y, h = 1e-4) {
  const s = sectionAt(y);
  const p = (u) => superXZ(s.a, s.b, s.n, u);
  const [x0, z0] = p(t - h), [x1, z1] = p(t), [x2, z2] = p(t + h);
  const dx = (x2 - x0) / (2 * h), dz = (z2 - z0) / (2 * h);
  const ddx = (x2 - 2 * x1 + x0) / (h * h), ddz = (z2 - 2 * z1 + z0) / (h * h);
  const num = (dx * dx + dz * dz) ** 1.5;
  const den = Math.abs(dx * ddz - dz * ddx);
  return den < 1e-9 ? Infinity : num / den;
}

/** Distance from the body's vertical axis out to the surface, in the horizontal
 *  direction of (x, z). Used for clearance checks and for routing the cable. */
function torsoReach(x, z, y) {
  const t = Math.atan2(z, x);
  const p = torsoPoint(t, y);
  return Math.hypot(p.x, p.z);
}

/**
 * Picks where the pack rides. The pack's inner face is a 150 mm circular arc,
 * but a torso cross-section is elliptical: flatter than 150 mm across the front,
 * tighter than 150 mm at the sides. There is no angle where a circle matches an
 * ellipse exactly, so this scans the front-left quadrant for the angle whose
 * local radius is closest to the pack's, which is where the residual gap along
 * the pack's width is smallest.
 */
function findPackSeat(packRadius) {
  let best = null;
  for (let i = 0; i <= 400; i++) {
    const t = Math.PI / 2 + (i / 400) * (Math.PI / 2);   // dead front round to the left side
    const r = torsoRadiusAt(t, PACK_Y);
    const err = Math.abs(r - packRadius);
    if (!best || err < best.err) best = { t, r, err };
  }
  return {
    theta: best.t,
    thetaDeg: (best.t * 180) / Math.PI,
    radius: best.r,
    position: torsoPoint(best.t, PACK_Y),
    normal: torsoNormalAt(best.t, PACK_Y),
  };
}

function loftTorso({ rings, radial }) {
  const pos = [], idx = [];
  for (let i = 0; i <= rings; i++) {
    const y = TORSO_BOTTOM + (i / rings) * (TORSO_TOP - TORSO_BOTTOM);
    for (let j = 0; j < radial; j++) {
      const p = torsoPoint((j / radial) * Math.PI * 2, y);
      pos.push(p.x, p.y, p.z);
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j;
      const b = i * radial + ((j + 1) % radial);
      idx.push(a, b, a + radial, b, b + radial, a + radial);
    }
  }
  // Flat caps at the cut ends. The frame hides them; the orbit control can be
  // pulled back far enough to see them, and an open shell would look worse.
  const capBase = pos.length / 3;
  pos.push(0, TORSO_BOTTOM, 0);
  pos.push(0, TORSO_TOP, 0);
  for (let j = 0; j < radial; j++) {
    const b = (j + 1) % radial;
    idx.push(capBase, b, j);
    const top = rings * radial;
    idx.push(capBase + 1, top + j, top + b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A closed band wrapping the torso at height `y`, following the same surface. */
function wrapBand({ y, height, thick, standoff, radial }) {
  const pos = [], idx = [];
  const ring = (j) => {
    const t = (j / radial) * Math.PI * 2;
    const p = torsoPoint(t, y);
    const n = torsoNormalAt(t, y);
    const inner = p.clone().addScaledVector(n, standoff);
    const outer = p.clone().addScaledVector(n, standoff + thick);
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
  return g;
}

/* ════════════════════════════════════════════════════════════════════════════
   ARM AND HAND
   ════════════════════════════════════════════════════════════════════════════ */

// The direction the back of the wrist faces, which is where the display ends up
// pointing. Chosen to aim the screen at the camera's default three-quarter
// position, up and round to the wearer's right, rather than straight up where a
// viewer in front of the figure would only ever see it edge-on.
//
// The limb sweep uses the same vector as its reference up, so the band and the
// arm under it share one frame and the case cannot drift off the top of the
// wrist.
const FACE_REF = new THREE.Vector3(-0.40, 0.42, 0.81).normalize();

function forearmAxis() {
  return new THREE.Vector3().subVectors(WRIST, ELBOW).normalize();
}

/** The direction the hand leaves the wrist: the forearm axis turned in across
 *  the body and dropped a little, the way a hand sits when a wrist is raised to
 *  be read. */
function handDirection() {
  const axis = forearmAxis();
  const side = new THREE.Vector3().crossVectors(axis, new THREE.Vector3(0, 1, 0)).normalize();
  return axis.clone()
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), HAND_YAW)
    .applyAxisAngle(side, HAND_DROOP)
    .normalize();
}

function buildArmPath() {
  // A slight forward bow, so the forearm is not a straight tube and so it keeps
  // clear of the ribs. `clearance()` reports what the bow actually buys.
  const bow = new THREE.Vector3(-0.25, -0.15, 0.95).normalize();
  const mid = ELBOW.clone().lerp(WRIST, 0.5).addScaledVector(bow, 18);

  const dir = handDirection();
  const knuckle = WRIST.clone().addScaledVector(dir, HAND_LEN * 0.44);
  const tip = WRIST.clone().addScaledVector(dir, HAND_LEN);

  // Centripetal parametrisation: a uniform Catmull-Rom overshoots at the elbow,
  // where the path turns through nearly a right angle, and the overshoot shows
  // as a bulge on the outside of the joint.
  return new THREE.CatmullRomCurve3(
    [SHOULDER, ELBOW, mid, WRIST, knuckle, tip], false, 'centripetal', 0.5);
}

/**
 * Reads back where each control point falls along the curve.
 *
 * As it happens these come out evenly spaced: three.js maps `t` uniformly across
 * segments and lets `curveType` affect only the shape within a segment, so with
 * six control points the elbow really is at 0.200 and the wrist at 0.600. The
 * function is not correcting anything today. It earns its place by removing the
 * assumption: the section table below is written in terms of named landmarks, so
 * adding or removing a control point cannot silently slide the wrist's narrow
 * section away from where the band is mounted.
 */
function armLandmarks(path, samples = 3000) {
  const pts = path.points;
  const best = pts.map(() => ({ t: 0, d: Infinity }));
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const c = path.getPoint(t);
    for (let k = 0; k < pts.length; k++) {
      const d = c.distanceToSquared(pts[k]);
      if (d < best[k].d) { best[k].d = d; best[k].t = t; }
    }
  }
  return {
    shoulder: 0,
    elbow: best[1].t,
    mid: best[2].t,
    wrist: best[3].t,
    knuckle: best[4].t,
    tip: 1,
  };
}

/**
 * Half-axes of the swept cross-section. `a` is across the limb, `b` is through
 * it. Upper arm and forearm are close to round and taper; past the wrist the
 * section flattens and widens into a mitten. No separate fingers: at this scale
 * they would be four 12 mm tubes, which reads worse than one clean mass.
 */
function makeArmSection(marks) {
  const between = (p, q, u) => p + (q - p) * u;
  const KEYS = [
    [marks.shoulder, 64, 60],                              // buried inside the torso
    [between(marks.shoulder, marks.elbow, 0.55), 55, 51],  // upper arm
    [marks.elbow, 47, 43],
    [marks.mid, 38, 34],                                   // mid forearm
    [marks.wrist, 25.0, 20.5],                             // inside the band's 26 mm bore
    [between(marks.wrist, marks.knuckle, 0.55), 31, 16],   // the hand flattens and widens
    [marks.knuckle, 38, 15],                               // widest part of the hand
    [between(marks.knuckle, marks.tip, 0.55), 34, 13],
    [marks.tip, 13, 6.5],                                  // fingertips, rounded off
  ];
  return (t) => {
    for (let i = 0; i < KEYS.length - 1; i++) {
      const [t0, a0, b0] = KEYS[i], [t1, a1, b1] = KEYS[i + 1];
      if (t <= t1) {
        let u = (t1 - t0) < 1e-9 ? 0 : (t - t0) / (t1 - t0);
        u = Math.max(0, Math.min(1, u));
        u = u * u * (3 - 2 * u);
        return { a: a0 + (a1 - a0) * u, b: b0 + (b1 - b0) * u };
      }
    }
    const last = KEYS[KEYS.length - 1];
    return { a: last[1], b: last[2] };
  };
}

/** The frame the sweep uses at path parameter `t`: origin, and the two axes the
 *  cross-section is drawn in. */
function frameAt(path, t) {
  const c = path.getPoint(t);
  const tan = path.getTangent(t).normalize();
  const right = new THREE.Vector3().crossVectors(FACE_REF, tan).normalize();
  const up = new THREE.Vector3().crossVectors(tan, right).normalize();
  return { c, tan, right, up };
}

/**
 * A thumb, swept off the side of the palm. Without one the mitten reads as a
 * paddle; with one it reads as a hand even though it has no fingers.
 */
function buildThumb(path, marks) {
  const span = (u) => marks.wrist + (marks.knuckle - marks.wrist) * u;
  const base = frameAt(path, span(0.55));
  const tip = frameAt(path, span(1.7));
  const out = base.right.clone().negate();          // the thumb side of the palm

  const p0 = base.c.clone().addScaledVector(out, 18);
  const p1 = base.c.clone().addScaledVector(out, 36).addScaledVector(base.tan, 20);
  const p2 = tip.c.clone().addScaledVector(out, 33).addScaledVector(base.tan, -4);
  const curve = new THREE.CatmullRomCurve3([p0, p1, p2], false, 'centripetal', 0.5);

  return sweepLimb({
    path: curve,
    section: (t) => {
      const w = 12.5 - 4.5 * t * t;
      return { a: w, b: w * 0.85 };
    },
    steps: 36,
    radial: 20,
  });
}

/**
 * Sweeps an elliptical cross-section along a curve. Frames come from a fixed
 * reference up-vector rather than the curve's own normal, because a Frenet frame
 * twists where the curve's curvature flips, and that twist would rotate the
 * wrist out from under the band.
 */
function sweepLimb({ path, section, steps, radial }) {
  const pos = [], idx = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const { c, right, up } = frameAt(path, t);
    const { a, b } = section(t);
    for (let j = 0; j < radial; j++) {
      const ang = (j / radial) * Math.PI * 2;
      const p = c.clone()
        .addScaledVector(right, a * Math.cos(ang))
        .addScaledVector(up, b * Math.sin(ang));
      pos.push(p.x, p.y, p.z);
    }
  }
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j;
      const b = i * radial + ((j + 1) % radial);
      idx.push(a, b, a + radial, b, b + radial, a + radial);
    }
  }
  // Cap both ends with a fan. The shoulder cap is inside the torso and the
  // fingertip section is small, so neither is visible.
  const capA = pos.length / 3;
  const c0 = path.getPoint(0);
  pos.push(c0.x, c0.y, c0.z);
  for (let j = 0; j < radial; j++) idx.push(capA, (j + 1) % radial, j);

  const capB = pos.length / 3;
  const c1 = path.getPoint(1);
  pos.push(c1.x, c1.y, c1.z);
  const last = steps * radial;
  for (let j = 0; j < radial; j++) idx.push(capB, last + j, last + ((j + 1) % radial));

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * How close the arm passes to the torso, sampled along the sweep. Reported as
 * the gap between the limb's outer surface and the body's, so a negative number
 * means the two solids overlap.
 *
 * The shoulder end is meant to overlap: burying the sweep's start cap inside the
 * torso is what hides the cut. So the summary covers only the free part of the
 * limb, from below the elbow outward, and the shoulder overlap is reported
 * separately as confirmation the cap really is buried.
 */
function clearance(path, armSection, marks, samples = 200) {
  let minGap = Infinity, minAt = 0;
  let shoulderOverlap = 0;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const c = path.getPoint(t);
    const { a, b } = armSection(t);
    const limbR = Math.max(a, b);
    const gap = Math.hypot(c.x, c.z) - torsoReach(c.x, c.z, c.y) - limbR;
    if (t <= marks.elbow) shoulderOverlap = Math.min(shoulderOverlap, gap);
    else if (gap < minGap) { minGap = gap; minAt = t; }
  }
  return { minGap, minAt, shoulderOverlap };
}
