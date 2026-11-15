import { useState, type FormEvent, type ReactNode } from 'react'
import { BoxMath } from './BoxMath'
import { Dialog } from './Dialog'
import { itemsLabel, parseWhole } from '../format'
import { remainingItems } from '../inventory'
import type { PurchaseCalc } from '../purchase'
import { useMarket } from '../store'
import type { Purchase } from '../types'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

function NoteField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Field label="Note">
      <textarea
        value={value}
        maxLength={500}
        placeholder="Optional"
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  )
}

export function SaleDialog({
  productId,
  variantId,
  productName,
  variantName,
  currentStock,
  onClose,
}: {
  productId: string
  variantId: string
  productName: string
  variantName: string
  currentStock: number
  onClose: () => void
}) {
  const { sell } = useMarket()
  const [quantity, setQuantity] = useState('1')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseWhole(quantity)
    if (parsed === null || parsed < 1) {
      setError('Enter how many items were sold.')
      return
    }
    if (parsed > currentStock) {
      setError(
        currentStock === 1
          ? 'Only 1 item is in stock.'
          : `Only ${itemsLabel(currentStock)} are in stock.`,
      )
      return
    }
    const result = sell(productId, variantId, parsed, note)
    if (!result.ok) setError(result.error)
    else onClose()
  }

  return (
    <Dialog title="Record a sale" subtitle={`${productName} · ${variantName}`} onClose={onClose} narrow>
      <form onSubmit={submit}>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <p className="hint">{itemsLabel(currentStock)} currently in stock.</p>
        <Field label="Items sold">
          <input
            autoFocus
            inputMode="numeric"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            onWheel={(event) => event.currentTarget.blur()}
          />
        </Field>
        <NoteField value={note} onChange={setNote} />
        <div className="dialog-actions">
          <button type="button" className="btn secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn">
            Record sale
          </button>
        </div>
      </form>
    </Dialog>
  )
}

export function AdjustDialog({
  productId,
  variantId,
  productName,
  variantName,
  currentStock,
  onClose,
}: {
  productId: string
  variantId: string
  productName: string
  variantName: string
  currentStock: number
  onClose: () => void
}) {
  const { adjust } = useMarket()
  const [stock, setStockValue] = useState(String(currentStock))
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const parsed = parseWhole(stock)
  const delta = parsed === null ? null : parsed - currentStock

  function submit(event: FormEvent) {
    event.preventDefault()
    if (parsed === null) {
      setError('Enter the counted stock.')
      return
    }
    if (parsed === currentStock) {
      onClose()
      return
    }
    const result = adjust(productId, variantId, parsed, note)
    if (!result.ok) setError(result.error)
    else onClose()
  }

  return (
    <Dialog title="Adjust stock" subtitle={`${productName} · ${variantName}`} onClose={onClose} narrow>
      <form onSubmit={submit}>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <Field label="Counted stock">
          <input
            autoFocus
            inputMode="numeric"
            value={stock}
            onChange={(event) => setStockValue(event.target.value)}
            onWheel={(event) => event.currentTarget.blur()}
          />
        </Field>
        <p className="hint">
          {delta === null
            ? 'Enter a whole number of items.'
            : delta === 0
              ? 'Stock stays the same.'
              : delta > 0
                ? `This adds ${itemsLabel(delta)}.`
                : `This removes ${itemsLabel(Math.abs(delta))}.`}
        </p>
        <NoteField value={note} onChange={setNote} />
        <div className="dialog-actions">
          <button type="button" className="btn secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn">
            Save adjustment
          </button>
        </div>
      </form>
    </Dialog>
  )
}

export function ReceiveDialog({
  productId,
  variantId,
  productName,
  variantName,
  onClose,
}: {
  productId: string
  variantId: string
  productName: string
  variantName: string
  onClose: () => void
}) {
  const { receive } = useMarket()
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseWhole(quantity)
    if (parsed === null || parsed < 1) {
      setError('Enter how many items arrived.')
      return
    }
    const result = receive(productId, variantId, parsed, note)
    if (!result.ok) setError(result.error)
    else onClose()
  }

  return (
    <Dialog title="Receive stock" subtitle={`${productName} · ${variantName}`} onClose={onClose} narrow>
      <form onSubmit={submit}>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <p className="hint">Adds items that arrived outside a recorded purchase.</p>
        <Field label="Items received">
          <input
            autoFocus
            inputMode="numeric"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            onWheel={(event) => event.currentTarget.blur()}
          />
        </Field>
        <NoteField value={note} onChange={setNote} />
        <div className="dialog-actions">
          <button type="button" className="btn secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn">
            Add to stock
          </button>
        </div>
      </form>
    </Dialog>
  )
}

