# Ghost Medic — Architecture

*What the system is, what runs where, and exactly where the "real" line is.*

Ghost Medic (being renamed **Archiater**, of **Wyzantium Industries**) is an
**offline decision-support prototype**: a trained responder — a medic, an
expedition leader, a remote-site lead — is treating a patient far from help,
with no signal. The system senses the patient and the environment, reasons
about it with a **local** language model, and speaks numbered candidate
actions for the responder to weigh — with **no internet**. The responder on
scene decides.

## The one product (decided 2026-07-20, repositioned 2026-08-05)

The product is **offline decision-support software running on the device the
responder already carries**, with the wrist sensor hub as an optional
accessory (`app/` + `services/`; rationale in
[`docs/POSITIONING.md`](docs/POSITIONING.md)). An earlier deterministic
TCCC/MARCH engine was archived to [`legacy/`](legacy/README.md); it is not
part of this architecture.

## System topology — what runs where

Three roles plus the human. In the **shipping vision** the end-user device is
the responder's own phone or EUD; in the **current demo** a laptop plays that
device. Being explicit about this is the whole point — it's how we stay honest
about what's proven.

```
 ┌────────────────────────┐            ┌─────────────────────────────────────┐
 │  WRIST SENSOR          │            │  END-USER DEVICE                    │
 │  ACCESSORY (optional)  │  THE LINK  │  (the phone / EUD / laptop the      │
 │                        │──────────▶ │   responder already carries)        │──▶ trained
 │  RP2040 + MAX30102 raw │  NDJSON    │                                     │    responder
 │  PPG + BMP280 baro +   │  over the  │  app (Expo) + local LLM (Ollama)    │    decides
 │  LIS3DH accel          │  bridge    │  + vision/voice stubs               │
 │  emits NDJSON @ 10 Hz  │            │  decision support, fully offline    │
 └────────────────────────┘            └─────────────────────────────────────┘

                    ══════════ THE BRIDGE ══════════
                    NDJSON source → WebSocket server
                    (stand-in for the eventual short-range wireless link)
```

### Role by role

| Role | Shipping vision | Demo today | Status |
|---|---|---|---|
| **Wrist sensor accessory** (optional) | Custom PCB: RP2040 + MAX30102 + BMP280 + LIS3DH | Same firmware, run on a Pico *or* replayed by the bridge | 🟢 Firmware built & compile-verified; ⚠️ not yet run on hardware |
| **The link** | Wrist → device short-range wireless (BLE) | Node WebSocket server, `--source ∈ {serial,sim,file}` | 🟢 Works in `file` mode (verified end-to-end); `serial` stubbed pending hardware |
| **End-user device** | The responder's phone / EUD, running the app and a local LLM | **Laptop** running the app in a browser and Ollama | 🟢 Works — and note the demo device *is* an end-user device, which is the point |

The pack-compute question is not deferred, it is **closed** (2026-08-05, see
[`docs/POSITIONING.md`](docs/POSITIONING.md)): the end-user device is the
compute. No dedicated carried computer will be chosen or built.

*The earlier four-role topology (with a dedicated "pack brain") is in git
history and analyzed in `docs/POSITIONING.md`.*

## Data flow (the contract-first design)

```
sensors → firmware → NDJSON line → bridge → WebSocket → app → LLM prompt → spoken advice
```

The load-bearing idea: **one JSON line format is the contract between every stage**
(see [`DATA_FORMAT.md`](DATA_FORMAT.md)). Because the shape is identical whether a
line came from a real Pico, the browser simulator, or a replayed capture, any
producer can be swapped for any other **without touching the consumer**. That is
what lets us prove the whole pipeline today, hardware-free, and swap in the real
wrist unit later by changing one flag.

## The three data sources (same format, increasing realism)

1. **`simulator/index.html`** — a browser page with sliders. A standalone *visual
   demo* you open yourself. Not in the app's data path, and **no longer embedded
   in the site** (removed from the overview page 25 Jul 2026, along with the
   byte-identical copy that used to live at `site/simulator/`).
2. **The bridge's `sim`/`file` modes** — replays/generates NDJSON at 10 Hz for the
   hardware-free app demo. The honest goal: generate it from the firmware's *own*
   pure C math (`firmware/bmp280_compensation.c`, `firmware/fall_detection.c`) so
   the test stream is the shipping code, not a reimplementation.
3. **A real flashed Pico** — `--source=serial`. The truth. Gated on hardware.

## What is real vs. simulated (read this honestly)

