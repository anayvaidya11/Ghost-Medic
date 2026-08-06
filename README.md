# Archiater

*A **Wyzantium Industries** project. Formerly Ghost Medic; renamed 2026-08-05.*

**Offline decision-support software for the trained responder, running on the
device they already carry, with an optional wrist sensor accessory streaming
raw signals into it.** A local language model reasons about the patient, the
environment, and what the responder says, and speaks numbered candidate
actions. The responder on scene decides. No network, ever.

It is built for the places where help is hours away and there is no signal —
which is precisely where every other assistant stops working, because they all
assume a network. The gap it aims at sits between a satellite messenger, which
can reach help but cannot tell you what to do, and a printed
wilderness-medicine manual, which knows what to do but cannot see your
situation. (Why the product is software-first, and what that decision killed:
[`docs/POSITIONING.md`](docs/POSITIONING.md).)

The full system: 

```
  ┌───────────────────────┐                 ┌─────────────────────────────────┐
  │  1. WRIST SENSOR      │    JSON over    │  2. END-USER DEVICE             │
  │  ACCESSORY (optional) │ ── USB serial ─▶│  the responder's phone / laptop │──▶ responder
  │  RP2040 hub,          │   (raw signal + │  local LLM + voice + screen app │    decides
  │  3 sensors            │    environment) │  (React Native / Expo, Ollama)  │
  └───────────────────────┘                 └─────────────────────────────────┘
     firmware/                                 services/ + app/ (this repo)
```

## The parts

### 1. Wrist sensor accessory — optional hub  → [`firmware/`](firmware/)
A **Raspberry Pi Pico / RP2040** reading three I²C sensors on a shared bus:

| Sensor   | Role                                   |
|----------|----------------------------------------|
| MAX30102 | Raw optical (PPG) front-end — raw red/IR counts, **not** HR/SpO₂ |
| BMP280   | Barometric pressure → altitude         |
| LIS3DH   | Accelerometer → motion / fall detection |

It samples at 10 Hz and streams one JSON object per line over USB serial. The
firmware is bare-metal C written against the Raspberry Pi Pico SDK. See
[`firmware/README.md`](firmware/README.md) for the driver details and, importantly,
the **honest validation status** (summarized below).

>  The firmware is **written and
> compile-tested against the real Raspberry Pi Pico SDK** It has
> **NOT yet been flashed or run on physical hardware**, and its readings have not
> been checked against real sensors. The drivers were transcribed carefully from
> the MAX30102, BMP280, LIS3DH datasheets, but transcription and timing bugs can
> only be caught on a bench, which hasn't happened yet. Treat it as a
> compile-verified design artifact. Full detail and
> the reasoning (including why no simulator run) is in
> [`firmware/README.md`](firmware/README.md).

### 2. The end-user device — app + local LLM  → [`services/`](services/)
The responder's own phone, EUD, or laptop, running a **local, off-the-shelf**
language model that consumes the sensor stream plus the responder's input and
produces decision support — all offline.

**This works today** (verified 2026-07-22): the app sends its prompt plus a
sensor-context block to `llama3.2:3b` running under Ollama on the same machine,
and the sensor state measurably changes the guidance — a fall flag adds head,
neck and spine assessment that the same question without it does not produce.
Evidence: [`docs/session-reports/2026-07-22-phase2-sensor-aware-llm.md`](docs/session-reports/2026-07-22-phase2-sensor-aware-llm.md).

**No dedicated compute unit will be built.** The end-user device is the
compute (decision 2026-08-05, [`docs/POSITIONING.md`](docs/POSITIONING.md)).
A laptop stands in for that device in the demo — and a laptop *is* an
end-user device, which is the point.

### 3. Interface — voice + screen app  → repo root (this repo)
The **React Native / Expo** app is the voice and screen surface the user actually
interacts with. It lives directly at the repository root rather than in a single
subfolder:

| Path                | What's there                         |
|---------------------|--------------------------------------|
| [`app/`](app/)      | expo-router app — entry (`_layout.tsx`) + the UI (`index.tsx`) |
| [`services/`](services/) | LLM plumbing + forward-looking sensor/vision stubs |
| [`training/`](training/) | Fine-tuning pipeline — see [`training/README.md`](training/README.md) |

## Start here (project docs)

| Doc | What it's for |
|---|---|
| [`ROADMAP.md`](ROADMAP.md) | **Read first.** Phased plan + what's done vs. next. |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | System topology, what runs where, real-vs-simulated table. |
| [`DATA_FORMAT.md`](DATA_FORMAT.md) | The NDJSON wire contract between firmware, bridge, and app. |
| [`docs/POSITIONING.md`](docs/POSITIONING.md) | Why the product was repositioned 2026-08-05. Read this to understand the current framing. |

## Repository layout

```
Archiater/
├── README.md            ← you are here (whole-system overview)
├── ROADMAP.md · ARCHITECTURE.md · DATA_FORMAT.md   ← project memory
├── firmware/            ← 1. wrist sensor accessory — RP2040 hub (Pico SDK C)
│   └── README.md          firmware detail + validation status
├── simulator/           ← browser demo emitting firmware-format JSON (hardware-free)
├── app/                 ← 3. interface — React Native / Expo app (the entry)
├── services/            ← LLM + sensor/vision service layer
├── training/            ← wilderness-medicine fine-tuning pipeline
├── legacy/              ← archived deterministic TCCC app (not the product)
├── app.json, package.json, tsconfig.json, babel.config.js
└── ...
```

The **product is the offline decision-support software** (`app/` + `services/`). An earlier
deterministic TCCC/MARCH engine lives in [`legacy/`](legacy/README.md) — archived,
not deleted, and not imported by anything shipping.

## Data flow, in one sentence

The wrist accessory emits JSON sensor lines over USB serial → a serial→WebSocket
bridge forwards them to the app → the app pairs them with the responder's voice
input and the local LLM's reasoning to give offline decision support.
