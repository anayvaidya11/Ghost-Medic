# Ghost Medic — Roadmap

**Read this first, every session.** It exists so you never have to hold the whole
project in your head again. Pick the lowest unchecked phase, do it, check it off.

- **Product (decided 2026-07-20):** the **LLM wilderness assistant** (`app/` +
  `services/`). The old deterministic TCCC engine is archived in [`legacy/`](legacy/README.md).
- **What we're optimizing for:** *Goal B* — a highly technical, honest **proof**
  that the engineering works (simulation + real firmware link + docs), shown on a
  Vercel site + this repo. Not a hardware-validated medical device (that's Goal A,
  years away). For a proof, a **demonstrated, honestly-labeled** end-to-end pipeline
  beats a half-finished "real" one.
- **North star:** *one command brings up sensor stream (from the firmware's own
  math, no hardware) → bridge → app → local LLM → spoken triage advice, fully
  offline, every real-vs-simulated boundary labeled — plus one video of the Pico
  streaming on real hardware.*

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for topology and [`DATA_FORMAT.md`](DATA_FORMAT.md)
for the wire contract.

---

## Status legend
🟢 done · 🟡 in progress · ⬜ not started · 🧊 deferred (don't do yet)

---

## Phase 0 — Kill the ambiguity  🟢 DONE (2026-07-21)
*One product, one repo, shared memory.*
- 🟢 Decision made: product = LLM wilderness assistant.
- 🟢 TCCC engine archived to `legacy/` (product typechecks clean; nothing imports legacy).
- 🟢 `ARCHITECTURE.md`, `DATA_FORMAT.md`, this `ROADMAP.md` written.
- 🟢 `simulator/` committed.

## Phase 1 — The spine (the bridge)  🟡 IN PROGRESS
*Make sensor data actually reach the app. Highest leverage.*
- ⬜ Node bridge: reads NDJSON, re-broadcasts unchanged over `ws://localhost:8080`.
  `--source ∈ {serial, sim, file}`. Ship `file` (replay a capture at 10 Hz) first.
  Skip lines without `t_ms`. Deps: `ws` (+ `serialport` only in serial mode).
  *(Being built in a separate session — spec is in `DATA_FORMAT.md`.)*
- ⬜ Wire the app to `ws://localhost:8080`: parse NDJSON per `DATA_FORMAT.md`,
  replace the simulated vitals source (`services/biosensorService.ts`) with the
  live stream. Gate every field behind its `ok` flag.
- ⬜ **Upgrade the `sim` source** to generate the stream from the firmware's *own*
  pure C (`firmware/bmp280_compensation.c`, `firmware/fall_detection.c`) compiled
  on the host — so the test data is the shipping code, not a reimplementation.
- **DONE WHEN:** replayed/generated sensor lines make the numbers in the app move, live.

## Phase 2 — Close the loop  ⬜
*Sensor data changes the AI's answer.*
- ⬜ Feed live vitals + `fall_detected` into the LLM prompt alongside image + text.
- **DONE WHEN:** a fall event or an abnormal vital *visibly changes* the advice.

## Phase 3 — Hardware truth  ⬜ (gated on parts: a Pico + the 3 breakout sensors)
*The single highest-credibility artifact.*
- ⬜ Flash `firmware/ghost_medic_firmware.uf2`; capture a short **video** of the
  Pico streaming real JSON.
- ⬜ Run the same bridge with `--source=serial` against the real board.
- ⬜ Save a real capture file; note any datasheet/timing bugs found on the bench.
- **DONE WHEN:** one honest artifact proves the firmware runs on metal.

## Phase 4 — The proof website  ⬜
*The honest storytelling layer over everything above.*
- ⬜ Next.js on Vercel: topology diagram → embedded live simulator → fall-detection
  demo → compile/test receipts (clean `-Wall -Wextra -O3` build, passing host
  tests) → the hardware video → deep links into this repo.
- ⬜ Label real vs. simulated **everywhere** (reuse the table in `ARCHITECTURE.md`).
- **DONE WHEN:** a stranger understands the engineering and sees it work in ~90 s.

## Phase 5+ / deferred  🧊 (do NOT start these now — they're not on the critical path)
- 🧊 Run the fine-tune pipeline in `training/` (its existence is enough proof for now).
- 🧊 Real BLE wrist→pack link (the wired bridge is the honest stand-in).
- 🧊 Real speech-to-text (whisper.cpp) and wound vision — stubs are fine until
  Phase 2 works with text.
- 🧊 Choosing/building the dedicated "pack" compute device (Jetson/Pi 5). For now,
  **laptop = pack.** Document the path in one paragraph, move on.
- 🧊 PCB fabrication (the design + firmware is the story).

---

## Anti-rathole rules
1. Never work on a 🧊 item while a ⬜ item below Phase 4 is open.
2. Every new claim on the website must map to a 🟢 row here.
3. When unsure "is this real or simulated?", the answer goes in the label, not the code.

## Known cleanups (small, do when convenient)
- `services/llmConfig.example.ts` currently has a syntax error (~line 120) and is
  tracked — it breaks `npm run typecheck`. Fix the template or exclude `*.example.ts`.
- Consider lifting `legacy/src/scenarios/*.json` (wilderness vignettes) out for use
  as LLM demo/eval inputs.