| Claim | Real? |
|---|---|
| Firmware compiles against the real Pico SDK, zero warnings, valid `.uf2` | ✅ Verified |
| Firmware sensor math (BMP280 compensation, fall detection) is unit-tested | ✅ Verified (host tests pass) |
| PCB designed & routed (RP2040 + 3 sensors, KiCad) — source in [`hardware/`](hardware/) | ✅ Real design (not fabricated/assembled) |
| Firmware run on physical hardware / real sensors | ❌ Not yet |
| App → local LLM → spoken numbered advice | ✅ Works (Ollama) |
| Live sensor data actually driving the app | ✅ Verified 2026-07-22 (bridge replay → browser app; connection observed server-side) |
| Sensor readings influencing the LLM's advice | ✅ Verified 2026-07-22 (sensor-context injection; fall auto-trigger fired once per 30 s cooldown against live local Ollama) |
| BLE wrist→device link | ❌ Simulated by the wired bridge (on purpose) |
| Speech-to-text, wound vision | ❌ Stubs (`services/transcriptionService.ts`, `services/visionService.ts`) |
| Runs on a dedicated carried computer | ❌ Killed by design (2026-08-05) — the end-user device is the compute; a laptop is the end-user device in the demo |

See [`ROADMAP.md`](ROADMAP.md) for the sequence that turns the 🔜/❌ rows green.

## Phase 2 — Sensor-Aware LLM  ✅ BUILT (2026-07-22)

*How live wrist telemetry reaches the model's reasoning. This section was written
as a design proposal and **is now implemented** — the design below was followed,
so it doubles as the module's documentation:*

- `services/sensorContext.ts` builds the delimited block (16 committed tests).
- `services/fallTrigger.ts` implements the rising-edge auto-trigger (12 tests).
- Both are wired into `app/index.tsx`; the exact block sent is viewable in the UI.
- Run the tests with `npm test` (39 total, no dependencies — see `tests/README.md`).
- Verified against live local Ollama: `docs/session-reports/2026-07-22-phase2-sensor-aware-llm.md`.

### Where it plugs in today
`services/llmService.ts` makes one call to Ollama `/api/generate` with:
- a **system** prompt (`WILDERNESS_SYSTEM_PROMPT`) — persona + wilderness-medicine
  doctrine (PAS / ABCDE / WMS), ≤6 one-sentence steps, mandatory EVACUATION line;
- a **user** prompt — `SITUATION REPORT:\n<patientReport>\n\nGive … steps now:`.

(Note: the app *simulates* token streaming — the model is called with
`stream:false` and the full text is replayed word-by-word. Real token streaming is
a separate later task.)

The snapshot already exists in the UI: `useWristVitals()` runs at the top of
`app/index.tsx`, so the latest `WristVitals` is in hand at submit time — **no new
plumbing needed to obtain it.**

### The injection point (simplest honest version)
Attach the **latest vitals snapshot at the moment of submit**, into the **user**
prompt (not the system prompt), as a clearly-fenced context block:

```
CURRENT SENSOR READINGS (wrist unit, live):
  Altitude: 2.1 m (relative)     Temperature: 21.0 °C (ambient)
  Fall detected: YES
  [raw signal — NOT vitals] optical red: 10249  ir: 10398   accel: 2.62 g
```

Rules that keep it honest:
- **Gate on `ok`.** Omit any field whose sensor reported `ok:false`; write
  `unavailable`, never a fabricated number or a `0`.
- **Label raw as raw.** Optical red/ir and accel magnitude are raw counts, passed
  through labeled "NOT vitals."
- **Forbid derivation the firmware didn't do.** The system prompt must explicitly
  instruct the model: *do not infer heart rate, SpO2, or pulse from the raw optical
  counts — that computation is not performed.* Without this, a model will happily
  invent a BPM. This is the load-bearing honesty guardrail of Phase 2.
- **Altitude is relative** (fixed 101325 Pa sea-level ref, per `DATA_FORMAT.md`) and
  temperature is **ambient**, not body temperature — say both in the block.

### System-prompt amendment (how to reason about the readings)
Add a short interpretation guide to `WILDERNESS_SYSTEM_PROMPT`:
- **Altitude** → weigh altitude-illness risk (AMS / HACE / HAPE) as elevation and
  ascent rate rise.
- **Temperature (ambient)** → near/below freezing raises hypothermia / frostbite
  risk; high temp raises heat-illness risk.
- **Fall detected = YES** → treat as possible fall trauma: spinal precaution,
  head- and internal-injury vigilance — weighed against the user's own report.
- **Raw optical / accel** → context only; explicitly *not* a vital sign.

### Trigger model
- **On user submit:** attach the current snapshot (above). Zero extra cadence.
- **On a fresh `fall_detected` rising edge (optional — the demo moment):**
  auto-compose a submit ("possible fall detected — <snapshot>") so a fall
  *visibly changes the advice* with no typing. This satisfies Phase 2's DONE-WHEN.
- A periodic "every N seconds" re-query is **not** proposed — it burns model calls,
  and the readings only matter at decision time.

### DONE WHEN (per ROADMAP)
A fall event or an abnormal vital *visibly changes* the model's guidance, with the
raw-vs-derived and "no HR/SpO2" labels intact in the injected context.
