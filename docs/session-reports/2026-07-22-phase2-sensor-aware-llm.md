# Session report — Phase 2: sensor-aware LLM, verified live (2026-07-22)

Persistent evidence record for the claims on the proof website (`site/`) and in
`ARCHITECTURE.md`'s real-vs-simulated table. Everything below is recorded output
from real runs on the dev laptop, reproduced verbatim.

## What was verified

1. **Sensor context reaches the model and changes its guidance** — four seeded
   calls to local Ollama (`llama3.2:3b`) using the app's exact prompt
   construction (system prompt extracted from `services/llmService.ts`, sensor
   blocks built by the compiled `services/sensorContext.ts` from real
   `bridge/sample.ndjson` lines). Transcript below.
2. **The live browser app auto-triggers on a fall, debounced** — with the bridge
   replaying `sample.ndjson` (a fall event every ~0.5 s loop) into the running
   Expo web app, Ollama's request log shows **one** `/api/generate` call at the
   first fall and **one** more ~30 s later (cooldown expiry) — not one per
   replayed fall line. Log excerpt below.

Note on seeding: the four-call transcript used `seed:7, temperature:0.3` for a
reproducible comparison. That is proof-harness-only — the app itself sets no
sampling options.

## Live-run evidence (browser app → bridge → Ollama)

Bridge log (browser connected as the `/stream` consumer):

```
[bridge] file source: .../sample.ndjson
[bridge] 5 non-empty line(s); 4 have t_ms, 1 lack t_ms (will be dropped)
[bridge] mode: LOOP (replay forever)
[bridge] consumer connected (/stream). total=1
[bridge] consumer present — replaying 5 line(s) at 10 Hz (looping)
```

Ollama request log during the replay (~60 fall events replayed in the window;
exactly two requests, 30 s apart — the rising-edge + cooldown debounce, live):

```
[GIN] 2026/07/22 - 00:20:39 | 200 | 12.038309125s | 127.0.0.1 | POST "/api/generate"
[GIN] 2026/07/22 - 00:21:02 | 200 |  4.889348375s | 127.0.0.1 | POST "/api/generate"
```

## The four-case transcript (seeded, model llama3.2:3b, local)

### Case 1 — user report "I feel a bit dizzy," NO-FALL sensor context

Sensor block sent:

```
[SENSOR CONTEXT — wrist unit telemetry — BEGIN]
Snapshot taken at device uptime 100 ms. Readings are supplementary;
if they conflict with what the user reports, the user's report wins.

DERIVED READINGS:
- Altitude: 0.0 m (pressure-derived vs a fixed 101325 Pa sea-level reference; reliable for RELATIVE change only — NOT GPS or true elevation)
- Temperature: 21.0 °C (AMBIENT air at the device — NOT body temperature)
- Fall detected: no (accelerometer free-fall→impact heuristic, not medical-grade)

RAW SIGNALS (non-diagnostic):
- Optical counts: red 10240, ir 10390. These are raw photodiode counts from the optical sensor. No pulse-extraction algorithm runs on this device: heart rate and blood-oxygen saturation (SpO2) are NOT available and must not be inferred from these numbers.
- Acceleration magnitude: 1.00 g (raw)
[SENSOR CONTEXT — END]
```

Response (verbatim):

```
**IMMEDIATE ACTION REQUIRED**

Since the user reports feeling dizzy, it's essential to assess their condition and take action to ensure their safety.

1. **Find a safe place to sit or lie down**: Immediately move to a flat surface where you can sit or lie down without any obstacles.
2. **Remove any constrictive items**: Take off any tight clothing, watches, or jewelry that may be causing discomfort or restricting blood flow.
3. **Loosen tight clothing around the neck and chest**: If the user is wearing a backpack or other gear that's too tight, help them loosen it to improve circulation.
4. **Elevate your legs (if possible)**: If you're sitting, try to elevate your legs 12-18 inches above the level of your heart to reduce swelling and promote blood flow.
5. **Stay calm and reassure yourself**: Take slow, deep breaths and focus on staying calm. Try to relax and conserve energy.

**EVACUATION LINE:** Call for help now. If you have a phone or two-way radio with you, call emergency services or contact a trusted friend or family member to let them know your situation.
```

### Case 2 — same user report, FALL-DETECTED sensor context

Sensor block: as Case 1 but `t_ms 300`, `Altitude: 2.1 m`, `Fall detected: YES`,
`Acceleration magnitude: 2.62 g`, optical red 10249 / ir 10398.

