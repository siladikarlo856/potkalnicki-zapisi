import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { ref } from 'vue'
import PhotoSubmissionForm from '../app/components/heritage/PhotoSubmissionForm.vue'
import ContributionPhotoUpload from '../app/components/heritage/ContributionPhotoUpload.vue'
import type { LocalPhoto } from '../app/components/heritage/ContributionPhotoUpload.vue'

const { request, signIn, account } = vi.hoisted(() => ({ request: vi.fn(), signIn: vi.fn(), account: { signedIn: true } }))
mockNuxtImport('$fetch', () => request)
mockNuxtImport('useAuthSession', () => () => ({
  user: ref(account.signedIn ? { id: 'contributor' } : null),
  session: ref({ access_token: 'token' }),
  configured: true,
  signIn
}))

let page: Awaited<ReturnType<typeof mountSuspended>> | undefined
beforeEach(() => {
  request.mockReset()
  signIn.mockReset()
  account.signedIn = true
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-photo')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
})
afterEach(() => {
  page?.unmount()
  page = undefined
  vi.restoreAllMocks()
})

function photo(id: string, error?: string): LocalPhoto {
  return {
    id, file: new File(['photo'], `${id}.jpg`, { type: 'image/jpeg' }), previewUrl: `blob:${id}`,
    alt: 'Crkva', author: 'Ana', publishPermission: 'own', error
  }
}

async function open(photos: LocalPhoto[]) {
  page = await mountSuspended(PhotoSubmissionForm, { attachTo: document.body })
  page.getComponent(ContributionPhotoUpload).vm.$emit('update:photos', photos)
  await page.get('[role="checkbox"]').trigger('click')
  return page
}

