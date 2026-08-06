# Archiater — Roadmap

**Read this first, every session.** It exists so you never have to hold the whole
project in your head again. Pick the lowest unchecked phase, do it, check it off.

- **Product (decided 2026-07-20):** the **LLM wilderness assistant** (`app/` +
  `services/`). The old deterministic TCCC engine is archived in [`legacy/`](legacy/README.md).
- **What we're optimizing for:** *Goal B* — a highly technical, honest **proof**
  that the engineering works (simulation + real firmware link + docs), shown on a
  Vercel site + this repo. Not a hardware-validated medical device (that's Goal A,
  years away). For a proof, a **demonstrated, honestly-labeled** end-to-end pipeline
  beats a half-finished "real" one.
- **North star:** *one command brings up sensor stream (from the firmware's own
  math, no hardware) → bridge → app → local LLM → spoken triage advice, fully
  offline, every real-vs-simulated boundary labeled — plus one video of the Pico
  streaming on real hardware.*

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for topology and [`DATA_FORMAT.md`](DATA_FORMAT.md)
for the wire contract.

---

## Locked Decisions (confirmed by owner — do not relitigate)

> **Repositioning 2026-08-05 (supersedes decision 1's framing; see
> [`docs/POSITIONING.md`](docs/POSITIONING.md)).** The product is **Archiater**
> (company: **Wyzantium Industries**): offline decision-support software for a
> trained responder, running on the device they already carry (phone / EUD /
> laptop), with the wrist sensor hub as an **optional accessory** streaming raw
> signals into it. The belt pack is killed, not deferred. The guidance posture
> is decision support, never directives to a layperson. Decision 1 below is
> kept as written because the history of the change is part of the record.

1. **What it is:** an offline, wearable AI **first-aid assistant prototype**. A
   wrist-worn sensor hub captures motion, altitude/environment, and raw optical
   signals, streams them to a **local (no-internet) LLM** that combines them with
   voice + image input to speak numbered first-aid guidance.
2. **What the app shows:** altitude, temperature, and fall-status as
   honestly-derived values; raw optical (red/IR) and acceleration as
   clearly-labeled **raw signal** (live trace). **No heart-rate / SpO2 / BPM number
   anywhere.** Raw vs. derived is visually distinguished.
3. **What the site proves:** a full offline pipeline (firmware-grade sensor data →
   bridge → app → local LLM → spoken advice) runs end-to-end and *responds to its
   inputs*, with every real-vs-simulated boundary labeled. The physical-hardware
   run is shown separately as a scoped video artifact.
4. **Build order:** Phase 1 bridge+app → Phase 2 sensor-changes-advice →
   Phase 3 hardware video → Phase 4 website.

### Out of scope (committed — do NOT build)
- No HR / SpO2 / BPM computation.
- No real BLE — the wired local WebSocket bridge is the honest stand-in.
- No dedicated "pack" hardware — **laptop = pack**; the topology is a documented
  tradeoff study, not a device to build now.
- No real speech-to-text or wound vision — both are **stubs**.
- No PCB fabrication.
- No medical-validity claims.

---

