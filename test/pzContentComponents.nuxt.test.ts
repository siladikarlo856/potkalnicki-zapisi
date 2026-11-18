import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import PzVerificationStamp from '../app/components/pz/PzVerificationStamp.vue'
import PzProtectionPlaque from '../app/components/pz/PzProtectionPlaque.vue'
import PzSampleLabel from '../app/components/pz/PzSampleLabel.vue'
import PzStatusBadge from '../app/components/pz/PzStatusBadge.vue'
import PzKindTag from '../app/components/pz/PzKindTag.vue'
import PzBadge from '../app/components/pz/PzBadge.vue'
import PzChip from '../app/components/pz/PzChip.vue'
import PzCard from '../app/components/pz/PzCard.vue'
import PzRecordCard from '../app/components/pz/PzRecordCard.vue'
import PzTile from '../app/components/pz/PzTile.vue'
import PzFactsPanel from '../app/components/pz/PzFactsPanel.vue'
import PzRecordLayout from '../app/components/pz/PzRecordLayout.vue'
import PzQuote from '../app/components/pz/PzQuote.vue'
import PzVerse from '../app/components/pz/PzVerse.vue'
import PzDialectTerm from '../app/components/pz/PzDialectTerm.vue'
import PzWordRow from '../app/components/pz/PzWordRow.vue'
import PzSourceList from '../app/components/pz/PzSourceList.vue'
import PzFilterBar from '../app/components/pz/PzFilterBar.vue'
import PzSearchField from '../app/components/pz/PzSearchField.vue'
import PzListToolbar from '../app/components/pz/PzListToolbar.vue'
import PzLoadMore from '../app/components/pz/PzLoadMore.vue'
import PzAlphabetIndex from '../app/components/pz/PzAlphabetIndex.vue'
import PzSchematicMap from '../app/components/pz/PzSchematicMap.vue'
import PzShareOptions from '../app/components/pz/PzShareOptions.vue'
import { alphabetLetter, countNoun, foldHr, HR_ALPHABET } from '../app/utils/pzText'

// The Reljef content and trust components, each against its design-system specification.

describe('pzText helpers', () => {
  it('folds case and diacritics', () => {
    expect(foldHr('Škrlak')).toBe('skrlak')
    expect(foldHr('Đurđevac')).toBe('durdevac')
  })

  it('lists thirty letters including the digraphs', () => {
    expect(HR_ALPHABET).toHaveLength(30)
    expect(alphabetLetter('ljeto')).toBe('LJ')
    expect(alphabetLetter('njiva')).toBe('NJ')
    expect(alphabetLetter('džep')).toBe('DŽ')
    expect(alphabetLetter('škrlak')).toBe('Š')
  })

  it('inflects counts', () => {
    expect(countNoun(1, 'zapis', 'zapisa')).toBe('1 zapis')
    expect(countNoun(2, 'zapis', 'zapisa')).toBe('2 zapisa')
    expect(countNoun(5, 'zapis', 'zapisa')).toBe('5 zapisa')
    expect(countNoun(11, 'zapis', 'zapisa')).toBe('11 zapisa')
  })
})

describe('PzVerificationStamp', () => {
  it.each([
    ['pend', 'U provjeri', 'circle-dashed', 'border-dashed'],
    ['ok', 'Provjereno', 'check', 'text-success'],
    ['warn', 'Treba ažurirati', 'refresh-cw', 'text-warning']
  ] as const)('renders %s with its exact word, icon and outline', async (state, label, icon, cls) => {
    const stamp = await mountSuspended(PzVerificationStamp, { props: { state } })
    expect(stamp.text()).toBe(label)
    expect(stamp.html()).toContain(`i-lucide:${icon}`)
    expect(stamp.classes()).toContain('rounded-full')
    expect(stamp.classes()).toContain(cls)
    expect(stamp.element.tagName).toBe('SPAN')
  })

  it('is a dialog-opening button when interactive', async () => {
    const stamp = await mountSuspended(PzVerificationStamp, { props: { state: 'ok', interactive: true } })
    expect(stamp.element.tagName).toBe('BUTTON')
    expect(stamp.attributes('type')).toBe('button')
    expect(stamp.attributes('aria-haspopup')).toBe('dialog')
    await stamp.trigger('click')
    expect(stamp.emitted('click')).toBeUndefined() // native click: the consumer listens on the element
  })
})

