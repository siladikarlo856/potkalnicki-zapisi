import hr from '../../i18n/locales/hr.json'

const englishMessages = {
  required: 'Select the place where this is said.',
  refresh: 'Refresh this form and select a Croatian settlement again. Keep a copy of your contribution before refreshing.',
  invalid: 'This place is unavailable. Select a Croatian settlement again, or clear the location.',
  outOfScope: 'That settlement is outside Potkalničko prigorje. Choose one of the five municipalities in the place picker, or continue without a location.'
}

// Human-readable field errors are also in the API response for cached clients.
export function localizePlaceIssues(issues: SubmissionIssue[], locale: unknown) {
  const messages = locale === 'en' ? englishMessages : hr.heritage.places
  return issues.map(issue => issue.field === 'place'
    ? {
        ...issue,
        message: issue.code === 'required'
          ? locale === 'en' ? englishMessages.required : hr.heritage.variantDialog.errors.placeRequired
          : issue.code === 'refreshPlace'
            ? messages.refresh
            : issue.code === 'outOfScope'
              ? messages.outOfScope
              : messages.invalid
      }
    : issue)
}
