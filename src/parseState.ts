import { withOrderNumbers } from './orders'
import type {
  Buyer,
  CustomerOrder,
  GiftLine,
  Movement,
  MovementType,
  Offer,
  OrderLine,
  OrderStatus,
  PaymentMethod,
  Product,
  Purchase,
  PurchaseStatus,
  RecordedOffer,
  SellerProfile,
  State,
  Variant,
} from './types'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value)
}

function isVariant(value: unknown): value is Variant {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.sku === 'string' &&
    isInteger(value.itemsPerBox) &&
    (value.price === undefined || isInteger(value.price)) &&
    (value.buyingPrice === undefined || (isInteger(value.buyingPrice) && value.buyingPrice >= 0)) &&
    isInteger(value.currentStock) &&
    isInteger(value.minimumStock) &&
    isInteger(value.desiredStock)
  )
}

const MAX_IMAGE = 1_200_000

function isImage(value: unknown) {
  return (
    value === undefined ||
    (typeof value === 'string' &&
      (value === '' || (value.startsWith('data:image/') && value.length <= MAX_IMAGE)))
  )
}

function isProduct(value: unknown): value is Product {
  if (!isRecord(value) || !Array.isArray(value.variants)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string' &&
    isImage(value.image) &&
    (value.note === undefined || (typeof value.note === 'string' && value.note.length <= 400)) &&
    value.variants.every(isVariant)
  )
}

function isPurchase(value: unknown): value is Purchase {
  if (!isRecord(value)) return false
  const status = value.status
  const validStatus: PurchaseStatus[] = ['ordered', 'partial', 'received']
  return (
    typeof value.id === 'string' &&
    typeof value.productId === 'string' &&
    typeof value.variantId === 'string' &&
    typeof value.productName === 'string' &&
    typeof value.variantName === 'string' &&
    typeof value.sku === 'string' &&
    isInteger(value.itemsPerBox) &&
    isInteger(value.boxes) &&
    isInteger(value.orderedItems) &&
    isInteger(value.receivedItems) &&
    typeof status === 'string' &&
    validStatus.includes(status as PurchaseStatus) &&
    typeof value.note === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  )
}

function isMovement(value: unknown): value is Movement {
  if (!isRecord(value)) return false
  const types: MovementType[] = ['sale', 'adjustment', 'receipt', 'purchase']
  return (
    typeof value.id === 'string' &&
    typeof value.type === 'string' &&
    types.includes(value.type as MovementType) &&
    typeof value.productId === 'string' &&
    typeof value.variantId === 'string' &&
    typeof value.productName === 'string' &&
    typeof value.variantName === 'string' &&
    typeof value.sku === 'string' &&
    isInteger(value.delta) &&
    isInteger(value.previousStock) &&
    isInteger(value.newStock) &&
    typeof value.note === 'string' &&
    typeof value.createdAt === 'string' &&
    (value.purchaseId === undefined || typeof value.purchaseId === 'string')
  )
}

function isBuyer(value: unknown): value is Buyer {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.phone === 'string' &&
    (value.address === undefined || typeof value.address === 'string') &&
    typeof value.note === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  )
}

function isOrderLine(value: unknown): value is OrderLine {
  if (!isRecord(value)) return false
  return (
    typeof value.productId === 'string' &&
    typeof value.variantId === 'string' &&
    typeof value.productName === 'string' &&
    typeof value.variantName === 'string' &&
    typeof value.sku === 'string' &&
    isInteger(value.quantity) &&
    isInteger(value.unitPrice)
  )
}

function isGiftLine(value: unknown): value is GiftLine {
  if (!isRecord(value)) return false
  return (
    typeof value.productId === 'string' &&
    typeof value.variantId === 'string' &&
    typeof value.productName === 'string' &&
    typeof value.variantName === 'string' &&
    typeof value.sku === 'string' &&
    isInteger(value.quantity)
  )
}

