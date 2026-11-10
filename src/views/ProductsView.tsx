import { useMemo, useState } from 'react'
import { ConfirmDialog, Dialog } from '../components/Dialog'
import { DesiredField } from '../components/DesiredField'
import { ProductForm } from '../components/ProductForm'
import { StatusPill } from '../components/Status'
import { AdjustDialog, PurchaseDialog, ReceiveDialog, SaleDialog } from '../components/StockDialogs'
import { boxesLabel, rupees } from '../format'
import { calcPurchase, needsRestock } from '../purchase'
import { catalogStats, onOrderItems, stockStatus } from '../inventory'
import { ProductSelect, type SelectOption } from '../components/ProductSelect'
import { matchesQuery, type SearchMode } from '../search'
import { useMarket } from '../store'
import type { Product, Variant } from '../types'

type StockFilter = 'all' | 'short' | 'ok'
type StockMode = 'sale' | 'adjust' | 'receive'

export function ProductsView() {
  const market = useMarket()
  const { state } = market
  const [query, setQuery] = useState('')
  const [searchMode, setSearchMode] = useState<SearchMode>('smart')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<StockFilter>('all')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null)
  const [stockTarget, setStockTarget] = useState<{
    mode: StockMode
    product: Product
    variant: Variant
  } | null>(null)
  const [buying, setBuying] = useState<{ product: Product; variant: Variant } | null>(null)

  const stats = catalogStats(state)
  const visible = useMemo(
    () =>
      state.products
        .map((product) => ({
          product,
          variants: matchingVariants(product, filter, query, searchMode, selectedId),
        }))
        .filter((entry) => entry.variants.length > 0),
    [filter, query, searchMode, selectedId, state.products],
  )
  const options = useMemo<SelectOption[]>(
    () =>
      state.products.flatMap((product) =>
        product.variants.map((variant) => ({
          id: variant.id,
          title: `${product.name} · ${variant.name}`,
          meta: variant.sku,
          searchText: `${product.name} ${variant.name} ${variant.sku}`,
        })),
      ),
    [state.products],
  )

  return (
    <section data-testid="view-products">
      <div className="page-head">
        <div>
          <h2>All products</h2>
          <p className="lede">
            Every variant is in one table. Unit price times items per box is the box price. Unit price
            times current stock is the stock value.
          </p>
        </div>
        <button type="button" className="btn" onClick={() => setCreating(true)}>
          Add product
        </button>
      </div>

      <div className="summary" aria-label="Catalog summary">
        <article>
          <strong>{stats.products}</strong>
          <span>Products</span>
        </article>
        <article>
          <strong>{stats.variants}</strong>
          <span>Variants</span>
        </article>
        <button
          type="button"
          className={filter === 'short' ? 'stat active' : 'stat'}
          onClick={() => setFilter(filter === 'short' ? 'all' : 'short')}
        >
          <strong>{stats.low + stats.out}</strong>
          <span>
            {stats.out} out · {stats.low} low
          </span>
        </button>
        <button
          type="button"
          className={filter === 'ok' ? 'stat active' : 'stat'}
          onClick={() => setFilter(filter === 'ok' ? 'all' : 'ok')}
        >
          <strong>{stats.variants - stats.low - stats.out}</strong>
          <span>In stock</span>
        </button>
      </div>

      <div className="toolbar">
        <ProductSelect
          label="Search products"
          placeholder="Select a product"
          options={options}
          query={query}
          mode={searchMode}
          selectedId={selectedId}
          onQueryChange={setQuery}
          onModeChange={setSearchMode}
          onSelect={setSelectedId}
        />
        <div className="filters" role="group" aria-label="Stock filter">
          {(
            [
              ['all', 'All'],
              ['short', 'Low or out'],
              ['ok', 'In stock'],
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

      {state.products.length === 0 && (
        <div className="empty">
          <h3>No products yet</h3>
          <p>Add a product and its variants to start tracking stock.</p>
          <button type="button" className="btn" onClick={() => setCreating(true)}>
            Add product
          </button>
        </div>
      )}

      {state.products.length > 0 && visible.length === 0 && (
        <div className="empty">
          <h3>Nothing matches</h3>
          <p>Try another name, SKU, or stock filter.</p>
        </div>
      )}

      {visible.length > 0 && (
        <div className="table-scroll" data-testid="product-table">
          <table className="catalog-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Variant</th>
                <th>SKU</th>
                <th className="num">Unit price</th>
                <th className="num">Per box</th>
                <th className="num">Box price</th>
                <th className="num">Current</th>
                <th className="num">Stock value</th>
                <th className="num">Minimum</th>
                <th className="num">Desired</th>
                <th>Status</th>
                <th className="num">To buy</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.flatMap(({ product, variants }) =>
                variants.map((variant, index) => {
                  const status = stockStatus(variant)
                  const calc = calcPurchase(
                    variant.currentStock,
                    variant.desiredStock,
                    variant.itemsPerBox,
                  )
                  const pending = onOrderItems(state, variant.id)
                  const coverage =
                    variant.desiredStock <= 0
                      ? variant.currentStock > 0
                        ? 100
                        : 0
                      : Math.max(0, Math.min(100, Math.round((variant.currentStock / variant.desiredStock) * 100)))
                  const boxPrice = variant.price * variant.itemsPerBox
                  const stockValue = variant.price * variant.currentStock
                  return (
                    <tr key={variant.id} className={status === 'ok' ? undefined : status}>
                      {index === 0 && (
                        <td className="product-cell" rowSpan={variants.length}>
                          <strong>{product.name}</strong>
                          <div className="row-actions">
                            <button type="button" className="btn secondary small" onClick={() => setEditing(product)}>
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn danger-text small"
                              onClick={() => setPendingDelete(product)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      )}
                      <td>
                        <strong>{variant.name}</strong>
                        {pending > 0 && <div className="pending">{pending.toLocaleString()} on order</div>}
                      </td>
                      <td className="sku">{variant.sku}</td>
                      <td className="num">{rupees(variant.price)}</td>
                      <td className="num">{variant.itemsPerBox.toLocaleString()}</td>
                      <td className="num">{rupees(boxPrice)}</td>
                      <td className="num">
                        {variant.currentStock.toLocaleString()}
                        <div className={`meter ${status}`} aria-hidden="true">
                          <span style={{ width: `${coverage}%` }} />
                        </div>
                      </td>
                      <td className="num">{rupees(stockValue)}</td>
                      <td className="num">{variant.minimumStock.toLocaleString()}</td>
                      <td className="num">
                        <DesiredField
                          value={variant.desiredStock}
                          label={`Desired stock for ${product.name} ${variant.name}`}
                          onSave={(desired) => market.setDesired(product.id, variant.id, desired)}
                        />
                      </td>
                      <td>
                        <StatusPill status={status} />
                      </td>
                      <td className="num">
                        {needsRestock(variant.currentStock, variant.minimumStock) ? (
                          <span className="to-buy">
                            {calc.purchaseQty.toLocaleString()}
                            {calc.boxes > 0 && <small>{boxesLabel(calc.boxes)}</small>}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="actions">
                        <div className="row-actions">
                          <button
                            type="button"
                            className="btn secondary small"
                            disabled={variant.currentStock <= 0}
                            title={variant.currentStock <= 0 ? 'Nothing in stock' : undefined}
                            onClick={() => setStockTarget({ mode: 'sale', product, variant })}
                          >
                            Sell
                          </button>
                          <button
                            type="button"
                            className="btn secondary small"
                            onClick={() => setStockTarget({ mode: 'adjust', product, variant })}
                          >
                            Adjust
                          </button>
                          <button
                            type="button"
                            className="btn secondary small"
                            onClick={() => setStockTarget({ mode: 'receive', product, variant })}
                          >
                            Receive
                          </button>
                          {status !== 'ok' && (
                            <button
                              type="button"
                              className="btn small"
                              onClick={() => setBuying({ product, variant })}
                            >
                              Buy
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                }),
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={7}>Stock value of the rows above</td>
                <td className="num">
                  {rupees(
                    visible.reduce(
                      (sum, entry) =>
                        sum + entry.variants.reduce((inner, variant) => inner + variant.price * variant.currentStock, 0),
                      0,
                    ),
                  )}
                </td>
                <td colSpan={5} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {creating && (
        <Dialog title="Add product" onClose={() => setCreating(false)} wide closeOnBackdrop={false}>
          <ProductForm
            submitLabel="Save product"
            onCancel={() => setCreating(false)}
            onSubmit={(input) => {
              const result = market.addProduct(input)
              if (result.ok) setCreating(false)
              return result
            }}
          />
        </Dialog>
      )}

      {editing && (
        <Dialog
          title="Edit product"
          subtitle={editing.name}
          onClose={() => setEditing(null)}
          wide
          closeOnBackdrop={false}
        >
          <ProductForm
            product={editing}
            submitLabel="Save changes"
            onCancel={() => setEditing(null)}
            onSubmit={(input) => {
              const result = market.updateProduct(editing.id, input)
              if (result.ok) setEditing(null)
              return result
            }}
          />
        </Dialog>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={`Delete ${pendingDelete.name}?`}
          body="The product and its variants leave the catalog. Purchase history is kept."
          confirmLabel="Delete product"
          danger
          onClose={() => setPendingDelete(null)}
          onConfirm={() => {
            market.deleteProduct(pendingDelete.id)
            setPendingDelete(null)
          }}
        />
      )}

      {stockTarget?.mode === 'sale' && (
        <SaleDialog
          productId={stockTarget.product.id}
          variantId={stockTarget.variant.id}
          productName={stockTarget.product.name}
          variantName={stockTarget.variant.name}
          currentStock={stockTarget.variant.currentStock}
          onClose={() => setStockTarget(null)}
        />
      )}
      {stockTarget?.mode === 'adjust' && (
        <AdjustDialog
          productId={stockTarget.product.id}
          variantId={stockTarget.variant.id}
          productName={stockTarget.product.name}
          variantName={stockTarget.variant.name}
          currentStock={stockTarget.variant.currentStock}
          onClose={() => setStockTarget(null)}
        />
      )}
      {stockTarget?.mode === 'receive' && (
        <ReceiveDialog
          productId={stockTarget.product.id}
          variantId={stockTarget.variant.id}
          productName={stockTarget.product.name}
          variantName={stockTarget.variant.name}
          onClose={() => setStockTarget(null)}
        />
      )}
      {buying && (
        <PurchaseDialog
          productId={buying.product.id}
          variantId={buying.variant.id}
          productName={buying.product.name}
          variantName={buying.variant.name}
          itemsPerBox={buying.variant.itemsPerBox}
          calc={calcPurchase(
            buying.variant.currentStock,
            buying.variant.desiredStock,
            buying.variant.itemsPerBox,
          )}
          onClose={() => setBuying(null)}
        />
      )}
    </section>
  )
}

function matchingVariants(
  product: Product,
  filter: StockFilter,
  query: string,
  mode: SearchMode,
  selectedId: string | null,
) {
  return product.variants.filter((variant) => {
    const status = stockStatus(variant)
    if (filter === 'short' && status === 'ok') return false
    if (filter === 'ok' && status !== 'ok') return false
    if (selectedId) return variant.id === selectedId
    return matchesQuery(`${product.name} ${variant.name} ${variant.sku}`, query, mode)
  })
}
