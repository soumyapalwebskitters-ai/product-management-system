import { publicWeb, manageWeb } from './webManagement'
import { readProductQueries } from './productQueries'
import { handleGallery, handleState } from '../src/shopApi'
import { readShop } from '../src/persist'
import type { Sql } from '../src/sql'
import type { State } from '../src/types'
import { createBuyerAccount, currentAccount, expiredSessionCookie, login, loginSeller, logout, resetSellerPassword, sellerExists, sessionCookie, setupSeller, type AuthResult } from './auth'
import { checkMutation, rateLimit, readJson, RequestError } from './security'

function json(data: unknown, status = 200, extra: HeadersInit = {}) {
  return new Response(JSON.stringify(data), { status, headers: {
    'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store',
    'x-content-type-options': 'nosniff', 'referrer-policy': 'same-origin', ...extra,
  } })
}
function authResponse(result: AuthResult) {
  return json(result.body, result.status, result.token && result.expiresAt ? { 'set-cookie': sessionCookie(result.token, result.expiresAt) } : {})
}
export function publicState(state: State): State {
  return {
    products: state.products.map((product) => ({
      id: product.id, name: product.name, image: product.image, createdAt: product.createdAt, updatedAt: product.updatedAt,
      variants: product.variants.map((variant) => ({
        id: variant.id, name: variant.name, sku: variant.sku, itemsPerBox: variant.itemsPerBox,
        price: variant.price, sellingUnit: variant.sellingUnit, image: variant.image,
        currentStock: 0, minimumStock: 0, desiredStock: 0,
      })),
    })),
    offers: state.offers, gallery: state.gallery ?? [], purchases: [], movements: [], buyers: [], orders: [],
    // Seller contact/profile fields are deliberately public storefront information.
    seller: state.seller,
  }
}
export type ApiOptions = { setupToken?: string; clientIp?: string; queriesDb?: Sql }
export async function handleApi(request: Request, db: Sql, options: ApiOptions = {}): Promise<Response> {
  try {
    const path = new URL(request.url).pathname
    checkMutation(request)
    if (path === '/api/gallery-image' && request.method === 'GET') return galleryImage(request)
    if (path.startsWith('/api/auth/') && path !== '/api/auth/logout' && !['GET', 'HEAD'].includes(request.method)) {
      await rateLimit(db, `auth:${options.clientIp ?? 'unknown'}`)
    }
    if (path === '/api/auth/bootstrap' && request.method === 'GET') return json({ sellerSetupRequired: !(await sellerExists(db)) })
    if (path === '/api/auth/setup' && request.method === 'POST') {
      if (!options.setupToken || request.headers.get('x-setup-token') !== options.setupToken) return json({ error: 'Protected seller setup is required.' }, 403)
      return authResponse(await setupSeller(db, await readJson(request, 4096)))
    }
    if (path === '/api/auth/login' && request.method === 'POST') return authResponse(await login(db, await readJson(request, 4096)))
    if (path === '/api/auth/seller/login' && request.method === 'POST') return authResponse(await loginSeller(db, await readJson(request, 4096)))
    if (path === '/api/auth/logout' && request.method === 'POST') {
      const result = await logout(db, request)
      return json(result.body, result.status, { 'set-cookie': expiredSessionCookie() })
    }
    if (request.method === 'GET' && (path === '/api/web-content' || path.startsWith('/api/web-media/'))) return await publicWeb(request, options.queriesDb)
    const account = await currentAccount(db, request)
    if (path === '/api/auth/me' && request.method === 'GET') return account ? json({ account }) : json({ error: 'Authentication required.' }, 401)
    if (path === '/api/state' && request.method === 'GET') {
      if (account?.role === 'seller') {
        const result = await handleState('GET', null, db)
        return json({ ...result.body, staff: true }, result.status)
      }
      const saved = await readShop(db)
      const state: State = saved?.state ?? { products: [], purchases: [], movements: [], buyers: [], orders: [], offers: [], gallery: [] }
      return json({ revision: saved?.revision ?? 0, fresh: false, staff: false, state: publicState(state) })
    }
    if (!['/api/state', '/api/gallery', '/api/auth/buyers', '/api/auth/seller/password', '/api/product-queries', '/api/web-content', '/api/web-media', '/api/testimonials'].includes(path)) return json({ error: 'Not found.' }, 404)
    if (!account) return json({ error: 'Seller sign-in is required.' }, 401)
    if (account.role !== 'seller') return json({ error: 'Seller access is required.' }, 403)
    if (['/api/web-content', '/api/web-media', '/api/testimonials'].includes(path)) {
      if (!options.queriesDb) return json({ error: 'Website database is not configured.' }, 503)
      return await manageWeb(request, options.queriesDb)
    }
    if (path === '/api/product-queries' && request.method === 'GET') {
      if (!options.queriesDb) return json({ error: 'Product query database is not configured.' }, 503)
      return json(await readProductQueries(request, options.queriesDb))
    }
    if (path === '/api/auth/seller/password' && request.method === 'PUT') return authResponse(await resetSellerPassword(db, account, await readJson(request, 4096)))
    if (path === '/api/auth/buyers' && request.method === 'POST') return authResponse(await createBuyerAccount(db, account, await readJson(request, 4096)))
    if (path === '/api/gallery' && ['POST', 'DELETE'].includes(request.method)) {
      const result = await handleGallery(request.method, await readJson(request, 16384), db)
      return json(result.body, result.status)
    }
    if (path === '/api/state' && request.method === 'PUT') {
      const result = await handleState('PUT', await readJson(request), db)
      return json(result.body, result.status)
    }
    return json({ error: 'Method not allowed.' }, 405)
  } catch (error) {
    if (error instanceof RequestError) return json({ error: error.message }, error.status, error.status === 429 ? { 'retry-after': '600' } : {})
    console.error('API request failed', error)
    return json({ error: 'Could not complete the request.' }, 500)
  }
}