## Status legend
🟢 done · 🟡 in progress · ⬜ not started · 🧊 deferred (don't do yet)

---

## Phase 0 — Kill the ambiguity  🟢 DONE (2026-07-21)
*One product, one repo, shared memory.*
- 🟢 Decision made: product = LLM wilderness assistant.
- 🟢 TCCC engine archived to `legacy/` (product typechecks clean; nothing imports legacy).
- 🟢 `ARCHITECTURE.md`, `DATA_FORMAT.md`, this `ROADMAP.md` written.
- 🟢 `simulator/` committed.

## Phase 1 — The spine (the bridge)  🟡 IN PROGRESS
*Make sensor data actually reach the app. Highest leverage.*
- 🟢 Node bridge: reads NDJSON, re-broadcasts unchanged over `ws://localhost:8080`.
  `--source ∈ {serial, sim, file}`; `file` mode shipped (+ `--loop` for continuous
  replay), `serial` stubbed with a clear message. Drops lines without `t_ms`.
  Dep: `ws` only. Verified: `test-client.js` receives the 4 data lines, boot line
  dropped, loops correctly. (`bridge/`, spec in `DATA_FORMAT.md`.)
- 🟢 App wired to `ws://localhost:8080/stream`: `services/useWristVitals.ts` +
  `services/wristVitalsParser.ts` parse NDJSON per `DATA_FORMAT.md` (every field
  gated on its `ok` flag), consumed by `app/index.tsx`'s `VitalsMonitor` on the
  READY screen with a ●LIVE/○DISCONNECTED indicator. Honest: raw vs. derived split,
  nulls render "—", no HR/SpO2. Verified: `npx tsc --noEmit` clean; the compiled
  parser maps the live bridge stream to correct values (incl. `ok:false` → "—").
  *Not yet verified: React actually painting the values in a running browser.*
- ⬜ **Upgrade the `sim` source** to generate the stream from the firmware's *own*
  pure C (`firmware/bmp280_compensation.c`, `firmware/fall_detection.c`) compiled
  on the host — so the test data is the shipping code, not a reimplementation.
- **DONE WHEN:** replayed/generated sensor lines make the numbers in the app move, live.

## Phase 2 — Close the loop  🟡 NEARLY DONE (2026-07-22)
*Sensor data changes the AI's answer.*
- 🟢 Sensor context injection: `services/sensorContext.ts` (pure, 16/16 headless
  tests) builds a delimited block — derived values qualified (altitude relative,
  temp ambient-not-body), raw optical labeled non-diagnostic, `ok:false` →
  "unavailable" never 0, disconnected → honest "no sensor data". Appended to
  every LLM request in `app/index.tsx`; the exact sent block is viewable in the
  UI ("SENSOR CONTEXT ATTACHED" chip). System prompt extended with reasoning
  rules incl. NEVER inferring HR/SpO2 from raw counts.
- 🟢 Fall auto-trigger: `services/fallTrigger.ts` (rising edge + 30 s cooldown +
  suppression; 6/6 headless tests — 1 fire per replay loop, not 4). Auto-submits
  post-fall guidance, labeled "SENSOR-TRIGGERED (not typed by user)"; toggleable.
- 🟢 Simulator upgraded as demo instrument: temp-offset + per-sensor `ok:false`
  failure toggles (headless-verified against the app parser); bpm display
  removed (Decision 2).
- 🟢 **DONE-WHEN evidence:** real Ollama (llama3.2:3b, local) called with the
  app's exact payload construction — the fall-context response adds head/neck/
  spine + hidden-trauma assessment absent from the no-fall response; the model
  did not invent HR/SpO2 when probed. (Seeded proof harness; transcript in the
  2026-07-22 session report.)
- 🟢 **Tests committed 2026-07-22.** The 16/16 and 6/6 counts previously quoted
  here came from in-session harnesses that were never committed, so a reviewer
  who went looking found nothing. `tests/` now holds real files: 39 tests,
  `npm test`, no framework and no new dependency (node:test plus Node's native
  TypeScript support, Node >= 22.6). sensorContext 16, fallTrigger 12,
  wristVitalsParser 11.
- ⬜ Remaining: visually confirm the full loop in a running browser/app (same
  outstanding gap as Phase 1's "numbers move live" — everything up to the React
  render is verified headless). Known limit: the 3B model avoids inventing HR
  but doesn't always *state* it can't measure it, as the prompt instructs.

## Phase 3 — Hardware truth  ⬜ (gated on parts: a Pico + the 3 breakout sensors)
*The single highest-credibility artifact.*
- ⬜ Flash `firmware/ghost_medic_firmware.uf2`; capture a short **video** of the
  Pico streaming real JSON.
- ⬜ Run the same bridge with `--source=serial` against the real board.
- ⬜ Save a real capture file; note any datasheet/timing bugs found on the bench.
- **DONE WHEN:** one honest artifact proves the firmware runs on metal.

## Phase 4 — The proof website  🟡 BUILT, NOT YET DEPLOYED (2026-07-22)
*The honest storytelling layer over everything above.*
- 🟢 **Stack decision:** zero-dependency static site in `site/` (per
  `docs/WEBSITE_STRATEGY.md` §5 — static-first, no build step), NOT Next.js.
  Deploys to Vercel with root dir = `site`; exact owner steps in `site/README.md`.
- 🟢 Single scrolling page: topology → embedded live simulator (iframe, labeled)
  → physics section (real C excerpts + regenerated test receipts + interactive
  altitude formula widget, labeled as a JS mirror) → end-to-end section (recorded
  fall-vs-no-fall transcript, labeled "recorded, not live"; run-it-yourself
  commands) → firmware receipts → hardware page-section (KiCad render + designed-
  not-built gap box first) → annotated system prompt → full real-vs-simulated
  table. All self-contained, zero external resources.
- 🟢 Evidence record backing the site's transcript claims:
  `docs/session-reports/2026-07-22-phase2-sensor-aware-llm.md`.
- ⬜ Owner deploys to Vercel (steps in `site/README.md`) and eyeballs the page.
- ⬜ Hardware-run video slot stays honestly empty until Phase 3 happens.
- **DONE WHEN:** a stranger understands the engineering and sees it work in ~90 s.

### Phase 4b — rebuilt for a non-engineer audience  🟢 (2026-07-22)
*Same evidence, different reader. Target is a founder who is technical enough to
smell exaggeration but is not an embedded engineer.*
- 🟢 Split the single 530-line page into four: `index.html` (pitch, status,
  the wire format, the live simulator), `how-it-works.html`, `hardware.html`,
  `proof.html`. Shared `style.css`, shared nav, section anchors on every page.
- 🟢 Language rewritten throughout: translate rather than simplify, keeping the
  specific number and the engineering reason. Two structural devices carry it:
  the *translation pair* (technical artifact, then what it means) and the
  *ledger mark* (works today / standing in / simulated).
- 🟢 **House style, applies to all future site and doc prose:** no em dashes, no
  figurative language, short direct sentences. Verbatim artifacts (test output,
  model transcripts, code, the sensor block) are exempt and must never be edited
  to fit the style. Recorded in `site/README.md`.
- 🟢 3D board viewer: `kicad-cli pcb export glb` from the committed KiCad source,
  rendered with three.js r185 vendored into `site/vendor/` so the site still
  makes zero external requests. Falls back to the still render when WebGL is
  missing or the model fails to load; failure path tested by removing the file.
- 🟢 Front-copper 2D export added, because the soldermask hides the routing in 3D
  exactly as it would on a board.
- 🟢 Owner decision 2026-07-22: **the site says nothing about PCB fabrication
  status, either way.** Repo docs (`hardware/README.md`, `ARCHITECTURE.md`, this
  file) keep their accurate wording and the site links to them.
- 🟢 Honesty audit re-run: all links and asset references resolve, all quoted
  code and output checked against source, overclaim grep clean. It caught one
  real defect: the model transcripts had been condensed while being presented as
  recorded output. They are now verbatim.

### Phase 4c — product concept, charts, interface demo  🟢 (2026-07-22)
- 🟢 **3D product concept on the overview page** (owner-directed, overriding the
  earlier no-concept-renders rule): wrist unit (open tapered band, case with a
  display) wired to a curved belt pack. Placeholder shapes built in code, not
  CAD, labelled as concept on the page and in the source. Numbered markers map
  where the finished parts live; an inline 2D SVG is the no-WebGL fallback.
- 🟢 **The concept display is labelled concept-only** in the legend AND as a row
  in the Proof page's real-vs-simulated table: the built board has no screen.
- 🟢 The concept's cable is wired on purpose, captioned with `bridge/README.md`'s
  wording: a wired, local stand-in for the eventual wrist→pack BLE link.
- 🟢 **Three chart plates** (`site/assets/charts/`, pipeline in `tools/charts/`):
  fall signature and altitude curve computed by the firmware's own C, trigger
  debounce computed by the app's own `fallTrigger.ts` (2 calls vs 150). Data
  from shipping code; matplotlib only draws it (build-time tool on the dev
  machine, not a project dependency).
- 🟢 **Scripted interface demo** on How it works: a phone-frame replay of the
  fall auto-trigger showing the verbatim recorded response, labelled "no model
  is running in this page".
- 🟢 Layered desert-oasis background, prose tightened toward ~1 minute of text
  per page, and hand-designed-PCB authorship stated on Hardware and in the
  concept caption.
- 🟢 Concept refined: thicker cable, moulded pack (parting seam, recessed port,
  vents, softer fillets), larger display with a thinner bezel, softer shadow
  falloff. Callout 4 now names the compute class. `ARCHITECTURE.md` line 45 says
  "e.g. Jetson Orin Nano / Pi 5" and both docs defer the choice, and neither
  states a wattage, so the 7-15 W figure is attributed to that module class's own
  rating and the runtime is marked "on paper". The site says plainly that no
  module has been selected and nothing has been measured.
- 🟢 `site/about.html` added: who built it, two sentences, contact links.
- 🟢 Concept scale fix: the pack was rendering 136 mm wide (2.84x the case)
  because bendAroundY bent at the body radius, stretching the outer face 17%.
  Bending at the outer radius (175) preserves the documented 120 mm and lands
  the ratio at 2.45x, verified by measuring the rendered bounding boxes, not by
  eye. Belt strap rebuilt as a tapering swept arc at r=147.5 (behind the pack's
  150 mm inner face), symmetric ~27 mm past each side, lighter than the
  enclosure. Wrist and pack dimensions unchanged (48x40x11, 120x80x25).
- 🟢 Removed the concept LABEL box (folded the essential disclosure into the
  caption), the "dot is illustrative pacing" figcaption sentence, and the
  Hardware page's "criticism of my own layout" box (owner override). Hardware
  and Proof prose tightened further. About page renamed "About me".
- 🟢 Concept bend fix + more detail, and a hard site prose cut (2026-07-22).
  `bendAroundY` now uses each vertex's own radius (`theta = x / r`) instead of a
  single fixed radius. The fixed-radius version (this file's earlier note) held
  the outer face right but squeezed the inner face into a wedge: 92 mm against
  107 mm. The per-vertex bend renders 117 mm across, inner and outer within a
  millimetre, measured headless against the real `RoundedBoxGeometry`, not by
  eye. Cable deepened into a catenary (54% slack vs the straight span, clears
  the floor). Detail added: wrist side buttons (the board's real SW1/SW2, not a
  crown, which would imply an encoder the board lacks), an underside optical
  aperture (the MAX30102 window), strap lugs; pack recessed vent grille, a
  concept status LED, softer seam chamfer. **No browser render this session** —
  no Chromium is installed here, so the geometry is verified by measurement, not
  pixels. Site prose cut across all five pages (~3446 → ~2749 words, body prose
  excl. tables/chrome ~2637 → ~2027); every honesty disclosure and evidence link
  kept, overclaim grep and link check re-run clean.

### Phase 4d — the concept on a body, and a hard prose cut  🟢 (2026-07-25)
- 🟢 **A way to actually see the render.** Every earlier concept session shipped
  geometry verified only by measuring bounding boxes, because no browser was
  installed. `tools/render/` fixes that: `preview.html` mounts the viewer on its
  own with the camera the site ships, and `shot.mjs` screenshots it over the
  Chrome DevTools Protocol. **No new dependency** — Node's built-in `WebSocket`
  drives a Chromium already on the machine, and nothing is added to
  `package.json`. This paid for itself immediately (see the two defects below).
- 🟢 **`site/assets/wearer-figure.js`**: a cropped body form the concept is worn
  on. A torso lofted through superellipse cross-sections, an arm swept in one
  piece from shoulder to fingertip, and a belt that wraps the real surface. Built
  in code like the two units, and labelled on the page, in the module, and in the
  Proof table as a placeholder — not a scan, not CAD, nobody's proportions.
  Cropped deliberately: a whole standing figure puts the 48 mm case at about 3%
  of frame height and hides every detail on it.
- 🟢 **Placement is measured, not nudged.** The pack's inner face is a 150 mm arc
  and a waist is elliptical, so there is no angle where it sits flush. The code
  scans the front-left quadrant for the closest local radius of curvature and
  seats it there: **149.8 mm against 150.0**. The preview prints that, plus arm-to-
  torso gap (47.9 mm), shoulder burial (82.5 mm, which is what hides the cut end),
  cable-to-torso (24.0 mm), cable slack (18%) and every marker's pixel position.
- 🟢 **Two defects only a render could have caught.** The band mounted itself
  using the straight elbow-to-wrist chord rather than the curve's tangent, so it
  sat skewed across the base of the hand. And the cable ran from the connector
  straight at the belt, which on a raised arm means through the hand; it now
  leads back down the forearm first and clears by **9.3 mm**. *An initial
  diagnosis blamed centripetal Catmull-Rom spacing. That was wrong — three.js maps
  `t` uniformly across segments — and the comment in the file says so rather than
  keeping a tidy-sounding story.*
- 🟢 `product-viewer.js` refactored: wrist unit and belt pack extracted into their
  own builders, plus a `wearer` flag. The units-only view is **pixel-identical**
  to before, verified by screenshot against one taken before the refactor. Added
  `dispose()`, because the page now rebuilds the scene on every view switch and
  would otherwise leak a WebGL context each time.
- 🟢 Overview page carries both views behind a toggle, on-the-body first, which is
  what its heading ("What it would look like on you") was always promising.
- 🟢 **Cuts (owner-directed):** the embedded simulator and its section left the
  overview page, and `site/simulator/` (a byte-identical copy) is deleted along
  with the sync ritual in `site/README.md`. `ARCHITECTURE.md` §"three data
  sources" updated to say the simulator is standalone now. Hardware lost "Why each
  part is on the board" — the useful content moved into the parts table in plainer
  words. How it works lost the whole "03 · The pack computer" section; the
  numbered eyebrows went with it, since 01/02/04 reads as a mistake.
- 🟢 **Plain-language sweep** across all five pages: no "bare-metal", "downstream",
  "BLE", "LLM layer", "routing", "host tests", "prompt construction", "synthetic
  trace". Verbatim artifacts (test output, transcripts, code, the sensor block)
  untouched, per the house style. Link check clean over 50 local references,
  overclaim grep clean, `npm test` 39/39, `npx tsc --noEmit` clean.
- 🟢 **Proof page rebuilt around four pieces of evidence** (owner-directed): each
  is one trimmed code block followed by a plain "what this proves". The 39-line
  test wall is now 5 lines plus the pass count, the firmware output is the two
  Bosch comparison lines, and the two full model transcripts are one excerpt: the
  step that only exists in the fall run. Every cut is marked in grey inside the
  block and every full version is one link or one command away.
  **Watch this one.** A previous audit caught transcripts being condensed while
  presented as recorded output, so the excerpt is explicitly labelled and the
  session report is linked from beside it. Re-ran both suites to quote them
  honestly, and fixed a pre-existing defect while there: the firmware block had
  been re-spaced to fit the column, so the site was showing output that never
  came out of the terminal. `.receipt` scrolls horizontally, so it now carries
  the real spacing.
- 🟢 **Reading level is measured, not asserted.** `tools/prose/readability.mjs`
  scores each page (Flesch-Kincaid, target grade 10, skips `<pre>` and the shared
  nav/footer). All five pages pass: index 4.7, hardware 4.6, how-it-works 4.3,
  proof 4.7, about 9.4, whose only long sentence is a degree name. The first
  version of the script was wrong in an instructive way — with no sentence break
  at block tags it read the whole ledger table as one grade-72 sentence.
- ⬜ **Known gap:** `assets/charts/debounce.svg` still labels a line "the shipping
  trigger". Chart text is baked in as glyph paths, so fixing three words means
  installing matplotlib and regenerating all three plates, risking visual drift
  on the other two. The figcaption underneath translates it instead.

## Phase 5 — Reposition (Archiater)  🟡 IN PROGRESS (2026-08-05)
*The market said the form factor was wrong. The story changed; the pipeline did
not. Rationale and evidence: [`docs/POSITIONING.md`](docs/POSITIONING.md).*

- 🟢 `docs/POSITIONING.md` written: the harsh analysis (BATDOK/JOMIS incumbent,
  soldier load, FDA posture, unit economics), what survives, what was killed,
  honest limits stated flat.
- 🟢 Governing docs amended: `CLAUDE.md` (decision 1 rewritten, decision 5
  posture added), this file's superseding block, `ARCHITECTURE.md` three-box
  topology, `README.md` reframe. `DATA_FORMAT.md` needed zero changes.
- 🟢 App posture: system prompt addresses a trained responder ("the responder
  on scene decides"); `EVACUATION:` line format preserved for the parser;
  persistent "decision support, not a medical device" banner in the UI.
- 🟢 Rename Ghost Medic → **Archiater** / **Wyzantium Industries** across the
  repo (2026-08-05, six commit groups: prose docs, site, code identifiers,
  slugs+lockfiles, firmware guards+CMake target, KiCad sources+regenerated
  exports). The committed `ghost_medic_firmware.uf2` keeps its name: it is the
  artifact of the verified July build and renaming it would fake a build.
  Owner-gated leftovers: push + GitHub repo rename + Vercel project rename +
  working-directory rename.
- 🟢 On-body concept rebuilt to the new story (2026-08-05): a full standing
  mannequin from the MakeHuman CC0 base mesh (pipeline + license record in
  `tools/figure/`, 268 KB quantized GLB, no decoder needed), wrist accessory
  (concept display deleted: the board has no screen), chest-carried phone
  showing a mock of the real app layout, belt pack out of the shipped scene
  but still buildable in the render harness (`?devices=wrist+pack`). Mounts
  are measured off the loaded mesh, not eyeballed: the wrist is found by a
  minimum-girth slice scan, the band bore is sized to it, and the preview
  prints stature/flip/wrist-margin/cable-gap numbers. Four defects were
  caught by those numbers, not by eye: a backwards facing probe, a wrist scan
  that landed in the palm, and a cable through the torso and the arm.
- 🟢 Site visual redesign, the oasis (2026-08-06): scenery-only tokens (dune,
  pool, water, frond) with the rule written into the stylesheet that scenery
  never makes a claim; inline-SVG hero, dividers and footer waterline; paper
  grain from a committed build-time generator (`tools/render/grain.mjs`);
  depth shadows; the `--ink-3` contrast fix (2.9:1 to 5.2:1). Zero text
  nodes changed, proven by a byte-identical readability report. Text rewrite
  still deferred to its own session.
- 🟢 Round two, owner-directed (2026-08-06): the figure is male now (MakeHuman
  macrodetail morph applied by `tools/figure/apply-target.mjs`, same CC0
  pipeline); the phone rides a low belt at the hip pocket, where a hanging
  wrist ends up; the site viewer is two tabs only (On the body / Devices);
  the hero is a living canvas oasis (`site/assets/oasis.js`: layered dunes,
  palms that sway, a pool with reflection and rain rings, drifting sand, a
  passing shower every ~34 s; one still frame under reduced motion); the
  phone-compute claim is now verified fact with sources in
  `docs/POSITIONING.md` ("The phone is enough, verified"); and a fluff cut
  took body prose down again (index 491 to 395 words, how-it-works 602 to
  533, hardware 554 to 513, proof 885 to 802) with every honesty device
  kept. All gates re-run green.
- ⬜ **Next-session site worklist (text session):** investor-terse rewrite;
  hero spec strip using the four honest numbers — **0** external network
  requests · **10 Hz** one-line contract · **48** committed checks (39 app +
  9 firmware) · **77.5 × 71.75 mm** hand-routed 2-layer board; remaining
  claim-fixes listed in the 2026-08-05 session analysis.

## Deferred  🧊 (do NOT start these now — they're not on the critical path)
- 🧊 Run the fine-tune pipeline in `training/` (its existence is enough proof for now).
- 🧊 Real BLE wrist→pack link (the wired bridge is the honest stand-in).
- 🧊 Real speech-to-text (whisper.cpp) and wound vision — stubs are fine until
  Phase 2 works with text.
- ❌ ~~Choosing/building the dedicated "pack" compute device (Jetson/Pi 5)~~ —
  **KILLED 2026-08-05**, not deferred: the end-user device is the compute
  (`docs/POSITIONING.md`). A laptop stands in for the end-user device in the
  demo.
- 🧊 PCB fabrication (the design + firmware is the story).

---

## Anti-rathole rules
1. Never work on a 🧊 item while a ⬜ item below Phase 4 is open.
2. Every new claim on the website must map to a 🟢 row here.
3. When unsure "is this real or simulated?", the answer goes in the label, not the code.

## Known cleanups (small, do when convenient)
- ~~`services/llmConfig.example.ts` syntax error breaking typecheck~~ — **stale as
  of 2026-07-22**: `npx tsc --noEmit` passes clean; the file is 46 lines and fine.
- Consider lifting `legacy/src/scenarios/*.json` (wilderness vignettes) out for use
  as LLM demo/eval inputs.
- ~~If `simulator/index.html` changes, re-copy it to `site/simulator/index.html`~~
  — **gone as of 2026-07-25.** The site no longer embeds the simulator, and the
  copy under `site/` was deleted, so there is nothing left to keep in sync.
