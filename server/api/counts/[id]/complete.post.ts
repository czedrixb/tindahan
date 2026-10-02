import { and, eq } from 'drizzle-orm'
import { inventoryCountItems, inventoryCounts } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  const id = parseIdParam(event)
  const db = useDb()
  const { store } = requireStoreAccess(event)

  const result = await db.transaction(async (tx) => {
    const [count] = await tx.select().from(inventoryCounts).where(and(eq(inventoryCounts.id, id), eq(inventoryCounts.storeId, store.id)))
    if (!count) throw createError({ statusCode: 404, statusMessage: 'Inventory count not found' })
    if (count.status !== 'IN_PROGRESS') {
      throw createError({ statusCode: 400, statusMessage: 'Inventory count is already completed' })
    }

    const items = await tx
      .select()
      .from(inventoryCountItems)
      .where(and(eq(inventoryCountItems.inventoryCountId, id), eq(inventoryCountItems.storeId, store.id)))

    for (const item of items) {
      if (item.actualQuantity === null) continue
      if (item.difference === 0) continue

      await setAbsoluteStock(tx, {
        productId: item.productId,
        storeId: store.id,
        target: item.actualQuantity,
        type: 'ADJUSTMENT',
        reason: `Inventory count #${id}`,
      })
    }

    const [updated] = await tx
      .update(inventoryCounts)
      .set({ status: 'COMPLETED', completedAt: new Date() })
      .where(eq(inventoryCounts.id, id))
      .returning()

    return updated
  })

  return result
})