describe('PzProtectionPlaque', () => {
  it.each([
    ['z', 'Zaštićeno kulturno dobro', 'Registar: Z-1234', 'shield-check'],
    ['p', 'Preventivno zaštićeno', 'Registar: P-5678', 'shield-half'],
    ['u', 'Zaštita: nepoznato', 'Nema podatka u registru', 'shield-question']
  ] as const)('renders %s', async (status, title, line, icon) => {
    const plaque = await mountSuspended(PzProtectionPlaque, { props: { status, number: status === 'z' ? 'Z-1234' : 'P-5678' } })
    expect(plaque.text()).toContain(title)
    expect(plaque.text()).toContain(line)
    expect(plaque.html()).toContain(`i-lucide:${icon}`)
    expect(plaque.classes()).toContain('rounded-xs')
    expect(plaque.classes()).not.toContain('rounded-full')
  })

  it('has a dashed outline for preventive protection', async () => {
    const plaque = await mountSuspended(PzProtectionPlaque, { props: { status: 'p', number: 'P-1' } })
    expect(plaque.classes()).toContain('border-dashed')
  })

  it('is full width as a block', async () => {
    const plaque = await mountSuspended(PzProtectionPlaque, { props: { status: 'z', number: 'Z-1', block: true } })
    expect(plaque.classes()).toContain('flex')
  })

  it('mini shows the shield and number, with the status in hidden text', async () => {
    const plaque = await mountSuspended(PzProtectionPlaque, { props: { status: 'z', number: 'Z-1234', mini: true } })
    expect(plaque.text()).toBe('Zaštićeno kulturno dobro, Z-1234')
    expect(plaque.find('.sr-only').text()).toContain('Zaštićeno kulturno dobro')
    expect(plaque.find('b').exists()).toBe(false)
  })

  it('mini is not used for nepoznato and falls back to the full form', async () => {
    const plaque = await mountSuspended(PzProtectionPlaque, { props: { status: 'u', mini: true } })
    expect(plaque.text()).toContain('Nema podatka u registru')
  })

  it('links to the register entry when the address is known', async () => {
    const plaque = await mountSuspended(PzProtectionPlaque, { props: { status: 'z', number: 'Z-1', href: 'https://registar.example/Z-1' } })
    expect(plaque.element.tagName).toBe('A')
    expect(plaque.attributes('href')).toBe('https://registar.example/Z-1')
  })
})

describe('PzSampleLabel', () => {
  it('says Uzorak, square and dashed', async () => {
    const label = await mountSuspended(PzSampleLabel)
    expect(label.text()).toBe('Uzorak')
    expect(label.classes()).toContain('border-dashed')
    expect(label.classes()).not.toContain('rounded-full')
  })
})

describe('PzStatusBadge', () => {
  it.each([
    ['draft', 'Skica', 'pencil-line'],
    ['published', 'Objavljeno', 'globe'],
    ['archived', 'Arhivirano', 'archive']
  ] as const)('renders %s with word and icon', async (status, label, icon) => {
    const badge = await mountSuspended(PzStatusBadge, { props: { status } })
    expect(badge.text()).toBe(label)
    expect(badge.html()).toContain(`i-lucide:${icon}`)
    expect(badge.html()).toContain('rounded-xs')
    expect(badge.html()).not.toContain('rounded-full')
  })

  it('shows unpublished changes and renders a plain label', async () => {
    const changed = await mountSuspended(PzStatusBadge, { props: { status: 'published', unpublishedChanges: true } })
    expect(changed.text()).toContain('ima neobjavljene izmjene')
    const plain = await mountSuspended(PzStatusBadge, { slots: { default: 'Naslovna' } })
    expect(plain.text()).toBe('Naslovna')
    expect(plain.attributes('data-status')).toBe('plain')
  })
})

describe('PzKindTag', () => {
  it('is a neutral tag with no icon, and an overline form', async () => {
    const tag = await mountSuspended(PzKindTag, { slots: { default: 'Priča' } })
    expect(tag.text()).toBe('Priča')
    expect(tag.html()).not.toContain('i-lucide')
    const overline = await mountSuspended(PzKindTag, { props: { overline: true }, slots: { default: 'Priča · predaja' } })
    expect(overline.element.tagName).toBe('P')
    expect(overline.text()).toBe('Priča · predaja')
  })
})

