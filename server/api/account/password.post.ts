import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { users } from '../../db/schema'

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH),
    newPassword: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export default defineEventHandler(async (event) => {
  const data = await readValidated(event, changePasswordSchema)
  const actor = requireUser(event)
  const db = useDb()

  const [row] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, actor.id))
  if (!row || !verifyPassword(data.currentPassword, row.passwordHash)) {
    throw createError({ statusCode: 400, statusMessage: 'Current password is incorrect' })
  }
  if (data.newPassword === data.currentPassword) {
    throw createError({ statusCode: 400, statusMessage: 'Choose a password different from your current one' })
  }

  const [updated] = await db
    .update(users)
    .set({
      passwordHash: hashPassword(data.newPassword),
      mustChangePassword: false,
      sessionEpoch: sql`${users.sessionEpoch} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, actor.id))
    .returning({ sessionEpoch: users.sessionEpoch })

  // Changing your own password must not sign you out mid-flow: the epoch
  // bump above kills the cookie this very request arrived with, so
  // immediately re-issue one carrying the new epoch.
  const config = useRuntimeConfig()
  if (!actor.activeStore) throw createError({ statusCode: 403, statusMessage: 'No store access' })
  const token = createSessionToken(config.sessionSecret, actor.id, updated.sessionEpoch, actor.activeStore.id)
  const isHttps = getRequestURL(event).protocol === 'https:'
  setCookie(event, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isHttps,
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  })

  return { ok: true }
})
