import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buyRows,
  createProduct,
  deleteProduct,
  receivePurchase,
  recordPurchase,
  recordSale,
  setDesiredStock,
  setStock,
  updateProduct,
} from './inventory'
import { ids, seedState } from './seed'
import type { State } from './types'

const now = '2026-11-09T12:00:00.000Z'

function variant(state: State, id: string) {
  for (const product of state.products) {
    const found = product.variants.find((item) => item.id === id)
    if (found) return found
  }
  throw new Error(`Missing variant ${id}`)
}

function row(state: State, id: string) {
  return buyRows(state).find((item) => item.variant.id === id)
}

function must<T extends { ok: true; state: State } | { ok: false; error: string }>(
  result: T,
): Extract<T, { ok: true }> {
  if (!result.ok) throw new Error(result.error)
  return result as Extract<T, { ok: true }>
}

test('sample purchase list matches the restock rules', () => {
  const state = seedState()
  const rows = buyRows(state)
  const listed = rows.map((item) => item.variant.id)

  assert.deepEqual(listed, [ids.rkSingle, ids.fpMedium, ids.fpSmall, ids.rkMulti, ids.sp7])
  assert.equal(listed.includes(ids.sp10), false)
  assert.equal(listed.includes(ids.fpLarge), false)

  const small = row(state, ids.fpSmall)
  assert.ok(small)
  assert.equal(small.variant.currentStock, 10)
  assert.equal(small.variant.minimumStock, 20)
  assert.equal(small.variant.desiredStock, 50)
  assert.equal(small.calc.purchaseQty, 40)
  assert.equal(small.calc.boxes, 14)
  assert.equal(small.calc.totalItems, 42)
  assert.equal(small.calc.extra, 2)

  const multi = row(state, ids.rkMulti)
  assert.ok(multi)
  assert.equal(multi.calc.purchaseQty, 25)
  assert.equal(multi.onOrderItems, 0)
  assert.equal(row(state, ids.sp7)?.onOrderItems, 40)
  assert.equal(row(state, ids.rkSingle)?.status, 'out')
})

test('changing desired stock recalculates the purchase quantity', () => {
  const lowered = must(setDesiredStock(seedState(), ids.flowerPots, ids.fpSmall, 22, now))
  const small = row(lowered.state, ids.fpSmall)
  assert.ok(small)
  assert.equal(small.calc.purchaseQty, 12)
  assert.equal(small.calc.boxes, 4)
  assert.equal(small.calc.totalItems, 12)
  assert.equal(small.calc.extra, 0)

  const level = must(setDesiredStock(lowered.state, ids.flowerPots, ids.fpSmall, 10, now))
  const stillShort = row(level.state, ids.fpSmall)
  assert.ok(stillShort)
  assert.equal(stillShort.calc.purchaseQty, 0)
  assert.equal(stillShort.calc.boxes, 0)
})

test('a sale, adjustment, or receipt updates who needs buying', () => {
  let state = seedState()
  assert.equal(row(state, ids.fpLarge), undefined)

  state = must(recordSale(state, ids.flowerPots, ids.fpLarge, 10, 'Stall sale', now)).state
  let large = row(state, ids.fpLarge)
  assert.ok(large)
  assert.equal(variant(state, ids.fpLarge).currentStock, 8)
  assert.equal(large.calc.purchaseQty, 16)
  assert.equal(large.calc.boxes, 4)
  assert.equal(large.calc.extra, 0)

  state = must(setStock(state, ids.sparklers, ids.sp10, 19, 'Count correction', now)).state
  assert.equal(row(state, ids.sp10)?.status, 'low')
  assert.equal(row(state, ids.sp10)?.calc.purchaseQty, 31)

  state = must(setStock(state, ids.sparklers, ids.sp10, 20, 'Count correction', now)).state
  assert.equal(row(state, ids.sp10), undefined)

  state = must(setStock(state, ids.flowerPots, ids.fpLarge, 0, 'Written off', now)).state
  assert.equal(row(state, ids.fpLarge)?.status, 'out')
})

test('recording a received purchase adds stock and leaves the list', () => {
  const result = must(
    recordPurchase(
      seedState(),
      {
        productId: ids.flowerPots,
        variantId: ids.fpSmall,
        boxes: 14,
        items: 42,
        receiveNow: true,
        note: 'Market run',
      },
      now,
    ),
  )
  assert.equal(variant(result.state, ids.fpSmall).currentStock, 52)
  assert.equal(row(result.state, ids.fpSmall), undefined)
  assert.equal(result.state.purchases[0].status, 'received')
  assert.equal(result.state.purchases[0].orderedItems, 42)
  assert.equal(result.state.movements[0].type, 'purchase')
  assert.equal(result.state.movements[0].delta, 42)
})

