import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createClient } from '@supabase/supabase-js'
import { clearNuxtData, useNuxtApp } from '#imports'
import Quiz from '../app/pages/heritage/kviz.vue'
import sampleWords from '../content/heritage/words.json'
import sampleAreas from '../content/heritage/areas.json'
import { SERVICE_ROLE_KEY, startFakeSupabase } from './helpers/fakeSupabase'

const fake = await startFakeSupabase()
const db = createClient(fake.url, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const seeds = sampleWords.slice(0, 4)
let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
let pending: Promise<void> | undefined
let release: (() => void) | undefined
let unavailable = false

// Exercise the real useHeritage fetch and its reactive updates, with active rows from the
// same fake Supabase REST server as the API suite. Production API filtering is covered there.
registerEndpoint('/api/heritage/words', async () => {
  await pending
  if (unavailable) throw new Error('Word service unavailable')
  const { data, error } = await db.from('heritage_words').select('entry').eq('active', true)
  if (error) throw error
  return { words: data!.map(row => row.entry), areas: sampleAreas }
})

beforeAll(async () => {
  for (const entry of sampleWords.slice(0, 5)) {
    const { error } = await db.from('heritage_words').insert({ id: entry.id, entry, areas: sampleAreas, active: false })
    expect(error).toBeNull()
  }
})
beforeEach(async () => {
  for (const entry of seeds) await db.from('heritage_words').update({ active: true }).eq('id', entry.id)
})
afterEach(() => {
  release?.()
  release = undefined
  pending = undefined
  unavailable = false
  wrapper?.unmount()
  wrapper = undefined
  clearNuxtData('active-heritage-words')
})
afterAll(() => fake.stop())

async function mountQuiz(lang: 'hr' | 'en') {
  await useNuxtApp().$i18n.setLocale(lang)
  wrapper = await mountSuspended(Quiz, { route: `${lang === 'en' ? '/en' : ''}/heritage/kviz` })
  return wrapper
}

const locales = [
  { lang: 'hr' as const, loading: 'Učitavam pitanja…', empty: 'Trebamo još riječi', prompt: 'Što znači ova riječ?', progress: 'Odgovorena pitanja', error: 'Pitanja trenutačno nisu dostupna.', retry: 'Pokušaj opet' },
  { lang: 'en' as const, loading: 'Loading questions…', empty: 'We need a few more words', prompt: 'What does this word mean?', progress: 'Questions answered', error: 'Questions are currently unavailable.', retry: 'Try again' }
]

describe.each(locales)('$lang multiple-choice page', ({ lang, loading, empty, prompt, progress, error, retry }) => {
  it('loads active words into a playable question with four localized options and progress', async () => {
    const page = await mountQuiz(lang)
    await expect.poll(() => page.findAll('[data-option-id]').length).toBe(4)
    const headword = page.get('#question-word').text()
    expect(seeds.map(word => word.headword)).toContain(headword)
    expect(page.get('legend').text()).toBe(prompt)
    expect(page.text()).toContain(lang === 'hr' ? 'Uzorak — riječi još nisu provjerene' : 'Sample — these words are not yet verified')
    expect(page.get('[role="progressbar"]').attributes('aria-label')).toBe(progress)
    expect(page.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('0')
    expect(page.findAll('[data-option-id]').map(option => option.attributes('data-option-id')).sort()).toEqual(seeds.map(word => word.id).sort())
    for (const option of page.findAll('[data-option-id]')) {
      const entry = seeds.find(word => word.id === option.attributes('data-option-id'))!
      expect(option.text()).toContain(entry.meaning[lang])
    }
    expect(page.text()).not.toContain(loading)
    expect(page.text()).not.toContain(empty)
    // The fetched list also drives answer handling and moving to the next question.
    const correctId = seeds.find(word => word.headword === headword)!.id
    await page.get(`[data-option-id="${correctId}"]`).trigger('click')
    expect(page.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('1')
    expect(page.text()).toContain(lang === 'hr' ? 'Bodovi: 1 / 4' : 'Score: 1 / 4')
    const next = page.findAll('button').find(button => button.text() === (lang === 'hr' ? 'Sljedeća riječ' : 'Next word'))!
    await next.trigger('click')
    expect(page.get('#question-word').text()).not.toBe(headword)
    expect(page.text()).toContain(lang === 'hr' ? 'Pitanje 2 / 4' : 'Question 2 / 4')
  })

  it('shows loading rather than too few words until the active-word request finishes', async () => {
    pending = new Promise((resolve) => {
      release = resolve
    })
    const page = await mountQuiz(lang)
    expect(page.text()).toContain(loading)
    expect(page.text()).not.toContain(empty)
    expect(page.find('[data-option-id]').exists()).toBe(false)
    release!()
    await expect.poll(() => page.findAll('[data-option-id]').length).toBe(4)
    expect(page.text()).not.toContain(loading)
  })

  it('shows a localized error and retries the active-word request', async () => {
    unavailable = true
    const page = await mountQuiz(lang)
    await expect.poll(() => page.text()).toContain(error)
    expect(page.text()).not.toContain(empty)
    expect(page.find('[data-option-id]').exists()).toBe(false)
    const button = page.findAll('button').find(button => button.text() === retry)!
    expect(button).toBeDefined()
    unavailable = false
    await button.trigger('click')
    await expect.poll(() => page.findAll('[data-option-id]').length).toBe(4)
    expect(page.text()).not.toContain(error)
  })
})

describe('limited active words', () => {
  it.each([0, 1, 2, 3])('handles %i active words after loading completes', async (count) => {
    for (const entry of seeds.slice(count)) await db.from('heritage_words').update({ active: false }).eq('id', entry.id)
    const page = await mountQuiz('en')
    if (count < 2) {
      await expect.poll(() => page.text()).toContain('We need a few more words')
      expect(page.text()).toContain('at least two distinct meanings')
      expect(page.find('[data-option-id]').exists()).toBe(false)
    } else {
      await expect.poll(() => page.findAll('[data-option-id]').length).toBe(count)
      expect(page.text()).toContain(`This word has ${count} distinct answer choices available.`)
      expect(page.get('[role="progressbar"]').attributes('aria-label')).toBe('Questions answered')
    }
  })
})
