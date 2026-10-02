import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { userRoles, userStores, users } from '../../db/schema'

const updateUserSchema = z
  .object({
    displayName: z.string().trim().min(1).max(100).optional(),
    username: z
      .string()
      .trim()
      .min(3)
      .max(50)
      .regex(/^[a-zA-Z0-9._-]+$/, 'Use letters, numbers, dots, dashes, or underscores')
      .optional(),
    role: z.enum(userRoles).optional(),
    isActive: z.boolean().optional(),
    storeIds: z.array(z.number().int().positive()).min(1).optional(),
    defaultStoreId: z.number().int().positive().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' })

export default defineEventHandler(async (event) => {
  const id = parseIdParam(event)
  const data = await readValidated(event, updateUserSchema)
  requireAdmin(event)
  const db = useDb()

  try {
    return await db.transaction(async (tx) => {
      const [before] = await tx.select().from(users).where(eq(users.id, id))
      if (!before) throw createError({ statusCode: 404, statusMessage: 'Account not found' })

      const assignments = await tx.select().from(userStores).where(eq(userStores.userId, id))
      const nextStoreIds = data.storeIds ?? assignments.map((item) => item.storeId)
      const nextDefaultStoreId = data.defaultStoreId
        ?? assignments.find((item) => item.isDefault)?.storeId
        ?? nextStoreIds[0]
      if (!nextDefaultStoreId || !nextStoreIds.includes(nextDefaultStoreId)) {
        throw createError({ statusCode: 400, statusMessage: 'Default store must be assigned' })
      }

      const losesAdmin =
        before.role === 'ADMIN' &&
        before.isActive &&
        (data.role === 'MEMBER' || data.isActive === false)
      if (losesAdmin) await assertNotLastActiveAdmin(tx, id)

      const { storeIds: _storeIds, defaultStoreId: _defaultStoreId, ...accountChanges } = data

      const [updated] = await tx
        .update(users)
        .set({
          ...accountChanges,
          username: data.username ? data.username.toLowerCase() : undefined,
          updatedAt: new Date(),
          sessionEpoch: data.storeIds || data.defaultStoreId ? before.sessionEpoch + 1 : undefined,
        })
        .where(eq(users.id, id))
        .returning({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          role: users.role,
          isActive: users.isActive,
          mustChangePassword: users.mustChangePassword,
          createdAt: users.createdAt,
      })

      if (data.storeIds || data.defaultStoreId) {
        await tx.delete(userStores).where(eq(userStores.userId, id))
        await tx.insert(userStores).values(nextStoreIds.map((storeId) => ({
          userId: id, storeId, isDefault: storeId === nextDefaultStoreId,
        })))
      }

      return { ...updated, storeIds: nextStoreIds, defaultStoreId: nextDefaultStoreId }
    })
  } catch (error) {
    if (isUniqueViolation(error)) throw createError({ statusCode: 409, statusMessage: 'That username is already in use' })
    throw error
  }
})
