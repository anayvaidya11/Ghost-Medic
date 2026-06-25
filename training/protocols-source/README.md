# Grounding Documents

Paste your source material here as plain-text (`.txt`) files. The dataset
generator (`../generateDataset.ts`) reads every `.txt` file in this folder and
folds the combined text into its prompts so synthetic answers stay anchored to
real doctrine rather than the model's unverified recall.

## What to put here

- **Wilderness Medical Society (WMS) practice guidelines** — e.g. the
  guidelines for hypothermia, frostbite, heat illness, acute altitude illness,
  anaphylaxis, lightning injuries, and spine assessment in the wilderness.
- **NOLS Wilderness Medicine** textbook excerpts — Patient Assessment System
  (PAS), the ABCDE primary survey, the SAMPLE secondary survey, and evacuation
  guidelines.
- **CDC wilderness / travel health references** — environmental exposure,
  waterborne illness, venomous bites and stings.

## Format guidance

- Plain UTF-8 text, one topic per file is fine (e.g. `wms-hypothermia.txt`).
- Strip page headers/footers and figure captions where you can — clean prose
  grounds the model better.
- Keep excerpts reasonably short; very long files are truncated by the
  generator to fit the prompt budget (see `MAX_GROUNDING_CHARS` in
  `../generateDataset.ts`).

## Copyright

These documents are used **locally** to ground synthetic data generation. Make
sure you have the right to use any copyrighted material this way, and do not
commit licensed text to a public repository. This folder is a drop point on your
own machine; only this README is tracked by default.