export function PurchaseDialog({
  productId,
  variantId,
  productName,
  variantName,
  itemsPerBox,
  calc,
  onClose,
}: {
  productId: string
  variantId: string
  productName: string
  variantName: string
  itemsPerBox: number
  calc: PurchaseCalc
  onClose: () => void
}) {
  const { purchase } = useMarket()
  const [boxes, setBoxes] = useState(String(Math.max(calc.boxes, 1)))
  const [items, setItems] = useState(String(calc.boxes > 0 ? calc.totalItems : itemsPerBox))
  const [itemsTouched, setItemsTouched] = useState(false)
  const [receiveNow, setReceiveNow] = useState(true)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  function changeBoxes(value: string) {
    setBoxes(value)
    const parsed = parseWhole(value)
    if (!itemsTouched && parsed !== null) setItems(String(parsed * itemsPerBox))
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const boxCount = parseWhole(boxes)
    const itemCount = parseWhole(items)
    if (boxCount === null || boxCount < 1) {
      setError('Enter the number of boxes purchased.')
      return
    }
    if (itemCount === null || itemCount < 1) {
      setError('Enter how many items were purchased.')
      return
    }
    const result = purchase({
      productId,
      variantId,
      boxes: boxCount,
      items: itemCount,
      receiveNow,
      note,
    })
    if (!result.ok) setError(result.error)
    else onClose()
  }

  return (
    <Dialog title="Record purchase" subtitle={`${productName} · ${variantName}`} onClose={onClose}>
      <form onSubmit={submit}>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <p className="section-label">Recommended</p>
        <BoxMath calc={calc} />
        {calc.purchaseQty === 0 && (
          <p className="hint">
            Desired stock is not above the current stock. Enter a purchase below, or raise the
            desired level first.
          </p>
        )}
        <div className="fields">
          <Field label="Boxes purchased">
            <input
              autoFocus
              inputMode="numeric"
              value={boxes}
              onChange={(event) => changeBoxes(event.target.value)}
              onWheel={(event) => event.currentTarget.blur()}
            />
          </Field>
          <Field label="Items purchased">
            <input
              inputMode="numeric"
              value={items}
              onChange={(event) => {
                setItemsTouched(true)
                setItems(event.target.value)
              }}
              onWheel={(event) => event.currentTarget.blur()}
            />
          </Field>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={receiveNow}
            onChange={(event) => setReceiveNow(event.target.checked)}
          />
          <span>
            Add these items to stock now
            <small>Leave this off if the order is placed but the boxes have not arrived.</small>
          </span>
        </label>
        <NoteField value={note} onChange={setNote} />
        <div className="dialog-actions">
          <button type="button" className="btn secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn">
            Record purchase
          </button>
        </div>
      </form>
    </Dialog>
  )
}

export function ReceivePurchaseDialog({
  purchase,
  onClose,
}: {
  purchase: Purchase
  onClose: () => void
}) {
  const { receiveOrder } = useMarket()
  const remaining = remainingItems(purchase)
  const [items, setItems] = useState(String(Math.max(remaining, 1)))
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseWhole(items)
    if (parsed === null || parsed < 1) {
      setError('Enter how many items arrived.')
      return
    }
    const result = receiveOrder(purchase.id, parsed, note)
    if (!result.ok) setError(result.error)
    else onClose()
  }

  return (
    <Dialog
      title="Receive delivery"
      subtitle={`${purchase.productName} · ${purchase.variantName}`}
      onClose={onClose}
      narrow
    >
      <form onSubmit={submit}>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <p className="hint">
          {remaining > 0
            ? `${purchase.receivedItems.toLocaleString()} of ${purchase.orderedItems.toLocaleString()} items have been received. ${itemsLabel(remaining)} are still out.`
            : `${purchase.receivedItems.toLocaleString()} of ${purchase.orderedItems.toLocaleString()} items have been received.`}
        </p>
        <Field label="Items arriving now">
          <input
            autoFocus
            inputMode="numeric"
            value={items}
            onChange={(event) => setItems(event.target.value)}
            onWheel={(event) => event.currentTarget.blur()}
          />
        </Field>
        <NoteField value={note} onChange={setNote} />
        <div className="dialog-actions">
          <button type="button" className="btn secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn">
            Add to stock
          </button>
        </div>
      </form>
    </Dialog>
  )
}
