import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtData, clearNuxtState, useNuxtApp } from '#imports'
import { DAILY_STORAGE_KEY } from '../app/composables/useDailyProgress'
import DailyWord from '../app/components/heritage/DailyWord.vue'
import DailyStatus from '../app/components/heritage/DailyStatus.vue'
import DailyStats from '../app/components/heritage/DailyStats.vue'
import Hub from '../app/pages/igre/index.vue'
import type { DailyProgress, DailyWordPayload } from '../shared/utils/dailyWord'

const payload: DailyWordPayload = {
  day: '2026-11-11', number: 12, nextAt: new Date(Date.now() + 5 * 3_600_000).toISOString(), sample: false,
  entry: {
    id: 'hiza', headword: 'hiža', meaning: { hr: 'kuća', en: 'house' }, partOfSpeech: 'imenica', status: 'community',
    sources: [{ id: 'editor', kind: 'editor' }], category: 'house', examples: [{ text: 'Idem v hižu.' }],
    variants: [{ id: 'v1', form: 'hiža', status: 'community', usages: [{ areaId: 'vil-a', confidence: 'reported' }] }]
  },
  areas: [{ id: 'vil-a', name: 'Selo A', kind: 'settlement', parentId: null }], villageAreaId: null,
  options: [
    { id: 'a', text: { hr: 'pas', en: 'dog' } }, { id: 'b', text: { hr: 'stol', en: 'table' } },
    { id: 'c', text: { hr: 'kuća', en: 'house' } }, { id: 'd', text: { hr: 'mlijeko', en: 'milk' } }
  ],
  correctOptionId: 'c',
  clues: [{ kind: 'example', text: 'Idem v hižu.' }, { kind: 'category', category: 'house' }]
}
registerEndpoint('/api/heritage/daily', () => payload)
registerEndpoint('/api/heritage/words', () => ({ words: [], areas: payload.areas }))

const win = (tries: number, day: string): DailyProgress => ({ wordId: 'w', guesses: [], done: true, solved: true, tries, maxTries: 3, finishedAt: `${day}T10:00:00Z` })
const miss = (): DailyProgress => ({ wordId: 'w', guesses: [], done: true, solved: false, tries: 3, maxTries: 3 })
const seed = (days: Record<string, DailyProgress>) => localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify({ version: 1, days }))
const stateKeys = ['heritage-daily-progress', 'heritage-daily-progress-loaded', 'heritage-daily-progress-unavailable']

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
beforeEach(() => {
  localStorage.clear()
  clearNuxtState(stateKeys)
  clearNuxtData('heritage-daily-word')
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})

async function mountDaily(lang: 'hr' | 'en') {
  await useNuxtApp().$i18n.setLocale(lang)
  wrapper = await mountSuspended(DailyWord, { route: lang === 'en' ? '/en' : '/igre' })
  await expect.poll(() => wrapper!.findAll('[data-option-id]').length + wrapper!.findAll('[data-testid="daily-reveal"]').length, { timeout: 5000 }).toBeGreaterThan(0)
  return wrapper
}

const copy = {
  hr: { stats: 'Tvoja statistika', streak: 'Niz', played: 'Odigrano dana', correct: 'Točno', next: ['Uči riječi: Kuća', 'Igraj kviz', 'Izazovi prijatelja'], status: 'Riječ dana ✓ 2/3', waiting: 'Riječ dana čeka', play: 'Igraj', streakWord: 'niz 3 dana', today: 'danas' },
  en: { stats: 'Your stats', streak: 'Streak', played: 'Days played', correct: 'Correct', next: ['Learn words: Kuća', 'Play a quiz', 'Challenge a friend'], status: 'Word of the day ✓ 2/3', waiting: 'Today\'s word is waiting', play: 'Play', streakWord: 'streak 3 days', today: 'today' }
}

