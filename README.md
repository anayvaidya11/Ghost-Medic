# Ghost Medic

An **offline-first wilderness survival assistant**. Ghost Medic reads your body
and your environment from a wrist-worn sensor unit, reasons about them with a
**local** language model (no internet required), and talks to you through a
voice + screen interface. It's built for places with no signal and no second
chances — where a cloud API is not an option.

The full system is three physical parts that hand data up a chain:

```
  ┌─────────────────┐      JSON over        ┌──────────────────┐      voice /      ┌──────────────────┐
  │  1. WRIST UNIT  │  ── USB serial ──▶     │  2. PACK BRAIN   │  ── on-screen ──▶ │  3. INTERFACE    │
  │  RP2040 sensor  │   (biodata +           │  local LLM       │    prompts        │  React Native    │
  │  hub, 3 sensors │    environment)        │  (off-the-shelf) │                   │  voice + screen  │
  └─────────────────┘                        └──────────────────┘                   └──────────────────┘
     firmware/                                  concept-level                          this repo root
```

## The three parts

### 1. Wrist unit — sensor hub  → [`firmware/`](firmware/)
A **Raspberry Pi Pico / RP2040** reading three I²C sensors on a shared bus:

| Sensor   | Role                                   |
|----------|----------------------------------------|
| MAX30102 | Heart rate / SpO₂ optical front-end (raw counts) |
| BMP280   | Barometric pressure → altitude         |
| LIS3DH   | Accelerometer → motion / fall detection |

It samples at 10 Hz and streams one JSON object per line over USB serial. The
firmware is bare-metal C written against the Raspberry Pi Pico SDK. See
[`firmware/README.md`](firmware/README.md) for the driver details and, importantly,
the **honest validation status** (summarized below).

> ⚠️ **Hardware status — read this honestly.** The firmware is **written and
> compile-tested against the real Raspberry Pi Pico SDK** — it builds clean with
> zero warnings and produces a valid, flashable `ghost_medic_firmware.uf2`. It has
> **NOT yet been flashed or run on physical hardware**, and its readings have not
> been checked against real sensors. The drivers were transcribed carefully from
> the MAX30102 / BMP280 / LIS3DH datasheets, but transcription and timing bugs can
> only be caught on a bench, which hasn't happened yet. Treat it as a
> compile-verified design artifact, not a hardware-proven device. Full detail and
> the reasoning (including why no simulator run) is in
> [`firmware/README.md`](firmware/README.md).

The checked-in `.uf2` is kept on purpose as proof the firmware compiles.

### 2. Pack brain — local LLM (concept-level)
A compute unit running a **local, off-the-shelf** language model that consumes the
sensor stream plus the user's spoken input and produces survival guidance — all
offline. This part is conceptual in this repo; the app's LLM plumbing lives in
[`services/`](services/).

### 3. Interface — voice + screen app  → repo root (this repo)
The **React Native / Expo** app is the voice and screen surface the user actually
interacts with. It lives directly at the repository root rather than in a single
subfolder:

| Path                | What's there                         |
|---------------------|--------------------------------------|
| [`App.js`](App.js)  | App entry point                      |
| [`app/`](app/)      | expo-router screens (`_layout.tsx`, `index.tsx`) |
| [`src/`](src/)      | App source                           |
| [`services/`](services/) | LLM config and service plumbing |
| [`training/`](training/) | Training assets — see [`training/README.md`](training/README.md) |

## Repository layout

```
Ghost-Medic/
├── README.md            ← you are here (whole-system overview)
├── firmware/            ← 1. wrist unit — RP2040 sensor hub (Pico SDK C)
│   └── README.md          firmware detail + validation status
├── App.js, app/, src/,  ← 3. interface — React Native / Expo app
│   services/, training/
├── app.json, package.json, tsconfig.json, babel.config.js
└── ...
```

## Data flow, in one sentence

The wrist unit emits JSON sensor lines over USB serial → a serial→WebSocket bridge
forwards them to the app → the app pairs them with the user's voice input and the
local LLM's reasoning to give offline survival guidance.
