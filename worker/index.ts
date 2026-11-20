import { handleApi } from './api'
import type { Sql, SqlStatement, SqlValue } from '../src/sql'
type Env = { DB: D1Database; REVIEWS_DB?: D1Database; SELLER_SETUP_TOKEN?: string }
function d1(db: D1Database): Sql {
  return {
    async first<T>(sql: string, params: SqlValue[] = []) {
      return db.prepare(sql).bind(...params).first<T>()
    },
    async all<T>(sql: string, params: SqlValue[] = []) {
      const result = await db.prepare(sql).bind(...params).all<T>()
      return result.results ?? []
    },
    async batch(statements: SqlStatement[]) {
      await db.batch(statements.map((statement) => db.prepare(statement.sql).bind(...statement.params)))
    },
  }
}


export default {
  async fetch(request, env): Promise<Response> {
    return handleApi(request, d1(env.DB), { setupToken: env.SELLER_SETUP_TOKEN, queriesDb: env.REVIEWS_DB ? d1(env.REVIEWS_DB) : undefined, clientIp: request.headers.get('cf-connecting-ip') ?? 'unknown' })
  },
} satisfies ExportedHandler<Env>
