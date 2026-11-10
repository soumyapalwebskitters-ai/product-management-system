import assert from 'node:assert/strict'
import test from 'node:test'
import { matchesQuery } from './search'

test('a single character lists every name that contains it', () => {
  assert.equal(matchesQuery('Flower Pots Small', 'a', 'smart'), true)
  assert.equal(matchesQuery('Sparklers', 'a', 'smart'), true)
  assert.equal(matchesQuery('Flower Pots Medium', 'a', 'smart'), false)
  assert.equal(matchesQuery('Rockets Multi Shot', 'a', 'smart'), false)
})

test('smart search matches characters in order', () => {
  assert.equal(matchesQuery('Flower Pots Large', 'fpl', 'smart'), true)
  assert.equal(matchesQuery('Flower Pots Large FP-L', 'fp-l', 'smart'), true)
  assert.equal(matchesQuery('Rockets', 'fl', 'smart'), false)
})

test('keyword search requires every word', () => {
  assert.equal(matchesQuery('Flower Pots Small FP-S', 'flower small', 'keyword'), true)
  assert.equal(matchesQuery('Flower Pots Small FP-S', 'fp-s', 'keyword'), true)
  assert.equal(matchesQuery('Flower Pots Small FP-S', 'flower rocket', 'keyword'), false)
})