describe('PzBadge', () => {
  it('hides at zero and adds hidden text for the noun', async () => {
    const zero = await mountSuspended(PzBadge, { props: { count: 0 } })
    expect(zero.find('[data-testid="pz-badge"]').exists()).toBe(false)
    const two = await mountSuspended(PzBadge, { props: { count: 2, noun: 'aktivna filtra' } })
    expect(two.text()).toBe('2 aktivna filtra')
    expect(two.find('.sr-only').text()).toBe('aktivna filtra')
  })

  it('has default, attention and quiet variants and carries words without a count', async () => {
    expect((await mountSuspended(PzBadge, { props: { count: 1 } })).classes()).toContain('bg-primary')
    expect((await mountSuspended(PzBadge, { props: { count: 1, variant: 'attn' } })).classes().join(' ')).toContain('--pz-accent')
    expect((await mountSuspended(PzBadge, { props: { count: 1, variant: 'quiet' } })).classes()).toContain('bg-elevated')
    expect((await mountSuspended(PzBadge, { props: { variant: 'attn' }, slots: { default: 'Na tebi je red' } })).text()).toBe('Na tebi je red')
  })
})

describe('PzChip', () => {
  it('is a toggle with aria-pressed and a check icon when selected', async () => {
    const off = await mountSuspended(PzChip, { props: { selected: false }, slots: { default: 'Sve' } })
    expect(off.attributes('aria-pressed')).toBe('false')
    expect(off.html()).not.toContain('i-lucide:check')
    const on = await mountSuspended(PzChip, { props: { selected: true }, slots: { default: 'Sve' } })
    expect(on.attributes('aria-pressed')).toBe('true')
    expect(on.html()).toContain('i-lucide:check')
    expect(on.classes()).toContain('bg-inverted')
    expect(on.classes()).toContain('min-h-11')
  })

  it('is a link with a count', async () => {
    const chip = await mountSuspended(PzChip, { props: { to: '/mjesta/kalnik/', count: 12, countNoun: 'zapisa' }, slots: { default: 'Kalnik' } })
    expect(chip.element.tagName).toBe('A')
    expect(chip.attributes('href')).toBe('/mjesta/kalnik/')
    expect(chip.attributes('aria-pressed')).toBeUndefined()
    expect(chip.text()).toBe('Kalnik12 zapisa')
  })

  it('is removable with hidden text and a close icon', async () => {
    const chip = await mountSuspended(PzChip, { props: { removable: true }, slots: { default: 'Kalnik' } })
    expect(chip.html()).toContain('i-lucide:x')
    expect(chip.text()).toContain(', ukloni filtar')
    expect(chip.attributes('aria-pressed')).toBeUndefined()
  })

  it('is 30px high on the admin', async () => {
    const chip = await mountSuspended(PzChip, { props: { selected: false, dense: true }, slots: { default: 'x' } })
    expect(chip.classes()).toContain('min-h-7.5')
  })
})

describe('PzCard', () => {
  it('is a section labelled by its title, with the head link slot', async () => {
    const card = await mountSuspended(PzCard, { props: { title: 'Podaci', sub: 'Osnovno' }, slots: { 'default': 'Tijelo', 'head-end': '<a href="/x">Sve</a>' } })
    const section = card.find('section')
    expect(section.exists()).toBe(true)
    const id = section.attributes('aria-labelledby')!
    expect(card.find(`#${id}`).text()).toBe('Podaci')
    expect(card.text()).toContain('Osnovno')
    expect(card.text()).toContain('Sve')
    expect(card.text()).toContain('Tijelo')
  })

  it('has no shadow, a 16px radius and a subtle variant', async () => {
    const card = await mountSuspended(PzCard, { props: { variant: 'subtle' }, slots: { default: 'x' } })
    expect(card.html()).toContain('shadow-none')
    expect(card.html()).toContain('rounded-lg')
    expect(card.classes()).toContain('bg-elevated')
  })
})

