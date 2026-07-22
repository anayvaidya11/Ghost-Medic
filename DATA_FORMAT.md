# Ghost Medic — Sensor Data Format (the contract)

This is the **wire contract** between the wrist unit (producer) and everything
downstream — the bridge, the app, the LLM. It is defined by the firmware in
[`firmware/main.c`](firmware/main.c); this document just writes it down so the
bridge and app can be built against it without reading C.

**If you change this format, change it in `firmware/main.c` first**, then here,
then the consumers. The firmware is the source of truth.

## Transport

- **NDJSON** — newline-delimited JSON. **One complete JSON object per line**, `\n`
  terminated. No pretty-printing, no multi-line objects.
- Emitted over **USB CDC serial** from a real Pico, at **10 Hz** (one line every
  ~100 ms; `LOOP_PERIOD_MS` in firmware).
- The bridge re-broadcasts each line **unchanged** over a WebSocket. It does not
  reshape, only forwards (and filters — see the boot line below).

## Two line types

### 1. Boot line (emitted once, at startup)

```json
{"boot":true,"max30102_init":true,"bmp280_init":true,"lis3dh_init":false}
```

- Printed once after init. Reports which sensors came up.
- **Has no `t_ms` field.** The bridge's rule — *drop any line without `t_ms`* —
  filters this out automatically, so consumers only ever see data lines. (Keep it
  in raw logs; it's useful for debugging a dead sensor.)

### 2. Data line (emitted every ~100 ms)

```json
{"t_ms":1234,"max30102":{"ok":true,"red":10342,"ir":10501},"bmp280":{"ok":true,"temp_c":22.5,"press_pa":101010.2,"alt_m":25.7},"lis3dh":{"ok":true,"x_g":0.01,"y_g":-0.02,"z_g":0.99,"mag_g":0.99},"fall_detected":false}
```

## Field reference

| Field | Type | Unit / meaning | Precision |
|---|---|---|---|
| `t_ms` | integer | milliseconds since boot (monotonic) | — |
| `max30102.ok` | bool | did this sensor read this tick | — |
| `max30102.red` | integer | raw RED optical FIFO count (18-bit range). **Raw counts, not HR.** | — |
| `max30102.ir` | integer | raw IR optical FIFO count | — |
| `bmp280.ok` | bool | — | — |
| `bmp280.temp_c` | float | temperature, °C | 2 dp |
| `bmp280.press_pa` | float | barometric pressure, pascals | 1 dp |
| `bmp280.alt_m` | float | altitude vs. fixed 101325 Pa sea-level ref. **Good for *relative* change, not survey-grade absolute.** | 1 dp |
| `lis3dh.ok` | bool | — | — |
| `lis3dh.x_g` / `y_g` / `z_g` | float | per-axis acceleration, g | 3 dp |
| `lis3dh.mag_g` | float | vector magnitude √(x²+y²+z²), g (~1.0 at rest) | 3 dp |
| `fall_detected` | bool | free-fall→impact signature seen. **Illustrative heuristic, not medical-grade.** | — |

**Producer invariant:** `fall_detected` is derived solely from the accelerometer,
so the firmware only computes it on a valid LIS3DH read (`firmware/main.c`). When
`lis3dh.ok` is `false`, `fall_detected` is always `false` — never a stale or
carried-over `true`. It is a top-level field rather than a member of the `lis3dh`
block because it is a *conclusion* about the readings, not a reading.

## ⚠️ The one parser gotcha: fields are OMITTED when a sensor fails

When a sensor's `ok` is `false`, its numeric fields are **not present at all**
(they are omitted, **not** set to `null` or `0`):

```json
{"t_ms":1500,"max30102":{"ok":false},"bmp280":{"ok":true,"temp_c":22.5,"press_pa":101010.2,"alt_m":25.7},"lis3dh":{"ok":true,"x_g":0.01,"y_g":-0.02,"z_g":0.99,"mag_g":0.99},"fall_detected":false}
```

Consumers must check `ok` before reading values, and treat missing fields as "no
reading this tick" — never as zero. One dead sensor must not take down the stream.

## Consumer checklist (app / bridge)

- Split the stream on `\n`; parse each line independently. A partial trailing line
  (no newline yet) must be buffered, not parsed.
- Ignore lines that don't parse as JSON, and lines without `t_ms`.
- Gate every numeric read behind its `ok` flag.
- Don't assume a fixed cadence for logic — use `t_ms` deltas (the 10 Hz is nominal).

## Reference lines for testing

```
{"boot":true,"max30102_init":true,"bmp280_init":true,"lis3dh_init":true}
{"t_ms":100,"max30102":{"ok":true,"red":10240,"ir":10390},"bmp280":{"ok":true,"temp_c":21.0,"press_pa":101325.0,"alt_m":0.0},"lis3dh":{"ok":true,"x_g":0.00,"y_g":0.00,"z_g":1.00,"mag_g":1.00},"fall_detected":false}
{"t_ms":200,"max30102":{"ok":true,"red":10251,"ir":10402},"bmp280":{"ok":true,"temp_c":21.0,"press_pa":101300.2,"alt_m":2.1},"lis3dh":{"ok":true,"x_g":0.02,"y_g":-0.01,"z_g":0.03,"mag_g":0.04},"fall_detected":false}
{"t_ms":300,"max30102":{"ok":true,"red":10249,"ir":10398},"bmp280":{"ok":true,"temp_c":21.0,"press_pa":101300.2,"alt_m":2.1},"lis3dh":{"ok":true,"x_g":1.80,"y_g":1.50,"z_g":1.20,"mag_g":2.62},"fall_detected":true}
```

(Line at `t_ms:200` shows near-0 g free-fall; `t_ms:300` shows the high-g impact
that flips `fall_detected` — the two-phase signature the firmware looks for.)
