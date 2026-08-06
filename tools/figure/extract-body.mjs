#!/usr/bin/env node
/**
 * extract-body.mjs — pull the `body` group out of MakeHuman's base.obj.
 *
 * The source OBJ is one mesh in 172 groups: the body, a set of helper-*
 * shells MakeHuman uses for its clothing system, and ~100 tiny joint-*
 * marker cubes used for rigging. Only the body should reach the website.
 *
 * OBJ face indices are global across the whole file, so faces cannot simply
 * be filtered: this script keeps the faces of the wanted groups, collects
 * every vertex/texcoord/normal index those faces reference, renumbers them,
 * and writes a compact OBJ containing only what is referenced. Counts are
 * printed so the run is auditable in tools/figure/README.md.
 *
 * Usage: node extract-body.mjs <in.obj> <out.obj> [--eyes]
 *   --eyes  also keep helper-l-eye / helper-r-eye (if the sockets read as
 *           holes in the render, the eyeball shells fill them, in the same
 *           material as the rest of the figure)
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [inPath, outPath, ...flags] = process.argv.slice(2);
if (!inPath || !outPath) {
  console.error('usage: node extract-body.mjs <in.obj> <out.obj> [--eyes]');
  process.exit(1);
}
const KEEP = new Set(['body']);
if (flags.includes('--eyes')) {
  KEEP.add('helper-l-eye');
  KEEP.add('helper-r-eye');
}

const lines = readFileSync(inPath, 'utf8').split('\n');

const v = [];
const vt = [];
const vn = [];
const keptFaces = [];
const groupFaceCounts = new Map();
let group = '(none)';

for (const line of lines) {
  if (line.startsWith('v ')) v.push(line);
  else if (line.startsWith('vt ')) vt.push(line);
  else if (line.startsWith('vn ')) vn.push(line);
  else if (line.startsWith('g ')) group = line.slice(2).trim();
  else if (line.startsWith('f ')) {
    groupFaceCounts.set(group, (groupFaceCounts.get(group) ?? 0) + 1);
    if (KEEP.has(group)) keptFaces.push(line);
  }
}

// Collect referenced indices per attribute. OBJ indices are 1-based; negative
// (relative) indices are legal OBJ but never appear in this file, so refuse
// them rather than silently mis-mapping.
const usedV = new Map();
const usedVt = new Map();
const usedVn = new Map();
const remap = (map, idxStr) => {
  const idx = parseInt(idxStr, 10);
  if (idx < 0) throw new Error(`negative OBJ index ${idxStr}; not supported`);
  if (!map.has(idx)) map.set(idx, map.size + 1);
  return map.get(idx);
};

const outFaces = keptFaces.map((line) => {
  const parts = line.trim().split(/\s+/).slice(1);
  const mapped = parts.map((p) => {
    const [a, b, c] = p.split('/');
    let out = String(remap(usedV, a));
    if (b !== undefined || c !== undefined) {
      out += '/' + (b ? String(remap(usedVt, b)) : '');
      if (c !== undefined) out += '/' + String(remap(usedVn, c));
    }
    return out;
  });
  return 'f ' + mapped.join(' ');
});

const pick = (arr, map) => {
  const out = new Array(map.size);
  for (const [oldIdx, newIdx] of map) out[newIdx - 1] = arr[oldIdx - 1];
  return out;
};

const header = [
  '# Extracted from MakeHuman base.obj (CC0 1.0) by tools/figure/extract-body.mjs',
  `# kept groups: ${[...KEEP].join(', ')}`,
];
const out = [
  ...header,
  ...pick(v, usedV),
  ...pick(vt, usedVt),
  ...pick(vn, usedVn),
  'g body',
  ...outFaces,
  '',
].join('\n');
writeFileSync(outPath, out);

let dropped = 0;
for (const [g, n] of groupFaceCounts) if (!KEEP.has(g)) dropped += n;
console.log(`kept groups : ${[...KEEP].join(', ')}`);
for (const g of KEEP) {
  console.log(`  ${g}: ${groupFaceCounts.get(g) ?? 0} faces`);
}
console.log(`dropped     : ${dropped} faces across ${groupFaceCounts.size - KEEP.size} groups`);
console.log(`vertices    : ${v.length} in source, ${usedV.size} referenced and kept`);
console.log(`texcoords   : ${vt.length} in source, ${usedVt.size} kept`);
console.log(`normals     : ${vn.length} in source, ${usedVn.size} kept`);