describe('PzRecordCard', () => {
  const base = { to: '/bastina/crkva/', title: 'Crkva sv. Ivana', sub: 'Kalnik · sakralna građevina' }

  it('is one link whose text is the title then the sub line', async () => {
    const card = await mountSuspended(PzRecordCard, { props: { ...base, icon: 'i-lucide-church' } })
    expect(card.element.tagName).toBe('A')
    expect(card.attributes('href')).toBe('/bastina/crkva/')
    expect(card.text()).toContain('Crkva sv. Ivana')
    expect(card.text()).toContain('Kalnik · sakralna građevina')
    expect(card.find('a a, a button').exists()).toBe(false)
  })

  it('renders the photograph as decorative', async () => {
    const card = await mountSuspended(PzRecordCard, { props: { ...base, image: '/x.jpg' } })
    expect(card.find('img').attributes('alt')).toBe('')
  })

  it('keeps the label order: sample, stamp, mini plaque', async () => {
    const card = await mountSuspended(PzRecordCard, {
      props: { ...base, icon: 'i-lucide-church', sample: true, verification: 'ok', protection: { status: 'z', number: 'Z-1' } }
    })
    const labels = card.find('[data-testid="record-card-labels"]').html()
    expect(labels.indexOf('sample-label')).toBeLessThan(labels.indexOf('verification-stamp-ok'))
    expect(labels.indexOf('verification-stamp-ok')).toBeLessThan(labels.indexOf('protection-plaque-z'))
    expect(card.find('[data-testid="protection-plaque-z"]').text()).toBe('Zaštićeno kulturno dobro, Z-1')
  })

  it('leads with the kind when there is no image', async () => {
    const card = await mountSuspended(PzRecordCard, { props: { to: '/price/x/', title: 'Kako je nastao Kalnik', kind: 'Priča' } })
    expect(card.attributes('data-variant')).toBe('noimg')
    expect(card.text()).toMatch(/^Priča/)
  })

  it('has a tall variant for three-column grids', async () => {
    const card = await mountSuspended(PzRecordCard, { props: { ...base, icon: 'i-lucide-church', tall: true } })
    expect(card.attributes('data-variant')).toBe('tall')
  })
})

describe('PzTile', () => {
  it('is one link with a decorative icon and optional line', async () => {
    const tile = await mountSuspended(PzTile, { props: { to: '/bastina/', icon: 'i-lucide-church', name: 'Baština', line: '24 zapisa' } })
    expect(tile.element.tagName).toBe('A')
    expect(tile.text()).toBe('Baština24 zapisa')
    expect(tile.find('[aria-hidden="true"]').exists()).toBe(true)
    const bare = await mountSuspended(PzTile, { props: { to: '/bastina/', icon: 'i-lucide-church', name: 'Baština' } })
    expect(bare.find('small').exists()).toBe(false)
  })

  it('has surface and row variants', async () => {
    const surface = await mountSuspended(PzTile, { props: { to: '/', icon: 'i-lucide-church', name: 'x', variant: 'surface' } })
    expect(surface.classes()).toContain('bg-default')
    const row = await mountSuspended(PzTile, { props: { to: '/', icon: 'i-lucide-church', name: 'x', variant: 'row' } })
    expect(row.classes()).toContain('items-center')
  })
})

describe('PzFactsPanel', () => {
  it('is a labelled section with a definition list, and a missing value stays as a row', async () => {
    const panel = await mountSuspended(PzFactsPanel, {
      props: { facts: [{ label: 'Vrsta', value: 'Sakralna građevina' }, { label: 'Naselje', value: 'Kalnik', to: '/mjesta/kalnik/' }, { label: 'Razdoblje', value: null }] }
    })
    expect(panel.find('section h2').text()).toBe('Podaci')
    expect(panel.findAll('dt').map(e => e.text())).toEqual(['Vrsta', 'Naselje', 'Razdoblje'])
    expect(panel.findAll('dd')[2]!.text()).toBe('Nije upisano')
    expect(panel.find('dd a').attributes('href')).toBe('/mjesta/kalnik/')
  })

  it('puts the protection plaque last, full width', async () => {
    const panel = await mountSuspended(PzFactsPanel, { props: { facts: [{ label: 'Vrsta', value: 'x' }], protection: { status: 'p', number: 'P-9' } } })
    const plaque = panel.find('[data-testid="protection-plaque-p"]')
    expect(plaque.classes()).toContain('flex')
    expect(panel.html().indexOf('<dl')).toBeLessThan(panel.html().indexOf('protection-plaque-p'))
    expect(panel.find('[data-testid="verification-stamp-ok"]').exists()).toBe(false)
  })

  it('shows a locator map above the facts', async () => {
    const panel = await mountSuspended(PzFactsPanel, { props: { facts: [] }, slots: { locator: '<div data-testid="loc">karta</div>' } })
    expect(panel.find('[data-testid="loc"]').exists()).toBe(true)
  })
})

describe('PzRecordLayout', () => {
  const slots = { media: '<p>M</p>', facts: '<p>F</p>', body: '<p>B</p>', extras: '<p>E</p>' }

  it('keeps the markup order media, facts, body, extras', async () => {
    const layout = await mountSuspended(PzRecordLayout, { slots })
    const order = layout.findAll('[data-testid^="record-"]:not([data-testid="record-layout"])').map(e => e.attributes('data-testid'))
    expect(order).toEqual(['record-media', 'record-facts', 'record-body', 'record-extras'])
    expect(layout.html()).not.toMatch(/\border-/)
  })

  it('drops the media column when there is none', async () => {
    const layout = await mountSuspended(PzRecordLayout, { props: { noMedia: true }, slots })
    expect(layout.find('[data-testid="record-media"]').exists()).toBe(false)
    expect(layout.attributes('data-variant')).toBe('nomedia')
  })
})

