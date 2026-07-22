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

## Locked Decisions (confirmed by owner — do not relitigate)

1. **What it is:** an offline, wearable AI **first-aid assistant prototype**. A
   wrist-worn sensor hub captures motion, altitude/environment, and raw optical
   signals, streams them to a **local (no-internet) LLM** that combines them with
   voice + image input to speak numbered first-aid guidance.
2. **What the app shows:** altitude, temperature, and fall-status as
   honestly-derived values; raw optical (red/IR) and acceleration as
   clearly-labeled **raw signal** (live trace). **No heart-rate / SpO2 / BPM number
   anywhere.** Raw vs. derived is visually distinguished.
3. **What the site proves:** a full offline pipeline (firmware-grade sensor data →
   bridge → app → local LLM → spoken advice) runs end-to-end and *responds to its
   inputs*, with every real-vs-simulated boundary labeled. The physical-hardware
   run is shown separately as a scoped video artifact.
4. **Build order:** Phase 1 bridge+app → Phase 2 sensor-changes-advice →
   Phase 3 hardware video → Phase 4 website.

### Out of scope (committed — do NOT build)
- No HR / SpO2 / BPM computation.
- No real BLE — the wired local WebSocket bridge is the honest stand-in.
- No dedicated "pack" hardware — **laptop = pack**; the topology is a documented
  tradeoff study, not a device to build now.
- No real speech-to-text or wound vision — both are **stubs**.
- No PCB fabrication.
- No medical-validity claims.

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
- 🟢 Node bridge: reads NDJSON, re-broadcasts unchanged over `ws://localhost:8080`.
  `--source ∈ {serial, sim, file}`; `file` mode shipped (+ `--loop` for continuous
  replay), `serial` stubbed with a clear message. Drops lines without `t_ms`.
  Dep: `ws` only. Verified: `test-client.js` receives the 4 data lines, boot line
  dropped, loops correctly. (`bridge/`, spec in `DATA_FORMAT.md`.)
- 🟢 App wired to `ws://localhost:8080/stream`: `services/useWristVitals.ts` +
  `services/wristVitalsParser.ts` parse NDJSON per `DATA_FORMAT.md` (every field
  gated on its `ok` flag), consumed by `app/index.tsx`'s `VitalsMonitor` on the
  READY screen with a ●LIVE/○DISCONNECTED indicator. Honest: raw vs. derived split,
  nulls render "—", no HR/SpO2. Verified: `npx tsc --noEmit` clean; the compiled
  parser maps the live bridge stream to correct values (incl. `ok:false` → "—").
  *Not yet verified: React actually painting the values in a running browser.*
- ⬜ **Upgrade the `sim` source** to generate the stream from the firmware's *own*
  pure C (`firmware/bmp280_compensation.c`, `firmware/fall_detection.c`) compiled
  on the host — so the test data is the shipping code, not a reimplementation.
- **DONE WHEN:** replayed/generated sensor lines make the numbers in the app move, live.

## Phase 2 — Close the loop  🟡 NEARLY DONE (2026-07-22)
*Sensor data changes the AI's answer.*
- 🟢 Sensor context injection: `services/sensorContext.ts` (pure, 16/16 headless
  tests) builds a delimited block — derived values qualified (altitude relative,
  temp ambient-not-body), raw optical labeled non-diagnostic, `ok:false` →
  "unavailable" never 0, disconnected → honest "no sensor data". Appended to
  every LLM request in `app/index.tsx`; the exact sent block is viewable in the
  UI ("SENSOR CONTEXT ATTACHED" chip). System prompt extended with reasoning
  rules incl. NEVER inferring HR/SpO2 from raw counts.
- 🟢 Fall auto-trigger: `services/fallTrigger.ts` (rising edge + 30 s cooldown +
  suppression; 6/6 headless tests — 1 fire per replay loop, not 4). Auto-submits
  post-fall guidance, labeled "SENSOR-TRIGGERED (not typed by user)"; toggleable.
- 🟢 Simulator upgraded as demo instrument: temp-offset + per-sensor `ok:false`
  failure toggles (headless-verified against the app parser); bpm display
  removed (Decision 2).
- 🟢 **DONE-WHEN evidence:** real Ollama (llama3.2:3b, local) called with the
  app's exact payload construction — the fall-context response adds head/neck/
  spine + hidden-trauma assessment absent from the no-fall response; the model
  did not invent HR/SpO2 when probed. (Seeded proof harness; transcript in the
  2026-07-22 session report.)
- ⬜ Remaining: visually confirm the full loop in a running browser/app (same
  outstanding gap as Phase 1's "numbers move live" — everything up to the React
  render is verified headless). Known limit: the 3B model avoids inventing HR
  but doesn't always *state* it can't measure it, as the prompt instructs.

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
