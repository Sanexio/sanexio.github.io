export const sha256 = async data => [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map(x=>x.toString(16).padStart(2,'0')).join('');
export async function checked(url, hash) {
  const response = await fetch(url);
  if (!response.ok) throw Error('Lokale Quelle fehlt');
  const bytes = await response.arrayBuffer();
  if (await sha256(bytes) !== hash) throw Error('Quellen-Prüfsumme abweichend');
  return bytes;
}
export async function enabled(row) {
  try {
    const response = await fetch(new URL(`zeile-${row}-release.json`, new URL(document.querySelector('meta[name="dht-selection-root"]').content, document.baseURI)), {cache:'no-store'});
    return response.ok && (await response.json()).enabled === true;
  } catch { return false; }
}
export function section(id, title, parent) {
  const el = document.createElement('section'); el.id=id; el.className='panel';
  const heading = document.createElement('h2'); heading.textContent=title; el.append(heading); (parent.classList.contains('app') ? parent.querySelector('.app-content') || parent : parent).append(el); return el;
}
export function notice(host, text) {const p=document.createElement('p');p.textContent=text;host.append(p);return p;}
