# Ghost Medic — Website Strategy

*How to present an honest, unfinished hardware + software project online.*

**Audience:** you (solo, self-taught, no formal EE/CS). **Written:** 2026-07-21.
**Governing rule:** every claim on the site maps to real evidence in this repo.
Nothing faked, nothing overstated. The hardware has never been flashed to a real
device, and the site must say so plainly until that changes.

> **Jargon note:** the first time a technical term appears, it's explained in
> plain English right there. If a term shows up later without explanation, it was
> defined earlier — search the doc for it.

---

## 0. Evidence audit — read this before anything else

You can only present what you can prove. Here is the honest inventory of what's
actually in the repo today, and the one place the repo currently over-claims.

### ✅ Real and demonstrable (backed by files you can point to)

| Thing | Evidence in repo | What it proves |
|---|---|---|
| Firmware compiles to a real image | `firmware/build/ghost_medic_firmware.elf` **and** `.uf2` exist; `firmware/README.md` records a clean `-Wall -Wextra -O3` build | You can write bare-metal C that the Pico toolchain accepts |
| Sensor math is unit-tested | `firmware/tests/` (`test_bmp280.c`, `test_fall.c`) pass on a laptop; math matches Bosch datasheet reference (~25.08 °C, ~100653 Pa) | The formulas are correct, not just compiling |
| Testable architecture | `firmware/bmp280_compensation.{c,h}`, `firmware/fall_detection.{c,h}` — pure math split out from hardware I/O | You understand separation of concerns, a real professional pattern |
| One JSON wire format end-to-end | `DATA_FORMAT.md` + `firmware/main.c` + `simulator/` + `bridge/` all speak the same NDJSON | Contract-first design; sources are swappable |
| Interactive simulator | `simulator/index.html` — runs in a browser, uses the real firmware formulas | A visitor can *touch* the system with zero install |
| Working data bridge | `bridge/bridge.js` + `test-client.js` + `sample.ndjson`; simulator has opt-in `?bridge=1` output | Data actually flows source → bridge → consumer, live, today |
| Working app + real LLM prompt | `app/index.tsx` (voice / camera / text → response), `services/llmService.ts` with a real wilderness system prompt against Ollama | The software half genuinely works offline |
| Domain grounding | `services/llmService.ts` prompt (PAS, ABCDE, WMS), `training/` fine-tune pipeline, `legacy/src/scenarios/*.json` vignettes | You did real wilderness-medicine homework |

**Terms used above:**
- **Bare-metal C** — code that runs directly on the chip with no operating
  system underneath it.
- **`.uf2` / `.elf`** — the compiled firmware files. `.uf2` is the one you drag
  onto a Pico to flash it; `.elf` is the richer build output it's made from.
- **NDJSON** — "newline-delimited JSON": one complete JSON object per line. A
  dead-simple streaming format.
- **Ollama** — a program that runs a language model locally on your own machine,
  no internet needed.
- **PAS / ABCDE / WMS** — standard wilderness-medicine frameworks (Patient
  Assessment System; the Airway-Breathing-Circulation-Disability-Exposure check
  order; Wilderness Medical Society).

### ❌ Explicitly NOT done (and the repo already says so — keep it that way)

- Firmware **never flashed or run on a physical Pico**; no reading ever checked
  against a real sensor. (`firmware/README.md`, `ARCHITECTURE.md`.)
- **No BLE / wireless.** The bridge is a *wired* WebSocket stand-in for the
  eventual radio link. (`bridge/README.md` states this loudly.)
- **Speech-to-text and wound-vision are stubs** (`services/transcriptionService.ts`,
  `services/visionService.ts`).
- **No dedicated "pack brain" compute device** — a laptop stands in.

### ✅ RESOLVED (2026-07-21): the PCB design is now committed

**A PCB is a "printed circuit board" — the physical green board that parts get
soldered onto. "KiCad" is the free software used to design one (the schematic =
wiring diagram, and the board layout = physical placement of parts and copper
traces).**

*This used to be the biggest honesty risk on the site:* `ARCHITECTURE.md` claimed
a "PCB designed … ✅ Real design" but no KiCad files were in the repo. **That is
now fixed** — the real KiCad 10.x source (schematic + routed board + project file)
lives in [`../hardware/`](../hardware/), alongside an exported schematic PDF and a
3D render generated from that source. It resolves via option 1 below.

