import { eq } from 'drizzle-orm'
import { and } from 'drizzle-orm'
import { products, storeProducts } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const id = parseIdParam(event)
  const db = useDb()
  const { store } = requireStoreAccess(event)

  const [product] = await db
    .update(storeProducts)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(storeProducts.productId, id), eq(storeProducts.storeId, store.id)))
    .returning()

  if (!product) throw createError({ statusCode: 404, statusMessage: 'Product not found' })
  if (store.id === 1) await db.update(products).set({ isActive: false, updatedAt: new Date() }).where(eq(products.id, id))
  return { ...product, id }
})
