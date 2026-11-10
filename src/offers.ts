import type { Outcome } from './inventory'
import type { GiftLine, Offer, RecordedOffer, State } from './types'

const MAX_AMOUNT = 1_000_000

export type OfferInput = {
  name: string
  minimumAmount: number
  reward: 'discount' | 'gift'
  percent: number
  productId: string
  variantId: string
  quantity: number
}

export type PricedLine = {
  productId: string
  variantId: string
  quantity: number
  unitPrice: number
}

type CatalogItem = {
  productId: string
  productName: string
  variantId: string
  variantName: string
  sku: string
}

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error }
}

function clean(value: string, max: number) {
  return value.trim().slice(0, max)
}

export function orderSubtotal(lines: PricedLine[]) {
  return lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)
}

export function discountAmount(subtotal: number, percent: number) {
  return Math.floor((subtotal * percent) / 100)
}

/** The purchase receives only the highest offer it reaches. */
export function chooseOffer(
  offers: Offer[],
  subtotal: number,
  findItem: (productId: string, variantId: string) => CatalogItem | null,
): RecordedOffer | null {
  const ranked = [...offers].sort((left, right) => right.minimumAmount - left.minimumAmount)
  for (const offer of ranked) {
    if (subtotal < offer.minimumAmount) continue
    if (offer.reward === 'discount') {
      if (offer.percent <= 0) continue
      return {
        kind: 'discount',
        offerId: offer.id,
        offerName: offer.name,
        percent: offer.percent,
        amount: discountAmount(subtotal, offer.percent),
      }
    }
    const item = findItem(offer.productId, offer.variantId)
    if (!item || offer.quantity <= 0) continue
    const gift: GiftLine = {
      productId: item.productId,
      variantId: item.variantId,
      productName: item.productName,
      variantName: item.variantName,
      sku: item.sku,
      quantity: offer.quantity,
    }
    return {
      kind: 'gift',
      offerId: offer.id,
      offerName: offer.name,
      items: [gift],
    }
  }
  return null
}

export function nextOffer(offers: Offer[], subtotal: number) {
  return [...offers]
    .filter((offer) => offer.minimumAmount > subtotal)
    .sort((left, right) => left.minimumAmount - right.minimumAmount)[0]
}

export function upsertOffer(state: State, input: OfferInput, offerId: string | null): Outcome {
  const name = clean(input.name, 80)
  if (!name) return fail('Enter a name for the offer.')
  if (!Number.isInteger(input.minimumAmount) || input.minimumAmount < 1) {
    return fail('Enter the purchase amount that unlocks this offer.')
  }
  if (input.minimumAmount > MAX_AMOUNT) return fail('That purchase amount is too large.')

  const duplicate = state.offers.some(
    (offer) => offer.minimumAmount === input.minimumAmount && offer.id !== offerId,
  )
  if (duplicate) {
    return fail('An offer already starts at that amount. Edit it, or choose a different amount.')
  }

  const nextOffer: Offer = {
    id: offerId ?? crypto.randomUUID(),
    name,
    minimumAmount: input.minimumAmount,
    reward: input.reward === 'gift' ? 'gift' : 'discount',
    percent: 0,
    productId: '',
    variantId: '',
    quantity: 0,
  }

  if (nextOffer.reward === 'discount') {
    if (!Number.isInteger(input.percent) || input.percent < 1 || input.percent > 100) {
      return fail('Enter a discount from 1% to 100%.')
    }
    nextOffer.percent = input.percent
  } else {
    const item = findCatalogItem(state, input.productId, input.variantId)
    if (!item) return fail('Choose the gift from the catalog.')
    if (!Number.isInteger(input.quantity) || input.quantity < 1) {
      return fail('Enter how many gift items to give.')
    }
    if (input.quantity > MAX_AMOUNT) return fail('That gift quantity is too large.')
    nextOffer.productId = item.productId
    nextOffer.variantId = item.variantId
    nextOffer.quantity = input.quantity
  }

  const next = structuredClone(state)
  const index = next.offers.findIndex((offer) => offer.id === nextOffer.id)
  if (offerId && index < 0) return fail('Offer not found.')
  if (index >= 0) next.offers[index] = nextOffer
  else next.offers.push(nextOffer)
  next.offers.sort((left, right) => left.minimumAmount - right.minimumAmount)
  return { ok: true, state: next }
}

export function deleteOffer(state: State, offerId: string): Outcome {
  if (!state.offers.some((offer) => offer.id === offerId)) return fail('Offer not found.')
  const next = structuredClone(state)
  next.offers = next.offers.filter((offer) => offer.id !== offerId)
  return { ok: true, state: next }
}

export function findCatalogItem(state: State, productId: string, variantId: string): CatalogItem | null {
  const product = state.products.find((item) => item.id === productId)
  const variant = product?.variants.find((item) => item.id === variantId)
  if (!product || !variant) return null
  return {
    productId: product.id,
    productName: product.name,
    variantId: variant.id,
    variantName: variant.name,
    sku: variant.sku,
  }
}

export function offerSummary(offer: Offer, giftLabel: string) {
  const amount = `₹${offer.minimumAmount.toLocaleString('en-IN')}`
  if (offer.reward === 'discount') {
    return `Spend ${amount} or more and the bill is ${offer.percent}% off.`
  }
  const count = `${offer.quantity.toLocaleString()} ${offer.quantity === 1 ? 'item' : 'items'}`
  return `Spend ${amount} or more and get ${count} of ${giftLabel} free.`
}