So on the site, the wrist unit can now use its **strongest** visual honestly (see
Part 2a): the KiCad 3D render + a schematic excerpt, backed by openable files.

**The claim that remains, and must stay labeled:** the board is **designed and
routed, NOT fabricated, assembled, or bench-tested** — no physical copy exists.
`hardware/README.md` and the `ARCHITECTURE.md` table both state this. Keep that
line wherever the board appears; "designed" must never quietly become "built."

---

## PART 1 — How unfinished physical products get presented online

A survey of the common patterns, each with: **what it is**, **what tools make
it**, **how much effort**, and **the honesty verdict for *your* situation** (no
physical hardware yet). I flag anything that would imply you have more than you do.

### Pattern A — Photorealistic 3D renders
**What:** computer-generated images that look like glossy product photos.
**Tools:** Blender (free), Fusion 360 (free tier), KeyShot (paid).
**Effort:** high for someone new — days to a convincing render.
**Honesty verdict for you:** ⚠️ **Handle with care.** A render that looks like a
photo of a finished product, with no label, is the closest thing to a lie on this
list — it implies the object exists. A render that is clearly *labeled as a
concept* and styled so it reads as CAD/concept (not a photo) is fine. The label
is what separates honest from dishonest. See Part 4 for the full treatment.

### Pattern B — CAD / KiCad screenshots (the honest cousin of renders)
**What:** screenshots straight from the design software — a schematic, a board
layout, or KiCad's built-in 3D board viewer.
**Tools:** KiCad (free) for the PCB; FreeCAD/Fusion for an enclosure.
**Effort:** low-to-medium *if the design already exists* (it's just a screenshot);
high if you have to create the design first.
**Honesty verdict:** ✅ **Ideal for you** — *if* the design exists (see the PCB
caveat above). A CAD screenshot inherently says "this is a design, not a
manufactured thing." Nobody mistakes a schematic for a product photo. This is the
single most honest way to show hardware-that-doesn't-physically-exist-yet.

### Pattern C — Real photographs
**What:** actual photos of actual hardware.
**Honesty verdict:** ❌ **Off the table for now** — you have no hardware to
photograph. The day you flash a real Pico on a breadboard, a genuine phone photo
of it (even ugly, even on a messy desk) becomes one of your *highest*-credibility
assets, precisely because it's obviously real. Plan for it (Phase 3 in your
`ROADMAP.md`), don't fake it.

### Pattern D — Interactive browser demos
**What:** something the visitor can click, drag, and watch respond — live, in the
page, no install.
**Tools:** plain HTML/CSS/JS (you already did this — `simulator/index.html`).
**Effort:** you've already paid it for the simulator.
**Honesty verdict:** ✅✅ **Your single strongest card.** An interactive demo
proves the logic works because the visitor *runs it themselves*. It can't be
faked the way a screenshot can. Your simulator already carries an explicit "this
is a SIMULATOR, not real hardware" banner — that honesty is exactly right and
makes the demo *more* credible, not less.

### Pattern E — Architecture / system diagrams
**What:** boxes-and-arrows showing how parts connect and where data flows.
**Tools:** Excalidraw (free, hand-drawn look), draw.io (free), Mermaid (diagrams
written as text, render in Markdown/most site frameworks), Figma.
**Effort:** low. Hours, not days.
**Honesty verdict:** ✅ **Do this early.** You already have the raw material as
ASCII diagrams in `README.md` and `ARCHITECTURE.md`, plus the real-vs-simulated
table (which is gold — most projects hide that line; you draw it). A diagram
claims nothing about physical existence, so there's no honesty risk, and it's how
a reviewer understands the system in 20 seconds.

