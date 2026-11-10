import { useState, type FormEvent } from 'react'
import { ConfirmDialog, Dialog } from '../components/Dialog'
import { matchesQuery } from '../search'
import { useMarket } from '../store'
import type { Buyer } from '../types'

type Draft = { name: string; phone: string; address: string; note: string }
const emptyDraft: Draft = { name: '', phone: '', address: '', note: '' }

export function SellerBuyersView() {
  const market = useMarket()
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Buyer | null>(null)
  const [removing, setRemoving] = useState<Buyer | null>(null)
  const buyers = [...market.state.buyers].filter((buyer) => matchesQuery(`${buyer.name} ${buyer.phone} ${buyer.address}`, query, 'smart')).sort((a, b) => a.name.localeCompare(b.name))
  return <section data-testid="view-seller-buyers">
    <div className="page-head"><div><h2>Buyer info</h2><p className="lede">Buyer contact details and notes. Product and purchase information is managed separately.</p></div><button className="btn" onClick={() => setAdding(true)}>Add buyer</button></div>
    <div className="toolbar"><label className="buyer-search"><span className="sr-only">Search buyers</span><input value={query} placeholder="Search buyer name or phone" onChange={event => setQuery(event.target.value)} /></label></div>
    {buyers.length === 0 ? <div className="empty"><h3>{market.state.buyers.length ? 'No buyers match' : 'No buyers yet'}</h3><p>{market.state.buyers.length ? 'Try another name, phone number, or address.' : 'Add a buyer to save their contact information.'}</p></div> : <div className="table-wrap"><table className="responsive"><thead><tr><th>Buyer</th><th>Phone</th><th>Address</th><th>Note</th><th>Actions</th></tr></thead><tbody>{buyers.map(buyer => <tr key={buyer.id}><td data-label="Buyer"><strong>{buyer.name}</strong></td><td data-label="Phone">{buyer.phone || '—'}</td><td data-label="Address">{buyer.address || '—'}</td><td data-label="Note">{buyer.note || '—'}</td><td data-label="Actions" className="actions"><div className="row-actions"><button className="btn secondary small" onClick={() => setEditing(buyer)}>Edit</button><button className="btn danger-text small" onClick={() => setRemoving(buyer)}>Remove</button></div></td></tr>)}</tbody></table></div>}
    {adding && <Dialog title="Add buyer" subtitle="Save buyer contact information." narrow onClose={() => setAdding(false)}><BuyerForm initial={emptyDraft} submitLabel="Add buyer" onCancel={() => setAdding(false)} onSubmit={(draft) => { const result = market.importBuyer(draft); if (result.ok) setAdding(false); return result }} /></Dialog>}
    {editing && <Dialog title="Edit buyer" narrow onClose={() => setEditing(null)}><BuyerForm initial={editing} submitLabel="Save buyer" onCancel={() => setEditing(null)} onSubmit={(draft) => { const result = market.editBuyer(editing.id, draft); if (result.ok) setEditing(null); return result }} /></Dialog>}
    {removing && <ConfirmDialog title={`Remove ${removing.name}?`} body="This removes the buyer and their saved purchases." confirmLabel="Remove buyer" danger onClose={() => setRemoving(null)} onConfirm={() => { market.deleteBuyer(removing.id); setRemoving(null) }} />}
  </section>
}

function BuyerForm({ initial, submitLabel, onCancel, onSubmit }: { initial: Draft; submitLabel: string; onCancel: () => void; onSubmit: (draft: Draft) => { ok: boolean; error?: string } }) {
  const [draft, setDraft] = useState<Draft>({ name: initial.name, phone: initial.phone, address: initial.address, note: initial.note })
  const [error, setError] = useState('')
  function submit(event: FormEvent) { event.preventDefault(); const result = onSubmit(draft); if (!result.ok) setError(result.error ?? 'Could not save buyer.') }
  return <form onSubmit={submit}>{error && <p className="error" role="alert">{error}</p>}<label className="field"><span>Buyer name</span><input autoFocus value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label><label className="field"><span>Phone</span><input inputMode="tel" value={draft.phone} onChange={event => setDraft({ ...draft, phone: event.target.value })} /></label><label className="field"><span>Address</span><textarea value={draft.address} onChange={event => setDraft({ ...draft, address: event.target.value })} /></label><label className="field"><span>Note</span><textarea value={draft.note} onChange={event => setDraft({ ...draft, note: event.target.value })} /></label><div className="dialog-actions"><button className="btn secondary" type="button" onClick={onCancel}>Cancel</button><button className="btn" type="submit">{submitLabel}</button></div></form>
}
