import { moveStock, type Outcome } from './inventory'
import { chooseOffer, findCatalogItem, orderSubtotal } from './offers'
import type { Buyer, CustomerOrder, OrderLine, OrderStatus, PaymentMethod, State } from './types'

export type OrderLineInput = {
  productId: string
  variantId: string
  quantity: number
}

export type BuyerInput = {
  name: string
  phone: string
  address?: string
  note: string
}

export type PurchaseInput = BuyerInput & {
  buyerId?: string | null
  status: OrderStatus
  paymentMethod?: PaymentMethod
  paid?: number
  comment: string
  lines: OrderLineInput[]
}

const statuses: OrderStatus[] = ['placed', 'delivered', 'cancelled']
const paymentMethods: PaymentMethod[] = ['cash', 'upi', 'card', 'bank']

/** Next unused bill number. Existing numbers stay put when an order is edited. */
export function nextOrderNumber(orders: Array<Pick<CustomerOrder, 'number'>>) {
  let max = 1000
  for (const order of orders) {
    const match = /^ORD-(\d+)$/.exec(order.number ?? '')
    if (match) max = Math.max(max, Number(match[1]))
  }
  return `ORD-${String(max + 1).padStart(4, '0')}`
}

/** Fills a stable bill number on orders saved before numbers existed. Older purchases get the lower number. */
export function withOrderNumbers<T extends { id: string; number?: string; createdAt: string }>(orders: T[]) {
  const sorted = [...orders].sort(
    (left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
  )
  let max = 1000
  const assigned = new Map<string, string>()
  for (const order of sorted) {
    const match = /^ORD-(\d+)$/.exec(order.number ?? '')
    if (!match || !order.number) continue
    assigned.set(order.id, order.number)
    max = Math.max(max, Number(match[1]))
  }
  for (const order of sorted) {
    if (assigned.has(order.id)) continue
    max += 1
    assigned.set(order.id, `ORD-${String(max).padStart(4, '0')}`)
  }
  return orders.map((order) => ({ ...order, number: assigned.get(order.id) ?? nextOrderNumber([]) }))
}

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error }
}

function clean(value: string, max: number) {
  return value.trim().slice(0, max)
}

function findVariant(state: State, productId: string, variantId: string) {
  const product = state.products.find((item) => item.id === productId)
  const variant = product?.variants.find((item) => item.id === variantId)
  if (!product || !variant) return null
  return { product, variant }
}

function heldCounts(order: CustomerOrder | null) {
  const counts = new Map<string, { paid: number; gift: number; productId: string; variantId: string }>()
  if (!order || order.status === 'cancelled') return counts
  for (const line of order.lines) {
    const current = counts.get(line.variantId) ?? {
      paid: 0,
      gift: 0,
      productId: line.productId,
      variantId: line.variantId,
    }
    current.paid += line.quantity
    counts.set(line.variantId, current)
  }
  if (order.offer?.kind === 'gift') {
    for (const gift of order.offer.items) {
      const current = counts.get(gift.variantId) ?? {
        paid: 0,
        gift: 0,
        productId: gift.productId,
        variantId: gift.variantId,
      }
      current.gift += gift.quantity
      counts.set(gift.variantId, current)
    }
  }
  return counts
}

function validatePurchase(input: PurchaseInput) {
  const name = clean(input.name, 80)
  if (!name) return fail('Enter the buyer’s name.')
  const phone = clean(input.phone, 30)
  const address = clean(input.address ?? '', 400)
  const note = clean(input.note, 300)
  const comment = clean(input.comment, 500)
  if (!statuses.includes(input.status)) return fail('Choose a purchase status.')
  const paymentMethod = paymentMethods.includes(input.paymentMethod ?? 'cash')
    ? (input.paymentMethod ?? 'cash')
    : null
  if (!paymentMethod) return fail('Choose a payment method.')
  const paid = input.paid ?? 0
  if (!Number.isInteger(paid) || paid < 0) return fail('Enter the amount received as a whole number of rupees.')
  if (input.lines.length === 0) return fail('Add at least one item to the purchase.')

  const merged = new Map<string, OrderLineInput>()
  for (const line of input.lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      return fail('Each item needs a quantity of at least 1.')
    }
    const key = `${line.productId}:${line.variantId}`
    const current = merged.get(key)
    if (current) current.quantity += line.quantity
    else merged.set(key, { ...line })
  }
  return {
    ok: true as const,
    name,
    phone,
    address,
    note,
    comment,
    status: input.status,
    paymentMethod,
    paid,
    lines: [...merged.values()],
  }
}

