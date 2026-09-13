import { and, desc, eq, gte, isNull, lt, sql } from 'drizzle-orm'
import type { DateRange } from './dates'
import { storeDateKey } from './dates'
import { products, sales, saleTransactions } from '../db/schema'

export async function getSalesTotals(range: DateRange) {
  const db = useDb()
  const [totals] = await db
    .select({
      revenue: sql<number>`coalesce(sum(${saleTransactions.revenue}), 0)`,
      profit: sql<number>`coalesce(sum(${saleTransactions.profit}), 0)`,
      transactions: sql<number>`count(*)`,
    })
    .from(saleTransactions)
    .where(
      and(
        gte(saleTransactions.soldAt, range.start),
        lt(saleTransactions.soldAt, range.end),
        isNull(saleTransactions.voidedAt),
      ),
    )

  const [itemTotals] = await db
    .select({
      itemsSold: sql<number>`coalesce(sum(${sales.quantity}), 0)`,
    })
    .from(sales)
    .innerJoin(saleTransactions, eq(saleTransactions.id, sales.transactionId))
    .where(
      and(
        gte(saleTransactions.soldAt, range.start),
        lt(saleTransactions.soldAt, range.end),
        isNull(saleTransactions.voidedAt),
      ),
    )

  const revenue = Number(totals?.revenue ?? 0)
  const profit = Number(totals?.profit ?? 0)

  return {
    revenue,
    cost: revenue - profit,
    profit,
    itemsSold: Number(itemTotals?.itemsSold ?? 0),
    transactions: Number(totals?.transactions ?? 0),
  }
}

export async function getTopProducts(range: DateRange, limit = 5) {
  const db = useDb()
  return db
    .select({
      productId: products.id,
      name: products.name,
      variant: products.variant,
      quantitySold: sql<number>`coalesce(sum(${sales.quantity}), 0)`.as('quantity_sold'),
      revenue: sql<number>`coalesce(sum(${sales.revenue}), 0)`.as('revenue'),
    })
    .from(sales)
    .innerJoin(products, eq(products.id, sales.productId))
    .innerJoin(saleTransactions, eq(saleTransactions.id, sales.transactionId))
    .where(
      and(
        gte(saleTransactions.soldAt, range.start),
        lt(saleTransactions.soldAt, range.end),
        isNull(saleTransactions.voidedAt),
      ),
    )
    .groupBy(products.id)
    .orderBy(desc(sql`quantity_sold`))
    .limit(limit)
}

/**
 * Per-store-local-day revenue within range, for the Reports "Daily sales"
 * chart. Bucketed in JS rather than with a SQL date_trunc so it reuses the
 * same Asia/Manila day-boundary logic as every other report (dates.ts), and
 * every day in the range is pre-seeded so a day with no sales still renders
 * as a zero bar instead of being skipped.
 */
export async function getDailySeries(range: DateRange) {
  const db = useDb()
  const rows = await db
    .select({
      soldAt: saleTransactions.soldAt,
      revenue: saleTransactions.revenue,
    })
    .from(saleTransactions)
    .where(
      and(
        gte(saleTransactions.soldAt, range.start),
        lt(saleTransactions.soldAt, range.end),
        isNull(saleTransactions.voidedAt),
      ),
    )

  const byDay = new Map<string, number>()
  for (let t = range.start.getTime(); t < range.end.getTime(); t += 24 * 60 * 60 * 1000) {
    byDay.set(storeDateKey(new Date(t)), 0)
  }
  for (const row of rows) {
    const key = storeDateKey(row.soldAt)
    byDay.set(key, (byDay.get(key) ?? 0) + row.revenue)
  }

  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, revenue]) => ({ date, revenue }))
}

export async function getLowestStockProducts(limit = 5) {
  const db = useDb()
  return db
    .select()
    .from(products)
    .where(eq(products.isActive, true))
    .orderBy(products.stock)
    .limit(limit)
}
