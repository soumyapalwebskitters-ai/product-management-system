import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  createProduct,
  deleteProduct,
  receivePurchase,
  receiveStock,
  recordPurchase,
  recordSale,
  setDesiredStock,
  setStock,
  updateProduct,
  type Outcome,
} from './inventory'
import {
  createBuyerPurchase,
  removeBuyer,
  setOrderStatus,
  updateBuyer,
  updatePurchase,
  withOrderNumbers,
  type PurchaseInput as BuyerPurchaseInput,
} from './orders'
import { deleteOffer, upsertOffer, type OfferInput } from './offers'
import { demoOffers, seedState } from './seed'
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
  ProductInput,
  Purchase,
  PurchaseInput,
  PurchaseStatus,
  RecordedOffer,
  State,
  Variant,
} from './types'
import type { BuyerInput } from './orders'

const STORAGE_KEY = 'market.productManagement.v2'
const LEGACY_KEY = 'market.productManagement.v1'

export type ActionResult = { ok: true } | { ok: false; error: string }

type MarketApi = {
  state: State
  notice: string | null
  dismissNotice: () => void
  addProduct: (input: ProductInput) => ActionResult
  updateProduct: (id: string, input: ProductInput) => ActionResult
  deleteProduct: (id: string) => ActionResult
  setDesired: (productId: string, variantId: string, desired: number) => ActionResult
  sell: (productId: string, variantId: string, quantity: number, note: string) => ActionResult
  adjust: (productId: string, variantId: string, stock: number, note: string) => ActionResult
  receive: (productId: string, variantId: string, quantity: number, note: string) => ActionResult
  purchase: (input: PurchaseInput) => ActionResult
  receiveOrder: (purchaseId: string, items: number, note: string) => ActionResult
  saveBuyerPurchase: (input: BuyerPurchaseInput) => ActionResult & { buyerId?: string }
  editBuyerPurchase: (orderId: string, input: BuyerPurchaseInput) => ActionResult
  setDeliveryStatus: (orderId: string, status: OrderStatus) => ActionResult
  editBuyer: (buyerId: string, input: BuyerInput) => ActionResult
  deleteBuyer: (buyerId: string) => ActionResult
  saveOffer: (input: OfferInput, offerId: string | null) => ActionResult
  removeOffer: (offerId: string) => ActionResult
  resetDemo: () => void
}

const MarketContext = createContext<MarketApi | null>(null)

function isRecord(value: unknown): value is Record<string, unknown> {
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
    isInteger(value.currentStock) &&
    isInteger(value.minimumStock) &&
    isInteger(value.desiredStock)
  )
}