describe('PzQuote', () => {
  it('is a blockquote with the dialect in quotation marks, the rendering and a footer', async () => {
    const quote = await mountSuspended(PzQuote, { props: { dialect: 'Škrlak mi je zgubil', rendering: 'Šešir mi se izgubio.', attribution: 'kazivačica Marija K., Kalnik, zabilježeno 2025.' } })
    expect(quote.element.tagName).toBe('BLOCKQUOTE')
    expect(quote.find('i').text()).toBe('„Škrlak mi je zgubil”')
    expect(quote.find('footer').text()).toBe('kazivačica Marija K., Kalnik, zabilježeno 2025.')
    expect(quote.text()).toContain('Šešir mi se izgubio.')
  })
})

describe('PzVerse', () => {
  it('keeps real newlines on both sides with their labels', async () => {
    const verse = await mountSuspended(PzVerse, { props: { dialect: 'Prvi\nDrugi', rendering: 'Prvi stih\nDrugi stih' } })
    expect(verse.text()).toContain('Kako se pjeva')
    expect(verse.text()).toContain('Na standardnom jeziku')
    expect(verse.find('[data-testid="verse-dialect"]').text()).toBe('Prvi\nDrugi')
    expect(verse.find('[data-testid="verse-dialect"]').classes()).toContain('whitespace-pre-line')
    expect(verse.find('[data-testid="verse-rendering"]').text()).toBe('Prvi stih\nDrugi stih')
  })
})

describe('PzDialectTerm', () => {
  it('shows the word in italics with its meaning in parentheses', async () => {
    const term = await mountSuspended(PzDialectTerm, { props: { word: 'škrlak', meaning: 'šešir' } })
    expect(term.text()).toBe('škrlak (šešir)')
    expect(term.find('i').text()).toBe('škrlak')
  })

  it('links to its page with a dotted underline', async () => {
    const term = await mountSuspended(PzDialectTerm, { props: { word: 'škrlak', meaning: 'šešir', to: '/govor/skrlak/' } })
    const link = term.find('a')
    expect(link.attributes('href')).toBe('/govor/skrlak/')
    expect(link.classes()).toContain('decoration-dotted')
  })
})

describe('PzWordRow', () => {
  it('is one link: word, meaning and a chevron by default', async () => {
    const row = await mountSuspended(PzWordRow, { props: { to: '/govor/skrlak/', word: 'škrlak', meaning: 'šešir' } })
    expect(row.element.tagName).toBe('A')
    expect(row.text()).toBe('škrlakšešir')
    expect(row.html()).toContain('i-lucide:chevron-right')
  })

  it('shows the part of speech or a sample label at the end', async () => {
    const pos = await mountSuspended(PzWordRow, { props: { to: '/', word: 'a', meaning: 'b', pos: 'imenica' } })
    expect(pos.text()).toContain('imenica')
    expect(pos.html()).not.toContain('chevron-right')
    const sample = await mountSuspended(PzWordRow, { props: { to: '/', word: 'a', meaning: 'b', sample: true } })
    expect(sample.find('[data-testid="sample-label"]').exists()).toBe(true)
  })

  it('marks matched letters, folding diacritics', async () => {
    const row = await mountSuspended(PzWordRow, { props: { to: '/', word: 'škrlak', meaning: 'šešir', query: 'skr' } })
    expect(row.find('mark').text()).toBe('škr')
    const none = await mountSuspended(PzWordRow, { props: { to: '/', word: 'škrlak', meaning: 'šešir', query: 'xyz' } })
    expect(none.find('mark').exists()).toBe(false)
  })

  it('never truncates a long headword', async () => {
    const row = await mountSuspended(PzWordRow, { props: { to: '/', word: 'nepodnošljivost', meaning: 'm' } })
    expect(row.html()).not.toContain('truncate')
  })
})

