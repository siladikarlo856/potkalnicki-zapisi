// Limits and shapes for contributor photo uploads on Doprinesi.

export const SUBMISSION_PHOTO_BUCKET = 'submission-media'
export const SUBMISSION_PHOTO_LIMITS = {
  perSubmission: 5,
  maxBytes: 10 * 1024 * 1024,
  alt: { min: 1, max: 300 },
  author: { min: 1, max: 200 }
} as const

export interface SubmissionPhotoInput {
  alt: string
  author: string
  /** The contributor confirmed they may publish this photograph. */
  publishPermission: boolean
}

export interface SubmissionPhotoRecord extends SubmissionPhotoInput {
  id: string
  position: number
  width: number
  height: number
  byteSize: number
}
