import { and, asc, desc, eq, gte, isNull, lt, sql } from 'drizzle-orm'
import { products, sales, saleTransactions } from '../../db/schema'

// Kept small and separate from server/api/sales/index.get.ts (line-level,
// unlimited) so the Today screen's "Recent sales" panel stays a single
// lightweight query instead of pulling every line of every sale today.
const RECENT_SALES_LIMIT = 8

export default defineEventHandler(async () => {
  const db = useDb()
  const { start, end } = storeDayRange()

  const totalsQuery = db
    .select({
      revenue: sql<number>`coalesce(sum(${saleTransactions.revenue}), 0)`,
      profit: sql<number>`coalesce(sum(${saleTransactions.profit}), 0)`,
      transactions: sql<number>`count(*)`,
    })
    .from(saleTransactions)
    .where(and(gte(saleTransactions.soldAt, start), lt(saleTransactions.soldAt, end), isNull(saleTransactions.voidedAt)))

  const itemTotalsQuery = db
    .select({
      itemsSold: sql<number>`coalesce(sum(${sales.quantity}), 0)`,
    })
    .from(sales)
    .innerJoin(saleTransactions, eq(saleTransactions.id, sales.transactionId))
    .where(and(gte(saleTransactions.soldAt, start), lt(saleTransactions.soldAt, end), isNull(saleTransactions.voidedAt)))

  const lowStockQuery = db
    .select()
    .from(products)
    .where(and(eq(products.isActive, true), sql`${products.stock} <= ${products.lowStockThreshold}`))
    .orderBy(asc(products.stock))
    .limit(20)

  const recentSalesQuery = db
    .select({
      id: saleTransactions.id,
      revenue: saleTransactions.revenue,
      soldAt: saleTransactions.soldAt,
    })
    .from(saleTransactions)
    .where(and(gte(saleTransactions.soldAt, start), lt(saleTransactions.soldAt, end), isNull(saleTransactions.voidedAt)))
    .orderBy(desc(saleTransactions.soldAt))
    .limit(RECENT_SALES_LIMIT)

  const [[totals], [itemTotals], lowStock, recentSales] = await Promise.all([
    totalsQuery,
    itemTotalsQuery,
    lowStockQuery,
    recentSalesQuery,
  ])

  const revenue = Number(totals?.revenue ?? 0)
  const profit = Number(totals?.profit ?? 0)

  return {
    date: storeDateKey(),
    revenue,
    cost: revenue - profit,
    profit,
    itemsSold: Number(itemTotals?.itemsSold ?? 0),
    transactions: Number(totals?.transactions ?? 0),
    lowStock,
    recentSales,
  }
})
