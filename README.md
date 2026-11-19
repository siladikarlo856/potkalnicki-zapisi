# Potkalnički zapisi

Potkalnički zapisi is the heritage and Digital Atlas for Potkalničko prigorje: a Croatian-first atlas of places, words, stories, people, customs, photographs and learning games. The production site is **https://prigorje.karlo-siladi.from.hr**. The portfolio lives separately at https://karlo-siladi.from.hr.

## Playing games

Browse `/igre/` for games grouped by subject. The chips filter by question type; select an active chip again to clear it. Links with a `tema` query still filter by topic; use **Prikaži sve teme** to clear that topic while keeping the question-type filter. Riječ dana is on the home page at `/#rijec-dana`, and learning cards are at `/uci/`; neither appears in the games list. Shared challenges have their own hub at `/izazov/`.

Fixed-length multiple-choice games open with instructions and **Počni**, with a difficulty choice where available. The displayed question count is an upper limit; available content can make a round shorter. Choose an answer, press **Provjeri**, read the feedback, then press **Dalje** (or **Pogledaj rezultat** on the last question). **Preskoči** moves on without feedback: it counts as incorrect in the round but does not update that card's learning progress. The map and sorting games explain their own controls before starting.

At the end of these rounds, **Igraj ponovno** starts a fresh round. You can also review missed or skipped questions, open their records where available, or practise only those questions. Practice rounds do not replace the saved best or offer sharing or challenge creation. Best scores are kept on this device, including a first completed round with zero correct answers; **Još nije igrano** means there is no saved best.

Supported games offer **Izazovi prijatelje ovom igrom**, which opens challenge creation with the game and topic selected. A completed **Kaj to znači?** round can instead become a challenge using those same questions. **Podijeli rezultat** shares a score summary without the answers.

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
