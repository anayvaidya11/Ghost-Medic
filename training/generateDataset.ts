/**
 * generateDataset.ts
 *
 * Synthesize a dataset of wilderness-medicine training pairs for fine-tuning
 * Ghost Medic. Each entry is:
 *
 *   { input: <patient vignette>, output: <formatted Ghost Medic response> }
 *
 * Providers (set GHOST_MEDIC_PROVIDER):
 *   - "ollama"    → free / fully offline, uses your local Ollama server.
 *   - "anthropic" → higher quality, uses the Anthropic API.
 *
 * The script makes no SDK imports — it talks to provider HTTP endpoints with
 * the built-in `fetch`, so it has zero install footprint beyond a TS runner.
 *
 * Usage:
 *   npx tsx training/generateDataset.ts --count 500 --out training/dataset.jsonl
 */

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── The Ghost Medic system prompt (kept in sync with services/llmService.ts) ──
const GHOST_MEDIC_SYSTEM_PROMPT = `You are GHOST MEDIC — an offline AI clinical decision support tool for wilderness search-and-rescue responders, wilderness EMTs, and backcountry users. You follow Wilderness Medical Society guidelines and the Patient Assessment System (PAS). Always prioritize: scene safety, primary assessment ABCDE, secondary assessment SAMPLE, then treatment, then evacuation decision. Be concise. The responder is in the field, often cold, tired, and far from help. Drug recommendations should reflect what's realistically in a wilderness kit (epinephrine auto-injector, diphenhydramine, ibuprofen, acetaminophen, aspirin, glucose). Always end with: EVACUATION: [IMMEDIATE / URGENT / DELAYED / NONE] and one sentence on what to tell dispatch.

FORMAT your response exactly like this:
ASSESSMENT: [1-2 sentence summary]
PRIORITY THREATS: [bullet list]
IMMEDIATE ACTIONS:
1. [step]
2. [step]
MONITOR FOR: [deterioration signs]
EVACUATION: [IMMEDIATE / URGENT / DELAYED / NONE] — [one sentence on what to tell dispatch]`;

// ── Diversity matrices ────────────────────────────────────────────────
const ENVIRONMENTS = [
  'mountain / alpine',
  'desert',
  'jungle / tropical',
  'marine / coastal',
  'polar / arctic',
  'urban–wildland interface',
];

const CONDITIONS = [
  'mild hypothermia',
  'moderate hypothermia',
  'severe hypothermia',
  'heat exhaustion',
  'heat stroke',
  'frostbite',
  'acute mountain sickness (AMS)',
  'high-altitude pulmonary edema (HAPE)',
  'high-altitude cerebral edema (HACE)',
  'drowning / submersion',
  'anaphylaxis',
  'lightning strike',
  'pit-viper snake bite',
  'traumatic injury with delayed evacuation',
  'lost-person hypothermia',
  'avalanche burial',
  'long-bone fracture',
  'unstable pelvis from a fall',
  'dehydration and exhaustion',
  'severe allergic reaction without epinephrine on hand',
];

const MODIFIERS = [
  'night, falling temperatures',
  'multi-hour evacuation, no cell signal',
  'pediatric patient',
  'elderly patient with cardiac history',
  'storm moving in',
  'responder is solo',
  'patient is combative / altered',
  'limited first-aid kit only',
  'helicopter access uncertain due to weather',
  'patient has a known drug allergy',
];

// ── CLI args ──────────────────────────────────────────────────────────
type Args = { count: number; out: string };

function parseArgs(): Args {
  const a = process.argv.slice(2);
  let count = 500;
  let out = 'training/dataset.jsonl';
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--count' && a[i + 1]) count = parseInt(a[++i], 10);
    else if (a[i] === '--out' && a[i + 1]) out = a[++i];
  }
  return { count, out };
}

// ── Grounding documents ───────────────────────────────────────────────
const MAX_GROUNDING_CHARS = 6000;