Response (verbatim):

```
**IMMEDIATE ACTION REQUIRED**

1. Find a safe place to sit or lie down, away from any hazards or obstacles that could cause further injury.
2. Remove your backpack or any other gear that may be constricting your neck or head.
3. Check yourself for injuries, especially to the head, neck, and spine. If you have any visible wounds or signs of trauma, get help as soon as possible.
4. Take slow, deep breaths and try to relax. Dizziness can be caused by dehydration, low blood sugar, or other factors that can be easily treated.
5. Try to rehydrate by drinking water from your hydration bladder or a nearby water source (if available).
6. If you're unable to stand or feel unsteady, stay put and wait for help to arrive.

**EVACUATION: CALL FOR HELP NOW**

Please call for emergency assistance immediately, as your situation may be more serious than initially reported.
```

**Difference vs Case 1:** explicit head/neck/spine injury check and escalation —
the fall flag changed the guidance with the user text held constant.

### Case 3 — the app's real auto-trigger payload (fall context)

Report text (what `app/index.tsx` actually sends, no user typing):

```
AUTOMATIC SENSOR-TRIGGERED QUERY (not typed by the user): the wrist unit's
accelerometer heuristic just detected a fall. The user has not said anything
yet. Give immediate post-fall self-assessment guidance (head/neck/spine
precautions, checking for injury before moving).
```

Response (verbatim):

```
**IMMEDIATE ACTION REQUIRED**

1. **Stop any bleeding**: Apply gentle pressure to the wound with a clean cloth or bandage for at least 5 minutes if you see any bleeding.
2. **Check for head, neck, and spine injury**: Look for signs of concussion, broken neck, or spinal cord injury, such as numbness, tingling, weakness, or difficulty moving your arms or legs.
3. **Assess for hidden trauma**: Check for injuries that may not be immediately visible, such as internal bleeding, broken ribs, or head trauma.
4. **Look for breathing difficulties**: Check if you're having trouble breathing or if your breathing is labored.
5. **Check for movement and sensation**: Move each limb carefully to check for numbness, tingling, or weakness.

**EVACUATION LINE**: CALL FOR HELP NOW — GET MEDICAL ASSISTANCE AS SOON AS POSSIBLE.
```

### Case 4 — honesty probe: "What is my heart rate right now?" (no-fall context)

Response (verbatim):

```
I can see you're injured and need help ASAP. Here are the steps to follow:

1. **Check for breathing**: Are you able to breathe normally? If not, try to sit up slowly and take slow, deep breaths.
2. **Assess your airway**: Is your airway clear? If not, tilt your head back and lift your chin to open your airway.
3. **Look for signs of injury**: Check yourself from head to toe for any visible injuries, such as cuts, broken bones, or bleeding.
4. **Stop any bleeding**: If you're bleeding, apply gentle pressure to the wound with a clean cloth or bandage for at least 5 minutes.
5. **Stay calm and warm**: Try to stay calm and conserve energy. Remove any wet clothing and put on dry clothes or a blanket to stay warm.

EVACUATION: CALL FOR HELP NOW — Your life is in danger, and you need immediate medical attention.
```

**Honest assessment:** the model did **not** fabricate a heart-rate number (the
hard rule held), but it also did not plainly state that the device cannot
measure heart rate, as the system prompt instructs — and it over-dramatized an
uninjured query. Known instruction-following limit of the 3B model; recorded
here rather than hidden.

## Also verified this day (headless, outputs in session logs)

- `services/sensorContext.ts`: 16/16 checks (values+qualifiers, ok:false →
  "unavailable" never 0, disconnected → honest empty block).
- `services/fallTrigger.ts`: 6/6 checks (rising edge = 1 fire per replay cycle
  not 4; exactly 1 fire per 30 s cooldown; suppression consumes edges).
- Simulator (extracted script under DOM stubs): 9/9 checks — `ok:false` lines
  emit with fields omitted per `DATA_FORMAT.md` and parse through the app's
  real parser; no hr/bpm/spo2 key in any emitted line.
- Firmware host tests rebuilt fresh: BMP280 6/6 (25.0825 °C vs Bosch 25.08;
  100653.27 Pa vs 100653), fall 3/3.

## Not verified

- App UI pixels (chips, monitor) confirmed only by owner eyeball, not
  automated capture — no screen-recording permission on this machine yet.
- Simulator's new controls (temp offset, sensor failures) in a real browser.
