# Ghost Medic — Sensor Bridge

> ## ⚠️ What this is, stated honestly
> This bridge is a **wired, local WebSocket stand-in for the eventual
> wrist→pack _BLE_ link.** It is **not** BLE. It is **not** wireless. Nothing in
> this folder has run on physical hardware. It exists so the rest of the system
> (simulator → app → LLM) can be built and demonstrated **today, hardware-free**,
> and so that swapping in a real flashed Pico later changes only the data
> *source*, not the app. Do not read "bridge" as "the radio link works."

## What it does

A **dumb pipe.** It reads NDJSON telemetry lines from a *source* and forwards
each line **unchanged** to every connected *consumer* (the app, or a test client)
over a WebSocket.

```
  producers                         BRIDGE (this program)                 consumers
  ─────────                         ─────────────────────                 ─────────
  simulator ──ws /sim-input──▶   ┌────────────────────────┐   ──ws /stream──▶  app
  file replay ──────────────▶    │  drop lines w/o "t_ms"  │   ──ws /stream──▶  test-client
  serial (later) ───────────▶    │  forward the rest AS-IS │
                                 └────────────────────────┘
```

The bridge performs exactly **one** transformation, per
[`../DATA_FORMAT.md`](../DATA_FORMAT.md): it **drops any line that lacks a
`t_ms` field** (this silently drops the firmware's one-time boot line, and any
blank/garbage line). It does **not** parse-and-rebuild, reshape, or validate any
other field. Lines that pass the filter are forwarded byte-for-byte as received.

## Install

```sh
cd bridge
npm install        # installs 'ws' only
```

`serialport` is intentionally **not** a dependency yet — it will be added only
when `--source=serial` is actually implemented, to keep the dependency list
honest about what works.

## Run

**File mode** — replay captured lines at ~10 Hz (no browser, fully deterministic):

```sh
node bridge.js --source=file --file=sample.ndjson
```

**Sim mode** — accept live lines pushed by the browser simulator:

```sh
node bridge.js --source=sim
# then open ../simulator/index.html?bridge=1 in a browser and press Start
```

> The `?bridge=1` is required: the simulator only connects to the bridge when
> that flag is present. Opened plainly (no flag) it stays fully standalone and
> makes no network calls — so it never errors when the bridge isn't running.

**Serial mode** — reserved, not implemented:

```sh
node bridge.js --source=serial   # exits with a clear "not implemented" message
```

Options: `--port=8080` (default), `--hz=10` (file replay rate), `--loop`
(file mode only — replay the file from the top forever, for continuous app
testing without hardware; without it, file mode stops after one pass).

## Endpoints

| Path | Who connects | Direction |
|---|---|---|
| `ws://localhost:8080/stream` | the app / `test-client.js` | bridge → consumer (receive lines) |
| `ws://localhost:8080/sim-input` | the simulator | producer → bridge (push lines) |

## Test it (hardware-free)

Terminal 1:

```sh
node bridge.js --source=file --file=sample.ndjson
```

Terminal 2:

```sh
node test-client.js
```

`sample.ndjson` contains 5 non-empty lines: **1 boot line (no `t_ms`)** and
**4 data lines**. The test client should therefore receive **4** lines — proving
the boot line was dropped and everything else forwarded unchanged.

## Adding real hardware later (the seam)

`--source=serial` is stubbed on purpose. When a real Pico is flashed
(Phase 3 in [`../ROADMAP.md`](../ROADMAP.md)), implementing it means: open the
serial port, read newline-delimited lines, and call the **same** internal
`forward()` path that file and sim modes use. No consumer-side change, no
restructuring — that is the whole point of the producer/consumer split.
