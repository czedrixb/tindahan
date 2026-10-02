import { and, asc, eq, ilike, isNull, or, sql } from 'drizzle-orm'
import { products, storeProducts } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const db = useDb()
  const { store } = requireStoreAccess(event)

  const conditions = []

  if (query.q && typeof query.q === 'string' && query.q.trim()) {
    const term = `%${query.q.trim()}%`
    // Match name or variant individually (e.g. searching just "Blanca"), and also
    // the two combined (e.g. searching the full "Kopiko Blanca" as shown in the UI).
    conditions.push(
      or(
        ilike(products.name, term),
        ilike(products.variant, term),
        ilike(sql`(${products.name} || ' ' || ${products.variant})`, term),
      ),
    )
  }

  conditions.push(eq(storeProducts.storeId, store.id))
  if (query.active === 'true') conditions.push(sql`${storeProducts.isActive} = true`)
  if (query.active === 'false') conditions.push(sql`${storeProducts.isActive} = false`)

  if (query.lowStock === 'true') {
    conditions.push(sql`${storeProducts.stock} <= ${storeProducts.lowStockThreshold}`)
  }

  if (query.needsPricing === 'true') {
    conditions.push(or(isNull(storeProducts.costPrice), isNull(storeProducts.sellingPrice)))
  }

  const rows = await db
    .select({
      id: products.id, name: products.name, variant: products.variant,
      costPrice: storeProducts.costPrice, sellingPrice: storeProducts.sellingPrice,
      stock: storeProducts.stock, lowStockThreshold: storeProducts.lowStockThreshold,
      isActive: storeProducts.isActive, createdAt: products.createdAt, updatedAt: storeProducts.updatedAt,
    })
    .from(products)
    .innerJoin(storeProducts, eq(storeProducts.productId, products.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(products.name), asc(products.variant))

  return rows
})
