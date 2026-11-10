import { useState } from 'react'
import { formatWhen, paymentLabel, rupees } from '../format'
import { orderDue } from '../paymentStatus'
import { matchesQuery } from '../search'
import { useMarket } from '../store'
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
            <table>
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
                    <td>
                      <strong>{buyer.name}</strong>
                      {buyer.phone && <div className="pending">{buyer.phone}</div>}
                    </td>
                    <td className="num">{buyer.sales.toLocaleString()}</td>
                    <td className="num">{rupees(buyer.received)}</td>
                    <td className="num">{rupees(buyer.due)}</td>
                    <td>{formatWhen(buyer.lastAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="section-label">Sales</h3>
          <div className="table-wrap">
            <table>
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
                    <td>{formatWhen(order.createdAt)}</td>
                    <td>{order.buyerName}</td>
                    <td>{order.number}</td>
                    <td>{paymentLabel(order.paymentMethod)}</td>
                    <td className="num">{rupees(receivedOn(order, null))}</td>
                    <td className="num">{rupees(orderDue(order))}</td>
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
