import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { insertPhotoSubmission } from '../server/utils/submissionPhotos'
import type { PhotoSubmissionMeta, CheckedPhotoFile } from '../server/utils/submissionPhotos'
import { deleteSubmission } from '../server/utils/submissions'

const boundary = vi.hoisted(() => ({ client: vi.fn() }))
vi.mock('../server/utils/db', () => ({
  useDatabaseClient: boundary.client,
  databaseError: (error: { message: string }) => { throw Object.assign(new Error(error.message), { statusCode: 500 }) }
}))

type Row = Record<string, unknown>
const parents = new Map<number, Row>()
const attachments: Row[] = []
const objects = new Set<string>()
const order: string[] = []
const trackedAtUpload: string[][] = []
let failure = ''
let uploadCount = 0
let removeFails = false
let removeFailures = 0
let removeRejects = false
let afterRows: (() => Promise<void> | void) | undefined
let duringUpload: ((position: number) => Promise<void> | void) | undefined
let afterParent: (() => Promise<void> | void) | undefined
let beforeDelete: (() => Promise<void> | void) | undefined
let afterRemove: (() => Promise<void> | void) | undefined
let readFails = false

const problem = { message: 'injected failure' }
const meta: PhotoSubmissionMeta = {
  locale: 'hr', name: 'Ana', contact: null, consentPublish: true, placeId: null,
  photos: [
    { alt: 'Crkva', author: 'Ana', publishPermission: true },
    { alt: 'Zvonik', author: 'Ana', publishPermission: true }
  ]
}
const files: CheckedPhotoFile[] = [0, 1].map(index => ({
  bytes: Buffer.from('jpeg'), info: { type: 'jpeg', width: 5, height: 3 }, fileName: `${index}.jpg`
}))

const remove = vi.fn(async (paths: string[]) => {
  order.push('remove objects')
  if (removeFails || removeFailures-- > 0) {
    if (removeRejects) throw new Error(problem.message)
    return { error: problem }
  }
  paths.forEach(path => objects.delete(path))
  await afterRemove?.()
  return { error: null }
})
const upload = vi.fn(async (path: string) => {
  trackedAtUpload.push(attachments.map(row => String(row.path)))
  const position = uploadCount++
  await duringUpload?.(position)
  objects.add(path)
  return { error: failure === `upload-${position}` ? problem : null }
})

const client = {
  storage: { from: () => ({ upload, remove }) },
  rpc: async (_name: string, { p_id: id, p_paths: expected }: { p_id: number, p_paths: string[] }) => {
    await beforeDelete?.()
    if (failure === 'delete') return { data: null, error: problem }
    const paths = attachments.filter(row => row.submission_id === id).map(row => row.path)
    if (!parents.has(id)) return { data: false, error: null }
    if (JSON.stringify(paths) !== JSON.stringify(expected)) return { data: null, error: { message: 'Submission photos changed' } }
    const existed = parents.delete(id)
    for (let index = attachments.length - 1; index >= 0; index--) {
      if (attachments[index]!.submission_id === id) attachments.splice(index, 1)
    }
    order.push('delete parent')
    return { data: existed, error: null }
  },
  from: (table: string) => ({
    insert: (row: Row | Row[]) => {
      if (table === 'heritage_submissions') {
        return { select: () => ({ single: async () => {
          if (failure === 'parent') return { data: null, error: problem }
          parents.set(1, row as Row)
          await afterParent?.()
          return { data: { id: 1 }, error: null }
        } }) }
      }
      const rows = Array.isArray(row) ? row : [row]
      const error = failure === 'rows' || rows.some(value => !parents.has(Number(value.submission_id))) ? problem : null
      return (async () => {
        if (!error) {
          attachments.push(...rows.map(value => ({ ...value })))
          await afterRows?.()
        }
        return { error }
      })()
    },
    select: () => ({ eq: (_column: string, id: number) => ({
      order: async () => ({ data: attachments.filter(row => row.submission_id === id).map(row => ({ ...row })), error: null }),
      maybeSingle: async () => ({
        data: parents.has(id) ? { id, heritage_submission_photos: attachments.filter(row => row.submission_id === id).map(row => ({ id: row.id, path: row.path })) } : null,
        error: readFails ? problem : null
      })
    }) })
  })
}

