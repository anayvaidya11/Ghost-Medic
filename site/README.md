# Ghost Medic — proof website (`site/`)

A **zero-dependency static site**: one hand-written `index.html`, no framework,
no build step, nothing to install. This follows the decision in
[`../docs/WEBSITE_STRATEGY.md`](../docs/WEBSITE_STRATEGY.md) §5 (static-first,
boring, maintainable) rather than a Next.js app.

## What's in here

| Path | What it is |
|---|---|
| `index.html` | The whole site — single scrolling page, self-contained CSS/JS |
| `simulator/index.html` | **Byte-identical copy** of `../simulator/index.html`, embedded via iframe. Canonical source lives in `../simulator/` — if you change that, re-copy it here (`cp ../simulator/index.html simulator/index.html`). |
| `assets/ghostmedic-sensor-hub-3d-top.png` | KiCad 3D render, generated from `../hardware/` source |
| `assets/ghostmedic-sensor-hub-schematic.pdf` | Schematic PDF, generated from `../hardware/` source |

Every factual claim on the page maps to a file in this repository; the page
links out to each one. The honesty audit for the initial version lives in the
2026-07-22 session report.

## Preview locally

```sh
cd site
python3 -m http.server 8090
# open http://localhost:8090
```

(Opening `index.html` directly by double-click also works, though some browsers
restrict iframes on `file://` — the local server is more faithful.)

## Deploy to Vercel — exact steps (no experience assumed)

1. Go to <https://vercel.com> and click **Sign Up** → **Continue with GitHub**
   (use the GitHub account that owns `Ghost-Medic`). Free "Hobby" plan is fine.
2. Once logged in, click **Add New…** (top right) → **Project**.
3. Under "Import Git Repository," find **Ghost-Medic** and click **Import**.
   (If it isn't listed, click "Adjust GitHub App Permissions" and grant access
   to the repo.)
4. On the configure screen, change exactly three things:
   - **Root Directory** → click **Edit**, choose the **`site`** folder.
   - **Framework Preset** → select **Other**.
   - **Build Command** → leave **empty** (toggle "Override" off / blank).
     **Output Directory** → leave as **`.`** (the root of `site/`).
5. Click **Deploy**. In under a minute you'll get a live URL like
   `ghost-medic-xxxx.vercel.app`.
6. Every future `git push` to `main` redeploys automatically — no other steps.

To use a custom domain later: Project → **Settings → Domains** → add the domain
and follow the DNS instructions Vercel shows.

## Updating the site

Edit `site/index.html`, commit, push. That's the entire pipeline. If the
simulator or the hardware exports change, re-copy them (commands above / in
`../hardware/README.md`).
