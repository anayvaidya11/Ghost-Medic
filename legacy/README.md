# legacy/ — archived TCCC deterministic engine

This folder holds an **earlier, different product** that used to share the repo
with the current one. It is archived, not deleted — it still works as a reference
and can be resurrected — but **nothing in the shipping product imports from here.**

## Why this was archived

Ghost Medic briefly contained *two* products pulling in opposite directions:

1. **This (`legacy/`) — a deterministic tactical trauma app.** A rules engine
   (`src/logic/tccc.ts`, the TCCC/MARCH combat-casualty decision tree) driving a
   9-screen intake flow (`src/screens/`), wired with React Navigation via the old
   `App.js` entry point. No LLM. Military/tactical framing.

2. **The kept product — the LLM wilderness assistant.** `app/` (expo-router) +
   `services/` → multimodal input → a local LLM → spoken triage advice. Wilderness
   Medical Society framing. This is the thesis.

Holding both at once was the main source of "where am I on this project?" On
2026-07-20 the decision was made: **the LLM wilderness assistant is the product.**
The deterministic engine moved here so the active tree contains one product only.

## What's in here

```
legacy/
├── App.js                 old React-Navigation entry (NOT the app entry anymore;
│                          the real entry is expo-router → app/)
└── src/
    ├── screens/           the 9-screen TCCC intake flow
    ├── logic/tccc.{ts,js} the MARCH deterministic decision engine
    ├── store/             zustand session store + scenario data
    ├── scenarios/         wilderness patient vignettes (reusable — see note)
    ├── components/        RiskBadge, VitalsBar, Header, etc.
    ├── context/, hooks/, data/, theme/, types/, services/
```

## How to resurrect it (if ever needed)

It was moved with `git mv`, so full history is intact (`git log --follow`).

1. Restore the `@ → ./src` path alias in **both** `babel.config.js` (module-resolver
   `alias`) and `tsconfig.json` (`paths`) — it was removed when `src/` moved here.
2. Point the app entry back at `App.js` (or re-integrate screens under `app/`),
   and remove `"legacy"` from the `tsconfig.json` `exclude` list.
3. Re-add the React Navigation deps if they were pruned.

## Note: the scenarios are worth reusing

`legacy/src/scenarios/*.json` are hand-written wilderness patient vignettes
(snake bite, hypothermia, anaphylaxis, altitude cerebral edema, fall). They're
independent of the TCCC engine and would make good **demo inputs / eval cases for
the LLM product**. Consider lifting them out of legacy when building the eval set
(see `training/`).
