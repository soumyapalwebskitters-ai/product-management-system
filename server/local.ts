import { mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { handleApi } from '../worker/api'
import { MAX_BODY } from '../worker/security'
import type { Sql, SqlStatement, SqlValue } from '../src/sql'


export type NodeRequest = {
  socket?: { remoteAddress?: string }
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

let database: Sql | null = null
let queryDatabase: Sql | null = null
function localQueryDatabase() {
  if (!queryDatabase) {
    const directory = join(process.cwd(), '../baji-market-website/.data')
    mkdirSync(directory, { recursive: true })
    const db = new DatabaseSync(join(directory, 'reviews.sqlite'))
    for (const file of readdirSync(join(process.cwd(), 'website-migrations')).filter(name => name.endsWith('.sql')).sort()) db.exec(readFileSync(join(process.cwd(), 'website-migrations', file), 'utf8'))
    queryDatabase = toSql(db)
  }
  return queryDatabase
}

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
    let total = 0
    req.on('data', (chunk) => { total += chunk.length; if (total > MAX_BODY) { reject(new Error('Request is too large.')); return } chunks.push(chunk) })
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

export async function handleDevRequest(req: NodeRequest, res: NodeResponse) {
  const headers = new Headers()
  for (const [name, value] of Object.entries(req.headers ?? {})) {
    if (typeof value === 'string') headers.set(name, value)
    else if (Array.isArray(value)) headers.set(name, value.join(', '))
  }
  const method = req.method ?? 'GET'
  let body: string | undefined
  if (!['GET', 'HEAD'].includes(method)) {
    try { body = await readBody(req) } catch { res.statusCode = 413; res.end('Request is too large.'); return }
  }
  const request = new Request(`http://${headers.get('host') ?? 'localhost'}${req.url ?? '/'}`, { method, headers, body })
  const response = await handleApi(request, localDatabase(), { setupToken: process.env.SELLER_SETUP_TOKEN, queriesDb: ['/api/product-queries', '/api/testimonials', '/api/web-content', '/api/web-media'].some(path => req.url?.split('?')[0] === path || req.url?.startsWith(path + '/')) ? localQueryDatabase() : undefined, clientIp: req.socket?.remoteAddress ?? 'local' })
  res.statusCode = response.status
  response.headers.forEach((value, name) => res.setHeader(name, name === 'set-cookie' ? value.replace('; Secure', '') : value))
  res.end(new Uint8Array(await response.arrayBuffer()))
}

export function memoryDatabase() {
  const db = new DatabaseSync(':memory:')
  applyMigrations(db)
  return toSql(db)
}
