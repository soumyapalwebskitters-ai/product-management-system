import type { Sql } from '../src/sql'

export const MAX_BODY = 32 * 1024 * 1024 // Existing catalog snapshots contain embedded photos.
export class RequestError extends Error {
  constructor(public status: number, message: string) { super(message) }
}
export function checkMutation(request: Request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return
  const origin = request.headers.get('origin')
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new RequestError(403, 'Cross-site requests are not allowed.')
  }
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new RequestError(415, 'Expected application/json.')
  }
}
export async function readJson(request: Request, limit = MAX_BODY): Promise<unknown> {
  if (Number(request.headers.get('content-length')) > limit) throw new RequestError(413, 'Request is too large.')
  const reader = request.body?.getReader()
  if (!reader) throw new RequestError(400, 'Expected JSON.')
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.length
    if (size > limit) { await reader.cancel(); throw new RequestError(413, 'Request is too large.') }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  try { return JSON.parse(new TextDecoder().decode(bytes)) } catch { throw new RequestError(400, 'Expected JSON.') }
}
export async function rateLimit(db: Sql, key: string, limit = 10) {
  const bucket = Math.floor(Date.now() / 600000)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
  const hash = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('')
  const row = await db.first<{ attempts: number }>(
    `INSERT INTO auth_rate_limits (key, bucket, attempts) VALUES (?, ?, 1)
     ON CONFLICT(key) DO UPDATE SET bucket = excluded.bucket,
       attempts = CASE WHEN auth_rate_limits.bucket = excluded.bucket THEN auth_rate_limits.attempts + 1 ELSE 1 END
     RETURNING attempts`, [hash, bucket])
  if (!row || row.attempts > limit) throw new RequestError(429, 'Too many attempts. Try again in 10 minutes.')
}
