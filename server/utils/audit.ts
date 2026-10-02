import { auditLogs } from '../db/schema'

// PGlite and postgres-js expose compatible transaction methods with different
// concrete types, so audit writes accept either through this shared surface.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AuditDb = any

export interface AuditInput {
  userId: number
  action: string
  entityType: string
  entityId?: number | string | null
  description: string
  storeId?: number | null
}

export async function recordAudit(db: AuditDb, input: AuditInput) {
  await db.insert(auditLogs).values({
    userId: input.userId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId === undefined || input.entityId === null ? null : String(input.entityId),
    description: input.description,
    storeId: input.storeId ?? null,
  })
}
