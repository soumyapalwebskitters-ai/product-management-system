import { readShop, writeShop } from './persist'
import { ensureState, isRecord, isState } from './parseState'
import { seedState } from './seed'
import type { Sql } from './sql'

export async function handleState(method: string, body: unknown, db: Sql) {
  try {
    if (method === 'GET') return { status: 200, body: await loadState(db) }
    if (method === 'PUT') return saveState(db, body)
    return { status: 405, body: { error: 'Method not allowed.' } }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const errorText = message.includes('no such table')
      ? 'D1 tables are missing. Apply the database migrations and reload.'
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