describe('PzSourceList', () => {
  it('is an ordered list under an Izvori heading', async () => {
    const list = await mountSuspended(PzSourceList, { props: { sources: ['Kazivanje Marije K., Kalnik, zabilježeno 2025.', 'Registar kulturnih dobara'] } })
    expect(list.find('h2').text()).toBe('Izvori')
    expect(list.findAll('ol > li')).toHaveLength(2)
  })

  it('keeps an empty state visible with the way to add a source', async () => {
    const list = await mountSuspended(PzSourceList, { props: { sources: [], addTo: '/doprinesi/' } })
    expect(list.find('ol').exists()).toBe(false)
    expect(list.text()).toContain('Za ovaj zapis još nema navedenih izvora.')
    expect(list.find('a').text()).toBe('Dodaj izvor')
  })
})

describe('PzSearchField', () => {
  it('is a labelled search form with the site placeholder', async () => {
    const field = await mountSuspended(PzSearchField)
    expect(field.attributes('role')).toBe('search')
    expect(field.find('label.sr-only').exists()).toBe(true)
    expect(field.find('input').attributes('type')).toBe('search')
    expect(field.find('input').attributes('placeholder')).toBe('Mjesto, građevina, osoba, priča, riječ')
  })

  it('offers a clear button named Obriši upit only when there is text, and clears it', async () => {
    const field = await mountSuspended(PzSearchField, { props: { modelValue: 'kal' } })
    const clear = field.find('[data-testid="search-clear"]')
    expect(clear.attributes('aria-label')).toBe('Obriši upit')
    await clear.trigger('click')
    expect(field.emitted('update:modelValue')?.at(-1)).toEqual([''])
    const empty = await mountSuspended(PzSearchField)
    expect(empty.find('[data-testid="search-clear"]').exists()).toBe(false)
  })

  it('submits the query on Enter and searches only after two characters with a delay', async () => {
    const field = await mountSuspended(PzSearchField, { props: { modelValue: '', delay: 5 } })
    await field.find('input').setValue('k')
    await new Promise(resolve => setTimeout(resolve, 30))
    expect(field.emitted('search')).toBeUndefined()
    await field.find('input').setValue('ka')
    await new Promise(resolve => setTimeout(resolve, 30))
    expect(field.emitted('search')?.[0]).toEqual(['ka'])
    await field.find('form').trigger('submit')
    expect(field.emitted('submit')?.[0]).toEqual(['ka'])
  })

  it('announces the number of suggestions and shows the / hint on the desktop header', async () => {
    const field = await mountSuspended(PzSearchField, { props: { suggestionCount: 3, shortcut: true } })
    expect(field.find('[role="status"]').text()).toBe('3 prijedloga')
    expect(field.find('kbd').text()).toBe('/')
  })
})

describe('PzFilterBar', () => {
  const selects = [{ id: 'status', label: 'Stanje', options: [{ value: 'draft', label: 'Skica' }] }]
  const quick = [{ id: 'nolicence', label: 'Bez licencije' }]

  it('shows the count at the right in a status region and no Očisti while nothing is set', async () => {
    const bar = await mountSuspended(PzFilterBar, { props: { selects, quick, count: 143 } })
    expect(bar.find('[data-testid="filter-count"]').attributes('role')).toBe('status')
    expect(bar.find('[data-testid="filter-count"]').text()).toBe('143 zapisa')
    expect(bar.find('[data-testid="filter-clear"]').exists()).toBe(false)
    expect(bar.find('[data-testid="filter-count"]').classes()).toContain('ms-auto')
  })

  it('toggles quick filters, shows Očisti when any is set and clears everything', async () => {
    const bar = await mountSuspended(PzFilterBar, { props: { selects, quick, count: 1 } })
    await bar.find('[data-testid="pz-chip"]').trigger('click')
    const value = bar.emitted('update:modelValue')!.at(-1)![0] as { quick: string[] }
    expect(value.quick).toEqual(['nolicence'])
    await bar.setProps({ modelValue: { query: 'k', selects: {}, quick: ['nolicence'] } })
    expect(bar.find('[data-testid="pz-chip"]').attributes('aria-pressed')).toBe('true')
    await bar.find('[data-testid="filter-clear"]').trigger('click')
    expect(bar.emitted('update:modelValue')!.at(-1)![0]).toEqual({ query: '', selects: {}, quick: [] })
  })
})

