import { listSubmissionPhotos, signedSubmissionPhotoUrls } from '../../../../utils/submissionPhotos'

export default defineEventHandler(async (event) => {
  await requireReviewer(event)
  const submissionId = submissionIdParam(event)
  const rows = await listSubmissionPhotos(submissionId)
  const urls = await signedSubmissionPhotoUrls(rows.map(row => row.path))
  return {
    photos: rows.map(row => ({
      id: row.id,
      position: row.position,
      alt: row.alt,
      author: row.author,
      publishPermission: row.publish_permission,
      width: row.width,
      height: row.height,
      byteSize: row.byte_size,
      url: urls.get(row.path) ?? null
    }))
  }
})
