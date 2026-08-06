# Positioning: why the product changed shape

**Decision date: 2026-08-05.** This document records a repositioning of the
product and the analysis behind it. It is the reference for every doc that
changed on that date.

## The decision, in five lines

1. The product is software first: offline decision support for a trained
   responder, running on the device that responder already carries.
2. The wrist sensor hub is an optional accessory, not the product. The routed
   PCB in `hardware/` is that accessory.
3. The belt pack is killed. Not deferred. Killed.
4. The guidance posture changes from spoken directives to decision support.
   The responder on scene decides.
5. New names: the product is **Archiater**, the company is **Wyzantium
   Industries**. The mechanical rename is a separate tracked workstream.

## What the market said

The United States military already fields point-of-injury software. It is
called BATDOK, built by the Air Force Research Laboratory. It runs on phones
the operator already carries. It works with no connectivity. It ingests
wireless sensors. The Joint Operational Medicine Information Systems program
selected it in 2022 as the point-of-injury and en-route care solution. It is
government owned and it adds zero grams to the load.

That last part matters most. Audited Marine combat loads average 117 pounds.
Army loads average 119. The Army's stated target is 55 pounds. Every new
device conversation with a program office starts with the question "what are
you removing." A dedicated wrist unit plus a dedicated belt computer, each
with its own battery, is a net addition. A 2018 Deputy Secretary of Defense
memo also restricts wearable devices in operational areas. Microsoft had ten
years and a contract ceiling of 22 billion dollars to make one body-worn
computer work, and IVAS still failed on ergonomics.

Civilian adjacencies point the same way. Expedition and remote-work markets
buy services, not boxes: a Garmin inReach subscription is a satellite link to
a human responder for about 30 dollars a month. Search and rescue teams are
volunteers with no equipment budget. NGOs buy standardized kits through
procurement centres. Nobody in these markets is waiting for another wearable.

## What the regulatory read said

Spoken, numbered treatment instructions delivered to an untrained person by a
model nobody can inspect is the single worst position in the FDA's software
framework. It fails the general wellness exemption, because trauma care is
treatment. It fails the clinical decision support carve-out, because that
carve-out requires the recommendation to go to a professional who can
independently review its basis. FDA guidance updated in January 2026 warns
specifically about automation bias and directive-style output from large
language models.

There is also a clinical evidence problem. A 2023 study in Prehospital and
Disaster Medicine prompted two commercial chatbots with the simplest possible
first-aid question, a person who is not breathing. Under ten percent of one
model's answers and about eleven percent of the other's fully matched
resuscitation guidelines. This project's own July 2026 test found the local
3B model avoids inventing vitals but does not always state its limits.

The defensible posture is the one this repo now takes. The software supports
a trained responder: a medic, an expedition leader, a remote-site lead. It
proposes candidate actions and states its reasons. The responder decides.
This is a positioning choice. It is not a claim of FDA clearance, compliance,
or clinical validation. No such claim is made anywhere in this repository,
and none may be added.

## What the unit economics said

A dedicated medical wearable at this niche's plausible volume sits below the
minimum order quantities at which contract manufacturing becomes rational.
The engineering cost never amortizes. There is no subscription to attach,
because offline operation means no service layer. And the model layer is
open weights and free. Anyone can ship it in an app. Several projects
already do. The scalable shape is software on hardware someone else already
bought, with optional hardware attached only where it earns its place.

## What survives the critique

- **The offline requirement is real.** Denied-communications environments
  exist, in conflict and in the backcountry. Cloud products structurally
  cannot serve them. This was always the honest core of the project.
- **The contract-first pipeline.** One JSON line is the only interface
  between firmware, bridge, and app. Any producer swaps for any other. This
  is why the repositioning cost nothing technically.
- **The routed PCB.** A real, hand-routed sensor board is a stronger artifact
  as an honest accessory than as the centerpiece of an unbuildable product.
- **The dual-use frame.** The same software serves a combat medic and an
  expedition leader. Both work far from help with no signal.

## The new product, exactly

Archiater is offline decision-support software for the trained responder,
running on the device they already carry: a phone, an end-user device, or a
laptop. An optional wrist sensor accessory, the existing PCB, streams raw
signals into it over one documented wire format. No network, ever.

```
 wrist sensor accessory (optional)  ──the link──▶  end-user device  ──▶  responder
 RP2040 + raw optical + baro + accel   NDJSON        app + local model      decides
```

The demo today runs the app in a browser and the model under local Ollama on
one laptop. A laptop is an end-user device. The demo has been the product
all along; the story around it was wrong.

