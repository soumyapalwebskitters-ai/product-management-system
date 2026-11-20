import type { Sql } from '../src/sql'
import { defaultWebContent, type WebContent } from '../src/webContent'
import { readJson, RequestError } from './security'
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'cache-control': 'no-store' } })
function text(value: unknown, max: number, min = 0): string {
 if (typeof value !== 'string' || value.trim().length < min || value.length > max) throw new RequestError(400, 'Invalid text length.')
 return value.trim()
}
function media(value: unknown) {
 const src = text(value, 2048)
 if (/^\/api\/banner-video\?id=[A-Za-z0-9_-]{10,200}$/.test(src)) return src
 if (!src || /^\/api\/web-media\/[a-f0-9-]+$/.test(src)) return src
 try { const url = new URL(src); if (url.protocol === 'https:' && !url.username && !url.password) return src } catch { /* reject */ }
 throw new RequestError(400, 'Use an HTTPS media URL or upload an image.')
}
function validateContent(value: unknown): WebContent {
 if (!value || typeof value !== 'object') throw new RequestError(400, 'Invalid website content.')
 const c = value as WebContent
 if (c.version !== 1 || !c.copy || !c.images) throw new RequestError(400, 'Invalid website content.')
 const copy: Record<string,string> = {}, images: Record<string,string> = {}
 for (const key of Object.keys(defaultWebContent.copy)) copy[key] = text(c.copy[key], 10000)
 for (const key of Object.keys(defaultWebContent.images)) images[key] = media(c.images[key])
 for (const key of ['slides','gallery','faqs','sections'] as const) {
  if (!Array.isArray(c[key]) || c[key].length > 100) throw new RequestError(400, 'Maximum 100 entries per section.')
  const ids = new Set<string>()
  for (const row of c[key]) { const id = text(row.id,100,1); if(ids.has(id)) throw new RequestError(400,'Duplicate entry.'); ids.add(id) }
 }
 return {version:1, copy, images,
 slides:c.slides.map(r=>{if(!['image','video'].includes(r.type))throw new RequestError(400,'Invalid slide type.');return {id:r.id,type:r.type,src:media(r.src),alt:text(r.alt,500)}}),
 gallery:c.gallery.map(r=>({id:r.id,src:media(r.src),title:text(r.title,500),description:text(r.description,2000)})),
 faqs:c.faqs.map(r=>({id:r.id,question:text(r.question,500),answer:text(r.answer,10000)})),
 sections:c.sections.map(r=>({id:r.id,title:text(r.title,500),body:text(r.body,10000),image:media(r.image)}))}
}
export async function publicWeb(request: Request, db?: Sql): Promise<Response> {
 const path = new URL(request.url).pathname
 if(path === '/api/web-content') {
  const row = db ? await db.first<{content:string;revision:number}>('SELECT content, revision FROM website_content WHERE id=1') : null
  return json({content:row?JSON.parse(row.content):defaultWebContent,revision:row?.revision??0})
 }
 if(!db) return json({error:'Image unavailable.'},404)
 const row=await db.first<{mime:string;data:string}>('SELECT mime,data FROM website_media WHERE id=?',[path.split('/').pop()!])
 if(!row)return json({error:'Image not found.'},404)
 const bytes=Uint8Array.from(atob(row.data),c=>c.charCodeAt(0))
 return new Response(bytes,{headers:{'content-type':row.mime,'cache-control':'public,max-age=31536000,immutable','x-content-type-options':'nosniff'}})
}
export async function manageWeb(request: Request, db: Sql): Promise<Response> {
 const path=new URL(request.url).pathname
 if(path==='/api/web-content' && request.method==='PUT') {
  const body=await readJson(request,500000) as {content:unknown;revision:number}
  if(!Number.isInteger(body.revision)||body.revision<0)throw new RequestError(400,'Invalid revision.')
  const content=validateContent(body.content)
  const row=await db.first<{revision:number}>(`INSERT INTO website_content (id,content,revision) SELECT 1,?,1 WHERE ?=0 OR EXISTS(SELECT 1 FROM website_content WHERE id=1) ON CONFLICT(id) DO UPDATE SET content=excluded.content,revision=website_content.revision+1 WHERE website_content.revision=? RETURNING revision`,[JSON.stringify(content),body.revision,body.revision])
  if(!row)return json({error:'Content changed in another session. Reload before saving.'},409)
  return json({content,revision:row.revision})
 }
 if(path==='/api/web-media' && request.method==='POST') {
  const body=await readJson(request,750000) as {data:unknown}
  const value=text(body.data,710000)
  const match=/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/]+=*)$/.exec(value)
  if(!match)throw new RequestError(400,'Upload a PNG, JPEG, WebP or GIF under 500 KB.')
  let bytes:string;try{bytes=atob(match[2])}catch{throw new RequestError(400,'Invalid image.')}
  if(bytes.length>512000)throw new RequestError(413,'Image must be under 500 KB.')
  const valid = match[1]==='image/png'?bytes.startsWith('\x89PNG\r\n\x1a\n'):match[1]==='image/jpeg'?bytes.startsWith('\xff\xd8\xff'):match[1]==='image/gif'?/^GIF8[79]a/.test(bytes):bytes.startsWith('RIFF')&&bytes.slice(8,12)==='WEBP'
  if(!valid)throw new RequestError(400,'Image contents do not match the file type.')
  const id=crypto.randomUUID();await db.batch([{sql:'INSERT INTO website_media(id,mime,data) VALUES(?,?,?)',params:[id,match[1],match[2]]}])
  return json({url:`/api/web-media/${id}`},201)
 }
 if(path==='/api/testimonials') {
  if(request.method==='GET')return json({reviews:await db.all('SELECT id,customer_id,name,rating,quote,created_at,updated_at FROM reviews ORDER BY updated_at DESC,id')})
  const body=await readJson(request,10000) as Record<string,unknown>
  if(request.method==='DELETE'){
   const row=await db.first('DELETE FROM reviews WHERE id=? RETURNING id',[text(body.id,100,1)])
   return row?json({ok:true}):json({error:'Testimonial not found.'},404)
  }
  if(request.method==='POST'||request.method==='PUT') {
   const name=text(body.name,60,2),quote=text(body.quote,1500,10),rating=Number(body.rating)
   if(!Number.isInteger(rating)||rating<1||rating>5)throw new RequestError(400,'Rating must be 1 to 5.')
   const id=request.method==='POST'?crypto.randomUUID():text(body.id,100,1)
   if(request.method==='POST')await db.batch([{sql:'INSERT INTO reviews(id,customer_id,name,rating,quote) VALUES(?,?,?,?,?)',params:[id,`manual:${id}`,name,rating,quote]}])
   else if(!await db.first("UPDATE reviews SET name=?,rating=?,quote=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? RETURNING id",[name,rating,quote,id]))return json({error:'Testimonial not found.'},404)
   return json({ok:true,id},request.method==='POST'?201:200)
  }
 }
 return json({error:'Method not allowed.'},405)
}
