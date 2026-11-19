import { afterEach, describe, expect, it, vi } from 'vitest'
import { h, ref } from 'vue'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { UApp, UForm, UInput } from '#components'
import AdminFormField from '../app/components/admin/FormField.vue'
import AdminRichTextField from '../app/components/admin/RichTextField.vue'
import AdminLookupField from '../app/components/admin/LookupField.vue'
import AdminImageField from '../app/components/admin/ImageField.vue'
import type { HeritageImageValue } from '../shared/utils/content/heritageImage'

// The editor's fields of the design system (components/FormField, RichTextField, LookupField, ImageField README.md).

const posts: unknown[] = []
registerEndpoint('/api/admin/images', { method: 'GET', handler: () => ({ base: 'https://slike.example' }) })
registerEndpoint('/api/admin/images', { method: 'POST', handler: () => {
  posts.push(true)
  return { path: 'x.webp', thumbPath: 'x-t.webp', width: 10, height: 10 }
} })
registerEndpoint('/api/admin/lookup/occasion', () => ({ items: [{ id: 'o1', label: 'Martinje' }] }))

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  posts.length = 0
})

function mountInForm(render: () => unknown) {
  return mountSuspended({
    setup: () => () => h(UApp, null, { default: () => h(UForm, { state: {} }, { default: render }) })
  }, { attachTo: document.body })
}

describe('AdminFormField', () => {
  it('marks an optional field with "neobavezno" after the label and leaves a required one unmarked', async () => {
    wrapper = await mountInForm(() => [
      h(AdminFormField, { name: 'locality', label: 'Lokalitet', optional: true }, { default: () => h(UInput) }),
      h(AdminFormField, { name: 'name', label: 'Naziv' }, { default: () => h(UInput) })
    ])
    const labels = wrapper.findAll('label')
    expect(labels[0]!.text()).toBe('Lokalitet neobavezno')
    expect(labels[1]!.text()).toBe('Naziv')
  })

  it('counts against the limit and turns the counter into an error only past it', async () => {
    const count = ref(142)
    wrapper = await mountInForm(() => h(AdminFormField, { name: 'description', label: 'Opis', count: count.value, max: 240 }, { default: () => h(UInput) }))
    const counter = () => wrapper!.find('[data-testid="admin-field-count"]')
    expect(counter().text()).toBe('142 / 240')
    expect(counter().classes()).not.toContain('text-error')
    count.value = 240
    await nextTick()
    expect(counter().classes()).not.toContain('text-error')
    count.value = 241
    await nextTick()
    expect(counter().text()).toBe('241 / 240')
    expect(counter().classes()).toContain('text-error')
  })
})

describe('AdminRichTextField', () => {
  it('edits a labelled multi-line text and keeps the count of what was typed', async () => {
    const value = ref('Kaj')
    wrapper = await mountInForm(() => h(AdminRichTextField, {
      'name': 'description', 'label': 'Opis', 'optional': true, 'maxlength': 20,
      'modelValue': value.value, 'onUpdate:modelValue': (next: string) => { value.value = next }
    }))
    const textarea = wrapper.find<HTMLTextAreaElement>('textarea')
    expect(textarea.attributes('maxlength')).toBe('20')
    expect(wrapper.find(`label[for="${textarea.attributes('id')}"]`).text()).toBe('Opis neobavezno')
    await textarea.setValue('Kaj je novo')
    expect(value.value).toBe('Kaj je novo')
    await nextTick()
    expect(wrapper.find('[data-testid="admin-field-count"]').text()).toBe('11 / 20')
  })
})

describe('AdminLookupField', () => {
  it('labels the server-searched choice and names the chosen row', async () => {
    wrapper = await mountInForm(() => h(AdminLookupField, {
      name: 'occasionId', label: 'Prigoda', optional: true, endpoint: '/api/admin/lookup/occasion', modelValue: 'o1'
    }))
    expect(wrapper.find('label').text()).toBe('Prigoda neobavezno')
    await vi.waitFor(() => expect(wrapper!.text()).toContain('Martinje'))
  })
})

describe('AdminImageField', () => {
  const image: HeritageImageValue = {
    path: 'a.webp', thumbPath: 'a-t.webp', width: 1600, height: 1200, alt: 'Kapelica', caption: null,
    author: 'Ana', authorUrl: null, sourceUrl: null, license: 'cc-by-4.0'
  }

  it('marks the first photo as the cover and asks for the credit of each one', async () => {
    wrapper = await mountInForm(() => h(AdminImageField, { images: [image, { ...image, path: 'b.webp' }] }))
    expect(wrapper.findAll('[data-testid="admin-image-cover"]')).toHaveLength(1)
    expect(wrapper.find('[data-testid="admin-image-cover"]').text()).toBe('Naslovna')
    const labels = wrapper.findAll('label').map(label => label.text())
    expect(labels).toContain('Opis slike za čitače zaslona')
    expect(labels).toContain('Licencija')
    expect(labels).toContain('Izvor ili poveznica')
  })

  it('refuses a file that is not a photo in words, without uploading it', async () => {
    wrapper = await mountInForm(() => h(AdminImageField, { images: [] }))
    const input = wrapper.find<HTMLInputElement>('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [new File(['%PDF'], 'zapisnik.pdf', { type: 'application/pdf' })], configurable: true })
    await input.trigger('change')
    await vi.waitFor(() => expect(wrapper!.find('[role="alert"]').text()).toBe('zapisnik.pdf: Ovaj oblik datoteke nije podržan. Prenesi JPG, PNG ili WebP.'))
    expect(posts).toEqual([])
  })
})
