import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { ProductPhoto } from '../components/ProductImageField'
import { formatWhen, paymentLabel, rupees } from '../format'
import { orderDue } from '../paymentStatus'
import { matchesQuery } from '../search'
import { useMarket } from '../store'
import type { CustomerOrder, PaymentMethod, State } from '../types'

const methods: PaymentMethod[] = ['cash', 'upi', 'card', 'bank']

export function AccountsView() {
  const { state } = useMarket()
  const [account, setAccount] = useState<PaymentMethod | null>(null)
  const [filterBy, setFilterBy] = useState<'name' | 'date'>('name')
  const [query, setQuery] = useState('')
  const [saleDate, setSaleDate] = useState('')
  const books = useMemo(() => [...state.orders].filter((order) => order.status !== 'cancelled').sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [state.orders])
  const matchingOrders = useMemo(() => books.filter((order) => filterBy === 'date' ? saleDate === '' || dayKey(order.createdAt) === saleDate : matchesQuery(order.buyerName, query, 'smart')), [books, filterBy, query, saleDate])
  const entries = useMemo(() => matchingOrders.filter((order) => account === null || order.paymentMethod === account), [account, matchingOrders])
  const analytics = useMemo(() => accountAnalytics(state, entries), [entries, state])
  const buyers = useMemo(() => buyerAccounts(entries, state), [entries, state.buyers])
  const [pipeline, setPipeline] = useState<PipelineStats>({ queries: 0, willBuy: 0, loggedIn: 0, loading: true })

  useEffect(() => {
    const controller = new AbortController()
    async function loadPipeline() {
      try {
        const [allResponse, willBuyResponse, usersResponse] = await Promise.all([
          fetch('/api/product-queries?page=1&q=&status=', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal }),
          fetch('/api/product-queries?page=1&q=&status=will%20buy', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal }),
          fetch('/api/customer-users', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal }),
        ])
        if (!allResponse.ok || !willBuyResponse.ok || !usersResponse.ok) throw new Error('Analytics unavailable')
        const [all, willBuy, users] = await Promise.all([allResponse.json() as Promise<{ total?: number }>, willBuyResponse.json() as Promise<{ total?: number }>, usersResponse.json() as Promise<{ users?: unknown[] }>])
        setPipeline({ queries: Number(all.total) || 0, willBuy: Number(willBuy.total) || 0, loggedIn: Array.isArray(users.users) ? users.users.length : 0, loading: false })
      } catch (error) {
        if (!controller.signal.aborted) setPipeline(current => ({ ...current, loading: false }))
      }
    }
    void loadPipeline()
    return () => controller.abort()
  }, [])

  return <section className="accounts-page" data-testid="view-accounts">
    <div className="page-head accounts-head"><div><span className="eyebrow"><Icon name="receipt" /> Finance workspace</span><h2>Accounts</h2><p className="lede">Track collections, outstanding balances, margins, and the products that keep your business moving.</p></div><div className="account-context"><Icon name="adjust" /><span>{account ? paymentLabel(account) : 'All payment methods'}</span></div></div>
    <section className="account-overview" aria-label="Account overview">
      <Metric icon="sales" label="Sales value" value={rupees(analytics.sales)} detail={entries.length.toLocaleString() + ' ' + (entries.length === 1 ? 'order' : 'orders') + ' in view'} primary />
      <Metric icon="receipt" label="Collected" value={rupees(analytics.received)} detail="Payments recorded so far" tone="received" />
      <Metric icon="clock" label="Outstanding" value={rupees(analytics.due)} detail={analytics.due ? 'Follow up with buyers' : 'No pending collection'} tone="due" />
      <Metric icon="tag" label={analytics.profit < 0 ? 'Net loss' : 'Net profit'} value={rupees(Math.abs(analytics.profit))} detail={analytics.margin + '% margin on sales'} tone={analytics.profit < 0 ? 'loss' : 'profit'} />
    </section>
    <section className="account-dashboard" aria-label="Business performance">
      <div className="account-section-heading"><div><span className="eyebrow"><Icon name="sales" /> Performance</span><h3>Business performance</h3><p>See the margin behind every sale and spot the next action quickly.</p></div><div className="account-cost-summary"><span>Cost of goods</span><strong>{rupees(analytics.purchaseCost)}</strong><small>Includes gifts given with orders</small></div></div>
      <div className="account-insights">
        <Insight icon="buyer" label="Buyer accounts" value={buyers.length.toLocaleString()} detail="Buyers in this view" />
        <Insight icon="box" label="Top-selling product" value={analytics.products[0]?.name ?? 'No sales yet'} detail={analytics.products[0] ? analytics.products[0].quantity.toLocaleString() + ' units sold' : 'Record a sale to see demand'} />
        <Insight icon="clock" label="Largest balance due" value={analytics.largestDue ? analytics.largestDue.name + ' - ' + rupees(analytics.largestDue.due) : 'No balance due'} detail={analytics.largestDue ? 'Prioritize this collection' : 'All recorded sales are settled'} />
        <Insight icon="factory" label="Inventory investment" value={rupees(analytics.purchased)} detail="Value of purchase entries" />
      </div>
      <section className="account-pipeline" aria-label="Customer pipeline analytics">
        <div className="account-section-heading"><div><span className="eyebrow"><Icon name="buyer" /> Customer pipeline</span><h3>Query to buyer conversion</h3><p>Compare sales enquiries that became buyers with online customer accounts.</p></div><span className="trending-period">Live data</span></div>
        <div className="account-insights pipeline-insights">
          <Insight icon="receipt" label="Product queries" value={pipeline.loading ? '—' : pipeline.queries.toLocaleString()} detail="All enquiries received" />
          <Insight icon="buyer" label="Converted to buyer" value={pipeline.loading ? '—' : pipeline.willBuy.toLocaleString()} detail="Marked “Will buy”" />
          <Insight icon="sales" label="Query conversion rate" value={pipeline.loading ? '—' : conversionRate(pipeline.queries, pipeline.willBuy) + '%'} detail="Queries becoming buyers" />
          <Insight icon="user" label="Online login users" value={pipeline.loading ? '—' : pipeline.loggedIn.toLocaleString()} detail="Google or Facebook accounts" />
        </div>
        <div className="pipeline-progress" aria-label="Query conversion progress"><div><span>Converted queries</span><strong>{pipeline.loading ? '—' : pipeline.willBuy + ' of ' + pipeline.queries}</strong></div><i style={{ width: (pipeline.loading ? 0 : Math.min(100, conversionRate(pipeline.queries, pipeline.willBuy))) + '%' }} /></div>
      </section>
      <div className="account-charts">
        <article className="account-chart"><ChartTitle icon="receipt" title="Collection by method" detail="Amount received through each route" /><PaymentPie values={analytics.paymentMethods} /></article>
        <article className="account-chart wide-chart"><ChartTitle icon="sales" title="Order frequency" detail="Recent sales by day" /><OrderBars values={analytics.orderDays} /></article>
        <article className="account-chart"><ChartTitle icon="box" title="Product selling status" detail="Best performers by units sold" /><ProductSalesGraph values={analytics.products} /></article>
      </div>
      <TrendingProducts values={analytics.products} sales={analytics.sales} />
    </section>
    <section className="account-ledger" aria-label="Account records">
      <div className="account-section-heading ledger-heading"><div><span className="eyebrow"><Icon name="adjust" /> Ledger</span><h3>Collection records</h3><p>Filter by payment method, buyer, or sale date.</p></div></div>
      <div className="account-payment-filters" role="group" aria-label="Filter payment method"><button type="button" className={account === null ? 'payment-filter active' : 'payment-filter'} onClick={() => setAccount(null)}><Icon name="grid" /> All <strong>{rupees(matchingOrders.reduce((sum, order) => sum + receivedOn(order, null), 0))}</strong></button>{methods.map((method) => <button key={method} type="button" className={account === method ? 'payment-filter active' : 'payment-filter'} onClick={() => setAccount(method)}><span>{paymentLabel(method)}</span><strong>{rupees(matchingOrders.reduce((sum, order) => sum + receivedOn(order, method), 0))}</strong></button>)}</div>
      <div className="toolbar account-toolbar"><div className="filters" role="group" aria-label="Filter accounts by"><button type="button" className="chip" aria-pressed={filterBy === 'name'} onClick={() => setFilterBy('name')}><Icon name="buyer" /> Buyer</button><button type="button" className="chip" aria-pressed={filterBy === 'date'} onClick={() => setFilterBy('date')}><Icon name="clock" /> Date</button></div><label className="buyer-search"><span className="sr-only">{filterBy === 'name' ? 'Buyer name' : 'Sale date'}</span>{filterBy === 'name' ? <><Icon name="search" /><input value={query} placeholder="Search buyer" data-testid="account-name" autoComplete="off" onChange={(event) => setQuery(event.target.value)} /></> : <input type="date" value={saleDate} data-testid="account-date" onChange={(event) => setSaleDate(event.target.value)} />}</label></div>
      {books.length === 0 ? <EmptyState title="No account activity yet" body="Sales, collection, and profit insights will appear here after a buyer purchase is recorded." /> : buyers.length === 0 ? <EmptyState title="No matching account records" body={account ? 'No ' + paymentLabel(account).toLowerCase() + ' sale matches this filter.' : filterBy === 'date' ? 'No sale was recorded on this date.' : 'Try another buyer name.'} /> : <><h3 className="section-label">Buyer balances <span>{buyers.length}</span></h3><div className="table-wrap"><table className="responsive"><thead><tr><th>Buyer</th><th className="num">Orders</th><th className="num">Collected</th><th className="num">Due</th><th>Last sale</th></tr></thead><tbody>{buyers.map((buyer) => <tr key={buyer.id}><td data-label="Buyer"><strong>{buyer.name}</strong>{buyer.phone && <div className="pending">{buyer.phone}</div>}</td><td data-label="Orders" className="num">{buyer.sales}</td><td data-label="Collected" className="num">{rupees(buyer.received)}</td><td data-label="Due" className="num">{rupees(buyer.due)}</td><td data-label="Last sale">{formatWhen(buyer.lastAt)}</td></tr>)}</tbody></table></div><h3 className="section-label">Recent sales <span>{entries.length}</span></h3><div className="table-wrap"><table className="responsive"><thead><tr><th>When</th><th>Buyer</th><th>Order</th><th>Payment</th><th className="num">Collected</th><th className="num">Due</th></tr></thead><tbody>{entries.map((order) => <tr key={order.id}><td data-label="When">{formatWhen(order.createdAt)}</td><td data-label="Buyer">{order.buyerName}</td><td data-label="Order">{order.number}</td><td data-label="Payment">{paymentLabel(order.paymentMethod)}</td><td data-label="Collected" className="num">{rupees(receivedOn(order, null))}</td><td data-label="Due" className="num">{rupees(orderDue(order))}</td></tr>)}</tbody></table></div></>}
    </section>
  </section>
}

