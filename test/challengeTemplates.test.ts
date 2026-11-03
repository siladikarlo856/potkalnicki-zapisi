import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { ChallengeTemplateContent } from '../shared/utils/content/challengeTemplate'
import {
  CHALLENGE_LIMITS, challengeSummary, validateChallengeContent, validateChallengeTemplate, validateChallengeTemplateContent
} from '../shared/utils/content/challengeTemplate'
import {
  addOption, addQuestion, addRound, blankChallengeTemplateContent, challengeIds, duplicateQuestion, isBlankQuestion,
  moveItem, moveOption, removeOption
} from '../app/utils/challengeTemplateEditor'
import sample from '../content/heritage/challenge.json'

const { version: _version, ...sampleContent } = sample
const MIGRATIONS = new URL('../supabase/migrations/', import.meta.url)
const MIGRATION = readdirSync(MIGRATIONS).find(file => file.endsWith('_challenge_templates.sql'))!

const clone = (): ChallengeTemplateContent => structuredClone(sampleContent) as ChallengeTemplateContent
const template = (content: unknown = clone()) => ({ name: 'Izazov', content, isCurrent: false, status: 'published' })

describe('challenge template seed', () => {
  it('seeds exactly content/heritage/challenge.json without its version, as the current published template', () => {
    const sql = readFileSync(new URL(MIGRATION, MIGRATIONS), 'utf8')
    const literal = /\$challenge\$\n([\s\S]*?)\n\$challenge\$::jsonb/.exec(sql)?.[1]
    expect(literal, 'seed literal').toBeDefined()
    expect(JSON.parse(literal!)).toEqual(sampleContent)
    expect(sql).toContain('content_uuid(\'challenge_template:sample\')')
    expect(sql).toMatch(/not exists \(select 1 from public\.heritage_challenge_templates where is_current\), 'published'/)
  })
})

describe('validateChallengeTemplate (shared by the dialog, the API and every snapshot)', () => {
  it('accepts the sample set and projects known fields only, trimmed', () => {
    const content = clone()
    content.title.hr = `  ${content.title.hr}  `
    const { value, issues } = validateChallengeTemplate({ ...template({ ...content, version: 3, extra: true }), id: 'x', revision: 9 })
    expect(issues).toEqual([])
    expect(value).toEqual({ name: 'Izazov', content: sampleContent, isCurrent: false, status: 'published' })
    expect(challengeSummary(value.content)).toEqual({ rounds: 3, questions: 15, maxScore: 1500 })
  })

  it('reports each problem under the path of its form field, in Croatian', () => {
    const content = clone() as unknown as Record<string, unknown> & ChallengeTemplateContent
    content.title.en = ' '
    const question = content.rounds[1]!.questions[2]!
    question.options[1]!.hr = question.options[0]!.hr.toUpperCase()
    question.correct = 7
    question.prompt.hr = 'x'.repeat(CHALLENGE_LIMITS.text + 1)
    content.rounds[2]!.questions = []
    const { issues } = validateChallengeTemplate({ name: ' ', content, isCurrent: true, status: 'draft' })
    expect(issues).toEqual([
      { path: 'name', message: 'Polje „Naziv“ je obavezno.' },
      { path: 'content.title.en', message: 'Polje „Naslov (engleski)“ je obavezno.' },
      { path: 'content.rounds.1.questions.2.prompt.hr', message: `Polje „Pitanje (hrvatski)“ može imati najviše ${CHALLENGE_LIMITS.text} znakova.` },
      { path: 'content.rounds.1.questions.2.options.1.hr', message: 'Odgovori se moraju razlikovati (hrvatski).' },
      { path: 'content.rounds.1.questions.2.correct', message: 'Označi točan odgovor.' },
      { path: 'content.rounds.2.questions', message: 'Dodaj barem jedno pitanje u ovaj krug.' },
      { path: 'isCurrent', message: 'Trenutni izazov mora biti objavljen.' }
    ])
  })

  it('bounds rounds, questions and choices, and requires the sample flag', () => {
    const content = clone()
    content.rounds = Array.from({ length: CHALLENGE_LIMITS.rounds + 1 }, (_, r) => ({ ...content.rounds[0]!, id: `r${r}`, questions: [] }))
    const paths = validateChallengeTemplateContent({ ...content, sample: 'yes' }).issues.map(issue => issue.path)
    expect(paths).toContain('sample')
    expect(paths).toContain('rounds')
    expect(validateChallengeTemplateContent({ ...clone(), rounds: [] }).issues).toEqual([{ path: 'rounds', message: 'Dodaj barem jedan krug.' }])
    const many = clone()
    many.rounds[0]!.questions[0]!.options.push({ hr: 'peti', en: 'fifth' })
    expect(validateChallengeTemplateContent(many).issues).toEqual([{ path: 'rounds.0.questions.0.options', message: 'Pitanje može imati najviše 4 ponuđena odgovora.' }])
    expect(validateChallengeTemplateContent(null).issues[0]).toEqual({ path: '', message: 'Sadržaj izazova nedostaje.' })
  })

  it('keeps question ids unique and well formed, which answers rely on', () => {
    const content = clone()
    content.rounds[1]!.questions[0]!.id = 'word-1'
    content.rounds[2]!.questions[0]!.id = 'bad id'
    expect(validateChallengeTemplateContent(content).issues).toEqual([
      { path: '', message: 'Krug 2, pitanje 1: identifikator „word-1“ već koristi drugo pitanje.' },
      { path: '', message: `Krug 3, pitanje 1: identifikator mora biti do ${CHALLENGE_LIMITS.id} slova, brojki, crtica ili podvlaka.` }
    ])
  })

  it('caps the content size below the database limit', () => {
    const content = clone()
    for (const round of content.rounds) {
      for (const question of round.questions) question.explanation = { hr: 'ž'.repeat(2000), en: 'e'.repeat(2000) }
    }
    while (content.rounds.length < CHALLENGE_LIMITS.rounds) content.rounds.push({ ...structuredClone(content.rounds[0]!), id: `extra-${content.rounds.length}`, questions: content.rounds[0]!.questions.map((q, i) => ({ ...q, id: `extra-${content.rounds.length}-${i}` })) })
    const { issues } = validateChallengeTemplateContent(content)
    expect(issues).toHaveLength(1)
    expect(issues[0]!.message).toContain('Izazov je prevelik')
  })

  it('validates snapshots: a positive version and an optional template UUID', () => {
    const id = '6F1C1C36-3A5E-4B7F-9A52-0D3F0B6C1A10'
    expect(validateChallengeContent({ ...sampleContent, version: 4, templateId: id })).toEqual({ version: 4, templateId: id.toLowerCase(), ...sampleContent })
    expect(() => validateChallengeContent(sampleContent)).toThrow('Invalid challenge content: version')
    expect(() => validateChallengeContent({ ...sampleContent, version: 1, templateId: 'sample' })).toThrow('Invalid challenge content: templateId')
  })
})

