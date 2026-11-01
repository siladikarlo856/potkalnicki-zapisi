# karlo-siladi.from.hr

Personal website of Karlo Siladi, built with [Nuxt](https://nuxt.com) and [Nuxt UI](https://ui.nuxt.com).

- **Homepage** (`/`): portfolio intro, Siladi Dizajn, project cards (including **Potkalnički zapisi** at `/potkalnicko-prigorje`) and a contact section.
- **Potkalnički zapisi** (`/potkalnicko-prigorje`): standalone Croatian heritage app (own layout, no portfolio chrome). The home shows a hero, counts for the five areas and a contribute band. Navigation: Igre · Naš govor · Doprinesi · O projektu (each shown only when its section exists, see `shared/utils/pzNav.ts`). Submissions are stored in a database and reviewed before anything is published.
- **Games hub** (`/potkalnicko-prigorje/igre`): friend challenges as the main card, plus the flashcards and quiz.
- **Contribute** (`/potkalnicko-prigorje/doprinesi`): pick a contribution type, then the submission form (`?vrsta=rijec&rijec=<id>` prefills a word variant report).
- **About** (`/potkalnicko-prigorje/o-projektu`): author, data controller, method and sources.
- **Privacy notice** (`/potkalnicko-prigorje/privatnost`): what the form collects, why, how long it is kept and how to ask for correction or deletion. Linked from the form.
- **Admin** (`/admin`): private dashboard after login at `/admin/prijava`. Tiles include **Prilozi** (`/admin/prilozi`) for approving submissions and **Riječi** (`/admin/rijeci`) for the word table. Not linked from the public site, disallowed in `robots.txt`, and protected by the review password plus a sealed httpOnly session cookie.
- **"Kaj to znači?"** (`/potkalnicko-prigorje/igre/kartice`): a word-card game. See a local word, guess what it means, flip the card to reveal the meaning and the regional variants with the places they are used. "Kod nas se kaže drugačije" (on the card back and below the card) opens a dialog for reporting how that word is said locally, without leaving the page.
- **Multiple choice** (`/potkalnicko-prigorje/igre/kviz`): choose a meaning, see correct/wrong feedback and the variants (after answering, "Kod nas se kaže drugačije" opens the same report dialog for that question's word), then continue through at most 10 questions to a scored result. The result leads with creating a friend challenge (same questions, creator's score already recorded), lists the missed words with their meanings, and offers a replay of just those misses (practice, not shareable) or a fresh round. "Podijeli rezultat" is a text link that expands a spoiler-free score with a row of green/red squares that names no words.
- **Asynchronous challenge** (`/potkalnicko-prigorje/izazov`): shareable fixed or quiz-result challenges with saved guest progress, answer explanations and a public leaderboard.

## Asynchronous heritage challenge

Choose **Learn** or **Challenge** on `/potkalnicko-prigorje/igre`. Learn opens the flashcards, while Challenge opens the multiple-choice quiz. The separate asynchronous challenge remains available from the games hub. Each asynchronous challenge gets a separate link, deadline and scoreboard. Enter a nickname, then share its link through WhatsApp, Viber, the native share sheet when available, or copy, before or during play. Everyone answers the same questions at their own pace. The quiz result action creates an immutable challenge from the active-word questions just played and records the creator's completed score immediately. A shared link opens the challenge introduction and nickname entry; completed participants see their saved result. The leaderboard lives at `/potkalnicko-prigorje/izazov/<code>/ljestvica` and remains public after closure. Every participant appears with current total and per-round scores and an in-progress, finished or incomplete status. The scoreboard is reachable before joining, during play, at finish and after closure. The challenge close date is shown throughout these screens. Equal totals share a rank (1, 1, 3); there is no speed tiebreaker. Leaderboard pages load 50 entries at a time.

The first content is explicitly **Uzorak / Sample**: 3 rounds × 5 multiple-choice questions with four choices, one correct choice and a short explanation. Word examples reuse the existing unverified sample seed. Other questions describe explicitly fictional places and stories, not factual claims about local heritage. Replace these before calling it a verified local quiz. There is no live host, game builder, timer, account, recovery or cross-device continuation.

### Editing content

Edit [`content/heritage/challenge.json`](content/heritage/challenge.json), then rebuild/deploy. Its documented format is:

```json
{
  "version": 1,
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

`correct` is a zero-based option index, not a letter. Topics and mechanics are separate. The validator requires both languages, two to four distinct nonempty choices, unique question IDs, 1–10 rounds, 1–20 questions per round and at most 256 KB total. Bump `version` when editing; keep `sample: true` until every question has been curated and verified. There is no admin content editor. Quiz-result challenges rebuild a trusted bilingual snapshot from active dictionary word IDs on the server. A challenge stores a complete immutable snapshot at creation: later content or dictionary edits affect only newly created challenges.

### Progress, privacy and expiry

The server issues a random 256-bit participant token in an HttpOnly, SameSite=Lax cookie scoped to that challenge's API, lasting one year (Secure over HTTPS). Only its SHA-256 hash is stored in Supabase. Keep using the same browser; a nickname cannot claim another device's attempt. Clearing cookies loses access. Nicknames, progress and scores are public as soon as someone joins. Nicknames are display names, unique case-insensitively within a challenge, not verified identities. This does not prevent someone clearing cookies and joining as a different person. Do not put private information in a nickname. IP addresses are used for in-memory rate limiting and are not saved in challenge tables.

Each question is revealed separately by the server. Correct choices and explanations are withheld until that participant submits the answer or explicitly skips it. A correct answer earns 100, an incorrect answer or skip earns 0. Submitted answers are immutable; there is one scored attempt per participant token per challenge, and no restart/back operation. Running total and per-answer points appear during play, and per-round totals at each round end. The scoreboard is available at any time. Continue is explicit; feedback never auto-advances.

A revealed unanswered question stays current across reconnects, including closing a tab. There is no timer or browser-close detection. Seeing the same question again cannot preview future questions or reset progress. Server progress is saved after every reveal, answer and Continue, so breaks between rounds and accidental disconnects are supported.

Creation sets closure to exactly seven days later. Only submitting the final answer of a newly completed attempt can extend it: `min(created + 30 days, max(current closure, completion + 3 days))`. Visits, joins, incomplete rounds and repeat requests do not extend it. After closure the server refuses joining, revealing or answering; saved completed results, feedback navigation and the final leaderboard remain readable. There is no manual-close endpoint.

All transitions run through one server-only Postgres RPC (`heritage_challenge_action`); mutating actions take a challenge row lock, which serializes concurrent tabs and completions. State reads and the separate set-based `heritage_challenge_scoreboard` RPC are lock-free, so shared-link traffic never blocks active players. RLS is enabled; anon/authenticated roles have no table or function access. Creation and joins use the existing per-IP rate limiter (5 creates and 20 joins per 600 seconds); read/play requests allow 240 per 600 seconds. Override via `NUXT_CHALLENGE_RATE_LIMIT_CREATE`, `_JOIN`, `_ACTION`, `_WINDOW_SECONDS`. The existing single-proxy and process-local rate-limit limitations apply. Mutation bodies require JSON, Content-Length and at most 8 KB; cross-origin browser writes are refused.

### Verification and rollout

`node scripts/test-challenges.mjs` creates uniquely named disposable Postgres/PostgREST containers, applies all migrations in order, runs the real Nuxt HTTP/RPC behavior suite, and removes only those containers. Docker is required; it never resets or migrates the shared local Supabase stack. CI runs this in addition to the regular tests. Coverage includes pre-answer secrecy, immutable submissions, concurrent answers, reconnects, progress ordering, skip scoring, token/nickname separation, ranks, snapshot isolation, expiry extension/cap, closed reads/refusals, public-role denial, validation and rate limits.

Rollout uses the existing automatic [production database workflow](.github/workflows/production.yml), which applies `20261031000000_heritage_challenges.sql` and the additive `20261101000000_challenge_scoreboard.sql` before advancing the deployment branch. Both versions are strictly later than the pending `20261030000000_submission_places.sql`. Follow the [baseline, secrets and recovery instructions](docs/database.md); do not apply this manually to production or deploy ahead of migration. The server uses the existing server-only Supabase key and returns 503 when it is unconfigured. No production migration or deployment is part of this change.

## Languages

The site is in Croatian and English via [`@nuxtjs/i18n`](https://i18n.nuxtjs.org): Croatian at `/`, English at `/en`. Texts live in `i18n/locales/hr.json` and `i18n/locales/en.json`. Both word games have a translated interface and use English meanings where available, falling back to Croatian; headwords, word types, examples and regional variants retain their original language.

## Heritage data

The games read active words and their area definitions from `GET /api/heritage/words`. `content/heritage/` holds the original sample seed:

- `words.json`: word entries. Each entry has a headword, meaning, word type, examples and its regional **variants**; every variant lists the areas where it is used (`usages`), so a usage map can be built later.
- `areas.json`: the place hierarchy (settlement → municipality or town → county → country).

The types are in `app/types/heritage.ts`. The current words are **sample data** (`"status": "placeholder"`): they are shown with an "Uzorak" (sample) badge, and their variants and places are examples that still need to be checked. Replace them with verified entries before launch.

The database holds 61 such sample words, all labelled **Uzorak** until an editor verifies them: the original nine seeded by `20261028010000_heritage_words.sql` and 52 further Kajkavian entries from published dictionaries. `20261101010000_seed_kajkavian_words.sql` seeds 55 entries: 52 new ones and replacements for three of the original samples (`hiža`, `kaj`, `denes`). That migration is additive and idempotent: it never overwrites an existing id, except those three while they are still untouched placeholders. The entries have no usages, so each is shown for the whole region (Potkalničko prigorje) until editors add places. Like every migration, it is applied by the [production workflow](.github/workflows/production.yml) on merge to `main` ([rollout](docs/database.md)), not by hand.

The multiple-choice game consumes `useHeritage()` without adding distractor fields to `WordEntry`. Like the flip cards, its prerendered HTML shows loading copy; the browser fetches active words at runtime, so activation does not require a rebuild. Failed requests show a retry control. `app/utils/multipleChoice.ts` generates questions and handles answer checking and scoring, with seedable shuffling for reproducible tests. It prefers wrong meanings from the same part of speech, ignoring gender qualifiers, then fills from other words. Meanings are deduplicated after whitespace/case normalization in both the display language and Croatian. With two or three distinct meanings it offers fewer choices; with fewer than two it shows an explanatory empty state. Examples appear when supplied by the entry. Placeholder questions retain an explicit “Uzorak” / “Sample” label and notice.

Follow-up: replace generated distractors with editorially authored choices when the quiz platform supports them. Random meanings are a simple first step and do not guarantee equally plausible choices.

Contact details, social links and the Siladi Dizajn link are set in `app/app.config.ts` (`site`); empty values are hidden.

## Submissions

The form on `/potkalnicko-prigorje/doprinesi` posts to `POST /api/submissions`. The server checks the same rules as the form (`shared/utils/submission.ts`): the text is required (2 to 2000 characters), type, name and contact are optional and length-limited; place is one optional settlement of the five Potkalničko prigorje municipalities (Grad Križevci, Kalnik, Gornja Rijeka, Sveti Petar Orehovec, Sveti Ivan Žabno; 135 settlements) selected from the reviewed local catalog, and the consent checkbox for publishing is required. Each submission is stored with its consent, the version of the privacy notice it was given for (`PRIVACY_NOTICE_VERSION`), the page language, the time it was sent and a status: `pending`, `approved` or `rejected`. IP addresses are not stored.

Spam protection, without a third-party CAPTCHA:

- a hidden honeypot field: submissions that fill it in get a normal answer but are not stored;
- a per-IP rate limit, 10 submissions per 10 minutes by default;
- server-side validation and a 16 KB request size limit (requests without a `Content-Length` header are refused).

The per-IP limits take the client address from the rightmost `X-Forwarded-For` entry, the one added by the proxy in front of the app, or from the connection when the header is missing. This assumes exactly one proxy that appends to the header, as on Hostinger. Behind no proxy a client can set that entry itself, and behind several proxies every client shares the address of the last one, so the limits only hold with one proxy.

Admin login at `/admin/prijava` checks the review password (`NUXT_REVIEW_SECRET`) with constant-time compare and the same rate limit as the API. On success the server sets a sealed **httpOnly** session cookie (12 h, `secure`, `sameSite: strict`) using `NUXT_ADMIN_SESSION_PASSWORD` (at least 32 characters). The password is not stored in `sessionStorage`. Every `/api/review/*` route accepts that session or a `Authorization: Bearer` header with the review password, so the API stays closed without either, and a client address is locked out for 15 minutes after 10 wrong passwords (with the single-proxy setup described above). If `NUXT_REVIEW_SECRET` is not set, or shorter than 16 characters, review is switched off. If `NUXT_ADMIN_SESSION_PASSWORD` is missing or too short, admin login fails closed.

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

`pnpm test` runs the API tests against a small fake of Supabase's REST API (`test/helpers/fakeSupabase.ts`), so it needs no Docker and runs in CI. It also mounts the quiz in a Nuxt component environment with active words seeded through that fake, checking HR/EN questions, four choices, progress, loading, error/retry and limited-word states without a browser in CI. `pnpm test:local-db` runs the same API tests, plus `test/supabase.local.test.ts` (which checks the Row Level Security rules in the migration), against the real local Supabase stack; start it first with `pnpm db:up`.

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

## Word administration and rollout

`heritage_words` stores a bounded JSONB `entry` in the existing `WordEntry -> Variant -> AreaUsage` shape, plus a JSONB array of `Area` definitions. This keeps nested edits atomic and avoids separate variant/usage save operations in this first editor. `active`, `submission_id`, `submission_place`, `created_at` and `updated_at` are separate moderation columns. Area IDs are stable across entries; reuse the same definition for the same ID. New settlements can be added in the editor's advanced area definitions, with their parent chain. This is not a settlement importer or catalog.

The additive migration `20261028010000_heritage_words.sql` enables RLS with no anon/authenticated grants, and seeds the nine existing examples as active `placeholder` entries. They retain the visible “Uzorak” labels. Only the server's existing service-role key accesses the table. There are **no new environment variables**.

Editorial rules:

- Promotion is idempotent per submission: repeated clicks open the same word. Word/expression text becomes the headword (with the full text also retained as an example when longer than 200 characters); memory/other text becomes an example. The canonical place snapshot is retained as a private draft note; explicitly mapped catalog IDs prefill an existing reported usage. Other selected places and unrecognized legacy free-text places need an editor-selected area. Only an explicitly supplied contributor name becomes a public credit. Contact is never copied.
- Drafts may have missing fields. Activation requires a headword, Croatian meaning, part of speech, a first variant matching the headword and at least one source. Areas are optional: a variant without usages is displayed for the whole region (Potkalničko prigorje) as a display fallback only, and no region usage is stored. The server validates all nested types, statuses, references and limits, even when the browser is bypassed. Requests are capped at 128 KiB; variants at 30, usages per variant at 30, areas at 50, examples/sources/tags at 20 each. Headwords/forms are at most 200 characters, meanings/examples 2000, credits 300, usage notes 500. Audio must be an HTTPS URL.
- A database trigger marks the linked submission approved **in the same transaction when a word becomes active**. Saving an inactive draft never approves it. Deactivation preserves the word, its sources and the submission's approval history. Rejecting or deleting a submission deactivates its linked words (migration `20261029000000_heritage_submission_withdrawal.sql`, so direct database edits behave the same); deletion also strips the contribution credit. Words stay in the admin for re-review.
- The admin list loads 50 words per page, with “Učitaj još 50”. Search/filter apply to loaded entries. The list shows the entire entry, area definitions, public credit, private originating submission/place and timestamps. No hard-delete API is provided.
- Public GET returns `{ words, areas }`, defaults to 100 entries and accepts `limit=1..100`. It selects active rows and explicitly projects the public `WordEntry`/`Area` fields; malformed direct database edits are omitted. Submission IDs/places, activation flags, timestamps and arbitrary extra keys are never included. The browser and shared cache may retain an entry for up to **30 seconds** after deactivation. Already-open games retain their loaded deck until reload. The homepage and flip-card page fetch after mounting, including when their HTML was prerendered, and show loading/empty/error states without falling back to static words.

Migration-first production sequence (operator action, **not performed by the app or this change**):

1. Back up the database and inspect the target and applied migration history.
2. Apply the new migration, verify the nine placeholder rows, RLS and missing anon/authenticated grants. Existing app code remains compatible with the added table.
3. Deploy the app with the existing server URL/key and review secret. Verify unauthenticated word-admin requests fail, a promoted fixture remains private until explicit activation, and deactivation removes it from a fresh public GET after the cache window. Remove the fixture afterward.
4. Roll back app code first if needed. Leave the additive table, data and trigger in place; the old app ignores them and continues reading its bundled static samples. That older app does not reflect word-admin deactivations. Do not drop the table to roll back code, and do not delete production submissions or reset the database. If the migration is missing, new word APIs fail closed with a database error and the cards show unavailable; they do not publish a fallback deck.

Local verification: use `supabase migration up --local` on an already running local stack, then `pnpm test:local-db`; this runs real HTTP API tests and RLS tests with both anonymous and authenticated clients. `pnpm test` runs the same API behavior against the PostgREST fake without Docker. Run `pnpm lint`, `pnpm typecheck` and `pnpm build` as well. Never reset/stop a local stack shared with other worktrees.

Follow-up TODOs:

- Generalize the card-game engine to support games beyond this particular word model, after the first simple version.
- Add catalog-backed area selection and conflict handling for shared area definitions; coordinate with the separate settlement-picker work.
- Add deck pagination/selection if more than 100 active words are curated. The current game consumes the first bounded deck, ordered by stable ID.