test('an order stays open until the delivery is received', () => {
  let state = must(
    recordPurchase(
      seedState(),
      {
        productId: ids.rockets,
        variantId: ids.rkSingle,
        boxes: 6,
        items: 36,
        receiveNow: false,
        note: 'Placed',
      },
      now,
    ),
  ).state
  assert.equal(variant(state, ids.rkSingle).currentStock, 0)
  assert.equal(row(state, ids.rkSingle)?.onOrderItems, 36)
  assert.equal(state.purchases[0].status, 'ordered')

  state = must(receivePurchase(state, state.purchases[0].id, 6, 'One box arrived', now)).state
  assert.equal(variant(state, ids.rkSingle).currentStock, 6)
  assert.equal(state.purchases[0].status, 'partial')
  assert.equal(row(state, ids.rkSingle)?.onOrderItems, 30)
  assert.equal(row(state, ids.rkSingle)?.calc.purchaseQty, 30)

  state = must(receivePurchase(state, state.purchases[0].id, 30, 'Rest arrived', now)).state
  assert.equal(variant(state, ids.rkSingle).currentStock, 36)
  assert.equal(state.purchases[0].status, 'received')
  assert.equal(row(state, ids.rkSingle), undefined)
  const again = receivePurchase(state, state.purchases[0].id, 1, '', now)
  assert.equal(again.ok, false)
})

test('selling more than stock or reusing a SKU is rejected', () => {
  const oversell = recordSale(seedState(), ids.rockets, ids.rkMulti, 6, '', now)
  assert.equal(oversell.ok, false)

  const duplicate = createProduct(
    seedState(),
    {
      name: 'Copy',
      variants: [
        {
          name: 'Small',
          sku: 'fp-s',
          itemsPerBox: 1,
          currentStock: 0,
          minimumStock: 1,
          desiredStock: 2,
        },
      ],
    },
    now,
  )
  assert.equal(duplicate.ok, false)
})

test('products can be added, edited, and deleted without losing purchase history', () => {
  let state = must(
    createProduct(
      seedState(),
      {
        name: 'Ground Chakkars',
        variants: [
          {
            name: 'Standard',
            sku: 'GC-STD',
            itemsPerBox: 10,
            currentStock: 2,
            minimumStock: 8,
            desiredStock: 20,
          },
          {
            name: 'Deluxe',
            sku: 'GC-DLX',
            itemsPerBox: 4,
            currentStock: 0,
            minimumStock: 4,
            desiredStock: 8,
          },
        ],
      },
      now,
    ),
  ).state
  const created = state.products.find((product) => product.name === 'Ground Chakkars')
  assert.ok(created)
  assert.equal(created.variants.length, 2)
  assert.equal(row(state, created.variants[0].id)?.calc.boxes, 2)
  assert.equal(state.movements[0].note, 'Opening stock')

  state = must(
    updateProduct(
      state,
      created.id,
      {
        name: 'Ground Chakkar',
        variants: [
          {
            id: created.variants[0].id,
            name: 'Standard',
            sku: 'GC-STD',
            itemsPerBox: 10,
            currentStock: 12,
            minimumStock: 8,
            desiredStock: 20,
          },
        ],
      },
      now,
    ),
  ).state
  const edited = state.products.find((product) => product.id === created.id)
  assert.equal(edited?.name, 'Ground Chakkar')
  assert.equal(edited?.variants.length, 1)
  assert.equal(row(state, created.variants[0].id), undefined)

  const historyBefore = state.purchases.length
  state = must(deleteProduct(state, ids.sparklers)).state
  assert.equal(state.products.some((product) => product.id === ids.sparklers), false)
  assert.equal(state.purchases.length, historyBefore)
  const receiveMissing = receivePurchase(state, ids.purchaseSparkler, 40, '', now)
  assert.equal(receiveMissing.ok, false)
})

test('a fully received purchase cannot be received again', () => {
  const finished = must(
    recordPurchase(
      seedState(),
      {
        productId: ids.flowerPots,
        variantId: ids.fpMedium,
        boxes: 1,
        items: 2,
        receiveNow: true,
        note: '',
      },
      now,
    ),
  ).state
  const again = receivePurchase(finished, finished.purchases[0].id, 1, '', now)
  assert.equal(again.ok, false)
  if (!again.ok) assert.match(again.error, /already fully received/)
})
