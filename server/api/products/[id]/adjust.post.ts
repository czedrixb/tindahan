import { z } from 'zod'

const adjustSchema = z
  .object({
    type: z.enum(['ADJUSTMENT', 'DAMAGE', 'EXPIRED', 'MISSING']),
    delta: z.number().int().refine((n) => n !== 0, 'delta must not be zero'),
    reason: z.string().trim().min(1).max(500),
  })
  .refine((body) => body.type === 'ADJUSTMENT' || body.delta < 0, {
    message: 'DAMAGE, EXPIRED, and MISSING must reduce stock (delta < 0)',
    path: ['delta'],
  })

export default defineEventHandler(async (event) => {
  const productId = parseIdParam(event)
  const { type, delta, reason } = await readValidated(event, adjustSchema)
  const db = useDb()
  const { store } = requireStoreAccess(event)

  const result = await db.transaction(async (tx) => {
    return applyStockChange(tx, { productId, storeId: store.id, delta, type, reason })
  })

  return result
})