function isProduct(value: unknown): value is Product {
  if (!isRecord(value) || !Array.isArray(value.variants)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string' &&
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

function isCatalog(value: Record<string, unknown>) {
  return (
    Array.isArray(value.products) &&
    value.products.every(isProduct) &&
    Array.isArray(value.purchases) &&
    value.purchases.every(isPurchase) &&
    Array.isArray(value.movements) &&
    value.movements.every(isMovement)
  )
}

function isState(value: unknown): value is State {
  if (!isRecord(value) || !isCatalog(value)) return false
  return (
    Array.isArray(value.buyers) &&
    value.buyers.every(isBuyer) &&
    Array.isArray(value.orders) &&
    value.orders.every(isCustomerOrder) &&
    Array.isArray(value.offers) &&
    value.offers.every(isOffer)
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

function ensureState(state: State): State {
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

function withPrices(state: Pick<State, 'products' | 'purchases' | 'movements'>): State {
  const products = pricedProducts(state.products)
  const giftReady = products.some((product) => product.variants.some((variant) => variant.id === 'var-sp-10'))
  return {
    products,
    purchases: state.purchases,
    movements: state.movements,
    buyers: [],
    orders: [],
    offers: giftReady ? demoOffers() : [],
  }
}

function readStored(key: string): unknown {
  const raw = localStorage.getItem(key)
  if (!raw) return null
  return JSON.parse(raw) as unknown
}

function loadState(): State {
  try {
    const current = readStored(STORAGE_KEY)
    if (isRecord(current) && current.version === 2 && isState(current.state)) return ensureState(current.state)
    const legacy = readStored(LEGACY_KEY)
    if (isRecord(legacy) && legacy.version === 1 && isRecord(legacy.state) && isCatalog(legacy.state)) {
      return withPrices(legacy.state as Pick<State, 'products' | 'purchases' | 'movements'>)
    }
    return seedState()
  } catch {
    return seedState()
  }
}

export function MarketProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(loadState)
  const [notice, setNotice] = useState<string | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, state }))
    } catch {
      // Ignore private-mode and quota failures. The screen still works for this visit.
    }
  }, [state])

  const dismissNotice = useCallback(() => setNotice(null), [])

  const api = useMemo<MarketApi>(() => {
    const now = () => new Date().toISOString()
    function commit(result: Outcome, message: string): ActionResult {
      if (!result.ok) return result
      stateRef.current = result.state
      setState(result.state)
      setNotice(message)
      return { ok: true }
    }

    return {
      state,
      notice,
      dismissNotice,
      addProduct: (input) => commit(createProduct(stateRef.current, input, now()), 'Product added.'),
      updateProduct: (id, input) =>
        commit(updateProduct(stateRef.current, id, input, now()), 'Product updated.'),
      deleteProduct: (id) => commit(deleteProduct(stateRef.current, id), 'Product deleted.'),
      setDesired: (productId, variantId, desired) =>
        commit(
          setDesiredStock(stateRef.current, productId, variantId, desired, now()),
          'Desired stock updated.',
        ),
      sell: (productId, variantId, quantity, note) =>
        commit(recordSale(stateRef.current, productId, variantId, quantity, note, now()), 'Sale recorded.'),
      adjust: (productId, variantId, stock, note) =>
        commit(
          setStock(stateRef.current, productId, variantId, stock, note, now()),
          'Stock adjusted.',
        ),
      receive: (productId, variantId, quantity, note) =>
        commit(
          receiveStock(stateRef.current, productId, variantId, quantity, note, now()),
          'Stock received.',
        ),
      purchase: (input) =>
        commit(
          recordPurchase(stateRef.current, input, now()),
          input.receiveNow ? 'Purchase added to stock.' : 'Purchase recorded. Stock updates when it arrives.',
        ),
      receiveOrder: (purchaseId, items, note) =>
        commit(receivePurchase(stateRef.current, purchaseId, items, note, now()), 'Delivery added to stock.'),
      saveBuyerPurchase: (input) => {
        const result = createBuyerPurchase(stateRef.current, input, now())
        if (!result.ok) return result
        stateRef.current = result.state
        setState(result.state)
        setNotice('Buyer purchase recorded.')
        return { ok: true, buyerId: result.buyerId }
      },
      editBuyerPurchase: (orderId, input) =>
        commit(updatePurchase(stateRef.current, orderId, input, now()), 'Purchase updated.'),
      setDeliveryStatus: (orderId, status) =>
        commit(setOrderStatus(stateRef.current, orderId, status, now()), 'Delivery status updated.'),
      editBuyer: (buyerId, input) =>
        commit(updateBuyer(stateRef.current, buyerId, input, now()), 'Buyer updated.'),
      deleteBuyer: (buyerId) =>
        commit(removeBuyer(stateRef.current, buyerId, now()), 'Buyer removed.'),
      saveOffer: (input, offerId) =>
        commit(upsertOffer(stateRef.current, input, offerId), offerId ? 'Offer updated.' : 'Offer added.'),
      removeOffer: (offerId) => commit(deleteOffer(stateRef.current, offerId), 'Offer removed.'),
      resetDemo: () => {
        const fresh = seedState()
        stateRef.current = fresh
        setState(fresh)
        setNotice('Sample catalog restored.')
      },
    }
  }, [dismissNotice, notice, state])

  return <MarketContext.Provider value={api}>{children}</MarketContext.Provider>
}

export function useMarket() {
  const market = useContext(MarketContext)
  if (!market) throw new Error('useMarket must be used within MarketProvider')
  return market
}
