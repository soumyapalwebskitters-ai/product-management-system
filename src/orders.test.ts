import assert from 'node:assert/strict'
import test from 'node:test'
import { ids, seedState } from './seed'
import { createBuyerPurchase, removeBuyer, setOrderStatus, updatePurchase } from './orders'

const now = '2026-11-09T12:00:00.000Z'

function stock(state: ReturnType<typeof seedState>, variantId: string) {
  for (const product of state.products) {
    const variant = product.variants.find((item) => item.id === variantId)
    if (variant) return variant.currentStock
  }
  throw new Error('missing')
}

test('a purchase above the gift offer takes the gift and not a discount', () => {
  const before = stock(seedState(), ids.sp10)
  const result = createBuyerPurchase(
    seedState(),
    {
      name: 'Meera',
      phone: '9876543210',
      address: '14 Lake View Road',
      note: '',
      status: 'placed',
      comment: 'Leave at the gate',
      lines: [{ productId: ids.sparklers, variantId: ids.sp10, quantity: 10 }],
    },
    now,
  )
  assert.equal(result.ok, true)
  if (!result.ok) return
  const order = result.state.orders[0]
  assert.equal(order?.number, 'ORD-1004')
  assert.equal(order?.offer?.kind, 'gift')
  assert.equal(order?.subtotal, 400)
  assert.equal(order?.total, 400)
  assert.equal(stock(result.state, ids.sp10), before - 12)
  assert.equal(result.state.buyers.at(-1)?.name, 'Meera')
  assert.equal(result.state.buyers.at(-1)?.address, '14 Lake View Road')
})

test('a smaller purchase can receive a discount without a gift', () => {
  const result = createBuyerPurchase(
    seedState(),
    {
      name: 'Arjun',
      phone: '',
      note: '',
      status: 'delivered',
      comment: '',
      lines: [{ productId: ids.sparklers, variantId: ids.sp10, quantity: 6 }],
    },
    now,
  )
  assert.equal(result.ok, true)
  if (!result.ok) return
  const order = result.state.orders[0]
  assert.equal(order?.offer?.kind, 'discount')
  if (order?.offer?.kind === 'discount') assert.equal(order.offer.amount, 24)
  assert.equal(order?.total, 216)
  assert.equal(stock(result.state, ids.sp10), stock(seedState(), ids.sp10) - 6)
})

test('cancelling a purchase returns the items and the gift', () => {
  const created = createBuyerPurchase(
    seedState(),
    {
      name: 'Meera',
      phone: '',
      note: '',
      status: 'placed',
      comment: '',
      lines: [{ productId: ids.sparklers, variantId: ids.sp10, quantity: 10 }],
    },
    now,
  )
  assert.equal(created.ok, true)
  if (!created.ok) return
  const order = created.state.orders[0]
  assert.ok(order)
  const cancelled = updatePurchase(
    created.state,
    order.id,
    {
      name: 'Meera',
      phone: '',
      note: '',
      status: 'cancelled',
      comment: 'Customer cancelled',
      lines: order.lines.map((line) => ({
        productId: line.productId,
        variantId: line.variantId,
        quantity: line.quantity,
      })),
    },
    now,
  )
  assert.equal(cancelled.ok, true)
  if (!cancelled.ok) return
  assert.equal(cancelled.state.orders[0]?.status, 'cancelled')
  assert.equal(stock(cancelled.state, ids.sp10), stock(seedState(), ids.sp10))
})

test('the seller can move a delivered order to cancelled and back, keeping stock in step', () => {
  const base = stock(seedState(), ids.sp10)
  const seller = seedState()
  const orderId = seller.orders.find((order) => order.buyerId === ids.buyerMeera)?.id
  assert.ok(orderId)
  const delivered = setOrderStatus(seller, orderId, 'cancelled', now)
  assert.equal(delivered.ok, true)
  if (!delivered.ok) return
  const cancelled = delivered.state.orders.find((order) => order.id === orderId)
  assert.equal(cancelled?.status, 'cancelled')
  assert.equal(stock(delivered.state, ids.sp10), base + 12)
  const reopened = setOrderStatus(delivered.state, orderId, 'delivered', now)
  assert.equal(reopened.ok, true)
  if (!reopened.ok) return
  assert.equal(stock(reopened.state, ids.sp10), base)
  assert.equal(reopened.state.orders.find((order) => order.id === orderId)?.status, 'delivered')
})

test('removing a buyer returns stock from open purchases', () => {
  const created = createBuyerPurchase(
    seedState(),
    {
      name: 'Meera',
      phone: '',
      note: '',
      status: 'delivered',
      comment: '',
      lines: [{ productId: ids.sparklers, variantId: ids.sp10, quantity: 10 }],
    },
    now,
  )
  assert.equal(created.ok, true)
  if (!created.ok) return
  const buyerId = created.state.buyers[0]?.id
  assert.ok(buyerId)
  const removed = removeBuyer(created.state, buyerId, now)
  assert.equal(removed.ok, true)
  if (!removed.ok) return
  assert.equal(removed.state.buyers.length, seedState().buyers.length)
  assert.equal(stock(removed.state, ids.sp10), stock(seedState(), ids.sp10))
})

test('a purchase can exceed the items on hand', () => {
  const before = stock(seedState(), ids.sp10)
  const result = createBuyerPurchase(
    seedState(),
    {
      name: 'Meera',
      phone: '',
      note: '',
      status: 'placed',
      comment: '',
      lines: [{ productId: ids.sparklers, variantId: ids.sp10, quantity: 50 }],
    },
    now,
  )
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.state.orders[0]?.lines[0]?.quantity, 50)
  assert.equal(stock(result.state, ids.sp10), before - 52)
  assert.ok(stock(result.state, ids.sp10) < 0)
})
