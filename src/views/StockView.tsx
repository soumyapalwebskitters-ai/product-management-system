import { useState, type FormEvent } from 'react'
import { Dialog } from '../components/Dialog'
import { ProductPhoto } from '../components/ProductImageField'
import { itemsLabel, parseWhole } from '../format'
import { useMarket } from '../store'
import type { Product, Variant } from '../types'

type Movement = { kind: 'add' | 'remove'; product: Product; variant: Variant }

export function StockView() {
  const { state } = useMarket()
  const [movement, setMovement] = useState<Movement | null>(null)
  return <section>
    <div className="page-head"><div><h2>Stock movement</h2><p className="lede">Add stock when items arrive, or remove stock for damaged, returned, or other unavailable items.</p></div></div>
    {state.products.length === 0 ? <div className="empty"><h3>No products yet</h3><p>Add a product before recording stock movement.</p></div> : <div className="table-scroll"><table className="responsive stock-table"><thead><tr><th>Product</th><th>Variant</th><th className="num">In stock</th><th>Movement</th></tr></thead><tbody>{state.products.flatMap(product => product.variants.map(variant => <tr key={variant.id}><td data-label="Product"><span className="item-with-photo"><ProductPhoto src={product.image ?? ''} name={product.name} /><strong>{product.name}</strong></span></td><td data-label="Variant">{variant.name}</td><td data-label="In stock" className="num">{variant.currentStock.toLocaleString()}</td><td data-label="Movement" className="actions"><div className="row-actions"><button className="btn small" onClick={() => setMovement({ kind: 'add', product, variant })}>Add to stock</button><button className="btn secondary small" disabled={variant.currentStock === 0} onClick={() => setMovement({ kind: 'remove', product, variant })}>Remove from stock</button></div></td></tr>))}</tbody></table></div>}
    {movement && <StockMovementDialog movement={movement} onClose={() => setMovement(null)} />}
  </section>
}

function StockMovementDialog({ movement, onClose }: { movement: Movement; onClose: () => void }) {
  const { receive, sell } = useMarket()
  const [quantity, setQuantity] = useState('1')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const adding = movement.kind === 'add'
  function submit(event: FormEvent) {
    event.preventDefault()
    const amount = parseWhole(quantity)
    if (!amount || amount < 1) { setError('Enter a whole quantity greater than zero.'); return }
    if (!adding && amount > movement.variant.currentStock) { setError(`Only ${itemsLabel(movement.variant.currentStock)} are in stock.`); return }
    const result = adding ? receive(movement.product.id, movement.variant.id, amount, note) : sell(movement.product.id, movement.variant.id, amount, note)
    if (!result.ok) setError(result.error)
    else onClose()
  }
  return <Dialog title={adding ? 'Add to stock' : 'Remove from stock'} subtitle={`${movement.product.name} · ${movement.variant.name}`} onClose={onClose} narrow><form onSubmit={submit}>{error && <p className="error" role="alert">{error}</p>}<p className="hint">{itemsLabel(movement.variant.currentStock)} currently in stock.</p><label className="field"><span>Quantity</span><input autoFocus inputMode="numeric" value={quantity} onChange={event => setQuantity(event.target.value)} onWheel={event => event.currentTarget.blur()} /></label><label className="field"><span>Note</span><textarea value={note} maxLength={500} placeholder={adding ? 'e.g. New delivery' : 'e.g. Damaged item'} onChange={event => setNote(event.target.value)} /></label><div className="dialog-actions"><button type="button" className="btn secondary" onClick={onClose}>Cancel</button><button type="submit" className="btn">{adding ? 'Add stock' : 'Remove stock'}</button></div></form></Dialog>
}
