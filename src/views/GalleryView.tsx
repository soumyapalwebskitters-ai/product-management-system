import { useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { ProductSelect, type SelectOption } from '../components/ProductSelect'
import { useMarket } from '../store'
import type { SearchMode } from '../search'
import { normalizeDriveImageUrl } from '../gallery'

export function GalleryView() {
  const { state, addGalleryImage, removeGalleryImage } = useMarket()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<SearchMode>('smart')
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const options = useMemo<SelectOption[]>(() => state.products.flatMap((product) => product.variants.map((variant) => ({ id: variant.id, title: `${product.name} - ${variant.name || 'Standard'}`, meta: variant.sku, searchText: `${product.name} ${variant.name} ${variant.sku}` }))), [state.products])
  const linked = state.gallery ?? []

  function save() {
    if (!selectedId) { setError('Choose a product variant.'); return }
    const cleanUrl = url.trim()
    if (!cleanUrl) { setError('Paste a Google Drive image URL.'); return }
    try {
      const parsed = new URL(cleanUrl)
      if (!/^https?:$/.test(parsed.protocol)) throw new Error('invalid protocol')
    } catch {
      setError('Enter a valid image URL.')
      return
    }
    const product = state.products.find((item) => item.variants.some((variant) => variant.id === selectedId))
    if (!product) { setError('Choose a valid product variant.'); return }
    const result = addGalleryImage({ productId: product.id, variantId: selectedId, url: normalizeDriveImageUrl(cleanUrl) })
    if (!result.ok) { setError(result.error); return }
    setUrl(''); setQuery(''); setSelectedId(null); setError(null)
  }

  return <section className="gallery-page">
    <div className="page-head"><div><h2><Icon name="eye" /> Gallery</h2><p className="lede">Add Google Drive image links and assign them to a product variant.</p></div></div>
    <section className="gallery-add settings-card">
      <h3>Add gallery image</h3><p className="hint">Set the Drive file to “Anyone with the link” and paste its share URL.</p>
      <ProductSelect label="Choose product variant" placeholder="Search product or variant" options={options} query={query} mode={mode} selectedId={selectedId} onQueryChange={setQuery} onModeChange={setMode} onSelect={setSelectedId} />
      <label className="field"><span>Google Drive image URL</span><input type="url" value={url} placeholder="https://drive.google.com/uc?id=..." onChange={(event) => setUrl(event.target.value)} /></label>
      {url && <img className="gallery-preview" src={normalizeDriveImageUrl(url)} alt="Preview" onError={(event) => { event.currentTarget.style.display = 'none' }} onLoad={(event) => { event.currentTarget.style.display = 'block' }} />}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="dialog-actions"><button type="button" className="btn" onClick={save}>Add to gallery</button></div>
    </section>
    <section className="gallery-grid" aria-label="Product gallery">
      {linked.length === 0 ? <div className="empty"><Icon name="eye" /><h3>No gallery images yet</h3><p>Add a Drive image and assign it to a variant.</p></div> : linked.map((item) => {
        const product = state.products.find((entry) => entry.id === item.productId)
        const variant = product?.variants.find((entry) => entry.id === item.variantId)
        return <article className="gallery-card" key={item.id}><img src={item.url} alt={`${product?.name ?? 'Product'} ${variant?.name ?? 'Variant'}`} /><div><strong>{product?.name ?? 'Product removed'}</strong><span>{variant?.name || 'Standard'}</span></div><button type="button" className="btn danger-text small" onClick={() => removeGalleryImage(item.id)}>Remove</button></article>
      })}
    </section>
  </section>
}