function allowedImageUrl(url: URL) {
  return url.protocol === 'https:' && !url.username && !url.password && (!url.port || url.port === '443') &&
    (url.hostname === 'drive.google.com' || url.hostname === 'drive.usercontent.google.com' || url.hostname === 'lh3.googleusercontent.com' || url.hostname.endsWith('.googleusercontent.com'))
}
async function galleryImage(request: Request): Promise<Response> {
  const source = new URL(request.url).searchParams.get('url')
  if (!source) return json({ error: 'Missing image URL.' }, 400)
  let url: URL
  try { url = new URL(source) } catch { return json({ error: 'Invalid image URL.' }, 400) }
  if (!['drive.google.com', 'drive.usercontent.google.com'].includes(url.hostname)) return json({ error: 'Image host is not allowed.' }, 403)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  try {
    for (let count = 0; count < 5; count++) {
      if (!allowedImageUrl(url)) return json({ error: 'Image host is not allowed.' }, 403)
      const upstream = await fetch(url.toString(), { redirect: 'manual', signal: controller.signal })
      if ([301, 302, 303, 307, 308].includes(upstream.status)) {
        await upstream.body?.cancel()
        const location = upstream.headers.get('location')
        if (!location) break
        url = new URL(location, url)
        continue
      }
      const type = upstream.headers.get('content-type')?.split(';')[0].toLowerCase() ?? ''
      if (!upstream.ok || !['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'].includes(type)) {
        await upstream.body?.cancel()
        return json({ error: 'URL did not return a supported image.' }, 415)
      }
      const reader = upstream.body?.getReader()
      const chunks: Uint8Array[] = []
      let size = 0
      if (reader) while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.length
        if (size > 12 * 1024 * 1024) { await reader.cancel(); return json({ error: 'Image is too large.' }, 413) }
        chunks.push(value)
      }
      const bytes = new Uint8Array(size)
      let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
      return new Response(bytes, { headers: { 'content-type': type, 'cache-control': 'public, max-age=3600', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; sandbox", 'cross-origin-resource-policy': 'same-origin' } })
    }
    return json({ error: 'Too many image redirects.' }, 502)
  } catch { return json({ error: 'Image could not be loaded.' }, 502) } finally { clearTimeout(timer) }
}
