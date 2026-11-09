import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { HERITAGE_IMAGE_LIMITS, heritageImageUrl, imageLicenseUrl } from '../shared/utils/content/heritageImage'
import { validateHeritageItem } from '../shared/utils/content/heritageItem'
import { IMAGE_FILE_MAX_BYTES, checkImageFile, checkImageUpload, imageInfo } from '../server/utils/heritageImages'

// Heritage item photos: the credit rules every photo must meet (shared by the admin form and the API) and the
// upload check that reads the file type and size from the bytes. The fixtures are real 5×3 files from cwebp and
// libjpeg, one per encoding the reader handles.
const fixture = (name: string) => readFileSync(new URL(`./fixtures/images/${name}`, import.meta.url))
const base64 = (name: string) => fixture(name).toString('base64')

const UUID = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b'
const photo = (overrides: Record<string, unknown> = {}) => ({
  path: `heritage/${UUID}.webp`,
  thumbPath: `heritage/${UUID}-thumb.webp`,
  width: 1600,
  height: 1200,
  alt: 'Crkva sv. Ane s južne strane',
  caption: null,
  author: 'Ivan Horvat',
  authorUrl: null,
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:Crkva_sv._Ane.jpg',
  license: 'cc-by-sa-4.0',
  ...overrides
})
const item = (images: unknown) => validateHeritageItem({
  name: 'Crkva sv. Ane',
  categoryId: 'cb2f662f-3359-8378-b5f3-448d25991ec6',
  municipalityId: '92140ed6-6420-81d0-8661-91ce0c257f5f',
  verification: 'unverified',
  researchNotes: '',
  sourceIds: [],
  images
})
const paths = (images: unknown) => item(images).issues.map(issue => issue.path)

describe('heritage item photos (validateHeritageItem)', () => {
  it('accepts credited photos in order and treats a missing list as none', () => {
    const second = photo({ path: `heritage/${UUID.replace('6f', '7f')}.jpg`, thumbPath: `heritage/${UUID.replace('6f', '7f')}-thumb.jpg`, license: 'pd' })
    const { value, issues } = item([photo(), second])
    expect(issues).toEqual([])
    expect(value.images.map(image => image.license)).toEqual(['cc-by-sa-4.0', 'pd'])
    expect(item(undefined).value.images).toEqual([])
  })

  it('requires alt text, an author, a known licence and a source page unless used with permission', () => {
    expect(paths([photo({ alt: ' ', author: '', license: 'all-rights-reserved' })]))
      .toEqual(expect.arrayContaining(['images.0.alt', 'images.0.author', 'images.0.license']))
    expect(paths([photo({ sourceUrl: null })])).toEqual(['images.0.sourceUrl'])
    expect(paths([photo({ sourceUrl: null, license: 'permission' })])).toEqual([])
    expect(paths([photo({ sourceUrl: 'javascript:alert(1)' })])).toEqual(['images.0.sourceUrl'])
  })

  it('only takes files the upload endpoint names, at a sane size', () => {
    expect(paths([photo({ path: 'heritage/../secret.webp', thumbPath: `heritage/${UUID}.webp` })]))
      .toEqual(['images.0.path', 'images.0.thumbPath'])
    expect(paths([photo({ width: 0, height: 4001 })])).toEqual(['images.0.width', 'images.0.height'])
  })

  it('refuses the same photo twice and more than the per-item limit', () => {
    expect(paths([photo(), photo()])).toEqual(['images.1.path'])
    const many = Array.from({ length: HERITAGE_IMAGE_LIMITS.perItem + 1 }, (_, n) => {
      const name = UUID.slice(0, -2) + String(n).padStart(2, '0')
      return photo({ path: `heritage/${name}.webp`, thumbPath: `heritage/${name}-thumb.webp` })
    })
    expect(paths(many)).toEqual(['images'])
    expect(paths('nope')).toEqual(['images'])
  })
})

describe('photo licences and URLs', () => {
  it('links each free licence to its deed and permission to none', () => {
    expect(imageLicenseUrl('cc-by-sa-4.0')).toBe('https://creativecommons.org/licenses/by-sa/4.0/')
    expect(imageLicenseUrl('cc-by-2.5')).toBe('https://creativecommons.org/licenses/by/2.5/')
    expect(imageLicenseUrl('cc0-1.0')).toBe('https://creativecommons.org/publicdomain/zero/1.0/')
    expect(imageLicenseUrl('pd')).toBe('https://creativecommons.org/publicdomain/mark/1.0/')
    expect(imageLicenseUrl('permission')).toBeNull()
  })

  it('builds the public Storage URL from the project URL', () => {
    expect(heritageImageUrl('https://abc.supabase.co/', `heritage/${UUID}.webp`))
      .toBe(`https://abc.supabase.co/storage/v1/object/public/heritage-media/heritage/${UUID}.webp`)
  })
})

describe('imageInfo (type and size from the bytes)', () => {
  it.each([
    ['5x3-lossy.webp', 'webp'],
    ['5x3-lossless.webp', 'webp'],
    ['5x3-extended.webp', 'webp'],
    ['5x3-baseline.jpg', 'jpeg'],
    ['5x3-progressive.jpg', 'jpeg']
  ])('reads %s', (name, type) => {
    expect(imageInfo(fixture(name))).toEqual({ type, width: 5, height: 3 })
  })

  it('refuses other files and truncated ones', () => {
    const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000005000000030806000000', 'hex')
    expect(imageInfo(png)).toBeNull()
    expect(imageInfo(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull()
    expect(imageInfo(fixture('5x3-baseline.jpg').subarray(0, 40))).toBeNull()
    expect(imageInfo(fixture('5x3-lossy.webp').subarray(0, 20))).toBeNull()
    expect(imageInfo(new Uint8Array())).toBeNull()
  })
})

describe('checkImageUpload', () => {
  it('passes a WebP or JPEG pair of the same type', () => {
    const checked = checkImageUpload({ image: base64('5x3-lossy.webp'), thumb: base64('5x3-lossless.webp') })
    expect(checked.issues).toEqual([])
    expect(checked.large?.info).toEqual({ type: 'webp', width: 5, height: 3 })
    expect(checkImageUpload({ image: base64('5x3-baseline.jpg'), thumb: base64('5x3-progressive.jpg') }).issues).toEqual([])
  })

  it('names the file that fails and refuses a mixed pair', () => {
    expect(checkImageUpload({ image: 'not base64!', thumb: 42 }).issues.map(issue => issue.path)).toEqual(['image', 'thumb'])
    expect(checkImageUpload({ image: Buffer.from('GIF89a').toString('base64'), thumb: base64('5x3-lossy.webp') }).issues)
      .toEqual([{ path: 'image', message: 'Fotografija: samo WebP ili JPEG.' }])
    expect(checkImageUpload({ image: base64('5x3-lossy.webp'), thumb: base64('5x3-baseline.jpg') }).issues.map(issue => issue.path))
      .toEqual(['thumb'])
  })

  it('refuses files over the byte cap or larger than the side limit', () => {
    const big = Buffer.concat([fixture('5x3-baseline.jpg'), Buffer.alloc(IMAGE_FILE_MAX_BYTES)]).toString('base64')
    expect(checkImageFile(big, 2400, 'Fotografija')).toMatch(/veća od/)
    expect(checkImageFile(base64('5x3-lossy.webp'), 4, 'Umanjena fotografija')).toBe('Umanjena fotografija: najviše 4 piksela po duljoj stranici.')
  })
})
