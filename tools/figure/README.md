# tools/figure — where the mannequin comes from

`site/assets/wearer-body.glb`, the figure the product concept is worn on, is
built from MakeHuman's base mesh. This file records the source, the license,
and the exact commands, so the artifact maps to a documented pipeline the
same way the chart plates and the board GLB do. Nothing here ships with the
site and nothing is added to `package.json`; the two converters run under
`npx` on the dev machine only.

## Source and license

- **Source:** `base.obj` from the MakeHuman project,
  <https://raw.githubusercontent.com/makehumancommunity/makehuman/master/makehuman/data/3dobjs/base.obj>
  (retrieved 2026-08-05, 1,749,303 bytes, 19,158 vertices / 18,486 quads).
- **License: CC0 1.0.** Declared in the file's own header:

  > This asset was explicitly released as CC0 in september 2020. ...
  > The copyright holders at the point of the release to CC0 were:
  > Copyright (C) 2020 Data Collection AB, https://www.datacollection.se
  > Copyright (C) 2020 Joel Palmius
  > Copyright (C) 2020 Jonas Hauquier

  The MakeHuman application is GPL; its LICENSE materials state plainly that
  the license of exported assets is not affected. The mesh itself is CC0, so
  no attribution is required. Credit given anyway: the figure is the
  MakeHuman `hm08` base mesh.
- **What it is on the page:** a generic open-source base mesh rendered as a
  matte studio mannequin. It is not a scan of anyone and it is nobody's real
  proportions. The site says the same wherever the figure appears.

## The pipeline (run 2026-08-05)

```sh
curl -sLO https://raw.githubusercontent.com/makehumancommunity/makehuman/master/makehuman/data/3dobjs/base.obj

# 1 — keep only the `body` group. The source is one mesh in 172 groups:
#     the body, MakeHuman's helper-* clothing shells, and ~100 tiny joint-*
#     rigging cubes. Face indices are global, so the script renumbers them.
node tools/figure/extract-body.mjs base.obj body.obj
#   kept: body, 13,378 faces, 13,380 of 19,158 vertices referenced
#   dropped: 5,108 faces across 138 other groups

# 2 — OBJ to binary glTF
npx --yes obj2gltf@3 -i body.obj -o body-raw.glb --binary       # 452,280 B

# 3 — optimize for the web. Quantization only, no simplification: the full
#     13.4k quads keep the hands and face silhouette clean, and the file is
#     small anyway. KHR_mesh_quantization decodes natively in the vendored
#     three.js r185 GLTFLoader, so no decoder file has to ship.
npx --yes @gltf-transform/cli@4 optimize body-raw.glb wearer-body.glb \
  --compress quantize --simplify false --texture-compress false   # 268,640 B

cp wearer-body.glb ../site/assets/wearer-body.glb
```

A simplified variant (`--simplify true --simplify-ratio 0.6`) measured
161,616 bytes and was rejected: 107 KB was not worth the silhouette loss on
the one figure the page is about. For scale, the board GLB is 1.77 MB.

## Notes

- The source OBJ has no normals; the loader computes smooth vertex normals
  after merge (`site/assets/wearer-figure.js`).
- `--eyes` on the extract script also keeps MakeHuman's eyeball shells, in
  case the empty sockets read as holes in a render. The shipped build keeps
  only the body group; rebuild with `--eyes` if a render shows holes.
