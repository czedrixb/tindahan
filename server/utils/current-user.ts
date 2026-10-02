import { and, eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { users, type UserRole } from '../db/schema'

export interface SessionUser {
  id: number
  username: string
  displayName: string
  role: UserRole
  mustChangePassword: boolean
  stores: SessionStore[]
  activeStore: SessionStore | null
}

export async function resolveSessionUser(event: H3Event): Promise<SessionUser | null> {
  const config = useRuntimeConfig()
  const token = verifySessionToken(getCookie(event, SESSION_COOKIE_NAME), config.sessionSecret)
  if (!token) return null

  const db = useDb()
  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
      mustChangePassword: users.mustChangePassword,
      sessionEpoch: users.sessionEpoch,
    })
    .from(users)
    .where(and(eq(users.id, token.userId), eq(users.isActive, true)))
  if (!user) return null

  // A stale epoch means this cookie predates an admin reset or a self
  // password change - reject it instead of trusting a token that should
  // already be dead.
  if (user.sessionEpoch !== token.epoch) return null

  const accessibleStores = await listAccessibleStores(user.id, user.role)
  const activeStore = token.storeId === null
    ? await resolveDefaultStore(user.id, accessibleStores)
    : accessibleStores.find((store) => store.id === token.storeId) ?? null
  const { sessionEpoch: _sessionEpoch, ...sessionUser } = user
  return { ...sessionUser, stores: accessibleStores, activeStore }
}

export function requireUser(event: H3Event): SessionUser {
  const user = event.context.user as SessionUser | undefined
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  return user
}

export function requireAdmin(event: H3Event): SessionUser {
  const user = requireUser(event)
  if (user.role !== 'ADMIN') throw createError({ statusCode: 403, statusMessage: 'Admin access required' })
  return user
}
