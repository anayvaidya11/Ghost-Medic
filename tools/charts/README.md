# Chart pipeline (`tools/charts/`)

Generates the three chart plates in `site/assets/charts/`. The rule that makes
them trustworthy: **the data comes from the shipping code, and this folder only
draws it.**

| Output | Data source |
|---|---|
| `fall-signature.svg` | `trace_driver.c`, which links the firmware's own `fall_detection.c`. The motion trace is synthetic; every flag decision is the real state machine. |
| `altitude-curve.svg` | Same driver, sweeping `bmp280_pressure_to_altitude()` from the firmware's own `bmp280_compensation.c`. |
| `debounce.svg` | `debounce_data.mjs`, which imports the app's real `services/fallTrigger.ts` and replays 60 s of the demo fall loop: 2 calls instead of 150. |

The intermediate CSVs are committed so the SVGs can be checked against their
data without rebuilding anything.

## Regenerating

```sh
cd tools/charts

# 1. data from the shipping C
gcc -Wall -Wextra -std=c11 -I../../firmware trace_driver.c \
    ../../firmware/fall_detection.c ../../firmware/bmp280_compensation.c \
    -lm -o trace_driver && ./trace_driver

# 2. data from the shipping TypeScript (Node >= 22.6)
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON debounce_data.mjs

# 3. draw (any venv with matplotlib; not a project dependency)
python3 -m venv /tmp/chartsenv && /tmp/chartsenv/bin/pip install matplotlib
/tmp/chartsenv/bin/python make_charts.py
```

matplotlib is a build-time tool on the developer machine only. Nothing in the
site or the app depends on it; the site ships static SVGs with text as paths,
so they render identically with no fonts installed.

Style notes: single green data series (`#55884D`, validated for lightness,
chroma and contrast against the site's paper surface), gray reference lines,
clay reserved for the one status mark (the fall flag). Transparent background
so the plate sits on the site's paper panel.