### Pattern F — Video walkthroughs / screen recordings
**What:** a short screen (or phone) recording of the thing actually running.
**Tools:** QuickTime (Mac, built in) or OBS Studio (free) for screen capture;
your phone for the app; iMovie for trimming.
**Effort:** low-to-medium. The hard part is doing a clean take, not the tooling.
**Honesty verdict:** ✅ **Excellent, with correct captions.** A 30–60 second
recording of the simulator driving the bridge driving the app is real evidence.
Caption what the viewer is seeing ("simulated sensor data," "local LLM on a
laptop") and it's bulletproof. This is also your *fallback* for anything that's
too fragile to run live in a stranger's browser (see Part 3).

### Pattern G — Live telemetry dashboards
**What:** a page showing data updating in real time — moving numbers, a scrolling
log, little charts.
**Tools:** plain JS + a charting lib (uPlot or Chart.js, both free); your
`bridge` already emits the data over WebSocket.
**Effort:** medium.
**Honesty verdict:** ✅ with a label. Your simulator's scrolling JSON feed is
already a mini telemetry dashboard. A richer one is a nice-to-have, not a
priority — as long as it says the data is simulated.

### Pattern H — "How it works" explainer sections
**What:** prose + diagrams walking through the system for a non-expert.
**Effort:** low (you've basically written it already across your docs).
**Honesty verdict:** ✅ Always good. Your docs are unusually honest and
well-written; the website explainer is mostly an editing job on text that exists.

### Real-world examples to study (at your stage or adjacent)

These are durable, well-known references. I'm citing them from knowledge, not
live-fetching them today — click through and confirm each still matches before
you lean on it.

- **Oxide Computer (oxide.computer)** — a hardware company that built enormous
  credibility *through public honesty and documentation* (their RFD process,
  deep technical blog) long before most people could buy anything. The lesson
  isn't the polish; it's that transparency reads as competence.
- **Adafruit / Pimoroni product pages** — the gold standard for mixing **CAD
  renders + real photos + pinout diagrams + schematics** on one page. Study how
  they clearly distinguish a labeled pinout diagram from a product photo.
- **Prusa / RepRap build logs & bunnie Huang's blog (bunniestudios.com)** —
  long-form "here's the messy real engineering, including what broke" writing.
  This is the tone your `HONEST_REPORT`-style docs already have.
- **KiCad project write-ups on Hackaday.io and personal EE portfolios** — search
  "KiCad project portfolio" — you'll see the standard, honest visual vocabulary:
  schematic snippet → 2D board layout → KiCad 3D viewer render → (if built) a
  breadboard photo. Copy that exact ladder.
- **Teenage Engineering / Playdate (play.date)** — for *aesthetic* reference only:
  how a rugged/industrial product identity is carried through a whole site. Your
  simulator's tactical look is already in this family.

**The pattern across all the good ones:** they never blur the line between
"designed," "simulated," and "physically working." They *label the line and make
it a feature.* That is precisely your project's whole thesis (`ROADMAP.md` Goal
B). Lean into it.

---

## PART 2 — What Ghost Medic has, and how to present each piece honestly

### a) The wrist unit — PCB, firmware, tests

**Reality check first:** as flagged in §0, the *firmware* and *tests* are real and
strong; the *KiCad PCB* is currently claimed but not in the repo. Present this
piece in layers, showing the strongest **real** thing most prominently:

**If the PCB design exists (commit it first):**
The most impressive honest visual, in priority order:
1. **KiCad's built-in 3D board viewer render** — KiCad (free) has a "3D Viewer"
   (View → 3D Viewer) that renders the populated board from your layout with one
   click. This is honest by construction: it's obviously a design tool's output,
   not a photo, and it looks genuinely impressive. **Zero extra software, zero
   CAD skill** — if the layout exists, the render is one menu click and a
   screenshot.
2. **A board-layout screenshot** (the 2D traces view) next to it — shows the real
   engineering, the copper routing.
3. **A schematic excerpt** — one clean sheet (e.g. the I²C bus with the three
   sensors) proves you designed the wiring, not just bought a diagram.

**If the PCB design does NOT exist yet:**
Don't fake it. Present the wrist unit as **"firmware-complete, board planned"** and
make the firmware the star:
- Show the **sensor block diagram** (the three I²C sensors on one bus — you can
  draw this in Excalidraw in 15 minutes; the pin assignments are real, in
  `main.c`).
- State plainly: *"The board isn't designed yet; the firmware targets a Pico +
  three breakout modules, with pin assignments already chosen for a future custom
  board."* That's true and still credible.

**What matters to a reviewer here:** that the firmware is real, builds, and is
tested. The `.uf2` existing + the passing tests is worth more than any render.

### b) The firmware — demonstrating code quality and correctness

**What a hiring manager actually cares about (signal):**
- **It compiles clean under strict flags.** Show the literal build output:
  `-Wall -Wextra -O3`, zero warnings, valid `.uf2`. A screenshot of the terminal
  is perfect. (**`-Wall -Wextra`** = "turn on all the compiler's warnings"; **`-O3`**
  = "optimize hard." Passing both clean signals careful C.)
- **It's tested, and the tests prove something specific.** Show the
  `firmware/tests/` output: the BMP280 math landing on the datasheet's own
  reference numbers, the fall detector correctly flagging/ignoring the three
  scenarios. This is your best correctness evidence — put the PASS output on the
  page as text or a screenshot.
- **The architecture is deliberate.** One small diagram: "driver (does I²C) →
  pure math module (no hardware) ← same math ← host test." That picture *shows*
  you understand testable design without a word of prose.
- **The code is readable.** Link 2–3 short, well-commented excerpts straight into
  the repo (e.g. the fall-detection state machine). Don't paste whole files.

**What's noise (skip it):** exhaustive file listings, line counts, "X hours of
work," anything that reads as padding. A reviewer skims; give them the receipt
(clean build + passing tests + one good code excerpt) and a repo link.

### c) The simulator — your strongest interactive artifact

**This is the piece to invest in.** It's the only thing a stranger can *use*
without installing anything, and it already speaks the real firmware format.

- **Embed it live, in-page**, via an `<iframe>` (a way to drop one web page
  inside another). Because it's a single self-contained `index.html` with no
  dependencies, it embeds trivially and can't break the parent page.
- **Keep the "SIMULATOR — not real hardware" banner visible.** It's doing honesty
  *and* credibility work simultaneously.
- **Worth expanding? Modestly, yes — but don't gold-plate it.** High-value, low-
  risk additions:
  - A one-click **"simulate a fall"** button front-and-center (you have the fall
    logic) so a visitor sees `fall_detected` flip to true and the alert fire.
    This is your most visceral demo moment.
  - A small "**this exact JSON is what the real firmware prints**" callout linking
    to `DATA_FORMAT.md`, so the visitor understands the sim isn't a toy — it's
    the contract.
- **Don't** turn it into a big app. Its power is that it's small, instant, and
  obviously honest.

### d) The bridge + live data pipeline

**A "data pipeline" = the plumbing that carries data from where it's produced to
where it's used.** Yours: sensor source → bridge → consumer, all speaking the
same NDJSON.

You already have this working *locally* (`bridge.js`, `test-client.js`, the
simulator's `?bridge=1` output). The challenge is that a *pipeline* is invisible —
it's plumbing. Make it visible:

- **Best for the website: a captioned screen recording** (Pattern F) showing
  three panes — the simulator on the left pushing lines, a terminal in the middle
  running the bridge, the app on the right updating live. Watching one number move
  through all three panes *is* the proof. This is more reliable than trying to run
  a Node server in a stranger's browser (you can't — see Part 3).
- **A small animated architecture diagram** (boxes light up as a line passes
  through) is a nice secondary, but the recording is the real evidence.
- **Honesty caption, always:** "wired local WebSocket standing in for the eventual
  wireless link — not BLE." Your `bridge/README.md` already nails this wording;
  reuse it verbatim.

### e) The React Native app

**The problem:** a visitor can't install your phone app, and you shouldn't ask
them to. Standard honest solutions, best first:

1. **Screen recording in a phone-frame mockup.** Record the app running (in the
   Expo simulator or on your phone), then drop the video inside a picture of a
   phone (many free "device frame" templates / Figma community files exist). This
   is the industry-standard way to show a mobile app on a website. Honest: it's
   obviously a recording of software, not a claim of a shipping product.
2. **A short GIF** of the core loop (hold-to-speak → streaming numbered steps →
   evacuation line) for an at-a-glance preview above the full video.
3. **Static annotated screenshots** of the three states (input / review / response)
   for visitors who don't play video.
4. **(Stretch) an Expo web build.** Expo can export a web version; *some* of your
   app might run in-browser. But it depends on native bits (audio recording,
   camera) that behave differently or not at all on web, so this is fragile.
   Treat it as a bonus, not the plan. Recording is the reliable path.

**Honesty flags for the app:** the voice and wound-photo buttons are wired to
**stub** transcription/vision services right now. If you show them, caption that
the *audio capture and LLM path are real* but *speech-to-text and image analysis
are stubbed* — or demo the **"type instead"** path, which is fully real end-to-end
(text → Ollama → parsed response → read-aloud).

### f) The LLM configuration — showing prompt engineering + domain expertise

**"Prompt engineering" = carefully designing the instructions given to a language
model so it responds in the exact shape and quality you need.** You have a real,
non-trivial one in `services/llmService.ts`.

- **Show the actual system prompt**, verbatim, and *annotate it* — call out the
  deliberate choices: "assess scene safety first" (real wilderness doctrine),
  "max 6 steps, one sentence each" (usable under stress), "always end with an
  EVACUATION line" (the single most important field for a rescue decision). The
  annotation is what turns "I wrote a prompt" into "I made engineering decisions
  grounded in a domain."
- **Show the enforced output contract** (`ASSESSMENT / PRIORITY THREATS /
  IMMEDIATE ACTIONS / MONITOR FOR / EVACUATION`) and that your app *parses* it
  (`app/index.tsx` really does parse the EVACUATION line). Prompt + parser
  together = you designed a structured interface to a model, not just a chat box.
- **Point to the grounding work**: `training/` (the fine-tune pipeline and the
  WMS/PAS framing) and the scenario vignettes. Be honest with the label your own
  `ROADMAP.md` uses: the fine-tune is *set up but not run* — "pipeline built,
  training deferred." That's still real evidence of the workflow.
- **Streaming:** you can show the response appearing token-by-token in a recording;
  it reads as responsive and real.

---

## PART 3 — End-to-end proof: showing it works as one system

Your differentiator (per `ROADMAP.md` Goal B) is proving the *whole chain*, not
isolated parts:

```
sensor data (simulated) → bridge → app → LLM → response
```

### What can genuinely run live in a visitor's browser?

Be realistic about the boundary:

- ✅ **The simulator** runs fully in-browser. No server. Always safe to embed live.
- ❌ **The bridge** is a Node.js program — it needs a computer running it. It
  **cannot** run inside a random visitor's browser. (You *could* host a bridge on
  a small server, but then you're paying for and babysitting always-on
  infrastructure, and a stranger pushing data to it is a security/abuse surface.
  Not worth it for a portfolio.)
