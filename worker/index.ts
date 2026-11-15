import { handleGallery, handleState } from '../src/shopApi'
import { createBuyerAccount, currentAccount, expiredSessionCookie, login, loginSeller, logout, resetSellerPassword, sellerExists, sessionCookie, setupSeller } from './auth'
import type { Sql, SqlStatement, SqlValue } from '../src/sql'

type Env = {
  DB: D1Database
}

function json(data: unknown, status = 200, extraHeaders: HeadersInit = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders,
    },
  })
}

async function requestBody(request: Request) {
  try {
    return { ok: true as const, body: await request.json() }
  } catch {
    return { ok: false as const }
  }
}

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

async function galleryImage(request: Request) {
  const source = new URL(request.url).searchParams.get('url')
  if (!source) return new Response('Missing image URL.', { status: 400 })
  let parsed: URL
  try { parsed = new URL(source) } catch { return new Response('Invalid image URL.', { status: 400 }) }
  const host = parsed.hostname.toLowerCase()
  if (host !== 'drive.google.com' && host !== 'drive.usercontent.google.com') return new Response('Image host is not allowed.', { status: 403 })
  const upstream = await fetch(parsed.toString(), { redirect: 'follow' })
  if (!upstream.ok) return new Response('Image could not be loaded.', { status: upstream.status })
  const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
  if (!contentType.toLowerCase().startsWith('image/')) return new Response('URL did not return an image.', { status: 415 })
  return new Response(upstream.body, { status: 200, headers: { 'content-type': contentType, 'cache-control': 'public, max-age=3600', 'access-control-allow-origin': '*' } })
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url)
    const db = d1(env.DB)
    if (url.pathname === '/api/gallery-image' && request.method === 'GET') {
      try { return await galleryImage(request) } catch { return new Response('Image could not be loaded.', { status: 502 }) }
    }
    if (url.pathname === '/api/gallery' && request.method === 'POST') {
      const parsed = await requestBody(request)
      if (!parsed.ok) return json({ error: 'Expected JSON.' }, 400)
      const result = await handleGallery(request.method, parsed.body, db)
      return json(result.body, result.status)
    }
    if (url.pathname === '/api/auth/bootstrap' && request.method === 'GET') {
      return json({ sellerSetupRequired: !(await sellerExists(db)) })
    }
    if (url.pathname === '/api/auth/setup' && request.method === 'POST') {
      const parsed = await requestBody(request)
      if (!parsed.ok) return json({ error: 'Expected JSON.' }, 400)
      const result = await setupSeller(db, parsed.body)
      const headers: HeadersInit = 'token' in result && 'expiresAt' in result ? { 'set-cookie': sessionCookie(result.token, result.expiresAt) } : []
      return json(result.body, result.status, headers)
    }
    if (url.pathname === '/api/auth/login' && request.method === 'POST') {
      const parsed = await requestBody(request)
      if (!parsed.ok) return json({ error: 'Expected JSON.' }, 400)
      const result = await login(db, parsed.body)
      const headers: HeadersInit = 'token' in result && 'expiresAt' in result ? { 'set-cookie': sessionCookie(result.token, result.expiresAt) } : []
      return json(result.body, result.status, headers)
    }
    if (url.pathname === '/api/auth/seller/login' && request.method === 'POST') {
      const parsed = await requestBody(request)
      if (!parsed.ok) return json({ error: 'Expected JSON.' }, 400)
      try {
        const result = await loginSeller(db, parsed.body)
        const headers: HeadersInit = 'token' in result && 'expiresAt' in result ? { 'set-cookie': sessionCookie(result.token, result.expiresAt) } : []
        return json(result.body, result.status, headers)
      } catch (error) {
        return json({ error: 'Could not start seller access.' }, 500)
      }
    }
    if (url.pathname === '/api/auth/seller/password' && request.method === 'PUT') {
      const parsed = await requestBody(request)
      if (!parsed.ok) return json({ error: 'Expected JSON.' }, 400)
      const result = await resetSellerPassword(db, await currentAccount(db, request), parsed.body)
      return json(result.body, result.status)
    }
    if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
      const result = await logout(db, request)
      return json(result.body, result.status, { 'set-cookie': expiredSessionCookie() })
    }
    if (url.pathname === '/api/auth/me' && request.method === 'GET') {
      const account = await currentAccount(db, request)
      return account ? json({ account }) : json({ error: 'Authentication required.' }, 401)
    }
    if (url.pathname === '/api/auth/buyers' && request.method === 'POST') {
      const seller = await currentAccount(db, request)
      if (!seller) return json({ error: 'Authentication required.' }, 401)
      const parsed = await requestBody(request)
      if (!parsed.ok) return json({ error: 'Expected JSON.' }, 400)
      const result = await createBuyerAccount(db, seller, parsed.body)
      return json(result.body, result.status)
    }
    if (url.pathname !== '/api/state') return json({ error: 'Not found.' }, 404)
    let body: unknown = null
    if (request.method === 'PUT') {
      try {
        body = await request.json()
      } catch {
        return json({ error: 'Expected JSON.' }, 400)
      }
    }
    const result = await handleState(request.method, body, db)
    return json(result.body, result.status)
  },
} satisfies ExportedHandler<Env>
