import { useMemo, useState, type FormEvent } from 'react'
import type { SearchMode } from '../search'
import { parseWhole, paymentLabel, rupees } from '../format'
import { chooseOffer, findCatalogItem, nextOffer, orderSubtotal } from '../offers'
import { nextOrderNumber, type PurchaseInput } from '../orders'
import type { ActionResult } from '../store'
import type { CustomerOrder, PaymentMethod, State } from '../types'
import { ProductSelect, type SelectOption } from './ProductSelect'

type LineDraft = {
  key: string
  productId: string
  variantId: string
  quantity: string
}

const paymentOptions: PaymentMethod[] = ['cash', 'upi', 'card', 'bank']

export function PurchaseForm({
  state,
  order,
  buyer,
  onSubmit,
  onCancel,
}: {
  state: State
  order?: CustomerOrder
  buyer?: { name: string; phone: string; address?: string; note: string }
  onSubmit: (input: PurchaseInput) => ActionResult
  onCancel: () => void
}) {
  const [name, setName] = useState(order?.buyerName ?? buyer?.name ?? '')
  const [phone, setPhone] = useState(buyer?.phone ?? '')
  const [address, setAddress] = useState(buyer?.address ?? '')
  const [note, setNote] = useState(buyer?.note ?? '')
  const [comment, setComment] = useState(order?.comment ?? '')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(order?.paymentMethod ?? 'cash')
  const [received, setReceived] = useState(order ? String(order.paid) : '0')
  const [lines, setLines] = useState<LineDraft[]>(
    order
      ? order.lines.map((line) => ({
          key: `${line.productId}:${line.variantId}`,
          productId: line.productId,
          variantId: line.variantId,
          quantity: String(line.quantity),
        }))
      : [],
  )
  const [query, setQuery] = useState('')
  const [searchMode, setSearchMode] = useState<SearchMode>('smart')
  const [error, setError] = useState<string | null>(null)
  const locked = buyer !== undefined || order !== undefined

  const options = useMemo<SelectOption[]>(
    () =>
      state.products.flatMap((product) =>
        product.variants.map((variant) => ({
          id: `${product.id}:${variant.id}`,
          title: `${product.name} · ${variant.name}`,
          meta: rupees(variant.price),
          searchText: `${product.name} ${variant.name} ${variant.sku}`,
        })),
      ),
    [state.products],
  )

  const preview = useMemo(() => {
    const priced = lines.flatMap((line) => {
      const quantity = parseWhole(line.quantity)
      const place = findCatalogItem(state, line.productId, line.variantId)
      const variant = state.products
        .find((product) => product.id === line.productId)
        ?.variants.find((item) => item.id === line.variantId)
      if (!place || quantity === null || !variant) return []
      const previous = order?.lines.find((item) => item.variantId === line.variantId)
      return [
        {
          productId: line.productId,
          variantId: line.variantId,
          quantity,
          unitPrice: previous?.unitPrice ?? variant.price,
          label: place,
        },
      ]
    })
    const subtotal = orderSubtotal(priced)
    const offer = chooseOffer(state.offers, subtotal, (productId, variantId) =>
      findCatalogItem(state, productId, variantId),
    )
    return { priced, subtotal, offer, upcoming: nextOffer(state.offers, subtotal) }
  }, [lines, order?.lines, state])

  function addLine(id: string | null) {
    if (!id) return
    const [productId, variantId] = id.split(':')
    if (!productId || !variantId) return
    setLines((current) => {
      if (current.some((line) => line.variantId === variantId)) return current
      return [...current, { key: id, productId, variantId, quantity: '1' }]
    })
    setQuery('')
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = lines.map((line) => ({
      productId: line.productId,
      variantId: line.variantId,
      quantity: parseWhole(line.quantity) ?? -1,
    }))
    const paid = received.trim() === '' ? 0 : parseWhole(received)
    if (paid === null) {
      setError('Enter the amount received as a whole number of rupees.')
      return
    }
    const result = onSubmit({
      name,
      phone,
      address,
      note,
      status: order?.status ?? 'placed',
      paymentMethod,
      paid,
      comment,
      lines: parsed,
    })
    if (!result.ok) setError(result.error)
  }

  const discount = preview.offer?.kind === 'discount' ? preview.offer : null
  const gift = preview.offer?.kind === 'gift' ? preview.offer : null

  return (
    <form onSubmit={submit}>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {!locked && (
        <p className="order-id-line">
          <span>Order id</span>
          <strong>{nextOrderNumber(state.orders)}</strong>
        </p>
      )}
      {!locked && (
        <div className="fields">
          <label className="field">
            <span>Buyer name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Meera Iyer" />
          </label>
          <label className="field">
            <span>Phone</span>
            <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Optional" />
          </label>
        </div>
      )}
      {locked && <p className="lede">Buying for {name}.</p>}
      {!locked && (
        <label className="field">
          <span>Address</span>
          <textarea
            value={address}
            rows={3}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="Street, area, city"
          />
        </label>
      )}
      {!locked && (
        <label className="field">
          <span>Note about this buyer</span>
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional" />
        </label>
      )}

      <div className="field">
        <span>Add an item</span>
        <ProductSelect
          label="Item to buy"
          placeholder="Search the catalog"
          options={options}
          query={query}
          mode={searchMode}
          selectedId={null}
          onQueryChange={setQuery}
          onModeChange={setSearchMode}
          onSelect={addLine}
          inline
        />
      </div>

      {lines.length === 0 ? (
        <p className="hint">Choose an item. Typing a letter lists every matching name.</p>
      ) : (
        <ul className="line-list">
          {lines.map((line) => {
            const place = findCatalogItem(state, line.productId, line.variantId)
            const priced = preview.priced.find((item) => item.variantId === line.variantId)
            return (
              <li key={line.key}>
                <div>
                  <strong>{place ? `${place.productName} · ${place.variantName}` : 'Removed item'}</strong>
                  <span>{priced ? rupees(priced.unitPrice) : ''} each</span>
                </div>
                <label>
                  <span className="sr-only">Quantity</span>
                  <input
                    inputMode="numeric"
                    value={line.quantity}
                    onChange={(event) =>
                      setLines((current) =>
                        current.map((item) =>
                          item.key === line.key ? { ...item, quantity: event.target.value } : item,
                        ),
                      )
                    }
                  />
                </label>
                <button
                  type="button"
                  className="btn danger-text small"
                  onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                >
                  Remove
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div className="offer-preview">
        <p>
          Bill {rupees(preview.subtotal)}
          {discount ? ` · special discount ${rupees(discount.amount)} (${discount.percent}%)` : ''}
          {discount ? ` · to pay ${rupees(preview.subtotal - discount.amount)}` : ''}
        </p>
        {gift && (
          <p>
            Gift items: {gift.items.map((item) => `${item.quantity} × ${item.productName} ${item.variantName}`).join(', ')}.
            No cash discount on this bill.
          </p>
        )}
        {discount && <p>No gift items on this bill.</p>}
        {!preview.offer && preview.upcoming && (
          <p>
            {rupees(preview.upcoming.minimumAmount - preview.subtotal)} more reaches {preview.upcoming.name}.
          </p>
        )}
        {!preview.offer && !preview.upcoming && preview.priced.length > 0 && <p>No offer applies to this bill.</p>}
      </div>

      <div className="filters" role="group" aria-label="Payment method">
        {paymentOptions.map((method) => (
          <button
            key={method}
            type="button"
            className="chip"
            aria-pressed={paymentMethod === method}
            onClick={() => setPaymentMethod(method)}
          >
            {paymentLabel(method)}
          </button>
        ))}
      </div>
      <label className="field">
        <span>Amount received ₹</span>
        <input
          inputMode="numeric"
          value={received}
          onChange={(event) => setReceived(event.target.value)}
          placeholder="0"
        />
      </label>
      <p className="hint">Leave 0 when the full bill is still due. A part payment on a new order is an advance.</p>
      <label className="field">
        <span>Comments</span>
        <textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Optional" />
      </label>
      <div className="dialog-actions">
        <button type="button" className="btn secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn">
          {order ? 'Save purchase' : 'Record purchase'}
        </button>
      </div>
    </form>
  )
}
