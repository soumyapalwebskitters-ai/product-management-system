import { readShop, writeShop } from './persist'
import { ensureState, isRecord, isState } from './parseState'
import { seedState } from './seed'
import type { Sql } from './sql'

function isText(value: unknown, max = 2_000): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max
}

export async function handleState(method: string, body: unknown, db: Sql) {
  try {
    if (method === 'GET') return { status: 200, body: await loadState(db) }
    if (method === 'PUT') return saveState(db, body)
    return { status: 405, body: { error: 'Method not allowed.' } }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    console.error('Shop state request failed', error)
    const errorText = message.includes('no such table')
      ? 'D1 tables are missing. Apply the database migrations and reload.'
      : message
        ? `Could not use the shop database: ${message}`
        : 'Could not use the shop database.'
    return { status: 500, body: { error: errorText } }
  }
}

async function loadState(db: Sql) {
  const saved = await readShop(db)
  if (!saved) return { revision: 0, fresh: true, state: ensureState(seedState()) }
  return { revision: saved.revision, fresh: false, state: ensureState(saved.state) }
}

async function saveState(db: Sql, body: unknown) {
  if (!isRecord(body) || typeof body.revision !== 'number' || !Number.isInteger(body.revision) || body.revision < 0) {
    return { status: 400, body: { error: 'Missing revision.' } }
  }
  if (!isState(body.state)) return { status: 400, body: { error: 'Shop data was not valid.' } }

  const state = ensureState(body.state)
  const current = await readShop(db)
  if (body.revision === 0) {
    if (current) {
      return {
        status: 409,
        body: { error: 'The shop changed.', revision: current.revision, state: ensureState(current.state) },
      }
    }
    await writeShop(db, state, 1)
    return { status: 200, body: { revision: 1, state } }
  }
  if (!current) {
    return { status: 409, body: { error: 'The shop is not ready.', revision: 0, state: ensureState(seedState()) } }
  }
  if (current.revision !== body.revision) {
    return {
      status: 409,
      body: { error: 'The shop changed.', revision: current.revision, state: ensureState(current.state) },
    }
  }
  const revision = current.revision + 1
  await writeShop(db, state, revision)
  return { status: 200, body: { revision, state } }
}

export async function handleGallery(method: string, body: unknown, db: Sql) {
  try {
    if (method !== 'POST' || !isRecord(body) || typeof body.revision !== 'number' || !isRecord(body.image)) return { status: 400, body: { error: 'Invalid gallery request.' } }
    const image = body.image
    if (!isText(image.id, 120) || !isText(image.productId, 120) || !isText(image.variantId, 120) || !isText(image.url) || !isText(image.createdAt, 80)) return { status: 400, body: { error: 'Gallery image data was not valid.' } }
    const current = await db.first<{ revision: number }>('SELECT revision FROM shop WHERE id = 1')
    if (!current) return { status: 409, body: { error: 'The shop is not ready.' } }
    if (current.revision !== body.revision) return { status: 409, body: { error: 'The shop changed.', revision: current.revision } }
    const variant = await db.first<{ id: string }>('SELECT id FROM variants WHERE id = ? AND product_id = ?', [image.variantId, image.productId])
    if (!variant) return { status: 400, body: { error: 'Choose a valid product variant.' } }
    const duplicate = await db.first<{ id: string }>('SELECT id FROM gallery_images WHERE variant_id = ? AND url = ?', [image.variantId, image.url])
    if (duplicate) return { status: 400, body: { error: 'Duplicate data found.' } }
    const revision = current.revision + 1
    await db.batch([
      { sql: 'INSERT INTO gallery_images (id, product_id, variant_id, url, created_at, position) VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX(position), -1) + 1 FROM gallery_images))', params: [image.id, image.productId, image.variantId, image.url, image.createdAt] },
      { sql: 'UPDATE variants SET image = ? WHERE id = ?', params: [image.url, image.variantId] },
      { sql: 'UPDATE shop SET revision = ? WHERE id = 1', params: [revision] },
    ])
    return { status: 200, body: { revision } }
  } catch (error) {
    console.error('Gallery save failed', error)
    return { status: 500, body: { error: error instanceof Error ? `Could not save gallery image: ${error.message}` : 'Could not save gallery image.' } }
  }
}
