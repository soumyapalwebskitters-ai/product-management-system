import assert from 'node:assert/strict'
import test from 'node:test'
import { memoryDatabase } from '../server/local'
import { handleApi } from '../worker/api'
import { handleState } from './shopApi'
import { ensureState } from './parseState'
import { seedState } from './seed'
import { MAX_BODY } from '../worker/security'

const password = 'test-only-password-123'
const setupToken = 'test-only-setup-token'
function request(path: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) {
  return new Request(`https://shop.example${path}`, { method, headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) })
}
function cookie(response: Response) { return response.headers.get('set-cookie')!.split(';')[0] }
async function fixture() {
  const db = memoryDatabase()
  const state = ensureState(seedState(1700000000000))
  await handleState('PUT', { revision: 0, state }, db)
  const response = await handleApi(request('/api/auth/setup', 'POST', { email: 'staff@example.com', password }, { 'x-setup-token': setupToken }), db, { setupToken })
  assert.equal(response.status, 200)
  return { db, state, session: cookie(response) }
}

test('public catalog excludes private records, stock and costs', async () => {
  const { db } = await fixture()
  const response = await handleApi(request('/api/state'), db)
  const body = await response.json()
  assert.equal(body.staff, false)
  for (const field of ['buyers', 'orders', 'purchases', 'movements']) assert.deepEqual(body.state[field], [])
  assert.ok(body.state.products.length > 0)
  for (const product of body.state.products) for (const variant of product.variants) {
    assert.equal(variant.buyingPrice, undefined)
    assert.equal(variant.currentStock, 0)
    assert.equal(variant.note, undefined)
  }
})

test('anonymous writes and gallery mutations are denied without changing state', async () => {
  const { db, state } = await fixture()
  for (const [path, method] of [['/api/state', 'PUT'], ['/api/gallery', 'POST'], ['/api/gallery', 'DELETE']]) {
    const response = await handleApi(request(path, method, { revision: 1, state, id: 'anything' }), db)
    assert.equal(response.status, 401)
  }
  assert.equal((await db.first<{revision: number}>('SELECT revision FROM shop WHERE id=1'))?.revision, 1)
})

test('authenticated staff retains full data, state saving and gallery management', async () => {
  const { db, state, session } = await fixture()
  const headers = { cookie: session }
  const full = await (await handleApi(request('/api/state', 'GET', undefined, headers), db)).json()
  assert.equal(full.staff, true)
  assert.equal(full.state.buyers.length, state.buyers.length)
  state.products[0].name = 'Updated by staff'
  assert.equal((await handleApi(request('/api/state', 'PUT', { revision: 1, state }, headers), db)).status, 200)
  const image = { id: 'security-test-image', productId: state.products[0].id, variantId: state.products[0].variants[0].id, url: 'https://drive.google.com/uc?id=test', createdAt: new Date().toISOString() }
  assert.equal((await handleApi(request('/api/gallery', 'POST', { revision: 2, image }, headers), db)).status, 200)
  assert.equal((await handleApi(request('/api/gallery', 'DELETE', { revision: 3, id: image.id }, headers), db)).status, 200)
  assert.equal((await db.first<{revision:number}>('SELECT revision FROM shop WHERE id=1'))?.revision, 4)
})

test('buyer accounts cannot access staff data or mutations', async () => {
  const { db, state, session } = await fixture()
  const credentials = { email: 'buyer@example.com', password }
  const created = await handleApi(request('/api/auth/buyers', 'POST', { ...credentials, buyerId: state.buyers[0].id }, { cookie: session }), db)
  assert.equal(created.status, 201)
  const logged = await handleApi(request('/api/auth/login', 'POST', credentials), db)
  const headers = { cookie: cookie(logged) }
  assert.equal((await (await handleApi(request('/api/state', 'GET', undefined, headers), db)).json()).staff, false)
  assert.equal((await handleApi(request('/api/state', 'PUT', { revision: 1, state }, headers), db)).status, 403)
})

