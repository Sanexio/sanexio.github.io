import {attachOrganAtlas} from './organatlas-suche.js';
import {bindMuscleParts} from './muskelgruppen.js';
import {atlasSurfaces,nerveEntries,brainEntry} from './nerven/schicht.js';
import {createDataMarkers} from './data-markers.js';
import {layerLifecycle,organsAfterPaint,surfaceSelection,replayPendingSelection} from './layer-lifecycle.js';
import {studio,outlineMaterial,bakedSurfaces} from './look1-style.js';
import {mountAvatarShell,layerChoices,suggestions,peelLayers} from './explore-shell.js';
import * as THREE from 'three';
import { smoothHullNormals } from './smooth-hull.js';
import { MeshoptDecoder } from './vendor/meshopt/meshopt_decoder.js';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';
import { OrbitControls } from './vendor/controls/OrbitControls.js';
import { createStructureLexicon } from './structure-lexicon.js';

const BASE = new URL('./', import.meta.url);
// Baked on the original vertex order so LOOK1 colours and atlas picking stay aligned.
const organSurfaces = new Map([
  ['98ca1c35fe8728d156786f70c4578bd79396fed705e3645dfc18a62d0da6e691', ['oberflaechen/TA2-3023-M.glb', 'e39989623619cc26ce213ffc565029626d085778e5e40f15cb8626607a992fe0']],
  ['4a58841fe34236307d1f3b1f2facdaf867a995c01628f4ff2da4965d663efa53', ['oberflaechen/TA2-3114-M.glb', 'e2bfc107373cb8108149fe8f3bb41221064fce0d0f0a9dbd47e4e9f6cdc745df']],
]);
const colors = { bone: 0xe8ddbb, tooth: 0xfaf4dc, muscle: 0xa94e48, ligament: 0xe2bd71, tendon: 0xd0bd92, organ: 0x658ca5 };
const layerKinds = { haut: ['organ'], skelett: ['bone','tooth'], muskel: ['muscle'], organ: ['organ'], binde: ['ligament','tendon'], nerven: ['nerve'] };
const label = (e) => [Array.isArray(e.names.de) ? e.names.de.join(', ') : e.names.de, Array.isArray(e.names.la) ? e.names.la.join(', ') : e.names.la].filter(Boolean).join(' · ') || e.id;
const btn = (text, id, handler) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'secondary'; b.textContent = text; b.id = id; b.addEventListener('click',handler); return b; };

