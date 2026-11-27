# Potkalnički zapisi

Potkalnički zapisi is the heritage and Digital Atlas for Potkalničko prigorje: a Croatian-first atlas of places, words, stories, people, customs, photographs and learning games. The production site is **https://prigorje.karlo-siladi.from.hr**. The portfolio lives separately at https://karlo-siladi.from.hr.

## Places

The home page's **Pet općina** section, `/mjesta/` and each town or municipality page (`/mjesta/[opcina]/`) share one layout: a map of the real municipal boundaries beside a search field and a scrollable list of cards; on a phone the list follows the map. Pointing at a card outlines its area or settlement on the map, and pointing at the map marks the card. Everything on the map is also reachable from the list. On the home page and `/mjesta/`, search finds towns, municipalities and settlements across the region and places matching settlements on the map. A town or municipality page lists its settlements and links to its records on **Baština**; `/bastina/?opcina=<slug>` opens that list already filtered to the unit.

## Play and learn

`/igraj/` brings together Riječ dana, learning cards, games and shared challenges. The full games catalogue remains at `/igre/`.

At `/rijec-dana/`, type the local word from up to three clues in five attempts. The first letter is given; wrong guesses reveal more letters and any remaining clues. The headword and its variants are accepted regardless of capitalization or diacritics; guesses of at least five characters also allow a single-letter typo. A new word arrives at midnight in Europe/Zagreb. After finishing, share a result without revealing the answer. For non-sample words, choose **Dodaj u učenje** to save the word for review.

Daily results and learning progress stay on this device, without an account. The daily streak counts solved days: a recorded load-failure day preserves it without adding a day, while an ordinary missed day or completed loss breaks it. Outage protection depends on this browser retaining its local record; with storage unavailable, progress lasts only in memory.

At `/uci/`, first-time visitors choose a topic or settlement and start with ten cards. Returning visitors see due reviews, known cards, an unfinished session and topic choices, with session lengths of 5, 10 or 20. Reveal each card's meaning or answer, then choose **Znam** or **Još ne znam**. Graded cards are saved as you go, and an unfinished session can be resumed after leaving.

## Playing games

Browse `/igre/` for games grouped by subject. The chips filter by question type; select an active chip again to clear it. Links with a `tema` query still filter by topic; use **Prikaži sve teme** to clear that topic while keeping the question-type filter. Riječ dana has its own screen at `/rijec-dana/` (linked from the top of `/igre/`); learning cards are at `/uci/`; neither appears in the games list. Shared challenges have their own hub at `/izazov/`.

Fixed-length multiple-choice games open with instructions and **Počni**, with a difficulty choice where available. The displayed question count is an upper limit; available content can make a round shorter. Choose an answer, press **Provjeri**, read the feedback, then press **Dalje** (or **Pogledaj rezultat** on the last question). **Preskoči** moves on without feedback: it counts as incorrect in the round but does not update that card's learning progress. The map and sorting games explain their own controls before starting.

At the end of these rounds, **Igraj ponovno** starts a fresh round. You can also review missed or skipped questions, open their records where available, or practise only those questions. Practice rounds do not replace the saved best or offer sharing or challenge creation. Best scores are kept on this device, including a first completed round with zero correct answers; **Još nije igrano** means there is no saved best.

Supported games offer **Izazovi prijatelje ovom igrom**, which opens challenge creation with the game and topic selected. A completed **Kaj to znači?** round can instead become a challenge using those same questions. **Podijeli rezultat** shares a score summary without the answers.

## Accounts

Public pages, games and **Doprinesi** remain available without an account. Sending photographs through **Doprinesi** (up to 5 JPG or PNG files of at most 10 MB each, each with alt text, author and publish permission) requires signing in; editors review them privately in the inbox. When sign-in is configured, choose **Prijava** in the header to sign in with Google and return to the page you started from. The account menu offers **Postavke računa** (`/racun/`), which shows your email and role, and **Odjava**. The browser restores your session on later visits. If the role cannot be loaded, the app reports an error and retains the last known role for that account, or shows **Nedostupna** if none was loaded.

