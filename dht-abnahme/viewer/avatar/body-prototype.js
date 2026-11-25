import * as THREE from 'three';
import {enabled,checked,section,notice} from './local-source.js';
import {referenceView} from './reference-view.js';

export async function mountBodyPrototype(parent = document.querySelector('.app')) {
  if(!await enabled(9))return;
  const base=new URL('body/',import.meta.url),source=await (await fetch(new URL('source.json',base))).json();
  const host=section('body-prototype','Körpermaße: illustrative Außenhülle',parent);
  const warning=notice(host,'Illustrativer Prototyp — keine individuelle Innenanatomie. Der Atlas bleibt unverändert; keine passende Registrierung. Drei äußere Gesamtausdehnungen, keine medizinisch validierte Passform. Eingaben bleiben flüchtig in diesem Browser und werden nicht gespeichert oder übertragen.');warning.id='body-warning';warning.style.cssText='position:sticky;top:0;background:#fff3d9;padding:12px;z-index:1';
  const form=document.createElement('form');form.id='body-measures';form.autocomplete='off';host.append(form);
  const fields=[['height','Körperhöhe',180,120,220],['span','Spannweite beider Arme (Pose der Vorlage)',175,100,230],['depth','Größte äußere Tiefe (einschließlich Pose)',30,15,55]];
  for(const [key,text,value,min,max] of fields){const label=document.createElement('label');label.textContent=text+' in cm ';const input=document.createElement('input');input.id='body-'+key;input.type='number';input.step='.1';input.min=min;input.max=max;input.value=value;input.required=true;label.append(input);form.append(label);}
  const submit=document.createElement('button');submit.type='submit';submit.id='body-apply';submit.textContent='Außenhülle erzeugen';form.append(submit);
  const reset=document.createElement('button');reset.type='button';reset.id='body-reset';reset.textContent='Maße zurücksetzen';form.append(reset);
  const output=notice(host,'');output.id='body-measured';
  const bytes=await checked(new URL('mesh.json',base),source.sha256),model=JSON.parse(new TextDecoder().decode(bytes));
  const geometry=new THREE.BufferGeometry();geometry.setIndex(model.indices);geometry.setAttribute('position',new THREE.Float32BufferAttribute(model.positions,3));geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0xa8bfce,roughness:.85,side:THREE.DoubleSide}));
  const view=referenceView(host,'body-canvas');view.set(mesh);
  notice(host,`${source.credit} · ${source.origin} · ${source.license} (${source.license_url}), gelesen ${source.license_read_at}. Änderung: nur Gruppe body, trianguliert, normiert; eigene Achsenskalierung. Kein MakeHuman-Programmcode. SHA-256 ${source.sha256}`);
  const original=new Float32Array(model.positions);
  function apply(){
    if(!form.reportValidity())return;
    const values=fields.map(([key])=>Number(form.querySelector('#body-'+key).value));
    if(values.some(v=>!Number.isFinite(v)))return;
    const [height,span,depth]=values,scales=[span/100,height/100,depth/100],p=geometry.getAttribute('position');
    for(let i=0;i<p.count;i++)p.setXYZ(i,original[3*i]*scales[0],original[3*i+1]*scales[1],original[3*i+2]*scales[2]);
    p.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();
    const size=geometry.boundingBox.getSize(new THREE.Vector3()).multiplyScalar(100),actual=[size.y,size.x,size.z];
    const errors=actual.map((v,i)=>Math.abs(v-values[i]));const valid=errors.every(e=>e<=.1);
    host.dataset.measurements=JSON.stringify({requested:values,measured:actual,error:errors,toleranceCm:.1,pass:valid});
    output.textContent=valid?`An erzeugten Eckpunkten gemessen: Höhe ${actual[0].toFixed(2)} cm · Spannweite ${actual[1].toFixed(2)} cm · äußere Tiefe ${actual[2].toFixed(2)} cm. Toleranz je Maß 0,10 cm eingehalten. Keine individuelle Innenanatomie.`:'Maßprüfung fehlgeschlagen — keine freigegebene Hülle.';
    mesh.visible=valid;view.reset();view.draw();
  }
  form.addEventListener('submit',e=>{e.preventDefault();apply();});
  reset.addEventListener('click',()=>{for(const [key,,value] of fields)form.querySelector('#body-'+key).value=value;apply();});apply();
  Object.defineProperty(host,'outerVertices',{value:()=>Array.from(geometry.getAttribute('position').array)});
}
