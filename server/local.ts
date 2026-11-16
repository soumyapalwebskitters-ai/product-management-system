import { mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { handleState } from '../src/shopApi'
import type { Sql, SqlStatement, SqlValue } from '../src/sql'
import { autoLoginSeller, currentAccount, expiredSessionCookie, sessionCookie } from '../worker/auth'

export type NodeRequest = {
  method?: string
  url?: string
  headers?: Record<string, string | string[] | undefined>
  on(event: 'data', listener: (chunk: Uint8Array) => void): void
  on(event: 'end', listener: () => void): void
  on(event: 'error', listener: (error: Error) => void): void
}

export type NodeResponse = {
  statusCode: number
  setHeader(name: string, value: string): void
  end(body?: string | Uint8Array): void
}

function requestFor(req: NodeRequest) {
  const headers = new Headers()
  for (const [name, value] of Object.entries(req.headers ?? {})) {
    if (typeof value === 'string') headers.set(name, value)
    else if (Array.isArray(value)) headers.set(name, value.join(', '))
  }
  return new Request(`http://localhost${req.url ?? '/'}`, { method: req.method ?? 'GET', headers })
}

let database: Sql | null = null

function toSql(db: DatabaseSync): Sql {
  return {
    async first<T>(sql: string, params: SqlValue[] = []) {
      const row = db.prepare(sql).get(...params)
      return (row as T | undefined) ?? null
    },
    async all<T>(sql: string, params: SqlValue[] = []) {
      return db.prepare(sql).all(...params) as T[]
    },
    async batch(statements: SqlStatement[]) {
      db.exec('BEGIN')
      try {
        for (const statement of statements) {
          db.prepare(statement.sql).run(...statement.params)
        }
        db.exec('COMMIT')
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
    },
  }
}

function applyMigrations(db: DatabaseSync) {
  const ready = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'").get()
  if (!ready) db.exec('CREATE TABLE schema_migrations (name TEXT PRIMARY KEY)')
  const applied = new Set(
    (db.prepare('SELECT name FROM schema_migrations').all() as Array<{ name: string }>).map((row) => row.name),
  )
  const files = readdirSync(join(process.cwd(), 'migrations'))
    .filter((name) => name.endsWith('.sql'))
    .sort()
  for (const file of files) {
    if (applied.has(file)) continue
    db.exec(readFileSync(join(process.cwd(), 'migrations', file), 'utf8'))
    db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(file)
  }
}

export function openDatabase(filename: string) {
  const db = new DatabaseSync(filename)
  applyMigrations(db)
  return toSql(db)
}

export function localDatabase() {
  if (!database) {
    const filename = join(process.cwd(), '.data', 'market.sqlite')
    mkdirSync(dirname(filename), { recursive: true })
    database = openDatabase(filename)
  }
  return database
}

function readBody(req: NodeRequest) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Uint8Array[] = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      const size = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
      const body = new Uint8Array(size)
      let offset = 0
      for (const chunk of chunks) {
        body.set(chunk, offset)
        offset += chunk.length
      }
      resolve(new TextDecoder().decode(body))
    })
    req.on('error', reject)
  })
}

async function handleGalleryImage(req: NodeRequest, res: NodeResponse) {
  const source = new URL(req.url ?? '/', 'http://localhost').searchParams.get('url')
  if (!source) {
    res.statusCode = 400
    res.end('Missing image URL.')
    return
  }

  let parsed: URL
  try {
    parsed = new URL(source)
  } catch {
    res.statusCode = 400
    res.end('Invalid image URL.')
    return
  }
  const host = parsed.hostname.toLowerCase()
  if (host !== 'drive.google.com' && host !== 'drive.usercontent.google.com') {
    res.statusCode = 403
    res.end('Image host is not allowed.')
    return
  }

  const upstream = await fetch(parsed.toString(), { redirect: 'follow' })
  if (!upstream.ok) {
    res.statusCode = upstream.status
    res.end('Image could not be loaded.')
    return
  }
  const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
  if (!contentType.toLowerCase().startsWith('image/')) {
    res.statusCode = 415
    res.end('URL did not return an image.')
    return
  }
  res.statusCode = 200
  res.setHeader('content-type', contentType)
  res.setHeader('cache-control', 'public, max-age=3600')
  res.end(new Uint8Array(await upstream.arrayBuffer()))
}

export async function handleDevRequest(req: NodeRequest, res: NodeResponse) {
  const path = req.url?.split('?')[0]
  if (path === '/api/gallery-image' && req.method === 'GET') {
    await handleGalleryImage(req, res)
    return
  }
  const db = localDatabase()
  if (path === '/api/auth/me' && req.method === 'GET') {
    const account = await currentAccount(db, requestFor(req))
    res.statusCode = account ? 200 : 401
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.setHeader('cache-control', 'no-store')
    res.end(JSON.stringify(account ? { account } : { error: 'Authentication required.' }))
    return
  }
  if (path === '/api/auth/seller/auto-login' && req.method === 'POST') {
    const result = await autoLoginSeller(db)
    res.statusCode = result.status
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.setHeader('cache-control', 'no-store')
    if ('token' in result && 'expiresAt' in result) res.setHeader('set-cookie', sessionCookie(result.token, result.expiresAt).replace('; Secure', ''))
    res.end(JSON.stringify(result.body))
    return
  }
  if (path === '/api/auth/logout' && req.method === 'POST') {
    res.statusCode = 200
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.setHeader('set-cookie', expiredSessionCookie())
    res.end(JSON.stringify({ ok: true }))
    return
  }
  let body: unknown = null
  if (req.method === 'PUT') {
    const raw = await readBody(req)
    try {
      body = JSON.parse(raw) as unknown
    } catch {
      res.statusCode = 400
      res.setHeader('content-type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ error: 'Expected JSON.' }))
      return
    }
  }
  const result = await handleState(req.method ?? 'GET', body, localDatabase())
  res.statusCode = result.status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(result.body))
}

export function memoryDatabase() {
  const db = new DatabaseSync(':memory:')
  applyMigrations(db)
  return toSql(db)
}