Google sign-in creates role-less accounts by default (`none`), with a [one-time bootstrap for the first admin](docs/database.md#account-profiles-and-preferences). Accounts with `admin` or `maintainer` can use `/admin/`, the **Prijedlozi** inbox and all editorial record screens through the social session; **Korisnici** and its APIs are limited to admins (maintainers get 403). Signed-in accounts with no editorial role are directed to `/admin/nema-pristupa`; anonymous visitors use `/admin/prijava` with the shared reviewer password during migration. Social roles are read on the server for every protected request, so revocation takes effect on the next action even if the account menu still shows the previous role.

A valid shared-password session takes precedence over Google, including a Google account with no editorial role. Password access remains usable if Google session restoration fails. Automation continues to use `NUXT_REVIEW_SECRET` as a Bearer token. **Odjava** in the admin area ends the Google session and clears editorial access as well as the password session.

Google accounts with the `admin` role manage maintainers in **Korisnici** (`/admin/korisnici`). Maintainers, shared-password sessions and automation cannot manage users. If a shared-password session is active, sign out of the admin area and sign in again with Google to use this screen.

Search by email to find accounts and open pre-authorisations; each list has its own pagination. Use **Postavi održavateljem** on an account with **Bez uloge**, or enter an email under **Prethodna autorizacija** and choose **Dodaj na čekanje** before the person signs in. The pending grant is applied only when a verified Google email matches, ignoring case and surrounding whitespace. **Otkaži** cancels an open grant in **Lista čekanja**. **Opozovi** asks for confirmation before removing a maintainer's role. **Revizija uloga** shows the latest 50 audit entries; this screen cannot grant or revoke administrator roles.

Signed-in accounts can set **Glavno mjesto** (`/racun/glavno-mjesto/`): select a Naselje from the picker and choose **Spremi** to save or change it, or **Ukloni** to clear the saved preference. See [main-place eligibility and archived preferences](docs/database.md#account-profiles-and-preferences) for selection restrictions and handling of unavailable places. The preference syncs across devices and becomes the default on `/uci/` while signed in. An explicit place choice or clear on `/uci/`, including a place in the session URL, overrides that default for the session. Signing out drops the account default and restores the device-local place, or no place if none was saved. Anonymous device-local place selection is unchanged. On word reveal in Uči, inačice with a recorded upotreba for the effective place are ordered first with a note explaining why: marked Glavno mjesto when the effective place is the saved main place, otherwise Odabrano mjesto. The base form keeps its osnovni oblik label, no inačica is hidden, and without a place or matching upotreba the base form stays first with a note saying so. Learning progress and scores remain on the device. See [Privatnost](https://prigorje.karlo-siladi.from.hr/privatnost/) for data handling.

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
- `NUXT_ACCOUNT_ADMIN_BOOTSTRAP_EMAIL` (see [bootstrap configuration](docs/database.md#account-profiles-and-preferences))
- `NUXT_CHALLENGE_RATE_LIMIT_*`, `NUXT_SUBMISSION_RATE_LIMIT_*` and optional `NUXT_DAILY_WORD_EPOCH`

Google sign-in separately requires `NUXT_PUBLIC_SUPABASE_URL` and `NUXT_PUBLIC_SUPABASE_ANON_KEY` for the same Supabase project. These values are exposed to the browser; use the public anon key here, never the service-role key. Set both explicitly: the browser client does not fall back to the server settings or Hostinger aliases, and `pnpm db:up` fills only the server values in `.env`. If either public value is missing, the header displays **Prijava nedostupna** and public pages remain usable.

Enable Google in that project's Supabase Auth settings and configure the browser return URL at `<site-origin>/auth/callback/` for each deployed or local origin you use. The app appends a `next` query parameter for the return page. Hosted provider credentials belong in Supabase Auth; the local provider configuration in `supabase/config.toml` reads `SUPABASE_AUTH_GOOGLE_CLIENT_ID` and `SUPABASE_AUTH_GOOGLE_SECRET` from the local environment. Keep the Google secret out of public runtime configuration.

The Cloudflare Web Analytics beacon token is public and ships to the browser; override it with optional `NUXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN`.

Copy `.env.example` for local defaults. Never commit credentials.

## Database and production

This repository owns the existing Potkalnički zapisi Supabase project and its migration history. Do not edit or replay an applied migration. Schema work follows the migration-first contract documented in [docs/database.md](docs/database.md): validate on a disposable database, verify linked production history, apply pending migrations, then deploy the compatible app.

Production deploys from the `production` branch on Hostinger. The Gitea Actions workflow first validates the migrations and, with the repository secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` and `SUPABASE_PROJECT_REF`, applies pending migrations to the linked database. Only after success does it fast-forward Forgejo `production` and publish the same tree as a flattened commit to GitHub `production`, which Hostinger builds (`node .output/server/index.mjs`) from; that step needs the `GH_DEPLOY_TOKEN` secret (see [Publishing to GitHub](docs/database.md#publishing-to-github-hostingers-source)). A skipped or failed migration is not a deployment. The workflow uses the concurrency group `production-database-and-deploy` so migrations cannot overlap.

The production workflow is an operator-controlled rollout. Check the Actions migration log and the Hostinger deployed commit after every release. For recovery, roll back app code while leaving additive schema changes in place; see [failure and recovery](docs/database.md#failure-and-recovery).

## Repository work

Issues are managed with the self-hosted Gitea `tea` CLI:

```sh
tea --repo ksiladi/potkalnicki-zapisi issues list
```

The atlas keeps all public routes at the site root, alongside `/admin/**` and `/api/**`. `/` serves the home page and `/en` redirects to `/`. Public canonical URLs, sitemap, Open Graph images and robots all use the atlas origin. Admin remains excluded from analytics and search indexing.

The portfolio repository owns the root domain and redirects old `/potkalnicko-prigorje/**` links to this host, preserving the path and query string. The atlas in turn answers those prefixed paths, and the addresses of renamed sections (`/istrazi`, `/naselja/[naselje]`, `/price-i-obicaji/prica|obicaj|usmeni-tekst|kazivac|tema/...`) and any public address without its trailing slash, with a 301 to the new trailing-slash address, keeping the query string, so shared links keep working (`server/middleware/canonical-address.ts`, `shared/utils/addressRedirects.ts`).
