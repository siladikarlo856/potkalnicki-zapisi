# Potkalnički zapisi

A Croatian heritage app for the Potkalničko prigorje region: local words, places, heritage, people and sources, with games for learning them and contributions from visitors that are reviewed before publication.

## Places

**Place** (Mjesto):
Any named geographic unit the project knows, from a **Settlement** up to the country.
_Avoid_: Area, location, područje

**Settlement** (Naselje):
The smallest **Place**: a village or hamlet where words are spoken and heritage stands.
_Avoid_: Village, mjesto (for this level specifically)

**Municipality** (Općina / Grad):
The local administrative unit that groups **Settlements** within a county, whether it is legally a *grad* or an *općina*. It is a different **Place** from the **Settlement** it is often named after (Grad Križevci vs Križevci).
_Avoid_: Town, area, region

**Region** (Regija):
A named cultural or geographic grouping of **Places** outside the administrative hierarchy, such as Prigorje. It may cross county lines, and one Region may lie within another (Potkalničko prigorje within Prigorje).
_Avoid_: Area, sub-area, zone

**Project scope** (Obuhvat):
The **Municipalities** the project currently covers, its working approximation of Potkalničko prigorje. It is not an official boundary, and it may grow.
_Avoid_: Five areas, pet područja, project area, regions

## Local speech

**Word** (Riječ):
An entry in the project's dictionary of local speech: a single word or a fixed multi-word expression, with its meaning. A whole proverb or saying that stands alone is a **Folk text**, not a Word.
_Avoid_: Expression, izraz, term, entry

**Variant** (Inačica):
One local form of a **Word**, as it is said in particular **Settlements**.
_Avoid_: Version, spelling, dialect form

**Usage** (Upotreba):
The link between a **Variant** and a **Settlement** where people say it.
_Avoid_: Occurrence, location

## Intangible heritage

**Intangible heritage** (Nematerijalna baština):
What the people of the region told, said, sang and did, as opposed to what stands in it: every **Story**, **Custom** and **Folk text**. Public navigation calls it "Priče i običaji".
_Avoid_: Oral heritage, usmena baština, predaje (as the umbrella), folklore

**Story** (Priča):
Something people of the region told: a tale, legend, anecdote or belief, recorded as told and published as its own record. It is not a **Heritage item** and has no protection status, though it may be about one.
_Avoid_: Memory, sjećanje, post, article

**Custom** (Običaj):
Something people of the region did: a tradition, custom, habit or manner, with the occasion it belonged to and the people who took part. It is not a **Heritage item**, though it may be tied to one.
_Avoid_: Tradition (as a synonym), habit, practice

**Folk text** (Usmeni tekst):
A short fixed text people of the region said or sang, where the exact wording is the record: a song, prayer, proverb, riddle, counting rhyme, curse, blessing or toast. It stands alone as a whole utterance; a phrase used inside a sentence is a **Word** instead. It may link to the **Words** it contains and to the **Custom** it belonged to.
_Avoid_: Saying (as the umbrella), lyric, quote, Word (for whole proverbs)

**Story type** (Vrsta priče):
The one kind a **Story** belongs to, from an editor-managed list: legenda/predaja, mitska predaja, bajka, šaljiva priča, životna priča.
_Avoid_: Category, genre (in the UI), tag

**Custom type** (Vrsta običaja):
The one kind a **Custom** belongs to, from an editor-managed list: godišnji običaji, životni običaji, rad i svakodnevica, vjera i pobožnost, društveni život.
_Avoid_: Category, tag

**Folk text type** (Vrsta usmenog teksta):
The one kind a **Folk text** belongs to, from an editor-managed list: pjesma, molitva, poslovica/izreka, zagonetka, brojalica, kletva/blagoslov, zdravica.
_Avoid_: Category, genre, tag

**Occasion** (Prigoda):
The named day, feast or life event a **Custom** belongs to, such as Martinje or a wedding.
_Avoid_: Event, holiday, date

**Theme** (Tema):
An editor-managed subject, such as wine or Kalnik, that any number of **Stories**, **Customs** and **Folk texts** can share; the way to browse across kinds.
_Avoid_: Tag, keyword, category

**Recorded in** (Zabilježeno u):
The **Place** where a **Story**, **Custom** or **Folk text** was told, practised or collected. Any level of Place; something shared across a **Region** names the Region.
_Avoid_: Origin, from, location

