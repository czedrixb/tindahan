import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { users } from '../../db/schema'

const schema = z.object({ storeId: z.number().int().positive() })

export default defineEventHandler(async (event) => {
  const { storeId } = await readValidated(event, schema)
  const user = requireUser(event)
  const activeStore = user.stores.find((store) => store.id === storeId)
  if (!activeStore) throw createError({ statusCode: 403, statusMessage: 'Store access required' })

  const config = useRuntimeConfig()
  const [account] = await useDb().select({ sessionEpoch: users.sessionEpoch }).from(users).where(eq(users.id, user.id))
  if (!account) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const token = createSessionToken(config.sessionSecret, user.id, account.sessionEpoch, storeId)
  setCookie(event, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: getRequestURL(event).protocol === 'https:',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  })
  const { stores, activeStore: _old, ...sessionUser } = user
  return { authenticated: true, user: sessionUser, stores, activeStore }
})
