/**
 * debounce_data.mjs — generates debounce.csv for the website's trigger chart.
 *
 * Imports the SAME services/fallTrigger.ts the app runs. Simulates 60 seconds
 * of the demo replay (bridge/sample.ndjson looping at 10 Hz: three quiet lines,
 * one fall line, repeat) and counts model calls two ways:
 *   naive  = one call per fall reading seen
 *   actual = the shipping trigger (rising edge + 30 s cooldown)
 *
 * Run from this folder:
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON debounce_data.mjs
 */

import { writeFileSync } from 'node:fs';
import { createFallTrigger } from '../../services/fallTrigger.ts';

const LOOP = [false, false, true, false]; // sample.ndjson at 10 Hz
const trigger = createFallTrigger(); // default 30 s cooldown

let naive = 0;
let actual = 0;
const rows = ['t_s,naive_calls,actual_calls'];

for (let ms = 0; ms < 60_000; ms += 100) {
  const fall = LOOP[(ms / 100) % 4];
  if (fall) naive++;
  if (trigger.update(fall, ms, false)) actual++;
  if (ms % 500 === 0) rows.push(`${ms / 1000},${naive},${actual}`);
}
rows.push(`60,${naive},${actual}`);

writeFileSync('debounce.csv', rows.join('\n') + '\n');
console.log(`wrote debounce.csv  naive=${naive}  actual=${actual}`);
