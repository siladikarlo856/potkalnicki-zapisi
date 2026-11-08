# Intangible heritage is three separate content kinds, not heritage-item categories

## Status

Accepted

## Context

Potkalnički zapisi records the region's physical heritage as heritage items: atlas records tied to a municipality and optional settlement, with a legal protection status and optional coordinates, sorted by an editor-managed category. We want to record what people told, said, sang and did — tales, legends, customs, songs, proverbs, prayers — permanently, and browse it by type, place, narrator and theme.

The cheapest option was to add new heritage categories ("Legend", "Custom") and reuse the heritage item table and pages.

## Decision

Intangible heritage gets its own three content kinds — Story, Custom and Folk text — each with its own editor-managed type list, separate from heritage items. They share one set of capabilities: recorded-in and about places at any level (settlement to region), honestly imprecise dates, links to Narrators (as narrator or collector), ordered sources, cross-kind themes, verification and the usual draft/published/archived lifecycle with history. They link to heritage items, Words and each other rather than being stored as heritage items.

Narrators are a separate record kind, the Narrator (Kazivač), not Persons. Persons are notable historical people for Learn and Play; narrators are mostly family and friends, many of them living, and each is credited on every record they told and has a page listing all of them. A Narrator has a name or an anonymous public description, a birth year, a home settlement, a living or deceased flag and editor-recorded consent to publish the name: the public sees the name only with that consent, otherwise only the description, so the slug and the description may not repeat the name either. A Narrator who is also a notable historical Person links to that Person (at most one Narrator per Person); Persons themselves are unchanged. The Collector (whoever wrote the text down) is recorded the same way, as a Narrator linked in the collector role, so someone who only writes things down needs no Person; the Author of a literary retelling is a Person, linked on its own. Narrators have their own admin and public pages, history and slug redirects like any other content kind.

Verification keeps its existing scale but, for these kinds, confirms attestation (really told or practised here, in this form), not the truth of the content, and never blocks publishing.

## Consequences

- No fake addresses, coordinates or "protection status: unknown" on every legend; a custom shared across Prigorje can belong to the region instead of one village.
- Each kind carries fields the others lack (a custom's occasion and practised period; a folk text's exact wording and the custom it was sung at) without nullable columns piling up on heritage items.
- More schema, admin and public surface to build and maintain than a category would need, and cross-kind browsing relies on shared themes and place/narrator links rather than one table.
- Narrators are an extra kind to maintain (their own admin and public pages, consent and privacy rules), which is the price of recording living people without turning them into Persons.
- Whole proverbs live here as Folk texts, not in the Word dictionary; idioms used inside a sentence stay Words.
