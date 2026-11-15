importScripts('./cache-version.js');
const CACHE='dht-public-assets-'+self.DHT_PUBLIC_REVISION;
const root=new URL('./',self.location.href);
const files=new Map(self.DHT_PUBLIC_FILES.map(file=>[new URL(file.path,root).href,file]));
const versionURL=new URL('./cache-version.js',root).href;
async function valid(response,file){
 if(!response.ok||!file?.sha256)return false;
 const digest=await crypto.subtle.digest('SHA-256',await response.clone().arrayBuffer());
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')===file.sha256;
}
async function read(request){try{return await (await caches.open(CACHE)).match(request);}catch{}}
async function save(request,response){
 if(/no-store/i.test(response.headers.get('Cache-Control')||''))return;
 try{await (await caches.open(CACHE)).put(request,response.clone());}catch{}
}
async function asset(request,networkFirst=false){
 const file=files.get(request.url),previous=await read(request);
 if(previous&&!networkFirst)return previous;
 try{
  const response=await fetch(new Request(request,{cache:'no-store'}));
  if(await valid(response,file)){await save(request,response);return response;}
 }catch{}
 // A later deployment is not this page's release. Never mix its bytes in.
 return previous||new Response('Diese Fassung ist nicht mehr vollständig verfügbar. Bitte die Seite erneut öffnen.',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});
}
// No skipWaiting/claim: retire a release after its last controlled page closes.
self.addEventListener('install',event=>event.waitUntil((async()=>{
 // Snapshot includes lazy assets. Storage remains optional under denial/quota.
 for(const url of files.keys())await asset(new Request(url));
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 try{await Promise.allSettled((await caches.keys()).filter(n=>n.startsWith('dht-public-assets-')&&n!==CACHE).map(n=>caches.delete(n)));}catch{}
})()));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==root.origin||!url.pathname.startsWith(root.pathname)||url.search)return;
 if(request.url===versionURL){event.respondWith(fetch(new Request(request,{cache:'no-store'})).catch(()=>new Response('',{status:503})));return;}
 if(!files.has(request.url))return;
 event.respondWith(asset(request,/\.html$/.test(url.pathname)));
});
