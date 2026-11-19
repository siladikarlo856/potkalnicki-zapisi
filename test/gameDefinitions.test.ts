import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CHALLENGEABLE_GAMES, GAME_DEFINITIONS, gameDefinition } from '../shared/utils/games/definitions'
import { GAME_CATALOGUE } from '../shared/utils/games/catalogue'
import { pzRoutes } from '../shared/utils/appRoutes'

const igreDir = fileURLToPath(new URL('../app/pages/igre/', import.meta.url))
const igrePages = readdirSync(igreDir).filter(file => file.endsWith('.vue') && file !== 'index.vue')
const pageSource = (file: string) => readFileSync(`${igreDir}${file}`, 'utf8')
/** The igre page file a catalogue path opens, if it is one. */
const pageFileFor = (path: string) => path.startsWith(pzRoutes.games) && path.length > pzRoutes.games.length ? `${path.slice(pzRoutes.games.length).replace(/\/$/, '')}.vue` : null

describe('Game definitions', () => {
  it('finds each game by its own id, with a label in both languages', () => {
    expect(GAME_DEFINITIONS.length).toBeGreaterThan(0)
    for (const definition of GAME_DEFINITIONS) {
      expect(gameDefinition(definition.id)).toBe(definition)
      expect(definition.label.hr.trim()).not.toBe('')
      expect(definition.label.en.trim()).not.toBe('')
    }
  })

  it('lets a Challenge be made from the quiz, map, heritage, person and club games', () => {
    expect(new Set(CHALLENGEABLE_GAMES)).toEqual(new Set([
      'znacenje', 'rijec', 'opcina', 'crkva', 'karta-koje', 'karta-tocke', 'osoba',
      'klub-mjesto', 'klub-liga', 'klub-odakle'
    ]))
  })

  it('gives every challengeable game, and only those, a question generator and a question card', () => {
    for (const definition of GAME_DEFINITIONS) {
      expect(Boolean(definition.questions), definition.id).toBe(definition.challengeable)
      expect(Boolean(definition.questionCard), definition.id).toBe(definition.challengeable)
    }
  })

  it('builds the catalogue from the definitions that have catalogue meta', () => {
    const withCatalogue = GAME_DEFINITIONS.filter(d => d.catalogue)
    expect(GAME_CATALOGUE.map(entry => entry.id)).toEqual(withCatalogue.map(d => d.id))
    for (const entry of GAME_CATALOGUE) {
      const definition = gameDefinition(entry.id)
      expect(entry.title).toBe(definition.label.hr)
      expect(entry.challengeable).toBe(definition.challengeable)
      expect(entry.path).toBe(definition.catalogue!.path)
    }
  })

  it('opens each igre page from exactly one catalogue game', () => {
    for (const file of igrePages) {
      const owners = GAME_CATALOGUE.filter(entry => pageFileFor(entry.path) === file)
      expect(owners.map(entry => entry.id), file).toHaveLength(1)
    }
  })

  it('has each igre page play under its own game id', () => {
    for (const entry of GAME_CATALOGUE) {
      const file = pageFileFor(entry.path)
      if (!file || !igrePages.includes(file)) continue
      const source = pageSource(file)
      const playsUnderAnId = /GamesShell|recordBest|generateQuestions/.test(source)
      if (playsUnderAnId) expect(source, file).toContain(`gameDefinition('${entry.id}')`)
      for (const [, id] of source.matchAll(/gameDefinition\('([^']+)'\)/g)) expect(id, file).toBe(entry.id)
      // Scores and shells take the id from the definition, never a literal of their own.
      expect(source, file).not.toMatch(/(?<!:)game-id="/)
      expect(source, file).not.toMatch(/recordBest\(\s*'/)
    }
  })
})
