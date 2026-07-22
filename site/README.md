# Ghost Medic proof website (`site/`)

A **static site with no build step**: four hand-written HTML pages, one shared
stylesheet, and one vendored library. Nothing to install, nothing to compile.
This follows [`../docs/WEBSITE_STRATEGY.md`](../docs/WEBSITE_STRATEGY.md) §5
(static-first, boring, maintainable) rather than a framework.

**Audience:** startup founders. Technical enough to smell exaggeration, often
not embedded engineers. So the prose translates rather than simplifies: it keeps
the specific number and the engineering reason and drops the jargon. Status is
stated on the overview page before anything is demonstrated, because saying it
first is what makes the rest believable.

**House style:** no em dashes and no figurative language in any prose, title, or
caption. Short, direct sentences. Verbatim artifacts (test output, model
transcripts, code, the sensor block) are exempt and must never be edited to fit
the style, because their whole value is being unedited.

## What's in here

| Path | What it is |
|---|---|
| `index.html` | **Overview**, the pitch, the honest status ledger, the wire format explained, the live simulator |
| `how-it-works.html` | **How it works**, the four stages in plain language, with an animated 2D pipeline diagram |
| `hardware.html` | **Hardware**, the 3D board viewer, the copper routing, why each part is there |
| `proof.html` | **Proof**, test output, the recorded model transcript, the real-vs-simulated table |
| `style.css` | The whole design system. Two devices carry the site: the *translation pair* (`.translate`) and the *ledger mark* (`.mark`) |
| `simulator/index.html` | **Byte-identical copy** of `../simulator/index.html`, embedded via iframe on the overview page |
| `assets/board-viewer.js` | three.js board viewer, merges draw calls, falls back to the static render on any failure |
| `assets/product-viewer.js` | three.js concept illustration of how the system would be worn. Placeholder shapes built in code, labelled as concept, falls back to the inline 2D SVG |
| `assets/app-demo.js` | Scripted replay of the app's screen. The response text is the verbatim recorded run; no model runs in the page |
| `assets/charts/*.svg` | Chart plates generated from the shipping code. See `../tools/charts/README.md` |
| `assets/*.glb / *.svg / *.png / *.pdf` | Generated from `../hardware/` source, see below |
| `vendor/three/` | three.js r185, MIT, vendored so the site has **zero external requests** |

Every factual claim on the site maps to a file in this repository, and the site
links out to each one.

## Regenerating the hardware assets

All four come from the committed KiCad source. `kicad-cli` ships inside KiCad
(on macOS: `/Applications/KiCad/KiCad.app/Contents/MacOS/kicad-cli`). Exact
commands live in [`../hardware/README.md`](../hardware/README.md); copy the
outputs here afterwards:

```sh
cp ../hardware/exports/ghostmedic-sensor-hub.glb                assets/
cp ../hardware/exports/ghostmedic-sensor-hub-front-copper.svg   assets/
cp ../hardware/exports/ghostmedic-sensor-hub-3d-top.png         assets/
cp ../hardware/exports/ghostmedic-sensor-hub-schematic.pdf      assets/
```

## Regenerating the charts

The three SVGs in `assets/charts/` are drawn from data produced by the shipping
C and TypeScript. Commands in [`../tools/charts/README.md`](../tools/charts/README.md).

## The stylesheet version query

Pages link `style.css?v=N`. Bump `N` whenever `style.css` changes, so cached
copies don't serve a stale design.

## Keeping the simulator in sync

`simulator/index.html` here is a **byte-identical copy**. The canonical source is
`../simulator/index.html`. If you change that, re-copy it:

```sh
cp ../simulator/index.html simulator/index.html
cmp ../simulator/index.html simulator/index.html && echo identical
```

## Preview locally

```sh
cd site
python3 -m http.server 8090
# open http://localhost:8090
```

Use the local server, not a double-click. Opening `index.html` from `file://`
blocks JavaScript modules and iframes, so the 3D board falls back to its still
render and the embedded simulator won't load, both by design, but it isn't a
faithful preview.

## Deploy to Vercel, exact steps (no experience assumed)

1. Go to <https://vercel.com> → **Sign Up** → **Continue with GitHub** (the
   account that owns `Ghost-Medic`). The free "Hobby" plan is fine.
2. **Add New…** (top right) → **Project**.
3. Under "Import Git Repository," find **Ghost-Medic** → **Import**. (If it
   isn't listed, click "Adjust GitHub App Permissions" and grant access.)
4. On the configure screen, change exactly three things:
   - **Root Directory** → **Edit** → choose the **`site`** folder.
   - **Framework Preset** → **Other**.
   - **Build Command** → leave **empty**. **Output Directory** → leave as **`.`**.
5. **Deploy**. Under a minute later you get a URL like
   `ghost-medic-xxxx.vercel.app`.
6. Every future `git push` to `main` redeploys automatically.

Custom domain later: Project → **Settings → Domains**.

## Updating the site

Edit the HTML, commit, push. That's the entire pipeline. The one rule worth
keeping: **if a claim can't be traced to a file in this repo, it doesn't go on
the site.**