test('seller setup requires the server token and login never creates a default account', async () => {
  const db = memoryDatabase()
  assert.equal((await handleApi(request('/api/auth/setup', 'POST', { email: 'staff@example.com', password }), db)).status, 403)
  assert.equal((await handleApi(request('/api/auth/seller/login', 'POST', { password }), db)).status, 401)
  assert.equal(await db.first('SELECT id FROM auth_accounts LIMIT 1'), null)
  assert.equal((await handleApi(request('/api/auth/seller/auto-login', 'POST', {}), db)).status, 404)
})

test('password change verifies current password and revokes all previous sessions', async () => {
  const { db, session } = await fixture()
  const other = await handleApi(request('/api/auth/seller/login', 'POST', { password }), db)
  const nextPassword = 'new-test-password-456'
  assert.equal((await handleApi(request('/api/auth/seller/password', 'PUT', { password: nextPassword, currentPassword: 'wrong-password' }, { cookie: session }), db)).status, 403)
  const reset = await handleApi(request('/api/auth/seller/password', 'PUT', { password: nextPassword, currentPassword: password }, { cookie: session }), db)
  assert.equal(reset.status, 200)
  for (const old of [session, cookie(other)]) assert.equal((await handleApi(request('/api/auth/me', 'GET', undefined, { cookie: old }), db)).status, 401)
  assert.equal((await handleApi(request('/api/auth/me', 'GET', undefined, { cookie: cookie(reset) }), db)).status, 200)
  assert.equal((await handleApi(request('/api/auth/seller/login', 'POST', { password }), db)).status, 401)
  assert.equal((await handleApi(request('/api/auth/seller/login', 'POST', { password: nextPassword }), db)).status, 200)
})

test('logout invalidates the server-side session', async () => {
  const { db, session } = await fixture()
  assert.equal((await handleApi(request('/api/auth/logout', 'POST', {}, { cookie: session }), db)).status, 200)
  assert.equal((await handleApi(request('/api/auth/me', 'GET', undefined, { cookie: session }), db)).status, 401)
})

test('cross-site writes, wrong content types and oversized requests are rejected', async () => {
  const { db, session, state } = await fixture()
  const body = { revision: 1, state }
  assert.equal((await handleApi(request('/api/state', 'PUT', body, { cookie: session, origin: 'https://untrusted.example' }), db)).status, 403)
  assert.equal((await handleApi(request('/api/state', 'PUT', body, { cookie: session, 'content-type': 'text/plain' }), db)).status, 415)
  assert.equal((await handleApi(request('/api/state', 'PUT', body, { cookie: session, 'content-length': String(MAX_BODY + 1) }), db)).status, 413)
})

test('authentication attempts have a persistent rate limit', async () => {
  const db = memoryDatabase()
  for (let i = 0; i < 10; i++) assert.equal((await handleApi(request('/api/auth/seller/login', 'POST', { password }), db, { clientIp: 'test-ip' })).status, 401)
  const blocked = await handleApi(request('/api/auth/seller/login', 'POST', { password }), db, { clientIp: 'test-ip' })
  assert.equal(blocked.status, 429)
  assert.equal(blocked.headers.get('retry-after'), '600')
})

test('image proxy rejects unsafe origins and redirects, and active image formats', async () => {
  const db = memoryDatabase()
  const original = globalThis.fetch
  try {
    let calls = 0
    globalThis.fetch = async () => { calls++; return new Response(null, { status: 302, headers: { location: 'https://untrusted.example/image' } }) }
    const query = (url: string) => request(`/api/gallery-image?url=${encodeURIComponent(url)}`)
    assert.equal((await handleApi(query('http://drive.google.com/uc?id=test'), db)).status, 403)
    assert.equal(calls, 0)
    assert.equal((await handleApi(query('https://drive.google.com/uc?id=test'), db)).status, 403)
    assert.equal(calls, 1)
    globalThis.fetch = async () => new Response('<svg/>', { headers: { 'content-type': 'image/svg+xml' } })
    assert.equal((await handleApi(query('https://drive.google.com/uc?id=test'), db)).status, 415)
    globalThis.fetch = async () => new Response(new Uint8Array([1,2,3]), { headers: { 'content-type': 'image/jpeg' } })
    const image = await handleApi(query('https://drive.google.com/uc?id=test'), db)
    assert.equal(image.status, 200)
    assert.equal(image.headers.get('x-content-type-options'), 'nosniff')
  } finally { globalThis.fetch = original }
})
