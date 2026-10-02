import { desc, eq } from 'drizzle-orm'
import { auditLogs, stores, users } from '../../db/schema'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const query = getQuery(event)
  const limit = Math.min(Math.max(Number(query.limit) || 100, 1), 250)
  const db = useDb()

  return db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      description: auditLogs.description,
      createdAt: auditLogs.createdAt,
      userId: users.id,
      username: users.username,
      displayName: users.displayName,
      storeName: stores.name,
    })
    .from(auditLogs)
    .innerJoin(users, eq(users.id, auditLogs.userId))
    .leftJoin(stores, eq(stores.id, auditLogs.storeId))
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(limit)
})
