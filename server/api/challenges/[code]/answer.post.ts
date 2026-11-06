import { answerChallenge } from '../../../challenges'

export default defineEventHandler(event => answerChallenge(event))
