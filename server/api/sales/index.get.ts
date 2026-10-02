import { and, desc, eq, gte, isNull, lt } from 'drizzle-orm'
import { products, sales, saleTransactions } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const db = useDb()
  const { store } = requireStoreAccess(event)

  const range = resolveDateRangeFromQuery(query)
  const conditions = [eq(saleTransactions.storeId, store.id), gte(saleTransactions.soldAt, range.start), lt(saleTransactions.soldAt, range.end)]

  if (query.includeVoided !== 'true') {
    conditions.push(isNull(saleTransactions.voidedAt))
  }

  const rows = await db
    .select({
      id: sales.id,
      transactionId: sales.transactionId,
      productId: sales.productId,
      productName: products.name,
      productVariant: products.variant,
      quantity: sales.quantity,
      costPrice: sales.costPrice,
      sellingPrice: sales.sellingPrice,
      revenue: sales.revenue,
      profit: sales.profit,
      cashReceived: saleTransactions.cashReceived,
      changeDue: saleTransactions.changeDue,
      voidedAt: saleTransactions.voidedAt,
      soldAt: saleTransactions.soldAt,
    })
    .from(sales)
    .innerJoin(products, eq(products.id, sales.productId))
    .innerJoin(saleTransactions, eq(saleTransactions.id, sales.transactionId))
    .where(and(...conditions))
    .orderBy(desc(saleTransactions.soldAt))

  return rows
})
