import { useMemo, useState } from 'react'
import { rupees } from '../format'
import { ProductPhoto } from '../components/ProductImageField'
import { useMarket } from '../store'
import { Icon } from '../components/Icon'
import { SelectBox } from '../components/SelectBox'

export function GlanceView() {
  const { state } = useMarket()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [layout, setLayout] = useState<'list' | 'grid'>('list')
  const rows = useMemo(() => state.products.flatMap(p => p.variants.map(v => ({ name: p.name, image: p.image, variant: v.name, price: v.price })))
    .filter(row => `${row.name} ${row.variant}`.toLowerCase().includes(query.toLowerCase()))
    .filter(row => filter === 'all' || (filter === 'priced' ? row.price > 0 : row.price === 0)), [state.products, query, filter])
  const text = rows.map(r => `${r.name}${r.variant ? ` (${r.variant})` : ''} — ${rupees(r.price)}`).join('\n')
  async function copy() { await navigator.clipboard.writeText(text); window.alert('Product list copied. You can paste it into WhatsApp.') }
  async function share() {
    const canvas = document.createElement('canvas'); canvas.width = 1000; canvas.height = Math.max(180, 100 + rows.length * 74)
    const ctx = canvas.getContext('2d'); if (!ctx) return
    ctx.fillStyle = '#fffdf8'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#20201e'; ctx.font = 'bold 30px sans-serif'; ctx.fillText('Product at a glance', 32, 48)
    ctx.font = '20px sans-serif'; rows.forEach((r, i) => { const y = 96 + i * 74; ctx.fillStyle = '#e7e3dc'; ctx.fillRect(24, y, 952, 1); ctx.fillStyle = '#20201e'; ctx.fillText(`${r.name}${r.variant ? ` (${r.variant})` : ''}`, 32, y + 42); ctx.textAlign = 'right'; ctx.fillText(rupees(r.price), 950, y + 42); ctx.textAlign = 'left' })
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png')); if (!blob) return
    const file = new File([blob], 'product-at-a-glance.png', { type: 'image/png' })
    if (navigator.share && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Product at a glance' })
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click(); URL.revokeObjectURL(a.href) }
  }
  return <section><div className="page-head"><div><h2><Icon name="eye" /> Product at a glance</h2><p className="lede">A shareable list of product names, photos and selling prices.</p></div></div>
    <div className="toolbar"><label className="search-input"><Icon name="search" /><input aria-label="Search products" placeholder="Search products" value={query} onChange={e => setQuery(e.target.value)} /></label><SelectBox aria-label="Filter products" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All products</option><option value="priced">With price</option><option value="free">No price</option></SelectBox><button className="chip" aria-pressed={layout === 'list'} onClick={() => setLayout('list')}><Icon name="list" /> List</button><button className="chip" aria-pressed={layout === 'grid'} onClick={() => setLayout('grid')}><Icon name="grid" /> Grid</button></div>
    <div className="row-actions glance-actions"><button className="btn" onClick={share}><Icon name="share" /> Share as image</button><button className="btn secondary" onClick={copy}><Icon name="copy" /> Copy as text</button></div>
    {layout === 'list' ? <div className="table-scroll"><table className="glance-table responsive"><thead><tr><th>Product</th><th>Image</th><th className="num">Selling price</th></tr></thead><tbody>{rows.map((r,i)=><tr key={`${r.name}-${r.variant}-${i}`}><td data-label="Product">{r.name}{r.variant && <small className="glance-variant">{r.variant}</small>}</td><td data-label="Image">{r.image ? <ProductPhoto src={r.image} name={r.name}/> : '—'}</td><td data-label="Selling price" className="num">{rupees(r.price)}</td></tr>)}</tbody></table></div> : <div className="glance-grid">{rows.map((r,i)=><article className="glance-card" key={`${r.name}-${r.variant}-${i}`}>{r.image ? <img src={r.image} alt=""/> : <div className="glance-placeholder"><Icon name="box" /></div>}<strong>{r.name}</strong>{r.variant && <small>{r.variant}</small>}<b>{rupees(r.price)}</b></article>)}</div>}
  </section>
}
