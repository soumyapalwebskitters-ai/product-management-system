import { useEffect, useLayoutEffect, useState } from 'react'
import { ConfirmDialog } from './components/Dialog'
import { buyRows } from './inventory'
import { useMarket } from './store'
import { BuyerDesk } from './views/BuyerDesk'
import { HistoryView } from './views/HistoryView'
import { NeedToBuyView } from './views/NeedToBuyView'
import { OffersView } from './views/OffersView'
import { ProductsView } from './views/ProductsView'
import { RecentView } from './views/RecentView'
import { AccountsView } from './views/AccountsView'
import { DeliveryView } from './views/DeliveryView'
import { SalesView } from './views/SalesView'
import { SellerInfoView } from './views/SellerInfoView'

type Role = 'seller' | 'buyer'
type SellerView = 'products' | 'buy' | 'sales' | 'delivery' | 'accounts' | 'recent' | 'offers' | 'suppliers' | 'profile'

type Route =
  | { role: 'seller'; view: SellerView }
  | { role: 'buyer'; view: 'buyers'; buyerId: string | null }
  | { role: 'buyer'; view: 'offers' }

const sellerLinks: Array<{ id: SellerView; label: string }> = [
  { id: 'products', label: 'All products' },
  { id: 'buy', label: 'Need to buy' },
  { id: 'sales', label: 'Sell history' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'recent', label: 'Last added' },
  { id: 'offers', label: 'Offers' },
  { id: 'suppliers', label: 'Supplier orders' },
  { id: 'profile', label: 'Seller info' },
]

function readRoute(): Route {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (parts[0] === 'buyer') {
    if (parts[1] === 'offers') return { role: 'buyer', view: 'offers' }
    return { role: 'buyer', view: 'buyers', buyerId: parts[1] ?? null }
  }
  const view = parts[0] === 'seller' ? parts[1] : parts[0]
  if (view === 'buy') return { role: 'seller', view: 'buy' }
  if (view === 'sales') return { role: 'seller', view: 'sales' }
  if (view === 'delivery') return { role: 'seller', view: 'delivery' }
  if (view === 'accounts') return { role: 'seller', view: 'accounts' }
  if (view === 'recent') return { role: 'seller', view: 'recent' }
  if (view === 'offers') return { role: 'seller', view: 'offers' }
  if (view === 'suppliers' || view === 'history') return { role: 'seller', view: 'suppliers' }
  if (view === 'profile') return { role: 'seller', view: 'profile' }
  return { role: 'seller', view: 'products' }
}

function titleFor(route: Route) {
  if (route.role === 'buyer') return route.view === 'offers' ? 'Offers' : 'Buyers'
  return sellerLinks.find((link) => link.id === route.view)?.label ?? 'All products'
}

