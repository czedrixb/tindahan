import { z } from 'zod'
import { and, eq, sql } from 'drizzle-orm'
import { products, storeProducts } from '../../db/schema'

const createProductSchema = z.object({
  name: z.string().trim().min(1),
  variant: z.string().trim().default(''),
  costPrice: z.number().int().min(0).nullable().default(null),
  sellingPrice: z.number().int().min(0).nullable().default(null),
  stock: z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().min(0).default(5),
})

export default defineEventHandler(async (event) => {
  const data = await readValidated(event, createProductSchema)
  const db = useDb()
  const { store } = requireStoreAccess(event)

  try {
    return await db.transaction(async (tx) => {
      const [existingCatalog] = await tx.select().from(products).where(and(
        sql`lower(${products.name}) = lower(${data.name})`,
        sql`lower(${products.variant}) = lower(${data.variant})`,
      ))
      let product = existingCatalog
      if (!product) {
        ;[product] = await tx.insert(products).values({
          name: data.name,
          variant: data.variant,
          costPrice: store.id === 1 ? data.costPrice : null,
          sellingPrice: store.id === 1 ? data.sellingPrice : null,
          stock: store.id === 1 ? data.stock : 0,
          lowStockThreshold: store.id === 1 ? data.lowStockThreshold : 5,
          isActive: store.id === 1,
        }).returning()
        if (!product) throw createError({ statusCode: 500, statusMessage: 'Could not create product' })
      }
      const [alreadyListed] = await tx.select({ id: storeProducts.id }).from(storeProducts).where(and(
        eq(storeProducts.storeId, store.id), eq(storeProducts.productId, product.id),
      ))
      if (alreadyListed) throw createError({ statusCode: 409, statusMessage: 'A product with this name and variant already exists in this store' })
      const [listing] = await tx.insert(storeProducts).values({
        storeId: store.id,
        productId: product.id,
        costPrice: data.costPrice,
        sellingPrice: data.sellingPrice,
        stock: data.stock,
        lowStockThreshold: data.lowStockThreshold,
      }).returning()
      return { ...product, ...listing, id: product.id }
    })
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw createError({ statusCode: 409, statusMessage: 'A product with this name and variant already exists' })
    }
    throw err
  }
})
