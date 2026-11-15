import * as THREE from 'three';
import { smoothHullNormals } from './smooth-hull.js';
import { MeshoptDecoder } from './vendor/meshopt/meshopt_decoder.js';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';
import { OrbitControls } from './vendor/controls/OrbitControls.js';
import { createStructureLexicon } from './structure-lexicon.js';

const BASE = new URL('./', import.meta.url);
const colors = { bone: 0xe8ddbb, tooth: 0xfaf4dc, muscle: 0xa94e48, ligament: 0xe2bd71, tendon: 0xd0bd92, organ: 0x658ca5 };
const layerKinds = { haut: [], skelett: ['bone','tooth'], muskel: ['muscle'], organ: ['organ'], binde: ['ligament','tendon'] };
const label = (e) => [Array.isArray(e.names.de) ? e.names.de.join(', ') : e.names.de, Array.isArray(e.names.la) ? e.names.la.join(', ') : e.names.la].filter(Boolean).join(' · ') || e.id;
const btn = (text, id, handler) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'secondary'; b.textContent = text; b.id = id; b.addEventListener('click',handler); return b; };

export async function createAvatarView(host, { onRegion = () => {}, signal } = {}) {
  host.innerHTML = '<p id="avatar-status" role="status">Männlicher 3D-Avatar wird lokal geladen …</p><div class="avatar-viewport"><div class="avatar-labels"></div></div><div class="avatar-actions"></div><div class="avatar-search"><label>Struktur suchen (Deutsch/Latein) <input id="anatomie-suche" type="search" autocomplete="off"></label><label>Registerstruktur <select id="anatomie-struktur"></select></label></div><p id="avatar-treffer" aria-live="polite">Noch keine 3D-Struktur gewählt.</p><p class="muted">Studienhülle, männlicher Quellatlas. Keine individuelle Morphometrie. Gewebe, Zellen und Moleküle liegen nicht als räumliche Daten vor.</p>';
  const viewport = host.querySelector('.avatar-viewport');
  const labelsHost = host.querySelector('.avatar-labels');
  const status = host.querySelector('#avatar-status');
  const detail = host.querySelector('#avatar-treffer');
  const search = host.querySelector('#anatomie-suche');
  const select = host.querySelector('#anatomie-struktur');
  const actions = host.querySelector('.avatar-actions');
  host.setAttribute('aria-busy','true');
  const progress = document.createElement('progress'); progress.id='male-load-progress'; progress.setAttribute('aria-label','Männliche Ansicht laden'); status.after(progress);
  const manifestBytes = await (await fetch(new URL('manifest.json', BASE), {signal})).arrayBuffer();
  const manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
  if (manifest.sex !== 'male' || manifest.register_count !== 1559) throw new Error('Anatomieregister nicht freigegeben');
  const showLexicon = await createStructureLexicon(host, manifest, manifestBytes);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0xeaf0f3);
  renderer.domElement.id = 'avatar-canvas';
  renderer.domElement.setAttribute('aria-label','Männlicher 3D-Avatar; ziehen zum Drehen, Rad zum Zoomen, Struktur anklicken');
  renderer.domElement.tabIndex = 0;
  viewport.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.001, 20);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.minDistance = 0.015; controls.maxDistance = 7; controls.enableDamping = false;
  const body = new THREE.Group(); scene.add(body);
  scene.add(new THREE.HemisphereLight(0xffffff,0x465469,2.2));
  const light = new THREE.DirectionalLight(0xffffff, 2.8); light.position.set(1,2,3); scene.add(light);
  const back = new THREE.DirectionalLight(0xdce9ff, 1.5);back.position.set(-2,1,-2);scene.add(back);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const parse = (data) => new Promise((resolve,reject) => loader.parse(data, BASE.href, resolve,reject));
  const digest = async data => [...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(b=>b.toString(16).padStart(2,'0')).join('');
  async function download(file, description, expected) {
    const response = await fetch(new URL(file, BASE), {signal});
    if (!response.ok) throw Error('3D-Datei fehlt: '+file);
    const length = expected || Number(response.headers.get('Content-Length'));
    if(length) {progress.max=length;progress.value=0;} else progress.removeAttribute('value');
    const reader=response.body.getReader(),chunks=[];let received=0;
    while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);received+=value.length;if(length)progress.value=received;status.textContent=`${description}: ${(received/1000000).toFixed(1)} MB${length ? ' / '+(length/1000000).toFixed(1)+' MB' : ''} · Regionsknöpfe bereits bedienbar`;}
    const data=new Uint8Array(received);let offset=0;for(const c of chunks){data.set(c,offset);offset+=c.length;}return data.buffer;
  }
  const web = await (await fetch(new URL('male-web.json',BASE), {signal})).json();
  if(web.original_sha256 !== manifest.hull_sha256)throw Error('Hüllen-Originalbindung abweichend');
  const hullData = await download(web.file,'Männliche Hülle',web.bytes);
  if (await digest(hullData) !== web.sha256) throw new Error('Hüllen-Prüfsumme abweichend');
  const hull = (await parse(hullData)).scene;
  hull.traverse(o=>{ if(o.isMesh) {smoothHullNormals(o.geometry);o.material = new THREE.MeshStandardMaterial({color:0xb99d89,emissive:0xb99d89,emissiveIntensity:0.35,transparent:false,opacity:1,forceSinglePass:true,roughness:0.8,depthWrite:true,side:THREE.FrontSide});o.userData.hull=true;} });
  body.add(hull);
  const bundle = await download('assets/anatomy.bin','Anatomieregister');
  progress.removeAttribute('value'); status.textContent='3D wird vorbereitet; Regionsknöpfe bereits bedienbar';
  const assets = new Map(); const entries = new Map(manifest.entries.map(e=>[e.id,e]));
  const pathEntries = new Map();
  for (const e of manifest.entries) for(const file of e.geometry) {
    if(!pathEntries.has(file))pathEntries.set(file,[]);pathEntries.get(file).push(e);
  }
  let i=0;
  for (const asset of manifest.assets) {
    const data=bundle.slice(asset.offset,asset.offset+asset.length);
    if(await digest(data)!==asset.sha256) throw new Error('Anatomie-Prüfsumme abweichend');
    const group=(await parse(data)).scene;
    let triangles=0;
    group.traverse(o=>{if(o.isMesh){
      triangles+=(o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count)/3;
      o.material=new THREE.MeshStandardMaterial({color:colors[asset.kind],roughness:0.7,side:THREE.DoubleSide});
      o.userData.asset=asset; o.userData.entries=pathEntries.get(asset.file)||[];
    }});
    if(triangles!==asset.triangles) throw new Error('Dreieckszahl abweichend');
    group.visible=false;body.add(group);assets.set(asset.file,{...asset,group});
    if(++i%50===0){status.textContent=`Lokal geladen: ${i}/${manifest.assets.length} Geometrien`;await new Promise(r=>setTimeout(r,0));}
  }
  let layer='haut', selected=null, lastHit=null, pins=[], labelsEnabled=false, regionBox=null;
  const raycaster=new THREE.Raycaster();
  const selectedBox=()=>{
    const box=new THREE.Box3();
    for(const file of selected?.geometry||[]) {const a=assets.get(file);if(a?.group.visible)box.union(new THREE.Box3().setFromObject(a.group));}
    return box;
  };
  const frame=(box, factor=1.35)=>{
    if(box.isEmpty())return;
    const center=box.getCenter(new THREE.Vector3()), size=box.getSize(new THREE.Vector3());
    const vertical=Math.max(size.y,size.x/camera.aspect,size.z,0.025);
    const distance=vertical/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)))*factor;
    const direction=camera.position.clone().sub(controls.target).normalize();
    if(direction.lengthSq()===0)direction.set(0,0,1);
    controls.target.copy(center);camera.position.copy(center).addScaledVector(direction,distance);controls.update();render();
  };
  const bodyBox=new THREE.Box3().setFromObject(hull);
  const reset=()=>{camera.position.set(0,0.86,3.5);controls.target.set(0,0.86,0);frame(bodyBox,1.12);};
  const rotate=angle=>{const d=camera.position.clone().sub(controls.target);d.applyAxisAngle(new THREE.Vector3(0,1,0),angle);camera.position.copy(controls.target).add(d);controls.update();render();};
  const zoom=(factor)=>{camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);controls.update();render();};
  actions.append(btn('Körper','avatar-body',reset),btn('Region','avatar-region',()=>{if(regionBox)frame(regionBox);}),btn('Struktur','avatar-focus',()=>{frame(selectedBox());}),btn('↶ Drehen','avatar-left',()=>rotate(Math.PI/6)),btn('Drehen ↷','avatar-right',()=>rotate(-Math.PI/6)),btn('＋ Näher','avatar-near',()=>zoom(0.75)),btn('− Weiter','avatar-far',()=>zoom(1.33)));
  host.querySelector('#avatar-region').disabled=true;host.querySelector('#avatar-focus').disabled=true;
  for(const name of ['Gewebe','Zelle','Molekül']){const b=btn(`${name} · keine Daten`,`avatar-${name.toLowerCase()}`,()=>{});b.disabled=true;actions.append(b);}
  function renderLabels(){
    labelsHost.replaceChildren();if(!labelsEnabled)return;
    let candidates=pins.filter(e=>e.geometry.some(f=>assets.get(f)?.group.visible));
    if(candidates.length<8) for(const a of assets.values()) {
      const e=pathEntries.get(a.file)?.[0];
      if(a.group.visible&&e&&!candidates.includes(e))candidates.push(e);
      if(candidates.length>=8)break;
    }
    const occupied=[];
    for(const e of candidates.slice(0,8)) {
      const box=new THREE.Box3(); for(const f of e.geometry){const a=assets.get(f);if(a?.group.visible)box.union(new THREE.Box3().setFromObject(a.group));}
      if(box.isEmpty())continue;
      const world=box.getCenter(new THREE.Vector3()); // Box3.setFromObject already returns world coordinates
      const p=world.clone().project(camera);if(Math.abs(p.x)>1||Math.abs(p.y)>1||p.z>1||p.z< -1)continue;
      const anchorX=(p.x+1)*viewport.clientWidth/2, anchorY=(1-p.y)*viewport.clientHeight/2;
      let x=Math.min(viewport.clientWidth-170,Math.max(2,anchorX+12)),y=Math.max(0,Math.min(viewport.clientHeight-25,anchorY));
      while(occupied.some(q=>Math.abs(q.x-x)<170&&Math.abs(q.y-y)<24)&&y<viewport.clientHeight-25)y+=24;
      if(y>viewport.clientHeight-25){ y=anchorY-24; while(occupied.some(q=>Math.abs(q.x-x)<170&&Math.abs(q.y-y)<24)&&y>0)y-=24; if(y<0)continue; }
      occupied.push({x,y});
      const el=document.createElement('span');el.className='avatar-label';el.textContent=label(e).split(' · ')[0];el.style.left=`${x}px`;el.style.top=`${y}px`;el.dataset.entry=e.id;el.dataset.world=world.toArray().join(',');el.dataset.anchor=`${anchorX},${anchorY}`;
      const line=document.createElement('span');line.className='avatar-leader';line.style.left=`${anchorX}px`;line.style.top=`${anchorY}px`;line.style.width=`${Math.hypot(x-anchorX,y-anchorY)}px`;line.style.transform=`rotate(${Math.atan2(y-anchorY,x-anchorX)}rad)`;labelsHost.append(line,el);
    }
  }
  function render(){renderer.render(scene,camera);renderLabels();}
  function updateVisibility(){
    let triangles=141050, omitted=0;
    for(const a of assets.values()) {
      const show=layerKinds[layer]?.includes(a.kind);
      a.group.visible=Boolean(show && triangles+a.triangles<=manifest.triangle_limit);
      if(a.group.visible)triangles+=a.triangles;else if(show)omitted++;
    }
    status.textContent=`3D lokal bereit · ${manifest.register_count} Registereinträge · ${[...assets.values()].filter(a=>a.group.visible).length} sichtbare Anatomieobjekte · ${triangles.toLocaleString('de-DE')} Dreiecke${omitted ? ` · ${omitted} durch Detailbudget ausgeblendet` : ''}`;
    host.dataset.triangles=String(triangles);host.dataset.layer=layer;render();
  }
  function choose(e,hit=null){
    selected=e;lastHit=hit; select.value=e.id;
    showLexicon(e);
    for(const asset of assets.values())asset.group.traverse(o=>{if(o.isMesh)o.material.emissive.setHex(0);});
    if(e.geometry.length===0){detail.textContent=`${label(e)} — keine freigegebene Einzelgeometrie im Register; räumliche Auswahl gesperrt.`;host.querySelector('#avatar-focus').disabled=true;render();return;}
    const a=assets.get(e.geometry[0]);if(!a){detail.textContent='Geometrie gesperrt oder nicht vorhanden.';return;}
    if(!layerKinds[layer].includes(a.kind)) {layer=Object.keys(layerKinds).find(k=>layerKinds[k].includes(a.kind));document.getElementById('schicht-wahl').value=layer;updateVisibility();}
    // Selected object has priority within the measured view budget.
    for(const file of e.geometry){const selectedAsset=assets.get(file);if(!selectedAsset)continue;
      if(!selectedAsset.group.visible){for(const other of assets.values())other.group.visible=false;selectedAsset.group.visible=true;}
    }
    for(const asset of assets.values()) asset.group.traverse(o=>{if(o.isMesh)o.material.emissive.setHex(e.geometry.includes(asset.file)?0x164c43:0);});
    pins=pins.filter(p=>p.id!==e.id);pins.unshift(e);pins=pins.slice(0,8);
    const box=selectedBox();regionBox=box.clone().expandByScalar(0.15);regionBox.intersect(bodyBox);
    host.querySelector('#avatar-focus').disabled=box.isEmpty();host.querySelector('#avatar-region').disabled=box.isEmpty();
    detail.textContent=`${label(e)} · ${e.id} · ${hit ? 'echter 3D-Dreieckstreffer' : 'Registerauswahl'} · ${e.license||'Lizenz siehe Herkunft'} · ${e.placement?.warning||'Atlaslage, keine individuelle Morphometrie'}`;
    host.dataset.selected=e.id;render();
  }
  const fillSelect=()=>{
    const term=search.value.toLocaleLowerCase('de').trim();select.replaceChildren();
    const empty=document.createElement('option');empty.value='';empty.textContent='Struktur wählen';select.append(empty);
    for(const e of manifest.entries){if(term&&!`${label(e)} ${e.id}`.toLocaleLowerCase('de').includes(term))continue;const o=document.createElement('option');o.value=e.id;o.textContent=`${label(e)}${e.geometry.length?'':' — keine Geometrie'}`;select.append(o);}
    if(selected)select.value=selected.id;
  };
  search.addEventListener('input',fillSelect);select.addEventListener('change',()=>{const e=entries.get(select.value);if(e)choose(e);});fillSelect();
  function pick(clientX,clientY){
    const r=renderer.domElement.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((clientX-r.left)/r.width*2-1,1-(clientY-r.top)/r.height*2),camera);
    const meshes=[];for(const a of assets.values())if(a.group.visible)a.group.traverse(o=>{if(o.isMesh)meshes.push(o);});
    const hit=raycaster.intersectObjects(meshes,false)[0];
    if(hit){const e=hit.object.userData.entries[0];if(e)choose(e,{point:hit.point.toArray(),faceIndex:hit.faceIndex,file:hit.object.userData.asset.file});return;}
    const shellHit=raycaster.intersectObject(hull,true)[0];
    if(shellHit){const p=shellHit.point;const region=p.y>1.52?'kopf':p.y>1.43?'hals':Math.abs(p.x)>0.20&&p.y>0.76?(p.x>0?'arm_links':'arm_rechts'):p.y>1.16?'brust':p.y>0.97?'bauch':p.y>0.78?'becken':p.x>0?'bein_links':'bein_rechts';onRegion(region);}
  }
  let pointer=null, tapPending=false;
  renderer.domElement.addEventListener('pointerdown',ev=>{tapPending=false;pointer=[ev.clientX,ev.clientY];});
  renderer.domElement.addEventListener('pointerup',ev=>{tapPending=Boolean(pointer&&Math.hypot(ev.clientX-pointer[0],ev.clientY-pointer[1])<5);pointer=null;});
  // Finish the native gesture before a region change scrolls/reorders the page.
  renderer.domElement.addEventListener('click',ev=>{if(tapPending){tapPending=false;pick(ev.clientX,ev.clientY);}});
  renderer.domElement.addEventListener('pointercancel',()=>{pointer=null;tapPending=false;});
  renderer.domElement.addEventListener('keydown',ev=>{if(ev.key==='ArrowLeft'){ev.preventDefault();rotate(Math.PI/12);}if(ev.key==='ArrowRight'){ev.preventDefault();rotate(-Math.PI/12);}if(ev.key==='+')zoom(0.8);if(ev.key==='-')zoom(1.25);});
  controls.addEventListener('change',render);
  const resize=new ResizeObserver(()=>{const w=viewport.clientWidth,h=viewport.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();render();});resize.observe(viewport);
  reset();updateVisibility();host.dataset.ready='true';host.setAttribute('aria-busy','false');progress.hidden=true;
  const api={
    setLayer(value){if(layer!==value){selected=null;lastHit=null;select.value='';delete host.dataset.selected;showLexicon(null);detail.textContent='Schicht gewechselt — Struktur im 3D-Bild anklicken oder im Register wählen.';host.querySelector('#avatar-focus').disabled=true;}layer=value;updateVisibility();},
    setOpacity(value){hull.traverse(o=>{if(o.isMesh){const opacity=Math.min(1,Math.max(0,value));o.material.opacity=opacity;o.material.transparent=opacity<1;o.material.depthWrite=opacity===1;o.material.needsUpdate=true;}});render();},
    setLabels(value){labelsEnabled=value;render();},
    focusRegion(id){const bounds={kopf:[1.48,1.72],hals:[1.4,1.53],brust:[1.15,1.44],bauch:[0.96,1.17],becken:[0.77,0.98],ruecken:[0.85,1.48],arm_links:[0.7,1.45],arm_rechts:[0.7,1.45],bein_links:[0,0.85],bein_rechts:[0,0.85]}[id];if(!bounds)return;regionBox=bodyBox.clone();regionBox.min.y=bounds[0];regionBox.max.y=bounds[1];if(id.endsWith('_links'))regionBox.min.x=0;if(id.endsWith('_rechts'))regionBox.max.x=0;host.querySelector('#avatar-region').disabled=false;frame(regionBox);},
    state(){return {revision:THREE.REVISION,selected:selected?.id,hit:lastHit,layer,camera:camera.position.toArray(),target:controls.target.toArray(),triangles:renderer.info.render.triangles,hullOpacity:hull.children.find(o=>o.isMesh)?.material.opacity,highlighted:[...assets.values()].filter(a=>{let lit=false;a.group.traverse(o=>{if(o.isMesh&&o.material.emissive.getHex()!==0)lit=true;});return a.group.visible&&lit;}).map(a=>a.file),visible:[...assets.values()].filter(a=>a.group.visible).map(a=>a.file),labels:labelsHost.querySelectorAll('.avatar-label').length,register:manifest.register_count};},
    dispose(){resize.disconnect();controls.dispose();scene.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});renderer.dispose();},
  };
  // Read-only observability; interaction always follows the actual DOM/canvas handlers.
  Object.defineProperty(host,'avatarState',{value:()=>api.state()});
  Object.defineProperty(host,'avatarInventory',{value:()=>[...assets.values()].map(a=>{
    let objects=0,triangles=0;a.group.traverse(o=>{if(o.isMesh){objects++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});
    return {file:a.file,kind:a.kind,visible:a.group.visible,objects,triangles,entryIds:(pathEntries.get(a.file)||[]).map(e=>e.id)};
  })});
  Object.defineProperty(host,'avatarGeometry',{value:()=>{
    hull.updateWorldMatrix(true,true);
    const rows=[];hull.traverse(o=>{if(o.isMesh){const g=o.geometry,p=g.getAttribute('position'),points=[];
      for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i);o.localToWorld(v);body.worldToLocal(v);points.push(v.x,v.y,v.z);}
      rows.push({id:'AHF2_male_study_envelope',name:o.name,positions:points,indices:g.index?Array.from(g.index.array):Array.from({length:p.count},(_,i)=>i)});
    }});return rows;
  }});
  return api;
}
