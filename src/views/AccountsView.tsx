import { useMemo, useState } from 'react'
import { formatWhen, paymentLabel, rupees } from '../format'
import { orderDue } from '../paymentStatus'
import { matchesQuery } from '../search'
import { useMarket } from '../store'
import { ProductPhoto } from '../components/ProductImageField'
import type { CustomerOrder, PaymentMethod } from '../types'

const methods: PaymentMethod[] = ['cash', 'upi', 'card', 'bank']

export function AccountsView() {
  const { state } = useMarket()
  const [account, setAccount] = useState<PaymentMethod | null>(null)
  const [filterBy, setFilterBy] = useState<'name' | 'date'>('name')
  const [query, setQuery] = useState('')
  const [saleDate, setSaleDate] = useState('')

  const books = [...state.orders]
    .filter((order) => order.status !== 'cancelled')
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))

  const inRange = books.filter((order) => {
    if (filterBy === 'date') return saleDate === '' || dayKey(order.createdAt) === saleDate
    return matchesQuery(order.buyerName, query, 'smart')
  })

  const entries = inRange.filter((order) => account === null || order.paymentMethod === account)

  const byBuyer = new Map<string, CustomerOrder[]>()
  for (const order of entries) {
    const list = byBuyer.get(order.buyerId)
    if (list) list.push(order)
    else byBuyer.set(order.buyerId, [order])
  }
  const buyers = [...byBuyer.entries()]
    .map(([buyerId, orders]) => {
      const buyer = state.buyers.find((item) => item.id === buyerId)
      return {
        id: buyerId,
        name: buyer?.name ?? orders[0].buyerName,
        phone: buyer?.phone ?? '',
        sales: orders.length,
        received: orders.reduce((sum, order) => sum + receivedOn(order, null), 0),
        due: orders.reduce((sum, order) => sum + orderDue(order), 0),
        lastAt: orders[0].createdAt,
      }
    })
    .sort((left, right) => right.lastAt.localeCompare(left.lastAt) || left.name.localeCompare(right.name))

  const received = inRange.reduce((sum, order) => sum + receivedOn(order, null), 0)
  const due = inRange.reduce((sum, order) => sum + orderDue(order), 0)
  const buyerCount = new Set(inRange.map((order) => order.buyerId)).size
  const analytics = useMemo(() => accountAnalytics(state), [state])

  return (
    <section data-testid="view-accounts">
      <div className="page-head">
        <div>
          <h2>Accounts</h2>
          <p className="lede">
            Money received in cash, UPI, card, and bank, and the amount each buyer still owes. Newest sales are first.
          </p>
        </div>
      </div>

      <div className="summary">
        <article>
          <strong>{rupees(received)}</strong>
          <span>Received</span>
        </article>
        <article>
          <strong>{rupees(due)}</strong>
          <span>Still due</span>
        </article>
        <article>
          <strong>{inRange.length.toLocaleString()}</strong>
          <span>{inRange.length === 1 ? 'Sale' : 'Sales'}</span>
        </article>
        <article>
          <strong>{buyerCount.toLocaleString()}</strong>
          <span>{buyerCount === 1 ? 'Buyer account' : 'Buyer accounts'}</span>
        </article>
      </div>

      <section className="account-dashboard" aria-label="Business performance">
        <div className="page-head compact-head">
          <div>
            <h3>Profit and loss</h3>
            <p className="lede">Sales, purchase cost, and product demand across all active orders.</p>
          </div>
        </div>
        <div className="summary profit-summary">
          <article><strong>{rupees(analytics.sales)}</strong><span>Total earned from sales</span></article>
          <article><strong>{rupees(analytics.purchaseCost)}</strong><span>Cost of sold items</span></article>
          <article className={analytics.profit < 0 ? 'loss' : 'profit'}><strong>{rupees(analytics.profit)}</strong><span>{analytics.profit < 0 ? 'Net loss' : 'Net profit'}</span></article>
          <article><strong>{rupees(analytics.purchased)}</strong><span>Total spent on purchases</span></article>
        </div>
        <div className="account-charts">
          <article className="account-chart">
            <h3>Sales by payment method</h3>
            <PaymentPie values={analytics.paymentMethods} />
          </article>
          <article className="account-chart wide-chart">
            <h3>Order frequency</h3>
            <OrderBars values={analytics.orderDays} />
          </article>
          <article className="account-chart">
            <h3>Product selling status</h3>
            <ProductSalesGraph values={analytics.products} />
          </article>
        </div>
      </section>

      <div className="summary account-row">
        {methods.map((method) => {
          const amount = inRange.reduce((sum, order) => sum + receivedOn(order, method), 0)
          return (
            <button
              key={method}
              type="button"
              className={account === method ? 'stat active' : 'stat'}
              aria-pressed={account === method}
              onClick={() => setAccount((current) => (current === method ? null : method))}
            >
              <strong>{rupees(amount)}</strong>
              <span>{paymentLabel(method)}</span>
            </button>
          )
        })}
      </div>

      <div className="toolbar">
        <div className="filters" role="group" aria-label="Filter accounts by">
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
              data-testid="account-name"
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
              data-testid="account-date"
              onChange={(event) => setSaleDate(event.target.value)}
            />
          </label>
        )}
      </div>

      {books.length === 0 ? (
        <div className="empty">
          <h3>No accounts yet</h3>
          <p>Sales will appear here after a buyer purchase is recorded.</p>
        </div>
      ) : buyers.length === 0 ? (
        <div className="empty">
          <h3>No accounts match</h3>
          <p>
            {account
              ? `No ${paymentLabel(account).toLowerCase()} sale matches.`
              : filterBy === 'date'
                ? 'No sale was recorded on this date.'
                : 'Try another buyer name.'}
          </p>
        </div>
      ) : (
        <>
          <h3 className="section-label">Buyer accounts</h3>
          <div className="table-wrap">
            <table className="responsive">
              <thead>
                <tr>
                  <th>Buyer</th>
                  <th className="num">Sales</th>
                  <th className="num">Received</th>
                  <th className="num">Due</th>
                  <th>Last sale</th>
                </tr>
              </thead>
              <tbody>
                {buyers.map((buyer) => (
                  <tr key={buyer.id}>
                    <td data-label="Buyer">
                      <strong>{buyer.name}</strong>
                      {buyer.phone && <div className="pending">{buyer.phone}</div>}
                    </td>
                    <td data-label="Sales" className="num">{buyer.sales.toLocaleString()}</td>
                    <td data-label="Received" className="num">{rupees(buyer.received)}</td>
                    <td data-label="Due" className="num">{rupees(buyer.due)}</td>
                    <td data-label="Last sale">{formatWhen(buyer.lastAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="section-label">Sales</h3>
          <div className="table-wrap">
            <table className="responsive">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Buyer</th>
                  <th>Order</th>
                  <th>Account</th>
                  <th className="num">Received</th>
                  <th className="num">Due</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((order) => (
                  <tr key={order.id}>
                    <td data-label="When">{formatWhen(order.createdAt)}</td>
                    <td data-label="Buyer">{order.buyerName}</td>
                    <td data-label="Order">{order.number}</td>
                    <td data-label="Account">{paymentLabel(order.paymentMethod)}</td>
                    <td data-label="Received" className="num">{rupees(receivedOn(order, null))}</td>
                    <td data-label="Due" className="num">{rupees(orderDue(order))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}

function accountAnalytics(state: ReturnType<typeof useMarket>['state']) {
  const orders = state.orders.filter((order) => order.status !== 'cancelled')
  const variants = new Map(state.products.flatMap((product) => product.variants.map((variant) => [variant.id, variant])))
  const sales = orders.reduce((sum, order) => sum + order.total, 0)
  const purchaseCost = orders.reduce((sum, order) => sum + order.lines.reduce((lineTotal, line) => lineTotal + line.quantity * (variants.get(line.variantId)?.buyingPrice ?? 0), 0), 0)
  const purchased = state.purchases.reduce((sum, purchase) => sum + purchase.orderedItems * (variants.get(purchase.variantId)?.buyingPrice ?? 0), 0)
  const paymentMethods = methods.map((method) => ({ label: paymentLabel(method), value: orders.filter((order) => order.paymentMethod === method).reduce((sum, order) => sum + order.total, 0) })).filter((item) => item.value > 0)
  const productImages = new Map(state.products.map((product) => [product.id, product.image ?? '']))
  const productMap = new Map<string, { id: string; name: string; image: string; quantity: number; revenue: number }>()
  for (const order of orders) for (const line of order.lines) { const current = productMap.get(line.variantId) ?? { id: line.variantId, name: `${line.productName}${line.variantName ? ` · ${line.variantName}` : ''}`, image: productImages.get(line.productId) ?? '', quantity: 0, revenue: 0 }; current.quantity += line.quantity; current.revenue += line.quantity * line.unitPrice; productMap.set(line.variantId, current) }
  const byDay = new Map<string, number>()
  for (const order of orders) { const day = dayKey(order.createdAt); byDay.set(day, (byDay.get(day) ?? 0) + 1) }
  const orderDays = [...byDay.entries()].sort(([left], [right]) => left.localeCompare(right)).slice(-7).map(([day, count]) => ({ day: new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(new Date(`${day}T00:00:00`)), count }))
  return { sales, purchaseCost, purchased, profit: sales - purchaseCost, paymentMethods, orderDays, products: [...productMap.values()].sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name)).slice(0, 5) }
}

function PaymentPie({ values }: { values: Array<{ label: string; value: number }> }) {
  const total = values.reduce((sum, item) => sum + item.value, 0)
  if (!total) return <p className="hint">No payment data yet.</p>
  let angle = -Math.PI / 2
  return <div className="pie-wrap"><svg className="payment-pie" viewBox="0 0 120 120" role="img" aria-label="Sales by payment method"><title>Sales by payment method</title>{values.map((item, index) => { const next = angle + (item.value / total) * Math.PI * 2; const path = pieSlice(60, 60, 52, angle, next); angle = next; return <path key={item.label} className={`pie-${index}`} d={path}><title>{`${item.label}: ${rupees(item.value)}`}</title></path> })}<circle cx="60" cy="60" r="28" className="pie-hole"/><text x="60" y="57" textAnchor="middle">Total</text><text x="60" y="72" textAnchor="middle" className="pie-total">{rupees(total)}</text></svg><ul className="chart-legend">{values.map((item, index) => <li key={item.label}><i className={`pie-${index}`} />{item.label}<strong>{rupees(item.value)}</strong></li>)}</ul></div>
}

function pieSlice(cx: number, cy: number, radius: number, start: number, end: number) { const point = (angle: number) => `${cx + radius * Math.cos(angle)} ${cy + radius * Math.sin(angle)}`; return `M ${cx} ${cy} L ${point(start)} A ${radius} ${radius} 0 ${end - start > Math.PI ? 1 : 0} 1 ${point(end)} Z` }

function OrderBars({ values }: { values: Array<{ day: string; count: number }> }) { const max = Math.max(1, ...values.map((item) => item.count)); return values.length ? <div className="order-bars" role="img" aria-label="Orders by day">{values.map((item) => <div key={item.day}><strong>{item.count}</strong><i style={{ height: `${(item.count / max) * 100}%` }} title={`${item.day}: ${item.count} orders`} /><span>{item.day}</span></div>)}</div> : <p className="hint">Order frequency will appear after sales are recorded.</p> }

function ProductSalesGraph({ values }: { values: Array<{ id: string; name: string; image: string; quantity: number; revenue: number }> }) {
  if (!values.length) return <p className="hint">Product selling status will appear after sales are recorded.</p>
  const highest = Math.max(...values.map((item) => item.quantity))
  return <ol className="product-sales-graph" role="img" aria-label="Top products by units sold">{values.map((item) => <li key={item.id}><div><span className="item-with-photo"><ProductPhoto src={item.image} name={item.name} />{item.name}</span><strong>{item.quantity.toLocaleString()} sold</strong></div><div className="product-bar"><i style={{ width: `${(item.quantity / highest) * 100}%` }} /></div><small>{rupees(item.revenue)} earned</small></li>)}</ol>
}

function receivedOn(order: CustomerOrder, account: PaymentMethod | null) {
  if (account && order.paymentMethod !== account) return 0
  return Math.min(Math.max(0, order.paid), order.total)
}

function dayKey(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}
