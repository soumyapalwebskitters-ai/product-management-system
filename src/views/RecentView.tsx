import { formatWhen, rupees } from '../format'
import { useMarket } from '../store'

export function RecentView() {
  const { state } = useMarket()
  const products = [...state.products].sort((left, right) => right.createdAt.localeCompare(left.createdAt))

  return (
    <section data-testid="view-recent">
      <div className="page-head">
        <div>
          <h2>Last items added</h2>
          <p className="lede">Products are listed from the newest addition to the oldest.</p>
        </div>
      </div>
      {products.length === 0 ? (
        <div className="empty">
          <h3>No products yet</h3>
          <p>Add a product from All products and it will show up here.</p>
        </div>
      ) : (
        <div className="catalog">
          {products.map((product, index) => (
            <article key={product.id} className="product-card">
              <header className="product-head">
                <div>
                  <h3>{product.name}</h3>
                  <p>
                    {index === 0 ? 'Newest · ' : ''}
                    Added {formatWhen(product.createdAt)}
                  </p>
                </div>
              </header>
              <ul className="recent-list">
                {product.variants.map((variant) => (
                  <li key={variant.id}>
                    <strong>
                      {variant.name} · {variant.sku}
                    </strong>
                    <span>
                      {rupees(variant.price)} · {variant.currentStock.toLocaleString()} in stock
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
