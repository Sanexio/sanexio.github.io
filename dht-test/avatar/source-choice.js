import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { enabled, checked, section, notice, sha256 } from './local-source.js';
import { referenceView } from './reference-view.js';

export async function mountSourceChoice() {
  if (!await enabled(2)) return;
  const data=await (await fetch(new URL('sources/variants.json',import.meta.url))).json();
  const host=section('source-choice','Anatomie: Quellfassung wählen',document.querySelector('.app'));
  notice(host,'Die bisherige BR6-Ansicht bleibt Vorgabe. Alternative Fassungen erscheinen einzeln in einer eigenen Szene, ohne Hülle und ohne Koordinatenübertragung.');
  const label=document.createElement('label');label.textContent='Quellfassung ';const select=document.createElement('select');select.id='source-variant';label.append(select);host.append(label);
  select.add(new Option('BR6 · bisheriger männlicher Atlas (Vorgabe)','br6'));
  for(const v of data.variants)select.add(new Option(`${v.label} · ${v.id}`,v.id));
  const info=notice(host,'');info.id='source-credit';info.style.overflowWrap='anywhere';
  const stage=document.createElement('div');stage.id='source-reference';stage.hidden=true;host.append(stage);
  const relation=notice(host,'');relation.id='source-relations';
  notice(host,`${data.variants.length} lokal belegte Fassungen. ${data.missing.length} weitere Herkunftseinträge ohne eindeutig verfügbare freigegebene Geometrie werden nicht angeboten. ${data.open}`);
  let view;let serial=0;
  const defaults=()=>{info.textContent=`BR6 · ${data.default.id} · SHA-256 ${data.default.sha256}. ${data.default.credit}`;relation.textContent='Beziehungen: vorhandene BR6-Bindungen; fehlende Einzelgeometrie und Lexikonbindung bleiben sichtbar fehlend.';};defaults();
  // Preload the finite local source bundle; source selection causes no request.
  let bundle;
  try {bundle=await checked(new URL('sources/variants.bin',import.meta.url),data.bundle_sha256);}catch(e){select.disabled=true;info.textContent=e.message;return;}
  select.addEventListener('change',async()=>{
    const current=++serial;stage.hidden=select.value==='br6';
    if(select.value==='br6'){defaults();return;}
    const v=data.variants.find(x=>x.id===select.value);info.textContent='Quellfassung wird geprüft …';
    try {
      const bytes=bundle.slice(v.offset,v.offset+v.bytes);if(await sha256(bytes)!==v.sha256)throw Error('Varianten-Prüfsumme abweichend');
      const gltf=await new GLTFLoader().parseAsync(bytes,'');if(current!==serial)return;
      gltf.scene.traverse(o=>{if(o.isMesh)o.material=new THREE.MeshStandardMaterial({color:0x5789a4,roughness:.8,side:THREE.DoubleSide});});
      if(!view)view=referenceView(stage,'source-canvas');view.set(gltf.scene);
      stage.dataset.variant=v.id;stage.dataset.sha256=v.sha256;
      info.textContent=`${v.label} · Kennung ${v.id} · Originalobjekt ${v.original} · Herkunft ${v.source_url} · ${v.credit} · Lizenz ${v.license} (${v.license_url}) · Änderung: lokale LOD-Ableitung, unveränderte vorhandene Bytes. ${v.warning} SHA-256 ${v.sha256}`;
      relation.textContent='Fehlend: keine geprüfte Beziehung zur Körperhülle, zur anderen Quellfassung, zu Schmerzorten oder zu Lexikontexten. Keine Registrierung behauptet.';
    } catch(e){stage.hidden=true;info.textContent=`Quellfassung nicht verfügbar: ${e.message}`;}
  });
}