function loadGrounding(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const dir = join(here, 'protocols-source');
    if (!existsSync(dir)) return '';
    const files = readdirSync(dir).filter((f) => f.endsWith('.txt'));
    if (files.length === 0) return '';
    const text = files
      .map((f) => readFileSync(join(dir, f), 'utf8'))
      .join('\n\n');
    return text.slice(0, MAX_GROUNDING_CHARS);
  } catch {
    return '';
  }
}

// ── Provider plumbing ─────────────────────────────────────────────────
type Provider = 'ollama' | 'anthropic';

async function callModel(system: string, prompt: string): Promise<string> {
  const provider = (process.env.GHOST_MEDIC_PROVIDER ?? 'ollama') as Provider;

  if (provider === 'anthropic') {
    const apiKey = process.env.ANTHROPIC_API_KEY ?? '';
    const model = process.env.ANTHROPIC_MODEL ?? 'claude-3-5-haiku-20241022';
    const baseUrl = process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com';
    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    const data: any = await res.json();
    return (data?.content?.[0]?.text ?? '').trim();
  }

  // default: ollama
  const baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL ?? 'llama3.2:3b';
  const res = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, system, prompt, stream: false }),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  const data: any = await res.json();
  return (data?.response ?? '').trim();
}

// ── Generation ────────────────────────────────────────────────────────
function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

function vignettePrompt(env: string, condition: string, modifier: string): string {
  return [
    `Write a short, realistic wilderness patient vignette (3-5 sentences) for training a SAR medical assistant.`,
    `Environment: ${env}.`,
    `Primary problem: ${condition}.`,
    `Complication / context: ${modifier}.`,
    `Include patient age and sex, mechanism or nature of illness, terrain, distance/time from help, AVPU, and a set of vital signs (HR, BP, RR, SpO2).`,
    `Do NOT include any assessment or treatment — only the scene and the patient. Output the vignette text only.`,
  ].join('\n');
}

function responsePrompt(grounding: string, vignette: string): string {
  const groundingBlock = grounding
    ? `Use the following reference material to stay accurate:\n"""\n${grounding}\n"""\n\n`
    : '';
  return `${groundingBlock}PATIENT REPORT:\n${vignette}\n\nProvide wilderness (PAS / WMS) guidance:`;
}

type DatasetEntry = { input: string; output: string };

async function generateOne(
  grounding: string,
  i: number
): Promise<DatasetEntry | null> {
  const env = pick(ENVIRONMENTS, i);
  const condition = pick(CONDITIONS, Math.floor(i / ENVIRONMENTS.length) + i);
  const modifier = pick(MODIFIERS, i * 3 + 1);

  try {
    // Step 1: synthesize the vignette (input).
    const vignette = await callModel(
      'You write concise, clinically plausible wilderness patient vignettes.',
      vignettePrompt(env, condition, modifier)
    );
    if (!vignette) return null;

    // Step 2: produce the properly formatted Ghost Medic response (output).
    const output = await callModel(
      GHOST_MEDIC_SYSTEM_PROMPT,
      responsePrompt(grounding, vignette)
    );
    if (!output) return null;

    return { input: vignette, output };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  [skip ${i}] ${msg}`);
    return null;
  }
}

async function main(): Promise<void> {
  const { count, out } = parseArgs();
  const grounding = loadGrounding();
  console.log(
    `Generating ${count} entries via ${process.env.GHOST_MEDIC_PROVIDER ?? 'ollama'}` +
      (grounding ? ` (grounded: ${grounding.length} chars)` : ' (no grounding docs)')
  );

  const lines: string[] = [];
  for (let i = 0; i < count; i++) {
    const entry = await generateOne(grounding, i);
    if (entry) lines.push(JSON.stringify(entry));
    if ((i + 1) % 10 === 0) {
      console.log(`  ${i + 1}/${count} (${lines.length} kept)`);
      // checkpoint to disk so a long run is never lost
      writeFileSync(out, lines.join('\n') + '\n');
    }
  }

  writeFileSync(out, lines.join('\n') + '\n');
  console.log(`Done. Wrote ${lines.length} entries to ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
