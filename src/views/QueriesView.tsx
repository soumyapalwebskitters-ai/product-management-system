import { useEffect, useState } from 'react'
import { formatWhen } from '../format'
import './QueriesView.css'
import { SelectBox } from '../components/SelectBox'
import { ConfirmDialog } from '../components/Dialog'
type Item = { productId:string;productName:string;variantId:string;variantName:string;sku:string;quantity:number;sellingUnit:string;itemsPerBox:number;unitPriceMinor:number;totalMinor:number }
type Query = {id:string;name:string;phone:string;email:string;location:string;status:string;created_at:string;estimated_total_minor:number;items:Item[];itemsError:boolean}
type Result = {queries:Query[];total:number;page:number;pageSize:number}
const money=(minor:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(minor/100)
export function QueriesView() {
  const [result,setResult]=useState<Result>({queries:[],total:0,page:1,pageSize:50})
  const [draft,setDraft]=useState(''),[search,setSearch]=useState(''),[status,setStatus]=useState('')
  const [page,setPage]=useState(1),[refresh,setRefresh]=useState(0)
  const [loading,setLoading]=useState(true),[error,setError]=useState('')
  const [pendingStatus,setPendingStatus]=useState<{id:string;status:'contacted'|'will buy'|'closed'}|null>(null),[saving,setSaving]=useState(false)
  async function changeStatus() { if(!pendingStatus)return; setSaving(true); setError(''); try { const response=await fetch('/api/product-queries',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(pendingStatus)}); const body=await response.json(); if(!response.ok)throw new Error(body.error||'Could not update query status.'); setPendingStatus(null); setRefresh(n=>n+1) } catch(cause) { setError(cause instanceof Error?cause.message:'Could not update query status.') } finally { setSaving(false) } }
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError('')
    const params=new URLSearchParams({page:String(page),q:search,status})
    void fetch(`/api/product-queries?${params}`,{credentials:'same-origin',cache:'no-store',signal:controller.signal}).then(async response=>{
      const body=await response.json();if(!response.ok)throw new Error(body.error||'Unable to load product queries.')
      if(!Array.isArray(body.queries))throw new Error('Unexpected query response.')
      if(!controller.signal.aborted)setResult(body)
    }).catch(error=>{if(!controller.signal.aborted)setError(error instanceof Error?error.message:'Unable to load product queries.')}).finally(()=>{if(!controller.signal.aborted)setLoading(false)})
    return()=>controller.abort()
  },[page,search,status,refresh])
  return <section className="queries-view" data-testid="view-query">
    <div className="page-head"><div><h2>Product queries</h2><p className="lede">Website enquiries, contact details and the products selected at submission.</p></div><button type="button" className="btn secondary" disabled={loading} onClick={()=>setRefresh(n=>n+1)}>Refresh</button></div>
    <form className="query-filters" onSubmit={event=>{event.preventDefault();setPage(1);setSearch(draft.trim());setRefresh(n=>n+1)}}>
      <label className="field">Search by name<input type="search" maxLength={200} value={draft} onChange={event=>setDraft(event.target.value)} placeholder="Customer name"/></label>
      <label className="field">Status<SelectBox value={status} onChange={event=>{setStatus(event.target.value);setPage(1)}} aria-label="Query status"><option value="">All statuses</option><option value="contacted">Contacted</option><option value="will buy">Will buy</option><option value="closed">Closed</option></SelectBox></label>
      <button className="btn" type="submit" disabled={loading}>Search</button>
    </form>
    {loading&&<p role="status">Loading queries…</p>}{error&&<div className="error" role="alert"><p>{error}</p><button className="btn secondary" type="button" onClick={()=>setRefresh(n=>n+1)}>Try again</button></div>}
    {!loading&&!error&&<><p className="query-count" role="status">{result.total?`${(result.page-1)*result.pageSize+1}–${Math.min(result.page*result.pageSize,result.total)} of ${result.total} queries`:'No queries found.'}</p>
    {result.queries.map(query=><details className="query-record" key={query.id}>
      <summary><span><strong>{query.name}</strong><span>{query.phone} · {formatWhen(query.created_at)}</span></span><span className="query-status">{query.status}</span><strong>{money(query.estimated_total_minor)}</strong><span>View details</span></summary>
      <div className="query-record-body"><dl className="query-contact-details"><div><dt>Reference</dt><dd>{query.id}</dd></div><div><dt>Name</dt><dd>{query.name}</dd></div><div><dt>Phone</dt><dd>{query.phone}</dd></div><div><dt>Email</dt><dd>{query.email||'Not provided'}</dd></div><div><dt>Location</dt><dd>{query.location||'Not provided'}</dd></div><div><dt>Submitted</dt><dd>{formatWhen(query.created_at)}</dd></div></dl><div className="status-change"><span className="section-label">Change the status</span><div className="row-actions"><button className="btn secondary small" type="button" disabled={saving} onClick={()=>setPendingStatus({id:query.id,status:'contacted'})}>Contacted</button><button className="btn secondary small" type="button" disabled={saving} onClick={()=>setPendingStatus({id:query.id,status:'will buy'})}>Will buy</button><button className="btn danger-text small" type="button" disabled={saving} onClick={()=>setPendingStatus({id:query.id,status:'closed'})}>Closed</button></div></div>
      {query.itemsError?<p role="alert">The saved product details could not be read.</p>:<div className="query-products"><table><caption>Selected products</caption><thead><tr><th>Product / variant</th><th>SKU</th><th>Quantity</th><th>Unit price</th><th>Total</th></tr></thead><tbody>{query.items.map((item,index)=><tr key={`${item.variantId}-${index}`}><td><strong>{item.productName}</strong><br/>{item.variantName}</td><td>{item.sku||'—'}</td><td>{item.quantity} {item.sellingUnit==='box'?`box(es), ${item.itemsPerBox} pieces per box`:'piece(s)'}</td><td>{money(item.unitPriceMinor)}</td><td>{money(item.totalMinor)}</td></tr>)}</tbody><tfoot><tr><th colSpan={4}>Estimated total at submission</th><td>{money(query.estimated_total_minor)}</td></tr></tfoot></table></div>}
      </div></details>)}
    {result.total>result.pageSize&&<nav className="query-pages" aria-label="Query pages"><button className="btn secondary" type="button" disabled={result.page<=1} onClick={()=>setPage(result.page-1)}>Previous</button><span>Page {result.page} of {Math.ceil(result.total/result.pageSize)}</span><button className="btn secondary" type="button" disabled={result.page*result.pageSize>=result.total} onClick={()=>setPage(result.page+1)}>Next</button></nav>}
    {!result.total&&!search&&!status&&<p>Product queries will appear here after customers submit them on the website.</p>}</>}
    {pendingStatus&&<ConfirmDialog title={`Mark as ${pendingStatus.status}?`} body="Confirm this query status change." confirmLabel="Confirm change" onClose={()=>setPendingStatus(null)} onConfirm={()=>void changeStatus()} />}
    {saving&&<div className="saving-overlay" role="status" aria-live="assertive"><div className="saving-dialog"><span className="spinner" aria-hidden="true"/><strong>Saving data</strong><span>Please wait…</span></div></div>}
  </section>
}
