# karlo-siladi.from.hr

Personal website of Karlo Siladi, built with [Nuxt](https://nuxt.com) and [Nuxt UI](https://ui.nuxt.com).

- **Homepage** (`/`): the local heritage project as the main feature (Coming Soon), Siladi Dizajn, three project cards and a contact section.
- **Heritage project** (`/heritage`): Coming Soon page with the vision, what's coming and the early-contribution form. The form does not submit yet; storage and moderation come later.
- **"Kaj to znači?"** (`/heritage/kartice`): a word-card game. See a local word, guess what it means, flip the card to reveal the meaning and the regional variants with the places they are used.

## Languages

The site is in Croatian and English via [`@nuxtjs/i18n`](https://i18n.nuxtjs.org): Croatian at `/`, English at `/en`. Texts live in `i18n/locales/hr.json` and `i18n/locales/en.json`. The word-card game is Croatian only.

## Heritage data

Words and places are static JSON in `content/heritage/`:

- `words.json`: word entries. Each entry has a headword, meaning, word type, examples and its regional **variants**; every variant lists the areas where it is used (`usages`), so a usage map can be built later.
- `areas.json`: the place hierarchy (settlement → municipality or town → county → country).

The types are in `app/types/heritage.ts`. The current words are **sample data** (`"status": "placeholder"`): they are shown with a "Neprovjereno" (unverified) badge, and their variants and places are examples that still need to be checked. Replace them with verified entries before launch.

Contact details, social links and the Siladi Dizajn link are set in `app/app.config.ts` (`site`); empty values are hidden.

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

Build for production and preview the build:

```bash
pnpm build
pnpm preview
```

Check the code:

```bash
pnpm lint
pnpm typecheck
```
