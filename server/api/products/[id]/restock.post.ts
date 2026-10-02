import { z } from 'zod'

const restockSchema = z.object({
  quantity: z.number().int().positive(),
  reason: z.string().trim().max(500).optional().nullable(),
})

export default defineEventHandler(async (event) => {
  const productId = parseIdParam(event)
  const { quantity, reason } = await readValidated(event, restockSchema)
  const db = useDb()
  const { store } = requireStoreAccess(event)

  const result = await db.transaction(async (tx) => {
    return applyStockChange(tx, {
      productId,
      storeId: store.id,
      delta: quantity,
      type: 'RESTOCK',
      reason: reason ?? 'New stock',
    })
  })

  return result
})
