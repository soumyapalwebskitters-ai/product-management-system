import assert from 'node:assert/strict'
import test from 'node:test'
import { buyerPayment, orderDue } from './paymentStatus'

const placed = (total: number, paid: number) => ({ status: 'placed' as const, total, paid })
const delivered = (total: number, paid: number) => ({ status: 'delivered' as const, total, paid })
const cancelled = (total: number, paid: number) => ({ status: 'cancelled' as const, total, paid })

test('nothing received is a full due with the bill still owed', () => {
  const result = buyerPayment([placed(160, 0)])
  assert.equal(result.standing, 'full-due')
  assert.equal(result.due, 160)
})

test('a part payment before delivery is an advance, and the rest is due', () => {
  const result = buyerPayment([placed(160, 40)])
  assert.equal(result.standing, 'advance')
  assert.equal(result.due, 120)
})

test('a delivered bill that is only partly received is a partial payment', () => {
  const result = buyerPayment([delivered(400, 150)])
  assert.equal(result.standing, 'partial')
  assert.equal(result.due, 250)
})

test('a bill received in full is fully paid and has no due', () => {
  const result = buyerPayment([delivered(400, 400)])
  assert.equal(result.standing, 'full-paid')
  assert.equal(result.due, 0)
})

test('a cancelled purchase does not add to the due', () => {
  assert.equal(orderDue(cancelled(216, 0)), 0)
  const result = buyerPayment([cancelled(216, 0), placed(160, 0)])
  assert.equal(result.standing, 'full-due')
  assert.equal(result.due, 160)
})
