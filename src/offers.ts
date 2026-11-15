import type { Outcome } from './inventory'
import type { GiftLine, Offer, OfferGift, RecordedOffer, State } from './types'

const MAX_AMOUNT = 1_000_000

export type OfferInput = {
  name: string
  minimumAmount: number
  reward: 'discount' | 'gift'
  percent: number
  productId: string
  variantId: string
  quantity: number
  quantityUnit?: 'box' | 'item'
  giftItems?: OfferGift[]
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
  itemsPerBox: number
  price: number
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
    const configuredGifts = offer.giftItems?.length
      ? offer.giftItems
      : [{ productId: offer.productId, variantId: offer.variantId, quantity: offer.quantity, quantityUnit: offer.quantityUnit }]
    const gifts: GiftLine[] = []
    for (const configured of configuredGifts) {
      const item = findItem(configured.productId, configured.variantId)
      if (!item || configured.quantity <= 0) {
        gifts.length = 0
        break
      }
      const quantity = configured.quantity * ((configured.quantityUnit ?? 'item') === 'box' ? item.itemsPerBox : 1)
      if (!Number.isSafeInteger(quantity) || quantity <= 0) {
        gifts.length = 0
        break
      }
      gifts.push({
        productId: item.productId,
        variantId: item.variantId,
        productName: item.productName,
        variantName: item.variantName,
        sku: item.sku,
        quantity,
        unitPrice: item.price,
      })
    }
    if (gifts.length === 0) continue
    return {
      kind: 'gift',
      offerId: offer.id,
      offerName: offer.name,
      items: gifts,
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
    (offer) => (offer.minimumAmount === input.minimumAmount || offer.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase()) && offer.id !== offerId,
  )
  if (duplicate) {
    return fail('Duplicate data found.')
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
    quantityUnit: 'item',
  }

  if (nextOffer.reward === 'discount') {
    if (!Number.isInteger(input.percent) || input.percent < 1 || input.percent > 100) {
      return fail('Enter a discount from 1% to 100%.')
    }
    nextOffer.percent = input.percent
  } else {
    const configuredGifts = input.giftItems?.length
      ? input.giftItems
      : [{ productId: input.productId, variantId: input.variantId, quantity: input.quantity, quantityUnit: input.quantityUnit }]
    const seen = new Set<string>()
    const gifts: OfferGift[] = []
    for (const configured of configuredGifts) {
      const item = findCatalogItem(state, configured.productId, configured.variantId)
      if (!item) return fail('Choose each gift from the catalog.')
      const quantityUnit = configured.quantityUnit === 'box' ? 'box' : 'item'
      if (!Number.isInteger(configured.quantity) || configured.quantity < 1) {
        return fail('Enter how many gift pieces or boxes to give.')
      }
      const itemQuantity = configured.quantity * (quantityUnit === 'box' ? item.itemsPerBox : 1)
      if (configured.quantity > MAX_AMOUNT || !Number.isSafeInteger(itemQuantity) || itemQuantity > MAX_AMOUNT) {
        return fail('That gift quantity is too large.')
      }
      const key = `${item.productId}:${item.variantId}`
      if (seen.has(key)) return fail('Duplicate data found.')
      seen.add(key)
      gifts.push({ productId: item.productId, variantId: item.variantId, quantity: configured.quantity, quantityUnit })
    }
    const first = gifts[0]
    nextOffer.productId = first.productId
    nextOffer.variantId = first.variantId
    nextOffer.quantity = first.quantity
    nextOffer.quantityUnit = first.quantityUnit
    nextOffer.giftItems = gifts
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
    itemsPerBox: variant.itemsPerBox,
    price: variant.price,
  }
}

export function offerSummary(offer: Offer, giftLabel: string) {
  const amount = `₹${offer.minimumAmount.toLocaleString('en-IN')}`
  if (offer.reward === 'discount') {
    return `Spend ${amount} or more and the bill is ${offer.percent}% off.`
  }
  if ((offer.giftItems?.length ?? 0) > 1) {
    return `Spend ${amount} or more and get ${offer.giftItems!.length} free gift items.`
  }
  const unit = offer.quantityUnit ?? 'item'
  const count = `${offer.quantity.toLocaleString()} ${unit === 'box' ? (offer.quantity === 1 ? 'box' : 'boxes') : (offer.quantity === 1 ? 'piece' : 'pieces')}`
  return `Spend ${amount} or more and get ${count} of ${giftLabel} free.`
}
