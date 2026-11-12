import { heritageImageUrl } from '../../../shared/utils/content/heritageImage'
import { invalid } from '../../utils/content/store'
import { IMAGE_UPLOAD_BODY_LIMIT, checkImageUpload, storeImageUpload } from '../../utils/heritageImages'

// Uploads one heritage photo: `{ image, thumb }`, each a base64 WebP or JPEG the admin screen has already
// resized. The files go to the public bucket under a fresh name; the photo only appears on the site once an
// item is saved with the returned paths and its credit (author, licence, source).
export default defineEventHandler(async (event) => {
  await requireReviewer(event)
  const body = await readJsonObject(event, IMAGE_UPLOAD_BODY_LIMIT)
  const checked = checkImageUpload(body)
  if (!checked.large) invalid(checked.issues, 'Fotografiju nije moguće učitati.')
  const stored = await storeImageUpload(useDatabaseClient(), checked.large, checked.thumb)
  const base = useStorageBase()
  return {
    ...stored,
    url: heritageImageUrl(base, stored.path),
    thumbUrl: heritageImageUrl(base, stored.thumbPath)
  }
})