function isRecordedOffer(value: unknown): value is RecordedOffer {
  if (!isRecord(value)) return false
  if (value.kind === 'discount') {
    return (
      typeof value.offerId === 'string' &&
      typeof value.offerName === 'string' &&
      isInteger(value.percent) &&
      isInteger(value.amount)
    )
  }
  if (value.kind === 'gift') {
    return (
      typeof value.offerId === 'string' &&
      typeof value.offerName === 'string' &&
      Array.isArray(value.items) &&
      value.items.every(isGiftLine)
    )
  }
  return false
}

function isCustomerOrder(value: unknown): value is CustomerOrder {
  if (!isRecord(value) || !Array.isArray(value.lines)) return false
  const statuses: OrderStatus[] = ['placed', 'delivered', 'cancelled']
  const methods: PaymentMethod[] = ['cash', 'upi', 'card', 'bank']
  return (
    typeof value.id === 'string' &&
    (value.number === undefined || typeof value.number === 'string') &&
    typeof value.buyerId === 'string' &&
    typeof value.buyerName === 'string' &&
    typeof value.status === 'string' &&
    statuses.includes(value.status as OrderStatus) &&
    value.lines.every(isOrderLine) &&
    isInteger(value.subtotal) &&
    (value.offer === null || isRecordedOffer(value.offer)) &&
    isInteger(value.total) &&
    (value.paymentMethod === undefined || methods.includes(value.paymentMethod as PaymentMethod)) &&
    (value.paid === undefined || (isInteger(value.paid) && (value.paid as number) >= 0)) &&
    typeof value.comment === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  )
}

function isOffer(value: unknown): value is Offer {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    isInteger(value.minimumAmount) &&
    (value.reward === 'discount' || value.reward === 'gift') &&
    isInteger(value.percent) &&
    typeof value.productId === 'string' &&
    typeof value.variantId === 'string' &&
    isInteger(value.quantity)
  )
}

export function isCatalog(value: Record<string, unknown>) {
  return (
    Array.isArray(value.products) &&
    value.products.every(isProduct) &&
    Array.isArray(value.purchases) &&
    value.purchases.every(isPurchase) &&
    Array.isArray(value.movements) &&
    value.movements.every(isMovement)
  )
}

function isText(value: unknown, max: number) {
  return typeof value === 'string' && value.length <= max
}

function isSeller(value: unknown): value is SellerProfile {
  if (!isRecord(value)) return false
  return (
    isText(value.name, 80) &&
    isText(value.address, 200) &&
    isText(value.gst, 20) &&
    isText(value.businessName, 80) &&
    isImage(value.profileImage) &&
    isImage(value.logo) &&
    isText(value.facebook, 120) &&
    isText(value.instagram, 120) &&
    isText(value.youtube, 120) &&
    isText(value.whatsapp, 40)
  )
}

export function isState(value: unknown): value is State {
  if (!isRecord(value) || !isCatalog(value)) return false
  return (
    Array.isArray(value.buyers) &&
    value.buyers.every(isBuyer) &&
    Array.isArray(value.orders) &&
    value.orders.every(isCustomerOrder) &&
    Array.isArray(value.offers) &&
    value.offers.every(isOffer) &&
    (value.seller === undefined || isSeller(value.seller))
  )
}

const knownPrices: Record<string, number> = {
  'FP-S': 30,
  'FP-M': 55,
  'FP-L': 90,
  'RK-SS': 20,
  'RK-MS': 80,
  'SP-10': 40,
  'SP-7': 12,
}

function pricedProducts(products: Product[]) {
  return products.map((product) => ({
    ...product,
    variants: product.variants.map((variant) => ({
      ...variant,
      price: variant.price ?? knownPrices[variant.sku] ?? 0,
    })),
  }))
}

export function ensureState(state: State): State {
  return {
    ...state,
    products: pricedProducts(state.products),
    buyers: state.buyers.map((buyer) => ({ ...buyer, address: buyer.address ?? '' })),
    orders: withOrderNumbers(
      state.orders.map((order) => ({
        ...order,
        paymentMethod: order.paymentMethod ?? 'cash',
        paid: order.paid ?? 0,
      })),
    ),
  }
}
