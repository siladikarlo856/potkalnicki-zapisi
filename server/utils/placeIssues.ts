import hr from '../../i18n/locales/hr.json'

const englishMessages = {
  required: 'Select the place where this is said.',
  refresh: 'Refresh this form and select a Croatian settlement again. Keep a copy of your contribution before refreshing.',
  invalid: 'This place is unavailable. Select a Croatian settlement again, or clear the location.',
  outOfScope: 'That settlement is outside Potkalničko prigorje. Choose one of the five municipalities in the place picker, or continue without a location.'
}

// Human-readable field errors are also in the API response for cached clients.
export function localizePlaceIssues(issues: SubmissionIssue[], locale: unknown) {
  const en = locale === 'en'
  const messages = en ? englishMessages : hr.heritage.places
  const placeRequired = en ? englishMessages.required : hr.heritage.variantDialog.errors.placeRequired
  const byCode: Partial<Record<SubmissionIssue['code'], string>> = {
    required: placeRequired,
    // Confirming a word is used "here" needs the place; the generic "continue without" hint would be wrong.
    selectPlace: placeRequired,
    refreshPlace: messages.refresh,
    outOfScope: messages.outOfScope
  }
  return issues.map(issue => issue.field === 'place'
    ? { ...issue, message: byCode[issue.code] ?? messages.invalid }
    : issue)
}
