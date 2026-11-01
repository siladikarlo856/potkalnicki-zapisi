import type { FormError } from '@nuxt/ui'
import { SUBMISSION_LIMITS } from '~~/shared/utils/submission'
import type { SubmissionIssue } from '~~/shared/utils/submission'

export type SubmissionOutcome
  = | { ok: true }
    | { ok: false, message: string, issues?: SubmissionIssue[] }

/** Shared by the contribution form and the word variant dialog, so both speak to the API the same way. */
export function useSubmissionRequest() {
  const { locale, t } = useI18n()

  function issueMessage({ field, code }: SubmissionIssue) {
    if (field === 'place') return t(`heritage.places.${code === 'refreshPlace' ? 'refresh' : code === 'selectPlace' ? 'choose' : code === 'outOfScope' ? 'outOfScope' : 'invalid'}`)
    if (field === 'consentPublish') return t('heritage.form.errors.consent')
    if (code === 'required') return t('heritage.form.errors.required')
    if (code === 'tooShort') return t('heritage.form.errors.tooShort', { min: SUBMISSION_LIMITS.text.min })
    if (code === 'tooLong') {
      const max = SUBMISSION_LIMITS[field as keyof typeof SUBMISSION_LIMITS]?.max
      return t('heritage.form.errors.tooLong', { max })
    }
    return t('heritage.form.errors.invalid')
  }

  function toFormErrors(issues: SubmissionIssue[]): FormError[] {
    return issues.map(issue => ({ name: issue.field, message: issueMessage(issue) }))
  }

  async function submit(body: Record<string, unknown>): Promise<SubmissionOutcome> {
    try {
      await $fetch('/api/submissions', { method: 'POST', body: { ...body, locale: locale.value } })
      return { ok: true }
    } catch (error) {
      const { statusCode, data } = error as { statusCode?: number, data?: { data?: { issues?: SubmissionIssue[] } } }
      const issues = data?.data?.issues
      if (statusCode === 400 && issues?.length) return { ok: false, issues, message: t('heritage.form.errorInvalid') }
      if (statusCode === 429) return { ok: false, message: t('heritage.form.errorTooMany') }
      return { ok: false, message: t('heritage.form.errorGeneric') }
    }
  }

  return { locale, issueMessage, toFormErrors, submit }
}
