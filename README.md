# karlo-siladi.from.hr

Personal website of Karlo Siladi, built with [Nuxt](https://nuxt.com) and [Nuxt UI](https://ui.nuxt.com).

- **Homepage** (`/`): portfolio intro, Siladi Dizajn, project cards (including **Potkalnički zapisi** at `/potkalnicko-prigorje`) and a contact section.
- **Potkalnički zapisi** (`/potkalnicko-prigorje`): standalone Croatian heritage app (own layout, no portfolio chrome). The home shows a hero, counts for the five areas and a contribute band. Navigation: Igre · Istraži · Baština · Naš govor · Doprinesi · O projektu (each shown only when its section exists, see `shared/utils/pzNav.ts`). Submissions are stored in a database and reviewed before anything is published.
- **Games hub** (`/potkalnicko-prigorje/igre`): friend challenges as the main card, plus the flashcards and quiz.
- **Atlas** (`/potkalnicko-prigorje/istrazi`, `/bastina`): hub, five municipality pages (`istrazi/<opcina>`), 135 settlement pages (`naselja/<naselje>`) and a sacral-heritage list with item pages (`bastina/<naselje>/<slug>`). Items carry a verification badge from the database and a "Što još provjeravamo" note where applicable; thin generic names are `noindex` and left out of the sitemap. Public pages read the atlas through `/api/atlas/*` and the in-process content snapshot (`server/utils/publicContent.ts`); `content/atlas/*.json` remains as the import source and drift guard (`test/atlas.validate.test.ts`, `test/contentSeed.test.ts`).
- **Contribute** (`/potkalnicko-prigorje/doprinesi`): pick a contribution type, then the submission form (`?vrsta=rijec&rijec=<id>` prefills a word variant report; "Predloži ispravak" on a `bastina` item opens a correction prefilled with that item, stored as type `correction` with the atlas id in `target_ref`).
- **About** (`/potkalnicko-prigorje/o-projektu`): author, data controller, method and sources.
- **Privacy notice** (`/potkalnicko-prigorje/privatnost`): what the form collects, why, how long it is kept and how to ask for correction or deletion. Linked from the form.
- **Admin** (`/admin`): private dashboard after login at `/admin/prijava`, with a collapsible sidebar: **Pregled** (`/admin`), **Prilozi** (`/admin/prilozi`) for approving submissions, **Riječi** (`/admin/rijeci`) and **Riječ dana** (`/admin/rijec-dana`) on the content admin kit, **Baština: ispravci** (`/admin/bastina`) for heritage corrections with their target item, **Izvori** (`/admin/izvori`), **Izazovi** (`/admin/izazovi`), and **Povijest** (`/admin/povijest`), the change log across all content with restore. Not linked from the public site, disallowed in `robots.txt`, and protected by the review password plus a sealed httpOnly session cookie.
- **"Kaj to znači?"** (`/potkalnicko-prigorje/igre/kartice`): a word-card game. See a local word, guess what it means, flip the card to reveal the meaning and the regional variants with the places they are used. "Kod nas se kaže drugačije" (on the card back and below the card) opens a dialog for reporting how that word is said locally, without leaving the page.
- **Multiple choice** (`/potkalnicko-prigorje/igre/kviz`): choose a meaning, see correct/wrong feedback and the variants (after answering, "Kod nas se kaže drugačije" opens the same report dialog for that question's word), then continue through at most 10 questions to a scored result. The result leads with creating a friend challenge (same questions, creator's score already recorded), lists the missed words with their meanings, and offers a replay of just those misses (practice, not shareable) or a fresh round. "Podijeli rezultat" is a text link that expands a spoiler-free score with a row of green/red squares that names no words.
- **Asynchronous challenge** (`/potkalnicko-prigorje/izazov`): shareable fixed or quiz-result challenges with saved guest progress, answer explanations and a public leaderboard.

## Asynchronous heritage challenge

Choose **Learn** or **Challenge** on `/potkalnicko-prigorje/igre`. Learn opens the flashcards, while Challenge opens the multiple-choice quiz. The separate asynchronous challenge remains available from the games hub. Each asynchronous challenge gets a separate link, deadline and scoreboard. Enter a nickname, then share its link through WhatsApp, Viber, the native share sheet when available, or copy, before or during play. Everyone answers the same questions at their own pace. The quiz result action creates an immutable challenge from the active-word questions just played and records the creator's completed score immediately. A shared link opens the challenge introduction and nickname entry; completed participants see their saved result. The leaderboard lives at `/potkalnicko-prigorje/izazov/<code>/ljestvica` and remains public after closure. Every participant appears with current total and per-round scores and an in-progress, finished or incomplete status. The scoreboard is reachable before joining, during play, at finish and after closure. The challenge close date is shown throughout these screens. Equal totals share a rank (1, 1, 3); there is no speed tiebreaker. Leaderboard pages load 50 entries at a time.

The first content is explicitly **Uzorak / Sample**: 3 rounds × 5 multiple-choice questions with four choices, one correct choice and a short explanation. Word examples reuse the existing unverified sample seed. Other questions describe explicitly fictional places and stories, not factual claims about local heritage. Replace these before calling it a verified local quiz. There is no live host, game builder, timer, account, recovery or cross-device continuation.

### Editing content

Challenge sets are edited in the admin at **Izazovi** (`/admin/izazovi`, see [Content administration](#content-administration)) and stored in `heritage_challenge_templates`. Exactly one published template is **current**: every new fixed challenge copies it, so a change is live for the next challenge without a rebuild or deploy. [`content/heritage/challenge.json`](content/heritage/challenge.json) is only the seed of the first template (migration `20261103100000_challenge_templates.sql`) and is no longer read by the app. A template's content has this format (the JSON file also carries a `version`, which templates do not store):

```json
{
  "sample": true,
  "title": { "hr": "Naslov", "en": "Title" },
  "rounds": [{
    "id": "stable-topic-id",
    "topic": { "hr": "Tema", "en": "Topic" },
    "questions": [{
      "id": "globally-unique-question-id",
      "mechanic": "multiple-choice",
      "prompt": { "hr": "Pitanje?", "en": "Question?" },
      "options": [
        { "hr": "A", "en": "A" }, { "hr": "B", "en": "B" },
        { "hr": "C", "en": "C" }, { "hr": "D", "en": "D" }
      ],
      "correct": 0,
      "explanation": { "hr": "Objašnjenje.", "en": "Explanation." }
    }]
  }]
}
```

`correct` is a zero-based option index, not a letter. Topics and mechanics are separate. One validator (`shared/utils/content/challengeTemplate.ts`) serves the admin dialog, the admin API and every snapshot: both languages, two to four distinct nonempty choices, unique question IDs, 1–10 rounds, 1–20 questions per round and at most 248 KiB of content. Keep **Uzorak** (`sample: true`) on until every question has been curated and verified. A fixed challenge's snapshot adds `version` (the template's revision at creation) and `templateId`. Quiz-result challenges rebuild a trusted bilingual snapshot from active dictionary word IDs on the server. A challenge stores a complete immutable snapshot at creation: later template or dictionary edits affect only newly created challenges.

The server reads the current template through a small in-process cache (fresh for 60 s, one refresh at a time, the last good template kept if a refresh fails). Every admin write to a template drops it, so a switch is live on the next request in that process; with several processes the TTL bounds the delay. With no current template (or a broken one), the challenge introduction and creating a fixed challenge answer 503; joining and playing existing challenges never read templates.

### Progress, privacy and expiry

The server issues a random 256-bit participant token in an HttpOnly, SameSite=Lax cookie scoped to that challenge's API, lasting one year (Secure over HTTPS). Only its SHA-256 hash is stored in Supabase. Keep using the same browser; a nickname cannot claim another device's attempt. Clearing cookies loses access. Nicknames, progress and scores are public as soon as someone joins. Nicknames are display names, unique case-insensitively within a challenge, not verified identities. This does not prevent someone clearing cookies and joining as a different person. Do not put private information in a nickname. IP addresses are used for in-memory rate limiting and are not saved in challenge tables.

Each question is revealed separately by the server. Correct choices and explanations are withheld until that participant submits the answer or explicitly skips it. A correct answer earns 100, an incorrect answer or skip earns 0. Submitted answers are immutable; there is one scored attempt per participant token per challenge, and no restart/back operation. Running total and per-answer points appear during play, and per-round totals at each round end. The scoreboard is available at any time. Continue is explicit; feedback never auto-advances.

A revealed unanswered question stays current across reconnects, including closing a tab. There is no timer or browser-close detection. Seeing the same question again cannot preview future questions or reset progress. Server progress is saved after every reveal, answer and Continue, so breaks between rounds and accidental disconnects are supported.

Creation sets closure to exactly seven days later. Only submitting the final answer of a newly completed attempt can extend it: `min(created + 30 days, max(current closure, completion + 3 days))`. Visits, joins, incomplete rounds and repeat requests do not extend it. After closure the server refuses joining, revealing or answering; saved completed results, feedback navigation and the final leaderboard remain readable. There is no manual-close endpoint.

All transitions run through one server-only Postgres RPC (`heritage_challenge_action`); mutating actions take a challenge row lock, which serializes concurrent tabs and completions. State reads and the separate set-based `heritage_challenge_scoreboard` RPC are lock-free, so shared-link traffic never blocks active players. RLS is enabled; anon/authenticated roles have no table or function access. Creation and joins use the existing per-IP rate limiter (5 creates and 20 joins per 600 seconds); read/play requests allow 240 per 600 seconds. Override via `NUXT_CHALLENGE_RATE_LIMIT_CREATE`, `_JOIN`, `_ACTION`, `_WINDOW_SECONDS`. The existing single-proxy and process-local rate-limit limitations apply. Mutation bodies require JSON, Content-Length and at most 8 KB; cross-origin browser writes are refused.

### Verification and rollout

`node scripts/test-challenges.mjs` creates uniquely named disposable Postgres/PostgREST containers, applies all migrations in order, runs the real Nuxt HTTP/RPC behavior suite plus the daily word, content table, content import, word column, admin content API, change history, challenge template and public read layer suites, and removes only those containers. Docker is required; it never resets or migrates the shared local Supabase stack. CI runs this in addition to the regular tests. Coverage includes pre-answer secrecy, immutable submissions, concurrent answers, reconnects, progress ordering, skip scoring, token/nickname separation, ranks, snapshot isolation, expiry extension/cap, closed reads/refusals, public-role denial, validation and rate limits.

Rollout uses the existing automatic [production database workflow](.github/workflows/production.yml), which applies `20261031000000_heritage_challenges.sql` and the additive `20261101000000_challenge_scoreboard.sql` before advancing the deployment branch. Both versions are strictly later than the pending `20261030000000_submission_places.sql`. Follow the [baseline, secrets and recovery instructions](docs/database.md); do not apply this manually to production or deploy ahead of migration. The server uses the existing server-only Supabase key and returns 503 when it is unconfigured. No production migration or deployment is part of this change.

## Languages

The site is in Croatian and English via [`@nuxtjs/i18n`](https://i18n.nuxtjs.org): Croatian at `/`, English at `/en`. Texts live in `i18n/locales/hr.json` and `i18n/locales/en.json`. Both word games have a translated interface and use English meanings where available, falling back to Croatian; headwords, word types, examples and regional variants retain their original language.

## Heritage data

The games read active words and their area definitions from `GET /api/heritage/words`. `content/heritage/` holds the original sample seed:

- `words.json`: word entries. Each entry has a headword, meaning, word type, examples and its regional **variants**; every variant lists the areas where it is used (`usages`), so a usage map can be built later. Optional daily-word fields (category slug, bilingual note, hand-written distractors) use the same shapes as `WordEntry` in `app/types/heritage.ts`.
- `areas.json`: the place hierarchy (settlement → municipality or town → county → country).

The types are in `app/types/heritage.ts`. The current words are **sample data** (`"status": "placeholder"`): they are shown with an "Uzorak" (sample) badge, and their variants and places are examples that still need to be checked. Replace them with verified entries before launch.

The database holds 61 reviewed Kajkavian words, loaded by `20261102120000_reload_seed_words.sql`. It replaces the earlier sample seeds (`20261028010000_heritage_words.sql` and `20261101010000_seed_kajkavian_words.sql`, which stay untouched as history): the 61 rows they created are deleted (only while not linked to a submission) and the corrected list is inserted with fresh UUID ids. 51 are active and `verified`; the other 10 are inserted with `active = false` (status `placeholder`) so their corrected data is kept but hidden. Each word is used in Sveti Petar Orehovec and keeps its source credit; active words carry a proposed daily category. Examples, notes and distractors are left empty. Like every migration, it is applied by the [production workflow](.github/workflows/production.yml) on merge to `main` ([rollout](docs/database.md#seed-word-reload)), not by hand.

The games consume `useHeritage()` like the flip cards: prerendered HTML shows loading copy, the browser fetches active words at runtime, so activation does not require a rebuild. Failed requests show a retry control. `WordEntry` may optionally carry daily-word data—a category slug from `DAILY_CATEGORIES` in `shared/utils/dailyWord.ts`, a bilingual note and up to three hand-written wrong meanings. Review saves and public GET project them through `validateWord` in `shared/utils/word.ts`; invalid values reject admin saves or drop the word from the public list. The multiple-choice quiz still builds options with `pickDistractors` from other entries in the loaded deck (`app/utils/multipleChoice.ts` for questions and scoring; `shared/utils/multipleChoice.ts` for seedable shuffling and tests). Distractor selection prefers wrong meanings from the same part of speech, ignoring gender qualifiers, then fills from other words. Meanings are deduplicated after whitespace/case normalization in both the display language and Croatian. With two or three distinct meanings it offers fewer choices; with fewer than two it shows an explanatory empty state. Examples appear when supplied by the entry. Placeholder questions retain an explicit “Uzorak” / “Sample” label and notice.

Follow-up: use stored hand-written distractors in the multiple-choice quiz; random pool meanings remain the interim quiz source and do not guarantee equally plausible choices.

Contact details, social links and the Siladi Dizajn link are set in `app/app.config.ts` (`site`); empty values are hidden.

## Submissions

The form on `/potkalnicko-prigorje/doprinesi` posts to `POST /api/submissions`. The server checks the same rules as the form (`shared/utils/submission.ts`): the text is required (2 to 2000 characters), type, name and contact are optional and length-limited; place is one optional settlement of the five Potkalničko prigorje municipalities (Grad Križevci, Kalnik, Gornja Rijeka, Sveti Petar Orehovec, Sveti Ivan Žabno; 135 settlements) selected from the reviewed local catalog, and the consent checkbox for publishing is required. Each submission is stored with its consent, the version of the privacy notice it was given for (`PRIVACY_NOTICE_VERSION`), the page language, the time it was sent and a status: `pending`, `approved` or `rejected`. IP addresses are not stored.

Spam protection, without a third-party CAPTCHA:

- a hidden honeypot field: submissions that fill it in get a normal answer but are not stored;
- a per-IP rate limit, 10 submissions per 10 minutes by default;
- server-side validation and a 16 KB request size limit (requests without a `Content-Length` header are refused).

The per-IP limits take the client address from the rightmost `X-Forwarded-For` entry, the one added by the proxy in front of the app, or from the connection when the header is missing. This assumes exactly one proxy that appends to the header, as on Hostinger. Behind no proxy a client can set that entry itself, and behind several proxies every client shares the address of the last one, so the limits only hold with one proxy.

Admin login at `/admin/prijava` checks the review password (`NUXT_REVIEW_SECRET`) with constant-time compare and the same rate limit as the API. On success the server sets a sealed **httpOnly** session cookie (12 h, `secure`, `sameSite: strict`) using `NUXT_ADMIN_SESSION_PASSWORD` (at least 32 characters). The password is not stored in `sessionStorage`. Every `/api/review/*` and `/api/admin/*` route (except the session route) accepts that session or a `Authorization: Bearer` header with the review password, so the API stays closed without either (one middleware enforces it, see [Content administration](#content-administration)), and a client address is locked out for 15 minutes after 10 wrong passwords (with the single-proxy setup described above). If `NUXT_REVIEW_SECRET` is not set, or shorter than 16 characters, review is switched off. If `NUXT_ADMIN_SESSION_PASSWORD` is missing or too short, admin login fails closed.

Approving a submission alone does not publish it. Use “Dodaj u riječi / otvori skicu” to create a linked **inactive** word draft. Complete and explicitly activate it in `/admin/rijeci` before it can appear in the cards. Nothing is deleted automatically, and the privacy notice says so: it promises only that unpublished and rejected submissions are deleted by hand from time to time, and names or contact details when they are no longer needed or when someone asks. Delete whole submissions from `/admin/prilozi`; to remove only a name or contact from a published one, clear it in the table in Supabase (Table Editor), and remove any public credit separately in the word editor. Deleting a submission deactivates every word created from it and removes its contributor credit from the word; the word row is kept for re-review in `/admin/rijeci`. The submission list has no cap. When the notice changes, bump `PRIVACY_NOTICE_VERSION`: the notice shows it as its date.

### Croatian place selection

The form sends a selected `placeId` or null. Typed search alone must be selected or explicitly cleared. `GET /api/places` searches only those five municipalities' settlements in a versioned server-only GeoNames/DGU catalog; the submission server resolves the ID against the same catalog and derives the canonical snapshot/version. Client labels, country, coordinates and versions are not authoritative. Arbitrary free-text locations and unknown/foreign/inactive and out-of-scope IDs return a localized place-field error; cached old forms receive `refreshPlace` and retain their contribution text.

New submissions store `place` as `name (geonames:ID)` (unambiguous and below the existing 120-character limit), plus nullable `place_id` and `place_catalog_version`. Old `place` strings are untouched and displayed as legacy/unverified in review. Longer municipal/county context comes from the trusted current catalog and is labeled accordingly. There is no destructive backfill, GPS, map or nearest-town assignment. Environment variables are unchanged.

See [catalog provenance, full curation audit, licensing and quarterly updates](data/places/README.md).

#### Automatic migration-first rollout and rollback

1. On a staging copy, apply `20261030000000_submission_places.sql` after the existing word and withdrawal migrations. Verify accepted catalog IDs store canonical snapshots/version, omitted places remain null, unknown/foreign/inactive IDs and free text fail, and legacy rows remain unchanged and readable in review.
2. For the normal production rollout, use [the production workflow](.github/workflows/production.yml) and its [one-time setup](docs/database.md#one-time-production-setup-owner). With secrets and migration history configured, a push to `main` validates all migrations, applies pending files including `20261030000000_submission_places.sql`, then fast-forwards `production` to that exact commit. Hostinger builds the matching app/catalog from `production`. There is no separate hand-run picker migration in this flow; a missing-secret or stale-run skip is not a completed rollout.
3. If automation or Hostinger branch selection is unavailable, keep automatic deployment off and follow the [manual fallback](docs/database.md#manual-fallback) for the exact commit. Apply and verify pending migrations before promoting/deploying it; do not run manual migrations concurrently with the workflow.
4. After rollout, confirm the nullable `place_id` and `place_catalog_version` columns, original 120-character `place` check and RLS in Supabase. Verify HR/EN search/submission and canonical/legacy review rows using an approved synthetic entry, then delete that entry. Check both Actions and Hostinger's deployed SHA; a successful migration or branch promotion alone does not prove the app is live.
5. To roll back app code, leave the additive columns and old strings intact. An older app reads `place` snapshots and ignores the nullable additions; old-style inserts can still have null IDs and are labeled legacy/unverified by the picker version. Do not drop columns or rewrite history for an app rollback. Follow the deployment rollback/recovery notes in [docs/database.md](docs/database.md#failure-and-recovery).

`node scripts/test-place-migration.mjs` verifies the additive migration against an already-running local Supabase Postgres with the pre-migration schema, inside a transaction that is rolled back; it does not start/reset shared infrastructure or persist schema changes. Full `pnpm test:local-db` is for a dedicated local stack with the migration applied; default API tests use a fake Supabase and require no Docker.

### Database

Submissions are stored in [Supabase](https://supabase.com) (Postgres) through [`@supabase/supabase-js`](https://github.com/supabase/supabase-js), used only in server code (`server/utils/db.ts`): no Supabase key is ever sent to the browser. Everything is configured with environment variables, and the table and its access rules are managed by migrations in `supabase/migrations/`.

Production migrations run through [the production workflow](.github/workflows/production.yml) on pushes to `main`, before it advances the Hostinger deployment branch `production`. The owner must first configure the secrets, baseline the history of migrations previously applied through SQL Editor, and switch Hostinger to that branch. See [database setup, rollout and recovery](docs/database.md). Merging or deploying app code without this workflow configured does not apply migrations.

The table `heritage_submissions` has Row Level Security enabled. The public key and authenticated users have no access to it: the server uses **one secret key** for both `POST /api/submissions` and `/api/review/*`. That key bypasses RLS by design, so the form relies on its server validation, consent check, honeypot, rate limit and body-size cap. The table's check constraints (lengths, allowed values, consent must be true) still apply. Review routes also check the review password before accessing the database.

Without the Supabase URL or secret key, both submissions and review answer 503 and log which variable is missing. Admin and review APIs use `NUXT_REVIEW_SECRET` (and the admin session cookie), not Supabase Auth.

### Content tables

All site content is moving into the database so it can be managed in an admin. The first step, `20261103010000_content_tables.sql`, adds the tables without data and without any reader yet: `areas` (country, county, region, town, municipality and settlement in one hierarchy), `area_regions`, `heritage_categories`, `sources`, `heritage_items` with their ordered `heritage_item_sources`, and the shared `content_legacy_ids`, `content_slug_history` and `content_revisions`. Rows use UUID ids (deterministic ones from `content_uuid()` for imported rows), a database-managed `revision` for conflict detection, full change history and slug history for redirects; access is server-only, like every other table. The model, its rules and the rollout are in [docs/database.md](docs/database.md#content-tables).

The second step, `20261103020000_seed_content.sql`, imports the atlas once: the country, county and region Potkalničko prigorje, the town of Križevci and four municipalities (all five members of the region), 135 settlements with their DGU codes, GeoNames ids and centroids, 10 heritage categories, 10 sources and 107 heritage items with their ordered sources. Items also get the source dataset's period, registry number and heritage status, which `content/atlas/heritage.json` leaves out. Every row is published, and every old id (`krizevci`, the word-area key `hr-kkz-krizevci`, DGU codes, item ids with and without diacritics, source ids, category keys) resolves through `content_legacy_ids`. `scripts/generate-content-seed.mjs` renders the migration from the content files; `test/contentSeed.test.ts` fails when the committed migration and the files differ. The import is applied already wherever the migration ran, so do not regenerate it after merging: change content in the database instead (and do not re-run `pnpm atlas:import`, which rewrites the JSON). Details and rollout: [docs/database.md](docs/database.md#atlas-content-import).

The third step, `20261103030000_word_admin_columns.sql`, brings `heritage_words` under the same conventions while keeping its `text` id: every id must be a lowercase UUID string, and words gain a unique `slug`, a database-managed `revision`, `archived_at`, an accent-folded `search_text`, full history in `content_revisions` and slug history. Details are under [word administration](#word-administration-and-rollout) and in [docs/database.md](docs/database.md#word-admin-columns).

The public read layer serves this content to the site without a redeploy. Atlas pages, the dynamic sitemap and correction-target validation read it through `/api/atlas/*`, `/api/content/target` and `server/routes/sitemap.xml.ts`. `server/utils/publicContent.ts` keeps one in-process snapshot of the published atlas: the towns and municipalities that are members of the region Potkalničko prigorje, their settlements and heritage items, categories, sources, old ids and slug history. A snapshot younger than 60 seconds is served as is; an older one is served while one background refresh runs; `invalidatePublicContent()`, which the admin content kit calls after every create, update, archive/restore and delete of any content kind, makes the next request read the database again. A failed refresh keeps the last good snapshot; with no snapshot yet (a cold start while the database is unreachable) the API answers 503. Drafts are never read. A row is public only when it and every place above it are published; an archived row, or anything under an archived place, answers 410 at its old URL (an archived source drops off item pages and answers 410 as a correction target). `server/utils/publicAtlas.ts` answers from the snapshot without a database round trip:

- `GET /api/atlas/overview`: the region, its towns and municipalities (towns first, then by name) with settlement and item counts.
- `GET /api/atlas/municipalities/:slug` and `GET /api/atlas/settlements/:slug`: one place page (settlements with item counts, category counts, or the settlement's items).
- `GET /api/atlas/heritage?municipality=<slug>&category=<key>`: the heritage list with its filter options; an unknown filter is a 400.
- `GET /api/atlas/heritage/:settlement/:slug`: one item as `{ item }`, with its sources, the dataset fields and `ref` (the old item id that correction submissions use as `target_ref`; the UUID for items created later).
- `GET /api/content/target?kind=heritage_item|area|source&id=<uuid or old id>`: what a correction form points at; old ids such as `krizevci-crkva-sv-ane`, `krizevci` or a DGU code still resolve.

An old slug (from slug history, including a renamed settlement in front of its items and an item moved to another settlement) answers `{ redirect: <current path> }` for the page to send a 301. Paths in responses are unlocalized; labels such as "Grad Križevci" come from the kind and name. Successful answers carry `cache-control: public, max-age=60, stale-while-revalidate=300`; errors stay `no-store`. Response types are in `shared/types/publicAtlas.ts`. `server/routes/sitemap.xml.ts` builds the sitemap from the snapshot (static pages, live places and indexable item pages with `lastmod`), cached for ten minutes and invalidated on writes. A cold start with the database unreachable answers 503 on atlas pages and the sitemap; a running process keeps serving its last good snapshot. On Supabase free tier, schedule a daily keep-alive ping so the database does not pause (see [Deploying](#deploying)).

### Environment variables

Copy `.env.example` to `.env` for local development (`pnpm dev:local` does it for you). Never commit real values.

| Variable | What it is |
| --- | --- |
| `NUXT_SUPABASE_URL` | Supabase project URL, e.g. `https://<ref>.supabase.co`. Also read as `SUPABASE_URL`. |
| `SUPABASE_API_KEY` | One server-only Supabase secret key (`sb_secret_...`, or the legacy `service_role` key), used for submissions and review. Hostinger supplies it. |
| `NUXT_SUPABASE_SERVICE_ROLE_KEY` | Optional server-only override for `SUPABASE_API_KEY`. No duplicate key is needed. Local setup fills this automatically. |
| `NUXT_REVIEW_SECRET` | Password for admin login and review API access, at least 16 characters. Generate one with `openssl rand -base64 24`. |
| `NUXT_ADMIN_SESSION_PASSWORD` | Seals the httpOnly admin session cookie, at least 32 characters. Generate a separate random value; rotate it to invalidate all sessions. |
| `NUXT_CHALLENGE_RATE_LIMIT_CREATE` | Optional. Challenge creations per IP per window, default `5`. |
| `NUXT_CHALLENGE_RATE_LIMIT_JOIN` | Optional. Challenge joins per IP per window, default `20`. |
| `NUXT_CHALLENGE_RATE_LIMIT_ACTION` | Optional. Challenge read/play requests per IP per window, default `240`. |
| `NUXT_CHALLENGE_RATE_LIMIT_WINDOW_SECONDS` | Optional. Challenge rate-limit window in seconds, default `600`. |
| `NUXT_SUBMISSION_RATE_LIMIT_MAX` | Optional. Submissions per IP per window, default `10`. |
| `NUXT_SUBMISSION_RATE_LIMIT_WINDOW_SECONDS` | Optional. Rate limit window in seconds, default `600`. |

Nonempty `NUXT_` overrides win over `SUPABASE_URL` and `SUPABASE_API_KEY`. Keep the key in server environment variables; never put it in public runtime config or browser code. The runtime config defaults are empty, so production credentials can be supplied when the server starts.

### Analytics

Analytics use the [`nuxt-umami`](https://nuxt.com/modules/umami) module, configured in `nuxt.config.ts` with Umami Cloud (`https://cloud.umami.is`) and website ID `c554cf77-732f-4f2d-bfbc-5f0b78492f4c`. It runs in `cloak` proxy mode: the browser only talks to our own `/api/savory` route, which forwards to Umami, so ad blockers are less likely to drop events and the ID stays out of the client bundle. Tracking is limited to `karlo-siladi.from.hr` and ignores `localhost`. The module auto-tracks page views; `app/plugins/umami.client.ts` sets Umami's `umami.disabled` localStorage flag on `/admin` routes (see `shouldTrackPath`) so they are not counted. `NUXT_UMAMI_ID` and `NUXT_UMAMI_HOST` override the config. The site sets no Content-Security-Policy, so nothing needs allowing.

## Deploying on Hostinger

The pages are still prerendered to static HTML at build time, but the form and the review page need the API, so the site has to run as a **Node.js app**, not as static files. The build output is a Node server in `.output/` that serves both the prerendered pages and the API.

1. **Create the Supabase project.** On [supabase.com](https://supabase.com), create a project and note its region. Put the region into the privacy notice, where `[ZA PROVJERU: ...]` / `[TO CHECK: ...]` marks the spot in `i18n/locales/hr.json` and `en.json`. Free projects pause after about a week without activity, so check the form now and then.
2. **Set up migration history and automatic rollout.** Follow [the one-time database setup](docs/database.md#one-time-production-setup-owner): disable the existing app's auto-deploy from `main`, verify the schema, and record only already-applied migrations with `supabase migration repair --status applied`. Add `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` and `SUPABASE_PROJECT_REF` in **GitHub → Settings → Secrets and variables → Actions**. For an empty new database, bootstrap with the CLI as described there. Never re-run all SQL files against an existing database with empty CLI history.
3. **Create the Node.js app.** In hPanel, add a Node.js app for the domain and connect this repository (or upload the code). Use:
   - Node.js version: `^22.21.0 || ^24.11.0 || >=26.0.0`;
   - install and build: `pnpm install` and `pnpm build` (or `npm install` and `npm run build` if pnpm is not offered);
   - start command: `node .output/server/index.mjs` (entry file `.output/server/index.mjs`).
   Hostinger sets the port; the server reads it from `PORT`. For an existing app, keep its current runtime/build settings.
   **Deployment branch:** create `production` at the currently verified live commit, then change the Node.js app's tracked branch from `main` to `production` and enable auto-deploy only for `production`, following [the setup steps](docs/database.md#one-time-production-setup-owner). The workflow migrates on `main` and only then fast-forwards `production` to the same commit. Hostinger's Node.js GitHub App deployment has no documented deploy webhook; if branch selection is unavailable, keep auto-deploy off and use the [manual fallback](docs/database.md#manual-fallback).
4. **Connect Supabase.** In the Node.js app's settings use **Connect a database** and choose Supabase. The integration adds `SUPABASE_API_KEY` (the secret key) and the project URL (`SUPABASE_URL`). No second database key is needed. [Hostinger's connection guide](https://www.hostinger.com/support/connecting-a-supabase-database-to-a-hostinger-node-js-application/) describes the wizard and automatic environment setup; it does not document another URL variable name.
5. **Add review and admin session secrets** in the app's Environment variables: `NUXT_REVIEW_SECRET` (at least 16 characters) and `NUXT_ADMIN_SESSION_PASSWORD` (at least 32 characters, separate random value). `NUXT_SUPABASE_SERVICE_ROLE_KEY` is an optional override only; leave it unset to use Hostinger's key.
6. **Roll out and verify deployment.** Push to `main` (or run **Actions → Production database and deploy → Run workflow → main**). With secrets configured and history verified, Actions applies pending migrations, then advances `production`; Hostinger builds that commit. A missing-secret notice means rollout was skipped. A migration failure leaves `production` unchanged; inspect the Actions migration log and [recovery steps](docs/database.md#failure-and-recovery). Check Hostinger's build log too: a successful branch push does not prove the app is live. Redeploy after adding or changing these passwords, since variables are read when the server starts.
7. **Check it.** Send a test entry from `/potkalnicko-prigorje/doprinesi`, open `/admin/prijava`, sign in with `NUXT_REVIEW_SECRET`, check the entry under **Prilozi** and delete it. If either API answers 503, check the server log for the missing URL or secret-key variable and check the integration's Environment variables. Nothing is stored until Supabase is configured.

## Screenshots

Desktop and mobile, light and dark: [`docs/screenshots/`](docs/screenshots).

## Setup

Install the dependencies:

```bash
pnpm install
```

Start the development server on `http://localhost:3000`:

```bash
pnpm dev
```

Build for production and preview the build (the form and review page need Supabase here, see [Database](#database)):

```bash
pnpm build
pnpm preview
```

Check the code and run the tests (the API tests build the app first, so they take about half a minute):

```bash
pnpm lint
pnpm typecheck
pnpm test
```

`pnpm test` runs the API tests against a small fake of Supabase's REST API (`test/helpers/fakeSupabase.ts`), so it needs no Docker and runs in CI. It also mounts the quiz and flashcards in a Nuxt component environment with active words seeded through that fake, checking HR/EN questions, four choices, progress, loading, error/retry and limited-word states without a browser in CI, and exercises the browser-local heritage progress composable (`test/progress.nuxt.test.ts`). `pnpm test:local-db` runs the same API tests, plus `test/supabase.local.test.ts` (which checks the Row Level Security rules in the migration), against the real local Supabase stack; start it first with `pnpm db:up`.

## Local development

The app runs on your machine with `pnpm dev`; the database is the local [Supabase](https://supabase.com/docs/guides/local-development) stack (Postgres, the REST API and Studio), run in Docker by the Supabase CLI. Its configuration is in [`supabase/config.toml`](supabase/config.toml), and `supabase start` applies the migrations in `supabase/migrations/` to a fresh database. Only the services the site needs are enabled.

**Prerequisites:** Node.js `^22.21.0 || ^24.11.0 || >=26.0.0`, pnpm (`corepack enable`), Docker Desktop running, and the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) (`brew install supabase/tap/supabase`).

**First run:**

```bash
pnpm install
pnpm dev:local
```

`dev:local` creates `.env` from [`.env.example`](.env.example) if missing (`.env` is gitignored), starts the Supabase stack (the first start pulls the images, which takes a few minutes), writes its local URL and secret key into `.env` and then runs `pnpm dev`. Run the same command every day. Plain `pnpm dev` also works once the stack is up (`pnpm db:up`).

| Command | What it does |
| --- | --- |
| `pnpm db:up` | Start the Supabase stack, apply new migrations and write the local URL and secret key to `.env` |
| `pnpm db:down` | Stop the stack; data is kept |
| `pnpm db:reset` | Delete the data and re-apply all migrations to an empty database |
| `pnpm db:logs` | Follow the database logs |
| `pnpm db:shell` | Open a `psql` shell in the database container |
| `pnpm db:browser` | Open Supabase Studio |
| `pnpm test:local-db` | Run the tests against the local stack |

**Open it:**

- Site: <http://localhost:3000> (English under `/en`).
- Admin: <http://localhost:3000/admin/prijava>. The password is `NUXT_REVIEW_SECRET` from `.env` (`local-review-password` by default); the session cookie is sealed with `NUXT_ADMIN_SESSION_PASSWORD`.
- Supabase Studio: <http://127.0.0.1:54323>. Open **Table Editor** and the `heritage_submissions` table to see what the form stored.
- API: <http://127.0.0.1:54321>; the database itself is on `127.0.0.1:54322`.

**Test someone's PR:**

```bash
gh pr checkout <number>
pnpm install
supabase migration up --local   # apply additive changes without deleting local data
pnpm dev:local
```

**Reset:** `pnpm db:reset` forgets all local data and re-applies the migrations. After you add a migration, `pnpm db:up` or `pnpm db:reset` applies it.

**Stop:** press Ctrl+C to stop the app, then `pnpm db:down`. The data is kept in Docker volumes until you reset it.

The secret key in `.env` is the local stack's own demo key, refreshed by `pnpm db:up`; it works only against your machine.

## Content administration

The admin is built to manage every content type (places, heritage items, categories, sources, words, challenge sets) with one reusable CRUD kit. It has the dashboard shell, the kit and four resources so far: **Izvori** (sources), **Izazovi** (challenge templates), **Riječi** (full-screen `WordEditor`, server-side search and pagination, archive and delete with references) and **Riječ dana** (schedule and pin/unpin with confirmation dialogs; `/api/review/daily` unchanged). The other atlas resources follow on the same kit; public atlas pages read the database, so source edits in admin become visible on the next request after snapshot invalidation.

**Dashboard shell.** `app/layouts/admin.vue` is a `UDashboardGroup` with a collapsible, resizable `UDashboardSidebar` (entries in `app/utils/adminNav.ts`, logout and colour mode in its footer). Each page renders inside `<AdminPanel>` (navbar title, page actions, body). The login page uses its own `admin-auth` layout without the sidebar.

**API guard.** `server/middleware/admin-guard.ts` runs before every `/api/admin/**` and `/api/review/**` route (the path is decoded and normalized first). All of them need the admin session or the `Authorization: Bearer` review secret, except `/api/admin/session` itself. Unsafe methods (POST, PUT, PATCH, DELETE) there, including login, are refused with 403 when the browser sends an `Origin` of another host, and with 415 when they carry a body that is not JSON. Bearer scripts that send no `Origin` keep working. Handlers still call `requireReviewer` as defense in depth, and `test/api.test.ts` enumerates every file under `server/api/admin` and `server/api/review` and expects 401 without credentials.

**Generic content API** (`server/api/admin/content/[kind]/*`, kinds named as in the database: `source` and `challenge_template` today):

- `GET /api/admin/content/:kind?q=&page=&size=&sort=&status=&<filter>=` returns `{ rows, total, page, size }`. `q` (at most 100 characters) is accent-folded and matched against the trigger-maintained `search_text`; LIKE wildcards in it match literally. `size` is 25, 50 or 100; `sort` is a field name, `-` for descending; filters are whitelisted per kind. Anything else is a 400.
- `POST /api/admin/content/:kind` creates (201 `{ entity }`). The database sets the UUID, `revision`, timestamps and search text; ids, revisions and unknown fields in the body are ignored.
- `GET /api/admin/content/:kind/:id` returns `{ entity, legacyIds }` (old ids from `content_legacy_ids`). A non-UUID id is a 404.
- `PATCH /api/admin/content/:kind/:id` with `{ ...fields, revision }` applies the given fields on top of the stored row, validates the whole row and saves it only if it is still at `revision`. Otherwise it answers 409 `{ code: 'revision-conflict', current }`, and the dialog offers **Učitaj najnovije** or **Prepiši**.
- `DELETE /api/admin/content/:kind/:id?mode=archive` (the default) sets `status = 'archived'`: hidden publicly, references and history kept. `?mode=hard` deletes a row nothing refers to; while something does, it answers 409 `{ code: 'referenced', references }`.
- `GET /api/admin/content/:kind/:id/references` returns `{ blocking, groups }` with counts and up to five examples per referencing kind (for sources: heritage items citing them).
- `GET /api/admin/lookup/:kind?q=` (non-archived rows) or `?ids=a,b` (any status, at most 50) returns `{ items: [{ id, label, status }] }` for select menus.

Bodies are capped at 64 KiB (a kind may raise its cap; challenge templates allow 256 KiB) and need a `Content-Length`. Errors carry Croatian `data.message` and, for field problems, `data.issues: [{ path, message }]`. Database errors are mapped: unique violation → 409 on the field, foreign key → 409, check or trigger exception → 400, missing content tables → 503 `not-migrated`, anything else a logged 500. Every write is recorded by the database in `content_revisions` (actor `admin`); see **Change history** below.

Each kind is one registry entry (`server/utils/content/registry.ts`, `server/utils/content/kinds/*.ts`): table, editable field → column map, label column, the shared validator, sorts, filters, unique-constraint → field map, references query, an optional after-write hook (cache invalidation: challenge templates drop the cached current template), an optional body cap and the fields a history restore keeps (`restoreKeeps`). Validators live in `shared/utils/content/*.ts` (`validateSource`), so the dialog and the server apply the same rules and Croatian messages; their limits mirror the table's checks.

**Client kit.** A page describes its resource with `defineAdminResource` (labels, columns, filters, blank form, entity → form, validator, label, optional public path, extra row actions, a reason that locks archive and delete for a row, and a wide dialog for nested editors) and renders `<AdminResourcePage>` with a `#fields` slot (and optional `#<column>-cell` slots). The kit provides:

- the list: debounced search, filter selects, sortable headers, 25/50/100 per page, empty, loading and error states with retry, and a row menu (Uredi, Otvori javno for published rows with a public page, Arhiviraj or Vrati iz arhive, Obriši). All list state is in the URL (`q`, filters, `page`, `size`, `sort`), and so are open dialogs: `?uredi=<uuid>` and `?novo=1&<field>=<prefill>`;
- `<AdminEntityDialog>`: a modal `UForm` validated with the shared validator. The footer has Odustani, Spremi skicu, Objavi or Spremi, and Spremi i dodaj novo when creating. Ctrl/⌘+S saves. Server issues land on their fields. Closing with unsaved changes asks first. **Napredno** shows the UUID with a copy button, legacy ids, status and revision;
- `<AdminDeleteDialog>`: loads the references first. When something blocks a hard delete, **Trajno obriši** is disabled and **Arhiviraj** is the primary action;
- `useAdminConfirm()` with `<AdminConfirmDialog>` (through `useOverlay`): confirmation dialogs that replace every `window.confirm` in the admin, including rejecting and deleting submissions in Prilozi and Baština.

**Change history** (no migration; it reads `content_revisions`, which the audit triggers already fill):

- `GET /api/admin/content/:kind/:id/revisions?limit=&before=` returns the row's revisions newest first (20 by default, at most 50; `before` is the last `id` listed). Each has its action, actor, time and the fields it changed, compared with the revision before it (`{ field, before, after }`; a creation or deletion lists the fields that held a value). It also works for a deleted row, and returns `{ label, exists, currentRevision, hasMore }`.
- `POST /api/admin/content/:kind/:id/restore` with `{ revisionId, revision }` writes that stored version (the editable fields and status) back through the normal update path: the database bumps `revision`, the audit trigger records a new revision, nothing is rewritten. `revision` is the one the screen saw; a stale value is the usual 409. The stored version is validated with today's rules (400 with issues if it no longer passes), and a version equal to the current row is a no-op (`unchanged`). A hard-deleted row is recreated under its old id and creation time, with the revision count continuing; if something it points at is gone, the answer is a 409.
- `GET /api/admin/history?kind=&action=&actor=&entity=&page=&size=` is the global log (`{ rows, total, page, size }`), including imported rows and kinds without an admin resource yet (words, areas, heritage items), which can be read but not opened or restored until their resource exists.
- **Client.** `<AdminHistoryDrawer>` (a slide-over) lists the revisions with `<AdminHistoryChanges>` diffs and **Vrati ovu verziju** behind a confirm dialog. It opens from the row menu (**Povijest**) or `?povijest=<uuid>` on any resource page, and from `/admin/povijest` (`?zapis=<kind>:<uuid>`, filters `vrsta`, `radnja`, `autor`, `page`, `size` in the URL). A restore is a plain new revision, so it can be undone from the same list. Field and kind labels are in `shared/utils/content/history.ts`; a new `ContentKind` needs an entry in `HISTORY_FIELDS` (the type enforces it) and an admin page path. A structured field can give `entries`, which split its value into labelled parts, so the drawer lists only the parts that changed (a challenge set shows, for example, "Krug 2, pitanje 3 (en)" instead of two JSON blobs).

**Izazovi** (`/admin/izazovi`, kind `challenge_template`). The list shows each template's name, whether it is current, its rounds and questions (with an **Uzorak** badge) and the title players see. The dialog (wide) edits the name, the **Trenutni izazov** switch and the challenge set: title and Uzorak, then rounds (topic, move, remove) and their questions in collapsible cards (Croatian and English prompt, two to four choices that can be added, moved and removed with the correct answer following its choice, the correct answer and the explanation; copy, move, remove). The editor generates round and question ids, and every validation problem shows at its own input. Removing a round or a filled-in question asks first. **Postavi kao trenutni** in the row menu switches the current template after a confirmation. The current template cannot be archived, deleted, unpublished or switched off; the row menu shows those actions disabled with the reason, and the database refuses them anyway. A restore from the history changes the questions, never which template is current. Nothing refers to a template (challenges keep their own snapshots), so any other template can be deleted.

**Adding a resource:** a validator in `shared/utils/content/`, a definition in `server/utils/content/kinds/` registered in `registry.ts`, the kind in `CONTENT_KINDS`, a page under `app/pages/admin/` using `<AdminResourcePage>`, an entry in `ADMIN_NAV` and the labels in `HISTORY_FIELDS` and `HISTORY_KIND_META`. No new API routes are needed; history and restore work from the definition's `fields`. A kind whose editable state includes link tables (for example item sources) must add that state to its definition before its restore is complete, because snapshots hold only the row itself.

**Tests.** `test/adminContent.test.ts` covers the validator, folding and guard paths. `test/adminKit.nuxt.test.ts` covers the list, dialogs, conflicts, unsaved-changes guard, delete with references and the confirm dialog. `test/api.test.ts` covers the guard. `test/contentHistory.test.ts` covers the diff and vocabulary helpers, `test/adminHistory.nuxt.test.ts` the drawer, restore flow and log page, and `test/contentHistory.integration.test.ts` history, restore and the log over real Postgres. `test/adminContent.integration.test.ts`, run by `node scripts/test-challenges.mjs`, covers the API over real Postgres: triggers, revisions, folded search, foreign-key restricted delete, archive and lookup. For challenge templates, `test/challengeTemplates.test.ts` covers the seed, the shared validator and the editor operations, `test/adminChallenges.nuxt.test.ts` the page, nested editor and row actions, and `test/challengeTemplates.integration.test.ts` the migration's rules, the admin API, switching the current template, new challenges using it and restore.

## Word administration and rollout

`heritage_words` stores a bounded JSONB `entry` in the existing `WordEntry -> Variant -> AreaUsage` shape, plus a JSONB array of `Area` definitions. This keeps nested edits atomic and avoids separate variant/usage save operations in this first editor. `active`, `submission_id`, `submission_place`, `created_at` and `updated_at` are separate moderation columns. The id is a lowercase UUID string (checked by the database; the app creates ids with `randomUUID()`). Since `20261103030000_word_admin_columns.sql` the database also keeps admin columns that the app does not use yet: `slug` (unique, generated from the first non-blank headword, homographs get `-2`, `-3`; kept when the headword changes, for future dictionary pages and admin links), `revision` (bumped on every update, so a save can detect a concurrent edit), `archived_at` (activation clears it) and `search_text` (accent-folded headword, forms and meanings). Every insert, update and delete is copied to `content_revisions` as kind `word`, starting from a baseline snapshot of the words that existed when the migration ran, and a changed slug is kept in `content_slug_history`. Area IDs are stable across entries; reuse the same definition for the same ID. New settlements can be added in the editor's advanced area definitions, with their parent chain. This is not a settlement importer or catalog.

The additive migration `20261028010000_heritage_words.sql` enables RLS with no anon/authenticated grants, and seeds the nine existing examples as active `placeholder` entries. They retain the visible “Uzorak” labels. Only the server's existing service-role key accesses the table. There are **no new environment variables**.

Editorial rules:

- Promotion is idempotent per submission: repeated clicks open the same word. Word/expression text becomes the headword (with the full text also retained as an example when longer than 200 characters); memory/other text becomes an example. The canonical place snapshot is retained as a private draft note; explicitly mapped catalog IDs prefill an existing reported usage. Other selected places and unrecognized legacy free-text places need an editor-selected area. Only an explicitly supplied contributor name becomes a public credit. Contact is never copied.
- Drafts may have missing fields. Activation requires a headword, Croatian meaning, part of speech, a first variant matching the headword and at least one source. Areas are optional: a variant without usages is displayed for the whole region (Potkalničko prigorje) as a display fallback only, and no region usage is stored. Optional daily-word fields validate when present: category must be a known slug, notes are at most 1000 characters per locale (Croatian required when English is set), and distractors are at most three rows with 200-character `hr`/`en` texts that must differ from the meaning and from each other across both locales. The server validates all nested types, statuses, references and limits, even when the browser is bypassed. Requests are capped at 128 KiB; variants at 30, usages per variant at 30, areas at 50, examples/sources/tags at 20 each. Headwords/forms are at most 200 characters, meanings/examples 2000, credits 300, usage notes 500. Audio must be an HTTPS URL.
- A database trigger marks the linked submission approved **in the same transaction when a word becomes active**. Saving an inactive draft never approves it. Deactivation preserves the word, its sources and the submission's approval history. Rejecting or deleting a submission deactivates its linked words (migration `20261029000000_heritage_submission_withdrawal.sql`, so direct database edits behave the same); deletion also strips the contribution credit. Words stay in the admin for re-review.
- The admin list loads 50 words per page, with “Učitaj još 50”. Search/filter apply to loaded entries. The list shows the entire entry, area definitions, public credit, private originating submission/place and timestamps, plus a **Riječ dana** readiness badge (example, category, distractors). Distractor readiness counts hand-written options and automatic picks from the full active catalog; a refresh paginates that catalog separately so the table still loads if a later page fails. No hard-delete API is provided.
- Public GET returns `{ words, areas }`, defaults to 100 entries and accepts `limit=1..100`. It selects active rows and explicitly projects the public `WordEntry`/`Area` fields; malformed direct database edits are omitted. Submission IDs/places, activation flags, timestamps and arbitrary extra keys are never included. The browser and shared cache may retain an entry for up to **30 seconds** after deactivation. Already-open games retain their loaded deck until reload. The homepage and flip-card page fetch after mounting, including when their HTML was prerendered, and show loading/empty/error states without falling back to static words.

### Daily word (Riječ dana) schedule and API

`GET /api/heritage/daily` returns today's word for everyone: `{ day, number, nextAt, sample, entry, areas, villageAreaId, options, correctOptionId, clues }`. The day is the **Europe/Zagreb** calendar date decided by the server, and `nextAt` is the next Zagreb midnight (UTC), so DST days of 23 and 25 hours work. The entry and areas use the same public projection as `/api/heritage/words`; no submission data, flags, timestamps or extra keys are returned. The correct option is in the payload by design, because v1 results are personal and kept on the device. The route is public, has no day parameter, and answers 404 `not-started` before `DAILY_WORD_EPOCH` (`2026-11-02`), 404 `no-words` when nothing playable exists, 503 without a configured database and 500 on a database error. Its cache header is `public, max-age=N, s-maxage=N, must-revalidate` with N at most 30 seconds and never beyond the end of the day.

The first request of a day resolves and **persists** it in `heritage_daily_words` (`server/utils/dailyWord.ts`); a hash of the date alone would change past and future days whenever words were activated. Selection:

- Candidates are all active, valid words, read in pages of 1000 (not the 100-row public list), minus every word used on another day, minus words pinned for a future day and words replaced earlier.
- **Tier A** is daily-ready words (example, category and three wrong answers available). **Tier B** is any other unused word, with labelled substitute clues: other forms or word type instead of a missing example, word type or usage places instead of a missing category.
- Within a tier, about one pick in seven (`DAILY_VILLAGE_SHARE`) is a village-specific word (all usages map to exactly one settlement or municipality) when both kinds exist; the rest are region-wide. The pick is seeded by the day, so concurrent requests and processes compute the same answer, and the primary key admits one insert.
- **Tier C**, when every active word has been used: repeat the least recently used word that is not pinned for the future (if none remains the API answers `no-words` rather than serve a reserved word). The admin card warns when fewer than 14 days remain without a repeat.
- Options (four where possible, in a day-seeded order with ids `a`–`d`), clues and the meaning shown in the reveal are frozen in the row, so edits apply from the next day. A pin is an unresolved row for a future day; an inactive or unplayable pin is skipped and recorded in `replaced_word_ids`. A word deactivated or withdrawn during its day is replaced once, and the old id is recorded.

The guard trigger refuses to delete or move a resolved day, to change its snapshot, or to change its word except by this audited replacement. Rollout, the migration timestamp and rollback are in [docs/database.md](docs/database.md#daily-word-schedule-rollout). `NUXT_DAILY_WORD_EPOCH` optionally overrides the constant (the HTTP tests use it; a future date hides the feature); leave it unset to use the constant. The daily word is playable as the first block of the games hub (`/potkalnicko-prigorje/igre`, `HeritageDailyWord`): progressive clues, guesses against the frozen options, a reveal, then (after the round) a spoiler-free share (`Riječ dana #N: 2/3` with a square per try, to copy, native share, WhatsApp and Viber through the shared `HeritageShareButtons`, linking to the games hub), personal stats (streak, days played, percent correct and a tries distribution), a countdown to the next day and three next steps (Learn more, Play a quiz, Challenge a friend, which opens the quick quiz whose result creates the 7-day friend challenge). The Words flagship card on the hub carries a one-line status (`HeritageDailyStatus`: waiting, or today's result with the streak and countdown). Results stay in the browser (`useDailyProgress`, localStorage key `ksh.heritage.daily.v1`). Before the epoch the section stays hidden behind the `not-started` 404. Pins are managed in the admin (below).

#### Pinning words to dates (reviewer only)

`/admin/rijeci` has a "Riječ dana" card, and every active word has a "Prikvači za datum" action that fills its form. The routes behind it use the same review authentication as the other review routes (401, 429 after repeated wrong secrets, 503 when review or the database is not configured):

- `GET /api/review/daily` returns `{ day, today, recent, pins, runway, warnings }`: today's row (or `null` until the first visitor opens the word), the last 30 resolved days, every row after today, and warnings in Croatian. The runway is counted on the server over **all** active valid words (not the 50-row admin page): `readyUnused`, `unused`, `active`, and `daysLeft` (unused words plus active pins). It warns under 14 days left, and separately when fewer than 14 unused words are fully daily-ready.
- `PUT /api/review/daily/YYYY-MM-DD` with `{ wordId, village?: 'auto' | 'none' | <one of the word's area ids> }` (8 KiB maximum) writes an unresolved `pinned` row, which the resolver turns into the day's word on its first request. Only days after today in Europe/Zagreb and at most 366 days ahead are accepted (400); the word must exist (404) and be active and valid (400). It refuses a day whose row is already resolved (409) and a word already pinned for another future day (409). Pinning a word that was shown before is allowed and returned as a `previously-used` warning, as is a word lacking an example, category or wrong answers (`pin-not-ready`, substitute clues will be shown). Re-pinning an unresolved day replaces its word.
- `DELETE /api/review/daily/YYYY-MM-DD` removes an unresolved row for a future day (404 if none, 409 if it was resolved in the meantime, 400 for today and the past).

After the reveal the daily word offers two contributions (`HeritageDailyContribute`): **Kod nas se kaže drugačije** (a local form) and **I u mom mjestu se tako kaže** (a confirmation that the word is used in the sender's place). Both open the usual inline form (`HeritageSubmissionForm`) and send `wordId` and `intent` (`variant` or `usage`) with the submission. `validateSubmission` requires a word when an intent is set, and a place for `usage` (`selectPlace`). `POST /api/submissions` then answers 400 unless the word exists and is **active**; the honeypot and the rate limit run first and are unchanged. `/admin/prilozi` shows the linked word (linking to its editor) and the intent, and hides "Dodaj u riječi / otvori skicu" for a usage, since that would create a duplicate word (the promote route refuses it too). The columns come from `20261103000000_submission_word_link.sql` (see [docs/database.md](docs/database.md#submission-word-link-rollout)); the privacy notice describes the link and the device storage, and `PRIVACY_NOTICE_VERSION` was bumped for it.

Pins are checked in the application, not in SQL, so the one-pin-per-word rule is not atomic across two simultaneous requests.

Migration-first production sequence (operator action, **not performed by the app or this change**):

1. Back up the database and inspect the target and applied migration history.
2. Apply the new migration, verify the nine placeholder rows, RLS and missing anon/authenticated grants. Existing app code remains compatible with the added table.
3. Deploy the app with the existing server URL/key and review secret. Verify unauthenticated word-admin requests fail, a promoted fixture remains private until explicit activation, and deactivation removes it from a fresh public GET after the cache window. Remove the fixture afterward.
4. Roll back app code first if needed. Leave the additive table, data and trigger in place; the old app ignores them and continues reading its bundled static samples. That older app does not reflect word-admin deactivations. Do not drop the table to roll back code, and do not delete production submissions or reset the database. If the migration is missing, new word APIs fail closed with a database error and the cards show unavailable; they do not publish a fallback deck.

Local verification: use `supabase migration up --local` on an already running local stack, then `pnpm test:local-db`; this runs real HTTP API tests and RLS tests with both anonymous and authenticated clients. `pnpm test` runs the same API behavior against the PostgREST fake without Docker. Run `pnpm lint`, `pnpm typecheck` and `pnpm build` as well. Never reset/stop a local stack shared with other worktrees.

Follow-up TODOs:

- Generalize the card-game engine to support games beyond this particular word model, after the first simple version.
- Add deck pagination/selection if more than 100 active words are curated. The current game consumes the first bounded deck, ordered by stable ID.
