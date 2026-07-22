# Ghost Medic — Wrist-Unit PCB (hardware/)

KiCad **10.0.4** design for the Ghost Medic wrist-unit sensor hub — the custom
board referenced throughout the docs. This is the real design source, committed so
the "custom PCB" claim is backed by files you can open, not just a screenshot.

> ## ⚠️ Honest status
> This board is **designed and routed in KiCad — not fabricated, not assembled,
> and not bench-tested.** No copy of this PCB physically exists yet. The firmware
> (`../firmware/`) is separately compile-verified against the Pico SDK but has also
> **never been run on this board.** Treat this as a verified *design artifact*: a
> complete schematic + routed 2-layer layout, with pin assignments that match the
> firmware — not a manufactured product.

## What's here

| File | What it is |
|---|---|
| `ghostmedic-sensor-hub.kicad_sch` | Schematic (source of truth for the wiring) |
| `ghostmedic-sensor-hub.kicad_pcb` | Routed board layout (35 footprints, ~477 track segments) |
| `ghostmedic-sensor-hub.kicad_pro` | KiCad project file |
| `exports/ghostmedic-sensor-hub-schematic.pdf` | Schematic, exported for viewing without KiCad |
| `exports/ghostmedic-sensor-hub-3d-top.png` | 3D board render (KiCad 3D viewer, top) — the still fallback on the website |
| `exports/ghostmedic-sensor-hub.glb` | 3D board model for the website's interactive viewer |
| `exports/ghostmedic-sensor-hub-front-copper.svg` | Front copper layer as 2D artwork |

The `exports/` images are **generated from the source in this folder** — see
"Regenerating the images" below. They are the design's own tool output, not photos:
no physical board exists to photograph (see status above).

## The design

A single-board wrist unit: an RP2040 reading three I²C sensors, powered/programmed
over USB-C.

| Ref | Part | Role |
|---|---|---|
| U3 | RP2040 | MCU (bare-metal firmware, `../firmware/`) |
| U1 | W25Q128JVS | QSPI flash (firmware storage) |
| U2 | AMS1117-3.3 | 5 V (USB VBUS) → 3.3 V regulator |
| U4 | MAX30102 | **Raw optical (PPG) front-end — raw red/IR counts, not HR/SpO₂** |
| U6 | BMP280 | Barometric pressure / temperature → altitude |
| U5 | LIS3DH | 3-axis accelerometer → motion / fall detection |
| J1 | USB-C 2.0 (16P) | Power + data |
| Y1 | 12 MHz crystal | RP2040 clock |
| R6, R7 | 4.7 kΩ | I²C SDA/SCL pull-ups (shared bus) |
| SW1, SW2 | Push buttons | RUN / BOOT |
| D1 | LED | Status |

The three sensors share **one I²C bus** with a single pull-up pair (R6/R7) — the
same shared-bus topology described in `../README.md` and `../DATA_FORMAT.md`. The
MAX30102 label here matches the rest of the repo: it is a **raw optical front-end**,
and the firmware exposes raw red/IR counts, **not** a computed heart rate or SpO₂.

## Regenerating the exports

Everything in `exports/` is reproducible from the source in this folder with
KiCad 10.x. `kicad-cli` ships inside KiCad — on macOS it lives at
`/Applications/KiCad/KiCad.app/Contents/MacOS/kicad-cli`, which is not on `PATH`
by default:

```sh
KC=/Applications/KiCad/KiCad.app/Contents/MacOS/kicad-cli

# 1 — schematic PDF
$KC sch export pdf ghostmedic-sensor-hub.kicad_sch \
  -o exports/ghostmedic-sensor-hub-schematic.pdf

# 2 — still 3D render (the website's fallback when WebGL is unavailable)
$KC pcb render ghostmedic-sensor-hub.kicad_pcb \
  -o exports/ghostmedic-sensor-hub-3d-top.png --side top --quality high

# 3 — 3D model for the website's interactive viewer
$KC pcb export glb ghostmedic-sensor-hub.kicad_pcb \
  -o exports/ghostmedic-sensor-hub.glb --force \
  --include-silkscreen --include-soldermask

# 4 — front copper as 2D artwork (black on transparent)
$KC pcb export svg ghostmedic-sensor-hub.kicad_pcb \
  -o exports/ghostmedic-sensor-hub-front-copper.svg \
  --layers F.Cu,Edge.Cuts --mode-single --exclude-drawing-sheet \
  --fit-page-to-board --black-and-white
```

Then copy the four outputs into `../site/assets/`.

Or open `ghostmedic-sensor-hub.kicad_pro` in KiCad and use **View → 3D Viewer**.

### Notes on those choices, so they aren't silently re-litigated

- **GLB, not VRML or STEP.** `kicad-cli` can emit all three; GLB is binary glTF,
  which three.js loads natively via `GLTFLoader` with materials intact and no
  conversion step.
- **Silkscreen and soldermask only — no `--include-tracks/-pads/-zones`.** Adding
  those triples the file (1.8 MB → 6.1 MB) and quadruples the draw calls for
  geometry you cannot see: the soldermask renders opaque, so the copper is hidden
  in the 3D view exactly as it is on a real board. Export 4 above is how the
  routing is actually shown.
- **One model is missing.** The MAX30102's package (`Maxim_OLGA-14_3.3x5.6mm_P0.8mm`)
  has no STEP model in the standard library, so U4 has no body in the render and
  `kicad-cli` prints `File not found:` for it. The part is present in the
  schematic and routed on the board; only its 3D shape is absent. The website
  says so rather than substituting a stand-in shape.

## Where this sits in the project

Hardware is **not** on the current critical path — see `../ROADMAP.md` (the wired
bridge stands in for the board today, and PCB *fabrication* is explicitly deferred).
This folder exists so the design work is visible and verifiable now.
