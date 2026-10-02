import { scryptSync, randomBytes, timingSafeEqual, createHmac } from 'node:crypto'

// Pre-rebrand name, kept deliberately: it's an internal cookie name no user
// ever sees, and renaming it would force every signed-in user through an
// unnecessary forced sign-out for zero visible benefit.
export const SESSION_COOKIE_NAME = 'sari_session'
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':')
  if (!salt || !hash) return false
  const candidate = scryptSync(password, salt, 64)
  const expected = Buffer.from(hash, 'hex')
  if (candidate.length !== expected.length) return false
  return timingSafeEqual(candidate, expected)
}

export interface SessionTokenPayload {
  userId: number
  /** Must match users.session_epoch for the token to still be valid. */
  epoch: number
  /** Missing only on cookies issued before multi-store support. */
  storeId: number | null
}

/**
 * Stateless signed session token: no server-side session store needed. The
 * epoch is what makes a reset/password-change able to invalidate existing
 * cookies - bump users.session_epoch and every token minted before that
 * bump stops verifying.
 */
export function createSessionToken(secret: string, userId: number, epoch: number, storeId: number): string {
  const expires = Date.now() + SESSION_TTL_MS
  const payload = `auth.${userId}.${epoch}.${storeId}.${expires}`
  const signature = createHmac('sha256', secret).update(payload).digest('hex')
  return `${payload}.${signature}`
}

export function verifySessionToken(token: string | undefined | null, secret: string): SessionTokenPayload | null {
  if (!token) return null
  const parts = token.split('.')
  // Tokens minted before session_epoch existed have 4 parts and no epoch
  // segment - treat them as epoch 0 so nobody already signed in is logged
  // out by this deploy; they naturally roll onto real epochs at next login.
  const isLegacy = parts.length === 4
  const isPreStore = parts.length === 5
  if (!isLegacy && !isPreStore && parts.length !== 6) return null

  const [tag, userIdRaw, epochOrExpiresRaw, storeOrExpiresRaw, expiresOrSignatureRaw, maybeSignature] = parts
  if (tag !== 'auth') return null

  const epochRaw = isLegacy ? '0' : epochOrExpiresRaw
  const storeIdRaw = isLegacy || isPreStore ? null : storeOrExpiresRaw
  const expiresRaw = isLegacy ? epochOrExpiresRaw : isPreStore ? storeOrExpiresRaw : expiresOrSignatureRaw
  const signature = isLegacy ? storeOrExpiresRaw : isPreStore ? expiresOrSignatureRaw : maybeSignature
  if (!signature) return null

  const payload = isLegacy
    ? `${tag}.${userIdRaw}.${expiresRaw}`
    : isPreStore
      ? `${tag}.${userIdRaw}.${epochRaw}.${expiresRaw}`
      : `${tag}.${userIdRaw}.${epochRaw}.${storeIdRaw}.${expiresRaw}`
  const expectedSignature = createHmac('sha256', secret).update(payload).digest('hex')
  const expectedBuf = Buffer.from(expectedSignature, 'hex')
  const actualBuf = Buffer.from(signature, 'hex')
  if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
    return null
  }

  const userId = Number(userIdRaw)
  const epoch = Number(epochRaw)
  const storeId = storeIdRaw === null ? null : Number(storeIdRaw)
  const expires = Number(expiresRaw)
  if (!Number.isInteger(userId) || userId <= 0) return null
  if (!Number.isInteger(epoch) || epoch < 0) return null
  if (storeId !== null && (!Number.isInteger(storeId) || storeId <= 0)) return null
  if (!Number.isFinite(expires) || Date.now() >= expires) return null

  return { userId, epoch, storeId }
}

// Kept for the existing CLI while deployments move from STORE_PIN_HASH.
export const hashPin = hashPassword
export const verifyPin = verifyPassword
