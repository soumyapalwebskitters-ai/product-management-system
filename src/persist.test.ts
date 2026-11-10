import assert from 'node:assert/strict'
import test from 'node:test'
import { memoryDatabase } from '../server/local'
import { handleState } from './shopApi'
import { ensureState } from './parseState'
import { seedState } from './seed'

const fixed = 1_700_000_000_000

test('sqlite tables store and reload the sample shop', async () => {
  const db = memoryDatabase()
  const state = ensureState(seedState(fixed))
  const created = await handleState('PUT', { revision: 0, state }, db)
  assert.equal(created.status, 200)
  assert.deepEqual(created.body, { revision: 1, state })

  const loaded = await handleState('GET', null, db)
  assert.equal(loaded.status, 200)
  assert.deepEqual(loaded.body, { revision: 1, fresh: false, state })

  const again = await handleState('PUT', { revision: 1, state }, db)
  assert.equal(again.status, 200)
  assert.deepEqual(again.body, { revision: 2, state })
})
