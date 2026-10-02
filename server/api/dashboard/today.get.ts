import { and, asc, desc, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm'
import { products, storeProducts, stores, sales, saleTransactions } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const db = useDb()
  const query = getQuery(event)
  const scope = requireReportStore(event, query.store)
  const storeIds = scope.mode === 'all' ? scope.stores.map((store) => store.id) : [scope.store.id]
  const saleScope = scope.mode === 'all' ? undefined : eq(saleTransactions.storeId, scope.store.id)
  const { start, end } = storeDayRange()

  const totalsQuery = db
    .select({
      revenue: sql<number>`coalesce(sum(${saleTransactions.revenue}), 0)`,
      profit: sql<number>`coalesce(sum(${saleTransactions.profit}), 0)`,
      transactions: sql<number>`count(*)`,
    })
    .from(saleTransactions)
    .where(and(saleScope, gte(saleTransactions.soldAt, start), lt(saleTransactions.soldAt, end), isNull(saleTransactions.voidedAt)))

  const itemTotalsQuery = db
    .select({
      itemsSold: sql<number>`coalesce(sum(${sales.quantity}), 0)`,
    })
    .from(sales)
    .innerJoin(saleTransactions, eq(saleTransactions.id, sales.transactionId))
    .where(and(saleScope, gte(saleTransactions.soldAt, start), lt(saleTransactions.soldAt, end), isNull(saleTransactions.voidedAt)))

  const lowStockQuery = db
    .select({
      id: products.id, name: products.name, variant: products.variant,
      costPrice: storeProducts.costPrice, sellingPrice: storeProducts.sellingPrice,
      stock: storeProducts.stock, lowStockThreshold: storeProducts.lowStockThreshold,
      isActive: storeProducts.isActive, createdAt: products.createdAt, updatedAt: storeProducts.updatedAt,
      storeId: stores.id, storeName: stores.name,
    })
    .from(storeProducts)
    .innerJoin(products, eq(products.id, storeProducts.productId))
    .innerJoin(stores, eq(stores.id, storeProducts.storeId))
    .where(and(
      inArray(storeProducts.storeId, storeIds),
      eq(storeProducts.isActive, true),
      sql`${storeProducts.stock} <= ${storeProducts.lowStockThreshold}`,
    ))
    .orderBy(asc(storeProducts.stock), asc(products.name), asc(products.variant))

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
      storeId: stores.id,
      storeName: stores.name,
    })
    .from(saleTransactions)
    .innerJoin(sales, eq(sales.transactionId, saleTransactions.id))
    .innerJoin(products, eq(products.id, sales.productId))
    .innerJoin(stores, eq(stores.id, saleTransactions.storeId))
    .where(and(saleScope, gte(saleTransactions.soldAt, start), lt(saleTransactions.soldAt, end), isNull(saleTransactions.voidedAt)))
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
    storeId: number
    storeName: string
    lines: Array<{ id: number; productId: number; productName: string; productVariant: string; quantity: number }>
  }>()
  for (const row of recentSales) {
    let receipt = recentByTransaction.get(row.id)
    if (!receipt) {
      receipt = { id: row.id, revenue: row.revenue, soldAt: row.soldAt, storeId: row.storeId, storeName: row.storeName, lines: [] }
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
    scope: scope.mode === 'all' ? 'all' : String(scope.store.id),
  }
})
