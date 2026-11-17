// Loaded only after a structure is selected. Assets load only on a depth action.
const BASE=new URL('zoom/',import.meta.url);
const names=['Körper','Organ','Gewebe','Zelle','Molekül'];
export async function mountZoom(host,{organ,body}){
 const response=await fetch(new URL('catalog.json',BASE));if(!response.ok)throw Error('Zoomkatalog fehlt');const catalog=await response.json();
 const viewport=host.querySelector('.avatar-viewport'),panel=document.createElement('section');panel.id='zoom-panel';panel.setAttribute('aria-label','Hineinzoomen');panel.hidden=true;
 panel.innerHTML='<strong id="zoom-location"></strong><small id="zoom-color-legend" hidden></small><nav id="zoom-steps" aria-label="Zoomstufen"></nav><div id="zoom-variants" role="group" aria-label="Gewebeansicht" hidden></div><p id="zoom-explanation"></p><div class="zoom-buttons"><button id="zoom-back" type="button">Zurück</button><button id="zoom-in" type="button">Hineinzoomen</button></div><progress id="zoom-progress" aria-label="Zoomstufe laden" hidden></progress><p id="zoom-status" role="status"></p><small id="zoom-credit"></small><details id="zoom-source"><summary>Quelle und Grenzen</summary><small></small></details>';
 const style=document.createElement('style');style.textContent=`
 #zoom-panel{position:absolute;z-index:6;bottom:8px;left:8px;right:8px;padding:10px;border-radius:14px;background:rgba(246,251,252,.97);color:#16394c;box-shadow:0 4px 20px #122e4930;font-size:13px;line-height:1.25}
 #zoom-variants[hidden],#zoom-panel[hidden],#zoom-surface[hidden]{display:none}#zoom-variants{display:flex;gap:6px;margin:4px 0}#zoom-variants button{flex:1;min-height:44px}#zoom-variants button[aria-pressed="true"]{background:#184f69;color:white}#zoom-panel p{margin:4px 0}#zoom-location{display:block;font-size:15px}#zoom-steps{display:flex;gap:3px;margin:7px 0}#zoom-steps button{flex:1;min-width:0;padding:6px 2px;min-height:44px;font-size:12px;border-radius:7px}#zoom-steps button[aria-current="step"]{background:#184f69;color:white;box-shadow:inset 0 -3px #f0ba77}#zoom-steps button:disabled{background:#e5e9eb;color:#58666c;opacity:.65}.zoom-buttons{display:flex;gap:8px}.zoom-buttons button{min-height:44px}#zoom-in{flex:1;background:#184f69;color:#fff;font-size:17px}#zoom-in:disabled{opacity:.45}#zoom-credit{display:block;font-size:11px;margin-top:3px}#zoom-progress{width:100%}#zoom-status{font-size:12px}#zoom-source{font-size:11px;overflow-wrap:anywhere}#zoom-source small{display:block;max-height:90px;overflow:auto}
 #zoom-surface{position:absolute;inset:0;z-index:4;background:radial-gradient(ellipse at 45% 26%,#fff,#e2edf0 57%,#c5d8df);display:flex;align-items:flex-start;justify-content:center;padding:12px 8px calc(var(--zoom-panel-height, 210px) + 12px);box-sizing:border-box}#zoom-surface img{width:100%;height:100%;object-fit:contain}#zoom-surface canvas{width:100%;height:100%;display:block;touch-action:none}#zoom-surface:focus-within{outline:2px solid #184f69}
 @media(max-width:760px){.avatar-viewport:has(#zoom-panel:not([hidden])){min-height:560px;height:560px!important}}
 @media(max-width:440px){#zoom-panel{padding:8px;font-size:12px}#zoom-location{font-size:14px}#zoom-steps button{font-size:11px}}
 `;host.append(style);viewport.append(panel);
 const panelSize=new ResizeObserver(()=>{viewport.style.setProperty('--zoom-panel-height', panel.getBoundingClientRect().height+'px');});panelSize.observe(panel);
 const surface=document.createElement('div');surface.id='zoom-surface';surface.hidden=true;viewport.prepend(surface);
 const $=s=>panel.querySelector(s),nav=$('#zoom-steps'),back=$('#zoom-back'),next=$('#zoom-in'),status=$('#zoom-status'),progress=$('#zoom-progress');
 let entry=null,level=1,generation=0,controller,dispose=()=>{},busy=false;const cached=new Map(),variants={};
 const available=i=>i===0?Boolean(entry):i===1?Boolean(entry?.geometry.length):Boolean(catalog.bindings[entry?.id]?.[i]);
 const choices=i=>{const v=catalog.bindings[entry?.id]?.[i];return Array.isArray(v)?v:v?[v]:[];};
 const spec=(i,index=variants[i]||0)=>catalog.materials[choices(i)[index]];
 const title=()=>Array.isArray(entry.names.de)?entry.names.de.join(', '):entry.names.de||entry.id;
 function sync(){
  panel.hidden=!entry;if(!entry)return;panel.dataset.level=String(level);panel.dataset.structure=entry.id;panel.dataset.busy=String(busy);panel.dataset.material=level>1?choices(level)[variants[level]||0]:'';
  const options=level>1?choices(level):[],switcher=$('#zoom-variants');switcher.hidden=options.length<2;
  if(switcher.dataset.options!==options.join(',')){switcher.replaceChildren(...options.map((key,i)=>{const b=document.createElement('button');b.type='button';b.dataset.zoomVariant=i;b.textContent=catalog.materials[key].kind==='glb'?'3D-Modell':'Beschriftetes Schema';b.addEventListener('click',()=>go(level,i));return b;}));switcher.dataset.options=options.join(',');}
  for(const b of switcher.children){b.disabled=busy;b.setAttribute('aria-pressed',String(Number(b.dataset.zoomVariant)===(variants[level]||0)));}
  $('#zoom-location').textContent=`${title()} › ${names[level]}${level>1?' · '+spec(level).title:''}`;
  const legend=$('#zoom-color-legend');legend.hidden=!(level>1&&spec(level).kind==='lines');legend.textContent=legend.hidden?'':'Farbe: Kettenanfang blau → Kettenende rot';
  for(const [i,b]of [...nav.children].entries()){b.disabled=!available(i)||busy;b.setAttribute('aria-current',i===level?'step':'false');b.title=available(i)?names[i]:catalog.missing;}
  const target=names.findIndex((_,i)=>i>level&&available(i));next.disabled=target<0||busy;back.disabled=level===0||busy;
  next.textContent=target>=0?`Hineinzoomen · ${names[target]}`:'Hineinzoomen';
  const missing=names.filter((_,i)=>i>1&&!available(i));
  $('#zoom-explanation').textContent=level>1?(spec(level).sentence||''):missing.length?`${missing.join(' / ')}: ${catalog.missing}`:'';
  const credit=$('#zoom-source small');credit.replaceChildren();
  const s=level>1?spec(level):null;$('#zoom-credit').textContent='Quelle: '+(s?s.credit.split(' · ')[0]+' · '+s.license:'LOOK1-Atlas');credit.append(document.createTextNode(s?`${s.bytes.toLocaleString('de-DE')} Bytes · ${s.credit} · ${s.license}. Thematische Referenz; nicht räumlich im Organ registriert. `:'Bestehender LOOK1-Atlas. '));
  if(s?.limits)credit.append(document.createTextNode(s.limits+' '));
  if(s?.file==='renal_corpuscle_kidney.png')credit.append(document.createTextNode('Deutsche Beschriftung: Übersetzung, ärztliche Prüfung ausstehend. '));
  const link=document.createElement('a');link.href=new URL(s?'QUELLEN-LIZENZEN.txt':'../sources/ZOOM1-Atlas-Quellen.txt',BASE);link.textContent='Quellen und Lizenzen (.txt)';link.target='_blank';link.rel='noopener';credit.append(link);
 }
 function clear(){controller?.abort();dispose();dispose=()=>{};surface.replaceChildren();surface.hidden=true;progress.hidden=true;}
 async function bytes(s,signal){
  if(cached.has(s.file))return cached.get(s.file);
  if(s.bytes>catalog.budget)throw Error('Stufe überschreitet 2 MB');
  const r=await fetch(new URL(s.file,BASE),{signal});if(!r.ok)throw Error('Zoommaterial fehlt');
  if(Number(r.headers.get('Content-Length'))>catalog.budget)throw Error('Stufe überschreitet 2 MB');
  const reader=r.body.getReader(),chunks=[];let count=0;progress.hidden=false;progress.max=s.bytes;progress.value=0;
  while(true){const {done,value}=await reader.read();if(done)break;count+=value.length;if(count>catalog.budget){await reader.cancel();throw Error('Stufe überschreitet 2 MB');}chunks.push(value);progress.value=count;status.textContent=`Wird geladen: ${count.toLocaleString('de-DE')} / ${s.bytes.toLocaleString('de-DE')} Bytes`;}
  const b=new Uint8Array(count);let offset=0;for(const c of chunks){b.set(c,offset);offset+=c.length;}
  const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(x=>x.toString(16).padStart(2,'0')).join('');
  if(count!==s.bytes||sha!==s.sha256)throw Error('Zoomdatei stimmt nicht mit dem Quellenkatalog überein');cached.set(s.file,b);return b;
 }
 async function go(target,variant=variants[target]||0){
  if(!entry||!available(target)||busy)return;
  const token=++generation,previous=level;clear();status.textContent='';
  if(target<2){level=target;target===0?body():organ();busy=false;sync();return;}
  controller=new AbortController();busy=true;sync();
  try{
   const s=spec(target,variant);progress.hidden=false;progress.max=s.bytes;progress.value=0;status.textContent=names[target]+' wird geladen …';const b=await bytes(s,controller.signal);if(token!==generation)return;
   surface.hidden=false;
   if(s.kind==='image'){
    const img=document.createElement('img'),url=URL.createObjectURL(new Blob([b],{type:s.file.endsWith('.svg')?'image/svg+xml':s.file.endsWith('.png')?'image/png':'image/jpeg'}));
    dispose=()=>URL.revokeObjectURL(url);img.src=url;img.alt=s.title;surface.append(img);await img.decode();
   }else{
    const {drawZoom}=await import('./zoom-renderer.js');if(token!==generation)return;
    dispose=await drawZoom(surface,s,b);if(token!==generation){dispose();return;}
   }
   level=target;variants[target]=variant;status.textContent=s.kind==='image'?'Referenzschema / Bild':'Ziehen zum Drehen · Pfeiltasten';
  }catch(e){if(token!==generation)return;clear();level=choices(target).length>1?target:previous;status.textContent='Diese Stufe konnte nicht geladen werden: '+e.message;}
  finally{if(token===generation){busy=false;progress.hidden=true;sync();if(document.activeElement===document.body&&choices(target).length>1)$('#zoom-variants').querySelector(`[data-zoom-variant="${variants[target]||0}"]`)?.focus({preventScroll:true});}}
 }
 for(const [i,name]of names.entries()){const b=document.createElement('button');b.type='button';b.textContent=name;b.dataset.zoomLevel=i;b.addEventListener('click',()=>go(i));nav.append(b);}
 next.addEventListener('click',()=>go(names.findIndex((_,i)=>i>level&&available(i))));
 back.addEventListener('click',()=>{for(let i=level-1;i>=0;i--)if(available(i)){go(i);break;}});
 return {select(e){++generation;clear();entry=e;for(const k of Object.keys(variants))delete variants[k];level=1;busy=false;status.textContent='';sync();if(e.geometry.length)organ();},hide(){++generation;clear();entry=null;busy=false;sync();},dispose(){++generation;clear();panelSize.disconnect();viewport.style.removeProperty('--zoom-panel-height');panel.remove();surface.remove();style.remove();}};
}
