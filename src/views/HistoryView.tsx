import { useMemo, useState } from 'react'
import { ProductSelect, type SelectOption } from '../components/ProductSelect'
import { PurchasePill } from '../components/Status'
import { ReceivePurchaseDialog } from '../components/StockDialogs'
import { formatWhen, signed } from '../format'
import { matchesQuery, type SearchMode } from '../search'
import { useMarket } from '../store'
import type { MovementType } from '../types'

const movementLabel: Record<MovementType, string> = {
  sale: 'Sale',
  adjustment: 'Adjustment',
  receipt: 'Stock received',
  purchase: 'Purchase received',
}

export function HistoryView() {
  const { state } = useMarket()
  const [tab, setTab] = useState<'purchases' | 'activity'>('purchases')
  const [query, setQuery] = useState('')
  const [searchMode, setSearchMode] = useState<SearchMode>('smart')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activity, setActivity] = useState<'all' | MovementType>('all')
  const [receiveId, setReceiveId] = useState<string | null>(null)

  const options = useMemo<SelectOption[]>(() => {
    const byId = new Map<string, SelectOption>()
    for (const entry of [...state.purchases, ...state.movements]) {
      if (byId.has(entry.variantId)) continue
      byId.set(entry.variantId, {
        id: entry.variantId,
        title: `${entry.productName} · ${entry.variantName}`,
        meta: entry.sku,
        searchText: `${entry.productName} ${entry.variantName} ${entry.sku}`,
      })
    }
    return [...byId.values()]
  }, [state.movements, state.purchases])
  const purchases = [...state.purchases]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .filter((purchase) => {
      if (selectedId) return purchase.variantId === selectedId
      return matchesQuery(
        `${purchase.productName} ${purchase.variantName} ${purchase.sku} ${purchase.note}`,
        query,
        searchMode,
      )
    })
  const movements = [...state.movements]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .filter((movement) => {
      if (activity !== 'all' && movement.type !== activity) return false
      if (selectedId) return movement.variantId === selectedId
      return matchesQuery(
        `${movement.productName} ${movement.variantName} ${movement.sku} ${movement.note}`,
        query,
        searchMode,
      )
    })

  const receiving = receiveId
    ? state.purchases.find((purchase) => purchase.id === receiveId) ?? null
    : null

  return (
    <section data-testid="view-history">
      <div className="page-head">
        <div>
          <h2>Purchase history</h2>
          <p className="lede">
            Mark a purchase when you place it, then receive the delivery when the boxes arrive.
            Stock changes from sales, adjustments, and receipts are kept alongside that history.
          </p>
        </div>
      </div>

      <div className="toolbar">
        <div className="filters" role="group" aria-label="History type">
          <button
            type="button"
            className="chip"
            aria-pressed={tab === 'purchases'}
            onClick={() => setTab('purchases')}
          >
            Purchases
          </button>
          <button
            type="button"
            className="chip"
            aria-pressed={tab === 'activity'}
            onClick={() => setTab('activity')}
          >
            Stock activity
          </button>
        </div>
        <ProductSelect
          label="Search history"
          placeholder="Select a product"
          options={options}
          query={query}
          mode={searchMode}
          selectedId={selectedId}
          onQueryChange={setQuery}
          onModeChange={setSearchMode}
          onSelect={setSelectedId}
        />
        {tab === 'activity' && (
          <div className="filters" role="group" aria-label="Activity type">
            {(
              [
                ['all', 'All'],
                ['sale', 'Sales'],
                ['adjustment', 'Adjustments'],
                ['receipt', 'Receipts'],
                ['purchase', 'Purchases'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className="chip"
                aria-pressed={activity === id}
                onClick={() => setActivity(id)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === 'purchases' && purchases.length === 0 && (
        <div className="empty">
          <h3>No purchases yet</h3>
          <p>Record a purchase from the need-to-buy list and it will show up here.</p>
        </div>
      )}

      {tab === 'purchases' && purchases.length > 0 && (
        <div className="table-wrap surface-table">
          <table className="responsive" data-testid="purchase-history">
            <thead>
              <tr>
                <th>When</th>
                <th>Product</th>
                <th>Variant</th>
                <th className="num">Boxes</th>
                <th className="num">Items</th>
                <th>Status</th>
                <th>Note</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((purchase) => (
                <tr key={purchase.id} data-testid="purchase-row">
                  <td data-label="When">{formatWhen(purchase.createdAt)}</td>
                  <td data-label="Product">
                    <strong>{purchase.productName}</strong>
                  </td>
                  <td data-label="Variant">
                    {purchase.variantName}
                    <div className="sku">{purchase.sku}</div>
                  </td>
                  <td data-label="Boxes" className="num">
                    {purchase.boxes.toLocaleString()}
                    <small className="muted-block">{purchase.itemsPerBox} per box</small>
                  </td>
                  <td data-label="Items" className="num">
                    {purchase.receivedItems.toLocaleString()} of {purchase.orderedItems.toLocaleString()}
                  </td>
                  <td data-label="Status">
                    <PurchasePill status={purchase.status} />
                  </td>
                  <td data-label="Note">{purchase.note || '—'}</td>
                  <td data-label="Actions" className="actions">
                    {purchase.status !== 'received' && (
                      <button type="button" className="btn small" onClick={() => setReceiveId(purchase.id)}>
                        Receive stock
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'activity' && movements.length === 0 && (
        <div className="empty">
          <h3>No stock activity</h3>
          <p>Sales, adjustments, and deliveries will be listed here.</p>
        </div>
      )}

      {tab === 'activity' && movements.length > 0 && (
        <div className="table-wrap surface-table">
          <table className="responsive">
            <thead>
              <tr>
                <th>When</th>
                <th>Type</th>
                <th>Product</th>
                <th>Variant</th>
                <th className="num">Change</th>
                <th className="num">Stock</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((movement) => (
                <tr key={movement.id}>
                  <td data-label="When">{formatWhen(movement.createdAt)}</td>
                  <td data-label="Type">{movementLabel[movement.type]}</td>
                  <td data-label="Product">
                    <strong>{movement.productName}</strong>
                  </td>
                  <td data-label="Variant">
                    {movement.variantName}
                    <div className="sku">{movement.sku}</div>
                  </td>
                  <td data-label="Change" className="num">
                    {signed(movement.delta)}
                  </td>
                  <td data-label="Stock" className="num">
                    {movement.previousStock.toLocaleString()} → {movement.newStock.toLocaleString()}
                  </td>
                  <td data-label="Note">{movement.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {receiving && <ReceivePurchaseDialog purchase={receiving} onClose={() => setReceiveId(null)} />}
    </section>
  )
}
