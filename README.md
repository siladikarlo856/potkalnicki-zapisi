# karlo-siladi.from.hr

Personal website of Karlo Siladi, built with [Nuxt](https://nuxt.com) and [Nuxt UI](https://ui.nuxt.com).

- **Homepage** (`/`): the local heritage project as the main feature (Coming Soon), Siladi Dizajn, three project cards and a contact section.
- **Heritage project** (`/heritage`): Coming Soon page with the vision, what's coming and the contribution form. Submissions are stored in a database and reviewed before anything is published.
- **Privacy notice** (`/privacy`): what the form collects, why, how long it is kept and how to ask for correction or deletion. Linked from the form.
- **Review page** (`/review`): private page where submissions are approved, rejected or deleted. Not linked from the site, not indexed, and protected by a password.
- **"Kaj to znači?"** (`/heritage/kartice`): a word-card game. See a local word, guess what it means, flip the card to reveal the meaning and the regional variants with the places they are used.

## Languages

The site is in Croatian and English via [`@nuxtjs/i18n`](https://i18n.nuxtjs.org): Croatian at `/`, English at `/en`. Texts live in `i18n/locales/hr.json` and `i18n/locales/en.json`. The word-card game is Croatian only.

## Heritage data

Words and places are static JSON in `content/heritage/`:

- `words.json`: word entries. Each entry has a headword, meaning, word type, examples and its regional **variants**; every variant lists the areas where it is used (`usages`), so a usage map can be built later.
- `areas.json`: the place hierarchy (settlement → municipality or town → county → country).

The types are in `app/types/heritage.ts`. The current words are **sample data** (`"status": "placeholder"`): they are shown with a "Neprovjereno" (unverified) badge, and their variants and places are examples that still need to be checked. Replace them with verified entries before launch.

Contact details, social links and the Siladi Dizajn link are set in `app/app.config.ts` (`site`); empty values are hidden.

## Submissions

The form on `/heritage` posts to `POST /api/submissions`. The server checks the same rules as the form (`shared/utils/submission.ts`): the text is required (2 to 2000 characters), type, place, name and contact are optional and length-limited, and the consent checkbox for publishing is required. Each submission is stored with its consent, the version of the privacy notice it was given for (`PRIVACY_NOTICE_VERSION`), the page language, the time it was sent and a status: `pending`, `approved` or `rejected`. IP addresses are not stored.

Spam protection, without a third-party CAPTCHA:

- a hidden honeypot field: submissions that fill it in get a normal answer but are not stored;
- a per-IP rate limit, 10 submissions per 10 minutes by default;
- server-side validation and a 16 KB request size limit (requests without a `Content-Length` header are refused).

The per-IP limits take the client address from the rightmost `X-Forwarded-For` entry, the one added by the proxy in front of the app, or from the connection when the header is missing. This assumes exactly one proxy that appends to the header, as on Hostinger. Behind no proxy a client can set that entry itself, and behind several proxies every client shares the address of the last one, so the limits only hold with one proxy.

The review page `/review` asks for the review password (`NUXT_REVIEW_SECRET`) and keeps it in the browser tab only. Every `/api/review/*` route checks the password itself, so the API stays closed even without the page, and a client address is locked out for 15 minutes after 10 wrong passwords (with the single-proxy setup described above). If `NUXT_REVIEW_SECRET` is not set, or shorter than 16 characters, review is switched off.

Approved submissions are not yet published into the word cards or other content; that comes later. Nothing is deleted automatically, and the privacy notice says so: it promises only that unpublished and rejected submissions are deleted by hand from time to time, and names or contact details when they are no longer needed or when someone asks. Delete whole submissions from the review page; to remove only a name or contact from a published one, clear it in the table in Supabase (Table Editor). The review page lists every submission, with no cap. When the notice changes, bump `PRIVACY_NOTICE_VERSION`: the notice shows it as its date.

### Database

Submissions are stored in [Supabase](https://supabase.com) (Postgres) through [`@supabase/supabase-js`](https://github.com/supabase/supabase-js), used only in server code (`server/utils/db.ts`): no Supabase key is ever sent to the browser. Everything is configured with environment variables, and the table is created by the migration in `supabase/migrations/`.

The table `heritage_submissions` has Row Level Security turned on, and the public API cannot read it:

- the **anon** (public) key can only insert a new `pending` submission with consent, and only the form columns; it cannot read, update or delete anything, or choose the status;
- the **service-role** (secret) key is used only by the `/api/review/*` routes, after the review password is checked, to list, approve, reject and delete;
- the table also has check constraints (lengths, allowed values, consent must be true) as a second line of defence.

Without the Supabase URL, `POST /api/submissions` answers 503 and stores nothing; without the service-role key the review routes answer 503 and log which variable is missing, while submissions keep working. `/review` still uses its own password (`NUXT_REVIEW_SECRET`), not Supabase Auth.

### Environment variables

Copy `.env.example` to `.env` for local development (`pnpm dev:local` does it for you). Never commit real values.

| Variable | What it is |
| --- | --- |
| `NUXT_SUPABASE_URL` | Supabase project URL, e.g. `https://<ref>.supabase.co`. Also read as `SUPABASE_URL`. |
| `NUXT_SUPABASE_ANON_KEY` | Public (anon) key, used by the form. Also read as `SUPABASE_ANON_KEY` or `SUPABASE_KEY`. |
| `NUXT_SUPABASE_SERVICE_ROLE_KEY` | Secret service-role key, used only by `/review`. Server only. Hostinger's integration does not add it: set it by hand. |
| `NUXT_REVIEW_SECRET` | Password for the review page, at least 16 characters. Generate one with `openssl rand -base64 24`. |
| `NUXT_SUBMISSION_RATE_LIMIT_MAX` | Optional. Submissions per IP per window, default `10`. |
| `NUXT_SUBMISSION_RATE_LIMIT_WINDOW_SECONDS` | Optional. Rate limit window in seconds, default `600`. |

The `NUXT_` names win when both styles are set. The plain `SUPABASE_*` names are read so that whatever Hostinger's Supabase integration injects keeps working. If `NUXT_SUPABASE_*` values were set while building, they are baked into the build as defaults, so build without them.

## Deploying on Hostinger

The pages are still prerendered to static HTML at build time, but the form and the review page need the API, so the site has to run as a **Node.js app**, not as static files. The build output is a Node server in `.output/` that serves both the prerendered pages and the API.

1. **Create the Supabase project.** On [supabase.com](https://supabase.com), create a project and note its region. Put the region into the privacy notice, where `[ZA PROVJERU: ...]` / `[TO CHECK: ...]` marks the spot in `i18n/locales/hr.json` and `en.json`. Free projects pause after about a week without activity, so check the form now and then.
2. **Create the table.** In the Supabase dashboard open **SQL Editor**, paste the contents of `supabase/migrations/20261027000000_heritage_submissions.sql` and run it. (Or, with the Supabase CLI: `supabase link --project-ref <ref>` and `supabase db push`.) Check in **Table Editor** that `heritage_submissions` exists with RLS enabled.
3. **Create the Node.js app.** In hPanel, add a Node.js app for the domain and connect this repository (or upload the code). Use:
   - Node.js version: 24 (or at least 22.21);
   - install and build: `pnpm install` and `pnpm build` (or `npm install` and `npm run build` if pnpm is not offered);
   - start command: `node .output/server/index.mjs` (entry file `.output/server/index.mjs`).
   Hostinger sets the port; the server reads it from `PORT`.
4. **Connect Supabase.** In the Node.js app's settings use **Connect a database** and choose Supabase. Hostinger adds the Supabase variables to the app and redeploys. Open the app's **Environment variables** and check that the project URL and the anon key are there; if one is missing, add it as `NUXT_SUPABASE_URL` or `NUXT_SUPABASE_ANON_KEY`. The URL is under Supabase **Project Settings > API**.
5. **Add the secrets by hand** in the same Environment variables list:
   - `NUXT_SUPABASE_SERVICE_ROLE_KEY`: the `service_role` key from Supabase **Project Settings > API Keys** (the "secret" key in newer projects). Hostinger's integration does not provide it, and `/review` stays switched off without it.
   - `NUXT_REVIEW_SECRET`: a password of at least 16 characters for `/review`.
   Never paste either of them into the repository, a chat or a `NEXT_PUBLIC`/browser-visible setting.
6. **Redeploy** (or restart) the app: variables are read when the server starts.
7. **Check it.** Send a test entry from `/heritage`, open `/review`, sign in with `NUXT_REVIEW_SECRET`, check that the entry is there and delete it. If the form answers with an error and the server log says `NUXT_SUPABASE_URL ... is not set`, the Supabase variables are missing; if `/review` says it is not set up and the log names `NUXT_SUPABASE_SERVICE_ROLE_KEY`, add that one. Nothing is stored until Supabase is configured.

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

`pnpm test` runs the API tests against a small fake of Supabase's REST API (`test/helpers/fakeSupabase.ts`), so it needs no Docker and runs in CI. `pnpm test:local-db` runs the same API tests, plus `test/supabase.local.test.ts` (which checks the Row Level Security rules in the migration), against the real local Supabase stack; start it first with `pnpm db:up`.

## Local development

The app runs on your machine with `pnpm dev`; the database is the local [Supabase](https://supabase.com/docs/guides/local-development) stack (Postgres, the REST API and Studio), run in Docker by the Supabase CLI. Its configuration is in [`supabase/config.toml`](supabase/config.toml), and `supabase start` applies the migrations in `supabase/migrations/` to a fresh database. Only the services the site needs are enabled.

**Prerequisites:** Node.js 22.21+ (24 in CI), pnpm (`corepack enable`), Docker Desktop running, and the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) (`brew install supabase/tap/supabase`).

**First run:**

```bash
pnpm install
pnpm dev:local
```

`dev:local` creates `.env` from [`.env.example`](.env.example) if missing (`.env` is gitignored), starts the Supabase stack (the first start pulls the images, which takes a few minutes), writes its local URL and keys into `.env` and then runs `pnpm dev`. Run the same command every day. Plain `pnpm dev` also works once the stack is up (`pnpm db:up`).

| Command | What it does |
| --- | --- |
| `pnpm db:up` | Start the Supabase stack, apply new migrations and write the local URL and keys to `.env` |
| `pnpm db:down` | Stop the stack; data is kept |
| `pnpm db:reset` | Delete the data and re-apply all migrations to an empty database |
| `pnpm db:logs` | Follow the database logs |
| `pnpm db:shell` | Open a `psql` shell in the database container |
| `pnpm db:browser` | Open Supabase Studio |
| `pnpm test:local-db` | Run the tests against the local stack |

**Open it:**

- Site: <http://localhost:3000> (English under `/en`).
- Review page: <http://localhost:3000/review>. The password is `NUXT_REVIEW_SECRET` from `.env` (`local-review-password` by default).
- Supabase Studio: <http://127.0.0.1:54323>. Open **Table Editor** and the `heritage_submissions` table to see what the form stored.
- API: <http://127.0.0.1:54321>; the database itself is on `127.0.0.1:54322`.

**Test someone's PR:**

```bash
gh pr checkout <number>
pnpm install
pnpm db:reset   # only if the PR added or changed a migration
pnpm dev:local
```

**Reset:** `pnpm db:reset` forgets all local data and re-applies the migrations. After you add a migration, `pnpm db:up` or `pnpm db:reset` applies it.

**Stop:** press Ctrl+C to stop the app, then `pnpm db:down`. The data is kept in Docker volumes until you reset it.

The keys in `.env` are the local stack's own demo keys, regenerated by `pnpm db:up`; they work only against your machine.
