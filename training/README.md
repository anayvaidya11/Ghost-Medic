# Ghost Medic — Wilderness Medicine Fine-Tuning Pipeline

This directory sets up (but does **not** run) the pipeline for fine-tuning a
small local model to behave like Ghost Medic under **Wilderness Medical Society
(WMS)** guidance and the **Patient Assessment System (PAS)**.

The goal: a model that, given a wilderness patient vignette, returns a response
in the exact Ghost Medic format and ends with a correct
`EVACUATION: [IMMEDIATE / URGENT / DELAYED / NONE]` line.

```
training/
├── README.md              ← you are here
├── generateDataset.ts     ← synthesize 500 {input, output} training pairs
├── eval.ts                ← baseline-score the current model before tuning
├── protocols-source/      ← drop grounding documents here (plain text)
└── dataset.jsonl          ← (generated) one JSON object per line
```

## Response format the dataset teaches

```
ASSESSMENT: [1-2 sentence summary]
PRIORITY THREATS: [bullet list]
IMMEDIATE ACTIONS:
1. [step]
2. [step]
MONITOR FOR: [deterioration signs]
EVACUATION: [IMMEDIATE / URGENT / DELAYED / NONE] — [one sentence for dispatch]
```

## Pipeline steps

### 0. Add grounding documents (optional but recommended)
Paste WMS guidelines, NOLS Wilderness Medicine excerpts, and CDC wilderness
health references into `protocols-source/` as plain `.txt` files. The generator
will fold any text it finds there into the prompts so synthetic answers stay
anchored to real doctrine. See `protocols-source/README.md`.

### 1. Generate the synthetic dataset
```bash
# Free / fully offline (uses your local Ollama server):
GHOST_MEDIC_PROVIDER=ollama \
  OLLAMA_BASE_URL=http://localhost:11434 \
  OLLAMA_MODEL=llama3.2:3b \
  npx tsx training/generateDataset.ts --count 500 --out training/dataset.jsonl

# Higher quality (uses the Anthropic API):
GHOST_MEDIC_PROVIDER=anthropic \
  ANTHROPIC_API_KEY=sk-ant-... \
  ANTHROPIC_MODEL=claude-3-5-haiku-20241022 \
  npx tsx training/generateDataset.ts --count 500 --out training/dataset.jsonl
```
Produces `dataset.jsonl`: one `{ "input": ..., "output": ... }` per line,
spanning mountain, desert, jungle, marine, polar, and urban–wildland-interface
environments and a wide spread of conditions.

### 2. Establish a baseline (before fine-tuning)
```bash
OLLAMA_BASE_URL=http://localhost:11434 \
  OLLAMA_MODEL=llama3.2:3b \
  npx tsx training/eval.ts --dataset training/dataset.jsonl \
  --sample 50 --out training/baseline-report.json
```
`eval.ts` runs the **current** Ollama model against the dataset inputs and
scores the outputs against the targets using simple, transparent metrics:
- **section presence** — are all six required sections present?
- **evacuation match** — does the predicted EVACUATION level match the target?
- **treatment overlap** — token overlap of the IMMEDIATE ACTIONS sections.

It writes a JSON report with per-item and aggregate scores. Keep this as the
"before" number.

### 3. Fine-tune (run by a human — NOT automated here)
With `dataset.jsonl` in hand you can fine-tune however you like, e.g.:
- **Ollama / llama.cpp**: convert to the chat format your trainer expects and
  run a LoRA/QLoRA pass, then `ollama create` a new model from the adapter.
- **Axolotl / Unsloth**: point the config at `dataset.jsonl`.

Re-run `eval.ts` against the tuned model (swap `OLLAMA_MODEL`) and compare to the
baseline report.

## Notes
- Both scripts are dependency-light: they call provider HTTP APIs with the
  built-in `fetch`, so no SDK install is required. Run them with `tsx`
  (`npm i -D tsx`) or compile with `tsc` and run with `node`.
- Nothing here touches the app's live Ollama streaming integration — these are
  standalone Node scripts.
