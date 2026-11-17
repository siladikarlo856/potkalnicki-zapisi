WP15 phone screenshots (390×844) for map challenge questions.

**Map asset:** `public/karta/karta.webp` must be a real Positron export from `scripts/map/render.html` (see `scripts/map/README.md`). A flat gray placeholder produces useless captures.

Regenerate locally:

```bash
pnpm dev --host 127.0.0.1 --port 3456
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
BASE='http://127.0.0.1:3456/izazov/preview-map-pitanje'
"$CHROME" --headless=new --hide-scrollbars --window-size=390,844 \
  --run-all-compositor-stages-before-draw --virtual-time-budget=60000 \
  --screenshot=docs/learn-play/screenshots/wp15-challenge-map-light-390.png \
  "${BASE}?theme=light"
"$CHROME" --headless=new --hide-scrollbars --window-size=390,844 \
  --run-all-compositor-stages-before-draw --virtual-time-budget=60000 \
  --screenshot=docs/learn-play/screenshots/wp15-challenge-map-dark-390.png \
  "${BASE}?theme=dark"
```

The preview route (`preview-map-pitanje.vue`, `noindex`) uses the same `GamesMapView` + option layout as `ChallengeExperience` during play.

If headless Chrome captures a blank map, use Puppeteer with `networkidle0`, wait for the map `<img>` to load, rasterize via canvas (`createImageBitmap` → `toDataURL`), then screenshot — see `firstmate` task scratch `ksh-lp-15/capture/capture-wp15-screenshots.mjs`.
