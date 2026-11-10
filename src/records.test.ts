import assert from 'node:assert/strict'
import test from 'node:test'
import { fromRows, toRows } from './records'
import { seedState } from './seed'
import type { State } from './types'

const fixed = 1_700_000_000_000

test('shop rows round-trip the sample catalog', () => {
  const state = seedState(fixed)
  assert.deepEqual(fromRows(toRows(state)), state)
})

test('empty shop rows round-trip', () => {
  const state: State = {
    products: [],
    purchases: [],
    movements: [],
    buyers: [],
    orders: [],
    offers: [],
  }
  assert.deepEqual(fromRows(toRows(state)), state)
})

test('seller info round-trips and an empty profile stays off the shop', () => {
  const state = seedState(fixed)
  state.seller = {
    name: 'Rupsa Datta',
    address: '14 Lake View Road',
    gst: '19AAAAA0000A1Z5',
    businessName: 'Market',
    facebook: 'market',
    instagram: '@market',
    youtube: 'market',
    whatsapp: '919876543210',
  }
  assert.deepEqual(fromRows(toRows(state)), state)
  state.seller = {
    name: '',
    address: '',
    gst: '',
    businessName: '',
    facebook: '',
    instagram: '',
    youtube: '',
    whatsapp: '',
  }
  const stored = fromRows(toRows(state))
  assert.equal(stored.seller, undefined)
})
