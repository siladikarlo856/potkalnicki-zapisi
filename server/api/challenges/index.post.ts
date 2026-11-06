import { createChallenge } from '../../challenges'

export default defineEventHandler(event => createChallenge(event))
