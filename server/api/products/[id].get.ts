import { and, eq } from 'drizzle-orm'
import { products, storeProducts } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const id = parseIdParam(event)
  const db = useDb()
  const { store } = requireStoreAccess(event)
  const [product] = await db.select({
    id: products.id, name: products.name, variant: products.variant,
    costPrice: storeProducts.costPrice, sellingPrice: storeProducts.sellingPrice,
    stock: storeProducts.stock, lowStockThreshold: storeProducts.lowStockThreshold,
    isActive: storeProducts.isActive, createdAt: products.createdAt, updatedAt: storeProducts.updatedAt,
  }).from(products).innerJoin(storeProducts, eq(storeProducts.productId, products.id)).where(and(
    eq(products.id, id), eq(storeProducts.storeId, store.id),
  ))
  if (!product) throw createError({ statusCode: 404, statusMessage: 'Product not found' })
  return product
})
