import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { ProductSelect, type SelectOption } from '../components/ProductSelect'
import { useMarket } from '../store'
import type { SearchMode } from '../search'
import { galleryImageSrc, normalizeDriveImageUrl } from '../gallery'

type GalleryEntry = { id: string; url: string; label: string }

export function GalleryView() {
  const { state, addGalleryImage, removeGalleryImage } = useMarket()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<SearchMode>('smart')
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<{ items: GalleryEntry[]; index: number } | null>(null)
  const options = useMemo<SelectOption[]>(() => state.products.flatMap((product) => product.variants.map((variant) => ({ id: variant.id, title: `${product.name} - ${variant.name || 'Standard'}`, meta: variant.sku, searchText: `${product.name} ${variant.name} ${variant.sku}` }))), [state.products])
  const linked = state.gallery ?? []
  const groups = useMemo(() => {
    const result = new Map<string, { productName: string; items: Array<{ item: (typeof linked)[number]; variantName: string }> }>()
    for (const item of linked) {
      const product = state.products.find((entry) => entry.id === item.productId)
      const variant = product?.variants.find((entry) => entry.id === item.variantId)
      const group = result.get(item.productId) ?? { productName: product?.name ?? 'Product removed', items: [] }
      group.items.push({ item, variantName: variant?.name || 'Standard' })
      result.set(item.productId, group)
    }
    return [...result.values()]
  }, [linked, state.products])

  useEffect(() => {
    if (!lightbox) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightbox(null)
      if (event.key === 'ArrowLeft') setLightbox((current) => current ? { ...current, index: (current.index - 1 + current.items.length) % current.items.length } : current)
      if (event.key === 'ArrowRight') setLightbox((current) => current ? { ...current, index: (current.index + 1) % current.items.length } : current)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [lightbox])

  async function save() {
    if (!selectedId) { setError('Choose a product variant.'); return }
    const cleanUrl = url.trim()
    if (!cleanUrl) { setError('Paste a Google Drive image URL.'); return }
    try {
      const parsed = new URL(cleanUrl)
      if (!/^https?:$/.test(parsed.protocol)) throw new Error('invalid protocol')
    } catch { setError('Enter a valid image URL.'); return }
    const product = state.products.find((item) => item.variants.some((variant) => variant.id === selectedId))
    if (!product) { setError('Choose a valid product variant.'); return }
    const result = await addGalleryImage({ productId: product.id, variantId: selectedId, url: normalizeDriveImageUrl(cleanUrl) })
    if (!result.ok) { setError(result.error); return }
    setUrl(''); setQuery(''); setSelectedId(null); setError(null)
  }

  async function remove(id: string) {
    const result = await removeGalleryImage(id)
    if (!result.ok) setError(result.error)
  }

  return <section className="gallery-page">
    <div className="page-head"><div><h2><Icon name="eye" /> Gallery</h2><p className="lede">Add Google Drive image links and assign them to a product variant.</p></div></div>
    <section className="gallery-add settings-card">
      <h3>Add gallery image</h3><p className="hint">Set the Drive file to “Anyone with the link” and paste its share URL.</p>
      <ProductSelect label="Choose product variant" placeholder="Search product or variant" options={options} query={query} mode={mode} selectedId={selectedId} onQueryChange={setQuery} onModeChange={setMode} onSelect={setSelectedId} />
      <label className="field"><span>Google Drive image URL</span><input type="url" value={url} placeholder="https://drive.google.com/uc?id=..." onChange={(event) => setUrl(event.target.value)} /></label>
      {url && <img className="gallery-preview" src={galleryImageSrc(normalizeDriveImageUrl(url))} alt="Preview" onError={(event) => { event.currentTarget.style.display = 'none' }} onLoad={(event) => { event.currentTarget.style.display = 'block' }} />}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="dialog-actions"><button type="button" className="btn" onClick={save}>Add to gallery</button></div>
    </section>
    <section className="gallery-groups" aria-label="Product gallery">
      {linked.length === 0 ? <div className="empty"><Icon name="eye" /><h3>No gallery images yet</h3><p>Add a Drive image and assign it to a variant.</p></div> : groups.map((group) => {
        const items = group.items.map(({ item, variantName }) => ({ id: item.id, url: item.url, label: `${group.productName} · ${variantName}` }))
        return <section className="gallery-group" key={group.productName}>
          <div className="gallery-group-head"><h3>{group.productName}</h3><span>{items.length} image{items.length === 1 ? '' : 's'}</span></div>
          <div className="gallery-grid">{group.items.map(({ item, variantName }, index) => <article className="gallery-card" key={item.id}>
            <button type="button" className="gallery-image-button" aria-label={`Open ${group.productName} ${variantName} images`} onClick={() => setLightbox({ items, index })}><img src={galleryImageSrc(item.url)} alt={`${group.productName} ${variantName}`} /></button>
            <div><strong>{variantName}</strong><span>Click image to view gallery</span></div>
            <button type="button" className="btn danger-text small" onClick={() => void remove(item.id)}>Remove</button>
          </article>)}</div>
        </section>
      })}
    </section>
    {lightbox && <div className="gallery-lightbox" role="dialog" aria-modal="true" aria-label="Image gallery" onClick={() => setLightbox(null)}>
      <div className="gallery-lightbox-panel" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="gallery-lightbox-close" aria-label="Close image gallery" onClick={() => setLightbox(null)}>×</button>
        <button type="button" className="gallery-lightbox-nav prev" aria-label="Previous image" onClick={() => setLightbox((current) => current ? { ...current, index: (current.index - 1 + current.items.length) % current.items.length } : current)}>‹</button>
        <img src={galleryImageSrc(lightbox.items[lightbox.index].url)} alt={lightbox.items[lightbox.index].label} />
        <button type="button" className="gallery-lightbox-nav next" aria-label="Next image" onClick={() => setLightbox((current) => current ? { ...current, index: (current.index + 1) % current.items.length } : current)}>›</button>
        <p>{lightbox.items[lightbox.index].label} · {lightbox.index + 1} / {lightbox.items.length}</p>
      </div>
    </div>}
  </section>
}
