import { readChallenge } from '../../../challenges'

export default defineEventHandler(event => readChallenge(event))