export function App() {
  const { notice, dismissNotice, resetDemo, state } = useMarket()
  const [route, setRoute] = useState<Route>(readRoute)
  const [confirmReset, setConfirmReset] = useState(false)
  const restockCount = buyRows(state).length

  useEffect(() => {
    function onHash() {
      setRoute(readRoute())
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    document.title = `${titleFor(route)} · Market`
  }, [route])

  useEffect(() => {
    if (!notice) return
    const id = window.setTimeout(dismissNotice, 4500)
    return () => window.clearTimeout(id)
  }, [dismissNotice, notice])

  function go(next: Route) {
    if (next.role === 'seller') window.location.hash = `/seller/${next.view}`
    else if (next.view === 'offers') window.location.hash = '/buyer/offers'
    else if (next.buyerId) window.location.hash = `/buyer/${next.buyerId}`
    else window.location.hash = '/buyer'
    setRoute(next)
  }

  const role: Role = route.role

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = role === 'seller' ? 'dark' : 'light'
  }, [role])

  return (
    <div className="app">
      <header className="topbar">
        <div className="wrap topbar-inner">
          <div className="brand-lockup">
            <div className="mark" aria-hidden="true">
              M
            </div>
            <div>
              <p className="wordmark">Market</p>
              <h1>{role === 'seller' ? 'Seller' : 'Buyer'}</h1>
            </div>
          </div>
          <div className="role-switch" role="group" aria-label="Desk">
            <button type="button" aria-pressed={role === 'seller'} onClick={() => go({ role: 'seller', view: 'products' })}>
              Seller
            </button>
            <button
              type="button"
              aria-pressed={role === 'buyer'}
              onClick={() => go({ role: 'buyer', view: 'buyers', buyerId: null })}
            >
              Buyer
            </button>
          </div>
        </div>
        <div className="wrap">
          <nav className="subnav" aria-label={role === 'seller' ? 'Seller menu' : 'Buyer menu'}>
            {role === 'seller'
              ? sellerLinks.map((link) => (
                  <button
                    key={link.id}
                    type="button"
                    aria-current={route.role === 'seller' && route.view === link.id ? 'page' : undefined}
                    onClick={() => go({ role: 'seller', view: link.id })}
                  >
                    {link.label}
                    {link.id === 'buy' && (
                      <span className="count" data-testid="restock-count">
                        {restockCount}
                      </span>
                    )}
                  </button>
                ))
              : (
                <>
                  <button
                    type="button"
                    aria-current={route.role === 'buyer' && route.view === 'buyers' && !route.buyerId ? 'page' : undefined}
                    onClick={() => go({ role: 'buyer', view: 'buyers', buyerId: null })}
                  >
                    All buyers
                  </button>
                  <button
                    type="button"
                    aria-current={route.role === 'buyer' && route.view === 'offers' ? 'page' : undefined}
                    onClick={() => go({ role: 'buyer', view: 'offers' })}
                  >
                    Offers
                  </button>
                </>
              )}
          </nav>
        </div>
      </header>

      <main className="wrap">
        {notice && (
          <div className="notice" role="status">
            <p>{notice}</p>
            <button type="button" onClick={dismissNotice}>
              Close
            </button>
          </div>
        )}
        {route.role === 'seller' && route.view === 'products' && <ProductsView />}
        {route.role === 'seller' && route.view === 'buy' && <NeedToBuyView />}
        {route.role === 'seller' && route.view === 'sales' && <SalesView />}
        {route.role === 'seller' && route.view === 'delivery' && <DeliveryView />}
        {route.role === 'seller' && route.view === 'accounts' && <AccountsView />}
        {route.role === 'seller' && route.view === 'recent' && <RecentView />}
        {route.role === 'seller' && route.view === 'offers' && <OffersView editable />}
        {route.role === 'seller' && route.view === 'suppliers' && <HistoryView />}
        {route.role === 'seller' && route.view === 'profile' && <SellerInfoView />}
        {route.role === 'buyer' && route.view === 'buyers' && (
          <BuyerDesk
            buyerId={route.buyerId}
            onOpenBuyer={(buyerId) => go({ role: 'buyer', view: 'buyers', buyerId })}
          />
        )}
        {route.role === 'buyer' && route.view === 'offers' && <OffersView editable={false} />}
        <footer className="footer">
          <p>Saved in the shop database.</p>
          <button type="button" className="btn secondary small" onClick={() => setConfirmReset(true)}>
            Restore sample data
          </button>
        </footer>
      </main>
      <footer className="site-footer">
        <p>Developer: Soumya Pal</p>
        <p>Business owner: Rupsa Datta</p>
      </footer>

      {confirmReset && (
        <ConfirmDialog
          title="Restore the sample catalog?"
          body={
            role === 'seller'
              ? 'This replaces products, stock, buyers, purchases, and offers with the sample data.'
              : 'This replaces the catalog, buyers, purchases, and offers with the sample data.'
          }
          confirmLabel="Restore sample data"
          danger
          onClose={() => setConfirmReset(false)}
          onConfirm={() => {
            resetDemo()
            setConfirmReset(false)
          }}
        />
      )}
    </div>
  )
}
