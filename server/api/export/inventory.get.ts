import { and, asc, eq } from 'drizzle-orm'
import { products, storeProducts } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const db = useDb()
  const { store } = requireStoreAccess(event)
  const rows = await db.select({
    name: products.name, variant: products.variant, costPrice: storeProducts.costPrice,
    sellingPrice: storeProducts.sellingPrice, stock: storeProducts.stock,
    lowStockThreshold: storeProducts.lowStockThreshold,
  }).from(products).innerJoin(storeProducts, and(
    eq(storeProducts.productId, products.id), eq(storeProducts.storeId, store.id),
  )).orderBy(asc(products.name), asc(products.variant))

  const workbook = await buildInventoryWorkbook(rows)
  const buffer = await workbook.xlsx.writeBuffer()

  setHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  setHeader(event, 'Content-Disposition', `attachment; filename="${store.code.toLowerCase()}-inventory-${storeDateKey()}.xlsx"`)
  return buffer
})