- ⚠️ **The app + a local LLM** need Ollama running on a machine. A visitor doesn't
  have that. You can't ship them a local model.

**Conclusion:** a *fully live, visitor-driven* end-to-end run is a **stretch that
isn't worth the cost or fragility.** Don't promise it.

### The realistic, honest "live demo" section — a hybrid

This gives the *feeling* of end-to-end while only running live what safely can:

1. **Live & interactive (real):** the embedded simulator. The visitor drags
   sliders, triggers a fall, watches the real-format JSON stream. They're touching
   the actual data contract.
2. **Recorded & captioned (real, just not live):** a single continuous screen
   recording that follows *one* fall event all the way through — simulator emits
   it → bridge forwards it → app shows the vital → LLM produces updated guidance
   → phone speaks the evacuation line. One unbroken take is the proof that the
   seams connect. Caption every real-vs-simulated boundary on screen.
3. **Reproducible (real):** a "**run it yourself**" box with the exact commands
   (`node bridge.js --source=file --file=sample.ndjson`, etc.) from your bridge
   README, so a technical reviewer can clone the repo and see the *live* pipeline
   on their own machine. This is the honest substitute for hosting it: you make it
   trivially reproducible instead of pretending it's hosted.

That trio — **live where it's safe, recorded where it isn't, reproducible for
skeptics** — is both maximally convincing and fully honest. It's arguably a
*stronger* story than a hosted live demo, because "here's the exact command, run
it yourself" is the most credible claim in software.

