import { z } from 'zod'
import { userRoles, userStores, users } from '../../db/schema'

const createUserSchema = z.object({
  username: z.string().trim().min(3).max(50).regex(/^[a-zA-Z0-9._-]+$/, 'Use letters, numbers, dots, dashes, or underscores'),
  displayName: z.string().trim().min(1).max(100),
  password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
  role: z.enum(userRoles).default('MEMBER'),
  storeIds: z.array(z.number().int().positive()).min(1).default([1]),
  defaultStoreId: z.number().int().positive().default(1),
}).refine((data) => data.storeIds.includes(data.defaultStoreId), { message: 'Default store must be assigned', path: ['defaultStoreId'] })

export default defineEventHandler(async (event) => {
  const data = await readValidated(event, createUserSchema)
  requireAdmin(event)
  const db = useDb()
  const storeIds = data.storeIds ?? [1]
  const defaultStoreId = data.defaultStoreId ?? storeIds[0] ?? 1

  try {
    return await db.transaction(async (tx) => {
      const [created] = await tx.insert(users).values({
        username: data.username.toLowerCase(),
        displayName: data.displayName,
        passwordHash: hashPassword(data.password),
        role: data.role,
        mustChangePassword: true,
      }).returning({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        role: users.role,
        isActive: users.isActive,
        mustChangePassword: users.mustChangePassword,
        createdAt: users.createdAt,
      })
      if (!created) throw createError({ statusCode: 500, statusMessage: 'Could not create account' })
      await tx.insert(userStores).values(storeIds.map((storeId) => ({
        userId: created.id, storeId, isDefault: storeId === defaultStoreId,
      })))
      return { ...created, storeIds, defaultStoreId }
    })
  } catch (error) {
    if (isUniqueViolation(error)) throw createError({ statusCode: 409, statusMessage: 'That username is already in use' })
    throw error
  }
})
