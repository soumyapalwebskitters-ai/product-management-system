import { handleState } from '../src/shopApi'
import type { Sql, SqlStatement } from '../src/sql'

type Env = {
  DB: D1Database
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

function d1(db: D1Database): Sql {
  return {
    async first<T>(sql: string) {
      return db.prepare(sql).first<T>()
    },
    async all<T>(sql: string) {
      const result = await db.prepare(sql).all<T>()
      return result.results ?? []
    },
    async batch(statements: SqlStatement[]) {
      await db.batch(statements.map((statement) => db.prepare(statement.sql).bind(...statement.params)))
    },
  }
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname !== '/api/state') return json({ error: 'Not found.' }, 404)
    let body: unknown = null
    if (request.method === 'PUT') {
      try {
        body = await request.json()
      } catch {
        return json({ error: 'Expected JSON.' }, 400)
      }
    }
    const result = await handleState(request.method, body, d1(env.DB))
    return json(result.body, result.status)
  },
} satisfies ExportedHandler<Env>
