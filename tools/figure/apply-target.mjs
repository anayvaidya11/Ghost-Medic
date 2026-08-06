#!/usr/bin/env node
/**
 * apply-target.mjs — apply a MakeHuman .target morph to base.obj.
 *
 * MakeHuman's base mesh is a neutral blend; its macrodetail targets are the
 * corner shapes (gender x age x ethnicity), each a list of per-vertex deltas
 * in the same coordinate space as the OBJ:
 *
 *   <vertex-index> <dx> <dy> <dz>
 *
 * Applying one corner at weight 1.0 yields that corner's figure. The targets
 * carry the same CC0 declaration in their headers as the base mesh does.
 *
 * Usage: node apply-target.mjs <in.obj> <target> <out.obj> [weight=1.0]
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [inPath, targetPath, outPath, weightArg] = process.argv.slice(2);
if (!inPath || !targetPath || !outPath) {
  console.error('usage: node apply-target.mjs <in.obj> <target> <out.obj> [weight]');
  process.exit(1);
}
const w = Number(weightArg ?? 1.0);

const deltas = new Map();
for (const line of readFileSync(targetPath, 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const [i, dx, dy, dz] = line.trim().split(/\s+/);
  deltas.set(Number(i), [Number(dx), Number(dy), Number(dz)]);
}

let vIndex = 0;
let applied = 0;
const out = readFileSync(inPath, 'utf8').split('\n').map((line) => {
  if (!line.startsWith('v ')) return line;
  const idx = vIndex++;
  const d = deltas.get(idx);
  if (!d) return line;
  applied++;
  const [, x, y, z] = line.trim().split(/\s+/);
  const f = (v) => (Math.round(v * 1e5) / 1e5).toFixed(5);
  return `v ${f(Number(x) + w * d[0])} ${f(Number(y) + w * d[1])} ${f(Number(z) + w * d[2])}`;
});
writeFileSync(outPath, out.join('\n'));
console.log(`vertices    : ${vIndex} in source`);
console.log(`deltas      : ${deltas.size} in target, ${applied} applied at weight ${w}`);