describe.each(['hr', 'en'] as const)('%s daily word result', (lang) => {
  const c = copy[lang]

  it('shows streak, played, percent and the distribution after the round, with today outlined', async () => {
    seed({ '2026-11-09': win(1, '2026-11-09'), '2026-11-10': miss() })
    const page = await mountDaily(lang)
    await page.get('[data-option-id="a"]').trigger('click')
    await page.get('[data-option-id="c"]').trigger('click')
    const stats = page.get('[data-testid="daily-stats"]')
    expect(stats.text()).toContain(c.stats)
    expect(stats.get('[data-testid="daily-stat-streak"]').text()).toBe(`${c.streak}3`)
    expect(stats.get('[data-testid="daily-stat-played"]').text()).toBe(`${c.played}3`)
    expect(stats.get('[data-testid="daily-stat-percent"]').text()).toBe(`${c.correct}67%`)
    const rows = stats.findAll('[data-testid="daily-distribution"] tr')
    expect(rows.map(row => row.find('td span.tabular-nums').text())).toEqual(['1', '1', '0', '1'])
    expect(rows.map(row => row.attributes('data-today'))).toEqual([undefined, 'true', undefined, undefined])
    expect(rows[1]!.text()).toContain(c.today)
    // The bars are decoration: every count is also plain text.
    expect(stats.findAll('[aria-hidden="true"]').length).toBeGreaterThan(0)
    expect(stats.find('caption').exists()).toBe(true)
  })

  it('lists the three next steps with the challenge opening the quick quiz', async () => {
    const page = await mountDaily(lang)
    expect(page.find('[data-testid="daily-next-steps"]').exists()).toBe(false)
    await page.get('[data-option-id="c"]').trigger('click')
    const steps = page.get('[data-testid="daily-next-steps"]')
    expect(steps.findAll('a').map(link => link.text())).toEqual(c.next)
    expect(steps.get('[data-testid="daily-next-learn"]').attributes('href')).toContain('/uci/sesija?teme=rijeci-kuca')
    expect(steps.get('[data-testid="daily-next-quiz"]').attributes('href')).toContain('/igre/kviz')
    expect(steps.get('[data-testid="daily-next-challenge"]').attributes('href')).toContain('/igre/kviz')
  })

  it('shares the exact spoiler-free text with encoded WhatsApp and Viber links', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const link = 'https://prigorje.karlo-siladi.from.hr/igre#rijec-dana'
    const page = await mountDaily(lang)
    expect(page.find('[data-testid="daily-share"]').exists()).toBe(false)
    await page.get('[data-option-id="a"]').trigger('click')
    await page.get('[data-option-id="c"]').trigger('click')
    const text = `Riječ dana #12: 2/3\n🟥🟩⬜\n${link}`
    expect(page.get('[data-testid="daily-share-text"]').element.textContent?.trim()).toBe(text)
    expect(page.get('[data-testid="daily-share-text"]').text()).not.toContain('hiža')
    expect(page.get('[data-testid="daily-whatsapp"]').attributes('href')).toBe(`https://wa.me/?text=${encodeURIComponent(text)}`)
    expect(page.get('[data-testid="daily-viber"]').attributes('href')).toBe(`viber://forward?text=${encodeURIComponent(text)}`)
    expect(page.get('[data-testid="daily-whatsapp"]').attributes('href')).toContain('%0A')
    await page.get('[data-testid="daily-copy"]').trigger('click')
    await expect.poll(() => writeText.mock.calls.length).toBe(1)
    expect(writeText).toHaveBeenCalledWith(text)
  })

  it('shares X/3 with three red squares after a miss', async () => {
    const page = await mountDaily(lang)
    for (const id of ['a', 'b', 'd']) await page.get(`[data-option-id="${id}"]`).trigger('click')
    expect(page.get('[data-testid="daily-share-text"]').element.textContent?.trim()).toBe('Riječ dana #12: X/3\n🟥🟥🟥\nhttps://prigorje.karlo-siladi.from.hr/igre#rijec-dana')
    expect(page.get('[data-testid="daily-stats"] [data-today="true"]').text()).toContain(lang === 'hr' ? 'Nije uspjelo' : 'Missed')
  })

  it('offers no share before the round is finished', async () => {
    const page = await mountDaily(lang)
    await page.get('[data-option-id="a"]').trigger('click')
    expect(page.find('[data-testid="daily-share"]').exists()).toBe(false)
    expect(page.find('[data-testid="daily-stats"]').exists()).toBe(false)
  })

  it('shows the flagship status line for unplayed, streak and played states', async () => {
    await useNuxtApp().$i18n.setLocale(lang)
    // First-time visitor: only the invitation.
    wrapper = await mountSuspended(DailyStatus, { route: lang === 'en' ? '/en' : '/igre' })
    await expect.poll(() => wrapper!.find('[data-testid="daily-status"]').exists(), { timeout: 5000 }).toBe(true)
    expect(wrapper.get('[data-testid="daily-status"]').text()).toContain(c.waiting)
    expect(wrapper.find('[data-testid="daily-status-streak"]').exists()).toBe(false)
    wrapper.unmount()

    // Running streak, today unplayed: the streak and a link to the section.
    seed({ '2026-11-08': win(1, '2026-11-08'), '2026-11-09': win(1, '2026-11-09'), '2026-11-10': win(2, '2026-11-10') })
    clearNuxtState(stateKeys)
    wrapper = await mountSuspended(DailyStatus, { route: lang === 'en' ? '/en' : '/igre' })
    await expect.poll(() => wrapper!.find('[data-testid="daily-status"]').exists(), { timeout: 5000 }).toBe(true)
    expect(wrapper.get('[data-testid="daily-status-streak"]').text()).toContain(c.streakWord)
    const play = wrapper.get('[data-testid="daily-status-play"]')
    expect(play.text()).toContain(c.play)
    expect(play.attributes('href')).toBe('#rijec-dana')
    wrapper.unmount()

    // Played today in two tries: the result, the extended streak and the countdown.
    seed({ '2026-11-08': win(1, '2026-11-08'), '2026-11-09': win(1, '2026-11-09'), '2026-11-10': win(2, '2026-11-10'), '2026-11-11': win(2, '2026-11-11') })
    clearNuxtState(stateKeys)
    wrapper = await mountSuspended(DailyStatus, { route: lang === 'en' ? '/en' : '/igre' })
    await expect.poll(() => wrapper!.find('[data-testid="daily-status-result"]').exists(), { timeout: 5000 }).toBe(true)
    const played = wrapper.get('[data-testid="daily-status"]').text()
    expect(played).toContain(c.status)
    expect(played).toContain(lang === 'hr' ? 'niz 4 dana' : 'streak 4 days')
    expect(wrapper.find('[data-testid="daily-countdown"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="daily-status-play"]').exists()).toBe(false)
  })
})

