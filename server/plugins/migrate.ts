import { sql } from 'drizzle-orm'
import { userStores, users } from '../db/schema'

export default defineNitroPlugin(async () => {
  const config = useRuntimeConfig()

  // Only auto-migrate the embedded PGlite database (local dev/preview). The
  // migrations SQL folder isn't traced into the Nitro serverless bundle, so
  // this would crash on Vercel; production Postgres is migrated ahead of
  // deploy via `npm run db:migrate` (see README).
  if (!config.databaseUrl) {
    await runMigrations()
  } else {
    // Can't auto-migrate a remote database (see above), but silent drift here
    // is how a routine schema change turns into every request failing with an
    // opaque "column does not exist" error. Warn loudly instead. Never allowed
    // to throw: a broken check must not take down a server that would
    // otherwise have booted fine.
    try {
      const unapplied = await findUnappliedRemoteMigrations()
      if (unapplied && unapplied.length > 0) {
        console.warn(
          `[migrate] Database is behind: ${unapplied.length} unapplied migration${unapplied.length === 1 ? '' : 's'} (${unapplied.join(', ')}).`,
        )
        console.warn('[migrate] Run `npm run db:migrate` against this DATABASE_URL.')
      }
    } catch (err) {
      console.warn('[migrate] Could not check for unapplied migrations:', err instanceof Error ? err.message : err)
    }
  }

  if (config.storePasswordHash) {
    const db = useDb()
    const username = String(config.storeUsername).trim().toLowerCase()
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.username}) = lower(${username})`)
      .limit(1)
    if (!existing) {
      const [created] = await db.insert(users).values({
        username,
        displayName: String(config.storeDisplayName).trim() || username,
        passwordHash: config.storePasswordHash,
        role: 'ADMIN',
        isActive: true,
        mustChangePassword: false,
      }).returning({ id: users.id })
      await db.insert(userStores).values({ userId: created.id, storeId: 1, isDefault: true })
    } else {
      // Re-pinned on every boot: this account is the documented owner-recovery
      // path (set STORE_PASSWORD_HASH and restart), so it must always come
      // back as an active, unflagged admin — it cannot be demoted,
      // deactivated, or left flagged from the UI while this env var is set.
      await db
        .update(users)
        .set({
          passwordHash: config.storePasswordHash,
          role: 'ADMIN',
          isActive: true,
          mustChangePassword: false,
          updatedAt: new Date(),
        })
        .where(sql`lower(${users.username}) = lower(${username})`)
    }
  }
})
