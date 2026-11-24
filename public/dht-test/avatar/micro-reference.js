import {enabled,checked,section,notice} from './local-source.js';

export async function mountMicroReferences(parent = document.querySelector('.app')) {
  if(!await enabled(8))return;
  const base=new URL('micro/',import.meta.url),data=await (await fetch(new URL('sources.json',base))).json();
  const host=section('micro-references','Gewebe · Zelle · Molekül: getrennte Referenzen',parent);
  notice(host,'Kein durchgehender Zoom vom Organ zur Zelle. Diese Referenzen sind weder untereinander noch zum Atlas räumlich registriert. Keine individuelle Anatomie.');
  const label=document.createElement('label');label.textContent='Referenz ';const select=document.createElement('select');select.id='micro-choice';label.append(select);host.append(label);
  for(const s of data.sources)select.add(new Option(s.title,s.id));
  const credit=notice(host,'');credit.id='micro-credit';credit.style.overflowWrap='anywhere';
  const image=document.createElement('img');image.id='micro-image';image.style.cssText='display:block;max-width:100%;width:640px;height:auto';host.append(image);
  const canvas=document.createElement('canvas');canvas.id='micro-molecule';canvas.width=900;canvas.height=520;canvas.style.cssText='max-width:100%;height:auto';host.append(canvas);
  const scale=notice(host,'');scale.id='micro-scale';const bar=document.createElement('div');bar.id='micro-scale-bar';bar.style.cssText='border-top:4px solid #16394c;height:12px;max-width:100%';host.append(bar);
  const loaded=new Map();let active;
  for(const s of data.sources)loaded.set(s.id,await checked(new URL(s.file,base),s.sha256));
  function updateScale(){if(!active?.pixels_per_meter)return;const meters=active.scale_um/1e6;const width=meters*active.pixels_per_meter*(image.clientWidth/image.naturalWidth);bar.style.width=width+'px';bar.dataset.meters=String(meters);bar.dataset.width=String(width);}
  const observer=new ResizeObserver(updateScale);observer.observe(image);image.addEventListener('load',updateScale);
  let imageURL;
  function show(){
    active=data.sources.find(s=>s.id===select.value);const s=active;
    credit.textContent=`${s.title} · ${s.credit} · ${s.origin} · Bild/Daten: ${s.image_url||s.origin} · Lizenz ${s.license}, gelesen ${s.license_read_at}: ${s.license_url} · ${s.publication} · ${s.change} · SHA-256 ${s.sha256}`;
    image.hidden=s.id==='molecule';canvas.hidden=s.id!=='molecule';bar.hidden=false;
    if(s.id!=='molecule'){
      if(imageURL)URL.revokeObjectURL(imageURL);imageURL=URL.createObjectURL(new Blob([loaded.get(s.id)],{type:'image/jpeg'}));image.src=imageURL;image.alt=s.title;
      scale.textContent=`Maßstabsbalken ${s.scale_um} µm; Originalkalibrierung ${s.pixels_per_meter.toLocaleString('de-DE')} Pixel/m. Bild proportional verkleinert; kein Atlasbezug.`;
    }else{
      const pdb=new TextDecoder().decode(loaded.get(s.id));const atoms=pdb.split('\n').filter(l=>l.startsWith('ATOM  ')).map(l=>({x:Number(l.slice(30,38)),y:Number(l.slice(38,46)),element:l.slice(76,78).trim()}));
      if(!atoms.length||atoms.some(p=>!Number.isFinite(p.x+p.y)))throw Error('Molekülkoordinaten ungültig');
      const xs=atoms.map(p=>p.x),ys=atoms.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
      const factor=Math.min(780/(maxX-minX),400/(maxY-minY)),ctx=canvas.getContext('2d');ctx.fillStyle='#eaf0f3';ctx.fillRect(0,0,900,520);
      for(const a of atoms){ctx.fillStyle=({C:'#455568',N:'#285ce0',O:'#d43535',P:'#d29721'})[a.element]||'#76937b';ctx.beginPath();ctx.arc(60+(a.x-minX)*factor,450-(a.y-minY)*factor,4,0,Math.PI*2);ctx.fill();}
      ctx.fillStyle='#16394c';ctx.fillRect(60,480,10*factor,4);ctx.font='18px sans-serif';ctx.fillText('1 nm (10 Å)',60,510);
      canvas.dataset.atoms=atoms.length;canvas.dataset.pixelsPerAngstrom=factor;bar.hidden=true;
      scale.textContent=`1BNA: ${atoms.length} Atome, x/y-Projektion der Archivkoordinaten in Å (1 Å = 0,1 nm). Maßstabsbalken 1 nm. Atompunkte, keine Bindungs- oder Ortsbehauptung.`;
    }
    host.dataset.reference=s.id;
  }
  select.addEventListener('change',show);show();
  function wireExistingButtons(){
    for(const [name,id] of [['gewebe','tissue'],['zelle','cell'],['molekül','molecule']]){
      const b=document.getElementById('avatar-'+name);if(!b||b.dataset.referenceBound)return;
      b.disabled=false;b.textContent=name[0].toUpperCase()+name.slice(1)+' · Referenz';b.dataset.referenceBound='true';
      b.addEventListener('click',()=>{select.value=id;show();host.scrollIntoView({block:'start'});});
    }
    const origin=document.getElementById('herkunft-inhalt');if(origin)origin.textContent=origin.textContent.replace('Gewebe/Zelle/Molekül nicht vorhanden.','Getrennte Gewebe-/Zell-/Molekülreferenzen vorhanden; keine räumliche Registrierung.');
  }
  wireExistingButtons();const buttonsObserver=new MutationObserver(wireExistingButtons);buttonsObserver.observe(document.querySelector('.layout'),{childList:true,subtree:true});
  window.addEventListener('pagehide',()=>{observer.disconnect();buttonsObserver.disconnect();});
}
