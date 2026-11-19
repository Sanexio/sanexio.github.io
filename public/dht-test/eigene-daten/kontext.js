/** Public origins expose examples; personal collection is confined to local contexts. */
export const isLocalContext=url=>url.protocol==='file:' || ['127.0.0.1','localhost','[::1]'].includes(url.hostname);

/** Both conditions are required before personal modules may be imported. */
export async function istLokalesPaket() {
  if (!['http:','https:'].includes(location.protocol) || !['127.0.0.1','localhost','[::1]'].includes(location.hostname)) return false;
  if(!globalThis.document?.querySelector('meta[name="dht-local-package"][content="1"]'))return false;
  try { const r=await fetch(new URL('../lokales-paket.json',import.meta.url),{cache:'no-store'});return r.ok && (await r.json()).fassung==='dht-eigene-daten-lokal/1'; } catch {return false;}
}
