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
  importBuyer,
  removeBuyer,
  setOrderStatus,
  updateBuyer,
  updatePurchase,
  type PurchaseInput as BuyerPurchaseInput,
} from './orders'
import { deleteOffer, upsertOffer, type OfferInput } from './offers'
import { ensureState, isCatalog, isRecord, isState } from './parseState'
import { demoOffers, seedState } from './seed'
import { updateSeller } from './seller'
import type { OrderStatus, ProductInput, PurchaseInput, SellerProfile, State } from './types'
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
  saveSeller: (input: SellerProfile) => ActionResult
  importBuyer: (input: BuyerInput) => ActionResult
  resetDemo: () => void
}

type ShopPayload = { revision: number; state: State; fresh: boolean }

type SaveResult =
  | { ok: true; revision: number }
  | { ok: false; conflict: ShopPayload }
  | { ok: false; error: string }

const MarketContext = createContext<MarketApi | null>(null)

function readStored(key: string): unknown {
  const raw = localStorage.getItem(key)
  if (!raw) return null
  return JSON.parse(raw) as unknown
}

function withPrices(state: Pick<State, 'products' | 'purchases' | 'movements'>): State {
  const giftReady = state.products.some((product) => product.variants.some((variant) => variant.id === 'var-sp-10'))
  return ensureState({
    products: state.products,
    purchases: state.purchases,
    movements: state.movements,
    buyers: [],
    orders: [],
    offers: giftReady ? demoOffers() : [],
  })
}

function readBrowserState(): State | null {
  try {
    const current = readStored(STORAGE_KEY)
    if (isRecord(current) && current.version === 2 && isState(current.state)) return ensureState(current.state)
    const legacy = readStored(LEGACY_KEY)
    if (isRecord(legacy) && legacy.version === 1 && isRecord(legacy.state) && isCatalog(legacy.state)) {
      return withPrices(legacy.state as Pick<State, 'products' | 'purchases' | 'movements'>)
    }
    return null
  } catch {
    return null
  }
}

function parsePayload(value: unknown): ShopPayload | null {
  if (!isRecord(value) || typeof value.revision !== 'number' || !Number.isInteger(value.revision)) return null
  if (!isState(value.state)) return null
  return { revision: value.revision, state: value.state, fresh: value.fresh === true }
}

async function errorMessage(body: unknown, fallback: string) {
  if (isRecord(body) && typeof body.error === 'string') return body.error
  return fallback
}

async function saveShop(revision: number, state: State): Promise<SaveResult> {
  let response: Response
  try {
    response = await fetch('/api/state', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ revision, state }),
      cache: 'no-store',
    })
  } catch {
    return { ok: false, error: 'Could not reach the shop database.' }
  }
  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    body = null
  }
  if (response.status === 409) {
    const conflict = parsePayload(body)
    if (!conflict) return { ok: false, error: 'The shop changed, and the latest copy could not be read.' }
    return { ok: false, conflict }
  }
  if (!response.ok) return { ok: false, error: await errorMessage(body, 'Could not save to D1.') }
  if (!isRecord(body) || typeof body.revision !== 'number' || !Number.isInteger(body.revision)) {
    return { ok: false, error: 'D1 saved, but the reply was not valid.' }
  }
  return { ok: true, revision: body.revision }
}

let shopLoad: Promise<{ state: State; revision: number }> | null = null

function loadShop() {
  shopLoad ??= fetchShop().catch((error: unknown) => {
    shopLoad = null
    throw error
  })
  return shopLoad
}

async function fetchShop() {
  let response: Response
  try {
    response = await fetch('/api/state', { cache: 'no-store' })
  } catch {
    throw new Error('Could not reach the shop database.')
  }
  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    body = null
  }
  if (!response.ok) throw new Error(await errorMessage(body, 'Could not load the shop from D1.'))
  const payload = parsePayload(body)
  if (!payload) throw new Error('The shop data was not valid.')
  if (!payload.fresh) return { state: ensureState(payload.state), revision: payload.revision }

  const local = readBrowserState()
  const next = local ?? ensureState(payload.state)
  const saved = await saveShop(0, next)
  if (!saved.ok) {
    if ('conflict' in saved) return { state: ensureState(saved.conflict.state), revision: saved.conflict.revision }
    throw new Error(saved.error)
  }
  if (local) {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(LEGACY_KEY)
  }
  return { state: next, revision: saved.revision }
}

