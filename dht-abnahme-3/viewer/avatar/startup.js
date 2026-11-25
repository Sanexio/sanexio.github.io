const startupHint=globalThis.__dhtStartupHint ||= {dismissed:false};
export const layerChoices=[['haut','◉','Haut'],['muskel','≋','Muskeln'],['skelett','🦴','Skelett'],['organ','♥','Organe'],['binde','⌁','Bänder & Sehnen'],['nerven','⌘','Nervensystem'],['gefaesse','🩸','Gefäßsystem']];
export const peelLayers=['haut','muskel','binde','organ','skelett','nerven','gefaesse'];
export const suggestions=[['org1:organ:heart','Herz'],['TA2:3023:M','Leber'],['org1:organ:lung-left','Lunge'],['org1:organ:brain','Gehirn'],['kms2:bone:patella-l:L','Kniescheibe'],['kms2:bone:scapula-l:L','Schulterblatt']];
export const femaleLayerChoices=layerChoices.filter(([id])=>id!=='gefaesse');
export const femalePeelLayers=peelLayers.filter(id=>id!=='gefaesse');
export function mountAvatarShell(host,{female=false}={}){
 const layers=female?femaleLayerChoices:layerChoices,depth=female?femalePeelLayers:peelLayers;
 host.innerHTML=`<div class="avatar-search"><label for="anatomie-suche">Was möchten Sie entdecken?</label><input id="anatomie-suche" type="search" autocomplete="off" placeholder="Was möchten Sie sehen? z. B. Herz, Knie, Schulter" aria-controls="search-results"><div class="quick-suggestions" aria-label="Ideen zum Entdecken"></div><div id="search-results" aria-label="Suchvorschläge" hidden></div></div><div class="layer-panel"><div class="layer-bar" role="group" aria-label="Körperschichten"></div><label class="peel-label" for="layer-peel">Schicht für Schicht <input id="layer-peel" type="range" min="0" max="${depth.length-1}" step="1" value="0" aria-valuetext="Haut"></label><p class="start-hint">Tippen Sie auf den Körper, wechseln Sie die Schicht oder suchen Sie ein Organ.</p><p id="layer-status" role="status">Die Figur wird vorbereitet …</p><progress id="male-load-progress" aria-label="Körper laden"></progress></div><div class="avatar-viewport"><div class="avatar-labels"></div><div id="canvas-name" hidden><p></p><button type="button" id="canvas-reset" class="secondary">Zurück zur ganzen Figur</button></div></div><div class="avatar-actions"></div><div class="discovery-card"><p id="avatar-treffer" aria-live="polite">Entdecken Sie Ihren Körper</p><button type="button" id="whole-body" class="secondary">Zurück zur ganzen Figur</button></div><details id="technical-info"><summary>Technische Angaben</summary><p id="muscle-coverage"></p><p id="avatar-status" role="status">Feine Ansicht wird lokal vorbereitet …</p><label>Alle Körperteile <select id="anatomie-struktur"></select></label><p>Studienhülle, männlicher Quellatlas. Keine individuelle Morphometrie. Gewebe, Zellen und Moleküle liegen nicht als räumliche Daten vor.</p></details>`;
 for(const [id,icon,name] of layers){const b=document.createElement('button');b.type='button';b.dataset.layer=id;b.className='layer-button';b.setAttribute('aria-pressed',String(id==='haut'));const symbol=document.createElement('span');symbol.setAttribute('aria-hidden','true');symbol.textContent=icon;b.append(symbol,document.createTextNode(name));host.querySelector('.layer-bar').append(b);}
 for(const [id,name]of suggestions){const b=document.createElement('button');b.type='button';b.dataset.entry=id;b.textContent=name;host.querySelector('.quick-suggestions').append(b);}
 const credit=document.createElement('a');credit.href=new URL('./nerven/IMPRESSUM.txt',import.meta.url);credit.textContent='Impressum · Anatomiequellen und Lizenzen';host.querySelector('#technical-info').append(credit);
 if(!female){const credit=document.createElement('a');credit.href=new URL('./gefaesse/QUELLEN.txt',import.meta.url);credit.textContent='Gefäßsystem · Quelle und Lizenz';host.querySelector('#technical-info').append(document.createElement('br'),credit);}
 const toolbar=document.querySelector('.anatomie-toolbar');if(toolbar&&['explore','data'].includes(document.querySelector('.app')?.dataset.mode))host.querySelector('#technical-info').append(toolbar);
 if(startupHint.dismissed)host.querySelector('.start-hint').classList.add('dismissed');
 host.addEventListener('click',()=>{startupHint.dismissed=true;host.querySelector('.start-hint')?.classList.add('dismissed');},{once:true});
 // Queue a choice even while the detailed local atlas is still downloading.
 host.addEventListener('click',e=>{if(host.dataset.ready==='true')return;const b=e.target.closest('[data-layer],[data-entry]');if(!b)return;host.dataset.pendingLayer=b.dataset.layer||'';host.dataset.pendingEntry=b.dataset.entry||'';host.querySelector('#layer-status').textContent='Ihre Auswahl wird gleich angezeigt …';});
}

