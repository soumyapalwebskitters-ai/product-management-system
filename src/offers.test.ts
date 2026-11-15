import assert from 'node:assert/strict'
import test from 'node:test'
import { ids, seedState } from './seed'
import { chooseOffer, upsertOffer } from './offers'
import { findCatalogItem } from './offers'

test('a purchase gets the highest offer only, either a discount or a gift', () => {
  const state = seedState()
  const lookup = (productId: string, variantId: string) => findCatalogItem(state, productId, variantId)

  assert.equal(chooseOffer(state.offers, 160, lookup), null)

  const discount = chooseOffer(state.offers, 240, lookup)
  assert.equal(discount?.kind, 'discount')
  if (discount?.kind === 'discount') assert.equal(discount.amount, 24)

  const gift = chooseOffer(state.offers, 400, lookup)
  assert.equal(gift?.kind, 'gift')
  if (gift?.kind === 'gift') {
    assert.equal(gift.items[0]?.variantId, ids.sp10)
    assert.equal(gift.items[0]?.quantity, 2)
  }
})

test('an offer is either a discount or a gift', () => {
  const discount = upsertOffer(
    seedState(),
    {
      name: 'Extra',
      minimumAmount: 800,
      reward: 'discount',
      percent: 5,
      productId: '',
      variantId: '',
      quantity: 0,
    },
    null,
  )
  assert.equal(discount.ok, true)
  if (discount.ok) {
    const saved = discount.state.offers.find((offer) => offer.name === 'Extra')
    assert.equal(saved?.reward, 'discount')
    assert.equal(saved?.quantity, 0)
  }

  const gift = upsertOffer(
    seedState(),
    {
      name: 'Free pot',
      minimumAmount: 900,
      reward: 'gift',
      percent: 50,
      productId: ids.flowerPots,
      variantId: ids.fpSmall,
      quantity: 1,
    },
    null,
  )
  assert.equal(gift.ok, true)
  if (gift.ok) {
    const saved = gift.state.offers.find((offer) => offer.name === 'Free pot')
    assert.equal(saved?.reward, 'gift')
    assert.equal(saved?.percent, 0)
    assert.equal(saved?.variantId, ids.fpSmall)
  }
})

test('gift offers can be configured by box and award all pieces at the quality selling price', () => {
  const saved = upsertOffer(
    seedState(),
    {
      name: 'Two boxes free',
      minimumAmount: 1_000,
      reward: 'gift',
      percent: 0,
      productId: ids.flowerPots,
      variantId: ids.fpSmall,
      quantity: 2,
      quantityUnit: 'box',
    },
    null,
  )
  assert.equal(saved.ok, true)
  if (!saved.ok) return

  const offer = saved.state.offers.find((item) => item.name === 'Two boxes free')
  assert.equal(offer?.quantityUnit, 'box')
  assert.equal(offer?.quantity, 2)

  const gift = chooseOffer(saved.state.offers, 1_000, (productId, variantId) =>
    findCatalogItem(saved.state, productId, variantId),
  )
  assert.equal(gift?.kind, 'gift')
  if (gift?.kind === 'gift') {
    assert.equal(gift.items[0]?.quantity, 6)
    assert.equal(gift.items[0]?.unitPrice, 30)
  }
})
