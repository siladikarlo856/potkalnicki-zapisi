import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import PzVerificationBadge from '../app/components/pz/PzVerificationBadge.vue'
import PzProtectionTag from '../app/components/pz/PzProtectionTag.vue'

describe('PzVerificationBadge', () => {
  const cases = [
    ['unverified', 'U provjeri', 'shield-question'],
    ['verified', 'Provjereno', 'shield-check'],
    ['needs_update', 'Treba ažurirati', 'shield-alert']
  ] as const

  it.each(cases)('renders %s as a pill with its shield and exact label', async (verification, label, icon) => {
    const badge = await mountSuspended(PzVerificationBadge, { props: { verification } })
    expect(badge.text()).toBe(label)
    expect(badge.html()).toContain(`i-lucide:${icon}`)
    expect(badge.classes()).toContain('rounded-full')
  })

  it('treats a missing or in-review status as being checked', async () => {
    expect((await mountSuspended(PzVerificationBadge)).text()).toBe('U provjeri')
    expect((await mountSuspended(PzVerificationBadge, { props: { verification: 'in_review' } })).text()).toBe('U provjeri')
  })

  it('colours only confirmed and outdated states', async () => {
    const verified = await mountSuspended(PzVerificationBadge, { props: { verification: 'verified' } })
    const update = await mountSuspended(PzVerificationBadge, { props: { verification: 'needs_update' } })
    const checking = await mountSuspended(PzVerificationBadge, { props: { verification: 'unverified' } })
    expect(verified.classes()).toContain('text-success')
    expect(update.classes()).toContain('text-warning')
    expect(checking.classes()).toContain('text-muted')
  })
})

describe('PzProtectionTag', () => {
  it('renders a Z- register as protected cultural property with the landmark', async () => {
    const tag = await mountSuspended(PzProtectionTag, { props: { status: 'protected', register: 'Z-1234' } })
    expect(tag.text()).toBe('Zaštićeno kulturno dobro Z-1234')
    expect(tag.html()).toContain('i-lucide:landmark')
    expect(tag.attributes('data-state')).toBe('protected')
  })

  it('renders a P- register as preventively protected', async () => {
    const tag = await mountSuspended(PzProtectionTag, { props: { status: 'protected', register: 'P-4821' } })
    expect(tag.text()).toBe('Preventivno zaštićeno P-4821')
    expect(tag.attributes('data-state')).toBe('preventive')
  })

  it('renders unknown protection without a register number', async () => {
    const tag = await mountSuspended(PzProtectionTag, { props: { status: 'unknown', register: 'Z-1' } })
    expect(tag.text()).toBe('Zaštita: nepoznato')
    expect(tag.html()).toContain('i-lucide:landmark')
  })

  it('is square-cornered and never uses a shield or a status colour', async () => {
    const tag = await mountSuspended(PzProtectionTag, { props: { status: 'protected', register: 'Z-1' } })
    expect(tag.classes()).not.toContain('rounded-full')
    expect(tag.html()).not.toContain('shield')
    expect(tag.html()).not.toMatch(/text-(success|warning|error)/)
  })
})
