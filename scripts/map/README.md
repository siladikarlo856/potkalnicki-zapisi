# Map image generator (WP9)

One-off local tool to export **Karta**, **Reljef** and **Satelit** WebP images for `MAP_FRAME` (see `shared/utils/games/mapFrame.ts`).

## Files

- `render.html` — open in a browser (file:// or local static server). Uses MapLibre GL from a pinned CDN build, `preserveDrawingBuffer: true`, container `MAP_FRAME.width`×`MAP_FRAME.height` CSS px at `devicePixelRatio` 1. The frame is passed in the query string (`capture.mjs` reads it from `mapFrame.ts`; nothing is duplicated). `?layer=karta|reljef` renders that layer alone and sets the page title to `ready` when the tiles have loaded.
- `capture.mjs` — drives headless Chrome through `render.html` (no dependencies, Node 22; imports `mapFrame.ts` through Node's built-in type stripping): `node scripts/map/capture.mjs reljef /tmp/reljef.png`.
- Then convert the PNG to WebP at quality 75: `cwebp -q 75 -m 6 /tmp/reljef.png -o public/karta/reljef.webp` (or `pnpm dlx sharp-cli`; do not add sharp to `package.json`).
- `fetch-boundaries.mjs` — fetches the five municipalities' OpenStreetMap administrative boundaries from Overpass, projects and simplifies them into `MAP_FRAME` pixels and writes `shared/utils/games/mapBoundaries.ts` (`node scripts/map/fetch-boundaries.mjs`). Run it only when the boundaries change.

## Layers

| Layer | Source |
| --- | --- |
| Karta | OpenFreeMap Positron — remove every `symbol` layer so no labels appear |
| Reljef | Same base turned down to a pale paper tone + Terrarium hillshade (`raster-dem`, AWS open Terrain-Tiles) under the roads |
| Satelit | DGU orthophoto 2023 WMS — **registered account required** for a watermark-free image |

Commit outputs to `public/karta/*.webp`. Until a clean Satelit export exists, keep `MAP_LAYERS` entry `available: false`.

## Frame check

`fitBounds([[west, south], [east, north]], { padding: 0, animate: false })` must match `MAP_FRAME`. Adjust zoom/center manually if `fitBounds` rounds.
