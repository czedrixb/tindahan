export const STORE_TZ = 'Asia/Manila'

export function formatPeso(centavos: number): string {
  const pesos = centavos / 100
  return `₱${pesos.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function pesosToCentavos(pesos: number): number {
  return Math.round(pesos * 100)
}

export function centavosToPesos(centavos: number): number {
  return centavos / 100
}

export function formatDateLabel(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return date.toLocaleDateString('en-PH', { timeZone: STORE_TZ, month: 'long', day: 'numeric', year: 'numeric' })
}

export function formatDateTimeLabel(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return date.toLocaleString('en-PH', {
    timeZone: STORE_TZ,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatTimeLabel(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return date.toLocaleTimeString('en-PH', { timeZone: STORE_TZ, hour: 'numeric', minute: '2-digit' })
}

// Capitalize product labels for presentation without rewriting stored values or
// flattening intentional acronyms ("USA", "XL") to lowercase.
export function formatProductText(value: string): string {
  return value.replace(/(^|[\s\-/])([\p{L}])/gu, (_, boundary: string, letter: string) => `${boundary}${letter.toLocaleUpperCase('en-PH')}`)
}

// Every mutation catch block needs to pull a human-readable message out of a
// $fetch error. This was copy-pasted inline in 8+ places; centralized here.
//
// A 5xx never gets its statusMessage (or the caller's fallback) shown as-is: both
// would misrepresent a server/database fault as something the user did wrong (e.g.
// login.vue's fallback is "Incorrect username or password"), or leak internals.
export function apiErrorMessage(err: unknown, fallback: string): string {
  const statusCode = (err as { statusCode?: number; data?: { statusCode?: number }; status?: number })?.statusCode
    ?? (err as { data?: { statusCode?: number } })?.data?.statusCode
    ?? (err as { status?: number })?.status
  if (typeof statusCode === 'number' && statusCode >= 500) {
    return 'Something went wrong on our end. Please try again.'
  }
  const message = (err as { data?: { statusMessage?: string } })?.data?.statusMessage
  return message || fallback
}