export async function createAvatarView(host, { onRegion = () => {}, signal, preview, onDataOrgan = () => {} } = {}) {
  if(!host.querySelector('#anatomie-suche'))mountAvatarShell(host);
  const viewport=host.querySelector('.avatar-viewport');
  if(preview)host.querySelector('#avatar-canvas').style.cssText='position:absolute;inset:0;z-index:1';
  const labelsHost = host.querySelector('.avatar-labels');
  const status = host.querySelector('#avatar-status');
  const detail = host.querySelector('#avatar-treffer');
  let zoomView, zoomPromise;
  async function selectZoom(e){
    zoomPromise ||= import('./zoom-view.js').then(m=>m.mountZoom(host,{organ:()=>{const box=selectedBox();frame(box,2);if(!box.isEmpty()){const shift=box.getSize(new THREE.Vector3()).y*.35;camera.position.y-=shift;controls.target.y-=shift;controls.update();render();}},body:reset}));
    zoomView=await zoomPromise;if(selected?.id===e.id)zoomView.select(e);
  }
  const badge=host.querySelector('#canvas-name');
  const syncBadge=()=>{badge.querySelector('p').replaceChildren(...[...detail.children].map(e=>e.cloneNode(true)));badge.hidden=false;};
  const search = host.querySelector('#anatomie-suche');
  const select = host.querySelector('#anatomie-struktur');
  const actions = host.querySelector('.avatar-actions');
  host.setAttribute('aria-busy','true');
  const progress=host.querySelector('#male-load-progress'),layerStatus=host.querySelector('#layer-status');
  const exploring=()=>document.querySelector('.app')?.dataset.mode==='explore';
  const manifestBytes = await (await fetch(new URL('manifest.json', BASE), {signal})).arrayBuffer();
  const manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
  const muscleEntries=manifest.entries.filter(e=>e.kind==='muscle'),representedMuscles=muscleEntries.filter(e=>e.geometry.length).length;
  host.querySelector('#muscle-coverage').textContent=`Muskeln: ${representedMuscles} von ${muscleEntries.length} Einträgen mit eigener 3D-Darstellung.`;
  if (manifest.sex !== 'male' || manifest.register_count !== 1559) throw new Error('Anatomieregister nicht freigegeben');
  const showLexicon = await createStructureLexicon(host, manifest, manifestBytes);
  const partResponse = await fetch(new URL('muskelgruppen.json', BASE), {signal});
  if (partResponse.ok) {
    const coverage = bindMuscleParts(manifest, await partResponse.json());
    const note = document.createElement('p');
    note.textContent = `${coverage.parts} weitere Atlasstrukturen sind einzeln auswählbar. Für ${coverage.groups} Muskeleinträge lassen sich ihre Bestandteile gemeinsam anzeigen.`;
    host.querySelector('#muscle-coverage').after(note);
  }
  performance.mark('dht-detail-scripts');
  const renderer = new THREE.WebGLRenderer({ antialias: !preview?.lowPower, alpha: true, preserveDrawingBuffer: true });
  const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
  const device=debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):'';
  const economy=Boolean(preview?.lowPower)||/swiftshader|llvmpipe|softpipe|software/i.test(device);
  host.dataset.renderer=device;host.dataset.renderQuality=economy?'economy':'full';
  const SurfaceMaterial=economy?THREE.MeshLambertMaterial:THREE.MeshStandardMaterial;
  renderer.setPixelRatio(economy?.75:Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0xeaf0f3);
  renderer.domElement.id = preview ? 'detail-canvas' : 'avatar-canvas';
  renderer.domElement.setAttribute('aria-label','Männlicher 3D-Avatar; ziehen zum Drehen, Rad zum Zoomen, Körperteil anklicken');
  renderer.domElement.tabIndex = 0;
  viewport.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.001, 20);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.minDistance = 0.015; controls.maxDistance = 7; controls.enableDamping = false;
  const body = new THREE.Group(); scene.add(body);
  const disposeStudio=studio(renderer,scene,viewport,{economy});
  performance.mark('dht-detail-studio');
  const surfaces=await bakedSurfaces(BASE,signal);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const parse = (data) => new Promise((resolve,reject) => loader.parse(data, BASE.href, resolve,reject));
  const digest = async data => [...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(b=>b.toString(16).padStart(2,'0')).join('');
  async function download(file, description, expected, quiet=false) {
    const response = await fetch(new URL(file, BASE), {signal});
    if (!response.ok) throw Error('3D-Datei fehlt: '+file);
    const length = expected || Number(response.headers.get('Content-Length'));
    if(!quiet){if(length) {progress.max=length;progress.value=0;} else progress.removeAttribute('value');}
    const reader=response.body.getReader(),chunks=[];let received=0;
    while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);received+=value.length;if(!quiet){if(length)progress.value=received;layerStatus.textContent=`${description}: ${(received/1000000).toFixed(1)} MB${length ? ' / '+(length/1000000).toFixed(1)+' MB' : ''}`;}}
    const data=new Uint8Array(received);let offset=0;for(const c of chunks){data.set(c,offset);offset+=c.length;}return data.buffer;
  }
  const web = await (await fetch(new URL('male-web.json',BASE), {signal})).json();
  if(web.original_sha256 !== manifest.hull_sha256)throw Error('Hüllen-Originalbindung abweichend');
  const hullData = await download(web.file,'Männliche Hülle',web.bytes);
  if (await digest(hullData) !== web.sha256) throw new Error('Hüllen-Prüfsumme abweichend');
  const hull = (await parse(hullData)).scene;
  let previewGeometry=preview?.geometry;
  if(!previewGeometry){
    const data=await (await fetch(new URL('assets/male-preview.bin',BASE),{signal})).arrayBuffer(),header=new Uint32Array(data,0,2),count=header[0];
    previewGeometry={positions:new Float32Array(data,8,count*3),normals:new Float32Array(data,8+count*12,count*3),indices:new Uint16Array(data,8+count*24,header[1])};
  }
  const outlineGeometry=new THREE.BufferGeometry();
  outlineGeometry.setAttribute('position',new THREE.BufferAttribute(previewGeometry.positions,3));
  outlineGeometry.setAttribute('normal',new THREE.BufferAttribute(previewGeometry.normals,3));
  outlineGeometry.setIndex(new THREE.BufferAttribute(previewGeometry.indices,1));
  surfaces.apply(hull,'skin',await surfaces.load('haut'),web.sha256);
  hull.traverse(o=>{if(o.isMesh)o.userData.skinGeometry=o.geometry;});
  hull.traverse(o=>{ if(o.isMesh) {smoothHullNormals(o.geometry);o.material = outlineMaterial(economy,true,THREE.MeshLambertMaterial);o.userData.hull=true;o.userData.skinMaterial=o.material;o.userData.outlineMaterial=outlineMaterial(economy);} });
  body.add(hull);
  const atlas=atlasSurfaces({download,digest,parse});
  const legend=document.createElement('p');
  legend.className='nerven-legende';legend.hidden=true;
  for(const [color,text] of [['#cc92a7','ZNS · Gehirn und Rückenmark'],['#f2bf65','PNS · periphere Nerven']]){
    const item=document.createElement('span'),dot=document.createElement('i');
    dot.style.backgroundColor=color;dot.setAttribute('aria-hidden','true');
    item.append(dot,document.createTextNode(text));legend.append(item);
  }
  layerStatus.before(legend);
  const searchable=[...manifest.entries,...nerveEntries,brainEntry];
  const assets = new Map(); const entries = new Map(searchable.map(e=>[e.id,e]));
  const pathEntries = new Map();
  for (const e of searchable) for(const file of e.geometry) {
    if (!pathEntries.has(file)) pathEntries.set(file, []);
    const list = pathEntries.get(file);
    if (e.id.startsWith('atlas:muskel:')) list.unshift(e);
    else list.push(e);
  }
  const progressive=await (await fetch(new URL('progressive.json',BASE),{signal})).json();
  const {ensureLayer,loaded}=layerLifecycle({host,progress,layerStatus,
    async load(value,{background,added}) {
      if(value==='nerven'){
        await atlas.nerves((asset,entry)=>{
          asset.group.traverse(o=>{
            if(!o.isMesh)return;
            const color=entry.system==='ZNS'?0xcc92a7:0xf2bf65;
            o.material=new SurfaceMaterial({color,side:THREE.DoubleSide,forceSinglePass:true});
            o.userData.baseColor=o.material.color.clone();
            o.userData.asset=asset;
            o.userData.entries=pathEntries.get(asset.file);
          });
          asset.group.visible=false;body.add(asset.group);assets.set(asset.file,asset);added.push(asset.file);
        });
        return;
      }
      const pack=progressive.layers[value];const bundle=await download(pack.file,'Schicht wird geladen',pack.bytes,background);
      if(await digest(bundle)!==pack.sha256)throw Error('Schicht-Prüfsumme abweichend');
      const baked=await surfaces.load(value);
      let i=0;
      for(const segment of pack.assets){const asset=manifest.assets.find(a=>a.file===segment.file);if(!asset||asset.sha256!==segment.sha256||asset.length!==segment.length)throw Error('Einzelbindung abweichend');
    const data=bundle.slice(segment.offset,segment.offset+segment.length);
    if(await digest(data)!==asset.sha256) throw new Error('Anatomie-Prüfsumme abweichend');
    const surface = organSurfaces.get(asset.sha256);
    let drawData = data;
    if (surface) {
      drawData = await download(surface[0], asset.name, asset.length, true);
      if (await digest(drawData) !== surface[1]) throw Error('Organoberfläche beschädigt');
    }
    const refined=await atlas.organ(asset.sha256);
    const group=refined?.group || (await parse(drawData)).scene;
    if(!refined)surfaces.apply(group,asset.file,baked,asset.sha256);
    const indexTriangles=await atlas.refineIndices(group,asset.sha256);
    let triangles=0;
    group.traverse(o=>{if(o.isMesh){
      triangles+=(o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count)/3;
      if (!surface && !refined) smoothHullNormals(o.geometry);
      o.material=new SurfaceMaterial({color:o.geometry.hasAttribute('color')?0xffffff:0xa4493e,vertexColors:o.geometry.hasAttribute('color'),...(economy?{}:{roughness:asset.kind==='organ'?.38:.65,metalness:0}),side:THREE.DoubleSide,forceSinglePass:true});
      o.userData.baseColor=o.material.color.clone();
      o.userData.asset=asset; o.userData.entries=pathEntries.get(asset.file)||[];
    }});
    if(triangles!==(refined?.triangles ?? indexTriangles ?? asset.triangles)) throw new Error('Dreieckszahl abweichend');
    group.visible=false;body.add(group);assets.set(asset.file,{...asset,group,triangles});added.push(asset.file);
    if(++i%50===0){if(!background)status.textContent=`Lokal geladen: ${i}/${manifest.assets.length} Geometrien`;await new Promise(r=>setTimeout(r,0));}

      }
    },
    rollback(added){for(const file of added){const a=assets.get(file);body.remove(a.group);a.group.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});assets.delete(file);}}
  });
  let layerGeneration=0;
  let skinOpacity=1;
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
  actions.append(btn('Ganze Figur','avatar-body',reset),btn('Region','avatar-region',()=>{if(regionBox)frame(regionBox);}),btn('Körperteil','avatar-focus',()=>{frame(selectedBox());}),btn('↶ Drehen','avatar-left',()=>rotate(Math.PI/6)),btn('Drehen ↷','avatar-right',()=>rotate(-Math.PI/6)),btn('＋ Näher','avatar-near',()=>zoom(0.75)),btn('− Weiter','avatar-far',()=>zoom(1.33)));
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
  const dataMarkers=createDataMarkers({THREE,viewport,assets,manifest,camera,choose});
  function render(){dataMarkers.paint();renderer.render(scene,camera);renderLabels();}
  function updateVisibility(){
    const outline=layer!=='haut';legend.hidden=layer!=='nerven';
    viewport.style.background='radial-gradient(ellipse at 45% 26%, #426b80 0%, #294d66 57%, #183649 100%)';
    hull.visible=true;
    hull.traverse(o=>{if(o.isMesh){o.material=outline?o.userData.outlineMaterial:o.userData.skinMaterial;o.geometry=outlineGeometry;}});
    let triangles=0, omitted=0;
    if(hull.visible)hull.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});
    for(const a of assets.values()) {
      const show=layerKinds[layer]?.includes(a.kind);
      a.group.visible=Boolean(show && triangles+a.triangles<=manifest.triangle_limit);
      if(a.group.visible)triangles+=a.triangles;else if(show)omitted++;
      a.group.traverse(o=>{if(o.isMesh){const muted=layer==='haut';o.material.color.copy(o.userData.baseColor);o.material.opacity=muted?.32:1;o.material.transparent=muted;o.material.depthWrite=!muted;o.material.needsUpdate=true;}});
    }
    status.textContent=`3D lokal bereit · ${manifest.entries.length} Registereinträge · ${[...assets.values()].filter(a=>a.group.visible).length} sichtbare Anatomieobjekte · ${triangles.toLocaleString('de-DE')} Dreiecke${omitted ? ` · ${omitted} durch Detailbudget ausgeblendet` : ''}`;
    host.dataset.triangles=String(triangles);host.dataset.layer=layer;host.dispatchEvent(new CustomEvent('avatar-layer',{bubbles:true,detail:{layer}}));
    for(const b of host.querySelectorAll('[data-layer]'))b.setAttribute('aria-pressed',String(b.dataset.layer===layer));
    const depth=peelLayers;host.querySelector('#layer-peel').value=depth.indexOf(layer);host.querySelector('#layer-peel').setAttribute('aria-valuetext',layerChoices.find(c=>c[0]===layer)?.[2]||'');
    layerStatus.textContent=layer==='haut'&&host.dataset.organs==='error'?'Organe konnten nicht geladen werden':layerChoices.find(c=>c[0]===layer)?.[2]+' · bereit';render();
  }
  let glowFrame,organFrame;
  function pulseSelection(e){
    cancelAnimationFrame(glowFrame);if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const start=performance.now();const tick=t=>{const p=Math.min(1,(t-start)/700);for(const f of e.geometry)assets.get(f)?.group.traverse(o=>{if(o.isMesh)o.material.emissiveIntensity=.35+.22*Math.sin(p*Math.PI);});render();if(p<1)glowFrame=requestAnimationFrame(tick);};glowFrame=requestAnimationFrame(tick);
  }
  function restoreMaterials(){cancelAnimationFrame(glowFrame);for(const a of assets.values())a.group.traverse(o=>{if(o.isMesh){o.material.emissiveIntensity=.35;o.material.emissive.setHex(0);o.material.color.copy(o.userData.baseColor);o.material.opacity=layer==='haut'?.32:1;o.material.transparent=layer==='haut';o.material.depthWrite=layer!=='haut';o.material.needsUpdate=true;}});}
  async function choose(e,hit=null){
    const generation=++layerGeneration;
    if(e.geometry.length){const kind=e.kind==='nerve'?'nerve':manifest.assets.find(a=>a.file===e.geometry[0])?.kind;const target=Object.keys(layerKinds).find(k=>k!=='haut'&&layerKinds[k].includes(kind));if(!loaded.has(target))await ensureLayer(target);}if(generation!==layerGeneration)return;
    badge.hidden=true;delete host.dataset.selected;selected=e;lastHit=hit;select.value=e.id;
    showLexicon(e);
    zoomView?.hide();
    restoreMaterials();
    if(e.geometry.length===0){
      host.querySelector('#avatar-focus').disabled=true;
      if(e.referenceModel){
        host.dataset.selected=e.id;
        detail.textContent=label(e)+(e.referenceWithoutSide ? ' · Das Quellmodell enthält keine Seitenangabe. ' : ' · Eigenes Quellmodell ohne Einpassung in die Figur. ');
        detail.append(btn('Muskel im Atlas ansehen','muskel-detail',()=>run(async()=>{
          const {openOrganAtlas}=await import('./organatlas-ansicht.js');
          if(!signal?.aborted&&host.isConnected)await openOrganAtlas(host,e.referenceModel,'bodyparts',signal);
        })));
      }else{
        detail.textContent=`${label(e)} — Dazu gibt es in dieser frühen Testfassung noch keine Darstellung.`;
      }
      render();await selectZoom(e);return;
    }
    const a=assets.get(e.geometry[0]);if(!a){detail.textContent='Dieser Körperteil ist noch nicht in 3D verfügbar.';return;}
    if(!dataMarkers.active&&(layer==='haut'||!layerKinds[layer].includes(a.kind))) {layer=Object.keys(layerKinds).find(k=>k!=='haut'&&layerKinds[k].includes(a.kind));document.getElementById('schicht-wahl').value=layer;updateVisibility();}
    // Selected object has priority within the measured view budget.
    for(const file of e.geometry){const selectedAsset=assets.get(file);if(!selectedAsset)continue;
      if(!selectedAsset.group.visible){for(const other of assets.values())other.group.visible=false;selectedAsset.group.visible=true;}
    }
    for(const asset of assets.values())asset.group.traverse(o=>{if(o.isMesh){const chosen=e.geometry.includes(asset.file);surfaceSelection(o.material,o.userData.baseColor,{selected:chosen,muted:exploring()&&!chosen,opacity:layer==='haut'?.32:1});}});
    pins=pins.filter(p=>p.id!==e.id);pins.unshift(e);pins=pins.slice(0,8);
    const box=selectedBox();regionBox=box.clone().expandByScalar(0.15);regionBox.intersect(bodyBox);
    host.querySelector('#avatar-focus').disabled=box.isEmpty();host.querySelector('#avatar-region').disabled=box.isEmpty();
    detail.replaceChildren();const title=document.createElement('strong'),latin=document.createElement('small');title.textContent=Array.isArray(e.names.de)?e.names.de.join(', '):e.names.de||'Körperteil';latin.textContent=Array.isArray(e.names.la)?e.names.la.join(', '):e.names.la||'';detail.append(title,latin);syncBadge();
    if(exploring())frame(box,1.65);

    host.dataset.selected=e.id;render();pulseSelection(e);onDataOrgan(e.id);
    if(!dataMarkers.active&&e.kind!=='nerve')await selectZoom(e);
  }
  const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('de').replace(/ß/g,'ss').trim();
  const results=host.querySelector('#search-results');
  function fillSelect(){
    const ideas=host.querySelector('.quick-suggestions');
    const term=norm(search.value);select.replaceChildren();results.replaceChildren();results.hidden=!term;
    const empty=document.createElement('option');empty.value='';empty.textContent='Körperteil wählen';select.append(empty);
    const rank=e=>{if(term==='darm' && ['org1:organ:small-intestine','org1:organ:large-intestine'].includes(e.id))return -1;const de=norm((Array.isArray(e.names.de)?e.names.de[0]:e.names.de)||'');return de===term?(layer==='nerven' && e.kind==='nerve' ? -1 : 0):de.startsWith(term+' ')?1:2;};
    const aliases={'bizeps':'biceps brachii','trizeps':'triceps brachii','unterarmmuskeln':'unterarm','unterarmmuskulatur':'unterarm'};
    const query=aliases[term] || term;
    const matched=searchable.filter(e=>!term||norm(`${label(e)} ${e.id} ${e.searchRegion || ''} ${(e.aliases || []).join(' ')}`).includes(query)).sort((a,b)=>term?(aliases[term]?Number(Boolean(b.atlasGroup))-Number(Boolean(a.atlasGroup)):0)||rank(a)-rank(b):0);
    const hasModel=e=>Boolean(e.geometry.length||e.referenceModel);
    for(const e of matched){const o=document.createElement('option');o.value=e.id;o.textContent=label(e)+(e.referenceWithoutSide?' — Quellmodell ohne Seitenangabe':e.referenceModel?' — separates Quellmodell':hasModel(e)?'':' — ohne 3D-Darstellung');select.append(o);}
    if(term&&matched.some(e=>rank(e)<=1&&!hasModel(e))){const p=document.createElement('p');p.textContent='Dazu gibt es in dieser frühen Testfassung noch keine Darstellung.';results.append(p);}
    for(const has3D of [true,false]){
      const rows=matched.filter(e=>hasModel(e)===has3D).slice(0,8);if(!term||!rows.length)continue;
      const title=document.createElement('p');title.textContent=has3D?'Zum Anschauen':'ohne 3D-Darstellung';results.append(title);
      for(const e of rows){const b=btn('', '',()=>run(()=>choose(e)));b.dataset.result=e.id;const name=document.createElement('span'),latin=document.createElement('small');name.textContent=Array.isArray(e.names.de)?e.names.de.join(', '):e.names.de||'Körperteil';latin.textContent=Array.isArray(e.names.la)?e.names.la.join(', '):e.names.la||'';b.append(name,latin);results.append(b);}
    }
    if(term&&!matched.length){const p=document.createElement('p');p.textContent='Dazu gibt es in dieser frühen Testfassung noch keine Darstellung.';results.append(p,ideas);}
    else search.after(ideas);
    if(selected)select.value=selected.id;
  }
  const run=fn=>Promise.resolve().then(fn).catch(error=>{layerStatus.textContent='Laden fehlgeschlagen. Bitte die Schicht erneut wählen.';status.textContent=error.message;});
  const refreshAtlas = attachOrganAtlas(host, 'male', signal);
  search.addEventListener('input',fillSelect);search.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();results.querySelector('button')?.focus();}if(e.key==='Escape'){results.hidden=true;}});
  select.addEventListener('change',()=>{const e=entries.get(select.value);if(e)run(()=>choose(e));});fillSelect();
  for(const b of host.querySelectorAll('.quick-suggestions button')){const e=entries.get(b.dataset.entry);if(!e?.geometry.length){b.remove();continue;}b.addEventListener('click',()=>run(()=>choose(e)));}
  const switchLayer=async value=>{const control=document.getElementById('schicht-wahl');control.value=value;control.dispatchEvent(new Event('change',{bubbles:true}));await api.setLayer(value);};
  for(const b of host.querySelectorAll('.layer-button'))b.addEventListener('click',()=>run(()=>switchLayer(b.dataset.layer)));
  host.querySelector('#layer-peel').addEventListener('input',e=>run(()=>switchLayer(peelLayers[Number(e.target.value)])));
  host.querySelector('#whole-body').addEventListener('click',()=>{zoomView?.hide();badge.hidden=true;selected=null;lastHit=null;delete host.dataset.selected;showLexicon(null);detail.textContent='Entdecken Sie Ihren Körper';reset();restoreMaterials();render();});
  host.querySelector('#canvas-reset').addEventListener('click',()=>host.querySelector('#whole-body').click());
  function pick(clientX,clientY,hover=false){
    const r=renderer.domElement.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((clientX-r.left)/r.width*2-1,1-(clientY-r.top)/r.height*2),camera);
    const meshes=[];for(const a of assets.values())if(layer!=='haut'&&a.group.visible)a.group.traverse(o=>{if(o.isMesh)meshes.push(o);});
    const hit=raycaster.intersectObjects(meshes,false)[0];
    if(hit){const e=hit.object.userData.entries[0];if(e){if(hover){if(selected)return;detail.replaceChildren();const name=document.createElement("strong"),latin=document.createElement("small");name.textContent=Array.isArray(e.names.de)?e.names.de.join(", "):e.names.de||"Körperteil";latin.textContent=Array.isArray(e.names.la)?e.names.la.join(", "):e.names.la||"";detail.append(name,latin);syncBadge();showLexicon(e);return;}choose(e,{point:hit.point.toArray(),faceIndex:hit.faceIndex,file:hit.object.userData.asset.file});}return;}
    const shellHit=(layer==='haut')?raycaster.intersectObject(hull,true)[0]:null;
    if(shellHit){if(exploring()){detail.replaceChildren();const name=document.createElement('strong'),latin=document.createElement('small');name.textContent='Haut';latin.textContent='Cutis · vereinfachte Körperhülle';detail.append(name,latin);syncBadge();showLexicon(null);return;}if(hover)return;const p=shellHit.point;const region=p.y>1.52?'kopf':p.y>1.43?'hals':Math.abs(p.x)>0.20&&p.y>0.76?(p.x>0?'arm_links':'arm_rechts'):p.y>1.16?'brust':p.y>0.97?'bauch':p.y>0.78?'becken':p.x>0?'bein_links':'bein_rechts';onRegion(region);}
  }
  let pointer=null, tapPending=false;
  renderer.domElement.addEventListener('pointerdown',ev=>{tapPending=false;pointer=[ev.clientX,ev.clientY];});
  renderer.domElement.addEventListener('pointerup',ev=>{tapPending=Boolean(pointer&&Math.hypot(ev.clientX-pointer[0],ev.clientY-pointer[1])<5);pointer=null;});
  // Finish the native gesture before a region change scrolls/reorders the page.
  renderer.domElement.addEventListener('click',ev=>{if(tapPending){tapPending=false;pick(ev.clientX,ev.clientY);}});
  renderer.domElement.addEventListener('pointermove',ev=>{if(!pointer&&ev.pointerType==='mouse'&&exploring())pick(ev.clientX,ev.clientY,true);});
  renderer.domElement.addEventListener('pointercancel',()=>{pointer=null;tapPending=false;});
  renderer.domElement.addEventListener('keydown',ev=>{if(ev.key==='ArrowLeft'){ev.preventDefault();rotate(Math.PI/12);}if(ev.key==='ArrowRight'){ev.preventDefault();rotate(-Math.PI/12);}if(ev.key==='+')zoom(0.8);if(ev.key==='-')zoom(1.25);});
  controls.addEventListener('change',render);
  const resize=new ResizeObserver(()=>{const w=viewport.clientWidth,h=viewport.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();render();});resize.observe(viewport);
  performance.mark('dht-detail-built');
  reset();if(preview){preview.freeze();rotate(-preview.angle);}updateVisibility();performance.mark('dht-detail-frame');if(preview&&!matchMedia('(prefers-reduced-motion: reduce)').matches)await preview.canvas.animate([{opacity:1},{opacity:0}],{duration:180}).finished;preview?.dispose();renderer.domElement.id='avatar-canvas';host.dataset.ready='true';performance.mark('dht-glass-ready');host.setAttribute('aria-busy','false');progress.hidden=true;
  const api={
    setDataMarkers(counts, selected){dataMarkers.set(counts,selected);if(!counts)restoreMaterials();render();},
    selectDataOrgan(id){const e=manifest.entries.find(e=>e.id===id);if(e)return choose(e);},
    async setLayer(value){const generation=++layerGeneration;await ensureLayer(value);if(generation!==layerGeneration)return;if(layer!==value){zoomView?.hide();badge.hidden=true;restoreMaterials();selected=null;lastHit=null;select.value='';delete host.dataset.selected;showLexicon(null);detail.textContent='Tippen Sie auf einen Körperteil oder suchen Sie einen Namen.';host.querySelector('#avatar-focus').disabled=true;}layer=value;updateVisibility();if(!matchMedia('(prefers-reduced-motion: reduce)').matches)renderer.domElement.animate([{opacity:.6},{opacity:1}],{duration:240});},
    setOpacity(value){skinOpacity=Math.min(1,Math.max(0,value));hull.traverse(o=>{if(o.isMesh){const opacity=Math.min(1,Math.max(0,value));const m=o.userData.skinMaterial;m.opacity=opacity*(economy?.48:.78);if(m.uniforms)m.uniforms.opacity.value=m.opacity;}});render();},
    setLabels(value){labelsEnabled=value;render();},
    focusRegion(id){const bounds={kopf:[1.48,1.72],hals:[1.4,1.53],brust:[1.15,1.44],bauch:[0.96,1.17],becken:[0.77,0.98],ruecken:[0.85,1.48],arm_links:[0.7,1.45],arm_rechts:[0.7,1.45],bein_links:[0,0.85],bein_rechts:[0,0.85]}[id];if(!bounds)return;regionBox=bodyBox.clone();regionBox.min.y=bounds[0];regionBox.max.y=bounds[1];if(id.endsWith('_links'))regionBox.min.x=0;if(id.endsWith('_rechts'))regionBox.max.x=0;host.querySelector('#avatar-region').disabled=false;frame(regionBox);},
    state(){return {viewProjection:new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).toArray(),revision:THREE.REVISION,selected:selected?.id,hit:lastHit,layer,camera:camera.position.toArray(),target:controls.target.toArray(),triangles:renderer.info.render.triangles,outline: {visible:layer!=='haut',meshes:(()=>{const rows=[];hull.traverse(o=>{if(o.isMesh)rows.push({opacity:o.material.opacity,depthWrite:o.material.depthWrite});});return rows;})()},skinOpacity,hullOpacity:layer==='haut'?skinOpacity:hull.children.find(o=>o.isMesh)?.material.opacity,highlighted:[...assets.values()].filter(a=>{let lit=false;a.group.traverse(o=>{if(o.isMesh&&o.material.emissive.getHex()!==0)lit=true;});return a.group.visible&&lit;}).map(a=>a.file),visible:[...assets.values()].filter(a=>a.group.visible).map(a=>a.file),labels:labelsHost.querySelectorAll('.avatar-label').length,register:manifest.register_count};},
    dispose(){zoomView?.dispose();cancelAnimationFrame(glowFrame);stopOrgans();disposeStudio();resize.disconnect();controls.dispose();scene.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();if(o.userData.hull){o.userData.skinMaterial.dispose();o.userData.outlineMaterial.dispose();}}});renderer.dispose();},
  };
  // Read-only observability; interaction always follows the actual DOM/canvas handlers.
  Object.defineProperty(host,'avatarState',{value:()=>api.state()});
  Object.defineProperty(host,'avatarInventory',{value:()=>[...assets.values()].map(a=>{
    let objects=0,triangles=0;a.group.traverse(o=>{if(o.isMesh){objects++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});
    const materials=[];a.group.traverse(o=>{if(o.isMesh)materials.push({opacity:o.material.opacity,depthWrite:o.material.depthWrite,transparent:o.material.transparent});});
    return {file:a.file,kind:a.kind,visible:a.group.visible,objects,triangles,materials,entryIds:(pathEntries.get(a.file)||[]).map(e=>e.id)};
  })});
  Object.defineProperty(host,'avatarGeometry',{value:()=>{
    hull.updateWorldMatrix(true,true);
    const rows=[];hull.traverse(o=>{if(o.isMesh){const g=o.geometry,p=g.getAttribute('position'),points=[];
      for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i);o.localToWorld(v);body.worldToLocal(v);points.push(v.x,v.y,v.z);}
      rows.push({id:'AHF2_male_study_envelope',name:o.name,positions:points,indices:g.index?Array.from(g.index.array):Array.from({length:p.count},(_,i)=>i)});
    }});return rows;
  }});
  const stopOrgans=organsAfterPaint({host,signal,ensureLayer,isSkin:()=>layer==='haut',refresh:updateVisibility,render,
    fade(t){for(const a of assets.values())if(a.kind==='organ')a.group.traverse(o=>{if(o.isMesh)o.material.opacity=.32*t;});}
  });
  replayPendingSelection(host,{choose:id=>{const e=entries.get(id);if(e)run(()=>choose(e));},setLayer:value=>run(()=>switchLayer(value))});
  return api;
}
