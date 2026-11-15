import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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
import { SellerInfoView } from './views/SellerInfoView'
import { GlanceView } from './views/GlanceView'
import { SettingsView } from './views/SettingsView'
import { StockView } from './views/StockView'
import { SellerBuyersView } from './views/SellerBuyersView'
import { Icon } from './components/Icon'

type Role = 'seller' | 'buyer'
type SellerView = 'products' | 'glance' | 'stock' | 'buy' | 'delivery' | 'accounts' | 'recent' | 'offers' | 'suppliers' | 'profile' | 'buyers' | 'settings'

type Route =
  | { role: 'seller'; view: SellerView }
  | { role: 'buyer'; view: 'buyers'; buyerId: string | null }
  | { role: 'buyer'; view: 'offers' }

const sellerLinks: Array<{ id: SellerView; label: string; icon: Parameters<typeof Icon>[0]['name'] }> = [
  { id: 'products', label: 'All products', icon: 'box' }, { id: 'glance', label: 'Product at a glance', icon: 'eye' },
  { id: 'stock', label: 'Add / remove stock', icon: 'box' },
  { id: 'buy', label: 'Need to buy', icon: 'cart' },
  { id: 'delivery', label: 'Delivery', icon: 'truck' }, { id: 'recent', label: 'Last added', icon: 'clock' },
  { id: 'offers', label: 'Offers', icon: 'tag' }, { id: 'suppliers', label: 'Supplier orders', icon: 'factory' },
  { id: 'profile', label: 'Seller info', icon: 'user' }, { id: 'settings', label: 'Settings', icon: 'settings' },
  { id: 'buyers', label: 'Buyer info', icon: 'buyer' },
  { id: 'accounts', label: 'Accounts', icon: 'receipt' },
]

const sellerGroups = [
  { label: 'Catalog', links: ['products', 'glance', 'recent'] },
  { label: 'Stock', links: ['stock', 'buy', 'suppliers'] },
  { label: 'Orders', links: ['delivery', 'offers'] },
  { label: 'Business', links: ['profile', 'buyers'] },
] as const

