import assert from 'node:assert/strict'
import test from 'node:test'
import { calcPurchase, needsRestock } from './purchase'

test('40 items at 3 per box rounds up to 14 boxes', () => {
  const result = calcPurchase(10, 50, 3)
  assert.deepEqual(result, {
    purchaseQty: 40,
    boxes: 14,
    totalItems: 42,
    extra: 2,
    itemsPerBox: 3,
  })
})

test('exact box multiples have no extra items', () => {
  const result = calcPurchase(5, 30, 5)
  assert.equal(result.purchaseQty, 25)
  assert.equal(result.boxes, 5)
  assert.equal(result.totalItems, 25)
  assert.equal(result.extra, 0)
})

test('partial boxes always round up', () => {
  assert.equal(calcPurchase(0, 1, 3).boxes, 1)
  assert.equal(calcPurchase(0, 1, 3).totalItems, 3)
  assert.equal(calcPurchase(0, 1, 3).extra, 2)
  assert.equal(calcPurchase(0, 3, 3).boxes, 1)
  assert.equal(calcPurchase(0, 3, 3).extra, 0)
  assert.equal(calcPurchase(0, 4, 3).boxes, 2)
  assert.equal(calcPurchase(0, 4, 3).totalItems, 6)
  assert.equal(calcPurchase(0, 4, 3).extra, 2)
})

test('a shortage below zero is included in the purchase quantity', () => {
  const result = calcPurchase(-8, 50, 10)
  assert.equal(result.purchaseQty, 58)
  assert.equal(result.boxes, 6)
  assert.equal(result.totalItems, 60)
  assert.equal(result.extra, 2)
})

test('purchase quantity is never negative', () => {
  const result = calcPurchase(60, 50, 10)
  assert.equal(result.purchaseQty, 0)
  assert.equal(result.boxes, 0)
  assert.equal(result.totalItems, 0)
  assert.equal(result.extra, 0)
})

test('restock is only when current stock is below the minimum', () => {
  assert.equal(needsRestock(19, 20), true)
  assert.equal(needsRestock(20, 20), false)
  assert.equal(needsRestock(0, 1), true)
  assert.equal(needsRestock(60, 20), false)
})
