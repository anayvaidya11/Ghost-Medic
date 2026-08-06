# Archiater — session rules

Offline AI **decision-support prototype** for trained responders, by
**Wyzantium Industries**. Formerly Ghost Medic; renamed 2026-08-05. Read
`ROADMAP.md` first every session; `ARCHITECTURE.md` for topology;
`DATA_FORMAT.md` for the wire contract; `docs/POSITIONING.md` for why the
product changed shape on 2026-08-05.

Rename exceptions, on purpose: `legacy/` keeps its old-name strings, and the
committed `firmware/ghost_medic_firmware.uf2` keeps its filename because it
is the artifact of a real build under the former name.

## The honesty rule (non-negotiable)

Simulated = labeled simulated. Raw = labeled raw. Stub = labeled stub.
Never claim a test passed without showing its output. If you can't verify
something, say so explicitly. Every claim in docs/site must map to a file or
artifact in this repo.

## Locked decisions — do not relitigate

1. Product (repositioned 2026-08-05, see `docs/POSITIONING.md`): offline
   decision-support software for a trained responder, running on the end-user's
   own device (laptop stands in today), with the wrist sensor hub as an
   **optional accessory** streaming raw signals into it. Voice + image input;
   local (no-internet) LLM; spoken, numbered candidate actions.
2. App shows altitude / temperature / fall-status as DERIVED values; optical
   red-IR and accel as clearly-labeled RAW SIGNAL. Raw vs. derived visually
   distinguished.
3. The proof is pipeline integrity end-to-end with every real-vs-simulated
   boundary labeled — NOT medical validity.
4. Build order: P1 bridge+app → P2 sensor-changes-advice → P3 hardware video →
   P4 website.
5. Posture: decision support for a **trained responder**, never autonomous
   directives to a layperson. The app and prompt must say so. No claim of FDA
   clearance, compliance, or clinical validation, ever.

## Hard rules

- **NO heart rate, SpO2, or BPM — anywhere, ever.** Not displayed, not computed,
  not emitted, not implied. The MAX30102 is a raw optical (PPG) front-end; raw
  red/IR counts only. The LLM prompt explicitly forbids inferring HR/SpO2.
- **Never touch `legacy/`.** Archived TCCC engine; nothing imports it.
- **Out of scope (committed):** HR/SpO2 computation; real BLE (wired bridge is
  the stand-in); dedicated pack hardware — **killed 2026-08-05**, the end-user
  device is the compute and a laptop stands in for it in the demo; real
  STT/vision (stubs); PCB fabrication; medical-validity claims.
- No new dependency without justification.
- A failed sensor read renders/says "unavailable" or "—", never 0 or a
  fabricated value. Gate every field on its `ok` flag (`DATA_FORMAT.md`).
- Commit in logical groups; show `git status` before committing. Do not push
  unless the owner says to.
