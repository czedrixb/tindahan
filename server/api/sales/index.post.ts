import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { products, storeProducts, sales, saleTransactions } from '../../db/schema'

const cartItemSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive(),
})

const createSaleSchema = z
  .object({
    items: z.array(cartItemSchema).min(1).max(50),
    cashReceived: z.number().int().nonnegative(),
    submissionKey: z.string().min(8).max(64),
  })
  .refine((body) => new Set(body.items.map((i) => i.productId)).size === body.items.length, {
    message: 'Duplicate product in cart',
  })

async function findBySubmissionKey(db: ReturnType<typeof useDb>, storeId: number, submissionKey: string) {
  const [transaction] = await db
    .select()
    .from(saleTransactions)
    .where(and(eq(saleTransactions.storeId, storeId), eq(saleTransactions.submissionKey, submissionKey)))

  if (!transaction) return null

  const lines = await db
    .select({
      sale: sales,
      productName: products.name,
      productVariant: products.variant,
    })
    .from(sales)
    .innerJoin(products, eq(products.id, sales.productId))
    .where(eq(sales.transactionId, transaction.id))

  return {
    ...transaction,
    alreadyRecorded: true,
    lines: lines.map((l) => ({ ...l.sale, productName: l.productName, productVariant: l.productVariant })),
  }
}

export default defineEventHandler(async (event) => {
  const { items, cashReceived, submissionKey } = await readValidated(event, createSaleSchema)
  const db = useDb()
  const { user, store } = requireStoreAccess(event)

  // Replay of a request we already recorded (e.g. a retried submission) —
  // return the original receipt instead of recording a duplicate.
  const replayed = await findBySubmissionKey(db, store.id, submissionKey)
  if (replayed) return replayed

  // Lock products in a consistent order so two carts sharing products can't deadlock on FOR UPDATE.
  const orderedItems = [...items].sort((a, b) => a.productId - b.productId)

  try {
    const receipt = await db.transaction(async (tx) => {
      let revenue = 0
      let profit = 0
      const lineInputs: {
        productId: number
        quantity: number
        costPrice: number
        sellingPrice: number
        revenue: number
        profit: number
        productName: string
        productVariant: string
      }[] = []

      for (const item of orderedItems) {
        const [product] = await tx.select({
          id: products.id, name: products.name, variant: products.variant,
          isActive: storeProducts.isActive, costPrice: storeProducts.costPrice,
          sellingPrice: storeProducts.sellingPrice,
        }).from(products).innerJoin(storeProducts, eq(storeProducts.productId, products.id)).where(and(
          eq(products.id, item.productId), eq(storeProducts.storeId, store.id),
        ))
        if (!product) throw createError({ statusCode: 404, statusMessage: 'Product not found' })
        if (!product.isActive) {
          throw createError({ statusCode: 400, statusMessage: 'Product is not active' })
        }
        if (product.costPrice === null || product.sellingPrice === null) {
          throw createError({ statusCode: 400, statusMessage: 'Product needs pricing before it can be sold' })
        }

        const line = calculateSale(product.costPrice, product.sellingPrice, item.quantity)
        revenue += line.revenue
        profit += line.profit
        lineInputs.push({
          productId: item.productId,
          quantity: item.quantity,
          costPrice: product.costPrice,
          sellingPrice: product.sellingPrice,
          revenue: line.revenue,
          profit: line.profit,
          productName: product.name,
          productVariant: product.variant,
        })
      }

      if (cashReceived < revenue) {
        throw createError({ statusCode: 400, statusMessage: 'Cash received is less than the total' })
      }

      const [transaction] = await tx
        .insert(saleTransactions)
        .values({
          storeId: store.id,
          submissionKey,
          cashReceived,
          changeDue: cashReceived - revenue,
          revenue,
          profit,
        })
        .returning()

      const createdLines: Record<string, unknown>[] = []
      for (const line of lineInputs) {
        const [created] = await tx
          .insert(sales)
          .values({
            transactionId: transaction.id,
            productId: line.productId,
            quantity: line.quantity,
            costPrice: line.costPrice,
            sellingPrice: line.sellingPrice,
            revenue: line.revenue,
            profit: line.profit,
          })
          .returning()

        const { previousStock, newStock } = await applyStockChange(tx, {
          productId: line.productId,
          storeId: store.id,
          delta: -line.quantity,
          type: 'SALE',
          saleId: created.id,
        })

        createdLines.push({
          ...created,
          previousStock,
          newStock,
          productName: line.productName,
          productVariant: line.productVariant,
        })
      }

      const itemCount = lineInputs.reduce((sum, l) => sum + l.quantity, 0)
      const description =
        lineInputs.length === 1
          ? `Recorded sale of ${lineInputs[0].quantity} × ${lineInputs[0].productName}${lineInputs[0].productVariant ? ` · ${lineInputs[0].productVariant}` : ''}`
          : `Recorded sale of ${itemCount} items across ${lineInputs.length} products (${formatPeso(revenue)})`

      await recordAudit(tx, {
        userId: user.id,
        action: 'CREATE',
        entityType: 'SALE',
        entityId: transaction.id,
        description,
        storeId: store.id,
      })

      return { ...transaction, lines: createdLines }
    })

    return receipt
  } catch (err) {
    // Concurrent retry raced us to the same submission key — return the
    // receipt the other request recorded rather than surfacing a DB error.
    if (isUniqueViolation(err)) {
      const raced = await findBySubmissionKey(db, store.id, submissionKey)
      if (raced) return raced
    }
    throw err
  }
})
