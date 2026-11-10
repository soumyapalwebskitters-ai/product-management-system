import type { CustomerOrder, OrderStatus } from './types'

export type PaymentStanding = 'full-paid' | 'advance' | 'partial' | 'full-due'

const labels: Record<PaymentStanding, string> = {
  'full-paid': 'Full paid',
  advance: 'Advance pay',
  partial: 'Partial pay',
  'full-due': 'Full due',
}

export function paymentStandingLabel(standing: PaymentStanding) {
  return labels[standing]
}

export function orderDue(order: Pick<CustomerOrder, 'status' | 'total' | 'paid'>) {
  if (order.status === 'cancelled') return 0
  return Math.max(0, order.total - Math.max(0, order.paid ?? 0))
}

/** Standing of the buyer's open bills. Cancelled purchases are left out. */
export function buyerPayment(orders: Array<Pick<CustomerOrder, 'status' | 'total' | 'paid'>>) {
  const open = orders.filter((order) => order.status !== 'cancelled')
  if (open.length === 0) return { standing: null, due: 0 }
  const due = open.reduce((sum, order) => sum + orderDue(order), 0)
  if (due === 0) return { standing: 'full-paid' as const, due: 0 }
  const owing = open.filter((order) => orderDue(order) > 0)
  const received = owing.reduce((sum, order) => sum + Math.min(Math.max(0, order.paid), order.total), 0)
  if (received <= 0) return { standing: 'full-due' as const, due }
  if (owing.some((order) => order.status === 'delivered')) return { standing: 'partial' as const, due }
  return { standing: 'advance' as const, due }
}

export function orderPayment(order: Pick<CustomerOrder, 'status' | 'total' | 'paid'> & { status: OrderStatus }) {
  return buyerPayment([order])
}
