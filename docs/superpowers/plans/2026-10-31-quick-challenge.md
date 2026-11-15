# Quick Challenge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add localized Quick and disabled Custom challenge entries to the heritage Challenge chooser while preserving the existing one-tap 10-question quiz behavior.

**Architecture:** Keep `/kviz` as the Quick challenge runtime because it already generates active Words questions, applies `QUIZ_LENGTH`, shows results and missed-word review, and shares results. Update only the Challenge chooser markup and both locale files, then cover the rendered links and disabled state in the existing localized API test.

**Tech Stack:** Nuxt 4, Vue 3, Nuxt UI, `@nuxtjs/i18n`, Vitest, Nuxt test utilities.

## Global Constraints

- Quick challenge has no account requirement.
- Quick challenge is one tap and capped at 10 multiple-choice questions.
- Custom challenge is visible but disabled and labeled Coming soon.
- Keep Croatian and English strings in step.
- Do not add place selection, place tags, contribution forms, challenge links, new question content, or Custom configuration.

---

### Task 1: Add failing localized chooser coverage

**Files:**
- Modify: `test/api.test.ts:102-141`
- Test: `test/api.test.ts`

**Interfaces:**
- Consumes: the server-rendered `/` page in Croatian and English.
- Produces: assertions requiring `data-testid="challenge-mode-choice"`, a Quick challenge link to `/kviz`, and a disabled Custom challenge control.

- [ ] **Step 1: Write the failing test**

Extend the existing `heritage learning and challenge choice` table with the localized Quick and Custom labels, then assert the Challenge card contains:

```ts
const challenge = choice.querySelector('[data-testid="challenge-mode-choice"]')!
expect(challenge).not.toBeNull()
expect(challenge.querySelector('a[href="' + `${prefix}/kviz` + '"]')?.textContent).toContain(quick)
expect(challenge.querySelector('button[disabled]')?.textContent).toContain(custom)
expect(challenge.textContent).toContain(comingSoon)
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm test -- test/api.test.ts -t "separate learning and challenge destinations"`

Expected: FAIL because the current Challenge card has no `challenge-mode-choice` element and no Custom entry.

### Task 2: Implement the localized Challenge chooser

**Files:**
- Modify: `app/pages/index.vue:149-193`
- Modify: `i18n/locales/hr.json:535-548`
- Modify: `i18n/locales/en.json:535-548`

**Interfaces:**
- Consumes: existing `localePath`, `t`, and the current `/kviz` route.
- Produces: a Challenge card with enabled Quick challenge and disabled Custom challenge entries, with matching HR/EN copy.

- [ ] **Step 1: Add the Croatian strings**

Add `quick`, `quickHelp`, `custom`, `customHelp`, and `comingSoon` under `challenge`, using:

```json
"quick": "Brzi izazov",
"quickHelp": "Jednim dodirom pokreni 10 pitanja iz najboljeg dostupnog sadržaja, s naglaskom na riječi.",
"custom": "Prilagođeni izazov",
"customHelp": "Kasnije odaberi vrste igara, teme i mjesta.",
"comingSoon": "Uskoro"
```

- [ ] **Step 2: Add the English strings**

Add the matching keys:

```json
"quick": "Quick challenge",
"quickHelp": "Start 10 questions from the best available content in one tap, with a focus on Words.",
"custom": "Custom challenge",
"customHelp": "Choose game types, topics and places later.",
"comingSoon": "Coming soon"
```

- [ ] **Step 3: Replace the Challenge card body**

Keep the existing Challenge heading and introductory copy, then render a nested two-entry grid with `data-testid="challenge-mode-choice"`. The Quick entry uses a link/button to `localePath('/kviz')`; the Custom entry uses a disabled `UButton` and displays the coming-soon badge.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `pnpm test -- test/api.test.ts -t "separate learning and challenge destinations"`

Expected: PASS for both Croatian and English cases.

### Task 3: Verify, commit, push, and open the ready PR

**Files:**
- Verify: `app/pages/index.vue`
- Verify: `i18n/locales/hr.json`
- Verify: `i18n/locales/en.json`
- Verify: `test/api.test.ts`

- [ ] **Step 1: Run the focused unit and integration coverage**

Run: `pnpm test -- test/quizCatalog.test.ts test/multipleChoice.test.ts test/api.test.ts`

Expected: exit 0 with no failed tests.

- [ ] **Step 2: Run project validation**

Run: `pnpm lint && pnpm typecheck && pnpm build`

Expected: all commands exit 0.

- [ ] **Step 3: Inspect the final diff**

Run: `git diff --check && git diff --stat && git status --short`

Expected: only the intended feature, localization, test, and design/plan files are changed; no generated or scratch files are present.

- [ ] **Step 4: Commit the implementation**

Run:

```bash
git add app/pages/index.vue i18n/locales/hr.json i18n/locales/en.json test/api.test.ts docs/superpowers/specs/2026-10-31-quick-challenge-design.md docs/superpowers/plans/2026-10-31-quick-challenge.md
git commit -m "feat(heritage): add quick challenge entry"
```

- [ ] **Step 5: Push the task branch**

Run: `git push -u origin fm/ksh-quick-challenge`

- [ ] **Step 6: Open a ready PR with gh-axi**

Use `gh-axi pr create` against the task branch and default branch, then read it back with `gh-axi pr view <number>`. If it is a draft, run `gh-axi pr ready <number>`.
