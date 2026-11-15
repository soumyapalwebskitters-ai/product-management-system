import { useEffect, useId, useRef, useState } from 'react'
import { Dialog } from '../components/Dialog'
import { OrderPill, PaidTick } from '../components/Status'
import { formatDay, formatWhen, paymentLabel, rupees } from '../format'
import { orderPayment, paymentStandingLabel } from '../paymentStatus'
import { matchesQuery } from '../search'
import { useMarket } from '../store'
import type { CustomerOrder, OrderStatus } from '../types'

export function SalesView() {
  const { state } = useMarket()
  const [query, setQuery] = useState('')
  const [filterBy, setFilterBy] = useState<'name' | 'date'>('name')
  const [saleDate, setSaleDate] = useState('')
  const [status, setStatus] = useState<'all' | OrderStatus>('all')
  const [layout, setLayout] = useState<'grid' | 'list'>('grid')
  const [openId, setOpenId] = useState<string | null>(null)

  const orders = [...state.orders]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .filter((order) => {
      if (status !== 'all' && order.status !== status) return false
      if (filterBy === 'date') {
        return saleDate === '' || dayKey(order.createdAt) === saleDate
      }
      return matchesQuery(order.buyerName, query, 'smart')
    })
  const open = openId ? state.orders.find((order) => order.id === openId) ?? null : null

  return (
    <section data-testid="view-sales">
      <div className="page-head">
        <div>
          <h2>
            Sell history{' '}
            <span className="buyer-count" data-testid="sale-count">
              {orders.length === state.orders.length
                ? `${orders.length} ${orders.length === 1 ? 'sale' : 'sales'}`
                : `${orders.length} of ${state.orders.length} sales`}
            </span>
          </h2>
          <p className="lede">
            Every buyer purchase is here. Switch between grid and list, and open a sale to see the bill.
          </p>
        </div>
      </div>
      <div className="toolbar sales-toolbar">
        <div className="filters" role="group" aria-label="Filter sales by">
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
          <label className="buyer-search">
            <span className="sr-only">Buyer name</span>
            <input
              value={query}
              placeholder="Buyer name"
              data-testid="sale-name"
              autoComplete="off"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        ) : (
          <label className="buyer-search">
            <span className="sr-only">Sale date</span>
            <input
              type="date"
              value={saleDate}
              data-testid="sale-date"
              onChange={(event) => setSaleDate(event.target.value)}
            />
          </label>
        )}
        <FilterMenu
          label="Sale status"
          value={status}
          options={[
            { id: 'all', label: 'All sales' },
            { id: 'placed', label: 'Not shipped' },
            { id: 'delivered', label: 'Delivered' },
            { id: 'cancelled', label: 'Cancelled' },
          ]}
          onChange={setStatus}
        />
        <div className="filters" role="group" aria-label="Sale layout">
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
      {orders.length === 0 ? (
        <div className="empty">
          <h3>No sales match</h3>
          <p>
            {state.orders.length === 0
              ? 'Buyer purchases will appear here after they are recorded.'
              : filterBy === 'date'
                ? 'No sale was recorded on this date.'
                : 'Try another buyer name.'}
          </p>
        </div>
      ) : (
        <div className={layout === 'list' ? 'buyer-grid list' : 'buyer-grid'} data-testid="sale-layout">
          {orders.map((order) => (
            <SaleTile key={order.id} order={order} onOpen={() => setOpenId(order.id)} />
          ))}
        </div>
      )}
      {open && (
        <Dialog
          title={open.buyerName}
          subtitle={`${open.number ? `${open.number} · ` : ''}${formatWhen(open.createdAt)}`}
          wide
          onClose={() => setOpenId(null)}
        >
          <OrderCard order={open} hideHeader />
        </Dialog>
      )}
    </section>
  )
}

function FilterMenu({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: 'all' | OrderStatus
  options: Array<{ id: 'all' | OrderStatus; label: string }>
  onChange: (value: 'all' | OrderStatus) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const current = options.find((option) => option.id === value) ?? options[0]

  useEffect(() => {
    if (!open) return
    function onPointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="filter-menu" ref={rootRef}>
      <button
        type="button"
        className="filter-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((currentOpen) => !currentOpen)}
      >
        <span>Filter: {current.label}</span>
        <span aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <ul id={listId} role="listbox" aria-label={label}>
          {options.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                role="option"
                aria-selected={option.id === value}
                onClick={() => {
                  onChange(option.id)
                  setOpen(false)
                }}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SaleTile({ order, onOpen }: { order: CustomerOrder; onOpen: () => void }) {
  const payment = orderPayment(order)
  const paidInFull = payment.standing === 'full-paid'
  const billTone = paidInFull ? 'settled' : payment.due > 0 ? 'owing' : ''
  return (
    <article className={paidInFull ? 'buyer-tile paid' : 'buyer-tile'} data-testid="sale-card">
      <button type="button" className="buyer-card" onClick={onOpen}>
        <span className="buyer-name">
          {order.buyerName}
          {order.number && <small>{order.number}</small>}
        </span>
        <span className={billTone ? `buyer-bill ${billTone}` : 'buyer-bill'}>
          <small>Total bill</small>
          {rupees(order.total)}
        </span>
        <span className="buyer-date">
          <small>Purchase date</small>
          {formatDay(order.createdAt)}
        </span>
        <span className="buyer-status">
          <OrderPill status={order.status} />
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

export function OrderCard({ order, hideHeader = false }: { order: CustomerOrder; hideHeader?: boolean }) {
  const payment = orderPayment(order)
  return (
    <article className="order-card">
      {!hideHeader && (
        <header>
          <div>
            <h3>{order.buyerName}</h3>
            <p>
              {order.number ? `${order.number} · ` : ''}
              {formatWhen(order.createdAt)}
            </p>
          </div>
          <OrderPill status={order.status} />
        </header>
      )}
      <ul>
        {order.lines.map((line) => (
          <li key={`${line.variantId}-${line.quantity}`}>
            {line.quantity} × {line.productName} {line.variantName}
            <span>
              {rupees(line.unitPrice)} · {rupees(line.quantity * line.unitPrice)}
            </span>
          </li>
        ))}
      </ul>
      {order.offer?.kind === 'discount' && (
        <p className="reward">
          Special discount {rupees(order.offer.amount)} ({order.offer.percent}% · {order.offer.offerName}). No gift
          items.
        </p>
      )}
      {order.offer?.kind === 'gift' && (
        <p className="reward">
          Gift items:{' '}
          {order.offer.items
            .map((item) => `${item.quantity} × ${item.productName} ${item.variantName}`)
            .join(', ')}
          . No cash discount.
        </p>
      )}
      {!order.offer && <p className="hint">No offer applied.</p>}
      <p className="hint">
        {payment.standing ? `Payment: ${paymentStandingLabel(payment.standing)}` : 'Payment: no amount due'}
        {payment.standing === 'full-paid' && <> <PaidTick /></>}
        {payment.due > 0 ? ` · Due ${rupees(payment.due)}` : ''}
        {' · '}
        {paymentLabel(order.paymentMethod)}
      </p>
      {order.comment && <p className="comment">Comments: {order.comment}</p>}
      <p className="order-total">
        Bill {rupees(order.subtotal)} · To pay {rupees(order.total)}
      </p>
    </article>
  )
}

function dayKey(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}
