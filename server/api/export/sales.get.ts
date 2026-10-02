import { and, asc, eq, gte, isNull, lt } from 'drizzle-orm'
import { products, sales, saleTransactions } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const db = useDb()
  const { store } = requireStoreAccess(event)
  const range = resolveDateRangeFromQuery(query)

  const rows = await db
    .select({
      soldAt: saleTransactions.soldAt,
      productName: products.name,
      productVariant: products.variant,
      quantity: sales.quantity,
      sellingPrice: sales.sellingPrice,
      revenue: sales.revenue,
      profit: sales.profit,
    })
    .from(sales)
    .innerJoin(products, eq(products.id, sales.productId))
    .innerJoin(saleTransactions, eq(saleTransactions.id, sales.transactionId))
    .where(
      and(
        gte(saleTransactions.soldAt, range.start),
        lt(saleTransactions.soldAt, range.end),
        eq(saleTransactions.storeId, store.id),
        isNull(saleTransactions.voidedAt),
      ),
    )
    .orderBy(asc(saleTransactions.soldAt))

  const title = `${store.name} Sales ${storeDateKey(range.start)} to ${storeDateKey(new Date(range.end.getTime() - 1))}`
  const workbook = await buildSalesWorkbook(rows, title)
  const buffer = await workbook.xlsx.writeBuffer()

  setHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  setHeader(event, 'Content-Disposition', `attachment; filename="${store.code.toLowerCase()}-sales-${storeDateKey(range.start)}.xlsx"`)
  return buffer
})
