# Ghost Medic — host-side firmware tests

These are **unit tests for the sensor math**, and they run on your laptop with a
normal C compiler (`gcc`). **No Raspberry Pi Pico, no sensors, no wiring** are
needed to run them.

## How to run them

From this folder:

```sh
make
```

That compiles two small test programs and runs them. You'll see a `PASS`/`FAIL`
line for each check and a summary. `make` exits non-zero if anything fails.

To just build without running: `make build`. To clean up: `make clean`.

Under the hood each test is a plain C program with its own `main()`, compiled
with:

```
gcc -Wall -Wextra -std=c11 -I.. <the pure module>.c <the test>.c -lm
```

## Why this is possible without hardware (the design point)

The firmware was refactored so the **pure math** is separated from the
**hardware I/O**:

- `../bmp280_compensation.c` — the BMP280 temperature/pressure/altitude
  formulas. No I2C, no SDK headers.
- `../fall_detection.c` — the free-fall→impact fall-detection state machine.
  No I2C, no SDK headers.

The real drivers (`../bmp280.c`, `../lis3dh.c`) still do all the I2C reads and
byte-unpacking, then call these exact functions. Because the driver and the
tests call the **same** code, a passing test is real evidence about the code
that actually ships to the Pico — not a separate reimplementation.

## What these tests PROVE

- **BMP280:** the compensation formulas are transcribed correctly. We feed the
  Bosch datasheet worked-example calibration + raw ADC values and confirm we
  get ~25.08 °C and ~100653 Pa. We also sanity-check the altitude helper
  (sea-level pressure → ~0 m; ~89875 Pa → ~1000 m; lower pressure always reads
  as higher altitude).
- **Fall detection:** the logic flags a real fall (free-fall then impact within
  400 ms), and correctly ignores (a) a bare jolt with no preceding free-fall
  and (b) an impact that arrives after the 400 ms window has closed.

## What these tests do NOT prove

- That a real BMP280 or LIS3DH is wired up and responding.
- That a real sensor returns these particular raw values, or is calibrated as
  assumed.
- That the fall thresholds are well-tuned for an actual human wrist — they're
  reasonable textbook starting points, not values validated against labelled
  fall data.

**All of that still requires a bench test on a wired Pico.** These host tests
check the *math and logic*; they are a fast, hardware-free first line of
defense, not a substitute for real-hardware validation.

## A caveat on the BMP280 reference numbers

The calibration constants and expected outputs in `test_bmp280.c` are the
well-known BMP280 worked example. Before calling them "datasheet-verified,"
double-check them against your actual Bosch **BST-BMP280-DS001** datasheet PDF
(section 3.11.3 / 8.1). There's a comment in the test saying exactly this.
