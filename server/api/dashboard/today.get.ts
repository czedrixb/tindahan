import { and, asc, desc, eq, gte, isNull, lt, sql } from 'drizzle-orm'
import { products, sales, saleTransactions } from '../../db/schema'

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
    .orderBy(asc(products.stock), asc(products.name), asc(products.variant))

  const recentSalesQuery = db
    .select({
      id: saleTransactions.id,
      revenue: saleTransactions.revenue,
      soldAt: saleTransactions.soldAt,
      lineId: sales.id,
      productId: products.id,
      productName: products.name,
      productVariant: products.variant,
      quantity: sales.quantity,
    })
    .from(saleTransactions)
    .innerJoin(sales, eq(sales.transactionId, saleTransactions.id))
    .innerJoin(products, eq(products.id, sales.productId))
    .where(and(gte(saleTransactions.soldAt, start), lt(saleTransactions.soldAt, end), isNull(saleTransactions.voidedAt)))
    .orderBy(desc(saleTransactions.soldAt), asc(sales.id))

  const [[totals], [itemTotals], lowStock, recentSales] = await Promise.all([
    totalsQuery,
    itemTotalsQuery,
    lowStockQuery,
    recentSalesQuery,
  ])

  const revenue = Number(totals?.revenue ?? 0)
  const profit = Number(totals?.profit ?? 0)

  const recentByTransaction = new Map<number, {
    id: number
    revenue: number
    soldAt: Date
    lines: Array<{ id: number; productId: number; productName: string; productVariant: string; quantity: number }>
  }>()
  for (const row of recentSales) {
    let receipt = recentByTransaction.get(row.id)
    if (!receipt) {
      receipt = { id: row.id, revenue: row.revenue, soldAt: row.soldAt, lines: [] }
      recentByTransaction.set(row.id, receipt)
    }
    receipt.lines.push({
      id: row.lineId,
      productId: row.productId,
      productName: row.productName,
      productVariant: row.productVariant,
      quantity: row.quantity,
    })
  }

  return {
    date: storeDateKey(),
    revenue,
    cost: revenue - profit,
    profit,
    itemsSold: Number(itemTotals?.itemsSold ?? 0),
    transactions: Number(totals?.transactions ?? 0),
    lowStock,
    recentSales: [...recentByTransaction.values()],
  }
})
