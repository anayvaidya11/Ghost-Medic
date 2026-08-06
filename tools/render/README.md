# tools/render — looking at the 3D concept viewer

Development tools. Nothing here ships with the site, and nothing here is a
project dependency: no entry is added to `package.json` and no package is
installed. `shot.mjs` talks to a browser that is already on the machine using
Node's built-in `WebSocket`.

## Why this exists

`site/assets/product-viewer.js` and `site/assets/wearer-figure.js` build their
geometry in code. Numbers can be checked headlessly, and are: the preview page
prints clearances, gaps and marker positions under the canvas. But a bounding box
cannot tell you whether an arm reads as an arm, so there has to be a way to
actually look at the thing while changing it.

The measurements are the point as much as the pictures. An early version of the
figure mounted the wrist band in a place that measured fine and looked wrong; a
later one had a cable that passed through the hand. Both were found by looking.
Both are now numbers the preview prints, so they cannot come back silently.

## preview.html

Mounts the same viewer module the site uses, on its own, with the camera the site
ships. Serve the **repository root**, not `site/`:

```sh
python3 -m http.server 8932
# then open:
#   http://localhost:8932/tools/render/preview.html            on the body
#   http://localhost:8932/tools/render/preview.html?wearer=0   the devices alone
```

`?devices=` picks the device set (`wrist+phone`, the shipped one, or the
harness-only `wrist+pack` / `wrist+phone+pack`). `?preset=` picks a camera
preset without clicking: `figure`, `wrist`, `phone`, `pack`, `all`.

The page never auto-rotates, so two screenshots of the same code are identical.

Printed under the canvas (the figure loads from a GLB, so the page waits for
the viewer's `ready` promise before measuring):

| Line | What it is guarding |
|---|---|
| `stature / scale applied / flipped` | The GLB's own units and facing are never trusted; this reports what normalisation actually did. The facing probe once flipped the figure backwards. |
| `wrist max radius` and `band radial margin` | The band's bore is sized to the measured wrist. A negative margin means the band is sunk into the skin. The wrist scan once landed in the palm and reported 45 mm. |
| `pack seat radius` | The (killed) pack's inner face is a 150 mm arc; the seat is wherever the measured torso curvature comes closest. |
| `chest surface z` | Where the chest mount's plate meets the measured torso. |
| `cable to torso gap` | Negative means the cable runs through the wearer. |
| `cable to arm gap` | Negative means the cable runs through the limb it is routed beside. It did once. |
| `cable slack` | A cable is longer than the gap it spans. Near 0% means it is drawn as a taut rod. |
| `marker N at` | Pixel position on the canvas, and the distance to the nearest other marker. Placing these by eye costs a screenshot per nudge. |

## shot.mjs

```sh
node shot.mjs <url> <out.png> [waitMs] [width] [height] [clipSelector] [clickSelector]
```

```sh
# the concept as the site renders it
node shot.mjs http://localhost:8932/tools/render/preview.html out.png 6500 1280 900 "#product-viewer"

# the site's own page, after clicking through to the other view
node shot.mjs http://localhost:8933/index.html out.png 5000 1280 900 "#product-viewer" 'button[data-view="units"]'
```

`waitMs` has to cover the WebGL scene settling; 5000 to 7000 is reliable with
software rendering. Page exceptions are printed to stderr, so a silent JavaScript
failure does not pass as a good screenshot.

Set `CHROME_PATH` if the browser is not in one of the usual places.
