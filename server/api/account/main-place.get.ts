import { mainPlaceForVerifiedAccount } from '~~/server/utils/accountMainPlace'

export default defineEventHandler(async (event) => {
  const { preference } = await mainPlaceForVerifiedAccount(event)
  return preference
})