### The technical shape of the section
Static site (see Part 5) with: an `<iframe>` for the simulator, a `<video>` for the
recording, a copy-paste command block, and the real-vs-simulated table from
`ARCHITECTURE.md` pinned alongside so the labels are never more than a glance away.

---

## PART 4 — The CAD / 3D rendering question, evaluated honestly

You asked specifically about modeling the physical concept (wrist unit, pack-brain
enclosure) in CAD and putting renders on the site.

### The free tools, and the effort reality for a beginner
- **FreeCAD** (free, open source) — capable, but a famously steep learning curve.
  Realistic time to a *decent* enclosure render with zero prior CAD: **10–20+
  hours**, much of it fighting the software.
- **Fusion 360** (free personal tier) — friendlier, better tutorials, nicer
  renders. Still a real skill. Realistic first-result: **8–15 hours**.
- **Blender** (free) — the best-*looking* renders, but it's a 3D-art tool, not
  mechanical CAD; modeling a precise enclosure in it is the wrong tool for a
  beginner. Great renderer, wrong workflow for this.
- **KiCad 3D viewer** (free, you may already have it) — if the PCB design exists,
  this renders the *board itself* with one click and **near-zero learning curve.**
  This is a completely different effort class from enclosure CAD.

### Would concept renders strengthen or weaken the portfolio?
**It depends entirely on labeling, and the risk/reward is poor for you right now.**