describe('daily status in the Words flagship card', () => {
  it('updates inside the daily word section when today is played on the games hub', async () => {
    await useNuxtApp().$i18n.setLocale('hr')
    wrapper = await mountSuspended(Hub, { route: '/igre' })
    const dailySection = () => wrapper!.get('#rijec-dana')
    await expect.poll(() => dailySection().find('[data-option-id]').exists(), { timeout: 5000 }).toBe(true)
    await wrapper.get('[data-option-id="a"]').trigger('click')
    await wrapper.get('[data-option-id="c"]').trigger('click')
    await expect.poll(() => dailySection().find('[data-testid="daily-reveal"]').exists()).toBe(true)
    expect(dailySection().text()).toContain('hiža')
  })
})

describe('daily stats component', () => {
  it('renders empty stats without dividing by zero and no best-streak line', async () => {
    wrapper = await mountSuspended(DailyStats, { props: { stats: { streak: 0, maxStreak: 0, played: 0, percentCorrect: 0, distribution: { 1: 0, 2: 0, 3: 0, X: 0 } } } })
    expect(wrapper.get('[data-testid="daily-stat-percent"]').text()).toContain('0%')
    expect(wrapper.find('[data-testid="daily-stat-best"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-today]')).toHaveLength(0)
  })

  it('mentions the longest streak once it exceeds the current one', async () => {
    wrapper = await mountSuspended(DailyStats, { props: { stats: { streak: 1, maxStreak: 5, played: 6, percentCorrect: 50, distribution: { 1: 1, 2: 1, 3: 1, X: 3 } }, today: 'X' } })
    expect(wrapper.get('[data-testid="daily-stat-best"]').text()).toContain('5 dana')
    expect(wrapper.get('[data-today="true"]').text()).toContain('Nije uspjelo')
  })
})