**About** (Odnosi se na):
The **Place** a record is set in or tied to, when it differs from where it was recorded.
_Avoid_: Location, setting (as a field name)

**Recorded on** (Datum bilježenja):
When a record was told or collected, as precise as is actually known (day, month or year). Never a guessed exact day.
_Avoid_: Date, created

**Set in** (Vrijeme radnje) / **Practised** (Vrijeme prakse):
The era a **Story** is set in, or the period a **Custom** was alive, in the words people use ("u turska vremena", "do 1960-ih"), optionally with an approximate decade or century.
_Avoid_: Date, year

**Narrator** (Kazivač / Kazivačica):
The **Person** who told, said, sang or described a record. A living Narrator is named publicly only with their consent; otherwise the record shows only a description such as year of birth and **Settlement**.
_Avoid_: Author, source, informant

**Collector** (Zapisivač):
The **Person** who recorded or wrote the record down.
_Avoid_: Author, editor, contributor

**Author** (Autor):
The writer of a literary retelling. Folk material has no Author.
_Avoid_: Narrator, collector (for folk material)

## Contributions

**Contribution** (Doprinos):
Anything a visitor sends in for **Review**. Nothing in a Contribution is published until an editor acts on it.
_Avoid_: Submission, prilog, prijedlog (as the umbrella term)

**Proposal** (Prijedlog):
A **Contribution** asking for something new to be added, such as a word, heritage record, **Place**, source or person.
_Avoid_: Suggestion, new entry

**Correction** (Ispravak):
A **Contribution** saying that something already published is wrong or incomplete.
_Avoid_: Fix, report, edit

**Memory** (Sjećanje):
A free-text **Contribution** carrying a personal story, recollection or anything else that is not a requested change. A Memory is never published itself; an editor may start a **Draft** **Story**, **Custom** or **Folk text** from it, credited to the person who sent it.
_Avoid_: Story, anecdote, other

**Review** (Pregled):
An editor's decision on a **Contribution**: it is **Pending** until it is **Approved** or **Rejected**. Approved means the editor agrees with it, not that any content changed.
_Avoid_: Moderation, triage

**Apply** (Primijeni):
An editor making the change a **Correction** asks for. The change and the Correction's approval happen together, and a Contribution never changes content on its own.
_Avoid_: Merge, accept

## Content status

**Draft** (Skica):
Content that is not yet published. A Draft started from a **Proposal** is credited to the person who sent it, and rejecting the Proposal withdraws the Draft and its credit.
_Avoid_: Placeholder, inactive, candidate

**Published** (Objavljeno):
Content visible on the public site.
_Avoid_: Active, live

**Archived** (Arhivirano):
Content withdrawn from the public site but kept.
_Avoid_: Deleted, inactive, placeholder

**Verification** (Provjera):
How far a record's facts have been confirmed against sources: **Unverified**, **Verified**, or **Needs update** when a Verified record is known to be stale or disputed. It is the same scale for every kind of content, independent of who contributed it. For **Intangible heritage**, what is confirmed is the attestation — that it was really told, said or practised here in this form, backed by a named **Narrator** or source — never whether a legend is true. Verification never blocks publishing.
_Avoid_: Community, in review, checked

**Protection status** (Status zaštite):
A heritage item's legal standing, such as a registered protected cultural property or a historical site, or *Unknown*. It is a fact about the site, not about how sure the project is.
_Avoid_: Heritage status, verification

**Sample** (Uzorak):
Illustrative or fictional content shown as an example, never presented as fact about the region.
_Avoid_: Demo, test, placeholder

## Games

**Quiz** (Kviz):
A solo round of multiple-choice questions with a score shown only to the player. It has no link, no other players and no leaderboard.
_Avoid_: Challenge, izazov, test

**Challenge** (Izazov):
A shared, immutable set of questions with its own link, close date and leaderboard, played by **Participants** at their own pace.
_Avoid_: Friend challenge, asynchronous challenge, game

**Fixed challenge**:
A **Challenge** whose questions are copied from the current **Challenge template** when it is created.

**Quiz-result challenge**:
A **Challenge** made from the questions of a **Quiz** someone just finished, with that player's score already recorded.

**Challenge template**:
The editorially curated question set that every new **Fixed challenge** copies. Exactly one is current at a time.
_Avoid_: Challenge set, challenge content

**Participant**:
Someone who has joined a **Challenge** under a nickname and plays one scored attempt.
_Avoid_: Player, user, guest
