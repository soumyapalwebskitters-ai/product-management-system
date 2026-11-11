import type { Sql } from '../src/sql'

export type Role = 'seller' | 'buyer'
export type Account = { id: string; role: Role; buyerId: string | null; email: string }

type AccountRow = Account & { passwordHash: string; passwordSalt: string; active: number }
type SessionRow = Account & { expiresAt: string; active: number }

const encoder = new TextEncoder()

function hex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function randomId() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return hex(bytes)
}

async function digest(value: string) {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))))
}

async function passwordHash(password: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations: 210000 },
    key,
    256,
  )
  return hex(new Uint8Array(bits))
}

function validCredentials(email: unknown, password: unknown): { email: string; password: string } | null {
  if (typeof email !== 'string' || typeof password !== 'string') return null
  const normalizedEmail = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || password.length < 8 || password.length > 200) return null
  return { email: normalizedEmail, password }
}

export async function sellerExists(db: Sql) {
  return Boolean(await db.first<{ id: string }>("SELECT id FROM auth_accounts WHERE role = 'seller' LIMIT 1"))
}

export async function setupSeller(db: Sql, body: unknown) {
  const input = body as { email?: unknown; password?: unknown }
  const credentials = validCredentials(input?.email, input?.password)
  if (!credentials) return { status: 400, body: { error: 'Enter a valid email and a password of at least 8 characters.' } }
  if (await sellerExists(db)) return { status: 409, body: { error: 'Seller setup is already complete.' } }
  const now = new Date().toISOString()
  const id = randomId()
  const salt = randomId()
  const hash = await passwordHash(credentials.password, salt)
  await db.batch([
    {
      sql: `INSERT INTO auth_accounts (id, role, buyer_id, email, password_hash, password_salt, active, created_at, updated_at)
            VALUES (?, 'seller', NULL, ?, ?, ?, 1, ?, ?)`,
      params: [id, credentials.email, hash, salt, now, now],
    },
  ])
  return sessionFor(db, { id, role: 'seller', buyerId: null, email: credentials.email }, now)
}

export async function login(db: Sql, body: unknown) {
  const input = body as { email?: unknown; password?: unknown }
  const credentials = validCredentials(input?.email, input?.password)
  if (!credentials) return { status: 400, body: { error: 'Enter your email and password.' } }
  const account = await db.first<AccountRow>(
    `SELECT id, role, buyer_id AS buyerId, email, password_hash AS passwordHash, password_salt AS passwordSalt, active
     FROM auth_accounts WHERE email = ?`,
    [credentials.email],
  )
  if (!account || account.active !== 1) return { status: 401, body: { error: 'Email or password is incorrect.' } }
  if ((await passwordHash(credentials.password, account.passwordSalt)) !== account.passwordHash) {
    return { status: 401, body: { error: 'Email or password is incorrect.' } }
  }
  return sessionFor(db, account, new Date().toISOString())
}

export async function createBuyerAccount(db: Sql, seller: Account, body: unknown) {
  if (seller.role !== 'seller') return { status: 403, body: { error: 'Seller access is required.' } }
  const input = body as { buyerId?: unknown; email?: unknown; password?: unknown }
  const credentials = validCredentials(input?.email, input?.password)
  if (!credentials || typeof input?.buyerId !== 'string' || !input.buyerId.trim()) {
    return { status: 400, body: { error: 'Buyer ID, valid email, and password are required.' } }
  }
  const now = new Date().toISOString()
  const id = randomId()
  const salt = randomId()
  const hash = await passwordHash(credentials.password, salt)
  try {
    await db.batch([
      {
        sql: `INSERT INTO auth_accounts (id, role, buyer_id, email, password_hash, password_salt, active, created_at, updated_at)
              VALUES (?, 'buyer', ?, ?, ?, ?, 1, ?, ?)`,
        params: [id, input.buyerId.trim(), credentials.email, hash, salt, now, now],
      },
    ])
  } catch {
    return { status: 409, body: { error: 'This buyer or email already has an account.' } }
  }
  return { status: 201, body: { account: { id, role: 'buyer', buyerId: input.buyerId.trim(), email: credentials.email } } }
}

async function sessionFor(db: Sql, account: Account, now: string) {
  const token = randomId()
  const id = randomId()
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString()
  await db.batch([
    {
      sql: 'INSERT INTO auth_sessions (id, account_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
      params: [id, account.id, await digest(token), expiresAt, now],
    },
  ])
  return {
    status: 200,
    body: { account },
    token,
    expiresAt,
  }
}

export function sessionCookie(token: string, expiresAt: string) {
  return `market_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=${new Date(expiresAt).toUTCString()}`
}

export function expiredSessionCookie() {
  return 'market_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'
}

export async function currentAccount(db: Sql, request: Request): Promise<Account | null> {
  const raw = request.headers.get('cookie') ?? ''
  const token = raw.split(';').map((part) => part.trim()).find((part) => part.startsWith('market_session='))?.slice(15)
  if (!token) return null
  const tokenHash = await digest(token)
  const match = await db.first<SessionRow>(
    `SELECT a.id, a.role, a.buyer_id AS buyerId, a.email, a.active, s.expires_at AS expiresAt
     FROM auth_sessions s JOIN auth_accounts a ON a.id = s.account_id
     WHERE s.token_hash = ? AND s.expires_at > ? AND a.active = 1`,
    [tokenHash, new Date().toISOString()],
  )
  if (!match) return null
  return { id: match.id, role: match.role, buyerId: match.buyerId, email: match.email }
}

export async function logout(db: Sql, request: Request) {
  const raw = request.headers.get('cookie') ?? ''
  const token = raw.split(';').map((part) => part.trim()).find((part) => part.startsWith('market_session='))?.slice(15)
  if (token) {
    const hash = await digest(token)
    const session = await db.first<{ id: string }>('SELECT id FROM auth_sessions WHERE token_hash = ?', [hash])
    if (session) await db.batch([{ sql: 'DELETE FROM auth_sessions WHERE id = ?', params: [session.id] }])
  }
  return { status: 200, body: { ok: true } }
}

export type AuthResult = { status: number; body: unknown; token?: string; expiresAt?: string }