describe('challenge template editor operations', () => {
  it('starts a new template with one blank round and question that are invalid until filled in', () => {
    const content = blankChallengeTemplateContent()
    expect(content.sample).toBe(true)
    expect(content.rounds).toHaveLength(1)
    expect(content.rounds[0]!.questions[0]!.options).toHaveLength(4)
    expect(isBlankQuestion(content.rounds[0]!.questions[0]!)).toBe(true)
    expect(validateChallengeTemplateContent(content).issues.map(issue => issue.path)).toContain('rounds.0.questions.0.prompt.hr')
    expect(validateChallengeTemplateContent(content).issues.every(issue => issue.path)).toBe(true)
  })

  it('adds rounds and questions with ids unique across the template, up to the limits', () => {
    const content = clone()
    addRound(content)
    addQuestion(content, 0)
    duplicateQuestion(content, 1, 2)
    const ids = content.rounds.flatMap(round => [round.id, ...round.questions.map(question => question.id)])
    expect(new Set(ids).size).toBe(ids.length)
    expect(challengeIds(content).size).toBe(ids.length)
    expect(content.rounds[1]!.questions[3]).toMatchObject({ ...sampleContent.rounds[1]!.questions[2], id: expect.stringMatching(/^q-[0-9a-f]{8}$/) })
    for (let i = 0; i < CHALLENGE_LIMITS.rounds + 2; i++) addRound(content)
    expect(content.rounds).toHaveLength(CHALLENGE_LIMITS.rounds)
    for (let i = 0; i < CHALLENGE_LIMITS.questionsPerRound + 2; i++) addQuestion(content, 0)
    expect(content.rounds[0]!.questions).toHaveLength(CHALLENGE_LIMITS.questionsPerRound)
  })

  it('keeps the correct answer on the same choice when choices are removed or moved', () => {
    const question = clone().rounds[0]!.questions[0]!
    question.correct = 2
    const correct = question.options[2]
    removeOption(question, 0)
    expect(question.options[question.correct]).toEqual(correct)
    moveOption(question, question.correct, 0)
    expect(question.correct).toBe(0)
    expect(question.options[0]).toEqual(correct)
    removeOption(question, 0)
    expect(question.correct).toBe(0)
    removeOption(question, 0)
    expect(question.options).toHaveLength(CHALLENGE_LIMITS.minOptions)
    addOption(question)
    addOption(question)
    addOption(question)
    expect(question.options).toHaveLength(CHALLENGE_LIMITS.maxOptions)
  })

  it('moves items within bounds only', () => {
    const list = ['a', 'b', 'c']
    moveItem(list, 0, 2)
    expect(list).toEqual(['b', 'c', 'a'])
    moveItem(list, 0, -1)
    moveItem(list, 2, 3)
    expect(list).toEqual(['b', 'c', 'a'])
  })
})
