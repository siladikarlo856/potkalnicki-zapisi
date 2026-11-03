// A signed render-time token for the correction and proposal forms: the submission API ignores a form that was
// filled in faster than a person could (under 3 seconds) or left open for over a day. No state is stored.
export default defineEventHandler((event) => {
  return { token: issueFormToken(event) }
})
