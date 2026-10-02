import { and, desc, eq, gte, isNull, sql } from 'drizzle-orm'
import { products, storeProducts, sales, saleTransactions } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const limit = Math.min(Number(query.limit) || 6, 20)
  const db = useDb()
  const { store } = requireStoreAccess(event)

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const recentSales = db
    .select({
      productId: sales.productId,
      quantity: sales.quantity,
    })
    .from(sales)
    .innerJoin(saleTransactions, eq(saleTransactions.id, sales.transactionId))
    .where(and(eq(saleTransactions.storeId, store.id), gte(saleTransactions.soldAt, since), isNull(saleTransactions.voidedAt)))
    .as('recent_sales')

  const rows = await db
    .select({
      id: products.id, name: products.name, variant: products.variant,
      costPrice: storeProducts.costPrice, sellingPrice: storeProducts.sellingPrice,
      stock: storeProducts.stock, lowStockThreshold: storeProducts.lowStockThreshold,
      isActive: storeProducts.isActive, createdAt: products.createdAt, updatedAt: storeProducts.updatedAt,
      totalSold: sql<number>`coalesce(sum(${recentSales.quantity}), 0)`.as('total_sold'),
    })
    .from(products)
    .innerJoin(storeProducts, and(eq(storeProducts.productId, products.id), eq(storeProducts.storeId, store.id)))
    .leftJoin(recentSales, eq(recentSales.productId, products.id))
    .where(and(eq(storeProducts.isActive, true), sql`${storeProducts.costPrice} is not null`, sql`${storeProducts.sellingPrice} is not null`))
    .groupBy(products.id, storeProducts.id)
    .orderBy(desc(sql`total_sold`))
    .limit(limit)

  return rows
    .filter((r) => r.totalSold > 0)
    .map(({ totalSold: _totalSold, ...product }) => product)
})
