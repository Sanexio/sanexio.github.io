// Only a release decision enables persistent public assets. Never store inputs.
export async function enableOfflineCache(selectionRoot=new URL('./',location.href)){
 const root=new URL('./',import.meta.url);
 let enabled=false;
 try{
  // Query bypasses BR8's cache-first worker and the browser HTTP cache.
  const response=await fetch(new URL('cache-release.json?dht-cache-switch',selectionRoot),{cache:'no-store'});
  enabled=response.ok&&(await response.json()).enabled===true;
 }catch{} // Missing switch, including a legacy flat host, defaults to OFF.
 if(!enabled){
  const cleanup=[];
  try{if('serviceWorker' in navigator)cleanup.push(navigator.serviceWorker.getRegistrations().then(registrations=>Promise.allSettled(registrations.filter(r=>r.scope===root.href).map(r=>r.unregister()))));}catch{}
  try{cleanup.push(caches.keys().then(names=>Promise.allSettled(names.filter(n=>n.startsWith('dht-public-assets-')).map(n=>caches.delete(n)))));}catch{}
  await Promise.allSettled(cleanup);
  return;
 }
 try{if('serviceWorker' in navigator)await navigator.serviceWorker.register(new URL('./sw.js',root),{scope:root.pathname,updateViaCache:'none'});}catch{}
}
