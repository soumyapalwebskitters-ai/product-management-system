import { mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { handleState } from '../src/shopApi'
import type { Sql, SqlStatement, SqlValue } from '../src/sql'

export type NodeRequest = {
  method?: string
  on(event: 'data', listener: (chunk: Uint8Array) => void): void
  on(event: 'end', listener: () => void): void
  on(event: 'error', listener: (error: Error) => void): void
}

export type NodeResponse = {
  statusCode: number
  setHeader(name: string, value: string): void
  end(body?: string): void
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

export async function handleDevRequest(req: NodeRequest, res: NodeResponse) {
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
