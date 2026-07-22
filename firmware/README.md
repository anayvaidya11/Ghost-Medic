# Ghost Medic — Sensor Hub Firmware (RP2040 / Raspberry Pi Pico)

Bare-metal C firmware for a Raspberry Pi Pico that reads three I²C sensors and
streams their data as JSON lines over USB serial. Part of the **Ghost Medic**
project — an offline-first wilderness survival assistant. This firmware is the
"sensor hub" data source: it produces the biodata/environment stream that a
downstream host (and ultimately a local LLM) consumes.

## ⚠️ Validation status — read this first

This is a **portfolio / design artifact**. Be clear on exactly what has and has
not been verified:

| Claim | Status |
|-------|--------|
| Compiles against the real Raspberry Pi Pico SDK (C, `hardware/i2c.h`) | ✅ **Verified** — builds clean |
| Builds with **zero warnings** under `-Wall -Wextra` at `-O3` | ✅ **Verified** |
| Produces a flashable `ghost_medic_firmware.uf2` | ✅ **Verified** (valid UF2 output) |
| Drivers written directly against the MAX30102 / BMP280 / LIS3DH datasheets | ✅ True |
| **Flashed and run on physical hardware** | ❌ **NOT done** |
| **Verified against real sensors** (correct readings, timing, FIFO behavior) | ❌ **NOT done** |
| Run in the Wokwi RP2040 simulator | ❌ Not done — see below |

**In plain terms:** the code is proven to be well-formed, idiomatic Pico SDK C
that the compiler and linker accept and turn into a real firmware image. It is
**not** proven to behave correctly on a bench. Register addresses, config bit
patterns, and the Bosch compensation math were transcribed carefully from the
datasheets, but transcription errors, timing issues, and datasheet
misreadings can only be caught with hardware (a Pico + the three breakout
modules), which has not yet been done. Nothing here should be read as
hardware-validated.

### Why no Wokwi run?

The plan allowed ~30 minutes attempting a Wokwi RP2040 C-SDK simulation. This
was **not pursued**, for an honest reason: Wokwi's RP2040 sim does not cleanly
model these three specific parts (the MAX30102 optical front-end, the BMP280's
per-chip NVM calibration block, and the LIS3DH). Wiring up custom chip stubs
would have been simulator-plumbing work that validates the *stub*, not the
*driver* — it would produce a green checkmark that means nothing. The compile
verification above is a more truthful signal than a faked-sensor sim would be.
The right next validation step is real hardware, not a simulator.

## What it does

On boot it initializes I²C and all three sensors, then loops at 10 Hz. Each
tick it reads every sensor and prints one JSON object per line over USB serial,
for example:

```json
{"t_ms":1234,"max30102":{"ok":true,"red":10342,"ir":10501},"bmp280":{"ok":true,"temp_c":22.5,"press_pa":101010.2,"alt_m":25.7},"lis3dh":{"ok":true,"x_g":0.01,"y_g":-0.02,"z_g":0.99,"mag_g":0.99},"fall_detected":false}
```

If a sensor fails to initialize, the loop still runs and that sensor's object
reports `"ok":false` — one dead sensor doesn't take down the stream.

## Sensors

| Sensor   | Role                         | I²C addr | Notes |
|----------|------------------------------|----------|-------|
| MAX30102 | Raw optical (PPG) front-end  | `0x57`   | Fixed address. Driver reads **raw RED/IR FIFO counts only** — no HR/SpO₂ algorithm (out of scope). |
| BMP280   | Barometric pressure → altitude | `0x76` | SDO→GND. Reads factory calibration, applies Bosch compensation formulas. |
| LIS3DH   | Accelerometer / fall detection | `0x18` | SDO→GND. Includes an **illustrative** free-fall→impact heuristic (see below). |

Pin assignment (SDA = GPIO4, SCL = GPIO5) intentionally matches the custom
Ghost Medic PCB so breadboard and board firmware are identical.

### Note on fall detection

`lis3dh_update_fall_detection()` implements the commonly-taught two-phase
pattern: a free-fall dip (total acceleration ≈ 0 g) followed within a short
window by a high-g impact spike. **It is a demonstration heuristic with
untuned textbook thresholds, not a validated or medical-grade algorithm.** A
real detector would use windowed signal features validated against labelled
fall data. It's included to show the data being *used*, and is labelled as
illustrative in the source.

### Note on altitude

Altitude uses the international barometric formula against a **fixed** sea-level
reference of 101325 Pa. Real absolute altitude needs the *local* sea-level
pressure (which drifts with weather), so treat the altitude figure as good for
*relative* changes, not survey-grade absolute elevation.

## I²C speed

The bus runs at **400 kHz (fast mode)**. All three parts support it, and short
breadboard wiring has no signal-integrity reason to run slower; the higher rate
leaves time headroom to service three devices inside each 100 ms tick. If long
or noisy wiring causes read failures, drop `I2C_BAUD` in `main.c` to `100000`.

## Files

```
i2c_helpers.h   Shared I²C read/write register helpers (Pico SDK wrappers)
max30102.c/.h   MAX30102 driver — raw RED/IR FIFO read
bmp280.c/.h     BMP280 driver — calibration + Bosch compensation + altitude
lis3dh.c/.h     LIS3DH driver — XYZ read + fall-detection heuristic
main.c          Bus + sensor init, 10 Hz read loop, JSON serial output
CMakeLists.txt  Standard Pico SDK build
```

Each driver exposes an `init()` and a `read()` returning a clean struct, and
keeps its register addresses and config constants named and commented against
the datasheet field they represent (not bare hex).

## Building

Requires the Raspberry Pi Pico SDK and an ARM cross toolchain
(`gcc-arm-none-eabi`, `cmake`). Copy `pico_sdk_import.cmake` from the SDK's
`external/` directory next to `CMakeLists.txt` (or set `PICO_SDK_PATH`).

```bash
mkdir build && cd build
cmake -DPICO_SDK_PATH=/path/to/pico-sdk ..
make
```

This produces `ghost_medic_firmware.uf2`. To flash: hold **BOOTSEL** while
plugging in the Pico, then drag the `.uf2` onto the `RPI-RP2` drive that
appears.

### Build environment this was verified in

- ARM GNU toolchain `arm-none-eabi-gcc` 13.2
- CMake 3.28
- Raspberry Pi Pico SDK (cloned from upstream `master`), TinyUSB submodule
- Target board: default `pico` (RP2040), stdio routed over USB CDC

Result: clean compile and link of all four source files, zero warnings under
`-Wall -Wextra`, valid UF2 generated.

## Consuming the output (downstream)

`stdio` is routed over **USB CDC serial** (not the UART pins). On a host, the
Pico appears as a serial device (`/dev/ttyACM0`, `/dev/tty.usbmodem…`, or a
`COM` port). Each line is a complete JSON object. In the Ghost Medic system a
small serial→WebSocket bridge forwards these lines to the React Native app —
the wired stand-in for the eventual wrist→pack BLE link (the Pico has no radio).

## Known limitations / honest TODO

- Not run on hardware; no reading has been checked against a reference.
- MAX30102 reads one sample per tick rather than draining the full FIFO — fine
  for a demo stream, insufficient for real PPG signal processing.
- No HR/SpO₂ computation (raw counts only).
- Fall-detection thresholds are untuned placeholders.
- No I²C error recovery/retry beyond per-read `ok:false` reporting.
- Altitude uses a fixed sea-level reference.
