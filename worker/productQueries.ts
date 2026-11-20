import type { Sql, SqlValue } from '../src/sql'
import { RequestError } from './security'
export async function readProductQueries(request: Request, db: Sql) {
  const params = new URL(request.url).searchParams
  const page = Number(params.get('page') || 1)
  const search = (params.get('q') || '').trim()
  const status = params.get('status') || ''
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000000 || search.length > 200 || !['', 'new', 'contacted', 'closed'].includes(status)) throw new RequestError(400, 'Invalid query filters.')
  const clauses: string[] = [], values: SqlValue[] = []
  if (search) {
    clauses.push("(name LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR location LIKE ? ESCAPE '\\' OR id LIKE ? ESCAPE '\\' OR items_json LIKE ? ESCAPE '\\')")
    const term = `%${search.replace(/[\\%_]/g, '\\$&')}%`
    values.push(term, term, term, term, term, term)
  }
  if (status) { clauses.push('status = ?'); values.push(status) }
  const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''
  const total = (await db.first<{total: number}>(`SELECT COUNT(*) AS total FROM "product query"${where}`, values))?.total ?? 0
  const pageSize = 50
  const actualPage = Math.min(page, Math.max(1, Math.ceil(total / pageSize)))
  type Row = { id: string; name: string; phone: string; email: string; location: string; items_json: string; estimated_total_minor: number; status: string; created_at: string }
  const rows = await db.all<Row>(`SELECT id,name,phone,email,location,items_json,estimated_total_minor,status,created_at FROM "product query"${where} ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`, [...values, pageSize, (actualPage - 1) * pageSize])
  return { total, page: actualPage, pageSize, queries: rows.map(({items_json, ...row}) => {
    try { const items: unknown = JSON.parse(items_json); if (!Array.isArray(items) || !items.every(item => item && typeof item === 'object' && typeof item.productName === 'string' && typeof item.variantName === 'string' && Number.isSafeInteger(item.quantity) && Number.isSafeInteger(item.unitPriceMinor) && Number.isSafeInteger(item.totalMinor))) throw new Error('Invalid items'); return {...row, items, itemsError: false} }
    catch { return {...row, items: [], itemsError: true} }
  }) }
}
