import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { once } from 'node:events'
import { crc32, createDeflate, deflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { contributorImageInfo, matchPhotoFiles, parsePhotoSubmissionMeta } from '../server/utils/submissionPhotos'

const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'images')

function chunk(type: string, data: Buffer) {
  const result = Buffer.alloc(data.length + 12)
  result.writeUInt32BE(data.length)
  result.write(type, 4)
  data.copy(result, 8)
  result.writeUInt32BE(crc32(result.subarray(4, -4)), result.length - 4)
  return result
}

function png(data = deflateSync(Buffer.alloc(3 * (1 + 5 * 4))), dimensions = { width: 5, height: 3, bitDepth: 8, colorType: 6 }) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(dimensions.width, 0)
  header.writeUInt32BE(dimensions.height, 4)
  header[8] = dimensions.bitDepth
  header[9] = dimensions.colorType
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header), chunk('IDAT', data), chunk('IEND', Buffer.alloc(0))
  ])
}

describe('contributorImageInfo', () => {
  it('accepts JPEG and PNG and refuses other formats', async () => {
    for (const fixture of ['5x3-baseline.jpg', '5x3-progressive.jpg']) {
      expect(await contributorImageInfo(readFileSync(join(fixtures, fixture)))).toEqual({ type: 'jpeg', width: 5, height: 3 })
    }
    expect(await contributorImageInfo(png())).toEqual({ type: 'png', width: 5, height: 3 })
    expect(await contributorImageInfo(Buffer.from('GIF89a'))).toBeNull()
    expect(await contributorImageInfo(readFileSync(join(fixtures, '5x3-lossy.webp')))).toBeNull()
  })

  it('refuses truncated PNGs, incomplete signatures, missing data and corrupt chunks', async () => {
    const valid = png()
    for (let length = 0; length < valid.length; length++) {
      expect(await contributorImageInfo(valid.subarray(0, length))).toBeNull()
    }
    const badSignature = Buffer.from(valid)
    badSignature[7] = 0
    expect(await contributorImageInfo(badSignature)).toBeNull()
    const corrupt = Buffer.from(valid)
    corrupt[29] = corrupt[29]! ^ 1
    expect(await contributorImageInfo(corrupt)).toBeNull()
    expect(await contributorImageInfo(Buffer.concat([valid.subarray(0, 33), chunk('IEND', Buffer.alloc(0))]))).toBeNull()
    const oldHeader = Buffer.alloc(24)
    oldHeader.writeUInt32BE(0x89504e47, 0)
    oldHeader.writeUInt32BE(8, 16)
    oldHeader.writeUInt32BE(6, 20)
    expect(await contributorImageInfo(oldHeader)).toBeNull()
    expect((await matchPhotoFiles([{ name: 'photo-0', data: oldHeader }], 1)).files).toEqual([])
  })

  it('refuses JPEG headers and PNG chunks without complete pixel data', async () => {
    const headerOnlyJpeg = Buffer.from('ffd8ffc00011080003000503', 'hex')
    const jpeg = readFileSync(join(fixtures, '5x3-baseline.jpg'))
    const invalidFilter = Buffer.alloc(3 * (1 + 5 * 4))
    invalidFilter[0] = 5
    for (const data of [headerOnlyJpeg, jpeg.subarray(0, -2), png(Buffer.from('junk')), png(deflateSync(Buffer.alloc(1))), png(deflateSync(invalidFilter))]) {
      expect(await contributorImageInfo(data)).toBeNull()
      const matched = await matchPhotoFiles([{ name: 'photo-0', data }], 1)
      expect(matched.files).toEqual([])
      expect(matched.issues).toHaveLength(1)
    }
  })

  it('refuses a complete, highly compressed PNG above the default pixel bound', async () => {
    const dimensions = { width: 30_000, height: 30_000, bitDepth: 1, colorType: 0 }
    const deflater = createDeflate()
    const chunks: Buffer[] = []
    deflater.on('data', chunk => chunks.push(chunk))
    const finished = once(deflater, 'end')
    const row = Buffer.alloc(1 + Math.ceil(dimensions.width / 8))
    for (let y = 0; y < dimensions.height; y++) {
      if (!deflater.write(row)) await once(deflater, 'drain')
    }
    deflater.end()
    await finished
    const data = png(Buffer.concat(chunks), dimensions)
    expect(data.length).toBeLessThan(10 * 1024 * 1024)
    expect(await contributorImageInfo(data)).toBeNull()
    const matched = await matchPhotoFiles([{ name: 'photo-0', data }], 1)
    expect(matched.files).toEqual([])
    expect(matched.issues).toEqual([{ path: 'photo-0', message: expect.any(String) }])
  })
})

describe('parsePhotoSubmissionMeta', () => {
  it('requires consent, locale and at least one described photo', () => {
    const bad = parsePhotoSubmissionMeta({ locale: 'hr', consentPublish: false, photos: [] })
    expect(bad.ok).toBe(false)
    if (bad.ok) return
    expect(bad.issues.some(issue => issue.path === 'consentPublish')).toBe(true)

    const good = parsePhotoSubmissionMeta({
      locale: 'hr',
      consentPublish: true,
      photos: [{ alt: 'Crkva', author: 'Ana', publishPermission: true }]
    })
    expect(good.ok).toBe(true)
  })
})

describe('matchPhotoFiles', () => {
  it('pairs uploaded files with metadata count', async () => {
    const jpeg = readFileSync(join(fixtures, '5x3-baseline.jpg'))
    const matched = await matchPhotoFiles([{
      name: 'photo-0',
      filename: 'crkva.jpg',
      data: jpeg
    }], 1)
    expect(matched.issues).toEqual([])
    expect(matched.files).toHaveLength(1)
    expect(matched.files[0]!.info.type).toBe('jpeg')

    const missing = await matchPhotoFiles([], 1)
    expect(missing.files).toEqual([])
    expect(missing.issues.length).toBeGreaterThan(0)
  })
})
