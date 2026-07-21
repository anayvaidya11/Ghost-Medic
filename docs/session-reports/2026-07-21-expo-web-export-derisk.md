# Session Report — Expo → Web Export De-Risk (2026-07-21)

**Author:** autonomous build session (owner blind on ops; consultant to verify later)
**Commit:** `2f14c5a` — "Enable Expo web export: add react-native-web + worklets, align react-dom"
**Status:** committed locally, **NOT pushed** (awaiting consultant review).

## Why this was done

The final deliverable is a **self-contained web demo on Vercel**. The app is
React Native / Expo (built for phones). The load-bearing question for the entire
plan: **can `app/index.tsx` become a static website at all?** Everything about the
"UI demo" page depends on the answer. So this session de-risked that first
(evidence before architecture).

## What was found & fixed (the ops issues, for the consultant)

Three dependency problems blocked web export, all now resolved:

1. **`react-native-web` was missing** — the runtime that renders RN on web.
   Added `react-native-web@0.21.2`.
2. **`react` / `react-dom` were version-skewed** — `react@19.1.0` but
   `react-dom@19.2.8`. Expo requires them matched. Aligned `react-dom` → `19.1.0`.
3. **`react-native-worklets` was missing** — Reanimated 4 split worklets into a
   separate package; the babel `reanimated/plugin` requires it. Added
   `react-native-worklets@0.11.1`.

⚠️ Installs used `--legacy-peer-deps` to get past a strict peer-dep tree. **The
consultant should do a clean `npm install` review** to confirm the tree is sane.

## What was VERIFIED (evidence)

- `npx expo export --platform web` **succeeds** → `dist/index.html` + a 2.04 MB
  JS bundle, **no build errors**. The native modules (image-picker, speech,
  audio, reanimated) did not break the build.
- The JS bundle passes `node --check` (valid syntax).
- Statically served, `dist/` returns **HTTP 200** with the `<div id="root">`
  mount point present.
- `dist/` is gitignored (build output; Vercel will build it, not git).

## What was NOT verified (honest limits)

- **Does the app actually RENDER on screen?** No browser in this session. Build
  success ≠ render success.
- **Do `expo-audio` (recording), `expo-image-picker` (camera), `expo-speech`
  (TTS) work at runtime on web?** These are the likely web-incompatible parts.
  They may be phone-only and need feature-detection + graceful fallbacks +
  honest "phone-only" labels on the web demo. **Untested.**

## Next verification step (needs a human or a browser session)

Run locally and eyeball:
```
npx expo start --web      # or: npx serve dist
```
Open in a browser, check: does the "ready" screen render? Does typing work? Try
the mic/camera buttons and note which throw or no-op on web. That list defines
what the web demo must gracefully degrade.

## Files touched

- `package.json`, `package-lock.json` (3 deps as above). Nothing else. `dist/`
  is generated and gitignored.
