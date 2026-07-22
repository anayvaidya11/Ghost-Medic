# Tests

Headless tests for the pure TypeScript modules — the ones that decide what the
language model is told about the sensors, and when it speaks up on its own.

```sh
npm test
```

**39 tests, no dependencies to install.** They use Node's built-in test runner
(`node:test`) and Node's built-in TypeScript support, so there is no framework,
no config, and no build step — the tests import the shipping `.ts` files
directly and run the same code the app runs.

| File | Module under test | Tests |
|---|---|---|
| `wristVitalsParser.test.mjs` | `services/wristVitalsParser.ts` — reads one line of wristband telemetry | 11 |
| `sensorContext.test.mjs` | `services/sensorContext.ts` — builds the sensor block sent to the model | 16 |
| `fallTrigger.test.mjs` | `services/fallTrigger.ts` — decides when a fall makes the app speak first | 12 |

**Requires Node 22.6 or newer** (Node's native TypeScript support). Node 24 is
what these were written and run against. On an older Node you will see a syntax
error on the first `import` of a `.ts` file — upgrade rather than adding a
transpiler.

## What these are actually guarding

Not coverage. Three specific ways this project could quietly start lying:

1. **A failed sensor becoming a number.** When a sensor drops out, its fields are
   *omitted* from the wire format (see `../DATA_FORMAT.md`) — not sent as zero.
   A parser that reads a missing field as `0` would print a confident, wrong
   reading at exactly the moment a sensor died, and the model would then reason
   about it. Several tests exist only to hold that line.

2. **Inventing vital signs.** The optical sensor produces raw light counts, and
   nothing in this project turns them into a heart rate. The tests assert both
   that the parsed data has no field to put one in, and that the text sent to the
   model always carries the instruction forbidding it.

3. **Asking the model forty questions about one stumble.** The wristband reports
   ten times a second and the demo replays on a loop, so a single fall produces a
   long run of identical "fall detected" readings. `fallTrigger` fires once per
   fall and then goes quiet; the tests replay the real sample capture to prove it.

The firmware's own C math has a separate, older suite — see `../firmware/tests/`.
