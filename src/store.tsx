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
import { ensureState, isRecord, isState } from './parseState'
import { updateSeller } from './seller'
import { openMailto } from './mailto'
import type { CustomerOrder, OrderStatus, ProductInput, PurchaseInput, SellerProfile, State } from './types'
import type { BuyerInput } from './orders'

export type ActionResult = { ok: true } | { ok: false; error: string }
export const DUPLICATE_DATA_ERROR = 'Duplicate data found.'

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
}

type ShopPayload = { revision: number; state: State; fresh: boolean }

type SaveResult =
  | { ok: true; revision: number }
  | { ok: false; conflict: ShopPayload }
  | { ok: false; error: string }

const MarketContext = createContext<MarketApi | null>(null)

function emptyShop(): State {
  return {
    products: [],
    purchases: [],
    movements: [],
    buyers: [],
    orders: [],
    offers: [],
  }
}

function openOrderMail(state: State, order: CustomerOrder, event: 'placed' | 'delivered') {
  const label = event === 'placed' ? 'Order placed' : 'Order delivered'
  const lines = order.lines.map((line) => `• ${line.productName} · ${line.variantName}: ${line.quantity} × ₹${line.unitPrice}`).join('\n')
  const gifts = order.offer?.kind === 'gift' ? `\nFree gifts:\n${order.offer.items.map((item) => `• ${item.productName} · ${item.variantName}: ${item.quantity}`).join('\n')}` : ''
  const body = [`${label}: ${order.number}`, '', `Buyer: ${order.buyerName}`, '', 'Items:', lines || 'No items', gifts, '', `Total: ₹${order.total}`, `Paid: ₹${order.paid}`, `Payment: ${order.paymentMethod}`, order.comment ? `Note: ${order.comment}` : ''].filter(Boolean).join('\n')
  return openMailto(state.seller?.email, `${state.seller?.businessName || 'Baji Market'}: ${label} ${order.number}`, body)
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

  const next = emptyShop()
  const saved = await saveShop(0, next)
  if (!saved.ok) {
    if ('conflict' in saved) return { state: ensureState(saved.conflict.state), revision: saved.conflict.revision }
    throw new Error(saved.error)
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
      <p className="wordmark">Baji Market</p>
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

function DuplicateDataToast({ onDismiss }: { onDismiss: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 5_000)
    return () => window.clearTimeout(timer)
  }, [onDismiss])

  return (
    <div className="duplicate-toast" role="alert" aria-live="assertive">
      <div className="duplicate-toast-copy">
        <strong>Duplicate data found</strong>
        <span>This entry already exists.</span>
      </div>
      <button type="button" aria-label="Dismiss duplicate data message" onClick={onDismiss}>×</button>
      <span className="duplicate-toast-progress" aria-hidden="true" />
    </div>
  )
}

function SavingOverlay() {
  return (
    <div className="saving-overlay" role="status" aria-live="assertive" aria-label="Saving data">
      <div className="saving-dialog">
        <span className="spinner" aria-hidden="true" />
        <strong>Saving data</strong>
        <span>Your changes are being saved.</span>
      </div>
    </div>
  )
}

export function MarketProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [duplicateNotice, setDuplicateNotice] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [bootError, setBootError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const stateRef = useRef<State | null>(null)
  const revisionRef = useRef(0)
  const generationRef = useRef(0)
  const chainRef = useRef(Promise.resolve())
  const pendingSavesRef = useRef(0)

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
    pendingSavesRef.current += 1
    setSaving(true)
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
      .finally(() => {
        pendingSavesRef.current = Math.max(0, pendingSavesRef.current - 1)
        if (pendingSavesRef.current === 0) setSaving(false)
      })
  }, [])

  const api = useMemo<MarketApi | null>(() => {
    if (!state) return null
    const now = () => new Date().toISOString()
    function commit(result: Outcome, message: string): ActionResult {
      if (!result.ok) {
        if (result.error === DUPLICATE_DATA_ERROR) setDuplicateNotice(Date.now())
        return result
      }
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
        if (!result.ok) {
          if (result.error === DUPLICATE_DATA_ERROR) setDuplicateNotice(Date.now())
          return result
        }
        stateRef.current = result.state
        setState(result.state)
        const order = result.state.orders.find((item) => item.id === result.state.orders[0]?.id)
        const emailOpened = order ? openOrderMail(result.state, order, 'placed') : false
        setNotice(emailOpened ? 'Order placed. A seller email draft has opened.' : 'Order placed. Add a seller email to open an email draft.')
        persist(result.state)
        return { ok: true, buyerId: result.buyerId }
      },
      editBuyerPurchase: (orderId, input) =>
        commit(updatePurchase(stateRef.current ?? state, orderId, input, now()), 'Purchase updated.'),
      setDeliveryStatus: (orderId, status) => {
        const result = setOrderStatus(stateRef.current ?? state, orderId, status, now())
        const action = commit(result, status === 'delivered' ? 'Order delivered.' : 'Delivery status updated.')
        if (result.ok && status === 'delivered') {
          const order = result.state.orders.find((item) => item.id === orderId)
          const emailOpened = order ? openOrderMail(result.state, order, 'delivered') : false
          if (emailOpened) setNotice('Order delivered. A seller email draft has opened.')
        }
        return action
      },
      editBuyer: (buyerId, input) =>
        commit(updateBuyer(stateRef.current ?? state, buyerId, input, now()), 'Buyer updated.'),
      deleteBuyer: (buyerId) => commit(removeBuyer(stateRef.current ?? state, buyerId, now()), 'Buyer removed.'),
      saveOffer: (input, offerId) =>
        commit(upsertOffer(stateRef.current ?? state, input, offerId), offerId ? 'Offer updated.' : 'Offer added.'),
      removeOffer: (offerId) => commit(deleteOffer(stateRef.current ?? state, offerId), 'Offer removed.'),
      saveSeller: (input) => commit(updateSeller(stateRef.current ?? state, input), 'Seller info saved.'),
      importBuyer: (input) => commit(importBuyer(stateRef.current ?? state, input, now()), 'Buyer imported.'),
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
  return (
    <MarketContext.Provider value={api}>
      {children}
      {saving && <SavingOverlay />}
      {duplicateNotice !== null && <DuplicateDataToast key={duplicateNotice} onDismiss={() => setDuplicateNotice(null)} />}
    </MarketContext.Provider>
  )
}

export function useMarket() {
  const market = useContext(MarketContext)
  if (!market) throw new Error('useMarket must be used within MarketProvider')
  return market
}
