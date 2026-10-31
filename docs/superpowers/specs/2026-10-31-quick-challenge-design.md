# Quick Challenge Design

## Goal

Add a one-tap Quick challenge entry to the Challenge side of the heritage games page, alongside a visible but disabled Custom challenge placeholder. The Quick challenge must use the existing single-player multiple-choice flow, including its 10-question cap, results, missed-word review and sharing.

## Architecture

The existing `/heritage/kviz` page remains the Quick challenge runtime. Its current question generator consumes the active Words catalog, shuffles the available questions, and applies the shared `QUIZ_LENGTH` cap of 10. This is the only playable question source in the current application, so v1 is Words-focused without adding new question content or an unsupported cross-topic adapter.

The `/heritage` Challenge card becomes a small chooser with two entries:

- Quick challenge: an enabled localized link to `/heritage/kviz`, starting the existing game immediately.
- Custom challenge: a localized disabled control labeled Coming soon, with no route or configuration behavior.

## Data flow

The visitor opens `/heritage`, selects Quick challenge, and navigates directly to `/heritage/kviz`. The existing page fetches active words, generates multiple-choice questions, limits the round to at most 10 questions, and handles answer feedback, results, missed-word replay and result sharing unchanged.

## Error handling

No new network or persistence behavior is introduced. Existing loading, retry and empty-state behavior on the quiz page remains authoritative. The Custom entry is disabled in the rendered control and cannot navigate or submit.

## Testing

Extend the existing localized server-rendered heritage-page tests to assert that both Challenge entries are present in Croatian and English, that Quick challenge links to the existing quiz route, and that Custom challenge is rendered as disabled. Existing multiple-choice tests continue to cover the cap and game behavior.

## Scope

This change does not add accounts, place or area preferences, place tags, contribution forms, challenge links, new question content, or Custom challenge configuration.