## The phone is enough, verified

"A 3B-class model runs offline on a current phone" is a shipped fact, not a
research claim. Checked 2026-08-06 against primary sources:

- **Apple ships it.** Apple Intelligence includes an on-device foundation
  model of about 3 billion parameters, running on iPhone 15 Pro and later at
  about 30 tokens per second (Apple ML Research, "Introducing Apple's
  On-Device and Server Foundation Models").
- **Google ships it.** Gemini Nano runs on-device on Pixel 8 and 9 series
  and Galaxy S24 through the Android AICore service; Google's Gemma 3 1B
  runs at 529 MB via its AI Edge runtime (Google model cards and developer
  blog).
- **The open path this repo uses works too.** Meta publishes quantized
  Llama 3.2 1B and 3B for phones; measured decode is about 22 tokens per
  second for the 3B on an iPhone 16 Pro at roughly 2.8 GB peak RAM, against
  8 to 16 GB in current flagships. llama.cpp, MLC LLM, and Google AI Edge
  all run these models on Android and iOS today.
- **The honest limits.** Sustained generation throttles to roughly 40 to 65
  percent of burst speed as the phone heats; context windows on phone
  builds are short (2K to 8K tokens); and small models are dependable for
  extraction, summarization, and protocol lookup, not for open-ended
  clinical reasoning. All three limits fit this product's posture: short,
  retrieval-shaped decision support for a trained responder, in bursts.

The demo's llama3.2:3b under Ollama is the same model class Apple and Meta
run on phones. Nothing about the pipeline assumes more compute than a
responder already carries.

## What was killed, and why

| Killed | Reason |
|---|---|
| Belt pack | Adds carried load, cost, and a second battery. Duplicates the device already in the pocket. Was concept-only, so removing it falsifies nothing. |
| Dedicated compute selection | Was deferred. Now closed. The end-user device is the compute. |
| Directives to a layperson | Worst available regulatory quadrant, and the clinical evidence is against it. Replaced by responder decision support. |
| Wearable-first form factor | Competes with the government's own free, weightless software. The sensor hub survives as an optional accessory. |

## What the repo already proves about the new story

The repositioning changed no pipeline code. `DATA_FORMAT.md` is untouched.
The bridge, the firmware, the parser, the sensor-context builder, and all 39
committed tests are untouched. The system was software running on carried
hardware since the first commit. That the story could pivot without touching
the contract is evidence the contract-first design was correct.

## Honest limits

- No customers. No pilots. No letters of intent. No traction of any kind.
- No FDA interaction of any kind has occurred.
- Nothing is clinically validated. This is not a medical device.
- The firmware has never run on physical hardware.
- The PCB has never been fabricated.
- Speech-to-text and wound-photo analysis remain placeholder stubs.
- The one advantage claimed, offline operation, is also claimed by BATDOK,
  which is government owned and already fielded. The differentiators left
  are the open local-model reasoning layer and the labeled, auditable
  honesty of this pipeline. Whether those are enough is an open question,
  and this document does not pretend otherwise.

## What changed in this repo, and where

- `CLAUDE.md`: locked decision 1 rewritten, decision 5 added (posture).
- `ROADMAP.md`: superseding decision block, new Phase 5 section.
- `ARCHITECTURE.md`: three-box topology replaces the four-role diagram.
- `README.md`: reframed opening, diagram, and section 2.
- `services/llmService.ts`: system prompt now addresses a trained responder.
- `app/index.tsx`: tagline and a persistent decision-support banner.
- `DATA_FORMAT.md`, `bridge/`, `firmware/`, `hardware/`, `tests/`,
  `simulator/`: no changes.

## Key sources

BATDOK (AFRL): afresearchlab.com/technology/batdok. JOMIS selection reported
September 2023, thedefensepost.com. Soldier load: GAO-17-431. Wearables
restriction: Deputy Secretary of Defense memo, August 2018. FDA software
guidances: 21st Century Cures section 3060 CDS guidance and the January 2026
updates. Chatbot resuscitation study: Birkun and Gautam, Prehospital and
Disaster Medicine 38(6), 2023. IVAS: Breaking Defense, April 2025.
Phone inference: Apple ML Research, "Introducing Apple's On-Device and
Server Foundation Models"; Google AI Edge developer blog and the
gemma-3n-E2B model card; Meta, "Introducing quantized Llama models";
llama.cpp Android docs; MLC LLM docs. Checked 2026-08-06.