- A concept enclosure render, **clearly labeled "concept, not built,"** and styled
  so it obviously reads as a 3D concept (not a photo), is **honest** — it's
  industrial-design ideation, a legitimate thing to show.
- The same render, **unlabeled or photo-styled**, sitting near your real firmware
  evidence, is **dishonest** — it implies a physical product exists and quietly
  poisons the credibility of the *true* claims next to it. For an honesty-first
  project, that's the worst possible trade.

**The line, stated simply:**
> **Concept visualization (honest):** "Here's what I'm imagining the enclosure
> could look like." Labeled, clearly a model.
> **Fake product photo (dishonest):** anything a viewer could mistake for a
> photograph of a thing that exists.

### The effort/honesty verdict
For a beginner with limited time and an honesty-first goal, **spending 15 hours
learning CAD to produce a concept render is a poor investment** — high effort,
and the output's honesty is fragile (one missing label and it backfires). Your
real assets (working firmware, tests, interactive sim, working app) are far
stronger and already built.

### The better, lower-effort, more-honest alternative
**A clean technical illustration / labeled diagram**, not a render:
- A **block diagram** of the wrist unit (Pico + 3 sensors on the I²C bus) —
  Excalidraw, ~30 minutes, and it's *more* informative to an engineer than a
  glossy render.
- An **exploded-style labeled sketch** (Pico here, sensors there, battery, strap)
  — clearly a concept schematic, communicates the physical idea, and *cannot* be
  mistaken for a real product. Excalidraw or draw.io, an hour or two.
- If (and only if) the **KiCad PCB exists**, the **3D board viewer render** — one
  click, honest, impressive. This is the *one* render worth showing, because it's
  a real design's real output, not an imagined enclosure.

**Recommendation:** skip enclosure CAD for now. Use labeled technical diagrams for
the physical concept, and the KiCad 3D viewer *if* the board design is real. If
you later fall in love with CAD, a clearly-labeled concept enclosure is a fine
*Phase 5+* nice-to-have — never a headline.

---

## PART 5 — Recommended website architecture

### Build tool: keep it boring and static
**Recommendation: a static site** (plain HTML/CSS or a light static-site generator),
hosted free on **Vercel** or GitHub Pages. Your `ROADMAP.md` already names Next.js
on Vercel — that's fine *if* you're comfortable with React; it gives you the
`<iframe>`/`<video>` embeds and Markdown-driven content easily.

- **If you want the least friction:** a single hand-written `index.html` +
  a little CSS/JS, same as your simulator. You've proven you can do this. One page,
  scroll-driven, no build step. Honest and totally sufficient.
- **If you want structure/reuse:** **Astro** (static-site generator, great for
  content-heavy sites, minimal JS, easy Markdown import) is a better fit than
  Next.js for a portfolio that's mostly prose + embeds. But don't relearn the
  whole world — if Next.js on Vercel is where you're headed, that's fine too.