function Metric({ icon, label, value, detail, tone, primary }: { icon: 'sales' | 'receipt' | 'clock' | 'tag'; label: string; value: string; detail: string; tone?: string; primary?: boolean }) { return <article className={'account-metric ' + (primary ? 'primary ' : '') + (tone ?? '')}><span className="metric-icon"><Icon name={icon} /></span><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></article> }
function Insight({ icon, label, value, detail }: { icon: 'buyer' | 'box' | 'clock' | 'factory' | 'receipt' | 'sales' | 'user'; label: string; value: string; detail: string }) { return <article><Icon name={icon} /><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></article> }
function ChartTitle({ icon, title, detail }: { icon: 'receipt' | 'sales' | 'box'; title: string; detail: string }) { return <div className="chart-title"><div><h3>{title}</h3><p>{detail}</p></div><Icon name={icon} /></div> }
function EmptyState({ title, body }: { title: string; body: string }) { return <div className="empty"><Icon name="receipt" /><h3>{title}</h3><p>{body}</p></div> }
function buyerAccounts(entries: CustomerOrder[], state: Pick<State, 'buyers'>) { const groups = new Map<string, CustomerOrder[]>(); entries.forEach((order) => groups.set(order.buyerId, [...(groups.get(order.buyerId) ?? []), order])); return [...groups.entries()].map(([buyerId, orders]) => { const buyer = state.buyers.find((item) => item.id === buyerId); return { id: buyerId, name: buyer?.name ?? orders[0].buyerName, phone: buyer?.phone ?? '', sales: orders.length, received: orders.reduce((sum, order) => sum + receivedOn(order, null), 0), due: orders.reduce((sum, order) => sum + orderDue(order), 0), lastAt: orders[0].createdAt } }).sort((a, b) => b.lastAt.localeCompare(a.lastAt) || a.name.localeCompare(b.name)) }
function accountAnalytics(state: State, orders: CustomerOrder[]) { const variants = new Map(state.products.flatMap((product) => product.variants.map((variant) => [variant.id, variant]))); const sales = orders.reduce((sum, order) => sum + order.total, 0); const received = orders.reduce((sum, order) => sum + receivedOn(order, null), 0); const due = orders.reduce((sum, order) => sum + orderDue(order), 0); const purchaseCost = orders.reduce((sum, order) => sum + order.lines.reduce((lineSum, line) => lineSum + line.quantity * (variants.get(line.variantId)?.buyingPrice ?? 0), 0) + (order.offer?.kind === 'gift' ? order.offer.items.reduce((giftSum, item) => giftSum + item.quantity * (variants.get(item.variantId)?.buyingPrice ?? 0), 0) : 0), 0); const purchased = state.purchases.reduce((sum, purchase) => sum + purchase.orderedItems * (variants.get(purchase.variantId)?.buyingPrice ?? 0), 0); const paymentMethods = methods.map((method) => ({ label: paymentLabel(method), value: orders.reduce((sum, order) => sum + receivedOn(order, method), 0) })).filter((item) => item.value > 0); const images = new Map(state.products.map((product) => [product.id, product.image ?? ''])); const productMap = new Map<string, { id: string; name: string; image: string; quantity: number; revenue: number }>(); for (const order of orders) for (const line of order.lines) { const product = productMap.get(line.variantId) ?? { id: line.variantId, name: line.productName + (line.variantName ? ' - ' + line.variantName : ''), image: images.get(line.productId) ?? '', quantity: 0, revenue: 0 }; product.quantity += line.quantity; product.revenue += line.quantity * line.unitPrice; productMap.set(line.variantId, product) }; const days = new Map<string, number>(); orders.forEach((order) => { const day = dayKey(order.createdAt); days.set(day, (days.get(day) ?? 0) + 1) }); const orderDays = [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-7).map(([day, count]) => ({ day: new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(new Date(day + 'T00:00:00')), count })); const balances = buyerAccounts(orders, state).filter((buyer) => buyer.due > 0).sort((a, b) => b.due - a.due); const profit = sales - purchaseCost; return { sales, received, due, purchaseCost, purchased, profit, margin: sales ? Math.round((profit / sales) * 100) : 0, paymentMethods, orderDays, products: [...productMap.values()].sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name)).slice(0, 5), largestDue: balances[0] } }
function PaymentPie({ values }: { values: Array<{ label: string; value: number }> }) { const total = values.reduce((sum, item) => sum + item.value, 0); if (!total) return <p className="hint">No payments have been collected yet.</p>; let angle = -Math.PI / 2; return <div className="pie-wrap"><svg className="payment-pie" viewBox="0 0 120 120" role="img" aria-label="Collected amount by payment method">{values.map((item, index) => { const next = angle + (item.value / total) * Math.PI * 2; const path = pieSlice(60, 60, 52, angle, next); angle = next; return <path key={item.label} className={'pie-' + index} d={path} /> })}<circle cx="60" cy="60" r="28" className="pie-hole"/><text x="60" y="57" textAnchor="middle">Collected</text><text x="60" y="72" textAnchor="middle" className="pie-total">{rupees(total)}</text></svg><ul className="chart-legend">{values.map((item, index) => <li key={item.label}><i className={'pie-' + index} />{item.label}<strong>{rupees(item.value)}</strong></li>)}</ul></div> }
function pieSlice(cx: number, cy: number, radius: number, start: number, end: number) { const point = (angle: number) => String(cx + radius * Math.cos(angle)) + ' ' + String(cy + radius * Math.sin(angle)); return 'M ' + cx + ' ' + cy + ' L ' + point(start) + ' A ' + radius + ' ' + radius + ' 0 ' + (end - start > Math.PI ? 1 : 0) + ' 1 ' + point(end) + ' Z' }
function OrderBars({ values }: { values: Array<{ day: string; count: number }> }) { const max = Math.max(1, ...values.map((item) => item.count)); return values.length ? <div className="order-bars">{values.map((item) => <div key={item.day}><strong>{item.count}</strong><i style={{ height: ((item.count / max) * 100) + '%' }} /><span>{item.day}</span></div>)}</div> : <p className="hint">Order frequency will appear after sales are recorded.</p> }
function ProductSalesGraph({ values }: { values: Array<{ id: string; name: string; image: string; quantity: number; revenue: number }> }) { if (!values.length) return <p className="hint">Product selling status will appear after sales are recorded.</p>; const highest = Math.max(...values.map((item) => item.quantity)); return <ol className="product-sales-graph">{values.map((item) => <li key={item.id}><div><span className="item-with-photo"><ProductPhoto src={item.image} name={item.name} />{item.name}</span><strong>{item.quantity} sold</strong></div><div className="product-bar"><i style={{ width: ((item.quantity / highest) * 100) + '%' }} /></div><small>{rupees(item.revenue)} sales value</small></li>)}</ol> }
function TrendingProducts({ values, sales }: { values: Array<{ id: string; name: string; image: string; quantity: number; revenue: number }>; sales: number }) {
  const highest = Math.max(1, ...values.map((item) => item.quantity))
  return <section className="account-trending" aria-label="Trending and most selling products">
    <div className="account-section-heading"><div><span className="eyebrow"><Icon name="sales" /> Demand analytics</span><h3>Trending products</h3><p>Most selling products ranked by units sold and sales value.</p></div><span className="trending-period">Current view</span></div>
    {!values.length ? <p className="hint">Trending products will appear after sales are recorded.</p> : <div className="trending-list">{values.map((item, index) => {
      const share = sales > 0 ? Math.round((item.revenue / sales) * 100) : 0
      return <article className="trending-item" key={item.id}>
        <span className="trending-rank">{index + 1}</span>
        <ProductPhoto src={item.image} name={item.name} />
        <div className="trending-product"><strong>{item.name}</strong><div className="trending-bar"><i style={{ width: ((item.quantity / highest) * 100) + '%' }} /></div></div>
        <div className="trending-stat"><strong>{item.quantity.toLocaleString()}</strong><span>units sold</span></div>
        <div className="trending-stat"><strong>{rupees(item.revenue)}</strong><span>{share}% of sales</span></div>
      </article>
    })}</div>}
  </section>
}
function receivedOn(order: CustomerOrder, account: PaymentMethod | null) { if (account && order.paymentMethod !== account) return 0; return Math.min(Math.max(0, order.paid), order.total) }
function dayKey(iso: string) { const date = new Date(iso); if (Number.isNaN(date.getTime())) return ''; return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0') }
type PipelineStats = { queries: number; willBuy: number; loggedIn: number; loading: boolean }
function conversionRate(total: number, converted: number) { return total ? Math.round((converted / total) * 100) : 0 }
