# Ghost Medic — Architecture

*What the system is, what runs where, and exactly where the "real" line is.*

Ghost Medic is an **offline AI first-aid assistant prototype for the backcountry**: a person is
injured, alone, far from help, and has no signal. The system senses their body and
environment, reasons about it with a **local** language model, and gives spoken,
numbered first-aid guidance — with **no internet**.

## The one product (decided 2026-07-20)

The product is the **LLM wilderness assistant** (`app/` + `services/`). An earlier
deterministic TCCC/MARCH engine was archived to [`legacy/`](legacy/README.md); it
is not part of this architecture.

## System topology — what runs where

Four roles. In the **shipping vision** they are distinct devices; in the
**current demo** some collapse onto a laptop. Being explicit about this is the
whole point — it's how we stay honest about what's proven.

```
 ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
 │  BIOSENSOR /     │   │   WEARABLE       │   │    PACK BRAIN    │   │   INTERFACE      │
 │  WRIST UNIT      │   │   (sensor hub)   │   │   (compute)      │   │   (voice+screen) │
 │                  │   │                  │   │                  │   │                  │
 │  MAX30102  raw PPG   │  RP2040 / Pico   │   │  local LLM       │   │  React Native /  │
 │  BMP280    baro  │──▶│  reads I²C @10Hz │──▶│  (Ollama today)  │──▶│  Expo app        │
 │  LIS3DH    accel │   │  emits NDJSON    │   │  + vision/voice  │   │  speaks steps    │
 │  (custom PCB)    │   │  over USB serial │   │                  │   │                  │
 └──────────────────┘   └──────────────────┘   └──────────────────┘   └──────────────────┘
        │                        │                      │                       │
        └── on the PCB, these two are one board (the wrist unit) ──┘            │
                                 │                      │                       │
                    ══════════ THE BRIDGE ══════════    │                       │
                    NDJSON source → WebSocket server ────┴───────────────────────┘
                    (stand-in for the eventual wrist→pack BLE link)
```

### Role by role

| Role | Shipping vision | Demo today | Status |
|---|---|---|---|
| **Biosensor + wrist unit** | Custom PCB: RP2040 + MAX30102 + BMP280 + LIS3DH | Same firmware, run on a Pico *or* replayed by the bridge | 🟢 Firmware built & compile-verified; ⚠️ not yet run on hardware |
| **Pack brain (compute)** | Small efficient compute (e.g. Jetson Orin Nano / Pi 5) running a local LLM | **Laptop** running Ollama | 🟡 Works; not a dedicated device yet |
| **Interface** | Wrist/phone/tablet voice + screen | Expo app on a phone or simulator | 🟢 Works against local LLM |
| **The bridge** | Wrist → pack **BLE** link | Node WebSocket server, `--source ∈ {serial,sim,file}` | 🔴 Being built (the spine) |

**Do not rathole on the pack hardware now.** For every current goal, *laptop =
pack brain*. Picking real compute silicon is a productization question; document
it, defer it.

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

1. **`simulator/index.html`** — a browser page with sliders. Human-facing *visual
   demo* for the website. Not in the app's data path.
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
| PCB designed (RP2040 + 3 sensors, KiCad) | ✅ Real design |
| Firmware run on physical hardware / real sensors | ❌ Not yet |
| App → local LLM → spoken numbered advice | ✅ Works (Ollama) |
| Live sensor data actually driving the app | 🔜 Phase 1 (the bridge) |
| Vitals influencing the LLM's advice | 🔜 Phase 2 |
| BLE wrist→pack link | ❌ Simulated by the wired bridge (on purpose) |
| Speech-to-text, wound vision | ❌ Stubs (`services/transcriptionService.ts`, `services/visionService.ts`) |
| Dedicated "pack" compute device | ❌ Laptop stands in |

See [`ROADMAP.md`](ROADMAP.md) for the sequence that turns the 🔜/❌ rows green.