describe('PzListToolbar', () => {
  it('shows the inflected count in a status region and hides the badge at zero', async () => {
    const one = await mountSuspended(PzListToolbar, { props: { count: 1 } })
    expect(one.find('[data-testid="toolbar-count"]').text()).toBe('1 zapis')
    expect(one.find('[data-testid="pz-badge"]').exists()).toBe(false)
    expect((await mountSuspended(PzListToolbar, { props: { count: 143 } })).find('[role="status"]').text()).toBe('143 zapisa')
  })

  it('shows active filters as removable chips with Očisti sve, and emits', async () => {
    const toolbar = await mountSuspended(PzListToolbar, { props: { count: 5, activeFilters: [{ id: 'kalnik', label: 'Kalnik' }, { id: 'crkva', label: 'Crkva' }] } })
    expect(toolbar.find('[data-testid="pz-badge"]').text()).toBe('2 aktivna filtra')
    expect(toolbar.findAll('li [data-testid="pz-chip"]')).toHaveLength(2)
    await toolbar.find('li [data-testid="pz-chip"]').trigger('click')
    expect(toolbar.emitted('remove')?.[0]).toEqual(['kalnik'])
    await toolbar.find('[data-testid="toolbar-clear"]').trigger('click')
    expect(toolbar.emitted('clear')).toHaveLength(1)
    await toolbar.find('[data-testid="toolbar-filters"]').trigger('click')
    expect(toolbar.emitted('open-filters')).toHaveLength(1)
  })

  it('has a rail slot that is only visible from 1024px', async () => {
    const toolbar = await mountSuspended(PzListToolbar, { props: { count: 1 }, slots: { rail: '<p>rail</p>' } })
    expect(toolbar.find('[data-testid="toolbar-rail"]').classes()).toEqual(expect.arrayContaining(['hidden', 'lg:block']))
  })
})

describe('PzLoadMore', () => {
  it('says how many are shown and how many will load, and emits load', async () => {
    const more = await mountSuspended(PzLoadMore, { props: { shown: 20, total: 143 } })
    expect(more.text()).toContain('Prikazano 20 od 143')
    expect(more.find('button').text()).toBe('Prikaži još 20')
    await more.find('button').trigger('click')
    expect(more.emitted('load')).toHaveLength(1)
  })

  it('shortens the next step at the tail', async () => {
    const more = await mountSuspended(PzLoadMore, { props: { shown: 140, total: 143 } })
    expect(more.find('button').text()).toBe('Prikaži još 3')
  })

  it('is busy while loading', async () => {
    const more = await mountSuspended(PzLoadMore, { props: { shown: 20, total: 143, state: 'busy' } })
    expect(more.attributes('aria-busy')).toBe('true')
    expect(more.find('button').text()).toBe('Učitavam…')
  })

  it('ends with the full count', async () => {
    const more = await mountSuspended(PzLoadMore, { props: { shown: 143, total: 143 } })
    expect(more.text()).toBe('Prikazano je svih 143 zapisa.')
    expect(more.find('button').exists()).toBe(false)
  })

  it('reports a failure as an alert and retries', async () => {
    const more = await mountSuspended(PzLoadMore, { props: { shown: 20, total: 143, state: 'failed' } })
    expect(more.find('[role="alert"]').text()).toBe('Nismo uspjeli učitati još zapisa.')
    await more.find('button').trigger('click')
    expect(more.emitted('load')).toHaveLength(1)
  })
})

describe('PzAlphabetIndex', () => {
  it('lists all thirty letters; letters without entries are text, not links', async () => {
    const index = await mountSuspended(PzAlphabetIndex, { props: { available: ['A', 'Š', 'LJ'] } })
    expect(index.element.tagName).toBe('NAV')
    expect(index.attributes('aria-label')).toBe('Riječi po početnom slovu')
    expect(index.findAll('a, span')).toHaveLength(30)
    expect(index.findAll('a').map(a => a.text())).toEqual(['A', 'LJ', 'Š'])
    expect(index.findAll('[data-testid="alphabet-empty"]')).toHaveLength(27)
    expect(index.text()).toContain('DŽ')
  })

  it('marks the current letter', async () => {
    const index = await mountSuspended(PzAlphabetIndex, { props: { available: ['A', 'Š'], current: 'š', to: l => `/govor/?slovo=${l}` } })
    const current = index.find('[aria-current="true"]')
    expect(current.text()).toBe('Š')
    expect(current.attributes('href')).toBe('/govor/?slovo=Š')
    expect(index.findAll('[aria-current]')).toHaveLength(1)
  })
})

