import { useMemo, useState } from 'react'
import { ProductSelect, type SelectOption } from '../components/ProductSelect'
import { OrderPill, PaidTick } from '../components/Status'
import { formatWhen, paymentLabel, rupees } from '../format'
import { orderPayment, paymentStandingLabel } from '../paymentStatus'
import type { SearchMode } from '../search'
import { matchesQuery } from '../search'
import { useMarket } from '../store'
import type { CustomerOrder, OrderStatus } from '../types'

const deliveryOptions: Array<{ id: OrderStatus; label: string }> = [
  { id: 'placed', label: 'Placed, not shipped' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
]

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

export function SalesView() {
  const { state, setDeliveryStatus } = useMarket()
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<SearchMode>('smart')
  const [buyerId, setBuyerId] = useState<string | null>(null)
  const [status, setStatus] = useState<'all' | OrderStatus>('all')

  const options = useMemo<SelectOption[]>(
    () =>
      state.buyers.map((buyer) => ({
        id: buyer.id,
        title: buyer.name,
        meta: buyer.phone,
        searchText: `${buyer.name} ${buyer.phone}`,
      })),
    [state.buyers],
  )
  const orders = [...state.orders]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .filter((order) => {
      if (buyerId && order.buyerId !== buyerId) return false
      if (status !== 'all' && order.status !== status) return false
      return matchesQuery(orderSearch(order), query, mode)
    })

  return (
    <section data-testid="view-sales">
      <div className="page-head">
        <div>
          <h2>Sell history</h2>
          <p className="lede">
            Every buyer purchase is listed here, including gifts, discounts, and comments. Set the delivery status
            under each purchase. Buyers can see it but cannot change it.
          </p>
        </div>
      </div>
      <div className="toolbar">
        <ProductSelect
          label="Filter by buyer"
          placeholder="All buyers"
          options={options}
          query={query}
          mode={mode}
          selectedId={buyerId}
          onQueryChange={setQuery}
          onModeChange={setMode}
          onSelect={setBuyerId}
        />
        <div className="filters" role="group" aria-label="Sale status">
          {(
            [
              ['all', 'All'],
              ['placed', 'Not shipped'],
              ['delivered', 'Delivered'],
              ['cancelled', 'Cancelled'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className="chip"
              aria-pressed={status === id}
              onClick={() => setStatus(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {orders.length === 0 ? (
        <div className="empty">
          <h3>No sales match</h3>
          <p>Buyer purchases will appear here after they are recorded.</p>
        </div>
      ) : (
        <div className="order-list">
          {orders.map((order) => (
            <div key={order.id} className="order-wrap">
              <OrderCard order={order} />
              <DeliveryControl
                status={order.status}
                onChange={(next) => {
                  const result = setDeliveryStatus(order.id, next)
                  if (!result.ok) setError(result.error)
                  else setError(null)
                }}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export function OrderCard({ order }: { order: CustomerOrder }) {
  const payment = orderPayment(order)
  return (
    <article className="order-card">
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

function orderSearch(order: CustomerOrder) {
  const items = order.lines.map((line) => `${line.productName} ${line.variantName} ${line.sku}`).join(' ')
  const gift = order.offer?.kind === 'gift' ? order.offer.items.map((item) => item.productName).join(' ') : ''
  return `${order.buyerName} ${items} ${order.comment} ${order.offer?.offerName ?? ''} ${gift}`
}
