import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { inventoryTransactions, products, storeProducts } from '../../db/schema'

const commitSchema = z.object({
  importStock: z.boolean().default(true),
  rows: z.array(z.object({
    name: z.string(), variant: z.string().default(''), quantity: z.number().default(0),
    costPrice: z.number().int().min(0).nullable().optional(),
    sellingPrice: z.number().int().min(0).nullable().optional(),
  })).min(1),
})

const productKey = (name: string, variant: string) => `${name.trim().toLowerCase()}|${variant.trim().toLowerCase()}`

export default defineEventHandler(async (event) => {
  const { rows: inputRows, importStock } = await readValidated(event, commitSchema)
  const { store } = requireStoreAccess(event)
  const db = useDb()
  const rows = inputRows.map((row) => ({
    name: row.name.trim(), variant: (row.variant ?? '').trim(),
    quantity: Math.max(0, Number.isInteger(row.quantity) ? (row.quantity ?? 0) : 0),
    costPrice: row.costPrice ?? null, sellingPrice: row.sellingPrice ?? null,
  })).filter((row) => row.name.length > 0)

  let created = 0
  let updated = 0
  await db.transaction(async (tx) => {
    const catalogRows = await tx.select().from(products)
    const listingRows = await tx.select().from(storeProducts).where(eq(storeProducts.storeId, store.id))
    const catalog = new Map(catalogRows.map((row) => [productKey(row.name, row.variant), row]))
    const listings = new Map(listingRows.map((row) => [row.productId, row]))

    for (const row of rows) {
      let product = catalog.get(productKey(row.name, row.variant))
      if (!product) {
        ;[product] = await tx.insert(products).values({
          name: row.name, variant: row.variant,
          costPrice: store.id === 1 ? row.costPrice : null,
          sellingPrice: store.id === 1 ? row.sellingPrice : null,
          stock: store.id === 1 && importStock ? row.quantity : 0,
          lowStockThreshold: store.id === 1 && importStock ? 5 : -1,
          isActive: store.id === 1,
        }).returning()
        if (!product) throw createError({ statusCode: 500, statusMessage: 'Could not create product' })
        catalog.set(productKey(row.name, row.variant), product)
      }

      const existing = listings.get(product.id)
      const targetStock = importStock ? row.quantity : existing?.stock ?? 0
      const values = {
        costPrice: row.costPrice ?? existing?.costPrice ?? null,
        sellingPrice: row.sellingPrice ?? existing?.sellingPrice ?? null,
        stock: targetStock,
        lowStockThreshold: existing?.lowStockThreshold ?? (importStock ? 5 : -1),
        isActive: true,
        updatedAt: new Date(),
      }
      if (!existing) {
        const [listing] = await tx.insert(storeProducts).values({ storeId: store.id, productId: product.id, ...values }).returning()
        if (!listing) throw createError({ statusCode: 500, statusMessage: 'Could not create store product' })
        listings.set(product.id, listing)
        created += 1
      } else {
        await tx.update(storeProducts).set(values).where(and(eq(storeProducts.storeId, store.id), eq(storeProducts.productId, product.id)))
        updated += 1
      }

      const previousStock = existing?.stock ?? 0
      if (importStock && targetStock !== previousStock) {
        await tx.insert(inventoryTransactions).values({
          storeId: store.id, productId: product.id,
          type: existing ? 'ADJUSTMENT' : 'RESTOCK', quantity: targetStock - previousStock,
          previousStock, newStock: targetStock,
          reason: existing ? 'Excel import' : 'Excel import (initial stock)',
        })
      }
      if (store.id === 1) {
        await tx.update(products).set({ ...values }).where(eq(products.id, product.id))
      }
    }
  })
  return { created, updated, skipped: inputRows.length - rows.length, store }
})
