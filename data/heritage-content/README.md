# Reviewed church content

`churches.json` holds reviewed content for 29 heritage items of the atlas: 25 churches, the Greek Catholic cathedral and 3 chapels in the five municipalities of Potkalničko prigorje. For each item it holds a Croatian description, the period, the registry number, the heritage status, research notes, cited sources and, for 14 of them, a photo from Wikimedia Commons with its credit. `scripts/import-heritage-content.mjs` puts it into a running site through the admin API, the same routes the admin screen uses. Nothing in it is a migration: content lives in the database and this file is only the reviewed input.

## What the texts are

The descriptions are original Croatian summaries written for the atlas from facts in the cited sources. They are not copies or translations of a source text.

- **Registar kulturnih dobara RH** (Ministry of Culture and Media) states no reuse terms for its texts or photos. Its facts are cited with a deep link to the record (`https://registar.kulturnadobra.hr/#/details/Z-…`); none of its text or photos is used. A request for written permission is being prepared separately.
- **Hrvatska Wikipedija** text is CC BY-SA 4.0. Its facts are reused, not its text, and each item cites the exact article revision (`?oldid=`) the facts were taken from.
- **Hungarian Wikipedia** village articles mostly translate the register or the town's website, so they are only a pointer. A fact found only there is a research note to confirm, never part of a description.

Where sources disagree (dates, dedication, chapel or church), the description says only what they agree on and the disagreement is a research note. Research notes are public: the item page lists them under "Što još provjeravamo".

## Photos

Every photo comes from Wikimedia Commons under a licence on the allowlist (public domain, CC0, CC BY or CC BY-SA, any 2.0 to 4.0 version). Most are by Fraxinus (taken in 2016 and 2017, CC BY-SA 4.0). For each photo the dataset records the Commons file, the SHA-1 of the reviewed file version, the author, the author's page, the licence and the file page. The site shows that credit under the photo on the item page and on `/o-projektu/fotografije`.

The import does not link to Commons. It checks that the file on Commons still has the reviewed SHA-1 and the reviewed licence, downloads Commons' own 1600 px and 480 px JPEG renderings and uploads them through `POST /api/admin/images`, so the site serves its own copies. A file that changed on Commons since review is skipped and reported; the rest of the item is still imported.

## What the import changes

It only adds and never overwrites an editor's work:

- the description, period and registry number are filled only when the item has none; a different stored value is kept and reported;
- the heritage status becomes "protected" only from no status or "needs verification";
- research notes, sources and the photo are appended unless they are already there.

A second run therefore changes nothing. Sources are created once, published, and found again by their URL. The three records under `notesOnly` only get a research note: they are suspected duplicates (Apatovec "Crkva sv. Petra" and "Kapela sv. Petra (starija kapela sv. Helene)"; Kalnik "Kapela sv. Katarine" and "Sakralni lokalitet unutar utvrde"), and the import never deletes or merges an item.

Nine items had no registry number in the inventory although the register holds them: Z-2076, Z-2078, Z-1901, Z-2079, Z-2183, Z-2075, Z-7514, Z-2455 and Z-2577 (`review.registryNumberWasMissing`).

## Running it

The import authenticates with the review password (`NUXT_REVIEW_SECRET`) as a Bearer token. Read it into the environment without echoing it, so it does not land in the shell history, then do a dry run first:

```sh
read -rs NUXT_REVIEW_SECRET && export NUXT_REVIEW_SECRET
node scripts/import-heritage-content.mjs --base https://prigorje.karlo-siladi.from.hr            # dry run: reads only
node scripts/import-heritage-content.mjs --base https://prigorje.karlo-siladi.from.hr --apply    # imports
unset NUXT_REVIEW_SECRET
```

The dry run reads the items, the sources and the Commons file pages and prints, per item, what it would change and what it would keep. `--only <settlement-slug>/<item-slug>` limits a run to one item, and `--dataset <file>` reads another file of the same shape. The exit code is 1 when an item was not found or failed. Every save goes through the content API, so each change is in the item's history and can be restored from the admin.

The production site needs the photo migration (`20261109000000_heritage_item_images.sql`, see [docs/database.md](../../docs/database.md#heritage-item-photos)) before the import, or the item saves fail.

## Fields

- `sources`: the cited sources by key, as the admin's source form takes them (`title`, `type`, `url`, `note`).
- `items[]`:
  - `key`: `<settlement slug>/<item slug>`, as in the item's public URL;
  - `name`: the item's name, only compared with the stored name and never changed;
  - `description`, `period`, `registryNumber`, `heritageStatus`;
  - `researchNotes[]`, `sources[]` (source keys);
  - `photo`: `commonsFile`, `sha1`, `alt`, `caption`, `author`, `authorUrl`, `license`, `sourceUrl`;
  - `review`: not imported. Holds the source tier, the sources the text rests on, whether the registry number was missing, and the open questions for the owner.
- `notesOnly[]`: `key`, `name` and `researchNotes[]` for items that only get a note.

`test/heritageContentImport.test.ts` checks the dataset (free licences only, valid sources, every record importable through the real validators) and runs the import against a fake admin API and a fake Commons.
