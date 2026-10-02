import { asc } from 'drizzle-orm'
import { userStores, users } from '../../db/schema'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const db = useDb()
  const accounts = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
      isActive: users.isActive,
      mustChangePassword: users.mustChangePassword,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(asc(users.displayName))
  const assignments = await db.select().from(userStores)
  return accounts.map((account) => ({
    ...account,
    storeIds: assignments.filter((item) => item.userId === account.id).map((item) => item.storeId),
    defaultStoreId: assignments.find((item) => item.userId === account.id && item.isDefault)?.storeId ?? null,
  }))
})
