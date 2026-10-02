import { desc, eq } from 'drizzle-orm'
import { inventoryCounts } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const db = useDb()
  const { store } = requireStoreAccess(event)
  return db.select().from(inventoryCounts).where(eq(inventoryCounts.storeId, store.id)).orderBy(desc(inventoryCounts.countDate))
})
