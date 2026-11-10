import type { OrderStatus, PurchaseStatus } from '../types'
import type { StockStatus } from '../inventory'

const stockLabel: Record<StockStatus, string> = {
  ok: 'In stock',
  low: 'Low stock',
  out: 'Out of stock',
}

const purchaseLabel: Record<PurchaseStatus, string> = {
  ordered: 'On order',
  partial: 'Partial',
  received: 'Received',
}

export function StatusPill({ status }: { status: StockStatus }) {
  return <span className={`pill ${status}`}>{stockLabel[status]}</span>
}

export function PurchasePill({ status }: { status: PurchaseStatus }) {
  return <span className={`pill ${status}`}>{purchaseLabel[status]}</span>
}

const orderLabel: Record<OrderStatus, string> = {
  placed: 'Placed, not shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

export function OrderPill({ status }: { status: OrderStatus }) {
  return <span className={`pill ${status}`}>{orderLabel[status]}</span>
}

/** Green tick shown next to a "Full paid" status. */
export function PaidTick() {
  return (
    <svg className="paid-tick" viewBox="0 0 16 16" width="14" height="14" aria-label="Paid" role="img">
      <path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
