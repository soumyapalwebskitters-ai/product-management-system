import { useMemo, useState } from 'react'
import { BoxMath } from '../components/BoxMath'
import { DesiredField } from '../components/DesiredField'
import { ProductSelect, type SelectOption } from '../components/ProductSelect'
import { StatusPill } from '../components/Status'
import { PurchaseDialog, ReceivePurchaseDialog } from '../components/StockDialogs'
import { boxesLabel, itemsLabel } from '../format'
import { buyRows, type BuyRow } from '../inventory'
import { matchesQuery, type SearchMode } from '../search'
import { useMarket } from '../store'

type Filter = 'all' | 'out' | 'low'

export function NeedToBuyView() {
  const market = useMarket()
  const rows = buyRows(market.state)
  const [query, setQuery] = useState('')
  const [searchMode, setSearchMode] = useState<SearchMode>('smart')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [buying, setBuying] = useState<BuyRow | null>(null)
  const [receiveId, setReceiveId] = useState<string | null>(null)

  const options = useMemo<SelectOption[]>(
    () =>
      rows.map((row) => ({
        id: row.variant.id,
        title: `${row.productName} · ${row.variant.name}`,
        meta: row.variant.sku,
        searchText: `${row.productName} ${row.variant.name} ${row.variant.sku}`,
      })),
    [rows],
  )
  const shown = rows.filter((row) => {
    if (filter !== 'all' && row.status !== filter) return false
    if (selectedId) return row.variant.id === selectedId
    return matchesQuery(`${row.productName} ${row.variant.name} ${row.variant.sku}`, query, searchMode)
  })

  const totals = shown.reduce(
    (sum, row) => {
      sum.items += row.calc.purchaseQty
      sum.boxes += row.calc.boxes
      sum.extra += row.calc.extra
      if (row.status === 'out') sum.out += 1
      return sum
    },
    { items: 0, boxes: 0, extra: 0, out: 0 },
  )

  const receiving = receiveId
    ? market.state.purchases.find((purchase) => purchase.id === receiveId) ?? null
    : null

  return (
    <section data-testid="view-buy">
      <div className="page-head">
        <div>
          <h2>Need to buy</h2>
          <p className="lede">
            A variant is listed when current stock is below its minimum. Purchase quantity is
            desired stock minus current stock. Boxes round up so every box is complete. Sales,
            orders, adjustments, and receipts update this list immediately.
          </p>
        </div>
      </div>

      <div className="summary" aria-label="Purchase summary">
        <article>
          <strong>{shown.length}</strong>
          <span>Need restock</span>
        </article>
        <article>
          <strong>{totals.out}</strong>
          <span>Out of stock</span>
        </article>
        <article>
          <strong>{totals.items.toLocaleString()}</strong>
          <span>Items to buy</span>
        </article>
        <article>
          <strong>{totals.boxes.toLocaleString()}</strong>
          <span>{totals.extra.toLocaleString()} extra from full boxes</span>
        </article>
      </div>

      <div className="toolbar">
        <ProductSelect
          label="Search the purchase list"
          placeholder="Select a product to buy"
          options={options}
          query={query}
          mode={searchMode}
          selectedId={selectedId}
          onQueryChange={setQuery}
          onModeChange={setSearchMode}
          onSelect={setSelectedId}
        />
        <div className="filters" role="group" aria-label="Restock filter">
          {(
            [
              ['all', 'All short'],
              ['out', 'Out of stock'],
              ['low', 'Low stock'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className="chip"
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 && (
        <div className="empty">
          <h3>Nothing to buy</h3>
          <p>Every variant is at or above its minimum stock.</p>
        </div>
      )}

      {rows.length > 0 && shown.length === 0 && (
        <div className="empty">
          <h3>Nothing matches</h3>
          <p>Try another product, variant, or stock filter.</p>
        </div>
      )}

      {shown.length > 0 && (
        <div className="table-wrap surface-table">
          <table className="responsive buy-table" data-testid="buy-table">
            <caption className="sr-only">Products and variants below minimum stock</caption>
            <thead>
              <tr>
                <th>Product</th>
                <th>Variant</th>
                <th className="num">
                  Current stock
                  <small>Items</small>
                </th>
                <th className="num">
                  Minimum stock
                  <small>Items</small>
                </th>
                <th className="num">
                  Desired stock
                  <small>Items</small>
                </th>
                <th className="num">
                  Purchase quantity
                  <small>Items</small>
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => {
                const open = market.state.purchases.find(
                  (purchase) => purchase.variantId === row.variant.id && purchase.status !== 'received',
                )
                return (
                  <tr
                    key={row.variant.id}
                    className={row.status}
                    data-testid="buy-row"
                    data-product={row.productName}
                    data-variant={row.variant.name}
                  >
                    <td data-label="Product">
                      <strong>{row.productName}</strong>
                    </td>
                    <td data-label="Variant">
                      <strong>{row.variant.name}</strong>
                      <div className="sku">{row.variant.sku}</div>
                      <StatusPill status={row.status} />
                    </td>
                    <td data-label="Current stock" className="num" data-testid="current-stock">
                      {row.variant.currentStock.toLocaleString()}
                      {row.onOrderItems > 0 && (
                        <div className="pending">{itemsLabel(row.onOrderItems)} on order</div>
                      )}
                    </td>
                    <td data-label="Minimum stock" className="num" data-testid="minimum-stock">
                      {row.variant.minimumStock.toLocaleString()}
                    </td>
                    <td data-label="Desired stock" className="num">
                      <DesiredField
                        value={row.variant.desiredStock}
                        label={`Desired stock for ${row.productName} ${row.variant.name}`}
                        onSave={(desired) => market.setDesired(row.productId, row.variant.id, desired)}
                      />
                    </td>
                    <td data-label="Purchase quantity" className="num purchase-cell">
                      <strong className="qty" data-testid="purchase-qty">
                        {row.calc.purchaseQty.toLocaleString()}
                      </strong>
                      <BoxMath calc={row.calc} />
                    </td>
                    <td data-label="Actions" className="actions">
                      <div className="row-actions">
                        <button type="button" className="btn small" onClick={() => setBuying(row)}>
                          Record purchase
                        </button>
                        {open && (
                          <button
                            type="button"
                            className="btn secondary small"
                            onClick={() => setReceiveId(open.id)}
                          >
                            Receive delivery
                          </button>
                        )}
                      </div>
                      {row.calc.boxes > 0 && (
                        <p className="hint action-hint">Suggested {boxesLabel(row.calc.boxes)}</p>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {buying && (
        <PurchaseDialog
          productId={buying.productId}
          variantId={buying.variant.id}
          productName={buying.productName}
          variantName={buying.variant.name}
          itemsPerBox={buying.variant.itemsPerBox}
          calc={buying.calc}
          onClose={() => setBuying(null)}
        />
      )}
      {receiving && <ReceivePurchaseDialog purchase={receiving} onClose={() => setReceiveId(null)} />}
    </section>
  )
}