function readRoute(): Route {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (parts[0] === 'buyer') {
    if (parts[1] === 'offers') return { role: 'buyer', view: 'offers' }
    return { role: 'buyer', view: 'buyers', buyerId: parts[1] ?? null }
  }
  const view = parts[0] === 'seller' ? parts[1] : parts[0]
  if (!parts.length) return { role: 'buyer', view: 'buyers', buyerId: null }
  if (view === 'glance') return { role: 'seller', view: 'glance' }
  if (view === 'stock') return { role: 'seller', view: 'stock' }
  if (view === 'settings') return { role: 'seller', view: 'settings' }
  if (view === 'buyers') return { role: 'seller', view: 'buyers' }
  if (view === 'buy') return { role: 'seller', view: 'buy' }
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
  const { notice, dismissNotice, state } = useMarket()
  const [route, setRoute] = useState<Route>(readRoute)
  const [sellerUnlocked, setSellerUnlocked] = useState(false)
  const [sellerSessionChecked, setSellerSessionChecked] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [sellerLoginPending, setSellerLoginPending] = useState(false)
  const [openSellerMenu, setOpenSellerMenu] = useState<string | null>(null)
  const sellerMenuRef = useRef<HTMLDivElement>(null)
  const restockCount = buyRows(state).length

  useEffect(() => {
    function onHash() {
      setRoute(readRoute())
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    document.title = `${titleFor(route)} · Baji Market`
  }, [route])

  useEffect(() => {
    if (!notice) return
    const id = window.setTimeout(dismissNotice, 4500)
    return () => window.clearTimeout(id)
  }, [dismissNotice, notice])

  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      if (sellerMenuRef.current && !sellerMenuRef.current.contains(event.target as Node)) setOpenSellerMenu(null)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [])

  useEffect(() => {
    if (route.role !== 'seller') {
      setSellerSessionChecked(false)
      return
    }
    let cancelled = false
    setSellerSessionChecked(false)
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(async (response) => ({ response, body: await response.json().catch(() => null) }))
      .then(({ response, body }) => {
        if (cancelled) return
        const seller = response.ok && typeof body === 'object' && body !== null && 'account' in body && typeof body.account === 'object' && body.account !== null && 'role' in body.account && body.account.role === 'seller'
        setSellerUnlocked(seller)
        setSellerSessionChecked(true)
      })
      .catch(() => {
        if (!cancelled) {
          setSellerUnlocked(false)
          setSellerSessionChecked(true)
        }
      })
    return () => { cancelled = true }
  }, [route.role])

  function go(next: Route) {
    if (next.role === 'seller') window.location.hash = `/seller/${next.view}`
    else if (next.view === 'offers') window.location.hash = '/buyer/offers'
    else if (next.buyerId) window.location.hash = `/buyer/${next.buyerId}`
    else window.location.hash = '/buyer'
    setRoute(next)
  }

  const role: Role = route.role
  const locked = role === 'seller' && (!sellerSessionChecked || !sellerUnlocked)

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
              <p className="wordmark">Baji Market</p>
              <h1>{role === 'seller' ? 'Seller' : 'Buyer'}</h1>
            </div>
          </div>
          <div className="role-switch" role="group" aria-label="Desk">
            <button type="button" aria-pressed={role === 'seller'} onClick={() => { setPassword(''); setPasswordError(''); go({ role: 'seller', view: 'products' }) }}>
              <Icon name="store" /> Seller
            </button>
            <button
              type="button"
              aria-pressed={role === 'buyer'}
              onClick={() => go({ role: 'buyer', view: 'buyers', buyerId: null })}
            >
              <Icon name="buyer" /> Buyer
            </button>
          </div>
        </div>
        <div className="wrap">
          <nav className="subnav" aria-label={role === 'seller' ? 'Seller menu' : 'Buyer menu'}>
            {role === 'seller'
              ? <div className="seller-menu-groups" ref={sellerMenuRef}>
                  {sellerGroups.map((group) => <details className="seller-menu-group" key={group.label} open={openSellerMenu === group.label}><summary onClick={(event) => { event.preventDefault(); setOpenSellerMenu((current) => current === group.label ? null : group.label) }}>{group.label}<Icon name="caret" /></summary><div>{group.links.map((id) => {
                    const link = sellerLinks.find((item) => item.id === id)!
                    return <button key={link.id} type="button" aria-current={route.role === 'seller' && route.view === link.id ? 'page' : undefined} onClick={() => { setOpenSellerMenu(null); go({ role: 'seller', view: link.id }) }}><Icon name={link.icon} /> {link.label}{link.id === 'buy' && <span className="count" data-testid="restock-count">{restockCount}</span>}</button>
                  })}</div></details>)}
                  {(() => { const link = sellerLinks.find((item) => item.id === 'accounts')!; return <button className="seller-account-link" type="button" aria-current={route.role === 'seller' && route.view === link.id ? 'page' : undefined} onClick={() => { setOpenSellerMenu(null); go({ role: 'seller', view: link.id }) }}><Icon name={link.icon} /> {link.label}</button> })()}
                </div>
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
        {locked ? <section className="seller-lock"><h2><Icon name="lock" /> Seller access</h2>{!sellerSessionChecked ? <p>Checking seller session…</p> : <><p>Enter the seller password to continue.</p>{passwordError && <p className="error">{passwordError}</p>}<form onSubmit={async (event) => { event.preventDefault(); if (!password || sellerLoginPending) { if (!password) setPasswordError('Enter the seller password.'); return } setSellerLoginPending(true); try { const response = await fetch('/api/auth/seller/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) }); const body = await response.json().catch(() => null); if (!response.ok) { setPasswordError(typeof body?.error === 'string' ? body.error : 'Could not unlock Seller.'); return } setPassword(''); setPasswordError(''); setSellerUnlocked(true); setSellerSessionChecked(true) } catch { setPasswordError('Could not reach Seller access.') } finally { setSellerLoginPending(false) } }}><label className="field">Seller password<input type="password" autoFocus autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><button className="btn" type="submit" disabled={sellerLoginPending}>{sellerLoginPending ? <><span className="spinner" aria-hidden="true" /> Checking…</> : <><Icon name="unlock" /> Unlock seller</>}</button></form></>}</section> : null}
        {!locked && route.role === 'seller' && route.view === 'products' && <ProductsView />}
        {!locked && route.role === 'seller' && route.view === 'glance' && <GlanceView />}
        {!locked && route.role === 'seller' && route.view === 'stock' && <StockView />}
        {!locked && route.role === 'seller' && route.view === 'settings' && <SettingsView />}
        {!locked && route.role === 'seller' && route.view === 'buyers' && <SellerBuyersView />}
        {!locked && route.role === 'seller' && route.view === 'buy' && <NeedToBuyView />}
        {!locked && route.role === 'seller' && route.view === 'delivery' && <DeliveryView />}
        {!locked && route.role === 'seller' && route.view === 'accounts' && <AccountsView />}
        {!locked && route.role === 'seller' && route.view === 'recent' && <RecentView />}
        {!locked && route.role === 'seller' && route.view === 'offers' && <OffersView editable />}
        {!locked && route.role === 'seller' && route.view === 'suppliers' && <HistoryView />}
        {!locked && route.role === 'seller' && route.view === 'profile' && <SellerInfoView />}
        {route.role === 'buyer' && route.view === 'buyers' && (
          <BuyerDesk
            buyerId={route.buyerId}
            onOpenBuyer={(buyerId) => go({ role: 'buyer', view: 'buyers', buyerId })}
          />
        )}
        {route.role === 'buyer' && route.view === 'offers' && <OffersView editable={false} />}
        <footer className="footer">
          <p>Saved in the shop database.</p>
        </footer>
      </main>
      <footer className="site-footer">
        {role === 'seller' && <button type="button" className="footer-settings" aria-current={route.role === 'seller' && route.view === 'settings' ? 'page' : undefined} onClick={() => go({ role: 'seller', view: 'settings' })}><Icon name="settings" /> Settings</button>}
        <p>Developer: Soumya Pal</p>
        <p>Business owner: Rupsa Datta</p>
      </footer>
    </div>
  )
}
