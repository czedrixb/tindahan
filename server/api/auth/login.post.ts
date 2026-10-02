import { sql } from 'drizzle-orm'
import { users } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ username?: string; password?: string }>(event)
  const username = body?.username?.trim().toLowerCase()
  const password = body?.password

  if (!username || !password || typeof password !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Username and password are required' })
  }

  const config = useRuntimeConfig()
  const db = useDb()
  const [user] = await db.select().from(users).where(sql`lower(${users.username}) = lower(${username})`)

  if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
    throw createError({ statusCode: 401, statusMessage: 'Incorrect username or password' })
  }

  const availableStores = await listAccessibleStores(user.id, user.role)
  const activeStore = await resolveDefaultStore(user.id, availableStores)
  if (!activeStore) throw createError({ statusCode: 403, statusMessage: 'No store access assigned' })
  const token = createSessionToken(config.sessionSecret, user.id, user.sessionEpoch, activeStore.id)
  const isHttps = getRequestURL(event).protocol === 'https:'
  setCookie(event, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isHttps,
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  })

  return {
    authenticated: true,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    },
    stores: availableStores,
    activeStore,
  }
})
