/** Lokale, nach Zweck getrennte Datenbanken. Bestehender Terminbestand bleibt erhalten. */
export const STORES = ['labor','vitals','ziele','badges','erinnerungen','simlaeufe','notizen','mandanten','health_import','profil','besuche'];
export function scope() { return localStorage.getItem('dht-zweckbereich') === 'forschung' ? 'forschung' : 'termin'; }
export function openDb(area = scope()) {
  return new Promise((resolve,reject) => {
    const req = indexedDB.open(area === 'termin' ? 'dht-browser-voll' : 'dht-browser-voll-forschung', 2);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => { for (const s of STORES) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s,{keyPath:'id',autoIncrement:true}); };
  });
}
async function operation(store, mode, fn) {
  const db = await openDb();
  return new Promise((resolve,reject) => {
    const tx=db.transaction(store,mode); let result;
    const req=fn(tx.objectStore(store)); req.onsuccess=()=>{result=req.result;};
    tx.oncomplete=()=>{db.close();resolve(result);};
    tx.onerror=tx.onabort=()=>{db.close();reject(tx.error || req.error);};
  });
}
export const idbPut=(s,v)=>operation(s,'readwrite',o=>o.put(v));
export const idbAll=s=>operation(s,'readonly',o=>o.getAll());
export const idbClear=s=>operation(s,'readwrite',o=>o.clear());
export async function snapshot() { return Object.fromEntries(await Promise.all(STORES.map(async s=>[s,await idbAll(s)]))); }
