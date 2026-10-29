# Croatian settlement catalog

This is the catalog for the optional, single settlement where a word/expression is used. It does not identify a contributor’s home or GPS position. The sample word-card `content/heritage/areas.json` is a separate dataset.

`server/data/places/hr.json` is loaded once on the server. The browser receives only bounded search results from `GET /api/places`: minimum two characters, maximum 80, a fixed cap of eight results (no client-selectable limit), and 120 requests per minute per client address. No API key, hosted geocoder, map or runtime/build data download is needed. Croatian labels are preserved; search folds accents and supports both d/dj for đ. Existing submission consent, payload cap, honeypot and submission rate limit are unchanged.

## Sources and rights

See [sources.json](sources.json) for exact URLs, retrieval/source dates, SHA-256 checksums and the snapshot version; [LICENSE.md](LICENSE.md) contains data attribution and license links. GeoNames HR country and alternate-name archives supply namespaced source IDs and source coordinates. The DGU administrative-unit download supplies official settlement eligibility, Croatian canonical labels and municipal/county relationships. DGU’s Open Data page explicitly lists this exact AU feed under its Open Licence; the feed’s generic INSPIRE access notice is recorded in the manifest too.

The requested [2019 gist](https://gist.github.com/hrvojesimic/2139c154ba76756b190e085782a70a84) was inspected: 556 city records with county labels, coordinates and population fields, no municipal relationship or source IDs, no upstream attribution and no license statement. No data from it is imported or used in eligibility/corrections. Its coverage and county naming differ from the DGU reference (6,759 settlements; for example `Zagreb, Grad` versus `Grad Zagreb`). A public gist is not a reuse grant. No source is inferred from its schema.

## Reviewed curation rules and complete audit

- Only HR populated-place records with active singular codes are considered. PPLH/PPLCH, PPLQ/PPLW and plural PPLS are excluded. Farms, populated localities and GeoNames sections qualify only when independently matched to an official DGU standalone settlement; a raw PPL/PPLX flag alone is never enough.
- Match an exact accent/dash-normalized name or source alias to an official settlement **and** either containment in its official polygon, or exact source municipality and county names/aliases. There is no nearest-town assignment, fuzzy name match or automatic geocoding. The GML’s EPSG:3035 axis order is handled explicitly.
- 148 accepted source centroids fall outside the matched official boundary. Identity is established by exact name, municipality and county. Coordinates are retained unchanged and flagged `centroidOutsideOfficialBoundary`; they need review before a future map. They are source points, not usage boundaries or contributor addresses.
- Multiple source records matched to one official settlement are consolidated by preferring a matching municipal parent, then standalone code over locality/section, then reported population, then source ID for a stable tie-break. Dropped duplicates remain in the catalog as inactive records with `duplicateOf`. They cannot be selected in a new submission.
- Canonical labels/parents come from DGU; source spelling remains an alias. Search aliases use nonhistorical Croatian, Italian and untagged GeoNames alternate names, excluding links, ended names, postal and airport codes.

The reviewed rules produce 6,680 active settlements from 11,631 populated-place source features, with 65 merged duplicates and 4,886 explicitly listed exclusions. Every source feature has one decision in [curation.json](curation.json), including ID, original name/code, reason, official identity/evidence, and every label/parent before→after change. Exclusions are eligibility failures or unresolved identities; absence of a municipal parent is never, by itself, an exclusion rule.

[dgu-settlements.json](dgu-settlements.json) is the normalized 6,759-settlement official reference. [unrepresented-official.json](unrepresented-official.json) explicitly lists 79 official settlements without a confirmed active source identity. Do not infer that an official settlement is abandoned merely because it is absent from this catalog. The catalog is reviewed coverage, not a completeness guarantee. Report missing places for a later data PR; never assign a nearby place automatically.

The required sample covers Križevci, Sveti Petar Orehovec and surrounding villages (including Ferežani, Miholec, Brezje Miholečko, Gregurovec and Zamladinec), Čakovec, both Novigrads, Vis, Lastovo, Ilok and Bregana. Zamladinec keeps `geonames:12509636`; its duplicate `geonames:12509635` is inactive. Trsat `3188728` and the mislabeled municipality Dubrovačko primorje `7732866` are excluded.

## Reproduce / update explicitly

Use Python 3.14 and a separate virtualenv, outside the application tree:

```sh
python3 -m venv /tmp/hr-place-import
/tmp/hr-place-import/bin/pip install -r scripts/places-requirements.txt
# Download the three archives to a scratch directory using the exact URLs in sources.json.
# Verify/preserve the pinned bytes; GeoNames download URLs are updated daily.
/tmp/hr-place-import/bin/python scripts/import-places.py \
  --hr /scratch/HR.zip --aliases /scratch/HR-alternate.zip --dgu /scratch/dgu-au.zip
```

Inputs must match the pinned SHA-256 values. The 219 MB DGU archive is deliberately not a repository/build dependency; its normalized reference and the complete reviewed decisions are committed. The same pinned archives reproduce the committed outputs. `--output /tmp/reproduced` writes comparison outputs without changing the working tree. Archived source bytes must be retained by the data maintainer for future reproduction; a newer download must not be substituted under an old version.

Review updates quarterly, via a data PR. Download fresh sources and terms to scratch, review feature definitions, dates, licenses, additions, exclusions, duplicate decisions, municipal changes, alias changes and coverage gaps, then intentionally update the manifest version/checksums and pinned reference count in the importer. `overrides.json` is the explicit ID→official-code correction layer for future individually evidenced exceptions; it is currently empty. Each override must contain `officialCode`, `reason` and an evidence URL. The full deterministic curation layer records decisions even when no individual override is necessary.

Keep previous catalog records for removed IDs with `active: false`. Do not recycle/reassign IDs or silently redirect a submitted retired ID; return the localized place-field error. Historical review uses the stored snapshot/version and can look up retired IDs. An original name is kept in the submission snapshot; current administrative context is labeled as current. Nonhistoric source names and reviewed explicit aliases may be added without changing IDs.

Run `pnpm test` after data changes, inspect the audit diff and source/license changes, and repeat desktop/mobile HR/EN form checks. Normal tests and production builds use committed JSON and make no geocoder/download calls.
