# Potkalnički zapisi

Potkalnički zapisi is the heritage and Digital Atlas for Potkalničko prigorje: a Croatian-first atlas of places, words, stories, people, customs, photographs and learning games. The production site is **https://prigorje.karlo-siladi.from.hr**. The portfolio lives separately at https://karlo-siladi.from.hr.

## Play and learn

`/igraj/` brings together Riječ dana, learning cards, games and shared challenges. The full games catalogue remains at `/igre/`.

At `/rijec-dana/`, type the local word from up to three clues in five attempts. The first letter is given; wrong guesses reveal more letters and any remaining clues. The headword and its variants are accepted regardless of capitalization or diacritics; guesses of at least five characters also allow a single-letter typo. A new word arrives at midnight in Europe/Zagreb. After finishing, share a result without revealing the answer. For non-sample words, choose **Dodaj u učenje** to save the word for review.

Daily results and learning progress stay on this device, without an account. The daily streak counts solved days: a recorded load-failure day preserves it without adding a day, while an ordinary missed day or completed loss breaks it. Outage protection depends on this browser retaining its local record; with storage unavailable, progress lasts only in memory.

At `/uci/`, first-time visitors choose a topic or settlement and start with ten cards. Returning visitors see due reviews, known cards, an unfinished session and topic choices, with session lengths of 5, 10 or 20. Reveal each card's meaning or answer, then choose **Znam** or **Još ne znam**. Graded cards are saved as you go, and an unfinished session can be resumed after leaving.

## Local setup

Requirements are Node.js `^22.21.0 || ^24.11.0 || >=26.0.0`, pnpm 12.14, Docker and the Supabase CLI.

```sh
pnpm install --frozen-lockfile
pnpm env:init
pnpm db:up
pnpm dev
```

`pnpm db:up` starts the disposable local Supabase stack and applies the checked-in migrations. Stop it with `pnpm db:down`. Use `pnpm lint`, `pnpm typecheck`, `pnpm build` and `pnpm test` for validation. The full test suite needs disposable Supabase containers and is normally left to CI; run focused files locally when changing a feature.

## Environment

Server secrets are never sent to the browser:

- `NUXT_SUPABASE_URL` and `NUXT_SUPABASE_SERVICE_ROLE_KEY` (or Hostinger's `SUPABASE_URL` and `SUPABASE_API_KEY`)
- `NUXT_REVIEW_SECRET` (at least 16 characters)
- `NUXT_ADMIN_SESSION_PASSWORD` (at least 32 characters)
- `NUXT_CHALLENGE_RATE_LIMIT_*`, `NUXT_SUBMISSION_RATE_LIMIT_*` and optional `NUXT_DAILY_WORD_EPOCH`

The Cloudflare Web Analytics beacon token is public and ships to the browser; override it with optional `NUXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN`.

Copy `.env.example` for local defaults. Never commit credentials.

## Database and production

This repository owns the existing Potkalnički zapisi Supabase project and its migration history. Do not edit or replay an applied migration. Schema work follows the migration-first contract documented in [docs/database.md](docs/database.md): validate on a disposable database, verify linked production history, apply pending migrations, then deploy the compatible app.

Production deploys from the `production` branch on Hostinger. The Gitea Actions workflow first validates the migrations and, with the repository secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` and `SUPABASE_PROJECT_REF`, applies pending migrations to the linked database. Only after success does it fast-forward `production`; Hostinger builds `node .output/server/index.mjs` from that branch. A skipped or failed migration is not a deployment. The workflow uses the concurrency group `production-database-and-deploy` so migrations cannot overlap.

The production workflow is an operator-controlled rollout. Check the Actions migration log and the Hostinger deployed commit after every release. For recovery, roll back app code while leaving additive schema changes in place; see [failure and recovery](docs/database.md#failure-and-recovery).

## Repository work

Issues are managed with the self-hosted Gitea `tea` CLI:

```sh
tea --repo ksiladi/potkalnicki-zapisi issues list
```

The atlas keeps all public routes at the site root, alongside `/admin/**` and `/api/**`. `/` serves the home page and `/en` redirects to `/`. Public canonical URLs, sitemap, Open Graph images and robots all use the atlas origin. Admin remains excluded from analytics and search indexing.

The portfolio repository owns the root domain and redirects old `/potkalnicko-prigorje/**` links to this host, preserving the path and query string. The atlas in turn answers those prefixed paths, and the addresses of renamed sections (`/istrazi`, `/naselja/[naselje]`, `/price-i-obicaji/prica|obicaj|usmeni-tekst|kazivac|tema/...`) and any public address without its trailing slash, with a 301 to the new trailing-slash address, keeping the query string, so shared links keep working (`server/middleware/canonical-address.ts`, `shared/utils/addressRedirects.ts`).
