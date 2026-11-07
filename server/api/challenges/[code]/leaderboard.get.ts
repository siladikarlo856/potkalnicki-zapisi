import { readChallengeLeaderboard } from '../../../challenges'

export default defineEventHandler(event => readChallengeLeaderboard(event))
