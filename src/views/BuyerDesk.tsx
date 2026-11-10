import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { ConfirmDialog, Dialog } from '../components/Dialog'
import { PurchaseForm } from '../components/PurchaseForm'
import { OrderPill, PaidTick } from '../components/Status'
import { formatDay, paymentLabel, rupees } from '../format'
import { buyerPayment, orderDue, paymentStandingLabel } from '../paymentStatus'
import { matchesQuery } from '../search'
import { useMarket } from '../store'
import type { Buyer, CustomerOrder, State } from '../types'
import { OrderCard } from './SalesView'

export function BuyerDesk({
  buyerId,
  onOpenBuyer,
}: {
  buyerId: string | null
  onOpenBuyer: (buyerId: string | null) => void
}) {
  const market = useMarket()
  const buyer = market.state.buyers.find((item) => item.id === buyerId) ?? null
  const [creating, setCreating] = useState(false)
  const [buying, setBuying] = useState(false)
  const [editingBuyer, setEditingBuyer] = useState(false)
  const [editingOrder, setEditingOrder] = useState<CustomerOrder | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Buyer | null>(null)
  const [query, setQuery] = useState('')
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [filterBy, setFilterBy] = useState<'name' | 'date'>('name')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [layout, setLayout] = useState<'grid' | 'list'>('grid')
  const [previewId, setPreviewId] = useState<string | null>(null)

  if (!buyer) {
    const buyers = [...market.state.buyers].sort((left, right) => {
      const byDate = latestPurchaseAt(market.state, right.id).localeCompare(latestPurchaseAt(market.state, left.id))
      return byDate || left.name.localeCompare(right.name)
    })
    const needle = query.trim()
    const matches = buyers.filter((item) =>
      matchesQuery(`${item.name} ${item.phone} ${item.address}`, needle, 'smart'),
    )
    const onDate = buyers.filter((item) =>
      ordersFor(market.state, item.id).some((order) => dayKey(order.createdAt) === purchaseDate),
    )
    const visible =
      filterBy === 'date'
        ? purchaseDate
          ? onDate
          : buyers
        : pickedId
          ? buyers.filter((item) => item.id === pickedId)
          : matches
    const preview = buyers.find((item) => item.id === previewId) ?? null
    return (
      <section data-testid="view-buyers">
        <div className="page-head">
          <div>
            <h2>
              Buyers{' '}
              <span className="buyer-count" data-testid="buyer-count">
                {visible.length === buyers.length
                  ? `${buyers.length} ${buyers.length === 1 ? 'buyer' : 'buyers'}`
                  : `${visible.length} of ${buyers.length} buyers`}
              </span>
            </h2>
            <p className="lede">
              Every buyer is listed here. Filter by name or by purchase date, then open a card for the full purchase.
            </p>
          </div>
          <button type="button" className="btn" onClick={() => setCreating(true)}>
            Add buyer
          </button>
        </div>
        <div className="buyer-toolbar">
          <div className="filters" role="group" aria-label="Filter buyers by">
            <button
              type="button"
              className="chip"
              aria-pressed={filterBy === 'name'}
              onClick={() => setFilterBy('name')}
            >
              Name
            </button>
            <button
              type="button"
              className="chip"
              aria-pressed={filterBy === 'date'}
              onClick={() => setFilterBy('date')}
            >
              Date
            </button>
          </div>
          {filterBy === 'name' ? (
            <BuyerSearch
              buyers={buyers}
              query={query}
              onQueryChange={(value) => {
                setQuery(value)
                setPickedId(null)
              }}
              onPick={(item) => {
                setQuery(item.name)
                setPickedId(item.id)
              }}
            />
          ) : (
            <label className="buyer-search">
              <span className="sr-only">Purchase date</span>
              <input
                type="date"
                value={purchaseDate}
                data-testid="buyer-date"
                onChange={(event) => setPurchaseDate(event.target.value)}
              />
            </label>
          )}
          <div className="filters" role="group" aria-label="Buyer layout">
            <button
              type="button"
              className="chip icon"
              aria-pressed={layout === 'grid'}
              aria-label="Grid"
              title="Grid"
              onClick={() => setLayout('grid')}
            >
              <GridIcon />
            </button>
            <button
              type="button"
              className="chip icon"
              aria-pressed={layout === 'list'}
              aria-label="List"
              title="List"
              onClick={() => setLayout('list')}
            >
              <ListIcon />
            </button>
          </div>
        </div>
        {buyers.length === 0 ? (
          <div className="empty">
            <h3>No buyers yet</h3>
            <p>Add a buyer and the items they are purchasing.</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="empty">
            <h3>No buyers match</h3>
            <p>
              {filterBy === 'date'
                ? 'No buyer has a purchase on this date.'
                : 'Try another letter from the name or phone number.'}
            </p>
          </div>
        ) : (
          <div className={layout === 'list' ? 'buyer-grid list' : 'buyer-grid'}>
            {visible.map((item) => (
              <BuyerTile
                key={item.id}
                buyer={item}
                orders={ordersFor(market.state, item.id)}
                onOpen={() => setPreviewId(item.id)}
              />
            ))}
          </div>
        )}
        {preview && (
          <Dialog title={preview.name} subtitle={previewPlace(preview)} wide onClose={() => setPreviewId(null)}>
            <BuyerDetails buyer={preview} orders={ordersFor(market.state, preview.id)} />
            <div className="dialog-actions">
              <button type="button" className="btn secondary" onClick={() => setPreviewId(null)}>
                Close
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  const id = preview.id
                  setPreviewId(null)
                  onOpenBuyer(id)
                }}
              >
                Open buyer
              </button>
            </div>
          </Dialog>
        )}
        {creating && (
          <Dialog title="Add buyer" subtitle="Name the buyer and record what they are buying." wide closeOnBackdrop={false} onClose={() => setCreating(false)}>
            <PurchaseForm
              state={market.state}
              onCancel={() => setCreating(false)}
              onSubmit={(input) => {
                const result = market.saveBuyerPurchase(input)
                if (result.ok) {
                  setCreating(false)
                  if (result.buyerId) onOpenBuyer(result.buyerId)
                }
                return result
              }}
            />
          </Dialog>
        )}
      </section>
    )
  }

  const orders = market.state.orders
    .filter((order) => order.buyerId === buyer.id)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))

  return (
    <section data-testid="view-buyer">
      <div className="page-head">
        <div>
          <h2>{buyer.name}</h2>
          <p className="lede">
            {[buyer.phone, buyer.address, buyer.note].filter(Boolean).join(' · ') || 'No phone, address, or note yet.'}
          </p>
          <p className="lede">
            Purchases show whether they were delivered, placed but not shipped, or cancelled, plus any discount,
            gift, and comments.
          </p>
        </div>
        <div className="row-actions">
          <button type="button" className="btn secondary" onClick={() => setEditingBuyer(true)}>
            Edit buyer
          </button>
          <button type="button" className="btn" onClick={() => setBuying(true)}>
            Add purchase
          </button>
        </div>
      </div>
      {orders.length === 0 ? (
        <div className="empty">
          <h3>No purchases yet</h3>
          <p>Record the items this buyer is taking.</p>
        </div>
      ) : (
        <div className="order-list">
          {orders.map((order) => (
            <div key={order.id} className="order-wrap">
              <OrderCard order={order} />
              <button type="button" className="btn secondary small" onClick={() => setEditingOrder(order)}>
                Edit purchase
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="footer-actions">
        <button type="button" className="btn danger-text small" onClick={() => setPendingDelete(buyer)}>
          Remove buyer
        </button>
      </div>

      {buying && (
        <Dialog title="Add purchase" subtitle={buyer.name} wide closeOnBackdrop={false} onClose={() => setBuying(false)}>
          <PurchaseForm
            state={market.state}
            buyer={buyer}
            onCancel={() => setBuying(false)}
            onSubmit={(input) => {
              const result = market.saveBuyerPurchase({
                ...input,
                buyerId: buyer.id,
                name: buyer.name,
                phone: buyer.phone,
                address: buyer.address,
                note: buyer.note,
              })
              if (result.ok) setBuying(false)
              return result
            }}
          />
        </Dialog>
      )}
      {editingOrder && (
        <Dialog
          title="Edit purchase"
          subtitle={buyer.name}
          wide
          closeOnBackdrop={false}
          onClose={() => setEditingOrder(null)}
        >
          <PurchaseForm
            state={market.state}
            buyer={buyer}
            order={editingOrder}
            onCancel={() => setEditingOrder(null)}
            onSubmit={(input) => {
              const result = market.editBuyerPurchase(editingOrder.id, {
                ...input,
                name: buyer.name,
                phone: buyer.phone,
                address: buyer.address,
                note: buyer.note,
              })
              if (result.ok) setEditingOrder(null)
              return result
            }}
          />
        </Dialog>
      )}
      {editingBuyer && (
        <Dialog title="Edit buyer" narrow onClose={() => setEditingBuyer(false)}>
          <BuyerProfileForm
            buyer={buyer}
            onCancel={() => setEditingBuyer(false)}
            onSubmit={(name, phone, address, note) => {
              const result = market.editBuyer(buyer.id, { name, phone, address, note })
              if (result.ok) setEditingBuyer(false)
              return result
            }}
          />
        </Dialog>
      )}
      {pendingDelete && (
        <ConfirmDialog
          title={`Remove ${pendingDelete.name}?`}
          body="Their purchases are removed."
          confirmLabel="Remove buyer"
          danger
          onClose={() => setPendingDelete(null)}
          onConfirm={() => {
            market.deleteBuyer(pendingDelete.id)
            setPendingDelete(null)
            onOpenBuyer(null)
          }}
        />
      )}
    </section>
  )
}

function dayKey(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function latestPurchaseAt(state: State, buyerId: string) {
  return ordersFor(state, buyerId)[0]?.createdAt ?? ''
}

function ordersFor(state: State, buyerId: string) {
  return state.orders
    .filter((order) => order.buyerId === buyerId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

function billOf(orders: CustomerOrder[]) {
  const active = orders.filter((order) => order.status !== 'cancelled')
  const source = active.length > 0 ? active : orders
  return source.reduce((sum, order) => sum + order.total, 0)
}

function BuyerTile({
  buyer,
  orders,
  onOpen,
}: {
  buyer: Buyer
  orders: CustomerOrder[]
  onOpen: () => void
}) {
  const latest = orders[0]
  const payment = buyerPayment(orders)
  const paidInFull = payment.standing === 'full-paid'
  const billTone = paidInFull ? 'settled' : payment.due > 0 ? 'owing' : ''
  return (
    <article className={paidInFull ? 'buyer-tile paid' : 'buyer-tile'} data-testid="buyer-card">
      <button type="button" className="buyer-card" onClick={onOpen}>
        <span className="buyer-name">{buyer.name}</span>
        <span className={billTone ? `buyer-bill ${billTone}` : 'buyer-bill'}>
          <small>Total bill</small>
          {rupees(billOf(orders))}
        </span>
        <span className="buyer-date">
          <small>Purchase date</small>
          {latest ? formatDay(latest.createdAt) : 'No purchase yet'}
        </span>
        <span className="buyer-status">
          {latest ? <OrderPill status={latest.status} /> : <span className="hint">No status</span>}
        </span>
        <span className="buyer-pay">
          <small>Payment</small>
          {payment.standing ? (
            <span className={`pill pay-${payment.standing}`}>{paymentStandingLabel(payment.standing)}</span>
          ) : (
            <span className="hint">No bill</span>
          )}
          {payment.due > 0 && <strong>Due {rupees(payment.due)}</strong>}
        </span>
      </button>
      {paidInFull && (
        <span className="paid-badge" aria-hidden="true">
          <PaidTick />
        </span>
      )}
    </article>
  )
}

function GridIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.2" fill="currentColor" />
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.2" fill="currentColor" />
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.2" fill="currentColor" />
      <rect x="9" y="9" width="5.5" height="5.5" rx="1.2" fill="currentColor" />
    </svg>
  )
}

function ListIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <rect x="1.5" y="2.25" width="13" height="2.2" rx="1" fill="currentColor" />
      <rect x="1.5" y="6.9" width="13" height="2.2" rx="1" fill="currentColor" />
      <rect x="1.5" y="11.55" width="13" height="2.2" rx="1" fill="currentColor" />
    </svg>
  )
}

function previewPlace(buyer: Buyer) {
  return [buyer.address, buyer.note].filter(Boolean).join(' · ')
}

function BuyerDetails({ buyer, orders }: { buyer: Buyer; orders: CustomerOrder[] }) {
  if (orders.length === 0) return <p className="hint">No purchases yet.</p>
  return (
    <div className="buyer-detail" data-testid="buyer-detail">
      {orders.map((order) => (
        <PurchaseDetail key={order.id} buyer={buyer} order={order} />
      ))}
    </div>
  )
}

function PurchaseDetail({ buyer, order }: { buyer: Buyer; order: CustomerOrder }) {
  const discount = order.offer?.kind === 'discount' ? order.offer.amount : 0
  const due = orderDue(order)
  const settled = order.status !== 'cancelled' && due === 0
  return (
    <article className="order-sheet">
      <header>
        <h3>{order.number || 'Order'}</h3>
        <OrderPill status={order.status} />
      </header>
      <dl className="order-facts">
        <div>
          <dt>Contact no:</dt>
          <dd>{buyer.phone || '—'}</dd>
        </div>
        <div>
          <dt>Purchase date:</dt>
          <dd>{formatDay(order.createdAt)}</dd>
        </div>
        <div className="items">
          <dt>Order items:</dt>
          <dd>
            <div className="order-items-box">
              <table className="order-items-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="num">Qty</th>
                    <th className="num">Unit price</th>
                    <th className="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {order.lines.map((line) => (
                    <tr key={`${line.variantId}-${line.quantity}`}>
                      <td>
                        {line.productName} {line.variantName}
                      </td>
                      <td className="num">{line.quantity}</td>
                      <td className="num">{rupees(line.unitPrice)}</td>
                      <td className="num">{rupees(line.quantity * line.unitPrice)}</td>
                    </tr>
                  ))}
                  {order.offer?.kind === 'gift' &&
                    order.offer.items.map((item) => (
                      <tr key={`gift-${item.variantId}`}>
                        <td>
                          {item.productName} {item.variantName} · Gift
                        </td>
                        <td className="num">{item.quantity}</td>
                        <td className="num">Gift</td>
                        <td className="num">{rupees(0)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </dd>
        </div>
        <div>
          <dt>Total amount:</dt>
          <dd>{rupees(order.subtotal)}</dd>
        </div>
        <div>
          <dt>Discount amount:</dt>
          <dd>
            {rupees(discount)}
            {order.offer?.kind === 'discount' ? ` · ${order.offer.offerName}` : ''}
          </dd>
        </div>
        <div>
          <dt>Total pay:</dt>
          <dd>{rupees(order.total)}</dd>
        </div>
        <div>
          <dt>Advance payment:</dt>
          <dd>{rupees(order.paid ?? 0)}</dd>
        </div>
        <div>
          <dt>Due:</dt>
          <dd>
            {rupees(due)}
            {settled && (
              <>
                {' '}
                <PaidTick />
              </>
            )}
          </dd>
        </div>
        <div>
          <dt>Payment method:</dt>
          <dd>{paymentLabel(order.paymentMethod)}</dd>
        </div>
        {order.comment && (
          <div>
            <dt>Comments:</dt>
            <dd>{order.comment}</dd>
          </div>
        )}
      </dl>
    </article>
  )
}

function BuyerSearch({
  buyers,
  query,
  onQueryChange,
  onPick,
}: {
  buyers: Buyer[]
  query: string
  onQueryChange: (query: string) => void
  onPick: (buyer: Buyer) => void
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const suggestions = useMemo(() => {
    const needle = query.trim()
    return buyers
      .filter((buyer) => matchesQuery(`${buyer.name} ${buyer.phone} ${buyer.address}`, needle, 'smart'))
      .sort((left, right) => rankBuyer(left.name, needle) - rankBuyer(right.name, needle) || left.name.localeCompare(right.name))
  }, [buyers, query])

  useEffect(() => {
    setActive(0)
  }, [query])

  useEffect(() => {
    if (!open) return
    function onPointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', onPointer)
    return () => window.removeEventListener('pointerdown', onPointer)
  }, [open])

  function onKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActive((index) => Math.min(index + 1, Math.max(suggestions.length - 1, 0)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      setActive((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter') {
      const buyer = suggestions[active]
      if (!buyer || !query.trim()) return
      event.preventDefault()
      onPick(buyer)
      setOpen(false)
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  const showSuggestions = open && query.trim().length > 0

  return (
    <div className="buyer-search" ref={rootRef}>
      <label>
        <span className="sr-only">Search buyers</span>
        <input
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showSuggestions}
          aria-controls={listId}
          placeholder="Search buyers"
          value={query}
          data-testid="buyer-search"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            onQueryChange(event.target.value)
            setOpen(true)
          }}
          onKeyDown={onKeyDown}
        />
      </label>
      {showSuggestions && (
        <ul className="buyer-suggest" id={listId} role="listbox" aria-label="Buyer suggestions">
          {suggestions.length === 0 && <li className="picker-empty">No buyers match.</li>}
          {suggestions.map((buyer, index) => (
            <li key={buyer.id} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={index === active}
                className={index === active ? 'picker-option active' : 'picker-option'}
                onMouseEnter={() => setActive(index)}
                onClick={() => {
                  onPick(buyer)
                  setOpen(false)
                }}
              >
                <span>
                  <SuggestText text={buyer.name} query={query} />
                </span>
                <small>{buyer.phone || 'No phone'}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function rankBuyer(name: string, needle: string) {
  const haystack = name.toLowerCase()
  const compact = needle.toLowerCase().replace(/\s+/g, '')
  if (!compact) return 0
  if (haystack.startsWith(compact)) return 0
  if (haystack.includes(compact)) return 1
  return 2
}

function SuggestText({ text, query }: { text: string; query: string }) {
  const compact = query.toLowerCase().replace(/\s+/g, '')
  if (!compact) return <>{text}</>
  const lower = text.toLowerCase()
  const pieces: Array<string | { mark: string; key: number }> = []
  let from = 0
  let searchFrom = 0
  for (const character of compact) {
    const found = lower.indexOf(character, searchFrom)
    if (found < 0) return <>{text}</>
    if (found > from) pieces.push(text.slice(from, found))
    pieces.push({ mark: text[found] ?? character, key: found })
    from = found + 1
    searchFrom = found + 1
  }
  if (from < text.length) pieces.push(text.slice(from))
  return (
    <>
      {pieces.map((piece, index) =>
        typeof piece === 'string' ? (
          <span key={`t-${index}`}>{piece}</span>
        ) : (
          <mark key={`m-${piece.key}`} className="picker-mark">
            {piece.mark}
          </mark>
        ),
      )}
    </>
  )
}

function BuyerProfileForm({
  buyer,
  onSubmit,
  onCancel,
}: {
  buyer: Buyer
  onSubmit: (name: string, phone: string, address: string, note: string) => { ok: boolean; error?: string }
  onCancel: () => void
}) {
  const [name, setName] = useState(buyer.name)
  const [phone, setPhone] = useState(buyer.phone)
  const [address, setAddress] = useState(buyer.address)
  const [note, setNote] = useState(buyer.note)
  const [error, setError] = useState<string | null>(null)

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        const result = onSubmit(name, phone, address, note)
        if (!result.ok) setError(result.error ?? 'Could not save the buyer.')
      }}
    >
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <label className="field">
        <span>Name</span>
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="field">
        <span>Phone</span>
        <input value={phone} onChange={(event) => setPhone(event.target.value)} />
      </label>
      <label className="field">
        <span>Address</span>
        <textarea value={address} rows={3} onChange={(event) => setAddress(event.target.value)} />
      </label>
      <label className="field">
        <span>Note</span>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      <div className="dialog-actions">
        <button type="button" className="btn secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn">
          Save buyer
        </button>
      </div>
    </form>
  )
}
