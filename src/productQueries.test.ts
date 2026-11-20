import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { memoryDatabase } from '../server/local'
import { handleApi } from '../worker/api'
import { handleState } from './shopApi'
import { ensureState } from './parseState'
import { seedState } from './seed'
const request=(path:string,cookie?:string)=>new Request(`https://shop.example${path}`,{headers:cookie?{cookie}:{}})
async function fixture() {
 const db=memoryDatabase(),queriesDb=memoryDatabase()
 const schema=readFileSync('website-migrations/0003_product_query.sql','utf8')
 for(const sql of schema.split(';').map(x=>x.trim()).filter(Boolean))await queriesDb.batch([{sql,params:[]}])
 const auth=await handleApi(new Request('https://shop.example/api/auth/setup',{method:'POST',headers:{'content-type':'application/json','x-setup-token':'test-token'},body:JSON.stringify({email:'seller@example.com',password:'test-password-123'})}),db,{setupToken:'test-token'})
 assert.equal(auth.status,200)
 const cookie=auth.headers.get('set-cookie')!.split(';')[0]
 const items=JSON.stringify([{productId:'p1',productName:'Sparklers',variantId:'v1',variantName:'Small',sku:'SP1',quantity:2,sellingUnit:'box',itemsPerBox:10,unitPriceMinor:2500,totalMinor:5000}])
 await queriesDb.batch(Array.from({length:125},(_,i)=>({sql:'INSERT INTO "product query" (id,request_hash,name,phone,email,location,items_json,estimated_total_minor,status) VALUES (?,?,?,?,?,?,?,?,?)',params:[`query-${String(i).padStart(3,'0')}`,'private-hash',`Customer ${i}`,'+919876543210','customer@example.com',i===0?'Special city':'City',items,5000,i===0?'contacted':'new']})))
 return {db,queriesDb,cookie}
}
test('seller can view all query pages and saved product/contact snapshots',async()=>{
 const {db,queriesDb,cookie}=await fixture();const ids=new Set()
 for(let page=1;page<=3;page++){
  const response=await handleApi(request(`/api/product-queries?page=${page}`,cookie),db,{queriesDb});assert.equal(response.status,200)
  const data=await response.json();assert.equal(data.total,125);assert.equal(data.page,page)
  for(const row of data.queries){ids.add(row.id);assert.equal(row.phone,'+919876543210');assert.equal(row.email,'customer@example.com');assert.equal(row.items[0].productName,'Sparklers');assert.equal(row.estimated_total_minor,5000);assert.equal(row.request_hash,undefined);assert.equal(row.items_json,undefined)}
 }
 assert.equal(ids.size,125)
})
test('anonymous and buyer accounts cannot read query contact data',async()=>{
 const {db,queriesDb,cookie}=await fixture();assert.equal((await handleApi(request('/api/product-queries'),db,{queriesDb})).status,401)
 const state=ensureState(seedState(1700000000000));await handleState('PUT',{revision:0,state},db)
 const credentials={email:'buyer@example.com',password:'test-buyer-password-123'}
 const created=await handleApi(new Request('https://shop.example/api/auth/buyers',{method:'POST',headers:{'content-type':'application/json',cookie},body:JSON.stringify({...credentials,buyerId:state.buyers[0].id})}),db)
 assert.equal(created.status,201)
 const logged=await handleApi(new Request('https://shop.example/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(credentials)}),db)
 assert.equal((await handleApi(request('/api/product-queries',logged.headers.get('set-cookie')!.split(';')[0]),db,{queriesDb})).status,403)
})
test('search and status filters search the database and pagination validates inputs',async()=>{
 const {db,queriesDb,cookie}=await fixture()
 for(const suffix of ['q=Special+city','status=contacted']){const data=await (await handleApi(request(`/api/product-queries?${suffix}`,cookie),db,{queriesDb})).json();assert.equal(data.total,1);assert.equal(data.queries[0].id,'query-000')}
 const search=await (await handleApi(request('/api/product-queries?q=Sparklers',cookie),db,{queriesDb})).json();assert.equal(search.total,125)
 const literal=await (await handleApi(request('/api/product-queries?q=%25',cookie),db,{queriesDb})).json();assert.equal(literal.total,0)
 for(const suffix of ['page=-1','page=NaN','status=unknown'])assert.equal((await handleApi(request(`/api/product-queries?${suffix}`,cookie),db,{queriesDb})).status,400)
 assert.equal((await handleApi(request('/api/product-queries',cookie),db)).status,503)
})
test('malformed item snapshots do not hide the remaining query records',async()=>{
 const {db,queriesDb,cookie}=await fixture();await queriesDb.batch([{sql:'UPDATE "product query" SET items_json=? WHERE id=?',params:['invalid-json','query-124']}])
 const data=await (await handleApi(request('/api/product-queries',cookie),db,{queriesDb})).json();assert.equal(data.queries[0].itemsError,true);assert.equal(data.queries.length,50)
})