- **Don't** reach for a heavy SPA framework or a CMS. This is a document with
  embeds, not an app.

**Reuse what you've written:** your `README.md`, `ARCHITECTURE.md`, and
`DATA_FORMAT.md` are 70% of the site's copy already. The website is largely an
editing + visual-layout job, not a writing-from-scratch job.

### Site structure (single scrolling page is enough to start)

```
┌─ HERO
│   "Ghost Medic — an offline AI first-aid assistant prototype for the backcountry."
│   One line on what it is. One line of honesty: "A working engineering proof —
│   firmware, simulator, app, and local LLM. Not yet a physical device; every
│   real-vs-simulated line is labeled below."
│
├─ THE PROBLEM  (2–3 sentences: injured, alone, no signal)
│
├─ HOW IT WORKS  (the topology diagram from ARCHITECTURE.md + one-sentence data flow)
│
├─ ⭐ LIVE: TRY THE SENSOR SIMULATOR  (embedded iframe; the "simulate fall" moment)
│       — the interactive centerpiece; visitor touches the real data contract
│
├─ END-TO-END PROOF  (the Part 3 hybrid: captioned recording of one fall through
│       the whole chain + the "run it yourself" command block)
│
├─ THE FIRMWARE  (clean-build screenshot + passing-tests output + the
│       driver/pure-math/test architecture diagram + 1 code excerpt → repo link)
│
├─ THE WRIST UNIT HARDWARE  (KiCad 3D render + schematic IF the PCB is real;
│       otherwise the honest "firmware-complete, board planned" block diagram)
│
├─ THE APP  (phone-frame screen recording + the three-state screenshots)
│
├─ THE AI  (annotated system prompt + output contract + domain grounding)
│
├─ WHAT'S REAL / WHAT'S SIMULATED  (the ARCHITECTURE.md table, verbatim — this
│       section is the trust anchor; some visitors will read only this)
│
└─ FOOTER  (links: GitHub repo, each subfolder README, your contact)
```

### Priority order for building it (one person, achievable)

Build in this order; each step ships something usable on its own.

1. **Resolve the PCB claim (§0).** Do this *first* — it's a 15-minute honesty
   decision (commit the files, or downgrade the wording) that everything else
   depends on. Non-negotiable for an honesty-first project.
2. **One-page static shell + hero + "what's real/simulated" table.** The honesty
   spine. Ugly is fine.
3. **Embed the simulator** (the iframe). Your strongest live asset, near-zero
   effort since it already exists.
4. **Firmware receipts:** screenshot the clean build and the passing tests, write
   the two short captions. Cheap, high-credibility.
5. **The end-to-end recording** (Part 3). The highest-value *new* production work.
   Do one good take of a fall traveling through simulator → bridge → app.
6. **The app phone-frame recording + screenshots.**
7. **Polish:** the annotated system prompt, the architecture diagrams, the "how it
   works" prose (mostly editing your existing docs).
8. **(Optional, later):** richer telemetry dashboard, KiCad renders if/when the
   board is real, concept enclosure diagram.

**Guiding principle throughout:** every section either shows something real or is
labeled as simulated/planned. The real-vs-simulated table isn't a disclaimer you
bury — it's the feature. A reviewer who sees you *volunteer* that line will trust
the green rows far more than they'd trust a slicker site that hides it.

---

## Appendix — quick honesty checklist before publishing any section

- [ ] Does every claim map to a file or artifact in the repo? (If not, cut or
      relabel it.)
- [ ] Is every render/mockup clearly a design/concept, impossible to mistake for
      a photo of a real device?
- [ ] Is every "simulated," "stubbed," "planned," or "not yet on hardware" boundary
      labeled *on that section*, not just in a far-off footnote?
- [ ] Does the PCB section match reality (files committed) — or is the claim
      downgraded to the truth?
- [ ] Could a skeptical engineer clone the repo and reproduce what the section
      shows? (For the pipeline: yes, via the command block.)
- [ ] Are the voice/vision stubs labeled wherever the app is shown?

*This document is strategy, not a claim of completed work. It should live at
`docs/WEBSITE_STRATEGY.md` and be revised as the ❌/🔜 rows in `ARCHITECTURE.md`
turn green.*
