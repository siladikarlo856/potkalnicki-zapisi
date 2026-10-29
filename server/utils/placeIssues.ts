import hr from '../../i18n/locales/hr.json'
import en from '../../i18n/locales/en.json'

// Human-readable field errors are also in the API response for cached clients.
export function localizePlaceIssues(issues: SubmissionIssue[], locale: unknown) {
  const messages = locale === 'en' ? en.heritage.places : hr.heritage.places
  return issues.map(issue => issue.field === 'place'
    ? { ...issue, message: issue.code === 'refreshPlace' ? messages.refresh : messages.invalid }
    : issue)
}
