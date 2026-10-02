import { and, asc, eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { stores, userStores, type UserRole } from '../db/schema'

export interface SessionStore {
  id: number
  code: string
  name: string
}

export async function listAccessibleStores(userId: number, role: UserRole): Promise<SessionStore[]> {
  const db = useDb()
  if (role === 'ADMIN') {
    return db.select({ id: stores.id, code: stores.code, name: stores.name })
      .from(stores)
      .where(eq(stores.isActive, true))
      .orderBy(asc(stores.id))
  }
  return db.select({ id: stores.id, code: stores.code, name: stores.name })
    .from(userStores)
    .innerJoin(stores, eq(stores.id, userStores.storeId))
    .where(and(eq(userStores.userId, userId), eq(stores.isActive, true)))
    .orderBy(asc(stores.id))
}

export async function resolveDefaultStore(userId: number, available: SessionStore[]): Promise<SessionStore | null> {
  if (!available.length) return null
  const db = useDb()
  const [preferred] = await db.select({ storeId: userStores.storeId })
    .from(userStores)
    .where(and(eq(userStores.userId, userId), eq(userStores.isDefault, true)))
    .limit(1)
  return available.find((store) => store.id === preferred?.storeId) ?? available[0] ?? null
}

export function requireStoreAccess(event: H3Event) {
  const user = requireUser(event)
  if (!user.activeStore) throw createError({ statusCode: 403, statusMessage: 'No store access' })
  return { user, store: user.activeStore }
}

export function requireReportStore(event: H3Event, requested: unknown) {
  const user = requireUser(event)
  if (requested === 'all') {
    if (user.role !== 'ADMIN') throw createError({ statusCode: 403, statusMessage: 'Admin access required' })
    return { mode: 'all' as const, stores: user.stores }
  }
  const requestedId = requested === undefined ? user.activeStore?.id : Number(requested)
  const store = user.stores.find((candidate) => candidate.id === requestedId)
  if (!store) throw createError({ statusCode: 403, statusMessage: 'Store access required' })
  return { mode: 'store' as const, store }
}