describe('PzSchematicMap', () => {
  it('is an image with a sentence and four areas', async () => {
    const map = await mountSuspended(PzSchematicMap, { props: { labels: true } })
    const svg = map.find('svg')
    expect(svg.attributes('role')).toBe('img')
    expect(svg.attributes('aria-label')).toBeTruthy()
    expect(map.findAll('path[data-area]').map(p => p.attributes('data-area'))).toEqual(['gornja-rijeka', 'kalnik', 'sveti-petar-orehovec', 'krizevci'])
    expect(map.findAll('text').map(t => t.text())).toEqual(['Gornja Rijeka', 'Kalnik', 'Sv. Petar Orehovec', 'Križevci'])
  })

  it('outlines the selected area and dims the others', async () => {
    const map = await mountSuspended(PzSchematicMap, { props: { selected: 'kalnik' } })
    const kalnik = map.find('[data-area="kalnik"]')
    const other = map.find('[data-area="krizevci"]')
    expect(kalnik.attributes('stroke-width')).toBe('3')
    expect(other.attributes('opacity')).toBe('0.45')
    expect(map.find('svg').attributes('aria-label')).toContain('Kalnik')
  })

  it('is a locator crop with a labelled pin', async () => {
    const map = await mountSuspended(PzSchematicMap, { props: { crop: '0 30 358 130', selected: 'kalnik', pin: { x: 172, y: 84, label: 'Kalnik' }, label: 'Položaj na karti: naselje Kalnik, općina Kalnik' } })
    expect(map.find('svg').attributes('viewBox')).toBe('0 30 358 130')
    expect(map.find('[data-testid="map-pin"]').attributes('cx')).toBe('172')
    expect(map.find('svg').attributes('aria-label')).toBe('Položaj na karti: naselje Kalnik, općina Kalnik')
  })
})

describe('PzShareOptions', () => {
  const props = { url: 'https://example.test/bastina/crkva/', text: 'Crkva sv. Ivana, Kalnik · Potkalnički zapisi' }

  it('offers WhatsApp, Viber and copy, with the text and address filled in', async () => {
    const share = await mountSuspended(PzShareOptions, { props })
    expect(share.find('[data-testid="share-whatsapp"]').attributes('href')).toBe(`https://wa.me/?text=${encodeURIComponent(`${props.text}\n${props.url}`)}`)
    expect(share.find('[data-testid="share-viber"]').attributes('href')).toContain('viber://forward?text=')
    expect(share.find('[data-testid="share-copy"]').text()).toBe('Kopiraj poveznicu')
    expect(share.find('[data-testid="share-preview"]').exists()).toBe(false)
  })

  it('shows exactly what will be sent for a result, and copies text instead of the link', async () => {
    const share = await mountSuspended(PzShareOptions, { props: { ...props, text: 'Kviz 4/5\n🟩🟩🟩🟩⬛\nMožeš li bolje?', preview: true } })
    expect(share.text()).toContain('Ovo će se poslati:')
    expect(share.find('[data-testid="share-preview"]').text()).toBe(`Kviz 4/5\n🟩🟩🟩🟩⬛\nMožeš li bolje?\n${props.url}`)
    expect(share.find('[data-testid="share-copy"]').text()).toBe('Kopiraj tekst')
  })

  it('emits copied on success', async () => {
    const written: string[] = []
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (v: string) => void written.push(v) } })
    const share = await mountSuspended(PzShareOptions, { props })
    await share.find('[data-testid="share-copy"]').trigger('click')
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(written).toEqual([props.url])
    expect(share.emitted('copied')).toHaveLength(1)
    expect(share.find('[data-testid="share-copy-failed"]').exists()).toBe(false)
  })

  it('keeps the sheet open on a copy failure and shows the link in a read-only field', async () => {
    const deny = async () => {
      throw new Error('denied')
    }
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: deny } })
    const share = await mountSuspended(PzShareOptions, { props })
    await share.find('[data-testid="share-copy"]').trigger('click')
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(share.emitted('copied')).toBeUndefined()
    const failed = share.find('[data-testid="share-copy-failed"]')
    expect(failed.text()).toContain('Kopiranje nije uspjelo')
    expect(failed.text()).toContain('Preglednik nije dopustio kopiranje.')
    const field = failed.find('textarea')
    expect(field.attributes('readonly')).toBeDefined()
    expect((field.element as HTMLTextAreaElement).value).toBe(props.url)
  })

  it('shows Više mogućnosti only where the Web Share API exists', async () => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined })
    expect((await mountSuspended(PzShareOptions, { props })).find('[data-testid="share-native"]').exists()).toBe(false)
    Object.defineProperty(navigator, 'share', { configurable: true, value: async () => {} })
    const share = await mountSuspended(PzShareOptions, { props })
    expect(share.find('[data-testid="share-native"]').text()).toBe('Više mogućnosti')
  })
})
