import { challengeOverview } from '../../utils/challengeContent'
import { currentChallengeContent } from '../../utils/challengeTemplates'

// The introduction of a new fixed challenge, from the current challenge template.
export default defineEventHandler(async () => challengeOverview(await currentChallengeContent()))
