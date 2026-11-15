import { useMemo, useState } from 'react'
import { rupees } from '../format'
import { ProductPhoto } from '../components/ProductImageField'
import { useMarket } from '../store'
import { Icon } from '../components/Icon'
import { SelectBox } from '../components/SelectBox'
import { openMailto } from '../mailto'
import type { Variant } from '../types'

function sellingDisplay(variant: Variant) {
  const isBox = variant.sellingUnit === 'box'
  return { amount: isBox ? variant.price * Math.max(1, variant.itemsPerBox) : variant.price, unit: isBox ? 'box' : 'piece' }
}

function sellingText(variant: Variant) {
  const display = sellingDisplay(variant)
  return `${rupees(display.amount)} / ${display.unit}`
}

export function GlanceView() {
  const { state } = useMarket()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [layout, setLayout] = useState<'list' | 'grid'>('list')
  const [emailMessage, setEmailMessage] = useState<string | null>(null)
  const [emailing, setEmailing] = useState(false)
  const groups = useMemo(
    () =>
      state.products
        .map((product) => ({
          product,
          variants: product.variants.filter((variant) => {
            const matches = `${product.name} ${variant.name}`.toLowerCase().includes(query.toLowerCase())
            const hasPrice = filter === 'all' || (filter === 'priced' ? variant.price > 0 : variant.price === 0)
            return matches && hasPrice
          }),
        }))
        .filter((group) => group.variants.length > 0),
    [state.products, query, filter],
  )
  const text = groups
    .map(({ product, variants }) =>
      `${product.name}\n${variants.map((variant) => `  ${variant.name || 'Standard'} — ${rupees(variant.price)}`).join('\n')}`,
    )
    .join('\n\n')
  const messageText = groups.map(({ product, variants }) => [product.name, ...variants.map((variant) => `  ${variant.name || 'Standard'} - ${sellingText(variant)}`)].join('\n')).join('\n\n')
  void text

  async function copy() {
    await navigator.clipboard.writeText(messageText)
    window.alert('Product list copied. You can paste it into WhatsApp.')
  }

  async function share() {
    const scale = 2
    const width = 1600
    const rowHeight = 86
    const groupHeight = 54
    const height = Math.max(220, 150 + groups.reduce((sum, group) => sum + groupHeight + group.variants.length * rowHeight, 0))
    const canvas = document.createElement('canvas')
    canvas.width = width * scale
    canvas.height = height * scale
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(scale, scale)
    ctx.fillStyle = '#fffdf8'
    ctx.fillRect(0, 0, width, height)
    ctx.fillStyle = '#20201e'
    ctx.font = 'bold 44px sans-serif'
    ctx.fillText('Product at a glance', 48, 64)
    let y = 116
    for (const { product, variants } of groups) {
      ctx.fillStyle = '#e7e3dc'
      ctx.fillRect(40, y, width - 80, 2)
      y += 42
      ctx.fillStyle = '#20201e'
      ctx.font = 'bold 34px sans-serif'
      ctx.fillText(product.name, 48, y)
      y += 18
      ctx.font = '30px sans-serif'
      for (const variant of variants) {
        y += rowHeight - 18
        ctx.fillStyle = '#55534e'
        ctx.fillText(variant.name || 'Standard', 72, y)
        ctx.textAlign = 'right'
        ctx.fillStyle = '#20201e'
        ctx.fillText(sellingText(variant), width - 48, y)
        ctx.textAlign = 'left'
      }
      y += 24
    }
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) return
    const file = new File([blob], 'product-at-a-glance.png', { type: 'image/png' })
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Product at a glance' })
    } else {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = file.name
      a.click()
      URL.revokeObjectURL(a.href)
    }
  }

  async function emailReport() {
    setEmailing(true)
    const opened = openMailto(state.seller?.email, `${state.seller?.businessName || 'Baji Market'}: Product at a glance`, messageText)
    setEmailMessage(opened ? 'Email draft opened.' : 'Save a valid seller email first.')
    setEmailing(false)
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <h2><Icon name="eye" /> Product at a glance</h2>
          <p className="lede">A shareable list of products grouped with their variants and selling prices.</p>
        </div>
      </div>
      <div className="toolbar">
        <label className="search-input"><Icon name="search" /><input aria-label="Search products" placeholder="Search products" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <SelectBox aria-label="Filter products" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All products</option><option value="priced">With price</option><option value="free">No price</option></SelectBox>
        <button className="chip" aria-pressed={layout === 'list'} onClick={() => setLayout('list')}><Icon name="list" /> List</button>
        <button className="chip" aria-pressed={layout === 'grid'} onClick={() => setLayout('grid')}><Icon name="grid" /> Grid</button>
      </div>
      <div className="row-actions glance-actions"><button className="btn" onClick={share}><Icon name="share" /> Share as image</button><button className="btn secondary" onClick={copy}><Icon name="copy" /> Copy as text</button><button className="btn secondary" onClick={emailReport} disabled={emailing}><Icon name="mail" /> {emailing ? 'Emailing…' : 'Email list'}</button></div>
      {emailMessage && <p className="hint" role="status">{emailMessage}</p>}
      {groups.length === 0 ? (
        <div className="empty"><h3>No products match</h3><p>Try another search or price filter.</p></div>
      ) : layout === 'list' ? (
        <div className="table-scroll">
          <table className="glance-table responsive">
            <thead><tr><th>Product</th><th>Image</th><th>Variant</th><th>Variant image</th><th className="num">Selling price</th></tr></thead>
            <tbody>
              {groups.flatMap(({ product, variants }) =>
                variants.map((variant, index) => (
                  <tr key={`${product.id}-${variant.name}-${index}`} className={index === 0 ? 'product-group-start' : undefined}>
                    {index === 0 && <td data-label="Product" rowSpan={variants.length}><strong>{product.name}</strong></td>}
                    {index === 0 && <td data-label="Image" rowSpan={variants.length}>{product.image ? <ProductPhoto src={product.image} name={product.name} /> : '—'}</td>}
                    <td data-label="Variant">{variant.name || 'Standard'}</td><td data-label="Variant image">{variant.image ? <ProductPhoto src={variant.image} name={`${product.name} ${variant.name || 'Standard'}`} /> : '-'}</td>
                    <td data-label="Selling price" className="num">{sellingText(variant)}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="glance-grid">
          {groups.map(({ product, variants }) => (
            <article className="glance-card" key={product.id}>
              {product.image ? <img src={product.image} alt="" /> : <div className="glance-placeholder"><Icon name="box" /></div>}
              <strong>{product.name}</strong>
              <div className="glance-variants">
                {variants.map((variant, index) => (
                  <div className="glance-variant-row" key={`${variant.name}-${index}`}>
                    <span>{variant.name || 'Standard'}</span><b>{sellingText(variant)}</b>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