beforeEach(() => {
  parents.clear()
  attachments.length = 0
  objects.clear()
  order.length = 0
  trackedAtUpload.length = 0
  failure = ''
  uploadCount = 0
  removeFails = false
  removeFailures = 0
  removeRejects = false
  afterRows = undefined
  duringUpload = undefined
  afterParent = undefined
  beforeDelete = undefined
  afterRemove = undefined
  readFails = false
  vi.clearAllMocks()
  boundary.client.mockReturnValue(client)
  vi.stubGlobal('useDatabaseClient', () => client)
  vi.stubGlobal('databaseError', (error: { message: string }) => {
    throw new Error(error.message)
  })
  vi.stubGlobal('createError', (error: object) => Object.assign(new Error('request failed'), error))
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('photo persistence and deletion', () => {
  it('stores the complete contribution with the revised notice version', async () => {
    await expect(insertPhotoSubmission('account', meta, files)).resolves.toBe(1)
    expect(parents.get(1)).toMatchObject({ type: 'photo', consent_version: '2026-11-22', consent_publish: true })
    expect(attachments.map(row => [row.position, row.alt])).toEqual([[0, 'Crkva'], [1, 'Zvonik']])
    expect(objects.size).toBe(2)
    expect(trackedAtUpload).toEqual([attachments.map(row => row.path), attachments.map(row => row.path)])
    expect(remove).not.toHaveBeenCalled()
  })

  it.each(['parent', 'upload-0', 'upload-1', 'rows'])('compensates completed writes after %s fails', async (stage) => {
    failure = stage
    await expect(insertPhotoSubmission('account', meta, files)).rejects.toBeDefined()
    expect(parents.size).toBe(0)
    expect(attachments).toEqual([])
    expect(objects.size).toBe(0)
    if (stage === 'rows') {
      expect(upload).not.toHaveBeenCalled()
      expect(order).toEqual(['delete parent'])
    } else if (stage !== 'parent') expect(order).toEqual(['remove objects', 'delete parent'])
  })

  it('retains failed uploads and their paths when Storage compensation fails so deletion can retry', async () => {
    failure = 'upload-1'
    removeFails = true
    await expect(insertPhotoSubmission('account', meta, files)).rejects.toMatchObject({ statusCode: 502 })
    expect(parents.size).toBe(1)
    expect(attachments).toHaveLength(2)
    expect(remove).toHaveBeenCalledWith([...objects])
    expect(remove).toHaveBeenCalledTimes(3)
    expect(order).not.toContain('delete parent')
    removeFails = false
    await expect(deleteSubmission(1)).resolves.toBe(true)
    expect(parents.size).toBe(0)
    expect(attachments).toEqual([])
    expect(objects.size).toBe(0)
  })

  it.each([
    { record: 'parent', stage: 'before first upload', uploads: 0 },
    { record: 'parent', stage: 'during first upload', uploads: 1 },
    { record: 'parent', stage: 'during final upload', uploads: 2 },
    { record: 'attachment', stage: 'before first upload', uploads: 0 },
    { record: 'attachment', stage: 'during first upload', uploads: 1 },
    { record: 'attachment', stage: 'during final upload', uploads: 2 }
  ])('fails and removes objects when the $record disappears $stage', async ({ record, stage, uploads }) => {
    async function erase() {
      if (record === 'parent') await client.rpc('delete_heritage_submission', { p_id: 1, p_paths: attachments.map(row => String(row.path)) })
      else attachments.pop()
    }
    if (stage === 'before first upload') afterRows = erase
    else duringUpload = async (position) => {
      if (position === uploads - 1) await erase()
    }
    await expect(insertPhotoSubmission('account', meta, files)).rejects.toMatchObject({ statusCode: 409 })
    expect(upload).toHaveBeenCalledTimes(uploads)
    expect(parents.size).toBe(0)
    expect(attachments).toEqual([])
    expect(objects.size).toBe(0)
  })

  it('checks every expected path even if the attachment count stays unchanged', async () => {
    afterRows = () => {
      attachments[0]!.path = 'submissions/replaced.jpg'
    }
    await expect(insertPhotoSubmission('account', meta, files)).rejects.toMatchObject({ statusCode: 409 })
    expect(upload).not.toHaveBeenCalled()
    expect(parents.size).toBe(0)
    expect(attachments).toEqual([])
    expect(objects.size).toBe(0)
  })

  it('checks attachment identity even if a replacement keeps the same path', async () => {
    duringUpload = () => {
      attachments[0]!.id = 'replacement'
    }
    await expect(insertPhotoSubmission('account', meta, files)).rejects.toMatchObject({ statusCode: 409 })
    expect(upload).toHaveBeenCalledTimes(1)
    expect(parents.size).toBe(0)
    expect(attachments).toEqual([])
    expect(objects.size).toBe(0)
  })

  it('waits for the final upload before starting deletion cleanup', async () => {
    let deletion: Promise<boolean> | undefined
    duringUpload = (position) => {
      if (position === 1) deletion = deleteSubmission(1)
    }
    await expect(insertPhotoSubmission('account', meta, files)).resolves.toBe(1)
    await expect(deletion).resolves.toBe(true)
    expect(parents.size).toBe(0)
    expect(attachments).toEqual([])
    expect(objects.size).toBe(0)
    expect(order).toEqual(['remove objects', 'delete parent'])
  })

  it('blocks an upload when deletion started before its attachments were persisted', async () => {
    let releaseDelete: () => void = () => {}
    let signalStarted: () => void = () => {}
    const blocked = new Promise<void>((resolve) => {
      releaseDelete = resolve
    })
    const started = new Promise<void>((resolve) => {
      signalStarted = resolve
    })
    beforeDelete = () => {
      signalStarted()
      return blocked
    }
    let deletion: Promise<boolean> | undefined
    async function startDeletion() {
      deletion = deleteSubmission(1)
      await started
    }
    afterParent = startDeletion
    const submission = insertPhotoSubmission('account', meta, files)
    const rejected = expect(submission).rejects.toMatchObject({ statusCode: 500 })
    try {
      await started
      expect(remove).not.toHaveBeenCalled()
      expect(upload).not.toHaveBeenCalled()
    } finally {
      releaseDelete()
      await deletion
    }
    await rejected
    expect(parents.size).toBe(0)
    expect(attachments).toEqual([])
    expect(objects.size).toBe(0)
    expect(order).toEqual(['delete parent'])
  })

  it('compensates completed uploads when the existence check fails', async () => {
    duringUpload = () => {
      readFails = true
    }
    await expect(insertPhotoSubmission('account', meta, files)).rejects.toMatchObject({ statusCode: 500 })
    expect(upload).toHaveBeenCalledTimes(1)
    expect(parents.size).toBe(0)
    expect(attachments).toEqual([])
    expect(objects.size).toBe(0)
  })

  it('removes all objects before deleting their database paths', async () => {
    await insertPhotoSubmission('account', meta, files)
    await expect(deleteSubmission(1)).resolves.toBe(true)
    expect(order).toEqual(['remove objects', 'delete parent'])
    expect(parents.size).toBe(0)
    expect(attachments).toEqual([])
    expect(objects.size).toBe(0)
  })

  it('keeps database paths after exhausted Storage retries and cleans them on a later retry', async () => {
    await insertPhotoSubmission('account', meta, files)
    removeFails = true
    await expect(deleteSubmission(1)).rejects.toMatchObject({ statusCode: 502 })
    expect(parents.size).toBe(1)
    expect(attachments).toHaveLength(2)
    expect(objects.size).toBe(2)
    expect(order).toEqual(['remove objects', 'remove objects', 'remove objects'])
    removeFails = false
    await expect(deleteSubmission(1)).resolves.toBe(true)
    expect(parents.size).toBe(0)
    expect(attachments).toEqual([])
    expect(objects.size).toBe(0)
  })

  it.each([false, true])('retries transient Storage failures (rejected request: %s)', async (rejected) => {
    await insertPhotoSubmission('account', meta, files)
    removeFailures = 1
    removeRejects = rejected
    await expect(deleteSubmission(1)).resolves.toBe(true)
    expect(remove).toHaveBeenCalledTimes(2)
    expect(parents.size).toBe(0)
    expect(attachments).toEqual([])
    expect(objects.size).toBe(0)
  })

  it('retains database paths when database deletion fails after Storage cleanup', async () => {
    await insertPhotoSubmission('account', meta, files)
    failure = 'delete'
    await expect(deleteSubmission(1)).rejects.toThrow(problem.message)
    expect(parents.size).toBe(1)
    expect(attachments).toHaveLength(2)
    expect(objects.size).toBe(0)
    failure = ''
    await expect(deleteSubmission(1)).resolves.toBe(true)
    expect(parents.size).toBe(0)
    expect(attachments).toEqual([])
  })

  it('retains new attachment paths added during cleanup for another deletion attempt', async () => {
    await insertPhotoSubmission('account', meta, files)
    const path = 'submissions/00000000-0000-4000-8000-000000000123.jpg'
    afterRemove = () => {
      afterRemove = undefined
      attachments[0]!.path = path
      objects.add(path)
    }
    await expect(deleteSubmission(1)).rejects.toThrow('Submission photos changed')
    expect(parents.size).toBe(1)
    expect(attachments.some(row => row.path === path)).toBe(true)
    expect(objects.has(path)).toBe(true)
    await expect(deleteSubmission(1)).resolves.toBe(true)
    expect(parents.size).toBe(0)
    expect(attachments).toEqual([])
    expect(objects.size).toBe(0)
  })

  it('deletes text contributions and reports missing IDs without calling Storage', async () => {
    parents.set(2, { text: 'kaj', type: 'word' })
    await expect(deleteSubmission(2)).resolves.toBe(true)
    await expect(deleteSubmission(99)).resolves.toBe(false)
    expect(remove).not.toHaveBeenCalled()
  })
})
