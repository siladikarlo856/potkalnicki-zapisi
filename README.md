# Potkalnički zapisi

Potkalnički zapisi is the heritage and Digital Atlas for Potkalničko prigorje: a Croatian-first atlas of places, words, stories, people, customs, photographs and learning games. The production site is **https://prigorje.karlo-siladi.from.hr**. The portfolio lives separately at https://karlo-siladi.from.hr.

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
- optional `NUXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN` for Cloudflare Web Analytics

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

The atlas keeps all public routes under `/potkalnicko-prigorje/**`, `/admin/**` and `/api/**`. `/` and `/en` redirect to `/potkalnicko-prigorje/`. Public canonical URLs, sitemap, Open Graph images and robots all use the atlas origin. Admin remains excluded from analytics and search indexing.

The portfolio repository owns the root domain and redirects old `/potkalnicko-prigorje/**` links to this host, preserving the path and query string.