/** CPU first paint from the same local hull; WebGL is initialized after this image. */
export async function previewView(host,{signal}={}){
 const canvas=document.createElement('canvas');canvas.id='avatar-canvas';canvas.setAttribute('aria-label','Körper wird vorbereitet');canvas.tabIndex=0;
 const viewport=host.querySelector('.avatar-viewport')||document.createElement('div');viewport.classList.add('avatar-viewport');viewport.prepend(canvas);if(!viewport.parentElement)host.append(viewport);
 viewport.style.background='radial-gradient(ellipse at 45% 26%, #426b80 0%, #294d66 57%, #183649 100%)';
 const response=await fetch(new URL('assets/male-preview.bin',import.meta.url),{signal});if(!response.ok)throw Error('Startfigur fehlt');const data=await response.arrayBuffer(),header=new Uint32Array(data,0,2),count=header[0],faces=header[1];
 const p=new Float32Array(data,8,count*3),n=new Float32Array(data,8+count*12,count*3),indices=new Uint16Array(data,8+count*24,faces);
 performance.mark('dht-preview-geometry');
 const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('Startbild nicht verfügbar');
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<p.length;i++){const k=i%3;min[k]=Math.min(min[k],p[i]);max[k]=Math.max(max[k],p[i]);}
 const center=min.map((v,k)=>(v+max[k])/2);let angle=0,stopped=false;
 function draw(){
  if(stopped)return;
  const ratio=Math.min(.75,640/Math.max(viewport.clientWidth,viewport.clientHeight)),w=Math.max(1,Math.round(viewport.clientWidth*ratio)),h=Math.max(1,Math.round(viewport.clientHeight*ratio));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}else ctx.clearRect(0,0,w,h);
  const aspect=w/h,distance=Math.max(max[1]-min[1],(max[0]-min[0])/aspect,max[2]-min[2])*3.27085/2*1.12,s=Math.sin(angle),c=Math.cos(angle),vertices=[];
  for(let i=0;i<count;i++){const x=p[i*3]-center[0],y=p[i*3+1]-center[1],z=p[i*3+2]-center[2],depth=distance-(-s*x+c*z);vertices.push([(c*x+s*z)*3.27085/aspect/depth*w/2+w/2,h/2-y*3.27085/depth*h/2,depth]);}
  const image=ctx.createImageData(w,h),pixels=image.data,depths=new Float32Array(w*h);depths.fill(Infinity);
  for(let i=0;i<faces;i+=3){const ids=[indices[i],indices[i+1],indices[i+2]],a=vertices[ids[0]],b=vertices[ids[1]],d=vertices[ids[2]];
   let nx=0,ny=0,nz=0;for(const id of ids){nx+=n[id*3];ny+=n[id*3+1];nz+=n[id*3+2];}const length=Math.hypot(nx,ny,nz)||1,light=.72+.28*Math.max((-.371*(c*nx+s*nz)+.557*ny+.743*(-s*nx+c*nz))/length,0);
   const area=(b[0]-a[0])*(d[1]-a[1])-(b[1]-a[1])*(d[0]-a[0]);if(Math.abs(area)<.001)continue;
   const x0=Math.max(0,Math.floor(Math.min(a[0],b[0],d[0]))),x1=Math.min(w-1,Math.ceil(Math.max(a[0],b[0],d[0]))),y0=Math.max(0,Math.floor(Math.min(a[1],b[1],d[1]))),y1=Math.min(h-1,Math.ceil(Math.max(a[1],b[1],d[1])));
   for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const u=((b[0]-x-.5)*(d[1]-y-.5)-(b[1]-y-.5)*(d[0]-x-.5))/area,v=((d[0]-x-.5)*(a[1]-y-.5)-(d[1]-y-.5)*(a[0]-x-.5))/area,t=1-u-v;if(u<0||v<0||t<0)continue;
    const depth=u*a[2]+v*b[2]+t*d[2],j=y*w+x;if(depth>=depths[j])continue;depths[j]=depth;
    pixels[j*4]=37*light;pixels[j*4+1]=142*light;pixels[j*4+2]=198*light;pixels[j*4+3]=230;
   }
  }
  ctx.putImageData(image,0,0);
 }
 performance.mark('dht-preview-built');const started=performance.now();draw();const lowPower=performance.now()-started>250;
 const resize=new ResizeObserver(draw);resize.observe(viewport);host.dataset.preview='true';performance.mark('dht-figure-visible');
 let frame;const start=performance.now();if(!matchMedia('(prefers-reduced-motion: reduce)').matches){const tick=t=>{if(stopped)return;angle=Math.sin(Math.min(1,(t-start)/2200)*Math.PI/2)*.18;draw();if(t-start<2200)frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);}
 return {viewport,canvas,lowPower,geometry:{positions:p,normals:n,indices},get angle(){return angle;},freeze(){cancelAnimationFrame(frame);},dispose(){stopped=true;cancelAnimationFrame(frame);resize.disconnect();canvas.remove();}};
}