function Boot({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="boot" data-testid="boot">
      <p className="wordmark">Market</p>
      <h1>{title}</h1>
      <p>{body}</p>
      {action && (
        <button type="button" className="btn secondary" data-testid="boot-retry" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  )
}

export function MarketProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [bootError, setBootError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const stateRef = useRef<State | null>(null)
  const revisionRef = useRef(0)
  const generationRef = useRef(0)
  const chainRef = useRef(Promise.resolve())

  const dismissNotice = useCallback(() => setNotice(null), [])

  useEffect(() => {
    let cancelled = false
    loadShop()
      .then((loaded) => {
        if (cancelled) return
        stateRef.current = loaded.state
        revisionRef.current = loaded.revision
        setState(loaded.state)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setBootError(error instanceof Error ? error.message : 'Could not load the shop.')
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  const persist = useCallback((next: State) => {
    const generation = generationRef.current
    chainRef.current = chainRef.current
      .catch(() => undefined)
      .then(async () => {
        if (generation !== generationRef.current) return
        let result = await saveShop(revisionRef.current, next)
        if (generation !== generationRef.current) return
        if (!result.ok && !('conflict' in result)) result = await saveShop(revisionRef.current, next)
        if (generation !== generationRef.current) return
        if (result.ok) {
          revisionRef.current = result.revision
          return
        }
        if ('conflict' in result) {
          generationRef.current += 1
          revisionRef.current = result.conflict.revision
          const latest = ensureState(result.conflict.state)
          stateRef.current = latest
          setState(latest)
          setNotice('The shop was saved somewhere else. Loaded the latest copy.')
          return
        }
        setNotice(result.error)
      })
  }, [])

  const api = useMemo<MarketApi | null>(() => {
    if (!state) return null
    const now = () => new Date().toISOString()
    function commit(result: Outcome, message: string): ActionResult {
      if (!result.ok) return result
      stateRef.current = result.state
      setState(result.state)
      setNotice(message)
      persist(result.state)
      return { ok: true }
    }

    return {
      state,
      notice,
      dismissNotice,
      addProduct: (input) => commit(createProduct(stateRef.current ?? state, input, now()), 'Product added.'),
      updateProduct: (id, input) =>
        commit(updateProduct(stateRef.current ?? state, id, input, now()), 'Product updated.'),
      deleteProduct: (id) => commit(deleteProduct(stateRef.current ?? state, id), 'Product deleted.'),
      setDesired: (productId, variantId, desired) =>
        commit(
          setDesiredStock(stateRef.current ?? state, productId, variantId, desired, now()),
          'Desired stock updated.',
        ),
      sell: (productId, variantId, quantity, note) =>
        commit(recordSale(stateRef.current ?? state, productId, variantId, quantity, note, now()), 'Sale recorded.'),
      adjust: (productId, variantId, stock, note) =>
        commit(setStock(stateRef.current ?? state, productId, variantId, stock, note, now()), 'Stock adjusted.'),
      receive: (productId, variantId, quantity, note) =>
        commit(
          receiveStock(stateRef.current ?? state, productId, variantId, quantity, note, now()),
          'Stock received.',
        ),
      purchase: (input) =>
        commit(
          recordPurchase(stateRef.current ?? state, input, now()),
          input.receiveNow ? 'Purchase added to stock.' : 'Purchase recorded. Stock updates when it arrives.',
        ),
      receiveOrder: (purchaseId, items, note) =>
        commit(receivePurchase(stateRef.current ?? state, purchaseId, items, note, now()), 'Delivery added to stock.'),
      saveBuyerPurchase: (input) => {
        const result = createBuyerPurchase(stateRef.current ?? state, input, now())
        if (!result.ok) return result
        stateRef.current = result.state
        setState(result.state)
        setNotice('Buyer purchase recorded.')
        persist(result.state)
        return { ok: true, buyerId: result.buyerId }
      },
      editBuyerPurchase: (orderId, input) =>
        commit(updatePurchase(stateRef.current ?? state, orderId, input, now()), 'Purchase updated.'),
      setDeliveryStatus: (orderId, status) =>
        commit(setOrderStatus(stateRef.current ?? state, orderId, status, now()), 'Delivery status updated.'),
      editBuyer: (buyerId, input) =>
        commit(updateBuyer(stateRef.current ?? state, buyerId, input, now()), 'Buyer updated.'),
      deleteBuyer: (buyerId) => commit(removeBuyer(stateRef.current ?? state, buyerId, now()), 'Buyer removed.'),
      saveOffer: (input, offerId) =>
        commit(upsertOffer(stateRef.current ?? state, input, offerId), offerId ? 'Offer updated.' : 'Offer added.'),
      removeOffer: (offerId) => commit(deleteOffer(stateRef.current ?? state, offerId), 'Offer removed.'),
      saveSeller: (input) => commit(updateSeller(stateRef.current ?? state, input), 'Seller info saved.'),
      importBuyer: (input) => commit(importBuyer(stateRef.current ?? state, input, now()), 'Buyer imported.'),
      resetDemo: () => {
        const fresh = seedState()
        const seller = stateRef.current?.seller
        if (seller) fresh.seller = seller
        stateRef.current = fresh
        setState(fresh)
        setNotice('Sample catalog restored.')
        persist(fresh)
      },
    }
  }, [dismissNotice, notice, persist, state])

  if (bootError) {
    return (
      <Boot
        title="Could not open the shop"
        body={bootError}
        action={{
          label: 'Try again',
          onClick: () => {
            shopLoad = null
            setBootError(null)
            setAttempt((value) => value + 1)
          },
        }}
      />
    )
  }
  if (!api) return <Boot title="Loading the shop" body="Opening the catalog from D1." />
  return <MarketContext.Provider value={api}>{children}</MarketContext.Provider>
}

export function useMarket() {
  const market = useContext(MarketContext)
  if (!market) throw new Error('useMarket must be used within MarketProvider')
  return market
}
