import { and, eq } from 'drizzle-orm'
import { sales, saleTransactions } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const id = parseIdParam(event)
  const db = useDb()
  const { user, store } = requireStoreAccess(event)

  const result = await db.transaction(async (tx) => {
    const [transaction] = await tx.select().from(saleTransactions).where(and(
      eq(saleTransactions.id, id), eq(saleTransactions.storeId, store.id),
    ))
    if (!transaction) throw createError({ statusCode: 404, statusMessage: 'Sale not found' })
    if (transaction.voidedAt) throw createError({ statusCode: 400, statusMessage: 'Sale is already voided' })

    const lines = await tx.select().from(sales).where(eq(sales.transactionId, id))

    await tx.update(saleTransactions).set({ voidedAt: new Date() }).where(eq(saleTransactions.id, id))

    for (const line of lines) {
      await applyStockChange(tx, {
        productId: line.productId,
        storeId: transaction.storeId,
        delta: line.quantity,
        type: 'ADJUSTMENT',
        reason: `Voided sale #${id}`,
        saleId: line.id,
      })
    }

    const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0)
    await recordAudit(tx, {
      userId: user.id,
      action: 'VOID',
      entityType: 'SALE',
      entityId: id,
      description: `Voided sale #${id} and restored ${itemCount} item${itemCount === 1 ? '' : 's'}`,
      storeId: transaction.storeId,
    })

    return { ...transaction, voidedAt: new Date() }
  })

  return result
})
