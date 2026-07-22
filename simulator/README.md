# Ghost Medic — Wrist Unit Simulator

A single-file, self-contained web page that **simulates** the Ghost Medic wrist
sensor hub. Open `index.html` by double-clicking it — no server, no build step,
no internet, no dependencies.

## What this is (and is NOT)

- ✅ It **is** a demonstration of the Ghost Medic data pipeline. You drag three
  sliders, physically-plausible sensor values are computed, and a live JSON
  stream scrolls past — the exact same JSON shape the real firmware prints.
- ❌ It is **NOT** reading any real hardware. There are no sensors attached.
  Nothing here talks to a Pico. The values are generated in your browser.

The page says this loudly in its header, on purpose. This is a simulator standing
in for the wrist unit.

## Why it's still faithful

Every formula and threshold in the simulator is copied straight from the real
firmware in this repo, so the numbers behave the way the actual device would:

| What | Simulator source | Firmware source |
|---|---|---|
| Altitude → barometric pressure | inverse of the barometric formula | `firmware/bmp280.c` (`SEA_LEVEL_PA`, exponent `0.1903`, coeff `44330`) |
| Temperature | 15 °C at sea level, −6.5 °C per 1000 m | standard-atmosphere lapse rate |
| Fall detection | free-fall < 0.35 g **then** impact > 2.5 g within 400 ms | `firmware/lis3dh.c` (`FREEFALL_THRESHOLD_G`, `IMPACT_THRESHOLD_G`, `FALL_IMPACT_WINDOW_MS`) |
| Raw IR/RED counts | large baseline integers + small pulsing waveform | `firmware/max30102.c` (raw 18-bit FIFO counts, **not** a real HR algorithm) |
| Loop rate | 10 Hz (one JSON line per 100 ms) | `firmware/main.c` (`LOOP_PERIOD_MS`) |

The **"Simulate Fall"** button scripts the real two-phase signature the firmware
looks for — a brief near-0 g free-fall dip followed by a high-g impact spike —
and runs the *same* detection code the RP2040 runs. When both phases land inside
the 400 ms window, the page raises a **FALL DETECTED** alert, exactly as the
firmware would flip `"fall_detected":true`.

## The JSON is the contract

The stream emits one object per line, matching the firmware byte-for-byte in
field order and number precision:

```json
{"t_ms":1234,"max30102":{"ok":true,"red":10342,"ir":10501},"bmp280":{"ok":true,"temp_c":22.5,"press_pa":101010.2,"alt_m":25.7},"lis3dh":{"ok":true,"x_g":0.01,"y_g":-0.02,"z_g":0.99,"mag_g":0.99},"fall_detected":false}
```

Because the shape is identical, **a real wired Pico can replace this simulated
source with zero downstream changes.** Anything that consumes the stream — the
app, an LLM, a serial→WebSocket bridge — cannot tell whether the line came from
this page or from a physical wrist unit. That's the whole point: prove and demo
the pipeline now, swap in real hardware later without touching the consumer side.

## How to open it

Double-click `simulator/index.html`, or drag it into any modern browser
(Chrome, Safari, Firefox, Edge). It runs entirely offline.

## Controls

- **Altitude (0–4000 m)** — sets BMP280 pressure and temperature.
- **Motion / g-force (0–4 g)** — drives the accelerometer magnitude.
  **Simulate Fall** scripts the free-fall→impact sequence.
- **Exertion (0–100)** — drives an internal pulse model that shapes the raw
  IR/RED optical counts. The pulse rate itself is never displayed or emitted —
  the device outputs raw counts, not heart rate.
- **Temp offset (−40..+20 °C)** — shifts the emitted BMP280 temperature on top
  of the altitude lapse rate (cold-snap / heat demos).
- **Sensor failures** — per-sensor checkboxes emit `{"ok":false}` with numeric
  fields omitted (per `DATA_FORMAT.md`), to exercise the consumer's failure path.
- **Pause / Clear** — freeze the stream or wipe the log.
