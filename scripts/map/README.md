# Map image generator (WP9)

One-off local tool to export **Karta**, **Reljef** and **Satelit** WebP images for `MAP_FRAME` (see `shared/utils/games/mapFrame.ts`).

## Files

- `render.html` — open in a browser (file:// or local static server). Uses MapLibre GL from a pinned CDN build, `preserveDrawingBuffer: true`, container 1600×1373 CSS px at `devicePixelRatio` 1.
- After the map is `idle`, use the on-page buttons to download PNGs, then convert to WebP (~quality 75) with `cwebp` or `pnpm dlx sharp-cli` (do not add sharp to `package.json`).

## Layers

| Layer | Source |
| --- | --- |
| Karta | OpenFreeMap Positron — remove every `symbol` layer so no labels appear |
| Reljef | Same base at reduced opacity + Terrarium hillshade (`raster-dem`) |
| Satelit | DGU orthophoto 2023 WMS — **registered account required** for a watermark-free image |

Commit outputs to `public/potkalnicko-prigorje/karta/*.webp`. Until a clean Satelit export exists, keep `MAP_LAYERS` entry `available: false`.

## Frame check

`fitBounds([[west, south], [east, north]], { padding: 0, animate: false })` must match `MAP_FRAME`. Adjust zoom/center manually if `fitBounds` rounds.
