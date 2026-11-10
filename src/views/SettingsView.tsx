import { useRef, useState, type ChangeEvent } from 'react'
import { useMarket } from '../store'
import { Icon } from '../components/Icon'

function csvCell(value: unknown) { return `"${String(value ?? '').replaceAll('"', '""')}"` }
function download(name: string, rows: unknown[][]) {
  const content = rows.map(row => row.map(csvCell).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob(['\ufeff', content], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url)
}
function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false
  for (let i=0; i<text.length; i++) { const ch=text[i]; if (ch==='"' && quoted && text[i+1]==='"') { cell+='"'; i++ } else if(ch==='"') quoted=!quoted; else if(ch===','&&!quoted){row.push(cell);cell=''} else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell=''} else cell+=ch }
  if(cell||row.length){row.push(cell);rows.push(row)} return rows.filter(r=>r.some(c=>c.trim()))
}
export function SettingsView() {
  const { state, addProduct, importBuyer } = useMarket()
  const [message,setMessage]=useState('')
  const productRef=useRef<HTMLInputElement>(null); const buyerRef=useRef<HTMLInputElement>(null)
  function productCsv() { download('products.csv', [['name','image','variant','sku','itemsPerBox','price','buyingPrice','currentStock','minimumStock','desiredStock'], ...state.products.flatMap(p=>p.variants.map(v=>[p.name,p.image??'',v.name,v.sku,v.itemsPerBox,v.price,v.buyingPrice??0,v.currentStock,v.minimumStock,v.desiredStock]))]) }
  function buyerCsv() { download('buyers.csv', [['name','phone','address','note'], ...state.buyers.map(b=>[b.name,b.phone,b.address,b.note])]) }
  async function importFile(event: ChangeEvent<HTMLInputElement>, kind: 'product'|'buyer') {
    const file=event.target.files?.[0]; event.target.value=''; if(!file)return
    const rows=parseCsv(await file.text()); if(rows.length<2){setMessage('CSV needs a header row and at least one data row.');return}
    const headers=rows[0].map(x=>x.trim().toLowerCase()); const at=(row:string[],name:string)=>row[headers.indexOf(name)]??''
    let count=0
    if(kind==='buyer') { for(const row of rows.slice(1)){const result=importBuyer({name:at(row,'name'),phone:at(row,'phone'),address:at(row,'address'),note:at(row,'note')});if(result.ok)count++} }
    else {
      const groups=new Map<string, string[][]>(); for(const row of rows.slice(1)){const name=at(row,'name').trim();if(name)groups.set(name,[...(groups.get(name)??[]),row])}
      for(const [name,items] of groups){const first=items[0];const result=addProduct({name,image:at(first,'image')||undefined,variants:items.map(row=>({name:at(row,'variant')||'Standard',sku:at(row,'sku'),itemsPerBox:Number(at(row,'itemsperbox'))||1,price:Number(at(row,'price'))||0,buyingPrice:Number(at(row,'buyingprice'))||0,currentStock:Number(at(row,'currentstock'))||0,minimumStock:Number(at(row,'minimumstock'))||0,desiredStock:Number(at(row,'desiredstock'))||0}))});if(result.ok)count++}
    }
    setMessage(`Imported ${count} ${kind === 'buyer' ? 'buyer row(s)' : 'product(s)'}; matching products are created as new entries.`)
  }
  return <section><div className="page-head"><div><h2><Icon name="settings" /> Settings</h2><p className="lede">Back up shop data or import CSV lists.</p></div></div><div className="settings-grid">
    <article className="settings-card"><h3><Icon name="box" /> Product data</h3><p>Download your catalog as CSV, or import products using the provided column names.</p><button className="btn secondary" onClick={productCsv}><Icon name="download" /> Export products</button><button className="btn" onClick={()=>productRef.current?.click()}><Icon name="upload" /> Import products CSV</button><input ref={productRef} hidden type="file" accept=".csv,text/csv" onChange={e=>void importFile(e,'product')}/><a href="data:text/csv;charset=utf-8,name%2Cimage%2Cvariant%2Csku%2CitemsPerBox%2Cprice%2CbuyingPrice%2CcurrentStock%2CminimumStock%2CdesiredStock%0A" download="products-template.csv">Download product template</a></article>
    <article className="settings-card"><h3><Icon name="buyer" /> Buyer data</h3><p>Download buyer names and contact details or add buyers from a CSV file.</p><button className="btn secondary" onClick={buyerCsv}><Icon name="download" /> Export buyers</button><button className="btn" onClick={()=>buyerRef.current?.click()}><Icon name="upload" /> Import buyers CSV</button><input ref={buyerRef} hidden type="file" accept=".csv,text/csv" onChange={e=>void importFile(e,'buyer')}/><a href="data:text/csv;charset=utf-8,name%2Cphone%2Caddress%2Cnote%0A" download="buyers-template.csv">Download buyer template</a></article>
  </div>{message&&<p className="notice" role="status">{message}</p>}</section>
}
