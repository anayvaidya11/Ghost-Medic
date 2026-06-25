/**
 * eval.ts
 *
 * Baseline evaluation harness. Runs the CURRENT local Ollama model against the
 * inputs in a generated dataset and scores its outputs against the targets with
 * simple, transparent metrics:
 *
 *   - sectionPresence  : fraction of the 6 required sections present
 *   - evacMatch        : predicted EVACUATION level == target level (0/1)
 *   - treatmentOverlap : token overlap of the IMMEDIATE ACTIONS sections
 *
 * It writes a JSON report (per-item + aggregate). Run this BEFORE fine-tuning to
 * capture a baseline, then again against the tuned model to measure the lift.
 *
 * Usage:
 *   npx tsx training/eval.ts --dataset training/dataset.jsonl \
 *     --sample 50 --out training/baseline-report.json
 */

import { readFileSync, writeFileSync } from 'node:fs';

const GHOST_MEDIC_SYSTEM_PROMPT = `You are GHOST MEDIC — an offline AI clinical decision support tool for wilderness search-and-rescue responders, wilderness EMTs, and backcountry users. You follow Wilderness Medical Society guidelines and the Patient Assessment System (PAS). Always prioritize: scene safety, primary assessment ABCDE, secondary assessment SAMPLE, then treatment, then evacuation decision. Be concise. The responder is in the field, often cold, tired, and far from help. Drug recommendations should reflect what's realistically in a wilderness kit (epinephrine auto-injector, diphenhydramine, ibuprofen, acetaminophen, aspirin, glucose). Always end with: EVACUATION: [IMMEDIATE / URGENT / DELAYED / NONE] and one sentence on what to tell dispatch.

FORMAT your response exactly like this:
ASSESSMENT: [1-2 sentence summary]
PRIORITY THREATS: [bullet list]
IMMEDIATE ACTIONS:
1. [step]
2. [step]
MONITOR FOR: [deterioration signs]
EVACUATION: [IMMEDIATE / URGENT / DELAYED / NONE] — [one sentence on what to tell dispatch]`;

const REQUIRED_SECTIONS = [
  'ASSESSMENT',
  'PRIORITY THREATS',
  'IMMEDIATE ACTIONS',
  'MONITOR FOR',
  'EVACUATION',
];

const EVAC_LEVELS = ['IMMEDIATE', 'URGENT', 'DELAYED', 'NONE'];

// ── CLI ───────────────────────────────────────────────────────────────
type Args = { dataset: string; sample: number; out: string };

function parseArgs(): Args {
  const a = process.argv.slice(2);
  let dataset = 'training/dataset.jsonl';
  let sample = 0; // 0 = all
  let out = 'training/baseline-report.json';
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--dataset' && a[i + 1]) dataset = a[++i];
    else if (a[i] === '--sample' && a[i + 1]) sample = parseInt(a[++i], 10);
    else if (a[i] === '--out' && a[i + 1]) out = a[++i];
  }
  return { dataset, sample, out };
}

// ── Model call (current Ollama model) ─────────────────────────────────
async function runModel(input: string): Promise<string> {
  const baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL ?? 'llama3.2:3b';
  const res = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      system: GHOST_MEDIC_SYSTEM_PROMPT,
      prompt: `PATIENT REPORT:\n${input}\n\nProvide wilderness (PAS / WMS) guidance:`,
      stream: false,
    }),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  const data: any = await res.json();
  return (data?.response ?? '').trim();
}

// ── Metric helpers ────────────────────────────────────────────────────
function sectionPresence(text: string): number {
  const upper = text.toUpperCase();
  const present = REQUIRED_SECTIONS.filter((s) => upper.includes(s)).length;
  return present / REQUIRED_SECTIONS.length;
}

function evacLevel(text: string): string | null {
  const m = text.toUpperCase().match(/EVACUATION:\s*\[?\s*(IMMEDIATE|URGENT|DELAYED|NONE)/);
  if (m) return m[1];
  // fallback: first standalone level token after the word EVACUATION
  for (const lvl of EVAC_LEVELS) {
    if (text.toUpperCase().includes(`EVACUATION`) && text.toUpperCase().includes(lvl)) {
      return lvl;
    }
  }
  return null;
}

function extractSection(text: string, header: string): string {
  const upper = text.toUpperCase();
  const start = upper.indexOf(header);
  if (start === -1) return '';
  // section runs until the next known header or end of text
  let end = text.length;
  for (const h of REQUIRED_SECTIONS) {
    if (h === header) continue;
    const idx = upper.indexOf(h, start + header.length);
    if (idx !== -1 && idx < end) end = idx;
  }
  return text.slice(start + header.length, end);
}

const STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'on', 'for', 'with',
  'if', 'is', 'are', 'be', 'at', 'as', 'by', 'patient', 'step',
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w))
  );
}

function treatmentOverlap(pred: string, target: string): number {
  const p = tokenize(extractSection(pred, 'IMMEDIATE ACTIONS'));
  const t = tokenize(extractSection(target, 'IMMEDIATE ACTIONS'));
  if (t.size === 0) return 0;
  let hit = 0;
  for (const w of t) if (p.has(w)) hit++;
  return hit / t.size;
}

// ── Types ─────────────────────────────────────────────────────────────
type DatasetEntry = { input: string; output: string };

type ItemResult = {
  index: number;
  sectionPresence: number;
  evacMatch: number;
  evacPredicted: string | null;
  evacTarget: string | null;
  treatmentOverlap: number;
};

// ── Main ──────────────────────────────────────────────────────────────
function loadDataset(path: string): DatasetEntry[] {
  return readFileSync(path, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as DatasetEntry);
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

async function main(): Promise<void> {
  const { dataset, sample, out } = parseArgs();
  const all = loadDataset(dataset);
  const entries = sample > 0 ? all.slice(0, sample) : all;
  const model = process.env.OLLAMA_MODEL ?? 'llama3.2:3b';
  console.log(`Evaluating ${entries.length}/${all.length} entries against ${model}`);

  const items: ItemResult[] = [];

  for (let i = 0; i < entries.length; i++) {
    const { input, output: target } = entries[i];
    try {
      const pred = await runModel(input);
      const evacPredicted = evacLevel(pred);
      const evacTarget = evacLevel(target);
      items.push({
        index: i,
        sectionPresence: sectionPresence(pred),
        evacMatch: evacPredicted && evacPredicted === evacTarget ? 1 : 0,
        evacPredicted,
        evacTarget,
        treatmentOverlap: treatmentOverlap(pred, target),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  [error ${i}] ${msg}`);
    }
    if ((i + 1) % 10 === 0) console.log(`  ${i + 1}/${entries.length}`);
  }

  const report = {
    model,
    dataset,
    evaluated: items.length,
    aggregate: {
      sectionPresence: mean(items.map((r) => r.sectionPresence)),
      evacMatch: mean(items.map((r) => r.evacMatch)),
      treatmentOverlap: mean(items.map((r) => r.treatmentOverlap)),
    },
    items,
    generatedAt: new Date().toISOString(),
  };

  writeFileSync(out, JSON.stringify(report, null, 2));
  console.log('Aggregate:', report.aggregate);
  console.log(`Wrote report to ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
