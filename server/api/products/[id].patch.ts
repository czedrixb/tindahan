import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { products, storeProducts } from '../../db/schema'

const updateProductSchema = z.object({
  name: z.string().trim().min(1).optional(),
  variant: z.string().trim().optional(),
  costPrice: z.number().int().min(0).nullable().optional(),
  sellingPrice: z.number().int().min(0).nullable().optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  const id = parseIdParam(event)
  const data = await readValidated(event, updateProductSchema)
  const db = useDb()
  const { user, store } = requireStoreAccess(event)
  if ((data.name !== undefined || data.variant !== undefined) && user.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Admin access required to rename shared products' })
  }

  try {
    return await db.transaction(async (tx) => {
      const [listing] = await tx.select().from(storeProducts).where(and(
        eq(storeProducts.productId, id), eq(storeProducts.storeId, store.id),
      ))
      if (!listing) throw createError({ statusCode: 404, statusMessage: 'Product not found' })

      const catalogChanges = { name: data.name, variant: data.variant, updatedAt: new Date() }
      if (data.name !== undefined || data.variant !== undefined) {
        await tx.update(products).set(catalogChanges).where(eq(products.id, id))
      }
      const localChanges = {
        costPrice: data.costPrice,
        sellingPrice: data.sellingPrice,
        lowStockThreshold: data.lowStockThreshold,
        isActive: data.isActive,
        updatedAt: new Date(),
      }
      const [updated] = await tx.update(storeProducts).set(localChanges).where(and(
        eq(storeProducts.productId, id), eq(storeProducts.storeId, store.id),
      )).returning()
      if (store.id === 1) await tx.update(products).set(localChanges).where(eq(products.id, id))
      const [catalog] = await tx.select().from(products).where(eq(products.id, id))
      return { ...catalog, ...updated, id }
    })
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw createError({ statusCode: 409, statusMessage: 'A product with this name and variant already exists' })
    }
    throw err
  }
})
