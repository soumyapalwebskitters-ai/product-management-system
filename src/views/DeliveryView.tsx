import { useState } from 'react'
import { Dialog } from '../components/Dialog'
import { OrderPill, PaidTick } from '../components/Status'
import { formatDay, formatWhen, rupees } from '../format'
import { orderDue, orderPayment, paymentStandingLabel } from '../paymentStatus'
import { matchesQuery } from '../search'
import { useMarket } from '../store'
import type { CustomerOrder, OrderStatus } from '../types'
import { OrderCard } from './SalesView'

const deliveryOptions: Array<{ id: OrderStatus; label: string }> = [
  { id: 'placed', label: 'Placed, not shipped' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
]

export function DeliveryView() {
  const { state, setDeliveryStatus } = useMarket()
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filterBy, setFilterBy] = useState<'name' | 'date'>('name')
  const [saleDate, setSaleDate] = useState('')
  const [layout, setLayout] = useState<'grid' | 'list'>('grid')
  const [openId, setOpenId] = useState<string | null>(null)

  const orders = [...state.orders].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).filter((order) => {
    if (filterBy === 'date') return saleDate === '' || dayKey(order.createdAt) === saleDate
    return matchesQuery(order.buyerName, query, 'smart')
  })
  const open = openId ? state.orders.find((order) => order.id === openId) ?? null : null
  const buyer = open ? state.buyers.find((item) => item.id === open.buyerId) ?? null : null

  return (
    <section data-testid="view-delivery">
      <div className="page-head">
        <div>
          <h2>Delivery</h2>
          <p className="lede">
            Newest sales are first. Search by buyer name or date, then set each sale to placed, delivered, or cancelled.
          </p>
        </div>
      </div>
      <div className="toolbar">
        <div className="filters" role="group" aria-label="Filter deliveries by">
          <button type="button" className="chip" aria-pressed={filterBy === 'name'} onClick={() => setFilterBy('name')}>
            Name
          </button>
          <button type="button" className="chip" aria-pressed={filterBy === 'date'} onClick={() => setFilterBy('date')}>
            Date
          </button>
        </div>
        {filterBy === 'name' ? (
          <label className="buyer-search">
            <span className="sr-only">Buyer name</span>
            <input
              value={query}
              placeholder="Buyer name"
              data-testid="delivery-name"
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
              data-testid="delivery-date"
            onChange={(event) => setSaleDate(event.target.value)}
          />
          </label>
        )}
        <div className="filters" role="group" aria-label="Delivery layout">
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
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {orders.length === 0 ? (
        <div className="empty">
          <h3>No deliveries match</h3>
          <p>
            {state.orders.length === 0
              ? 'Sales will appear here after a buyer purchase is recorded.'
              : filterBy === 'date'
                ? 'No sale was recorded on this date.'
                : 'Try another buyer name.'}
          </p>
        </div>
      ) : (
        <div className={layout === 'list' ? 'buyer-grid list' : 'buyer-grid'} data-testid="delivery-layout">
          {orders.map((order) => (
            <DeliveryTile
              key={order.id}
              order={order}
              onOpen={() => setOpenId(order.id)}
              onStatus={(next) => {
                const result = setDeliveryStatus(order.id, next)
                if (!result.ok) setError(result.error)
                else setError(null)
              }}
            />
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
          <dl className="order-facts">
            <div>
              <dt>Contact no:</dt>
              <dd>{buyer?.phone || '—'}</dd>
            </div>
            <div>
              <dt>Address:</dt>
              <dd>{buyer?.address || '—'}</dd>
            </div>
            <div>
              <dt>Note:</dt>
              <dd>{buyer?.note || '—'}</dd>
            </div>
            <div>
              <dt>Due:</dt>
              <dd>{rupees(orderDue(open))}</dd>
            </div>
          </dl>
          <OrderCard order={open} hideHeader />
        </Dialog>
      )}
    </section>
  )
}

function DeliveryTile({
  order,
  onOpen,
  onStatus,
}: {
  order: CustomerOrder
  onOpen: () => void
  onStatus: (status: OrderStatus) => void
}) {
  const payment = orderPayment(order)
  const paidInFull = payment.standing === 'full-paid'
  const billTone = paidInFull ? 'settled' : payment.due > 0 ? 'owing' : ''
  return (
    <article className={paidInFull ? 'buyer-tile paid delivery-tile' : 'buyer-tile delivery-tile'} data-testid="delivery-card">
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
      <div className="delivery-actions">
        <DeliveryControl status={order.status} onChange={onStatus} />
        <button type="button" className="btn secondary small" onClick={onOpen}>
          Buyer details
        </button>
      </div>
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

function DeliveryControl({
  status,
  onChange,
}: {
  status: OrderStatus
  onChange: (status: OrderStatus) => void
}) {
  return (
    <div className="filters delivery-control" role="group" aria-label="Delivery status">
      <span className="delivery-label">Delivery</span>
      {deliveryOptions.map((option) => (
        <button
          key={option.id}
          type="button"
          className="chip"
          aria-pressed={status === option.id}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function dayKey(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}
