import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import PzChallengeCard from '../app/components/pz/PzChallengeCard.vue'
import PzShareActions from '../app/components/pz/PzShareActions.vue'
import PzShareResult from '../app/components/pz/PzShareResult.vue'

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
const shareDescriptor = Object.getOwnPropertyDescriptor(navigator, 'share')
const writeText = vi.fn(async () => {})
const nativeShare = vi.fn(async () => {})

beforeEach(() => {
  writeText.mockClear()
  nativeShare.mockClear()
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  Object.defineProperty(navigator, 'share', { configurable: true, value: nativeShare })
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.useRealTimers()
  Object.defineProperty(navigator, 'clipboard', clipboardDescriptor ?? { configurable: true, value: undefined })
  Object.defineProperty(navigator, 'share', shareDescriptor ?? { configurable: true, value: undefined })
})

const actionProps = {
  prefix: 'share',
  message: 'Kak se veli? · 7/10\n🟩🟩🟥🟩🟩🟩🟥🟩🟥🟩\nMožeš li bolje? Igraj i ti:\nhttps://example.test/igre',
  url: 'https://example.test/igre',
  shareData: { title: 'Podijeli rezultat', text: 'poruka' }
}

describe('PzShareActions', () => {
  it('sends the prepared message to WhatsApp and Viber with their brand icons', async () => {
    wrapper = await mountSuspended(PzShareActions, { props: actionProps })
    const whatsapp = wrapper.get('[data-testid="share-whatsapp"]')
    const viber = wrapper.get('[data-testid="share-viber"]')
    expect(whatsapp.attributes('href')).toBe(`https://wa.me/?text=${encodeURIComponent(actionProps.message)}`)
    expect(viber.attributes('href')).toBe(`viber://forward?text=${encodeURIComponent(actionProps.message)}`)
    expect(whatsapp.html()).toContain('i-simple-icons:whatsapp')
    expect(viber.html()).toContain('i-simple-icons:viber')
    expect(whatsapp.text()).toBe('WhatsApp')
    expect(viber.text()).toBe('Viber')
    // WhatsApp and Viber come first: the rows precede the link field and its copy button.
    const html = wrapper.html()
    expect(html.indexOf('share-whatsapp')).toBeLessThan(html.indexOf('share-viber'))
    expect(html.indexOf('share-viber')).toBeLessThan(html.indexOf('share-copy'))
  })

  it('offers "Više mogućnosti" only when the browser can share natively', async () => {
    wrapper = await mountSuspended(PzShareActions, { props: actionProps })
    await vi.waitFor(() => expect(wrapper!.find('[data-testid="share-native-share"]').exists()).toBe(true))
    await wrapper.get('[data-testid="share-native-share"]').trigger('click')
    expect(nativeShare).toHaveBeenCalledWith(actionProps.shareData)
    wrapper.unmount()
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined })
    wrapper = await mountSuspended(PzShareActions, { props: actionProps })
    expect(wrapper.find('[data-testid="share-native-share"]').exists()).toBe(false)
  })

  it('copies the link, reads "Kopirano" with a polite announcement, and goes back after two seconds', async () => {
    wrapper = await mountSuspended(PzShareActions, { props: actionProps })
    const link = wrapper.get('[data-testid="share-share-link"]').element as HTMLInputElement
    expect(link.value).toBe(actionProps.url)
    expect(link.readOnly).toBe(true)
    expect(wrapper.get('[data-testid="share-copy"]').text()).toBe('Kopiraj')
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    await wrapper.get('[data-testid="share-copy"]').trigger('click')
    expect(writeText).toHaveBeenCalledWith(actionProps.url)
    await vi.waitFor(() => expect(wrapper!.get('[data-testid="share-copy"]').text()).toBe('Kopirano'))
    expect(wrapper.get('[role="status"]').text()).toBe('Kopirano')
    await vi.advanceTimersByTimeAsync(2000)
    expect(wrapper.get('[data-testid="share-copy"]').text()).toBe('Kopiraj')
    expect(wrapper.get('[role="status"]').text()).toBe('')
  })
})

describe('PzShareResult', () => {
  it('shows the score, one square per question in order, and a text label for the counts', async () => {
    wrapper = await mountSuspended(PzShareResult, { props: { caption: 'Kak se veli? · gotovo', results: [true, true, false, true] } })
    expect(wrapper.get('[data-testid="game-result-score"]').text()).toBe('3 / 4')
    const squares = wrapper.get('[data-testid="pz-squares"]')
    expect(squares.attributes('role')).toBe('img')
    expect(squares.attributes('aria-label')).toBe('3 točno, 1 netočno')
    expect(squares.findAll('span').map(square => square.attributes('data-correct'))).toEqual(['true', 'true', 'false', 'true'])
    expect(wrapper.find('[data-testid="pz-stitch"]').exists()).toBe(true)
  })
})

describe('PzChallengeCard', () => {
  it('is the inverted slab with one wheat button', async () => {
    wrapper = await mountSuspended(PzChallengeCard, {
      props: { overline: 'Izazovi prijatelja', title: 'Tko bolje zna naš kraj?', text: 'Isti set pitanja za sve.', cta: 'Izazovi prijatelje', to: '/izazov' }
    })
    expect(wrapper.classes()).toContain('bg-inverted')
    expect(wrapper.get('h2').text()).toBe('Tko bolje zna naš kraj?')
    expect(wrapper.findAll('a')).toHaveLength(1)
    expect(wrapper.get('[data-testid="pz-challenge-cta"]').attributes('href')).toBe('/izazov')
  })

  it('replaces the copy with "Nastavi izazov · runda 2 od 3" and links to the leaderboard while waiting', async () => {
    wrapper = await mountSuspended(PzChallengeCard, {
      props: { overline: 'Izazov', title: 'Tko bolje zna naš kraj?', active: { code: 'abc123', round: 2, rounds: 3, players: 3 } }
    })
    expect(wrapper.get('[data-testid="pz-challenge-resume"]').text()).toBe('Nastavi izazov · runda 2 od 3')
    expect(wrapper.text()).toContain('Čekamo 3 prijatelja')
    expect(wrapper.get('[data-testid="pz-challenge-cta"]').attributes('href')).toBe('/izazov/abc123')
    expect(wrapper.html()).toContain('/izazov/abc123/ljestvica')
  })
})