describe('photo submission form', () => {
  it('returns to the photo route and its query after signing in', async () => {
    account.signedIn = false
    const path = '/doprinesi/?vrsta=fotografija&izvor=test'
    page = await mountSuspended(PhotoSubmissionForm, { route: path, attachTo: document.body })
    await page.get('[data-testid="photo-sign-in-required"] button').trigger('click')
    expect(signIn).toHaveBeenCalledWith(path)
  })

  it('attaches local errors to the original visible photo index', async () => {
    const shown = await open([photo('invalid', 'Wrong format'), { ...photo('valid'), alt: '', author: '', publishPermission: '' }])
    await shown.get('form').trigger('submit')
    await vi.waitFor(() => expect(shown.get('input[name="photo-1-alt"]').attributes('aria-invalid')).toBe('true'))
    expect(shown.get('input[name="photo-1-author"]').attributes('aria-invalid')).toBe('true')
    expect(shown.text()).toContain('Označi smijemo li objaviti fotografiju.')
    expect(request).not.toHaveBeenCalled()
  })

  it('sends every selected photo and maps server errors to matching field indices', async () => {
    request.mockRejectedValue({ statusCode: 400, data: { data: { issues: [
      { path: 'photos[1].alt', message: 'Provjeri opis.' },
      { path: 'photos[1].author', message: 'Provjeri autora.' },
      { path: 'photos[1].publishPermission', message: 'Provjeri dopuštenje.' }
    ] } } })
    const shown = await open([photo('first'), photo('second')])
    await shown.get('form').trigger('submit')
    await vi.waitFor(() => expect(shown.text()).toContain('Provjeri opis.'))
    expect(shown.get('input[name="photo-1-alt"]').attributes('aria-invalid')).toBe('true')
    expect(shown.get('input[name="photo-1-author"]').attributes('aria-invalid')).toBe('true')
    expect(shown.text()).toContain('Provjeri autora.')
    expect(shown.text()).toContain('Provjeri dopuštenje.')
    const body = request.mock.calls[0]![1].body as FormData
    expect(body.get('photo-0')).toMatchObject({ name: 'first.jpg' })
    expect(body.get('photo-1')).toMatchObject({ name: 'second.jpg' })
  })

  it.each(['type', 'size'])('blocks the whole contribution until the invalid %s selection is removed', async (failure) => {
    request.mockResolvedValue({ ok: true })
    const shown = await open([photo('valid')])
    const invalid = new File(['x'], 'invalid.png', { type: failure === 'type' ? 'text/plain' : 'image/png' })
    if (failure === 'size') Object.defineProperty(invalid, 'size', { value: 10 * 1024 * 1024 + 1 })
    const input = shown.get<HTMLInputElement>('input[type="file"]')
    Object.defineProperty(input.element, 'files', { configurable: true, value: [invalid] })
    await input.trigger('change')
    expect(shown.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    await shown.get('form').trigger('submit')
    expect(request).not.toHaveBeenCalled()
    expect(shown.getComponent(ContributionPhotoUpload).props('photos')).toHaveLength(2)
    expect(shown.text()).toContain('invalid.png')
    await shown.get('button[aria-label="Ukloni fotografiju invalid.png"]').trigger('click')
    expect(shown.get('button[type="submit"]').attributes('disabled')).toBeUndefined()
    await shown.get('form').trigger('submit')
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1))
    const body = request.mock.calls[0]![1].body as FormData
    expect(body.get('photo-0')).toMatchObject({ name: 'valid.jpg' })
    expect(body.get('photo-1')).toBeNull()
  })

  it.each(['picker', 'drop'])('rejects the entire 4+2 overflow batch from the %s until explicitly resolved', async (method) => {
    request.mockResolvedValue({ ok: true })
    const shown = await open([0, 1, 2, 3].map(index => photo(`existing-${index}`)))
    const fifth = photo('fifth').file
    const sixth = new File(['x'], 'oversized.png', { type: 'image/png' })
    Object.defineProperty(sixth, 'size', { value: 10 * 1024 * 1024 + 1 })
    const input = shown.get<HTMLInputElement>('input[type="file"]')
    if (method === 'picker') {
      Object.defineProperty(input.element, 'files', { configurable: true, value: [fifth, sixth] })
      await input.trigger('change')
    } else {
      await shown.get('[data-testid="photo-dropzone"]').trigger('drop', { dataTransfer: { files: [fifth, sixth] } })
    }
    expect(shown.text()).toContain('Preostalo mjesta za fotografije: 1.')
    expect(shown.text()).toContain('Odaberi manje datoteka ili najprije ukloni odabrane fotografije.')
    expect(shown.getComponent(ContributionPhotoUpload).props('photos').map(value => value.file.name))
      .toEqual([0, 1, 2, 3].map(index => `existing-${index}.jpg`))
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(shown.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    await shown.get('form').trigger('submit')
    expect(request).not.toHaveBeenCalled()

    if (method === 'picker') {
      Object.defineProperty(input.element, 'files', { configurable: true, value: [fifth] })
      await input.trigger('change')
      expect(shown.getComponent(ContributionPhotoUpload).props('photos')).toHaveLength(5)
      expect(shown.get('button[type="submit"]').attributes('disabled')).toBeUndefined()
      await shown.get('input[name="photo-4-alt"]').setValue('Crkva')
      await shown.get('input[name="photo-4-author"]').setValue('Ana')
      await shown.findAll('[role="radiogroup"]')[4]!.get('[role="radio"]').trigger('click')
    } else {
      await shown.get('button[aria-label="Ukloni fotografiju existing-0.jpg"]').trigger('click')
      expect(shown.getComponent(ContributionPhotoUpload).props('photos')).toHaveLength(3)
      expect(shown.get('button[type="submit"]').attributes('disabled')).toBeUndefined()
    }
    expect(shown.getComponent(ContributionPhotoUpload).text()).not.toContain('Preostalo mjesta za fotografije:')
    await shown.get('form').trigger('submit')
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1))
    const body = request.mock.calls[0]![1].body as FormData
    const meta = JSON.parse(String(body.get('meta')))
    expect(meta.photos).toHaveLength(method === 'picker' ? 5 : 3)
    expect(body.get('photo-4')).toEqual(method === 'picker' ? expect.objectContaining({ name: 'fifth.jpg' }) : null)
  })

  it('shows place and file errors while keeping the editable contribution', async () => {
    request.mockRejectedValue({ statusCode: 400, data: { data: { issues: [
      { path: 'placeId', message: 'Ponovno odaberi naselje.' },
      { path: 'photo-0', message: 'Fotografija nije čitljiva.' }
    ] } } })
    const shown = await open([photo('valid')])
    await shown.get('form').trigger('submit')
    await vi.waitFor(() => expect(shown.text()).toContain('Ponovno odaberi naselje.'))
    expect(shown.text()).toContain('Fotografija nije čitljiva.')
    expect(shown.get('input[role="combobox"]').attributes('aria-invalid')).toBe('true')
    expect(shown.get<HTMLInputElement>('input[name="photo-0-alt"]').element.value).toBe('Crkva')
    expect(shown.find('fieldset[disabled]').exists()).toBe(false)
  })

  it('freezes editing and ignores late file selections and drops until the request settles', async () => {
    let finish: () => void = () => {}
    request.mockImplementation(() => new Promise<void>((resolve) => {
      finish = resolve
    }))
    const shown = await open([photo('first')])
    await shown.get('form').trigger('submit')
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1))
    expect(shown.get('fieldset[disabled]').attributes('inert')).toBeDefined()
    expect(shown.get('input[name="photo-0-alt"]').attributes('disabled')).toBeDefined()
    expect(shown.get('input[name="photo-0-author"]').attributes('disabled')).toBeDefined()
    const input = shown.get<HTMLInputElement>('input[type="file"]')
    Object.defineProperty(input.element, 'files', { configurable: true, value: [photo('late').file] })
    await input.trigger('change')
    await shown.get('[data-testid="photo-dropzone"]').trigger('drop', { dataTransfer: { files: [photo('dropped').file] } })
    expect(shown.getComponent(ContributionPhotoUpload).props('photos')).toHaveLength(1)
    finish()
    await vi.waitFor(() => expect(shown.find('form').exists()).toBe(false))
    expect(shown.text()).toContain('Hvala')
  })
})