export function updateBuyer(state: State, buyerId: string, input: BuyerInput, now: string): Outcome {
  const buyer = state.buyers.find((item) => item.id === buyerId)
  if (!buyer) return fail('Buyer not found.')
  const name = clean(input.name, 80)
  if (!name) return fail('Enter the buyer’s name.')
  const next = structuredClone(state)
  const target = next.buyers.find((item) => item.id === buyerId)
  if (!target) return fail('Buyer not found.')
  target.name = name
  target.phone = clean(input.phone, 30)
  target.address = clean(input.address ?? '', 400)
  target.note = clean(input.note, 300)
  target.updatedAt = now
  for (const order of next.orders) {
    if (order.buyerId === buyerId) order.buyerName = name
  }
  return { ok: true, state: next }
}

export function importBuyer(state: State, input: BuyerInput, now: string): Outcome {
  const name = clean(input.name, 80)
  if (!name) return fail('Buyer name is required.')
  const next = structuredClone(state)
  const existing = next.buyers.find((buyer) => buyer.phone && buyer.phone === clean(input.phone, 30))
  if (existing) {
    existing.name = name; existing.address = clean(input.address ?? '', 400); existing.note = clean(input.note, 300); existing.updatedAt = now
  } else {
    next.buyers.push({ id: `buyer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name, phone: clean(input.phone, 30), address: clean(input.address ?? '', 400), note: clean(input.note, 300), createdAt: now, updatedAt: now })
  }
  return { ok: true, state: next }
}

export function createBuyerPurchase(state: State, input: PurchaseInput, now: string) {
  return writePurchase(state, input.buyerId ?? null, null, input, now)
}

export function updatePurchase(
  state: State,
  orderId: string,
  input: PurchaseInput,
  now: string,
): Outcome {
  const order = state.orders.find((item) => item.id === orderId)
  if (!order) return fail('Purchase not found.')
  return writePurchase(state, order.buyerId, orderId, input, now)
}

/** Seller-only: moves an order between placed, delivered, and cancelled, keeping stock in step. */
export function setOrderStatus(state: State, orderId: string, status: OrderStatus, now: string): Outcome {
  const order = state.orders.find((item) => item.id === orderId)
  if (!order) return fail('Purchase not found.')
  if (order.status === status) return { ok: true, state }
  const buyer = state.buyers.find((item) => item.id === order.buyerId)
  return writePurchase(
    state,
    order.buyerId,
    orderId,
    {
      name: order.buyerName,
      phone: buyer?.phone ?? '',
      address: buyer?.address ?? '',
      note: buyer?.note ?? '',
      status,
      paymentMethod: order.paymentMethod,
      paid: order.paid,
      comment: order.comment,
      lines: order.lines.map((line) => ({
        productId: line.productId,
        variantId: line.variantId,
        quantity: line.quantity,
      })),
    },
    now,
  )
}

export function removeBuyer(state: State, buyerId: string, now: string): Outcome {
  const buyer = state.buyers.find((item) => item.id === buyerId)
  if (!buyer) return fail('Buyer not found.')
  let next = state
  for (const order of state.orders.filter((item) => item.buyerId === buyerId)) {
    if (order.status === 'cancelled') continue
    const returned = releaseOrder(next, order, now)
    if (!returned.ok) return returned
    next = returned.state
  }
  const cleared = structuredClone(next)
  cleared.orders = cleared.orders.filter((order) => order.buyerId !== buyerId)
  cleared.buyers = cleared.buyers.filter((item) => item.id !== buyerId)
  return { ok: true, state: cleared }
}

function releaseOrder(state: State, order: CustomerOrder, now: string): Outcome {
  let next = state
  for (const [variantId, held] of heldCounts(order)) {
    const place = findVariant(next, held.productId, variantId)
    if (!place) return fail(`${order.buyerName}'s purchase includes an item that is no longer in the catalog.`)
    const result = moveStock(
      next,
      held.productId,
      variantId,
      place.variant.currentStock + held.paid + held.gift,
      'adjustment',
      `Returned · ${order.buyerName}`,
      now,
    )
    if (!result.ok) return result
    next = result.state
  }
  return { ok: true, state: next }
}

function writePurchase(
  state: State,
  buyerId: string | null,
  orderId: string | null,
  input: PurchaseInput,
  now: string,
): { ok: true; state: State; buyerId: string } | { ok: false; error: string } {
  const parsed = validatePurchase(input)
  if (!parsed.ok) return parsed
  if (buyerId && !state.buyers.some((buyer) => buyer.id === buyerId)) return fail('Buyer not found.')

  const previous = orderId ? state.orders.find((order) => order.id === orderId) ?? null : null
  if (orderId && !previous) return fail('Purchase not found.')
  const previousHeld = heldCounts(previous)

  const lines: OrderLine[] = []
  for (const line of parsed.lines) {
    const place = findVariant(state, line.productId, line.variantId)
    if (!place) return fail('One of the items is no longer in the catalog.')
    const priced = previous?.lines.find(
      (item) => item.productId === line.productId && item.variantId === line.variantId,
    )
    lines.push({
      productId: place.product.id,
      variantId: place.variant.id,
      productName: place.product.name,
      variantName: place.variant.name,
      sku: place.variant.sku,
      quantity: line.quantity,
      unitPrice: priced?.unitPrice ?? place.variant.price,
    })
  }

  const subtotal = orderSubtotal(lines)
  const offer = chooseOffer(state.offers, subtotal, (productId, variantId) =>
    findCatalogItem(state, productId, variantId),
  )
  const total = subtotal - (offer?.kind === 'discount' ? offer.amount : 0)
  if (parsed.paid > total) return fail('Amount received cannot be more than the bill.')

  const nextHeld = new Map<string, { paid: number; gift: number; productId: string; variantId: string; label: string }>()
  if (parsed.status !== 'cancelled') {
    for (const line of lines) {
      nextHeld.set(line.variantId, {
        paid: line.quantity,
        gift: 0,
        productId: line.productId,
        variantId: line.variantId,
        label: `${line.productName} ${line.variantName}`,
      })
    }
    if (offer?.kind === 'gift') {
      for (const gift of offer.items) {
        const current = nextHeld.get(gift.variantId) ?? {
          paid: 0,
          gift: 0,
          productId: gift.productId,
          variantId: gift.variantId,
          label: `${gift.productName} ${gift.variantName}`,
        }
        current.gift += gift.quantity
        nextHeld.set(gift.variantId, current)
      }
    }
  }

  const variantIds = new Set([...previousHeld.keys(), ...nextHeld.keys()])
  let next = state
  for (const variantId of variantIds) {
    const before = previousHeld.get(variantId)
    const after = nextHeld.get(variantId)
    const productId = after?.productId ?? before?.productId ?? ''
    const place = findVariant(next, productId, variantId)
    const paidDelta = (after?.paid ?? 0) - (before?.paid ?? 0)
    const giftDelta = (after?.gift ?? 0) - (before?.gift ?? 0)
    if (!place) {
      if (paidDelta === 0 && giftDelta === 0) continue
      return fail('One of the items is no longer in the catalog.')
    }
    const buyerName = parsed.name
    const changes = [
      paidDelta === 0
        ? null
        : {
            delta: paidDelta,
            type: paidDelta > 0 ? ('sale' as const) : ('adjustment' as const),
            note: paidDelta > 0 ? `Sale · ${buyerName}` : `Returned · ${buyerName}`,
          },
      giftDelta === 0
        ? null
        : {
            delta: giftDelta,
            type: giftDelta > 0 ? ('sale' as const) : ('adjustment' as const),
            note: giftDelta > 0 ? `Gift · ${buyerName}` : `Gift returned · ${buyerName}`,
          },
    ].flatMap((change) => (change ? [change] : []))
    changes.sort((left, right) => left.delta - right.delta)
    for (const change of changes) {
      const current = findVariant(next, productId, variantId)
      if (!current) return fail('One of the items is no longer in the catalog.')
      const result = moveStock(
        next,
        productId,
        variantId,
        current.variant.currentStock - change.delta,
        change.type,
        change.note,
        now,
      )
      if (!result.ok) return result
      next = result.state
    }
  }

  const saved = structuredClone(next)
  const id = buyerId ?? crypto.randomUUID()
  const existingBuyer = saved.buyers.find((buyer) => buyer.id === id)
  if (existingBuyer) {
    existingBuyer.name = parsed.name
    existingBuyer.phone = parsed.phone
    existingBuyer.address = parsed.address
    existingBuyer.note = parsed.note
    existingBuyer.updatedAt = now
  } else {
    const buyer: Buyer = {
      id,
      name: parsed.name,
      phone: parsed.phone,
      address: parsed.address,
      note: parsed.note,
      createdAt: now,
      updatedAt: now,
    }
    saved.buyers.push(buyer)
  }

  const order: CustomerOrder = {
    id: orderId ?? crypto.randomUUID(),
    number: previous?.number ?? nextOrderNumber(saved.orders),
    buyerId: id,
    buyerName: parsed.name,
    status: parsed.status,
    lines,
    subtotal,
    offer,
    total,
    paid: parsed.paid,
    paymentMethod: parsed.paymentMethod,
    comment: parsed.comment,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  }
  const orderIndex = saved.orders.findIndex((item) => item.id === order.id)
  if (orderIndex >= 0) saved.orders[orderIndex] = order
  else saved.orders.unshift(order)
  for (const item of saved.orders) {
    if (item.buyerId === id) item.buyerName = parsed.name
  }
  return { ok: true, state: saved, buyerId: id }
}
