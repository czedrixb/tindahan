import { and, eq } from 'drizzle-orm'
import { inventoryCountItems, inventoryCounts, storeProducts } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const db = useDb()
  const { store } = requireStoreAccess(event)

  const count = await db.transaction(async (tx) => {
    const [created] = await tx.insert(inventoryCounts).values({ storeId: store.id }).returning()
    if (!created) throw createError({ statusCode: 500, statusMessage: 'Could not create inventory count' })

    const activeProducts = await tx
      .select({ id: storeProducts.productId, stock: storeProducts.stock })
      .from(storeProducts)
      .where(and(eq(storeProducts.storeId, store.id), eq(storeProducts.isActive, true)))

    if (activeProducts.length > 0) {
      await tx.insert(inventoryCountItems).values(
        activeProducts.map((p) => ({
          inventoryCountId: created.id,
          storeId: store.id,
          productId: p.id,
          expectedQuantity: p.stock,
        })),
      )
    }

    return created
  })

  return count
})
